import type { GameState, GameEvent, Fleet, Ship, Vec2, Empire, Star, Planet, Colony, ShipOrder, ShipComponent } from '@/types';
import { RNG } from '@/utils/rng';
import { makeEvent } from './events';
import { getAdmiralBonuses } from './officers';
import { getEmpireTechBonuses } from './research';
import { generateId } from '@/utils/id';
import { BALANCING } from './constants';

// Helper to calculate distance
function distance(p1: Vec2, p2: Vec2): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Helper to calculate real-time planet position
export function getPlanetPosition(planet: { orbitRadius: number, orbitAngle: number }, turn: number): Vec2 {
    const gameTimeDays = turn / 86400;
    // Kepler's Third Law approximation for 1 Solar Mass: T = R^1.5 years. Speed in rad/day.
    const speed = (2 * Math.PI) / (365.25 * Math.pow(planet.orbitRadius, 1.5));
    const currentAngle = planet.orbitAngle + gameTimeDays * speed;
    return {
        x: Math.cos(currentAngle) * planet.orbitRadius,
        y: Math.sin(currentAngle) * planet.orbitRadius
    };
}

export function getFleetSpeed(fleet: Fleet, state: GameState): number {
    const empire = state.empires[fleet.empireId];
    if (!empire) return 0.5;

    const admiralBonuses = getAdmiralBonuses(empire.officers, fleet.admiralId);
    const speedBonus = 1 + (admiralBonuses.fleet_speed ?? 0);

    let baseSpeed = 0.5;
    let outOfFuel = false;

    if (fleet.shipIds.length > 0) {
        let minSpeed = Infinity;
        for (const sid of fleet.shipIds) {
            const s = state.ships[sid];
            if (!s) continue;
            const design = empire.designLibrary.find(d => d.id === s.designId);
            if (design && design.speed < minSpeed) {
                minSpeed = design.speed;
            }
            if (s.fuel <= 0) outOfFuel = true;
        }
        if (minSpeed !== Infinity && minSpeed > 0) baseSpeed = minSpeed / 100;
    }

    let fleetSpeed = baseSpeed * speedBonus;
    if (outOfFuel) fleetSpeed *= 0.1;

    return fleetSpeed;
}

export function calculateInterceptPosition(fleetPos: Vec2, fleetSpeedAuPerDay: number, planet: { orbitRadius: number, orbitAngle: number }, currentTurn: number): Vec2 {
    if (fleetSpeedAuPerDay <= 0) return getPlanetPosition(planet, currentTurn);

    let timeToInterceptDays = 0;
    let targetPos = getPlanetPosition(planet, currentTurn);

    // Iterate to find intercept. Maximum 5 iterations is plenty for orbital mechanics scale.
    for (let i = 0; i < 5; i++) {
        const dist = distance(fleetPos, targetPos);
        timeToInterceptDays = dist / fleetSpeedAuPerDay;
        targetPos = getPlanetPosition(planet, currentTurn + timeToInterceptDays * 86400);
    }

    return targetPos;
}

// ─── Advance: Ship Movement ───────────────────────────────────────────────────

/**
 * Handles fleet deletion if empty or garbage collecting arrived civilian phantoms.
 */
function handleFleetMaintenance(fleet: Fleet, empire: Empire): boolean {
    if (fleet.shipIds.length === 0) {
        empire.fleets = empire.fleets.filter(f => f.id !== fleet.id);
        return true;
    }

    return false;
}

/**
 * Updates fleet position to match its orbiting planet if idle.
 */
function handleFleetOrbit(fleet: Fleet, state: GameState) {
    if (!fleet.destination && fleet.orbitingPlanetId) {
        const star = state.galaxy.stars[fleet.currentStarId];
        if (star) {
            const planet = star.planets.find(p => p.id === fleet.orbitingPlanetId);
            if (planet) {
                fleet.position = getPlanetPosition(planet, state.turn);
            } else {
                fleet.orbitingPlanetId = undefined;
            }
        }
    }
}

/**
 * Processes the current order for a fleet if it's idle.
 */
function processFleetOrders(fleet: Fleet, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    if (fleet.destination || !fleet.orders || fleet.orders.length === 0) return;

    const order = fleet.orders[0];
    switch (order.type) {
        case 'MoveTo':
            processMoveOrder(fleet, order, state);
            break;
        case 'Jump':
            processJumpOrder(fleet, order, state, empire, events, rng);
            break;
        case 'Survey':
            processSurveyOrder(fleet, order, state, empire, events, rng);
            break;
            break;
        case 'Transport':
            processTransportOrder(fleet, order, state, empire, events, rng);
            break;
        case 'Migrate':
            processMigrateOrder(fleet, order, state, empire, events, rng);
            break;
        default:
            fleet.orders.shift(); // Invalid/unimplemented
            break;
    }
}

