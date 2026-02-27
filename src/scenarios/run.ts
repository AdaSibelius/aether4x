import { ScenarioRunner } from './ScenarioRunner';
import { SCENARIO_REGISTRY } from './registry';

const scenarioName = process.argv[2] || 'LogisticsValidation';
const ticks = parseInt(process.argv[3]) || 365 * 10;
const seed = parseInt(process.argv[4]) || 12345;

const scenario = SCENARIO_REGISTRY[scenarioName];

if (!scenario) {
    console.error(`Scenario "${scenarioName}" not found in registry.`);
    process.exit(1);
}

ScenarioRunner.run(scenario, ticks, seed).then(result => {
    if (result.success) {
        console.log(`\nMetric Summary:`);
        console.log(JSON.stringify(result.metrics, null, 2));
        process.exit(0);
    } else {
        process.exit(1);
    }
}).catch(err => {
    console.error(err);
    process.exit(1);
});
