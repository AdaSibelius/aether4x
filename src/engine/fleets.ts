import type { GameState, GameEvent, Fleet, Ship, Vec2, Empire, Star, Planet, Colony, ShipOrder, ShipComponent } from '../types';
import { RNG } from '../utils/rng';
import { makeEvent } from './events';
import { getAdmiralBonuses } from './officers';
import { getEmpireTechBonuses } from './research';
import { generateId } from '../utils/id';
import { BALANCING } from './constants';
import {
    transferWithLedger,
    createTreasuryAccount,
    createColonyPrivateWealthAccount,
    createCompanyAccount,
    MonetaryAccount,
    createExternalAccount,
} from './economy_ledger';
import { resolveFleetCombat, rechargeShields } from './combat';

type FeeCategory = 'MigrationFee' | 'TransportFee';
type FeePayerAccount = MonetaryAccount;

function getIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function recordCashflow(
    state: GameState,
    category: FeeCategory,
    description: string,
    amount: number,
    debitAccount: string,
    creditAccount: string,
    status: 'Settled' | 'Partial' | 'DebtRecorded',
    metadata?: Record<string, string | number>
) {
    if (!state.stats.cashflowLedger) state.stats.cashflowLedger = [];
    state.stats.cashflowLedger.push({
        id: generateId('cashflow', new RNG(state.turn + state.seed + state.stats.cashflowLedger.length + 1)),
        date: getIsoDate(state.date),
        category,
        description,
        amount,
        debitAccount,
        creditAccount,
        status,
        metadata,
    });
}

/**
 * Policy: fees are best-effort. We debit payer accounts in priority order
 * (destination colony private wealth -> origin colony private contracts budget -> empire treasury subsidy).
 * If funds are insufficient, we execute the service and pay the carrier partially, then record unpaid
 * amount as debt in the shared cashflow ledger for later auditing.
 */
function settleFreightFee(params: {
    state: GameState;
    empire: Empire;
    company: Empire['companies'][number];
    fee: number;
    category: FeeCategory;
    description: string;
    payerAccounts: FeePayerAccount[];
    metadata?: Record<string, string | number>;
    rng: RNG;
}) {
    const { state, empire, company, fee, category, description, payerAccounts, metadata, rng } = params;
    if (fee <= 0) return { paid: 0, unpaid: 0 };

    let remaining = fee;
    let paid = 0;

    const companyAccount = createCompanyAccount(company);
    const reason = category === 'MigrationFee' ? 'MIGRATION_FEE' : 'FREIGHT_FEE';

    for (const payer of payerAccounts) {
        if (remaining <= 0) break;
        const available = Math.max(0, payer.getBalance());
        const contribution = Math.min(available, remaining);
        if (contribution <= 0) continue;

        const { settled } = transferWithLedger(
            state,
            payer,
            companyAccount,
            contribution,
            reason as any, // Cast to any to avoid strict reason code check if necessary, or ensure codes match
            { ...metadata, reasonDetail: `${category}: ${description}` },
            rng
        );

        if (settled <= 0) continue;

        paid += settled;
        remaining -= settled;

        recordCashflow(
            state,
            category,
            description,
            settled,
            payer.label,
            `Company:${company.name} (${company.id})`,
            remaining > 0 ? 'Partial' : 'Settled',
            metadata
        );
    }

    if (remaining > 0) {
        recordCashflow(
            state,
            category,
            `${description} (unfunded debt)`,
            remaining,
            `Debt:${empire.name} freight payable`,
            `Company:${company.name} (${company.id})`,
            'DebtRecorded',
            metadata
        );
    }

    if (!company.transactions) company.transactions = [];
    if (paid > 0) {
        company.transactions.push({
            date: getIsoDate(state.date),
            amount: paid,
            type: 'Revenue',
            description: `${description}${remaining > 0 ? ' (partial settlement)' : ''}`,
        });
    }

    return { paid, unpaid: remaining };
}

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
            if (s.fuel <= 0 && fleet.empireId !== 'empire_pirates') outOfFuel = true;
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
        timeToInterceptDays = Math.min(dist / fleetSpeedAuPerDay, 14);
        targetPos = getPlanetPosition(planet, currentTurn + timeToInterceptDays * 86400);
    }

    return targetPos;
}