function processMoveOrder(fleet: Fleet, order: ShipOrder, state: GameState) {
    if (order.targetPlanetId) {
        const star = state.galaxy.stars[fleet.currentStarId];
        const targetPlanet = star?.planets.find(p => p.id === order.targetPlanetId);
        if (targetPlanet) {
            const pPos = getPlanetPosition(targetPlanet, state.turn);
            if (distance(fleet.position, pPos) < 0.2) {
                fleet.orders.shift();
                fleet.orbitingPlanetId = targetPlanet.id;
                fleet.destination = undefined;
            } else {
                const speed = getFleetSpeed(fleet, state);
                const interceptPos = calculateInterceptPosition(fleet.position, speed, targetPlanet, state.turn);
                fleet.destination = { x: interceptPos.x, y: interceptPos.y, etaSeconds: 0 };
                fleet.orbitingPlanetId = undefined;
            }
        } else {
            fleet.orders.shift();
        }
    } else if (order.targetPosition) {
        if (distance(fleet.position, order.targetPosition) < 0.1) {
            fleet.orders.shift();
            fleet.destination = undefined;
        } else {
            fleet.destination = { x: order.targetPosition.x, y: order.targetPosition.y, etaSeconds: 0 };
            fleet.orbitingPlanetId = undefined;
        }
    } else {
        fleet.orders.shift();
    }
}

function processJumpOrder(fleet: Fleet, order: ShipOrder, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    const star = state.galaxy.stars[fleet.currentStarId];
    if (!star || !order.targetStarId) {
        fleet.orders.shift();
        return;
    }

    const jp = star.jumpPoints.find(j => j.targetStarId === order.targetStarId);
    if (!jp) {
        fleet.orders.shift();
        return;
    }

    if (distance(fleet.position, jp.position) < 0.1) {
        fleet.currentStarId = jp.targetStarId;
        const destStar = state.galaxy.stars[jp.targetStarId];
        if (destStar) {
            const retJp = destStar.jumpPoints.find(j => j.targetStarId === star.id);
            if (retJp) fleet.position = { ...retJp.position };

            if (!destStar.surveyedByEmpires.includes(empire.id)) {
                destStar.explored = true;
                destStar.surveyedByEmpires.push(empire.id);
                for (const djp of destStar.jumpPoints) djp.discovered = true;
                events.push(makeEvent(state.turn, state.date, 'SystemExplored',
                    `Fleet "${fleet.name}" jumped to ${destStar.name}`, rng, { starId: destStar.id, important: true }));
            }
        }
        fleet.orders.shift();
    } else {
        fleet.destination = { x: jp.position.x, y: jp.position.y, etaSeconds: 0 };
        fleet.orbitingPlanetId = undefined;
    }
}

function processSurveyOrder(fleet: Fleet, order: ShipOrder, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    const star = state.galaxy.stars[fleet.currentStarId];
    if (!star || !order.targetPlanetId) {
        fleet.orders.shift();
        return;
    }

    const targetPlanet = star.planets.find(p => p.id === order.targetPlanetId);
    if (!targetPlanet) {
        fleet.orders.shift();
        return;
    }

    const techBonuses = getEmpireTechBonuses(empire.research.completedTechs);
    const surveyRange = 0.2 + (techBonuses.survey_range ?? 0);
    const surveyAccuracy = 1.0 + (techBonuses.survey_accuracy ?? 0);

    const pPos = getPlanetPosition(targetPlanet, state.turn);
    if (distance(fleet.position, pPos) < surveyRange) {
        if (!targetPlanet.surveyedByEmpires.includes(empire.id)) {
            targetPlanet.surveyedByEmpires.push(empire.id);
            // Survey accuracy could affect the detail level; for now it's flavor/placeholder for discovery logic
            const minDetails = targetPlanet.minerals
                .map(m => `${m.name}: ${Math.floor(m.amount * surveyAccuracy)}`)
                .join(', ');

            events.push(makeEvent(state.turn, state.date, 'MineralsFound',
                `Fleet "${fleet.name}" completed survey of ${targetPlanet.name}${techBonuses.survey_accuracy ? ' with advanced scanners' : ''}. Found: ${minDetails || 'Nothing'}`,
                rng, { starId: star.id, planetId: targetPlanet.id, important: true }));
        }
        fleet.orders.shift();
    } else {
        const speed = getFleetSpeed(fleet, state);
        const interceptPos = calculateInterceptPosition(fleet.position, speed, targetPlanet, state.turn);
        fleet.destination = { x: interceptPos.x, y: interceptPos.y, etaSeconds: 0 };
    }
}


