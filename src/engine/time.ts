import type {
    GameState, Empire, Colony, Ship, Fleet, GameEvent, EventType,
    TickLength, SpeciesId, Company, CompanyType, EmpireSnapshot, ColonySnapshot
} from '../types';
import { RNG } from '../utils/rng';
import { tickEmpire } from './empire_logic';
import { tickAetherHarvesting } from './colonies';
import { tickFleets, getPlanetPosition } from './fleets';
import { AuditService } from './debug/AuditService';

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

    // 6. Phase: Event Distribution
    // Distribute ship events to the correct empire logs.
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
    }

    // 7. Phase: Integrity & Audit
    AuditService.checkConservationOfMass(next);

    return next;
}
