import { setupNewGame } from './engine/setup';
import { advanceTick } from './engine/time';
import { GameState, Colony } from './types';
import SimLogger from './utils/logger';

async function runSimulation() {
    console.log("--- Starting Expansion & Population Growth Simulation ---");

    // Initial setup
    let state: GameState = setupNewGame("Mechanical Spring", 12345, true); // RealSpace = true for Earth context
    state.tickLength = 86400; // 1 day ticks

    // Set Earth to Migration Source and increase infrastructure to support starting pop
    // Sol is always index 0, so star_0
    const earth = Object.values(state.colonies).find(c => c.name === 'Earth');
    if (earth) {
        earth.migrationMode = 'Source';
        earth.infrastructure = 500; // 500% infra to support ~12500M pop capacity
        console.log(`Earth prepared: mode=${earth.migrationMode}, maxPop=${earth.maxPopulation.toFixed(1)}M`);
    }

    // Function to establish a colony via state action
    const establishColony = (state: GameState, planetId: string, name: string): string => {
        const id = `colony_${name.replace(/\s/g, '_')}`;
        const newColony: Colony = {
            id,
            empireId: state.playerEmpireId,
            planetId,
            name,
            population: 0,
            populationSegments: [{
                speciesId: 'human',
                count: 0,
                happiness: 50,
                habitability: 1.0,
            }],
            maxPopulation: 10,
            populationGrowthRate: 0.02,
            policy: 'Normal',
            happiness: 50,
            minerals: { Iron: 1000, Copper: 500, Food: 2000 },
            demand: {},
            infrastructure: 10,
            colonyType: 'Core',
            laborAllocation: { industry: 40, mining: 20, research: 10, construction: 10, agriculture: 10, commerce: 10 },
            productionQueue: [{
                id: 'init_port',
                type: 'Spaceport',
                name: 'Planetary Spaceport',
                quantity: 1,
                progress: 0,
                costPerUnit: { Iron: 500, Copper: 200 },
                bpCostPerUnit: 3000
            }],
            factories: 0,
            mines: 0,
            civilianFactories: 0,
            civilianMines: 0,
            researchLabs: 0,
            spaceport: 0,
            shipyards: [],
            groundDefenses: 0,
            constructionOffices: 0,
            farms: 0,
            stores: 0,
            terraformProgress: 0,
            aethericDistillery: 0,
            migrationMode: 'Target', // Set to Target for growth
            privateWealth: 0,
            history: []
        };
        state.colonies[id] = newColony;
        return id;
    };

    // Find some planets to colonize
    const solarSystem = state.galaxy.stars['star_0'];
    if (!solarSystem) {
        console.error("Solar system (star_0) not found!");
        return;
    }
    const planets = solarSystem.planets.filter(p => !p.colonies || p.colonies.length === 0);

    const targets = [
        { id: planets[0]?.id, name: 'Mercury Outpost' },
        { id: planets[1]?.id, name: 'Venus Outpost' },
        { id: planets[3]?.id, name: 'Mars Outpost' },
        { id: planets[4]?.id, name: 'Jupiter Outpost' },
    ].filter(t => t.id);

    targets.forEach(t => establishColony(state, t.id, t.name));
    console.log(`Established ${targets.length} Target outposts.`);

    const years = 20;
    const ticks = years * 365;

    for (let i = 0; i < ticks; i++) {
        state = advanceTick(state);

        if (i % 365 === 0) {
            const year = Math.floor(i / 365);
            const totalPop = Object.values(state.colonies).reduce((sum, c) => sum + c.population, 0);
            const fleets = state.empires[state.playerEmpireId].fleets;
            const ships = Object.values(state.ships);
            const corpWealth = state.empires[state.playerEmpireId].companies.reduce((sum, c) => sum + c.wealth, 0);
            const earthWaiting = earth?.migrantsWaiting || 0;
            const totalPassengers = ships.reduce((sum, s) => sum + (s.cargo?.['Civilians'] || 0), 0);
            const colShipCount = ships.filter(s => {
                const design = state.empires[state.playerEmpireId].designLibrary.find(d => d.id === s.designId);
                return design?.components.some(c => c.type === 'ColonizationModule');
            }).length;

            const mars = Object.values(state.colonies).find(c => c.name === 'Mars Outpost');
            const marsIron = mars?.minerals['Iron'] || 0;
            const marsDemand = Object.entries(mars?.demand || {}).map(([r, a]) => `${r}:${a.toFixed(0)}`).join(', ');

            console.log(`[Year ${year}] Pop: ${totalPop.toFixed(1)}M | Wait: ${earthWaiting.toFixed(1)}M | ColShips: ${colShipCount} | Wealth: ${Math.floor(corpWealth)}`);
            console.log(` - Mars: Stock=${marsIron.toFixed(0)}t Iron | Demand=[${marsDemand}] | Spaceport=${mars?.spaceport}`);

            if (year > 0 && year % 5 === 0) {
                // Peek at corporate activity
                state.empires[state.playerEmpireId].companies.forEach(c => {
                    const rev = c.transactions?.filter(t => t.type === 'Revenue').reduce((s, t) => s + t.amount, 0) || 0;
                    const sites = Object.values(state.colonies).filter(col => col.civilianMines > 0 || col.civilianFactories > 0 || col.farms > 0).length;
                    console.log(` - Corp ${c.name} (${c.type}): Wealth=${Math.floor(c.wealth)} | Total Revenue=${Math.floor(rev)} | Expansion Sites=${sites}`);
                });
            }
        }
    }

    console.log("\n--- Simulation Complete ---");
    console.log(`Final Colonies: ${Object.keys(state.colonies).length}`);
    const finalEarth = Object.values(state.colonies).find(c => c.name === 'Earth');
    console.log(`Earth: Pop=${finalEarth?.population.toFixed(2)}M | Waiting=${finalEarth?.migrantsWaiting?.toFixed(2)}M`);

    Object.values(state.colonies).filter(c => c.name.includes('Outpost')).forEach(c => {
        const queueStatus = c.productionQueue[0] ? `${c.productionQueue[0].name} (${c.productionQueue[0].progress.toFixed(1)}%)` : 'Idle';
        const corpBuildings = (c.civilianMines || 0) + (c.civilianFactories || 0) + (c.farms || 0) + (c.stores || 0);
        console.log(`- ${c.name}: Pop=${c.population.toFixed(2)}M | Spaceport=${c.spaceport} | CorpBuildings=${corpBuildings}`);
        console.log(`  Minerals: Iron=${c.minerals['Iron']?.toFixed(0)}, Copper=${c.minerals['Copper']?.toFixed(0)}`);
        console.log(`  Queue: ${queueStatus}`);
    });
}

runSimulation().catch(err => console.error(err));