function processMigrateOrder(fleet: Fleet, order: ShipOrder, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    const star = state.galaxy.stars[fleet.currentStarId];
    if (!star || !order.targetPlanetId) {
        fleet.orders.shift();
        return;
    }

    const targetPlanet = star.planets.find(p => p.id === order.targetPlanetId);
    if (!targetPlanet) {
        fleet.orders.shift();
        return;
    }

    const pPos = getPlanetPosition(targetPlanet, state.turn);
    if (distance(fleet.position, pPos) < 0.2) {
        let passengerCapacity = 0;
        for (const sid of fleet.shipIds) {
            const s = state.ships[sid];
            if (!s) continue;
            const design = empire.designLibrary.find(d => d.id === s.designId);
            if (design) {
                for (const mod of design.components) {
                    if (mod.type === 'ColonizationModule') {
                        passengerCapacity += mod.stats.colonistCapacity ?? 50000;
                    }
                }
            }
        }

        if (passengerCapacity > 0) {
            const colony = Object.values(state.colonies).find(c => c.planetId === order.targetPlanetId && c.empireId === fleet.empireId);

            if (order.cargoAction === 'Load') {
                if (colony && colony.migrationMode === 'Source' && colony.spaceport > 0) {
                    const waiting = colony.migrantsWaiting || 0;
                    const maxToLoad = Math.min(passengerCapacity / 1e6, waiting);
                    const toLoad = order.amount ? Math.min(order.amount, maxToLoad) : maxToLoad;

                    if (toLoad > 0.01) {
                        let remainingToLoad = toLoad;
                        for (const sid of fleet.shipIds) {
                            if (remainingToLoad <= 0) break;
                            const s = state.ships[sid];
                            if (!s) continue;
                            const d = empire.designLibrary.find(dl => dl.id === s.designId);
                            const cap = (d?.components.reduce((sum, c) => sum + (c.type === 'ColonizationModule' ? (c.stats.capacity || 500000) : 0), 0) || 0) / 1e6;
                            const current = s.cargo?.['Civilians'] || 0;
                            const space = cap - current;
                            if (space > 0) {
                                const load = Math.min(remainingToLoad, space);
                                if (!s.cargo) s.cargo = {};
                                s.cargo['Civilians'] = current + load;
                                if (!s.inventory) s.inventory = [];
                                s.inventory.push({
                                    res: 'Civilians',
                                    amount: load,
                                    originId: order.originId || colony.id,
                                    targetId: order.targetId || ''
                                });
                                remainingToLoad -= load;
                            }
                        }
                        const actualLoaded = toLoad - remainingToLoad;
                        colony.population -= actualLoaded;
                        colony.migrantsWaiting = Math.max(0, (colony.migrantsWaiting || 0) - actualLoaded);

                        if (colony.populationSegments && colony.populationSegments.length > 0) {
                            colony.populationSegments.forEach(seg => {
                                seg.count -= (seg.count / (colony.population + actualLoaded)) * actualLoaded;
                            });
                        }

                        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                            `Passenger fleet "${fleet.name}" loaded ${actualLoaded.toFixed(2)}M colonists from ${colony.name}.`, rng));
                    }
                }
            } else if (order.cargoAction === 'Unload') {
                if (colony && (colony.spaceport > 0 || colony.migrationMode === 'Target')) { // Target colonies can receive even without full spaceport maybe? No, let's be strict if user asked.
                    if (colony.spaceport <= 0) {
                        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion', `Passenger fleet "${fleet.name}" cannot unload colonists at ${colony.name} - no spaceport!`, rng));
                        fleet.orders.shift();
                        return;
                    }
                    let totalUnloaded = 0;
                    for (const sid of fleet.shipIds) {
                        const s = state.ships[sid];
                        if (!s || !s.cargo || !s.cargo['Civilians']) continue;
                        const has = s.cargo['Civilians'];
                        const toUnload = Math.min(order.amount || has, has);
                        s.cargo['Civilians'] -= toUnload;

                        // Structured manifest removal
                        if (s.inventory) {
                            let removed = 0;
                            for (let i = s.inventory.length - 1; i >= 0; i--) {
                                if (s.inventory[i].res === 'Civilians' && removed < toUnload) {
                                    const take = Math.min(s.inventory[i].amount, toUnload - removed);
                                    s.inventory[i].amount -= take;
                                    removed += take;
                                    if (s.inventory[i].amount <= 0.001) s.inventory.splice(i, 1);
                                }
                            }
                        }

                        totalUnloaded += toUnload;
                    }
                    if (totalUnloaded > 0) {
                        colony.population += totalUnloaded;
                        if (colony.populationSegments.length > 0) {
                            colony.populationSegments[0].count += totalUnloaded;
                        }

                        // Pay the company
                        const firstShip = state.ships[fleet.shipIds[0]];
                        const company = empire.companies.find(c => c.id === firstShip?.sourceCompanyId);
                        if (company) {
                            const fee = totalUnloaded * 500; // 500 wealth per million colonists
                            company.wealth += fee;
                            company.transactions?.push({
                                date: state.date.toISOString().split('T')[0],
                                amount: fee,
                                type: 'Revenue',
                                description: `Migration fee for ${totalUnloaded.toFixed(2)}M colonists to ${colony.name}`
                            });
                        }

                        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                            `Passenger fleet "${fleet.name}" unloaded ${totalUnloaded.toFixed(2)}M colonists to ${colony.name}.`, rng));
                    }
                }
            }
        }
        fleet.orders.shift();
    } else {
        const speed = getFleetSpeed(fleet, state);
        const interceptPos = calculateInterceptPosition(fleet.position, speed, targetPlanet, state.turn);
        fleet.destination = { x: interceptPos.x, y: interceptPos.y, etaSeconds: 0 };
    }
}
function processTransportOrder(fleet: Fleet, order: ShipOrder, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    const star = state.galaxy.stars[fleet.currentStarId];
    if (!star || !order.targetPlanetId) {
        fleet.orders.shift();
        return;
    }

    const targetPlanet = star.planets.find(p => p.id === order.targetPlanetId);
    if (!targetPlanet) {
        fleet.orders.shift();
        return;
    }

    const pPos = getPlanetPosition(targetPlanet, state.turn);
    if (distance(fleet.position, pPos) < 0.2) {
        let cargoCapacity = 0;
        for (const sid of fleet.shipIds) {
            const s = state.ships[sid];
            if (!s) continue;
            const design = empire.designLibrary.find(d => d.id === s.designId);
            if (design) {
                for (const mod of design.components) {
                    if (mod.type === 'Cargo') cargoCapacity += mod.stats.cargoCapacity ?? 5000;
                }
            }
        }

        if (cargoCapacity > 0) {
            const techBonuses = getEmpireTechBonuses(empire.research.completedTechs);
            cargoCapacity *= (1 + (techBonuses.cargo_capacity ?? 0));
            const loadSpeedMult = (1 + (techBonuses.load_speed ?? 0));
            const res = order.resourceName || 'Iron';
            const amt = order.amount || cargoCapacity;

            if (order.cargoAction === 'Load') {
                const colony = Object.values(state.colonies).find(c => c.planetId === order.targetPlanetId && c.empireId === fleet.empireId);
                if (colony && colony.spaceport > 0) {
                    const available = (colony.minerals[res] ?? 0);
                    const toLoad = Math.min(amt, available, cargoCapacity);

                    if (toLoad > 0) {
                        let remainingToLoad = toLoad;
                        for (const sid of fleet.shipIds) {
                            if (remainingToLoad <= 0) break;
                            const s = state.ships[sid];
                            if (!s) continue;
                            const d = empire.designLibrary.find(dl => dl.id === s.designId);
                            const cap = d?.components.reduce((sum, c) => sum + (c.type === 'Cargo' ? (c.stats.cargoCapacity || 5000) : 0), 0) || 0;
                            const current = s.cargo?.[res] || 0;
                            const space = cap - current;
                            if (space > 0) {
                                const load = Math.min(remainingToLoad, space);
                                if (!s.cargo) s.cargo = {};
                                s.cargo[res] = current + load;
                                if (!s.inventory) s.inventory = [];
                                s.inventory.push({
                                    res: res,
                                    amount: load,
                                    originId: order.originId || colony.id,
                                    targetId: order.targetId || ''
                                });
                                remainingToLoad -= load;
                            }
                        }
                        const actualLoaded = toLoad - remainingToLoad;
                        colony.minerals[res] -= actualLoaded;

                        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                            `Freighter fleet "${fleet.name}" loaded ${Math.floor(actualLoaded)}t of ${res} from ${colony.name}.`, rng));
                    }
                }
            } else if (order.cargoAction === 'Unload') {
                const colony = Object.values(state.colonies).find(c => c.planetId === order.targetPlanetId && c.empireId === fleet.empireId);
                if (colony) { // Spaceport NOT required for unloading supplies/infrastructure
                    let totalUnloaded = 0;
                    for (const sid of fleet.shipIds) {
                        const s = state.ships[sid];
                        if (!s || !s.cargo || !s.cargo[res]) continue;
                        const has = s.cargo[res];
                        const toUnload = Math.min(amt - totalUnloaded, has);
                        s.cargo[res] -= toUnload;

                        // Structured manifest removal
                        if (s.inventory) {
                            let removed = 0;
                            for (let i = s.inventory.length - 1; i >= 0; i--) {
                                if (s.inventory[i].res === res && removed < toUnload) {
                                    const take = Math.min(s.inventory[i].amount, toUnload - removed);
                                    s.inventory[i].amount -= take;
                                    removed += take;
                                    if (s.inventory[i].amount <= 0.001) s.inventory.splice(i, 1);
                                }
                            }
                        }

                        totalUnloaded += toUnload;
                    }
                    if (totalUnloaded > 0) {
                        colony.minerals[res] = (colony.minerals[res] || 0) + totalUnloaded;

                        // Pay the company
                        const firstShip = state.ships[fleet.shipIds[0]];
                        const company = empire.companies.find(c => c.id === firstShip?.sourceCompanyId);
                        if (company) {
                            const fee = totalUnloaded * 0.5; // 0.5 wealth per ton
                            company.wealth += fee;
                            company.transactions?.push({
                                date: state.date.toISOString().split('T')[0],
                                amount: fee,
                                type: 'Revenue',
                                description: `Transport fee for ${Math.floor(totalUnloaded)}t of ${res} to ${colony.name}`
                            });
                        }

                        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                            `Freighter fleet "${fleet.name}" unloaded ${Math.floor(totalUnloaded)}t of ${res} to ${colony.name}.`, rng));
                    }
                }
            }
        }
        fleet.orders.shift();
    } else {
        const speed = getFleetSpeed(fleet, state);
        const interceptPos = calculateInterceptPosition(fleet.position, speed, targetPlanet, state.turn);
        fleet.destination = { x: interceptPos.x, y: interceptPos.y, etaSeconds: 0 };
    }
}


