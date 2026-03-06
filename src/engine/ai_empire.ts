/**
 * @module ai_empire
 * @description
 * High-level orchestration for AI empires. 
 * Includes colony management, fleet construction, and strategic posture changes.
 * 
 * **Architecture & State Mutations:**
 * - `tickAIEmpire` drives the AI turn.
 * - Mutates `GameState.colonies[id].productionQueue` to queue buildings.
 * - Mutates `GameState.empires[id].fleets` and `GameState.ships` when ordering builds or colonizing.
 */
import type { GameState, Empire, Fleet, Planet, Colony, GameEvent } from '../types';
import { RNG } from '../utils/rng';
import { evaluateDiplomacy } from './diplomacy';
import { generateId } from '../utils/id';
import { getDetectedHostileFleets } from './ai_utils';


/**
 * Orchestrates the autonomous behaviors of an AI empire.
 * Handles economic management, fleet construction, and strategic posture shifts.
 */
export function tickAIEmpire(state: GameState, empire: Empire, rng: RNG, dt: number): GameEvent[] {
    const events: GameEvent[] = [];

    // Initialize AI state if it doesn't exist
    if (!empire.aiState) {
        empire.aiState = {
            posture: 'Expansion',
            targetSystems: [],
            lastEvaluationTick: state.turn
        };
    }

    // Evaluate posture periodically (e.g., every 30 days)
    if (state.turn - empire.aiState.lastEvaluationTick > 30 * 86400) {
        evaluateStrategicPosture(state, empire, rng, events);
        evaluateDiplomacy(state, empire, rng, events);
        empire.aiState.lastEvaluationTick = state.turn;
    }

    // Process AI mechanics if it's an AI
    manageColonies(state, empire, rng, dt, events);
    manageFleets(state, empire, rng, dt, events);

    return events;
}

function evaluateStrategicPosture(state: GameState, empire: Empire, rng: RNG, events: GameEvent[]) {
    if (!empire.aiState) return;

    // Very basic placeholder logic for posture
    if (empire.treasury < 20000) {
        empire.aiState.posture = 'Consolidation';
    } else {
        empire.aiState.posture = 'Expansion';
    }
}

// @todo (Phase 4): Move these hardcoded AI building costs to `BALANCING` or a shared `Buildings` datatable.
const AI_BUILDING_SPECS: Record<string, { name: string, cost: Record<string, number>, bp: number }> = {
    'Factory': { name: 'State Factory', cost: { Iron: 120, Copper: 40 }, bp: 1200 },
    'Mine': { name: 'State Mine', cost: { Iron: 80 }, bp: 800 },
    'GroundDefense': { name: 'Planetary Defense Complex', cost: { Iron: 200, Titanium: 50, Electronics: 10 }, bp: 2000 },
    'Shipyard': { name: 'Orbital Shipyard', cost: { Iron: 2000, Copper: 500, Machinery: 100 }, bp: 5000 },
};

function manageColonies(state: GameState, empire: Empire, rng: RNG, dt: number, events: GameEvent[]) {
    if (!empire.aiState) return;

    const empireColonies = Object.values(state.colonies).filter(c => c.empireId === empire.id);

    // AI evaluates each colony once a month
    if (rng.chance(dt / (30 * 86400))) {
        for (const colony of empireColonies) {
            // Don't queue things if queue is already long
            if (colony.productionQueue.length >= 2) continue;

            let targetType: string | null = null;

            // Priority 1: Do we have enough industry to even support an empire?
            if (colony.factories < 5) {
                targetType = 'Factory';
            }
            // Priority 2: Ground defenses if aggressive/consolidation
            else if (empire.aiState.posture !== 'Expansion' && colony.groundDefenses < (colony.population / 100)) {
                targetType = 'GroundDefense';
            }
            // Priority 3: Expansion needs Shipyards
            else if (empire.aiState.posture === 'Expansion' && colony.shipyards.length === 0 && colony.population > 5000) {
                targetType = 'Shipyard'; // Add Shipyard component
            }
            // Priority 4: Basic economy balancing
            else {
                if (colony.factories < colony.mines * 0.5) targetType = 'Factory';
                else targetType = 'Mine';
            }

            if (targetType) {
                const spec = AI_BUILDING_SPECS[targetType];
                if (targetType === 'Shipyard') {
                    // special handling for shipyards which aren't standard queue buildings
                    // but we can queue them as 'Shipyard' type if the engine supports it.
                    // Actually, the engine stores shipyards in a separate array `colony.shipyards`. 
                    // Let's just create it directly for now or use the queue.
                    if (!colony.productionQueue.some(i => i.type === 'Shipyard')) {
                        colony.productionQueue.push({
                            id: generateId('build', rng),
                            type: 'Shipyard' as any,
                            name: spec.name,
                            quantity: 1,
                            progress: 0,
                            bpCostPerUnit: spec.bp,
                            costPerUnit: spec.cost
                        });
                    }
                } else {
                    if (!colony.productionQueue.some(i => i.type === targetType)) {
                        colony.productionQueue.push({
                            id: generateId('build', rng),
                            type: targetType as any,
                            name: spec.name,
                            quantity: 1,
                            progress: 0,
                            bpCostPerUnit: spec.bp,
                            costPerUnit: spec.cost
                        });
                        events.push({
                            id: generateId('evt', rng),
                            turn: state.turn,
                            date: typeof state.date === 'string' ? state.date : state.date.toISOString().split('T')[0],
                            type: 'ColonyEvent',
                            message: `${empire.name} queued ${spec.name} on ${colony.name}.`,
                            empireId: empire.id,
                            important: false
                        });
                    }
                }
            }
        }
    }
}

