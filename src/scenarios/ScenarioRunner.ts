import { Scenario, ScenarioResult } from './types';
import SimLogger from '@/utils/logger';

export class ScenarioRunner {
    static async run(scenario: Scenario, ticks: number, seed: number = 12345): Promise<ScenarioResult> {
        SimLogger.info('SYSTEM', `Starting Scenario: ${scenario.name}`);
        const state = scenario.setup(seed);

        try {
            const result = await scenario.run(state, ticks);
            if (result.success) {
                SimLogger.info('SYSTEM', `Scenario ${scenario.name} PASSED`);
            } else {
                SimLogger.error('SYSTEM', `Scenario ${scenario.name} FAILED: ${result.message}`);
            }
            return result;
        } catch (error: any) {
            SimLogger.error('SYSTEM', `Scenario ${scenario.name} CRASHED: ${error.message}`);
            return {
                success: false,
                message: `Scenario crash: ${error.message}`,
                metrics: {}
            };
        }
    }
}
