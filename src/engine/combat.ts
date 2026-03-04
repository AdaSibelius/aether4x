import type { GameState, GameEvent, Fleet, Ship, Empire } from '../types';
import type { ShipComponent } from '../types/fleet';
import { RNG } from '../utils/rng';
import { makeEvent } from './events';
import { generateId } from '../utils/id';

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

// ─── Max Shield Initialisation ────────────────────────────────────────────────

/**
 * Call once when a Ship is first created to set its initial shield points.
 */
export function initShipShields(ship: Ship, state: GameState): void {
    const empire = state.empires[ship.empireId];
    if (!empire) return;
    const design = empire.designLibrary.find(d => d.id === ship.designId);
    if (!design) return;

    const maxShields = design.components
        .filter(c => c.type === 'Shield')
        .reduce((s, c) => s + (c.stats.shieldPoints ?? 0), 0);

    ship.shieldPoints = maxShields; // Start at full shields
}