/**
 * Calculates current fleet speed and fuel consumption.
 */
function getFleetStats(fleet: Fleet, state: GameState, empire: Empire) {
    const techBonuses = getEmpireTechBonuses(empire.research.completedTechs);
    const admiralBonuses = getAdmiralBonuses(empire.officers, fleet.admiralId);

    const speedBonus = (1 + (admiralBonuses.fleet_speed ?? 0)) * (1 + (techBonuses.engine_thrust ?? 0));
    const fuelEfficiencyBonus = 1 - (techBonuses.fuel_efficiency ?? 0); // Efficiency reduces consumption

    let baseSpeed = 0.5; // fallback AU/day
    let fuelPerTick = 0;

    if (fleet.shipIds.length > 0) {
        let minSpeed = Infinity;
        for (const sid of fleet.shipIds) {
            const s = state.ships[sid];
            if (!s) continue;
            const design = empire.designLibrary.find(d => d.id === s.designId);
            if (design) {
                if (design.speed < minSpeed) minSpeed = design.speed;
                for (const comp of design.components) {
                    if (comp.stats.fuelPerTick) fuelPerTick += comp.stats.fuelPerTick;
                }
            }
        }
        if (minSpeed !== Infinity && minSpeed > 0) baseSpeed = minSpeed / 100;
    }

    return {
        fleetSpeed: baseSpeed * speedBonus,
        fuelPerTick: fuelPerTick * fuelEfficiencyBonus
    };
}

