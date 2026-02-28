import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import * as fs from 'fs';

function verify() {
    const seed = 12345;
    const name = "TestEmpire";

    console.log(`Running Determinism Test with seed: ${seed}`);

    // Run 1
    const state1_start = setupNewGame(name, seed);
    let state1 = state1_start;
    for (let i = 0; i < 5; i++) {
        state1 = advanceTick(state1);
    }
    const json1 = JSON.stringify(state1, null, 2);

    // Run 2
    const state2_start = setupNewGame(name, seed);
    let state2 = state2_start;
    for (let i = 0; i < 5; i++) {
        state2 = advanceTick(state2);
    }
    const json2 = JSON.stringify(state2, null, 2);

    if (json1 === json2) {
        console.log("SUCCESS: Simulation is deterministic!");
    } else {
        console.error("FAILURE: Simulation drift detected!");
        fs.writeFileSync('drift_1.json', json1);
        fs.writeFileSync('drift_2.json', json2);

        // Find first difference
        const lines1 = json1.split('\n');
        const lines2 = json2.split('\n');
        for (let i = 0; i < lines1.length; i++) {
            if (lines1[i] !== lines2[i]) {
                console.log(`First difference at line ${i + 1}:`);
                console.log(`Run 1: ${lines1[i]}`);
                console.log(`Run 2: ${lines2[i]}`);
                break;
            }
        }
    }
}

verify();
