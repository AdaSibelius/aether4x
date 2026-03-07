import type { GameState, GameEvent, Fleet, Ship, Colony } from '../types';
import type { ShipComponent, ShipDesign } from '../types/fleet';
import { RNG } from '../utils/rng';
import { makeEvent } from './events';
import { BALANCING } from './constants';

// ─── Battle Simulation Types ──────────────────────────────────────────────────

export interface BattleShipSnapshot {
    shipId: string;
    shipName: string;
    hullPct: number;   // 0–100
    shieldPct: number; // 0–100
    destroyed: boolean;
}

export interface BattleRound {
    round: number;
    /** Hull damage dealt by side A to side B this round. */
    damageAtoB: number;
    /** Hull damage dealt by side B to side A this round. */
    damageBtoA: number;
    /** Snapshot of side A ship health at end of round. */
    sideA: BattleShipSnapshot[];
    /** Snapshot of side B ship health at end of round. */
    sideB: BattleShipSnapshot[];
    /** Names of ships destroyed this round. */
    destroyedThisRound: string[];
}

export interface BattleReport {
    winner: 'A' | 'B' | 'Draw';
    fleetAName: string;
    fleetBName: string;
    rounds: BattleRound[];
    totalDamageAtoB: number;
    totalDamageBtoA: number;
    survivorsA: number;
    survivorsB: number;
}

// ─── Damage Resolution ────────────────────────────────────────────────────────

/**
 * Applies a single hit to a target ship.
 * Resolution order: Shields absorb first → Armor mitigates remaining → Hull takes rest.
 *
 * @returns The actual hull damage dealt after mitigation.
 */
function applyHit(ship: Ship, rawDamage: number, design: { components: ShipComponent[]; maxHullPoints: number }): number {
    let remaining = rawDamage;

    // 1. Shields absorb damage first
    if (ship.shieldPoints > 0) {
        const absorbed = Math.min(ship.shieldPoints, remaining);
        ship.shieldPoints -= absorbed;
        remaining -= absorbed;
    }

    if (remaining <= 0) return 0;

    // 2. Armor mitigates remaining (additive flat reduction from all armor plates)
    const armorRating = design.components
        .filter(c => c.type === 'Armor')
        .reduce((sum, c) => sum + (c.stats.armorRating ?? 0), 0);

    if (armorRating > 0) {
        // Mitigation is a percentage: armorRating / (armorRating + 100). Diminishing returns.
        const mitigation = armorRating / (armorRating + 100);
        remaining = remaining * (1 - mitigation);
    }

    // 3. Hull takes the rest
    const hullDamage = Math.max(0, remaining);
    ship.hullPoints = Math.max(0, ship.hullPoints - hullDamage);
    return hullDamage;
}

/**
 * Recharges shields for all ships in a fleet that are not in combat this tick.
 * Called in the fleet tick for all fleets (combatants recharge after taking damage).
 */
export function rechargeShields(fleet: Fleet, state: GameState, dt: number): void {
    const empire = state.empires[fleet.empireId];
    if (!empire) return;

    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        const maxShields = design.components
            .filter(c => c.type === 'Shield')
            .reduce((s, c) => s + (c.stats.shieldPoints ?? 0), 0);

        if (maxShields <= 0 || ship.shieldPoints >= maxShields) continue;

        const rechargeRate = design.components
            .filter(c => c.type === 'Shield')
            .reduce((s, c) => s + (c.stats.recharge ?? 0), 0);

        const recharged = (rechargeRate / 86400) * dt;
        ship.shieldPoints = Math.min(maxShields, ship.shieldPoints + recharged);
    }
}

// ─── Fleet Combat Resolution ──────────────────────────────────────────────────

/**
 * Resolves one tick of combat between two hostile fleets.
 * Each ship fires its weapons (subject to cooldown and range).
 *
 * Performance notes:
 *  - Weapons do DPS spread over dt seconds (no per-shot iteration for large ticks).
 *  - Destroyed ships are removed from the state.ships map immediately.
 *  - All damage calcs are O(W) where W = number of weapons across the firing fleet.
 *
 * @param attacker - The fleet taking the initiative this tick.
 * @param defender - The fleet being attacked.
 * @param distanceAU - Current distance between the two fleets.
 * @param state - Mutable game state.
 * @param dt - Tick duration in seconds.
 * @param rng - Seeded RNG for determinism.
 * @param events - Accumulator for events to emit.
 */
