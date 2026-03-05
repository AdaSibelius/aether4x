import { setupNewGame } from '../engine/setup';
import { GameState } from '../types';
import {
    calculateFleetCombatPower,
    estimateBattleOutcome,
    getDetectedHostileFleets,
    isFleetDetectedByEnemy,
    getVulnerableColonies,
    evaluateSystemValue
} from '../engine/ai_utils';

async function main() {
    console.log("Loading gamestate...");
    const state = setupNewGame('Player', 12345);
    if (!state) {
        console.error("No gamestate");
        return;
    }

    const testEmpireId = 'empire_player'; // Assuming player empire exists
    const enemyEmpireId = 'empire_pirates';

    const playerFleet = state.empires[testEmpireId]?.fleets[0];
    const pirateFleet = state.empires[enemyEmpireId]?.fleets[0];

    if (playerFleet) {
        console.log(`\nEvaluating Combat Power for Player Fleet: ${playerFleet.name}`);
        const power = calculateFleetCombatPower(playerFleet, state);
        console.log(`Power: ${power.toFixed(2)}`);
    }

    if (pirateFleet) {
        console.log(`\nEvaluating Combat Power for Pirate Fleet: ${pirateFleet.name}`);
        const power = calculateFleetCombatPower(pirateFleet, state);
        console.log(`Power: ${power.toFixed(2)}`);
    }

    if (playerFleet && pirateFleet) {
        console.log(`\nEstimating Battle Outcome (Player vs Pirate)`);
        const winProb = estimateBattleOutcome(playerFleet, pirateFleet, state);
        console.log(`Player Win Probability: ${(winProb * 100).toFixed(1)}%`);
    }

    console.log(`\nScanning hostile fleets for player near first star...`);
    const starId = Object.values(state.galaxy.stars)[0].id;
    const targets = getDetectedHostileFleets(testEmpireId, starId, state);
    console.log(`Detected: ${targets.length}`);

    if (pirateFleet) {
        console.log(`\nIs Pirate Fleet Detected by anyone?`);
        console.log(isFleetDetectedByEnemy(pirateFleet) ? "Yes" : "No");
    }

    console.log(`\nEvaluating vulnerable colonies for Player...`);
    const colonies = getVulnerableColonies(testEmpireId, state);
    if (colonies.length > 0) {
        console.log(`Most vulnerable colony: ${colonies[0].name} (Empire: ${colonies[0].empireId})`);
    } else {
        console.log("No vulnerable colonies found.");
    }

    console.log(`\nEvaluating System Value: ${Object.values(state.galaxy.stars)[0].name}`);
    const val = evaluateSystemValue(starId, state);
    console.log(`Value: ${val}`);
}

main().catch(console.error);