function getDesignByClass(empire: Empire, hullClass: string) {
    return empire.designLibrary.find(d => d.hullClass === hullClass);
}

function manageFleets(state: GameState, empire: Empire, rng: RNG, dt: number, events: GameEvent[]) {
    if (!empire.aiState) return;

    const empireColonies = Object.values(state.colonies).filter(c => c.empireId === empire.id);
    const shipyards = empireColonies.flatMap(c => c.shipyards.map(sy => ({ colony: c, sy })));

    // 1. Ship Construction
    if (rng.chance(dt / (30 * 86400))) {
        // Count our existing ships
        const counts: Record<string, number> = { Survey: 0, ColonyShip: 0, Corvette: 0, Destroyer: 0 };
        for (const fleet of empire.fleets) {
            for (const shipId of fleet.shipIds) {
                const ship = state.ships[shipId];
                if (ship) {
                    const design = empire.designLibrary.find(d => d.id === ship.designId);
                    if (design && counts[design.hullClass] !== undefined) counts[design.hullClass]++;
                }
            }
        }

        // Determine what to build
        let wantedClass: string | null = null;
        if (counts.Survey < 2) wantedClass = 'Survey';
        else if (counts.ColonyShip < 1 && empire.aiState.posture === 'Expansion') wantedClass = 'ColonyShip';
        else if (empire.aiState.posture === 'Aggression' || counts.Corvette < 5) wantedClass = rng.chance(0.7) ? 'Corvette' : 'Destroyer';

        if (wantedClass && shipyards.length > 0) {
            const design = getDesignByClass(empire, wantedClass);
            if (design) {
                // Find idle shipyard
                const idleYard = shipyards.find(y => y.sy.activeBuilds.length < y.sy.slipways);
                if (idleYard) {
                    idleYard.sy.activeBuilds.push({
                        id: generateId('build', rng),
                        type: 'Ship',
                        name: design.name,
                        designId: design.id,
                        quantity: 1,
                        progress: 0,
                        bpCostPerUnit: design.bpCost,
                        costPerUnit: design.mineralCost
                    });
                    events.push({
                        id: generateId('evt', rng),
                        turn: state.turn,
                        date: typeof state.date === 'string' ? state.date : state.date.toISOString().split('T')[0],
                        type: 'ColonyEvent',
                        message: `${empire.name} laid down ${design.name} at ${idleYard.sy.name}.`,
                        empireId: empire.id,
                        important: false
                    });
                }
            }
        }
    }

    // 2. Fleet Orders
    if (rng.chance(dt / (5 * 86400))) {
        for (const fleet of empire.fleets) {
            if (fleet.isCivilian || fleet.orders.length > 0) continue;

            const ships = fleet.shipIds.map(id => state.ships[id]).filter(Boolean);
            if (ships.length === 0) continue;

            const isSurvey = ships.some(s => getDesignByClass(empire, 'Survey')?.id === s.designId);
            const isColony = ships.some(s => getDesignByClass(empire, 'ColonyShip')?.id === s.designId);

            if (isSurvey) {
                // Find unexplored system
                const currentStar = state.galaxy.stars[fleet.currentStarId];
                if (currentStar) {
                    const links = state.galaxy.jumpPoints.filter(j => j.starId === currentStar.id || j.targetStarId === currentStar.id);
                    const unvisited = links.find(l => {
                        const targetId = l.starId === currentStar.id ? l.targetStarId : l.starId;
                        return targetId !== currentStar.id; // Basic check for now
                    });
                    if (unvisited) {
                        const targetId = unvisited.starId === currentStar.id ? unvisited.targetStarId : unvisited.starId;
                        fleet.orders.push({ id: generateId('order', rng), type: 'Jump', targetStarId: targetId });
                    }
                }
            } else if (isColony) {
                const currentStar = state.galaxy.stars[fleet.currentStarId];
                if (currentStar) {
                    const colonizable = currentStar.planets.find(p => p.atmosphere === 'Breathable' && (!p.colonies || !p.colonies.some(c => c.empireId === empire.id)));

                    if (colonizable && fleet.orbitingPlanetId === colonizable.id) {
                        // Found one and orbiting it! Establish colony.
                        const newColonyId = generateId('colony', rng);
                        const newColony: Colony = {
                            id: newColonyId,
                            empireId: empire.id,
                            planetId: colonizable.id,
                            name: `${colonizable.name} Prime`,
                            population: 1000,
                            populationSegments: [{ speciesId: 'human', count: 1000, happiness: 50, habitability: 1.0 }],
                            maxPopulation: 10000,
                            populationGrowthRate: 0.02,
                            policy: 'Normal',
                            happiness: 60,
                            minerals: { Iron: 5000, Copper: 2000, Food: 5000, Aether: 1000 },
                            demand: {},
                            infrastructure: 100,
                            colonyType: 'Mining',
                            laborAllocation: { industry: 40, mining: 20, research: 10, construction: 10, agriculture: 10, commerce: 10 },
                            productionQueue: [],
                            factories: 0, mines: 0, civilianFactories: 0, civilianMines: 0, researchLabs: 0, spaceport: 0, shipyards: [], groundDefenses: 0, constructionOffices: 0, farms: 0, stores: 0, terraformProgress: 0, aethericDistillery: 0, migrationMode: 'Target', privateWealth: 1000, history: [],
                            electronicsPlants: 0, civilianElectronicsPlants: 0, machineryPlants: 0, civilianMachineryPlants: 0, educationIndex: 50, educationBudget: 0, resourcePrices: {}
                        };
                        state.colonies[newColonyId] = newColony;
                        if (!colonizable.colonies) colonizable.colonies = [];
                        colonizable.colonies.push(newColony);

                        // Destroy the fleet/ship now that it settled
                        empire.fleets = empire.fleets.filter(f => f.id !== fleet.id);
                        for (const sId of fleet.shipIds) delete state.ships[sId];

                        events.push({
                            id: generateId('evt', rng),
                            turn: state.turn,
                            date: typeof state.date === 'string' ? state.date : state.date.toISOString().split('T')[0],
                            type: 'ColonyEvent',
                            message: `${empire.name} established a new colony on ${colonizable.name} Prime!`,
                            empireId: empire.id,
                            important: true
                        });
                        continue;
                    } else if (colonizable) {
                        // Orbit the planet first to establish the colony
                        fleet.orders.push({ id: generateId('order', rng), type: 'MoveTo', targetPlanetId: colonizable.id });
                    } else {
                        // We need to move to a different system
                        const links = state.galaxy.jumpPoints.filter(j => j.starId === currentStar.id || j.targetStarId === currentStar.id);
                        if (links.length > 0) {
                            const link = rng.pick(links);
                            const targetId = link.starId === currentStar.id ? link.targetStarId : link.starId;
                            fleet.orders.push({ id: generateId('order', rng), type: 'Jump', targetStarId: targetId });
                        }
                    }
                }
            } else {
                // Military fleet - Check for hostiles
                const hostiles = getDetectedHostileFleets(empire.id, fleet.currentStarId, state);
                if (hostiles.length > 0 && hostiles[0]) {
                    fleet.orders.push({ id: generateId('order', rng), type: 'Attack', targetFleetId: hostiles[0].id });
                }
            }
        }
    }
}
