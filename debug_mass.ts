import { LogisticsValidation } from './src/scenarios/LogisticsValidation';
import { ScenarioRunner } from './src/scenarios/ScenarioRunner';

async function debug() {
    const ticks = 365; // 1 year is enough to see drift
    const seed = 12345;

    console.log(`Running Mass Drift Diagnostic for ${ticks} ticks...`);
    const result = await ScenarioRunner.run(LogisticsValidation, ticks, seed);

    if (result.driftReport && result.driftReport.hasDrift) {
        console.log("MASS DRIFT DETECTED:");
        console.log(JSON.stringify(result.driftReport.allDrifts, null, 2));
    } else {
        console.log("No mass drift detected in this run.");
    }
}

debug();
