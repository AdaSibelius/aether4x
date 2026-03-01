/**
 * simulate-economy.ts
 *
 * Runs a 365-day simulation to observe macro-economic trends
 * following the "Economy Hardening" update.
 *
 * Verifies:
 * - Treasury stability (tax inflow vs maintenance outflow)
 * - Private wealth circulation (founding, expansion,Pool-based revenue)
 * - Corporate growth and dividends
 */

import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import type { GameState } from '../types/index';

function formatMoney(val: number): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function runSim() {
    console.log('================================================================');
    console.log('   Aether 4X — Economy Performance Simulation (365 Days)        ');
    console.log('================================================================\n');

    let state: GameState = setupNewGame('Simulation Empire', 42, true);
    state.tickLength = 86400; // 1 day ticks

    console.log(`[START] Date: ${state.date.toISOString().split('T')[0]}`);
    console.log(`        Treasury: ${formatMoney(state.empires[state.playerEmpireId].treasury)}`);
    console.log(`        Colonies: ${Object.values(state.colonies).length}`);
    console.log('----------------------------------------------------------------\n');

    const reportInterval = 30; // 30 days
    const totalDays = 365;

    console.log(`${'Day'.padEnd(5)} | ${'Date'.padEnd(12)} | ${'Treasury'.padStart(12)} | ${'Colony PW'.padStart(12)} | ${'Corp Wealth'.padStart(12)} | ${'Corps'.padStart(6)}`);
    console.log('-'.repeat(74));

    for (let day = 1; day <= totalDays; day++) {
        // Trigger expansion on day 10
        if (day === 10) {
            const empire = state.empires[state.playerEmpireId];
            const sol = state.galaxy.stars['star_0'];
            // Find Mars: Try by name, then by known RealSpace ID, then by fallback index
            const mars = sol.planets.find(p => p.name.includes('Mars')) ||
                sol.planets.find(p => p.id === 'planet_Sol_3') ||
                sol.planets[Math.min(3, sol.planets.length - 1)];

            if (mars) {
                const marsColonyId = 'colony_mars_sim';
                state.colonies[marsColonyId] = {
                    id: marsColonyId,
                    empireId: empire.id,
                    planetId: mars.id,
                    name: 'Mars',
                    population: 50,
                    populationSegments: [{ speciesId: 'human', count: 50, happiness: 50, habitability: 0.4 }],
                    maxPopulation: 5000,
                    populationGrowthRate: 0.01,
                    colonyType: 'Core',
                    policy: 'Normal',
                    happiness: 50,
                    infrastructure: 10,
                    laborAllocation: {
                        industry: 20,
                        mining: 40,
                        research: 10,
                        construction: 10,
                        agriculture: 10,
                        commerce: 10
                    },
                    minerals: { Iron: 10000, Copper: 5000, Food: 10000 },
                    demand: { Food: 100 },
                    factories: 5,
                    mines: 10,
                    civilianFactories: 0,
                    civilianMines: 0,
                    researchLabs: 0,
                    spaceport: 1,
                    groundDefenses: 0,
                    shipyards: [],
                    productionQueue: [],
                    history: [],
                    privateWealth: 1000,
                    constructionOffices: 0,
                    farms: 0,
                    commercialCenters: 0,
                    terraformProgress: 0,
                    aethericDistillery: 0,
                    logisticsHubs: 0,
                    aethericSiphons: 0,
                    deepCoreExtractors: 0,
                    reclamationPlants: 0,
                    migrationMode: 'Stable'
                };
                console.log(`\n[EXPANSION] Day ${day}: Established colony on ${state.colonies[marsColonyId].name}`);

                // Give Blackwood Shipping some orders to move food to Mars
                const blackwood = empire.companies.find(c => c.name.toLowerCase().includes('blackwood'));
                if (blackwood) {
                    const fleet = empire.fleets.find(f => f.ownerCompanyId === blackwood.id);
                    const earthColony = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra');
                    if (fleet && earthColony) {
                        fleet.orders = [
                            { type: 'Transit', targetId: empire.id, targetStarId: 'star_0', targetPlanetId: earthColony.planetId } as any,
                            { type: 'Load', resources: { Food: 500 } } as any,
                            { type: 'Transit', targetId: empire.id, targetStarId: 'star_0', targetPlanetId: mars.id } as any,
                            { type: 'Unload', resources: { Food: 500 } } as any
                        ];
                        console.log(`[LOGISTICS] Day ${day}: Assigned transport orders to ${blackwood.name} fleet.`);
                    }
                }
            }
        }

        state = advanceTick(state);

        if (day % reportInterval === 0 || day === 1) {
            const empire = state.empires[state.playerEmpireId];
            const totalColonyPW = Object.values(state.colonies).reduce((s, c) => s + (c.privateWealth || 0), 0);
            const totalCorpWealth = empire.companies.reduce((s, c) => s + (c.wealth || 0), 0);

            console.log(
                `${day.toString().padEnd(5)} | ` +
                `${state.date.toISOString().split('T')[0].padEnd(12)} | ` +
                `${formatMoney(empire.treasury).padStart(12)} | ` +
                `${formatMoney(totalColonyPW).padStart(12)} | ` +
                `${formatMoney(totalCorpWealth).padStart(12)} | ` +
                `${empire.companies.length.toString().padStart(6)}`
            );
        }
    }

    console.log('\n----------------------------------------------------------------');
    console.log('   Final Economic Breakdown');
    console.log('----------------------------------------------------------------');

    const finalEmpire = state.empires[state.playerEmpireId];
    console.log(`   Empire Treasury:      ${formatMoney(finalEmpire.treasury)}`);

    const colonies = Object.values(state.colonies);
    const totalColonyPW = colonies.reduce((s, c) => s + (c.privateWealth || 0), 0);
    console.log(`   Total Colony Wealth:  ${formatMoney(totalColonyPW)}`);

    const corps = finalEmpire.companies;
    const totalCorpWealth = corps.reduce((s, c) => s + (c.wealth || 0), 0);
    console.log(`   Total Corp Wealth:    ${formatMoney(totalCorpWealth)}`);

    console.log('\n   Top 5 Corporations by Valuation:');
    const topCorps = [...corps].sort((a, b) => (b.valuation || 0) - (a.valuation || 0)).slice(0, 5);
    topCorps.forEach(c => {
        console.log(`    - ${c.name.padEnd(25)} (${c.type.padEnd(12)}) | Val: ${formatMoney(c.valuation).padStart(10)} | Wealth: ${formatMoney(c.wealth).padStart(10)}`);
    });

    console.log('\n   Notable Events:');
    const interestTypes = ['CompanyFounded', 'CivilianExpansion', 'OfficerSpawned'];
    const events = finalEmpire.events
        .filter(e => interestTypes.includes(e.type))
        .slice(-10); // last 10

    events.forEach(e => {
        console.log(`    [${e.date}] ${e.message}`);
    });

    console.log('\n   Ledger Statistics:');
    console.log(`    Total entries in memory:  ${state.monetaryLedger.length} (MAX 500)`);

    const taxTotal = state.monetaryLedger
        .filter(l => l.reasonCode === 'TAX_COLLECTION')
        .reduce((s, l) => s + l.amount, 0);
    console.log(`    Recent Total Tax Settled: ${formatMoney(taxTotal)}`);

    console.log('\n================================================================');
    console.log('   Simulation Complete');
    console.log('================================================================');
}

runSim();
