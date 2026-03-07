import fs from 'node:fs';
import { advanceTick } from '@/engine/time';
import { SCENARIO_REGISTRY } from '@/scenarios/registry';
import type { GameState } from '@/types';

const scenarioName = process.argv[2] || 'LogisticsValidation';
const ticks = Number.parseInt(process.argv[3] || '3650', 10);
const seed = Number.parseInt(process.argv[4] || '12345', 10);

const scenario = SCENARIO_REGISTRY[scenarioName];
if (!scenario) {
    console.error(`Scenario "${scenarioName}" not found in registry.`);
    process.exit(1);
}

function canonicalize(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonicalize(v)]);
        return Object.fromEntries(entries);
    }
    return value;
}

function runTicks(initialState: GameState, totalTicks: number): GameState {
    let state = initialState;
    for (let i = 0; i < totalTicks; i++) {
        state = advanceTick(state);
    }
    return state;
}

// Build both initial states before ticking so module-level mutation during the
// first run cannot contaminate the second setup.
const initialA = structuredClone(scenario.setup(seed));
const initialB = structuredClone(scenario.setup(seed));
const stateA = runTicks(initialA, ticks);
const stateB = runTicks(initialB, ticks);

const snapshotA = JSON.stringify(canonicalize(stateA), null, 2);
const snapshotB = JSON.stringify(canonicalize(stateB), null, 2);

if (snapshotA === snapshotB) {
    console.log('SUCCESS: Simulation is deterministic!');
    process.exit(0);
}

fs.writeFileSync('drift_1.json', snapshotA);
fs.writeFileSync('drift_2.json', snapshotB);
console.error('FAILURE: Simulation drift detected!');
console.error('Wrote drift artifacts: drift_1.json and drift_2.json');
process.exit(1);
