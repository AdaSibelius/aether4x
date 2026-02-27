import type {
    GameState, Empire, Colony, Ship, Fleet, GameEvent, EventType,
    TickLength, SpeciesId, Company, CompanyType, EmpireSnapshot, ColonySnapshot
} from '@/types';
import { RNG } from '@/utils/rng';
import { tickEmpire } from './empire_logic';
import { tickAetherHarvesting } from './colonies';
import { tickFleets, getPlanetPosition } from './fleets';
import { AuditService } from './debug/AuditService';

import SimLogger from '@/utils/logger';

export function advanceTick(state: GameState): GameState {
    SimLogger.info('SYSTEM', `Advancing tick: ${state.tickLength}s`);
    const next = { ...state, empires: { ...state.empires }, ships: { ...state.ships }, colonies: { ...state.colonies } };
    const dt = state.tickLength;
    next.turn += dt;
    next.date = new Date(new Date(next.date).getTime() + dt * 1000);

    const rng = new RNG((next.initialSeed || next.seed) + next.turn);

    // Aether Harvesting
    tickAetherHarvesting(next, dt);

    // ── Granular History Recording (Every 30 days) ──
    const SNAPSHOT_INTERVAL = 86400 * 30;
    const isSnapshotTick = Math.floor(next.turn / SNAPSHOT_INTERVAL) > Math.floor(state.turn / SNAPSHOT_INTERVAL);

    for (const empire of Object.values(next.empires)) {
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
    }

    // Ship/fleet movement
    const shipEvents = tickFleets(next, dt, rng);

    // Distribute ship events to the correct empire (tickFleets just returns flat events right now,
    // we can stamp them and push to the empire that owns the fleet)
    for (const evt of shipEvents) {
        evt.turn = next.turn;
        evt.date = next.date.toISOString().split('T')[0];

        // Find which empire this event belongs to (for SystemExplored, it mentions the fleet)
        // For simplicity, we can just push it to all, or broadcast. We'll just push to player for now
        // if we can't figure it out, but realistically we need to pass empireId in the event.
        if (next.empires[next.playerEmpireId]) {
            next.empires[next.playerEmpireId].events.push(evt);
        }
    }

    // Aether Harvesting
    tickAetherHarvesting(next, dt);

    // Audit resource consistency
    AuditService.checkConservationOfMass(next);

    return next;
}
