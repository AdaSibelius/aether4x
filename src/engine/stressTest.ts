import { GameState } from '@/types';
import { advanceTick } from './time';

export interface StressTestReport {
    turnsRun: number;
    initialTreasury: number;
    finalTreasury: number;
    initialPopulation: number;
    finalPopulation: number;
    issues: string[];
    isHealthy: boolean;
}

export function runStressTest(initialState: GameState, turns: number): StressTestReport {
    let state = structuredClone(initialState);
    const initialTreasury = Object.values(state.empires).reduce((acc, e) => acc + e.treasury, 0);
    const initialPop = Object.values(state.colonies).reduce((acc, c) => acc + c.population, 0);
    const issues: string[] = [];

    // Force daily ticks for consistency during test
    state.tickLength = 86400;

    for (let i = 0; i < turns; i++) {
        try {
            state = advanceTick(state);

            // Check for negative treasury
            for (const empire of Object.values(state.empires)) {
                if (empire.treasury < 0) {
                    issues.push(`Turn ${i}: Empire ${empire.name} bankrupt (${Math.floor(empire.treasury)}W)`);
                }
                if (isNaN(empire.treasury)) {
                    issues.push(`Turn ${i}: Empire ${empire.name} treasury is NaN`);
                    return createReport(i, initialTreasury, initialPop, state, issues);
                }
            }

            // Check for population collapse
            const currentPop = Object.values(state.colonies).reduce((acc, c) => acc + c.population, 0);
            if (currentPop < initialPop * 0.5) {
                issues.push(`Turn ${i}: Global population collapse (>50% lost)`);
            }

        } catch (err: any) {
            issues.push(`Turn ${i}: Simulation crashed: ${err.message}`);
            return createReport(i, initialTreasury, initialPop, state, issues);
        }
    }

    return createReport(turns, initialTreasury, initialPop, state, issues);
}

function createReport(turns: number, initTreasury: number, initPop: number, state: GameState, issues: string[]): StressTestReport {
    const finalTreasury = Object.values(state.empires).reduce((acc, e) => acc + e.treasury, 0);
    const finalPop = Object.values(state.colonies).reduce((acc, c) => acc + c.population, 0);

    return {
        turnsRun: turns,
        initialTreasury: initTreasury,
        finalTreasury,
        initialPopulation: initPop,
        finalPopulation: finalPop,
        issues: Array.from(new Set(issues)).slice(0, 10), // Unique last 10 issues
        isHealthy: issues.length === 0
    };
}