export function resolveFleetCombat(
    attacker: Fleet,
    defender: Fleet,
    distanceAU: number,
    state: GameState,
    dt: number,
    rng: RNG,
    events: GameEvent[]
): void {
    const attackerEmpire = state.empires[attacker.empireId];
    const defenderEmpire = state.empires[defender.empireId];
    if (!attackerEmpire || !defenderEmpire) return;

    // Select a target ship from the defender - focus fire on lowest hull % for simplicity
    const aliveDefenders = defender.shipIds
        .map(id => state.ships[id])
        .filter((s): s is Ship => !!s && s.hullPoints > 0);

    if (aliveDefenders.length === 0) return;

    // Focus fire on most-damaged ship
    aliveDefenders.sort((a, b) => (a.hullPoints / a.maxHullPoints) - (b.hullPoints / b.maxHullPoints));
    const primaryTarget = aliveDefenders[0];
    const targetDesign = defenderEmpire.designLibrary.find(d => d.id === primaryTarget.designId);
    if (!targetDesign) return;

    let totalDamageDealt = 0;
    let weaponsFired = 0;
    const destroyedShipNames: string[] = [];

    // Each attacker ship fires its weapons
    for (const shipId of attacker.shipIds) {
        const ship = state.ships[shipId];
        if (!ship || ship.hullPoints <= 0) continue;
        const design = attackerEmpire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        for (const weapon of design.weaponSystems) {
            const range = weapon.stats.range ?? 0;
            if (distanceAU > range) continue; // Out of range

            // Cooldown management
            if (!ship.weaponCooldowns) ship.weaponCooldowns = {};
            const cooldownRemaining = ship.weaponCooldowns[weapon.id] ?? 0;
            if (cooldownRemaining > 0) {
                ship.weaponCooldowns[weapon.id] = Math.max(0, cooldownRemaining - dt);
                continue; // Still reloading
            }

            // Fire! Damage is per-shot, ROF = shots per second
            const rof = weapon.stats.rof ?? 1;
            const shotsThisTick = Math.floor(rof * (dt / 86400)); // Normalised to game-days per tick
            const damage = (weapon.stats.damage ?? 0) * Math.max(1, shotsThisTick);

            if (damage > 0) {
                const hullDamage = applyHit(primaryTarget, damage, targetDesign);
                totalDamageDealt += hullDamage;
                weaponsFired++;
            }

            // Reset weapon cooldown (1 / rof in seconds, scaled to game seconds)
            const cooldownSec = rof > 0 ? (86400 / rof) : 86400;
            ship.weaponCooldowns[weapon.id] = cooldownSec;
        }
    }

    // Report engagement if weapons fired
    if (weaponsFired > 0) {
        events.push(makeEvent(state.turn, state.date, 'CombatEngagement',
            `Fleet "${attacker.name}" engaged "${defender.name}" at ${distanceAU.toFixed(2)} AU, dealing ${Math.floor(totalDamageDealt)} hull damage.`,
            rng, { fleetId: attacker.id, targetFleetId: defender.id }
        ));
    }

    // Check for destroyed ships in defender fleet
    for (const shipId of [...defender.shipIds]) {
        const ship = state.ships[shipId];
        if (ship && ship.hullPoints <= 0) {
            destroyedShipNames.push(ship.name);
            delete state.ships[shipId];
        }
    }
    // Remove dead ships from fleet roster
    defender.shipIds = defender.shipIds.filter(id => !!state.ships[id]);

    if (destroyedShipNames.length > 0) {
        events.push(makeEvent(state.turn, state.date, 'ShipDestroyed',
            `${destroyedShipNames.length} ship(s) destroyed in "${defender.name}": ${destroyedShipNames.join(', ')}.`,
            rng, { fleetId: defender.id, empireId: defender.empireId }
        ));
    }
}

// ─── Orbital Bombardment ──────────────────────────────────────────────────────

/**
 * Resolves orbital bombardment from a hostile fleet against a colony.
 * Focuses on lowering ground defenses first, then causes collateral damage to population.
 */
