import { GameState } from '../types';
import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { Scenario, ScenarioResult } from './types';
import SimLogger from '../utils/logger';

/**
 * MARS ISOLATION
 */
export const MarsIsolation: Scenario = {
    name: 'Mars Isolation',
    description: 'Verify survival of a wealthy but resource-poor colony via trade.',
    setup: (seed: number) => {
        const state = setupNewGame("Mars Isolation", seed, true);
        const sol = state.galaxy.stars['star_0'];
        const planet = sol.planets[3] || sol.planets[0];
        const mars = {
            ...Object.values(state.colonies)[0],
            id: 'col_mars',
            name: 'Mars',
            planetId: planet.id,
            population: 50,
            populationSegments: [{ speciesId: 'human' as const, count: 50, happiness: 50, habitability: 0.1 }],
            minerals: { Food: 0, Water: 0, ConsumerGoods: 0, Electronics: 0, Machinery: 0 },
            privateWealth: 20000,
            factories: 0,
            farms: 0,
            infrastructure: 10,
            shipyards: [],
            buildingOwners: { 'private': { 'private': 50 } }
        };
        state.colonies[mars.id] = mars;
        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const marsId = 'col_mars';
        const startPop = state.colonies[marsId].population;
        let currentState = state;
        for (let i = 0; i < ticks; i++) {
            currentState = advanceTick(currentState);
        }
        const finalPop = currentState.colonies[marsId].population;
        const success = finalPop >= startPop * 0.9;
        return {
            success,
            message: `Mars Population: ${startPop.toFixed(1)} -> ${finalPop.toFixed(1)}`,
            metrics: { startPop, finalPop }
        };
    }
};

/**
 * MANUFACTURING CRASH
 */
export const ManufacturingCrash: Scenario = {
    name: 'Manufacturing Crash',
    description: 'Verify wealth sinks bleed corporate/private capital during low demand.',
    setup: (seed: number) => {
        const state = setupNewGame("Manufacturing Crash", seed, true);
        const earth = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra')!;
        earth.privateWealth = 1000000;
        earth.civilianFactories = 100;
        earth.population = 10;
        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const earthId = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra')!.id;
        const startWealth = state.colonies[earthId].privateWealth;
        let currentState = state;
        for (let i = 0; i < ticks; i++) {
            currentState = advanceTick(currentState);
        }
        const finalWealth = currentState.colonies[earthId].privateWealth;
        const success = finalWealth < startWealth * 0.5;
        return {
            success,
            message: `Wealth Bleed: ${startWealth.toFixed(0)} -> ${finalWealth.toFixed(0)}`,
            metrics: { startWealth, finalWealth, ratio: finalWealth / startWealth }
        };
    }
};

/**
 * KNOWLEDGE DESERT
 */
export const KnowledgeDesert: Scenario = {
    name: 'Knowledge Desert',
    description: 'Verify education decay when funding is cut.',
    setup: (seed: number) => {
        const state = setupNewGame("Knowledge Desert", seed, true);
        const earth = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra')!;
        earth.educationIndex = 100;
        earth.educationBudget = 0;
        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const earthId = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra')!.id;
        const startEdu = state.colonies[earthId].educationIndex || 0;
        let currentState = state;
        for (let i = 0; i < ticks; i++) {
            currentState = advanceTick(currentState);
        }
        const finalEdu = currentState.colonies[earthId].educationIndex || 0;
        const success = finalEdu < startEdu * 0.96;
        return {
            success,
            message: `Education Decay: ${startEdu.toFixed(1)} -> ${finalEdu.toFixed(1)}`,
            metrics: { startEdu, finalEdu }
        };
    }
};

/**
 * GRAND ARMADA
 */
export const GrandArmada: Scenario = {
    name: 'Grand Armada',
    description: 'Verify Machinery price spikes during massive ship construction.',
    setup: (seed: number) => {
        const state = setupNewGame("Armada Test", seed, true);
        const earthKey = Object.keys(state.colonies).find(k => state.colonies[k].name === 'Earth' || state.colonies[k].name === 'New Terra')!;
        const earth = state.colonies[earthKey];

        earth.shipyards = [{
            id: 'sy_mega',
            name: "Mega Shipyard",
            slipways: 10,
            maxTonnage: 100000,
            activeBuilds: []
        }];

        const design = state.empires[state.playerEmpireId].designLibrary[0];
        for (let i = 0; i < 50; i++) {
            earth.shipyards[0].activeBuilds.push({
                id: `order_${i}`,
                type: 'Ship',
                name: `Super Dreadnought ${i}`,
                designId: design.id,
                quantity: 10,
                progress: 0,
                bpCostPerUnit: 50000,
                costPerUnit: { Iron: 10000, Titanium: 5000 }
            });
        }

        earth.minerals.Machinery = 0;
        earth.machineryPlants = 0;
        earth.civilianMachineryPlants = 0;
        if (earth.buildingOwners) {
            delete earth.buildingOwners['MachineryPlant'];
            delete earth.buildingOwners['CivilianMachineryPlant'];
        }
        return state;
    },
    run: async (state: GameState, ticks: number): Promise<ScenarioResult> => {
        const earthId = Object.values(state.colonies).find(c => c.name === 'Earth' || c.name === 'New Terra')!.id;
        let maxMachineryPrice = 0;
        let currentState = state;
        for (let i = 0; i < ticks; i++) {
            currentState = advanceTick(currentState);
            const price = currentState.colonies[earthId].resourcePrices?.Machinery || 0;
            if (price > maxMachineryPrice) maxMachineryPrice = price;
        }
        const success = maxMachineryPrice > 15.0;
        return {
            success,
            message: `Peak Machinery Price: ${maxMachineryPrice.toFixed(2)}`,
            metrics: { maxMachineryPrice }
        };
    }
};
