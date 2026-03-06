import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { createDesign } from '../engine/ships';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, Ship } from '../types';
import type { Scenario, ScenarioResult } from './types';

const FLEET_A_SIZE = 100;
const FLEET_B_SIZE = 100;

function spawnCombatFleet(
    state: GameState,
    empireId: string,
    designId: string,
    fleetName: string,
    size: number,
    position: { x: number; y: number },
    starId: string,
    rng: RNG
): Fleet {
    const empire = state.empires[empireId];
    if (!empire) throw new Error(`Empire ${empireId} not found`);

    const design = empire.designLibrary.find(d => d.id === designId);
    if (!design) throw new Error(`Design ${designId} not found in ${empireId}`);

    const shipIds: string[] = [];
    for (let i = 0; i < size; i++) {
        const shipId = generateId('ship', rng);
        const ship: Ship = {
            id: shipId,
            name: `${design.name} ${i + 1}`,
            designId: design.id,
            empireId,
            hullPoints: design.maxHullPoints,
            maxHullPoints: design.maxHullPoints,
            shieldPoints: 0,
            fuel: design.fuelCapacity,
            experience: 0,
            cargo: {},
            inventory: [],
        };
        state.ships[shipId] = ship;
        shipIds.push(shipId);
    }

    const fleetId = generateId('fleet', rng);
    const fleet: Fleet = {
        id: fleetId,
        name: fleetName,
        empireId,
        shipIds,
        currentStarId: starId,
        position,
        orders: [{
            id: generateId('order', rng),
            type: 'Attack',
            targetFleetId: '',
        }],
    };

    empire.fleets.push(fleet);
    return fleet;
}

export const CombatStressTest: Scenario = {
    name: "CombatStressTest",
    description: "Spawns two large fleets and measures tick latency during sustained combat.",

    setup: (seed: number): GameState => {
        const rng = new RNG(seed);
        const state = setupNewGame('Terran Sovereignty', seed, false);

        const enemyEmpireId = 'empire_enemy';
        state.empires[enemyEmpireId] = {
            id: enemyEmpireId,
            name: 'Corsair Federation',
            color: '#ff4444',
            isPlayer: false,
            homeSystemId: 'star_0',
            homePlanetId: '',
            minerals: {},
            research: { activeProjects: [], completedTechs: [] },
            officers: [],
            fleets: [],
            designLibrary: [
                createDesign('design_destroyer_e', 'Corsair Hunter', 'Destroyer',
                    ['reactor_dynamo', 'engine_furnace_md', 'engine_furnace_sm', 'tank_phlogiston_md', 'scanner_optic_md', 'emitter_aetheric_md', 'battery_magnetic_sm', 'plating_bessemer', 'plating_bessemer']),
            ],
            treasury: 0,
            privateWealth: 0,
            tradeRoutes: [],
            companies: [],
            relations: {},
            events: [],
            history: [],
        };

        const homeStarId = 'star_0';
        const playerEmpireId = state.playerEmpireId;

        const fleetA = spawnCombatFleet(
            state, playerEmpireId, 'design_destroyer',
            `TSN Battle Fleet Alpha`, FLEET_A_SIZE,
            { x: -2, y: 0 }, homeStarId, rng
        );

        const fleetB = spawnCombatFleet(
            state, enemyEmpireId, 'design_destroyer_e',
            `Corsair Armada`, FLEET_B_SIZE,
            { x: 2, y: 0 }, homeStarId, rng
        );

        fleetA.orders[0]!.targetFleetId = fleetB.id;
        fleetB.orders[0] = {
            id: generateId('order', rng),
            type: 'Attack',
            targetFleetId: fleetA.id,
        };

        return state;
    },

    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const playerEmpireId = state.playerEmpireId;
        const enemyEmpireId = 'empire_enemy';

        let currentState = { ...state };
        let fleetA = currentState.empires[playerEmpireId].fleets[0];
        let fleetB = currentState.empires[enemyEmpireId].fleets[0];

        let maxLatency = 0;
        let totalLatency = 0;
        let ticksRan = 0;

        for (let tick = 0; tick < ticks; tick++) {
            const tsnShipsBefore = fleetA.shipIds.length;
            const corsairShipsBefore = fleetB.shipIds.length;

            if (tsnShipsBefore === 0 || corsairShipsBefore === 0) {
                break;
            }

            const t0 = performance.now();
            currentState = advanceTick(currentState);
            const dt = performance.now() - t0;

            maxLatency = Math.max(maxLatency, dt);
            totalLatency += dt;
            ticksRan++;

            fleetA = currentState.empires[playerEmpireId].fleets[0];
            fleetB = currentState.empires[enemyEmpireId].fleets[0];
        }

        const avgLatency = ticksRan > 0 ? totalLatency / ticksRan : 0;
        const tsnRemaining = fleetA ? fleetA.shipIds.length : 0;
        const corsairRemaining = fleetB ? fleetB.shipIds.length : 0;

        return {
            success: tsnRemaining === 0 || corsairRemaining === 0 || ticksRan === ticks,
            message: `Combat ran for ${ticksRan} ticks. TSN Ships: ${tsnRemaining}, Corsair Ships: ${corsairRemaining}. Max latency: ${maxLatency.toFixed(2)}ms.`,
            metrics: {
                ticksRan,
                tsnShipsRemaining: tsnRemaining,
                corsairShipsRemaining: corsairRemaining,
                avgTickLatencyMs: Number(avgLatency.toFixed(2)),
                maxTickLatencyMs: Number(maxLatency.toFixed(2)),
            }
        };
    }
};
