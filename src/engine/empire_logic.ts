'use client';
import type { GameState, Empire, GameEvent } from '@/types';
import { tickResearch } from './research';
import { tickColony } from './colonies';
import { tickCivilianEconomy, tickCivilianMigration } from './economy';
import { generateColonyResourceDemand } from './signals';
import { tickCorporations, tickOfficerLifecycle } from './corporations';
import { tickEmpireFinances, recordEmpireHistory } from './finances';
import { RNG } from '@/utils/rng';

/**
 * Orchestrates the full economic and organizational tick for a single empire.
 * @intent Centralized empire-level turn logic to keep time.ts clean.
 */
export function tickEmpire(state: GameState, empire: Empire, rng: RNG, dt: number, isSnapshotTick: boolean): GameEvent[] {
    const events: GameEvent[] = [];

    // 1. History & Financial Records
    recordEmpireHistory(state, empire, isSnapshotTick);

    // 2. Research & Development
    events.push(...tickResearch(empire, dt, rng));

    // 3. Planetary Operations (Colonies)
    const empireColonies = Object.values(state.colonies).filter(c => c.empireId === empire.id);
    for (const colony of empireColonies) {
        events.push(...tickColony(colony, state, dt, rng));
    }

    // 4. Civilian Economy & Population Migration
    // @intent generateColonyResourceDemand must run before economy tick to set physical signals.
    generateColonyResourceDemand(state, empire);
    events.push(...tickCivilianEconomy(state, empire, dt, rng));
    tickCivilianMigration(state, empire, rng);

    // 5. Corporate Sector & Leadership
    events.push(...tickCorporations(state, empire, rng, dt));
    events.push(...tickOfficerLifecycle(state, empire, rng, dt));

    // 6. State Treasury & Maintenance
    tickEmpireFinances(state, empire, dt);

    return events;
}
