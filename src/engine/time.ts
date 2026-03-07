import type {
    GameState
} from '../types';
import { RNG } from '../utils/rng';
import { tickEmpire } from './empire_logic';
import { tickAetherHarvesting } from './colonies';
import { tickFleets } from './fleets';
import { updateVisibility } from './detection';
import { tickBorders } from './border';

import SimLogger from '../utils/logger';

export function advanceTick(state: GameState): GameState {
    SimLogger.info('SYSTEM', `Advancing tick: ${state.tickLength}s (dt: ${state.tickLength})`);

    // 1. Initial State Preparation
    const next = {
        ...state,
        empires: { ...state.empires },
        ships: { ...state.ships },
        colonies: { ...state.colonies }
    };
    const dt = state.tickLength;
    next.turn += dt;
    next.date = new Date(new Date(next.date).getTime() + dt * 1000);

    /**
     * Simulation Contract: All randomness in the tick cycle MUST derive from this seeded RNG.
     * The seed is derived from the initial game seed + the total elapsed turn time, 
     * ensuring identical replays from the same starting state.
     */
    const baseSeed = next.initialSeed ?? next.seed ?? 0;
    const rng = new RNG(baseSeed + next.turn);

    // 2. Snapshot Logic
    const SNAPSHOT_INTERVAL = 86400 * 30;
    const isSnapshotTick = Math.floor(next.turn / SNAPSHOT_INTERVAL) > Math.floor(state.turn / SNAPSHOT_INTERVAL);

    // 3. Phase: Empire & Institutional Logic
    // This includes research, budgets, and national events.
    for (const empireId in next.empires) {
        const empire = { ...next.empires[empireId] };
        const events = tickEmpire(next, empire, rng, dt, isSnapshotTick);

        // Stamp turn on newly created events
        for (const evt of events) {
            evt.turn = next.turn;
            evt.date = next.date.toISOString().split('T')[0];
        }

        empire.events = [
            ...events,
            ...empire.events.slice(0, 99), // keep last 100 events
        ];
        next.empires[empireId] = empire;
    }

    // 4. Phase: Infrastructure & Harvesting
    // Resources are extracted and processed before movement to ensure fuel/material availability.
    // This call is now deduplicated.
    tickAetherHarvesting(next, dt);

    // 5. Phase: Movement & Physics
    // Ships and fleets move based on their orders and physics.
    const shipEvents = tickFleets(next, dt, rng);

    // 5.5 Phase: Aetheric Detection (Fog of War)
    // Must run after all movement so we detect based on final positions this tick.
    updateVisibility(next);

    // 5.8 Phase: Borders & Sovereignty
    const borderEvents = tickBorders(next, dt, rng);
    shipEvents.push(...borderEvents);

    // 6. Phase: Event Distribution
    // Distribute ship events to the correct empire logs.
    // Combat events are ALSO mirrored to the player so they always see battles in their space.
    const COMBAT_EVENT_TYPES = new Set(['CombatEngagement', 'ShipDestroyed', 'CombatResult']);
    for (const evt of shipEvents) {
        evt.turn = next.turn;
        evt.date = next.date.toISOString().split('T')[0];

        // Route to the empire that owns the relevant fleet/ship
        const targetEmpireId = evt.empireId || next.playerEmpireId;
        if (next.empires[targetEmpireId]) {
            next.empires[targetEmpireId].events = [
                evt,
                ...next.empires[targetEmpireId].events.slice(0, 99)
            ];
        }

        // Mirror combat events to the player empire (they need to know they're being attacked!)
        if (COMBAT_EVENT_TYPES.has(evt.type) && targetEmpireId !== next.playerEmpireId) {
            if (next.empires[next.playerEmpireId]) {
                next.empires[next.playerEmpireId].events = [
                    evt,
                    ...next.empires[next.playerEmpireId].events.slice(0, 99)
                ];
            }
        }
    }

    // 7. Phase: Integrity

    return next;
}
