import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import type { GameState } from '../types';
import type { Scenario, ScenarioResult } from './types';
import * as fs from 'fs';
import * as path from 'path';

export const Economy50YearRun: Scenario = {
    name: "Economy50YearRun",
    description: "Simulates 50 years of AI vs AI gameplay, verifying long-term economic and expansion growth, then exports the state for browser loading.",

    setup: (seed: number): GameState => {
        const state = setupNewGame('Player AI', seed, false);

        const playerEmpireId = state.playerEmpireId;
        const aiEmpireId = Object.keys(state.empires).find(id => id.startsWith('empire_ai_'));

        if (!aiEmpireId) {
            throw new Error("Failed to spawn AI empire.");
        }

        const playerEmpire = state.empires[playerEmpireId];

        // Hand control over to the AI agent
        playerEmpire.isPlayer = false;
        playerEmpire.aiState = {
            posture: 'Expansion',
            targetSystems: [],
            lastEvaluationTick: 0
        };

        return state;
    },

    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const playerEmpireId = state.playerEmpireId;
        const aiEmpireId = Object.keys(state.empires).find(id => id.startsWith('empire_ai_'))!;

        let currentState = { ...state };

        for (let i = 0; i < ticks; i++) {
            currentState.tickLength = 86400; // 1 day
            currentState = advanceTick(currentState);
        }

        const reportEmpire = (empId: string) => {
            const emp = currentState.empires[empId];
            const colonies = Object.values(currentState.colonies).filter(c => c.empireId === empId);
            const fleets = emp.fleets;

            let corvetteCount = 0;
            let destroyerCount = 0;
            for (const f of fleets) {
                for (const sId of f.shipIds) {
                    const ship = currentState.ships[sId];
                    if (ship) {
                        const design = emp.designLibrary.find(d => d.id === ship.designId);
                        if (design?.hullClass === 'Corvette') corvetteCount++;
                        if (design?.hullClass === 'Destroyer') destroyerCount++;
                    }
                }
            }

            let corpWealth = 0;
            for (const corp of emp.companies) corpWealth += corp.wealth;

            return {
                colonies: colonies.length,
                corporations: emp.companies.length,
                corporateWealth: corpWealth,
                corvettes: corvetteCount,
                destroyers: destroyerCount,
            };
        };

        const playerStats = reportEmpire(playerEmpireId);
        const aiStats = reportEmpire(aiEmpireId);

        // Save final state for browser loading
        const saveableState = { ...currentState };
        for (const colony of Object.values(saveableState.colonies)) {
            colony.history = [];
        }
        for (const ship of Object.values(saveableState.ships)) {
            (ship as any).history = [];
        }

        for (const empire of Object.values(saveableState.empires)) {
            empire.history = [];
            empire.events = empire.events.slice(-10); // Keep only last 10 events
            for (const company of empire.companies) {
                company.history = [];
                company.transactions = [];
            }
        }

        // Prune logs
        saveableState.monetaryLedger = [];
        if (saveableState.stats) {
            saveableState.stats.monetaryLedger = [];
            saveableState.stats.cashflowLedger = [];
        }
        saveableState.cashflowLedger = [];

        const outputPath = path.resolve(__dirname, '../../public/sim_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(saveableState));

        return {
            success: playerStats.colonies > 1 && aiStats.colonies > 1, // Basic success check: did they expand?
            message: `50 year simulation complete. State saved to sim_output.json.`,
            metrics: {
                playerColonies: playerStats.colonies,
                playerCorps: playerStats.corporations,
                playerCorpWealth: playerStats.corporateWealth,
                aiColonies: aiStats.colonies,
                aiCorps: aiStats.corporations,
                aiCorpWealth: aiStats.corporateWealth,
            }
        };
    }
};