/**
 * Moves fleet towards its destination.
 */
function handleFleetMovement(fleet: Fleet, state: GameState, empire: Empire, dt: number) {
    if (!fleet.destination) return;

    const dx = fleet.destination.x - fleet.position.x;
    const dy = fleet.destination.y - fleet.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const { fleetSpeed, fuelPerTick } = getFleetStats(fleet, state, empire);
    const days = dt / 86400;
    const fuelConsumed = fuelPerTick * days;

    const outOfFuel = false;
    for (const sid of fleet.shipIds) {
        const s = state.ships[sid];
        if (s) {
            const actualConsumed = Math.min(s.fuel, fuelConsumed);
            s.fuel = Math.max(0, s.fuel - actualConsumed);
            state.stats.totalConsumed['Fuel'] = (state.stats.totalConsumed['Fuel'] || 0) + actualConsumed;
        }
    }

    const currentSpeed = outOfFuel ? fleetSpeed * 0.1 : fleetSpeed;
    const travelDist = currentSpeed * days;

    if (dist <= travelDist) {
        fleet.position.x = fleet.destination.x;
        fleet.position.y = fleet.destination.y;
        fleet.destination = undefined;

        // Orbit lock
        const star = state.galaxy.stars[fleet.currentStarId];
        if (star) {
            for (const p of star.planets) {
                const pPos = getPlanetPosition(p, state.turn);
                if (distance(fleet.position, pPos) < 0.1) {
                    fleet.orbitingPlanetId = p.id;
                    break;
                }
            }
        }
    } else {
        const ratio = travelDist / dist;
        fleet.position.x += dx * ratio;
        fleet.position.y += dy * ratio;
    }
}

