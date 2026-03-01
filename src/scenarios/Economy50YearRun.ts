import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import type { GameState } from '../types';

async function runScenario() {
    console.log("--- Scenario: 50 Year Economic Evaluation ---");

    let state: GameState = setupNewGame("Terra Admin", 42069, true);
    state.tickLength = 86400 * 30 as any; // 30 day ticks to make 50 years go fast

    // Add extra infrastructure and funds to speed up economic action
    const earth = Object.values(state.colonies).find(c => c.name === 'Earth');
    if (earth) {
        earth.privateWealth = 50000;
        earth.minerals.ConsumerGoods = 10000;
        earth.minerals.Food = 100000;
        earth.farms = 500; // Earth is an agri-world
    }
    state.empires[state.playerEmpireId].treasury = 100000;

    // Establish Mars
    const solarSystem = state.galaxy.stars['star_0'];
    const marsPlanet = solarSystem.planets[3];
    if (marsPlanet) {
        const marsId = `colony_Mars`;
        state.colonies[marsId] = {
            id: marsId,
            empireId: state.playerEmpireId,
            planetId: marsPlanet.id,
            name: 'Mars',
            population: 1000,
            populationSegments: [{ speciesId: 'human', count: 1000, happiness: 50, habitability: 0.1 }],
            maxPopulation: 2000,
            populationGrowthRate: 0.01,
            policy: 'Normal',
            happiness: 50,
            minerals: { Iron: 5000, Copper: 5000, Food: 0, ConsumerGoods: 0 },
            demand: {},
            infrastructure: 100,
            colonyType: 'Core',
            laborAllocation: { industry: 50, mining: 40, research: 0, construction: 10, agriculture: 0, commerce: 0 },
            productionQueue: [],
            factories: 50, mines: 50, civilianFactories: 0, civilianMines: 0, researchLabs: 0, spaceport: 1, shipyards: [], groundDefenses: 0, constructionOffices: 5, farms: 0, commercialCenters: 0, terraformProgress: 0, aethericDistillery: 0, logisticsHubs: 0,
            aethericSiphons: 0, deepCoreExtractors: 0, reclamationPlants: 0,
            migrationMode: 'Stable',
            privateWealth: 10000,
            history: []
        };
        if (!marsPlanet.colonies) marsPlanet.colonies = [];
        marsPlanet.colonies.push(state.colonies[marsId]);
    }

    // Run for 50 years (600 months)
    for (let i = 1; i <= 600; i++) {
        state = advanceTick({ ...state });

        if (i % 120 === 0) { // Every 10 years
            console.log(`\n=== Year ${i / 12} ===`);
            const empire = state.empires[state.playerEmpireId];
            console.log(`Empire Treasury: ${empire.treasury.toFixed(0)} W`);

            Object.values(state.colonies).forEach(c => {
                console.log(`Colony: ${c.name}`);
                console.log(`  Pop: ${c.population.toFixed(0)}M`);
                console.log(`  Private Wealth: ${(c.privateWealth || 0).toFixed(0)} W`);
                console.log(`  Education: ${(c.educationIndex || 0).toFixed(1)} / 100`);
                console.log(`  Avg Wage: ${((c.privateWealthIncome || 0) / Math.max(0.1, c.population)).toFixed(2)} W/day`);
                console.log(`  CG Price: ${(c.resourcePrices?.ConsumerGoods || 0).toFixed(2)} W`);
                console.log(`  Food Price: ${(c.resourcePrices?.Food || 0).toFixed(2)} W`);
                const employed = c.staffingLevel || 1.0;
                console.log(`  Staffing Level: ${(employed * 100).toFixed(1)}%`);
                console.log(`  Stockpiles: CG=${c.minerals.ConsumerGoods?.toFixed(0) || 0}, Food=${c.minerals.Food?.toFixed(0) || 0}, Electronics=${c.minerals.Electronics?.toFixed(0) || 0}`);
                console.log(`  Buildings: CivFactories=${c.civilianFactories || 0}, CivElectronics=${c.civilianElectronicsPlants || 0}, CivMachinery=${c.civilianMachineryPlants || 0}`);
            });
            console.log(`Companies: ${empire.companies.length}`);
            empire.companies.slice(0, 3).forEach(comp => {
                console.log(`  ${comp.name} | Valuation: ${(comp.valuation || 0).toFixed(0)} | Cash: ${(comp.wealth || 0).toFixed(0)}`);
            });
            if (empire.companies.length > 3) {
                console.log(`  ... and ${empire.companies.length - 3} more`);
            }
        }
    }

    console.log("\n[SUCCESS] 50 Year Simulation Complete.");
    process.exit(0);
}

runScenario().catch(console.error);