export function resolveOrbitalBombardment(
    fleet: Fleet,
    colony: Colony,
    state: GameState,
    dt: number,
    rng: RNG,
    events: GameEvent[]
): void {
    const empire = state.empires[fleet.empireId];
    if (!empire) return;

    let totalBombardmentDamage = 0;

    // Calculate total bombardment damage this tick
    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship || ship.hullPoints <= 0) continue;

        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        for (const comp of design.components) {
            if (comp.type === 'Bombardment') {
                const dmg = comp.stats.groundDefensesDamage ?? 0;
                const rof = comp.stats.rof ?? 1;
                const shotsThisTick = rof * (dt / 86400); // shots scaled to dt
                totalBombardmentDamage += dmg * shotsThisTick;
            }
        }
    }

    if (totalBombardmentDamage <= 0) return;

    // Apply damage to ground defenses first
    if (colony.groundDefenses > 0) {
        const dmgToDefenses = Math.min(colony.groundDefenses, totalBombardmentDamage);
        colony.groundDefenses -= dmgToDefenses;
        totalBombardmentDamage -= dmgToDefenses;

        // Only log significantly large instance hits to avoid spam, or combine it.
        // We'll emit one event per bombard tick.
        events.push(makeEvent(state.turn, state.date, 'ColonyBombarded',
            `Colony ${colony.name} was bombarded by ${fleet.name}. Ground defenses took ${Math.floor(dmgToDefenses)} damage.`,
            rng, { colonyId: colony.id, fleetId: fleet.id, empireId: colony.empireId }
        ));
    }

    // Any remaining damage acts as collateral damage directly on population
    if (totalBombardmentDamage > 0 && colony.groundDefenses <= 0) {
        // popLossPercentage per day per 100 dmg
        const popLossPercentage = BALANCING.BOMBARDMENT_COLLATERAL_RATE * (totalBombardmentDamage / 100);
        const popLost = colony.population * popLossPercentage * (dt / 86400);

        if (popLost > 0) {
            colony.population = Math.max(0, colony.population - popLost);
            colony.happiness = Math.max(0, colony.happiness - 10);

            events.push(makeEvent(state.turn, state.date, 'ColonyBombarded',
                `Colony ${colony.name} defenses have fallen! Bombardment by ${fleet.name} killed ${(popLost).toFixed(2)}M population.`,
                rng, { colonyId: colony.id, fleetId: fleet.id, empireId: colony.empireId }
            ));
        }
    }
}


// ─── Dry-Run Battle Simulator ─────────────────────────────────────────────────

function snapshotSide(
    fleet: Fleet,
    ships: Record<string, Ship>,
    designs: ShipDesign[]
): BattleShipSnapshot[] {
    return fleet.shipIds.map(id => {
        const ship = ships[id];
        if (!ship) return { shipId: id, shipName: '(destroyed)', hullPct: 0, shieldPct: 0, destroyed: true };
        const design = designs.find(d => d.id === ship.designId);
        const maxShields = design?.components
            .filter(c => c.type === 'Shield')
            .reduce((s, c) => s + (c.stats.shieldPoints ?? 0), 0) ?? 0;
        return {
            shipId: id,
            shipName: ship.name,
            hullPct: Math.round((ship.hullPoints / ship.maxHullPoints) * 100),
            shieldPct: maxShields > 0 ? Math.round((ship.shieldPoints / maxShields) * 100) : -1,
            destroyed: false,
        };
    });
}

/**
 * Runs a deterministic dry-run battle between two fleets.
 * Does NOT mutate the real game state — works on deep-cloned state slices.
 *
 * @param fleetAId - ID of fleet A (attacker perspective).
 * @param fleetBId - ID of fleet B.
 * @param state - Live game state (will NOT be mutated).
 * @param maxRounds - Safety cap on rounds (default 200).
 * @param tickSeconds - Simulated seconds per round (default 86400 = 1 day).
 * @returns A full BattleReport.
 */