/**
 * Checks if an idle fleet can refuel at a spaceport.
 */
function checkFleetRefueling(fleet: Fleet, state: GameState, empire: Empire) {
    if (fleet.destination || fleet.orders.length > 0) return;

    const star = state.galaxy.stars[fleet.currentStarId];
    if (!star) return;

    for (const p of star.planets) {
        const col = Object.values(state.colonies).find(c => c.planetId === p.id && c.empireId === fleet.empireId);
        if (col && col.spaceport) {
            const pPos = getPlanetPosition(p, state.turn);
            if (distance(fleet.position, pPos) < 2.0) {
                for (const sid of fleet.shipIds) {
                    const s = state.ships[sid];
                    if (!s) continue;
                    const design = empire.designLibrary.find(d => d.id === s.designId);
                    if (design) {
                        const needed = design.fuelCapacity - s.fuel;
                        const available = col.minerals['Fuel'] || 0;
                        const toTake = Math.min(needed, available);
                        if (toTake > 0) {
                            s.fuel += toTake;
                            col.minerals['Fuel'] = available - toTake;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main fleet engine tick.
 */
export function tickFleets(state: GameState, dt: number, rng: RNG): GameEvent[] {
    const events: GameEvent[] = [];

    // Flatten fleets into a single list for processing
    const allFleets = Object.values(state.empires).flatMap(e => e.fleets);

    for (const fleet of allFleets) {
        const empire = state.empires[fleet.empireId];
        if (!empire) continue;

        // 1. Maintenance & GC (Filter out empty/dead fleets)
        if (handleFleetMaintenance(fleet, empire)) continue;

        // 2. Orbital Tracking (Update position if in orbit)
        handleFleetOrbit(fleet, state);

        // 2b. Logistics (Unload Aether to colony)
        handleFleetLogistics(fleet, state);

        // 3. Order Processing (Check if new orders can be started)
        processFleetOrders(fleet, state, empire, events, rng);

        // 4. Movement Execution (Progress towards destination)
        handleFleetMovement(fleet, state, empire, dt);

        // 5. Refueling (If idle near a colony with a spaceport)
        checkFleetRefueling(fleet, state, empire);
    }

    return events;
}

/**
 * Automatically unloads raw Aether from ships in a fleet to an orbiting colony.
 */
function handleFleetLogistics(fleet: Fleet, state: GameState) {
    if (!fleet.orbitingPlanetId) return;

    const colony = Object.values(state.colonies).find(c => c.planetId === fleet.orbitingPlanetId && c.empireId === fleet.empireId);
    if (!colony) return;

    for (const sid of fleet.shipIds) {
        const ship = state.ships[sid];
        if (!ship || !ship.cargo) continue;

        const aetherAmount = ship.cargo['Aether'] || 0;
        if (aetherAmount > 0) {
            colony.minerals['Aether'] = (colony.minerals['Aether'] || 0) + aetherAmount;
            delete ship.cargo['Aether'];
            if (ship.inventory) {
                ship.inventory = ship.inventory.filter(i => i.res !== 'Aether');
            }
        }
    }
}
