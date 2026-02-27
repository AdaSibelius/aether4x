import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { GameState, Colony } from '../types';
import { getLogisticHealthSnapshot, getGlobalMineralInventory } from '../engine/debug';

async function runScenario() {
    console.log("--- Scenario: Frontier Expansion & Physical Trade (Rigor Edition) ---");

    // Initial setup
    let state: GameState = setupNewGame("Mechanical Spring", 12345, true);
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
            factories: 0, mines: 0, civilianFactories: 0, civilianMines: 0, researchLabs: 0, spaceport: 0, shipyards: [], groundDefenses: 0, constructionOffices: 0, farms: 0, commercialCenters: 0, terraformProgress: 0, aethericDistillery: 0, logisticsHubs: 0,
            migrationMode: 'Target',
            privateWealth: 0,
            history: []
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
    console.log(`[INIT] Established ${targets.length} outposts.`);

    // --- BASELINE FOR INVARIANT CHECK ---
    const startInventory = getGlobalMineralInventory(state);

    const years = 10;
    const ticks = years * 365;

    for (let i = 0; i < ticks; i++) {
        state = advanceTick(state);
    }

    console.log("\n--- Scenario Results (Year 10) ---");
    const snapshot = getLogisticHealthSnapshot(state);
    console.log(JSON.stringify(snapshot, null, 2));

    // --- RIGOROUS AUDIT: CONSERVATION OF MASS ---
    console.log("\n--- Rigorous Audit: Conservation of Mass ---");
    const endInventory = getGlobalMineralInventory(state);
    let driftFound = false;

    Object.keys(startInventory).forEach(res => {
        const start = startInventory[res] || 0;
        const end = endInventory[res] || 0;
        const prod = state.stats.totalProduced[res] || 0;
        const cons = state.stats.totalConsumed[res] || 0;

        const expected = start + prod - cons;
        const drift = end - expected;
        const driftPct = expected > 0 ? (drift / expected) * 100 : 0;

        console.log(`${res.padEnd(10)}: Start: ${start.toFixed(0).padStart(8)} | Prod: ${prod.toFixed(0).padStart(8)} | Cons: ${cons.toFixed(0).padStart(8)} | End: ${end.toFixed(0).padStart(8)} | Drift: ${drift.toFixed(2).padStart(8)} (${driftPct.toFixed(4)}%)`);

        // Zero drift tolerance (allow for floating point epsilon)
        if (Math.abs(drift) > 0.01) {
            console.error(`[AUDIT FAIL] ${res} mass drift detected!`);
            driftFound = true;
        }
    });

    // Success criteria
    const mars = Object.values(state.colonies).find(c => c.name === 'Mars Outpost');
    const tradeSuccess = (mars?.minerals['Iron'] || 0) > 5000;

    if (tradeSuccess && !driftFound) {
        console.log("\n[SUCCESS] Physical trade loop confirmed and No Mass Drift detected.");
        process.exit(0);
    } else {
        if (!tradeSuccess) console.error("\n[FAILURE] Physical trade loop stalls. Mars mineral stock too low.");
        if (driftFound) console.error("\n[FAILURE] Mass drift detected in engine.");
        process.exit(1);
    }
}

runScenario().catch(err => {
    console.error(err);
    process.exit(1);
});
