
import { setupNewGame } from './engine/setup';
import { advanceTick } from './engine/time';
import { GameState } from './types';

async function runSurvivalSimulation() {
    console.log("Starting Long-term Survival Verification Simulation (10 years)...");

    // 1. Setup Game (RealSpace Earth)
    let state = setupNewGame("Sol Empire", 12345, true);
    const empireId = state.playerEmpireId;
    const colonyId = Object.keys(state.colonies)[0];
    const earth = state.colonies[colonyId];
    const initialPop = earth.population;

    console.log(`Initial Earth State:`);
    console.log(`- Population: ${initialPop.toFixed(2)}M`);
    console.log(`- Food Stockpile: ${earth.minerals.Food?.toFixed(0) || 0}`);
    console.log(`- Fuel Stockpile: ${earth.minerals.Fuel?.toFixed(0) || 0}`);
    console.log(`- Farms: ${earth.farms}`);
    console.log(`- Distilleries: ${earth.aethericDistillery}`);

    // 2. Run for 50 years (18250 days)
    const ticks = 18250;

    let yearReported = 0;
    let starvationStarted = -1;
    let populationCollapse = -1;

    for (let i = 0; i < ticks; i++) {
        state = advanceTick(state);
        const currentEarth = state.colonies[colonyId];

        // Check for starvation
        if (currentEarth.minerals.Food <= 0 && starvationStarted === -1) {
            starvationStarted = i;
            console.log(`[Turn ${i}] Starvation imminent! Food stockpile depleted.`);
        }

        // Check for major population collapse (loss of 50%)
        if (currentEarth.population < earth.population * 0.5 && populationCollapse === -1) {
            populationCollapse = i;
            console.log(`[Turn ${i}] CRITICAL: Population collapsed below 50% of initial!`);
        }

        // Yearly report
        const year = Math.floor(i / 365);
        if (year > yearReported) {
            console.log(`--- Year ${year} Report ---`);
            console.log(`- Population: ${currentEarth.population.toFixed(2)}M`);
            console.log(`- Food: ${currentEarth.minerals.Food?.toFixed(0) || 0}`);
            console.log(`- Fuel: ${currentEarth.minerals.Fuel?.toFixed(0) || 0}`);
            yearReported = year;
        }

        // If population reaches zero, stop
        if (currentEarth.population <= 1) {
            console.log(`[Turn ${i}] Colony Extinct.`);
            break;
        }
    }

    const finalEarth = state.colonies[colonyId];
    console.log("\nSimulation Complete.");
    console.log(`Final Results (Year 10):`);
    console.log(`- Population: ${finalEarth.population.toFixed(2)}M (Change: ${(finalEarth.population - initialPop).toFixed(2)}M)`);
    console.log(`- Food: ${finalEarth.minerals.Food?.toFixed(0) || 0}`);
    console.log(`- Fuel: ${finalEarth.minerals.Fuel?.toFixed(0) || 0}`);

    if (starvationStarted !== -1) {
        console.log(`- Famine started on day ${starvationStarted}`);
    } else {
        console.log(`- No famine occurred during the 10-year period.`);
    }

    if (populationCollapse === -1 && finalEarth.population > 1) {
        console.log("SUCCESS: Earth is stable for at least 10 years.");
    } else {
        console.log("WARNING: Earth faced population collapse. Further balancing may be needed.");
    }
}

runSurvivalSimulation().catch(console.error);
