import { Scenario, ScenarioResult } from './types';
import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { GameState, Company } from '../types';

export const SectorHealthAudit: Scenario = {
    name: 'Sector Health Audit',
    description: 'Audits the profitability and growth of all 5 corporate sectors over a 20-year period.',
    setup: (seed: number) => {
        // Setup a balanced game with multiple colonies and starting corporations
        const state: GameState = setupNewGame("Corporate Dawn", seed, true);
        state.tickLength = 86400; // 1 day ticks

        const empire = Object.values(state.empires)[0];
        const earth = Object.values(state.colonies).find(c => c.name === 'Earth')!;

        // Ensure we have a mix of all corporation types
        const types: any[] = ['Transport', 'Extraction', 'Manufacturing', 'Agricultural', 'Commercial'];

        // Clear existing companies to have a controlled start
        empire.companies = [];

        types.forEach((type, i) => {
            const corpId = `corp_${type.toLowerCase()}`;
            empire.companies.push({
                id: corpId,
                name: `${type} Pioneers`,
                type: type,
                homeColonyId: earth.id,
                wealth: 10000,
                valuation: 10000,
                activeFreighters: type === 'Transport' ? 2 : 0,
                strategy: 'Expansionist',
                designBias: 'Efficiency',
                explorationLicenseIds: type === 'Extraction' ? ['star_0'] : [],
                history: [],
                transactions: []
            });
        });

        // Add some basic infrastructure to Earth to support growth
        earth.factories = 10;
        earth.mines = 10;
        earth.farms = 5;
        earth.stores = 5;
        earth.civilianFactories = 2;
        earth.spaceport = 1;

        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const results: Record<string, any> = {};
        const startTime = Date.now();

        for (let i = 0; i < ticks; i++) {
            state = advanceTick(state);

            // Log every year (365 days)
            if (i % 365 === 0) {
                const year = i / 365;
                // Periodic reporting could be added here if needed
            }
        }

        const empire = Object.values(state.empires)[0];
        const sectors = ['Transport', 'Extraction', 'Manufacturing', 'Agricultural', 'Commercial'];

        const sectorHealth: Record<string, any> = {};
        sectors.forEach(type => {
            const comps = empire.companies.filter(c => c.type === type);
            const totalWealth = comps.reduce((sum, c) => sum + c.wealth, 0);
            const avgWealth = comps.length > 0 ? totalWealth / comps.length : 0;
            const totalValuation = comps.reduce((sum, c) => sum + c.valuation, 0);

            sectorHealth[type] = {
                count: comps.length,
                totalWealth: Math.round(totalWealth),
                avgWealth: Math.round(avgWealth),
                totalValuation: Math.round(totalValuation)
            };
        });

        const success = sectors.every(s => sectorHealth[s].totalWealth > 0);

        return {
            success,
            message: success ? 'All sectors remained solvent.' : 'One or more sectors collapsed.',
            metrics: {
                totalPop: Object.values(state.colonies).reduce((sum, c) => sum + c.population, 0),
                elapsedSimTime: ticks * 86400,
                realTime: Date.now() - startTime
            }
        };
    }
};
