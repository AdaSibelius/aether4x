import { Scenario, ScenarioResult } from './types';
import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { GameState, Colony } from '../types';
import { getGlobalMineralInventory } from './utils';

export const LogisticsValidation: Scenario = {
    name: 'Logistics Validation',
    description: 'Verifies physical trade loop and Conservation of Mass invariant across 10 years.',
    setup: (seed: number) => {
        const state: GameState = setupNewGame("Mechanical Spring", seed, true);
        state.tickLength = 86400; // 1 day ticks

        const earth = Object.values(state.colonies).find(c => c.name === 'Earth');
        if (earth) {
            earth.migrationMode = 'Source';
            earth.infrastructure = 500;
        }

        const establishColony = (state: GameState, planetId: string, name: string): string => {
            const id = `colony_${name.replace(/\s/g, '_')}`;
            const newColony: Colony = {
                id,
                empireId: state.playerEmpireId,
                planetId,
                name,
                population: 0,
                populationSegments: [{ speciesId: 'human', count: 0, happiness: 50, habitability: 1.0 }],
                maxPopulation: 10,
                populationGrowthRate: 0.02,
                policy: 'Normal',
                happiness: 50,
                minerals: { Iron: 1000, Copper: 500, Food: 2000 },
                demand: {},
                infrastructure: 10,
                colonyType: 'Core',
                laborAllocation: { industry: 40, mining: 20, research: 10, construction: 10, agriculture: 10, commerce: 10 },
                productionQueue: [{ id: 'init_port', type: 'Spaceport', name: 'Planetary Spaceport', quantity: 1, progress: 0, costPerUnit: { Iron: 500, Copper: 200 }, bpCostPerUnit: 3000 }],
                factories: 0, mines: 0, researchLabs: 0, spaceport: 0, shipyards: [], groundDefenses: 0, constructionOffices: 0, terraformProgress: 0, aethericDistillery: 0,
                civilianFactories: 0, civilianMines: 0, farms: 0, stores: 0,
                migrationMode: 'Target',
                privateWealth: 0,
                history: [],
                governorId: undefined,
            };
            state.colonies[id] = newColony;
            return id;
        };

        const solarSystem = state.galaxy.stars['star_0'];
        const planets = solarSystem.planets.filter(p => !p.colonies || p.colonies.length === 0);
        const targets = [
            { id: planets[0]?.id, name: 'Mercury Outpost' },
            { id: planets[3]?.id, name: 'Mars Outpost' },
        ].filter(t => t.id);

        targets.forEach(t => establishColony(state, t.id, t.name));
        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const startInventory = getGlobalMineralInventory(state);

        for (let i = 0; i < ticks; i++) {
            state = advanceTick(state);
        }

        const endInventory = getGlobalMineralInventory(state);
        let driftFound = false;
        const allDrifts: import('./types').DriftDetail[] = [];

        Object.keys(startInventory).forEach(res => {
            const start = startInventory[res] || 0;
            const end = endInventory[res] || 0;
            const prod = state.stats.totalProduced[res] || 0;
            const cons = state.stats.totalConsumed[res] || 0;

            const expected = start + prod - cons;
            const drift = end - expected;

            if (Math.abs(drift) > 0.01) {
                driftFound = true;
                allDrifts.push({
                    path: res,
                    expected,
                    actual: end,
                    message: `Drift of ${drift} detected in ${res}`
                });
            }
        });

        const driftReport: import('./types').DriftReport = {
            hasDrift: driftFound,
            totalDifferences: allDrifts.length,
            allDrifts,
            firstDifference: allDrifts[0]
        };

        const mars = Object.values(state.colonies).find(c => c.name === 'Mars Outpost');
        const tradeSuccess = (mars?.minerals['Iron'] || 0) > 5000;

        return {
            success: !driftFound && tradeSuccess,
            message: driftFound ? 'Mass drift detected' : (tradeSuccess ? 'Scenario successful' : 'Trade loop failed'),
            metrics: {
                totalWealth: Object.values(state.empires).reduce((sum, e) => sum + e.treasury, 0),
                population: Object.values(state.colonies).reduce((sum, c) => sum + c.population, 0),
                tradeSuccess
            },
            driftReport
        };
    }
};