export function calculateFleetInterceptPosition(fleetPos: Vec2, fleetSpeedAuPerDay: number, targetFleet: Fleet, state: GameState): Vec2 {
    let targetPos = targetFleet.position;
    if (fleetSpeedAuPerDay <= 0) return targetPos;

    if (!targetFleet.destination && !targetFleet.orbitingPlanetId) {
        return targetPos; // Target is completely stationary
    }

    const maxIterations = 5;
    let timeToInterceptDays = 0;

    for (let i = 0; i < maxIterations; i++) {
        const dist = distance(fleetPos, targetPos);
        timeToInterceptDays = Math.min(dist / fleetSpeedAuPerDay, 14);

        if (targetFleet.orbitingPlanetId) {
            // Target is orbiting a moving planet, use planetary orbit prediction
            const star = state.galaxy.stars[targetFleet.currentStarId];
            if (star) {
                const planet = star.planets.find(p => p.id === targetFleet.orbitingPlanetId);
                if (planet) {
                    targetPos = getPlanetPosition(planet, state.turn + (timeToInterceptDays * 86400));
                }
            }
        } else if (targetFleet.destination) {
            // Target is moving in a straight line to a system destination
            const targetSpeedAuPerDay = getFleetSpeed(targetFleet, state);
            if (targetSpeedAuPerDay <= 0) return targetPos;

            const targetDistToDest = distance(targetFleet.position, targetFleet.destination);
            const targetTravelDist = targetSpeedAuPerDay * timeToInterceptDays;

            if (targetDistToDest <= targetTravelDist) {
                targetPos = targetFleet.destination; // Target will reach its destination before we intercept
            } else {
                const ratio = targetTravelDist / targetDistToDest;
                const dx = targetFleet.destination.x - targetFleet.position.x;
                const dy = targetFleet.destination.y - targetFleet.position.y;
                targetPos = {
                    x: targetFleet.position.x + dx * ratio,
                    y: targetFleet.position.y + dy * ratio
                };
            }
        }
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
 * Processes the current order for a fleet.
 * Most orders only process when idle (no active destination).
 * Attack orders are special: they run every tick to continuously update their intercept course.
 */
function processFleetOrders(fleet: Fleet, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    if (!fleet.orders || fleet.orders.length === 0) return;

    const order = fleet.orders[0];

    // Attack orders must run every tick to continuously recalculate the intercept course.
    // All other orders only trigger when the fleet is idle (no active destination).
    if (order.type === 'Attack') {
        processAttackOrder(fleet, order, state, empire, events, rng);
        return;
    }

    if (fleet.destination) return; // Other orders wait until fleet arrives

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

/**
 * Handles an Attack order: move to intercept the target fleet and engage at range.
 * The fleet will pursue the target until it is destroyed or the order is cancelled.
 */
function processAttackOrder(fleet: Fleet, order: ShipOrder, state: GameState, empire: Empire, events: GameEvent[], rng: RNG) {
    if (!order.targetFleetId) {
        fleet.orders.shift();
        return;
    }

    // Find target fleet across all empires
    let targetFleet = Object.values(state.empires)
        .flatMap(e => e.fleets)
        .find(f => f.id === order.targetFleetId);

    if (!targetFleet || targetFleet.shipIds.length === 0) {
        // Target destroyed or gone — find the next enemy in this star system
        fleet.combatTargetFleetId = undefined;

        const nextTarget = Object.values(state.empires)
            .filter(e => e.id !== fleet.empireId)
            .flatMap(e => e.fleets)
            .filter(f => f.currentStarId === fleet.currentStarId && f.shipIds.length > 0)
            .sort((a, b) => {
                const da = Math.hypot(a.position.x - fleet.position.x, a.position.y - fleet.position.y);
                const db = Math.hypot(b.position.x - fleet.position.x, b.position.y - fleet.position.y);
                return da - db;
            })[0];

        if (nextTarget) {
            // Re-use the same Attack order slot, just swap the target
            order.targetFleetId = nextTarget.id;
            targetFleet = nextTarget;
            events.push(makeEvent(state.turn, state.date, 'CombatEngagement',
                `Fleet "${fleet.name}" re-targeting ${nextTarget.name}.`,
                rng, { fleetId: fleet.id, empireId: fleet.empireId }
            ));
        } else {
            fleet.orders.shift();
            events.push(makeEvent(state.turn, state.date, 'CombatResult',
                `Fleet "${fleet.name}" has no remaining targets. Engagement complete.`,
                rng, { fleetId: fleet.id, empireId: fleet.empireId, important: true }
            ));
        }
        return;
    }

    // Can only engage fleets in the same star system
    if (targetFleet.currentStarId !== fleet.currentStarId) {
        fleet.orders.shift();
        return;
    }

    // Calculate max weapon range from this fleet
    let maxRange = 0;
    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;
        for (const weapon of design.weaponSystems) {
            maxRange = Math.max(maxRange, weapon.stats.range ?? 0);
        }
    }

    const dx = targetFleet.position.x - fleet.position.x;
    const dy = targetFleet.position.y - fleet.position.y;
    const currentDist = Math.sqrt(dx * dx + dy * dy);

    // Only mark as active combat target when actually within weapon range.
    // This prevents the combat line appearing during transit.
    if (currentDist <= maxRange) {
        fleet.combatTargetFleetId = targetFleet.id;
    } else {
        fleet.combatTargetFleetId = undefined;
    }

    // Speed and intercept calculations
    const speed = getFleetSpeed(fleet, state);
    const interceptPos = calculateFleetInterceptPosition(fleet.position, speed, targetFleet, state);

    const dxIntercept = interceptPos.x - fleet.position.x;
    const dyIntercept = interceptPos.y - fleet.position.y;
    const interceptDist = Math.sqrt(dxIntercept * dxIntercept + dyIntercept * dyIntercept);

    // Follow at 80% of maxRange distance to ensure the fleet stays within weapon range
    // even if the target moves slightly away during the same tick.
    const followDist = Math.max(0.001, (order.engagementRange ?? maxRange) * 0.8);

    if (interceptDist > followDist) {
        // Move to intercept continuously tracking projected target position
        const ratio = (interceptDist - followDist) / interceptDist;
        fleet.destination = {
            x: fleet.position.x + dxIntercept * ratio,
            y: fleet.position.y + dyIntercept * ratio,
            etaSeconds: ((interceptDist - followDist) / speed) * 86400
        };
        fleet.orbitingPlanetId = undefined;
    } else {
        // Within weapon range — clear destination, hold position and let combat resolve
        fleet.destination = undefined;
        fleet.orbitingPlanetId = undefined;
    }
    // Combat resolution happens in the separate combat pass in tickFleets (below)
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

                        const departureCost = actualLoaded * 200;
                        if (departureCost > 0) {
                            transferWithLedger(state, createColonyPrivateWealthAccount(colony), createExternalAccount('migration_departure'), departureCost, 'MIGRATION_FEE', { colonyId: colony.id, type: 'migration_departure' }, rng);
                        }
                    }
                }
            } else if (order.cargoAction === 'Unload') {
                if (colony && (colony.spaceport > 0 || colony.migrationMode === 'Target')) {
                    const firstShip = state.ships[fleet.shipIds[0]];
                    const sourceColonyId = order.originId || firstShip?.inventory?.find(i => i.res === 'Civilians')?.originId;
                    const sourceColony = sourceColonyId ? state.colonies[sourceColonyId] : undefined;

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

                        // Pay the company (best-effort settlement + ledger)
                        const company = empire.companies.find(c => c.id === firstShip?.sourceCompanyId);
                        if (company) {
                            const fee = totalUnloaded * 500; // 500 wealth per million colonists
                            const result = settleFreightFee({
                                state,
                                empire,
                                company,
                                fee,
                                category: 'MigrationFee',
                                description: `Migration fee for ${totalUnloaded.toFixed(2)}M colonists to ${colony.name}`,
                                payerAccounts: [
                                    createColonyPrivateWealthAccount(colony),
                                    ...(sourceColony ? [createColonyPrivateWealthAccount(sourceColony)] : []),
                                    createTreasuryAccount(empire),
                                ],
                                metadata: {
                                    fleetId: fleet.id,
                                    targetColonyId: colony.id,
                                    sourceColonyId: sourceColony?.id || 'unknown',
                                    amountMovedM: totalUnloaded,
                                },
                                rng,
                            });

                            if (result.unpaid > 0) {
                                events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                                    `Migration service for fleet "${fleet.name}" was only partially funded (${result.paid.toFixed(0)}W paid / ${result.unpaid.toFixed(0)}W debt recorded).`, rng));
                            }
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
                if (colony) {
                    const firstShip = state.ships[fleet.shipIds[0]];
                    const sourceColonyId = order.originId || firstShip?.inventory?.find(i => i.res === res)?.originId;
                    const sourceColony = sourceColonyId ? state.colonies[sourceColonyId] : undefined;

                    let totalUnloaded = 0;
                    for (const sid of fleet.shipIds) {
                        const s = state.ships[sid];
                        if (!s || !s.cargo || !s.cargo[res]) continue;
                        const has = s.cargo[res];
                        const toUnload = Math.min(amt - totalUnloaded, has);
                        s.cargo[res] -= toUnload;

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

                        // Pay the company (best-effort settlement + ledger)
                        const company = empire.companies.find(c => c.id === firstShip?.sourceCompanyId);
                        if (company) {
                            const fee = totalUnloaded * 0.5; // 0.5 wealth per ton
                            const result = settleFreightFee({
                                state,
                                empire,
                                company,
                                fee,
                                category: 'TransportFee',
                                description: `Transport fee for ${Math.floor(totalUnloaded)}t of ${res} to ${colony.name}`,
                                payerAccounts: [
                                    createColonyPrivateWealthAccount(colony),
                                    ...(sourceColony ? [createColonyPrivateWealthAccount(sourceColony)] : []),
                                    createTreasuryAccount(empire),
                                ],
                                metadata: {
                                    fleetId: fleet.id,
                                    resource: res,
                                    amountMovedTons: totalUnloaded,
                                    targetColonyId: colony.id,
                                    sourceColonyId: sourceColony?.id || 'unknown',
                                },
                                rng,
                            });

                            if (result.unpaid > 0) {
                                events.push(makeEvent(state.turn, state.date, 'CivilianExpansion',
                                    `Transport service for fleet "${fleet.name}" was only partially funded (${result.paid.toFixed(0)}W paid / ${result.unpaid.toFixed(0)}W debt recorded).`, rng));
                            }
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
    const fuelEfficiencyBonus = 1 - (techBonuses.fuel_efficiency ?? 0);

    let baseSpeed = 0.5;
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

    const isPirate = fleet.empireId === 'empire_pirates';
    const outOfFuel = !isPirate && fleet.shipIds.some(sid => state.ships[sid]?.fuel <= 0);
    for (const sid of fleet.shipIds) {
        const s = state.ships[sid];
        if (s && !isPirate) {
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
    const allFleets = Object.values(state.empires).flatMap(e => e.fleets);

    // ── Phase 1: Orders & Movement ──
    for (const fleet of allFleets) {
        const empire = state.empires[fleet.empireId];
        if (!empire) continue;

        if (handleFleetMaintenance(fleet, empire)) continue;
        handleFleetOrbit(fleet, state);
        handleFleetLogistics(fleet, state);
        processFleetOrders(fleet, state, empire, events, rng);
        handleFleetMovement(fleet, state, empire, dt);
        checkFleetRefueling(fleet, state, empire);

        // Shield recharge each tick
        rechargeShields(fleet, state, dt);
    }

    // ── Phase 2: Combat Resolution ──
    // Performance: bucket by star system to avoid O(N²) across all fleets
    const fleetsByStar: Record<string, Fleet[]> = {};
    for (const fleet of allFleets) {
        if (fleet.shipIds.length === 0) continue;
        if (!fleetsByStar[fleet.currentStarId]) fleetsByStar[fleet.currentStarId] = [];
        fleetsByStar[fleet.currentStarId].push(fleet);
    }

    for (const starFleets of Object.values(fleetsByStar)) {
        if (starFleets.length < 2) continue;

        // Only resolve combat for fleets that have an active Attack order targeting a fleet in this star
        for (const fleet of starFleets) {
            if (!fleet.combatTargetFleetId) continue;

            const targetFleet = starFleets.find(f => f.id === fleet.combatTargetFleetId);
            if (!targetFleet) {
                fleet.combatTargetFleetId = undefined;
                continue;
            }

            // Only empires that are not the same empire fight
            if (fleet.empireId === targetFleet.empireId) continue;

            const dx = targetFleet.position.x - fleet.position.x;
            const dy = targetFleet.position.y - fleet.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            resolveFleetCombat(fleet, targetFleet, dist, state, dt, rng, events);
        }
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