export function simulateBattle(
    fleetAId: string,
    fleetBId: string,
    state: GameState,
    maxRounds = 200,
    tickSeconds = 86400
): BattleReport {
    // Deep-clone only what we need: relevant ships and empire design libraries.
    // Avoids O(N) clone of entire galaxy.
    const allFleets = Object.values(state.empires).flatMap(e => e.fleets);
    const origFleetA = allFleets.find(f => f.id === fleetAId);
    const origFleetB = allFleets.find(f => f.id === fleetBId);

    if (!origFleetA || !origFleetB) {
        return { winner: 'Draw', fleetAName: '?', fleetBName: '?', rounds: [], totalDamageAtoB: 0, totalDamageBtoA: 0, survivorsA: 0, survivorsB: 0 };
    }

    // Clone fleets and ships into a mini-state
    const fleetA: Fleet = JSON.parse(JSON.stringify(origFleetA));
    const fleetB: Fleet = JSON.parse(JSON.stringify(origFleetB));

    const simShips: Record<string, Ship> = {};
    for (const id of [...fleetA.shipIds, ...fleetB.shipIds]) {
        if (state.ships[id]) simShips[id] = JSON.parse(JSON.stringify(state.ships[id]));
    }

    const empireA = state.empires[fleetA.empireId];
    const empireB = state.empires[fleetB.empireId];

    // Build a minimal GameState stub for combat resolution
    const simState: GameState = {
        ...state,
        ships: simShips,
        empires: {
            [fleetA.empireId]: { ...empireA, fleets: [fleetA] },
            [fleetB.empireId]: { ...empireB, fleets: [fleetB] },
        },
    };

    // Both fleets fight at point-blank (0.0 AU) so range is never the limiting factor
    const COMBAT_DIST = 0.0;
    const rng = new RNG(state.seed + 9999);
    const dummyEvents: GameEvent[] = [];

    const rounds: BattleRound[] = [];
    let totalDamageAtoB = 0;
    let totalDamageBtoA = 0;

    for (let round = 1; round <= maxRounds; round++) {
        const aAlive = fleetA.shipIds.filter(id => simShips[id] && simShips[id].hullPoints > 0);
        const bAlive = fleetB.shipIds.filter(id => simShips[id] && simShips[id].hullPoints > 0);

        if (aAlive.length === 0 || bAlive.length === 0) break;

        // Track HP before the round
        const bHullBefore = bAlive.reduce((s, id) => s + (simShips[id]?.hullPoints ?? 0), 0);
        const aHullBefore = aAlive.reduce((s, id) => s + (simShips[id]?.hullPoints ?? 0), 0);

        // A fires at B, B fires at A
        resolveFleetCombat(fleetA, fleetB, COMBAT_DIST, simState, tickSeconds, rng, dummyEvents);
        resolveFleetCombat(fleetB, fleetA, COMBAT_DIST, simState, tickSeconds, rng, dummyEvents);

        // Recharge shields for survivors
        rechargeShields(fleetA, simState, tickSeconds);
        rechargeShields(fleetB, simState, tickSeconds);

        const bHullAfter = bAlive.reduce((s, id) => s + (simShips[id]?.hullPoints ?? 0), 0);
        const aHullAfter = aAlive.reduce((s, id) => s + (simShips[id]?.hullPoints ?? 0), 0);

        const damageAtoB = Math.max(0, bHullBefore - bHullAfter);
        const damageBtoA = Math.max(0, aHullBefore - aHullAfter);
        totalDamageAtoB += damageAtoB;
        totalDamageBtoA += damageBtoA;

        // Collect destroyed ship names this round
        const destroyedThisRound: string[] = [];
        for (const id of [...fleetA.shipIds, ...fleetB.shipIds]) {
            const s = simShips[id];
            if (s && s.hullPoints <= 0 && !rounds.some(r => r.destroyedThisRound.some(n => n === s.name))) {
                destroyedThisRound.push(s.name);
            }
        }

        rounds.push({
            round,
            damageAtoB,
            damageBtoA,
            sideA: snapshotSide(fleetA, simShips, empireA.designLibrary),
            sideB: snapshotSide(fleetB, simShips, empireB.designLibrary),
            destroyedThisRound,
        });
    }

    const survivorsA = fleetA.shipIds.filter(id => simShips[id] && simShips[id].hullPoints > 0).length;
    const survivorsB = fleetB.shipIds.filter(id => simShips[id] && simShips[id].hullPoints > 0).length;

    let winner: BattleReport['winner'];
    if (survivorsA > 0 && survivorsB === 0) winner = 'A';
    else if (survivorsB > 0 && survivorsA === 0) winner = 'B';
    else winner = 'Draw';

    return {
        winner,
        fleetAName: fleetA.name,
        fleetBName: fleetB.name,
        rounds,
        totalDamageAtoB,
        totalDamageBtoA,
        survivorsA,
        survivorsB,
    };
}
