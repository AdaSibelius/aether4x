/**
 * @module ai_utils
 * @description
 * Pure utility functions and heuristics used by AI routines to evaluate
 * the game state without direct mutations. 
 * 
 * **Architecture & State Mutations:**
 * - Functions in this file (e.g., `calculateFleetCombatPower`, `evaluateSystemValue`) are PURE.
 * - They do not modify `GameState`, only read it to return scores, probabilities, or sorted lists.
 */
import type { GameState, Fleet, Empire, Colony } from '../types';
import { getAdmiralBonuses } from './officers';
import { BALANCING } from './constants';
import { canDetect } from './detection';

// ─── 1. Combat Evaluation ───────────────────────────────────────────────────

/**
 * Distills a fleet's raw components into a single 'Combat Power' metric.
 * This allows AI to quickly compare fleet strengths without running full simulations.
 * Factor weights:
 * - Weapon DPS (highly weighted)
 * - Effective HP (Hull + Armor + Shields)
 * - Admiral Bonuses
 * @pending AI Fleet combat heuristics placeholder
 */
export function calculateFleetCombatPower(fleet: Fleet, state: GameState): number {
    const empire = state.empires[fleet.empireId];
    if (!empire || fleet.shipIds.length === 0) return 0;

    let totalDps = 0;
    let totalEhp = 0; // Effective Hit Points

    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        let shipDps = 0;
        let armorEhp = 0;
        let shieldEhp = 0;

        for (const comp of design.components) {
            if (comp.type === 'Weapon' && comp.stats.damage && comp.stats.rof) {
                shipDps += comp.stats.damage * comp.stats.rof;
            }
            if (comp.type === 'Armor') armorEhp += comp.stats.armorRating ?? 0;
            if (comp.type === 'Shield') shieldEhp += comp.stats.shieldPoints ?? 0;
        }

        totalDps += shipDps;
        // Approximation: 1 Armor rating provides ~1% mitigation, making EHP = Hull * (1 + Armor/100) + Shields
        const mitigationFactor = 1 + (armorEhp / 100);
        totalEhp += (design.maxHullPoints * mitigationFactor) + shieldEhp;
    }

    // Admiral tactical bonus adds directly to combat efficiency
    const admiralBonuses = getAdmiralBonuses(empire.officers, fleet.admiralId);
    const tacticalBonus = 1 + (admiralBonuses.tactical ?? 0);

    // Baseline formula: (DPS * 10) + (EHP / 100) * TacticalMultiplier
    return ((totalDps * 10) + (totalEhp / 100)) * tacticalBonus;
}

/**
 * Fast heuristic to determine the likely winner between two fleets.
 * Returns probability of Fleet A winning (0.0 to 1.0).
 * Useful for AI deciding whether to engage or retreat.
 * @pending AI combat prediction placeholder
 */
export function estimateBattleOutcome(fleetA: Fleet, fleetB: Fleet, state: GameState): number {
    const powerA = calculateFleetCombatPower(fleetA, state);
    const powerB = calculateFleetCombatPower(fleetB, state);

    if (powerA === 0 && powerB === 0) return 0.5;

    // Convert power ratio to a win probability (Elo-style curve could be used, but ratio is simpler)
    const totalPower = powerA + powerB;
    return powerA / totalPower;
}

// ─── 2. Situational Awareness ───────────────────────────────────────────────

/**
 * Returns a list of *enemy* fleets that the given empire can currently see in a specific star system.
 * Filters out friendly fleets, neutral civilian traffic (if we add that), and undetected fleets.
 */
export function getDetectedHostileFleets(empireId: string, starId: string, state: GameState): Fleet[] {
    const empire = state.empires[empireId];
    if (!empire) return [];

    const allFleets = Object.values(state.empires).flatMap(e => e.fleets);

    return allFleets.filter(fleet => {
        // Must be in the right system and not own fleet
        if (fleet.currentStarId !== starId || fleet.empireId === empireId) return false;

        // @pending (Phase 4b): Check treaty status here

        // Can we see them?
        return fleet.detectedByEmpireIds?.includes(empireId);
    });
}

/**
 * Returns true if ANY rival empire has detected this fleet.
 * Crucial for AI to know if a stealth insertion failed.
 * @pending AI detection awareness placeholder
 */
export function isFleetDetectedByEnemy(fleet: Fleet): boolean {
    if (!fleet.detectedByEmpireIds) return false;

    // If it's detected by anyone other than its owner, it's visible.
    // NOTE: This assumes all non-owners are 'enemies'. Update when diplomacy exists.
    return fleet.detectedByEmpireIds.some(id => id !== fleet.empireId);
}

// ─── 3. Strategic Targeting ─────────────────────────────────────────────────

/**
 * Evaluates known enemy colonies and returns a sorted list of vulnerable targets.
 * Sorts by easiest to bombard/invade first (lowest groundDefenses relative to population).
 * @pending AI invasion logic placeholder
 */
export function getVulnerableColonies(empireId: string, state: GameState): Colony[] {
    // Only return colonies that are in systems where we have sensor coverage.
    // For now, we'll scan all foreign colonies, but realistically AI should only know about ones it has visited.

    const enemyColonies = Object.values(state.colonies).filter(c => c.empireId !== empireId);

    // Sort by weakness: fewer defenses per population = softer target
    return enemyColonies.sort((a, b) => {
        const ratioA = a.population > 0 ? (a.groundDefenses / a.population) : 0;
        const ratioB = b.population > 0 ? (b.groundDefenses / b.population) : 0;
        return ratioA - ratioB;
    });
}

/**
 * Evaluates a star system's strategic worth.
 * Used by AI to prioritize colonization and conquest.
 * Higher score = more valuable.
 * @pending AI expansion logic placeholder
 */
export function evaluateSystemValue(starId: string, state: GameState): number {
    const star = state.galaxy.stars[starId];
    if (!star) return 0;

    let value = 0;

    // Factor 1: Habitability (potential for colonies)
    for (const p of star.planets) {
        // A perfectly habitable planet is highly valuable.
        const habitabilityScore = p.atmosphere === 'Breathable' ? 100 : 10;
        value += habitabilityScore * 10;

        // Bonus for rich mineral deposits
        for (const res of p.minerals) {
            value += res.amount / 1000;
        }
    }

    // Factor 2: Strategic Location (jump gates / heavily connected nodes)
    // A system with many connections is a crucial chokepoint/hub.
    const connectionCount = state.galaxy.jumpPoints.filter(g => g.starId === starId || g.targetStarId === starId).length;
    value += connectionCount * 500;

    return value;
}
