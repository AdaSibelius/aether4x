import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import * as fs from 'fs';
import type { GameEvent } from '../types';

function verify() {
    const seed = 12345;
    const name = "TestEmpire";
    const TICKS = 50;

    console.log(`Running Determinism Test with seed: ${seed} for ${TICKS} ticks...`);

    // Run 1
    const state1_start = setupNewGame(name, seed);
    let state1 = state1_start;
    const allEvents1: GameEvent[] = [];
    for (let i = 0; i < TICKS; i++) {
        console.log(`Run 1 - Tick ${i + 1}`);
        state1 = advanceTick(state1);
        // For simplicity, we'll collect events from all empires
        for (const emp of Object.values(state1.empires)) {
            allEvents1.push(...emp.events);
        }
    }
    const json1 = JSON.stringify(state1, null, 2);
    const events1 = JSON.stringify(allEvents1, null, 2);

    // Run 2
    const state2_start = setupNewGame(name, seed);
    let state2 = state2_start;
    const allEvents2: GameEvent[] = [];
    for (let i = 0; i < TICKS; i++) {
        state2 = advanceTick(state2);
        for (const emp of Object.values(state2.empires)) {
            allEvents2.push(...emp.events);
        }
    }
    const json2 = JSON.stringify(state2, null, 2);
    const events2 = JSON.stringify(allEvents2, null, 2);

    let failed = false;

    if (json1 !== json2) {
        console.error("FAILURE: State drift detected!");
        fs.writeFileSync('drift_state_1.json', json1);
        fs.writeFileSync('drift_state_2.json', json2);
        failed = true;
    }

    if (events1 !== events2) {
        console.error("FAILURE: Event order drift detected!");
        fs.writeFileSync('drift_events_1.json', events1);
        fs.writeFileSync('drift_events_2.json', events2);
        failed = true;
    }

    if (!failed) {
        console.log(`SUCCESS: Simulation is bit-identical for ${TICKS} ticks!`);
        console.log(`Total events verified: ${allEvents1.length}`);
    } else {
        process.exit(1);
    }
}

verify();
