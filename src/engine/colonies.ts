import type { GameState, Colony, GameEvent, EventType, SpeciesId, ColonySnapshot, Empire, ShipComponent } from '@/types';
import { getGovernorBonuses } from './officers';
import { BALANCING } from './constants';
import SimLogger from '@/utils/logger';
import { generateId } from '@/utils/id';
import { getPlanetPosition } from './fleets';
import { SPECIES, computeHabitability, getSpeciesGrowthMod, getAtmosphereHabitabilityMod } from './species';

export const COLONY_TYPE_BONUS: Record<string, Record<string, number>> = {
    Core: { industry: 1.0, mining: 1.0, research: 1.0 },
    Mining: { industry: 0.8, mining: 1.5, research: 0.8 },
    Research: { industry: 0.8, mining: 0.8, research: 1.5 },
    Military: { industry: 1.2, mining: 1.0, research: 0.7 },
    Agricultural: { industry: 0.9, mining: 0.9, research: 0.9 },
};

export const STRUCTURE_BP_COST: Record<string, number> = {
    Factory: 1200,
    Mine: 800,
    ResearchLab: 1500,
    Shipyard: 5000,
    GroundDefense: 600,
    Spaceport: 3000,
    Infrastructure: 400,
    Terraformer: 2500,
    ConstructionOffice: 1000,
    ShipyardExpansion_Slipway: 8000,
    ShipyardExpansion_Tonnage: 4000,
};

export const STRUCTURE_MINERAL_COST: Record<string, Record<string, number>> = {
    Factory: { Iron: 200 },
    Mine: { Iron: 100, Copper: 50 },
    ResearchLab: { Iron: 150, Platinum: 100 },
    Shipyard: { Iron: 800, Titanium: 400 },
    GroundDefense: { Iron: 100 },
    Spaceport: { Iron: 500, Copper: 200 },
    Infrastructure: { Iron: 60 },
    Terraformer: { Iron: 400, Titanium: 200, Ambergris: 100 },
    AethericDistillery: { Iron: 400, Titanium: 200, Ambergris: 100 },
    ConstructionOffice: { Iron: 150, Platinum: 50 },
    ShipyardExpansion_Slipway: { Iron: 1200, Titanium: 600 },
    ShipyardExpansion_Tonnage: { Iron: 800, Titanium: 400 },
};

import { makeEvent } from './events';

function processColonyInfrastructure(colony: Colony, govBonuses: Record<string, number>, constructionBP: number, days: number): void {
    const decay = BALANCING.INFRA_DECAY_RATE;
    const kit = BALANCING.INFRA_REPAIR_KIT ?? 0.1;
    const repair = kit + constructionBP * BALANCING.INFRA_REPAIR_FACTOR * (1 + (govBonuses.infra_growth ?? 0));

    colony.infrastructure = Math.min(10000, Math.max(0,
        colony.infrastructure - decay * days + repair * days
    ));
}

function updateColonyPopulation(colony: Colony, policyGrowthMod: number, agricultureGrowthMod: number, happinessMod: number, days: number, habitability: number = 1.0): void {
    const basePop = (BALANCING.BASE_HABITABLE_POP ?? 10) * habitability;
    const maxPop = basePop + (colony.infrastructure * BALANCING.INFRA_POP_SUPPORT / 100);
    colony.maxPopulation = maxPop; // Keep in sync
    const capacityMod = 1 - (colony.population / maxPop);

    if (capacityMod < 0) {
        colony.happiness = Math.max(0, colony.happiness + (capacityMod * 10 * days));
    }

    if (colony.populationSegments && colony.populationSegments.length > 0) {
        for (const seg of colony.populationSegments) {
            const speciesMod = getSpeciesGrowthMod(seg.speciesId);
            const segHappinessMod = seg.happiness > 70 ? 1.1 : seg.happiness < 30 ? 0.95 : 1.0;
            const annualGrowth = seg.count * colony.populationGrowthRate
                * policyGrowthMod * segHappinessMod * speciesMod * seg.habitability * agricultureGrowthMod;

            const capacityAdjustedAnnual = capacityMod >= 0
                ? annualGrowth * capacityMod
                : (seg.count * capacityMod * BALANCING.POP_DIE_OFF_RATE);

            seg.count = Math.max(0.01, seg.count + (capacityAdjustedAnnual / 365) * days);
        }
        colony.population = colony.populationSegments.reduce((sum, s) => sum + s.count, 0);
    } else {
        const annualGrowth = colony.population * colony.populationGrowthRate * policyGrowthMod * happinessMod * agricultureGrowthMod;
        const capacityAdjustedAnnual = capacityMod >= 0
            ? annualGrowth * capacityMod
            : (colony.population * capacityMod * BALANCING.POP_DIE_OFF_RATE);

        colony.population = Math.max(0.1, colony.population + (capacityAdjustedAnnual / 365) * days);
    }
}

function simulateColonyEconomy(colony: Colony, planet: any, infraEff: number, days: number): number {
    const baseCommerceW = (colony.laborAllocation.commerce ?? 0) / 100 * colony.population;
    const habMod = planet ? getAtmosphereHabitabilityMod(planet) : 0.1;

    const commerceGoods = baseCommerceW * BALANCING.COMMERCE_YIELD_BASE * infraEff * habMod * days;
    const civilianGoods = colony.civilianFactories * BALANCING.CIVILIAN_FACTORY_TG * infraEff * days;
    const goodsProduced = commerceGoods + civilianGoods;

    colony.minerals['TradeGoods'] = (colony.minerals['TradeGoods'] || 0) + goodsProduced;

    const goodsNeeded = colony.population * BALANCING.POP_CONSUMPTION_RATE * days;
    const availableGoods = colony.minerals['TradeGoods'] || 0;
    const consumedGoods = Math.min(availableGoods, goodsNeeded);

    colony.minerals['TradeGoods'] = availableGoods - consumedGoods;

    if (availableGoods < goodsNeeded) {
        colony.demand['TradeGoods'] = (colony.demand['TradeGoods'] || 0) + (goodsNeeded - availableGoods);
        colony.happiness -= 1 * days;
    } else {
        colony.happiness += 0.5 * days;
    }

    return consumedGoods;
}

function processAetherDistillation(colony: Colony, stats: any, infraEff: number, days: number): number {
    const distillers = colony.aethericDistillery || 0;
    if (distillers <= 0) return 0;

    const rawAether = colony.minerals['Aether'] || 0;
    if (rawAether <= 0) return 0;

    const processRate = distillers * BALANCING.DISTILLERY_THROUGHPUT * infraEff * days;
    const amountToProcess = Math.min(rawAether, processRate);

    colony.minerals['Aether'] = rawAether - amountToProcess;
    const fuelProduced = amountToProcess * BALANCING.DISTILLATION_EFFICIENCY;
    colony.minerals['Fuel'] = (colony.minerals['Fuel'] || 0) + fuelProduced;

    if (stats) {
        stats.totalConsumed['Aether'] = (stats.totalConsumed['Aether'] || 0) + amountToProcess;
        stats.totalProduced['Fuel'] = (stats.totalProduced['Fuel'] || 0) + fuelProduced;
        stats.totalConverted['Aether_to_Fuel'] = (stats.totalConverted['Aether_to_Fuel'] || 0) + amountToProcess;
    }

    return amountToProcess;
}

export function tickColony(colony: Colony, state: GameState, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    // Reset rates for the new tick
    colony.lastMineralRates = {};
    const days = dt / 86400;
    const bonus = COLONY_TYPE_BONUS[colony.colonyType] ?? COLONY_TYPE_BONUS.Core;

    // Infrastructure redefined: Basic life support + habitat
    colony.maxPopulation = 10 + (colony.infrastructure * BALANCING.INFRA_POP_SUPPORT / 100);

    const infraEff = 0.5 + (colony.infrastructure / 100) * 0.5;
    const empire = state.empires[colony.empireId];
    const govBonuses = getGovernorBonuses(empire?.officers || [], colony.governorId);
    const prodBonus = 1 + (govBonuses.all_production ?? 0);

    const planet = Object.values(state.galaxy.stars).flatMap(s => s.planets).find(p => p.id === colony.planetId);

    // ── Habitability & Population Refresh ──
    if (planet && colony.populationSegments) {
        for (const seg of colony.populationSegments) {
            const speciesDef = SPECIES[seg.speciesId];
            if (speciesDef) {
                seg.habitability = computeHabitability(speciesDef, planet as any);
            }
        }
    }

    // ── Labor Model ──
    const requiredPublicLabor =
        colony.factories * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FACTORY +
        colony.mines * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_MINE +
        colony.researchLabs * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_RESEARCH_LAB +
        colony.shipyards.length * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SHIPYARD +
        (colony.spaceport ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SPACEPORT : 0) +
        colony.groundDefenses * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_GROUND_DEFENSE +
        colony.constructionOffices * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CONSTRUCTION_OFFICE +
        (colony.aethericDistillery ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_DISTILLERY +
        (colony.logisticsHubs ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_LOGISTICS_HUB +
        (colony.factories > 0 && colony.terraformProgress < 100 ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_TERRAFORMER : 0);

    const companiesOnColony = (empire?.companies || []).filter(c => c.homeColonyId === colony.id).length;
    const requiredPrivateLabor =
        colony.civilianFactories * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_FACTORY +
        colony.civilianMines * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_MINE +
        companiesOnColony * BALANCING.EMPLOYMENT.OFFICE_WORKERS_PER_CORP;

    const requiredAgriLabor = (colony.farms ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FARM;
    const requiredServiceLabor = (colony.commercialCenters ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_COMMERCIAL_CENTER;
    const totalRequiredLabor = requiredPublicLabor + requiredPrivateLabor + requiredAgriLabor + requiredServiceLabor;

    const baselineStaffing = totalRequiredLabor > 0 ? Math.min(1.0, colony.population / totalRequiredLabor) : 1.0;
    const hubBonus = (colony.logisticsHubs ?? 0) * 0.02; // 2% efficiency per hub
    const staffingLevel = (baselineStaffing * (colony.laborEfficiency ?? 1.0) * (1 + hubBonus)) || 0.001;
    colony.staffingLevel = staffingLevel;
    const unemploymentPct = colony.population > 0 ? Math.max(0, (colony.population - totalRequiredLabor) / colony.population) : 0;

    const constructionBP = colony.constructionOffices * BALANCING.EMPLOYMENT.CONSTRUCTION_BP_PER_OFFICE * staffingLevel;

    processColonyInfrastructure(colony, govBonuses, constructionBP, days);

    let policyGrowthMod = 1.0;
    let policyHappinessBonus = 0;
    switch (colony.policy) {
        case 'Encourage Growth': policyGrowthMod = 1.5; policyHappinessBonus = -10; break;
        case 'Population Control': policyGrowthMod = 0.0; policyHappinessBonus = 15; break;
        case 'Forced Labor': policyGrowthMod = 0.8; policyHappinessBonus = -30; break;
    }

    const unemploymentPenalty = unemploymentPct * 15;
    const avgHabitability = (colony.populationSegments && colony.populationSegments.length > 0 && colony.population > 0)
        ? colony.populationSegments.reduce((sum, s) => sum + (s.habitability || 0) * s.count, 0) / colony.population : 1.0;

    const happinessMod = colony.happiness > 70 ? 1.1 : colony.happiness < 30 ? 0.95 : 1.0;
    const agricultureGrowthMod = 1.0 + (staffingLevel * 0.1);
    updateColonyPopulation(colony, policyGrowthMod, agricultureGrowthMod, happinessMod, days, avgHabitability);

    // --- Food Production & Consumption ---
    const foodProduced = (colony.farms ?? 0) * BALANCING.FARM_YIELD_BASE * staffingLevel * days;
    colony.minerals.Food = (colony.minerals.Food || 0) + foodProduced;
    state.stats.totalProduced['Food'] = (state.stats.totalProduced['Food'] || 0) + foodProduced;

    const foodTarget = (colony.population * BALANCING.FOOD_CONSUMPTION_RATE * days);
    let foodShortage = 0;
    if (colony.minerals.Food >= foodTarget) {
        colony.minerals.Food -= foodTarget;
        state.stats.totalConsumed['Food'] = (state.stats.totalConsumed['Food'] || 0) + foodTarget;
    } else {
        foodShortage = foodTarget - colony.minerals.Food;
        state.stats.totalConsumed['Food'] = (state.stats.totalConsumed['Food'] || 0) + colony.minerals.Food;
        colony.minerals.Food = 0;
        colony.demand.Food = (colony.demand.Food || 0) + foodShortage;
    }

    const faminePct = foodTarget > 0 ? foodShortage / foodTarget : 0;
    if (faminePct > 0) {
        const dieOff = colony.population * BALANCING.FAMINE_DIE_OFF_RATE * faminePct;
        colony.population -= dieOff;
        colony.happiness -= faminePct * 5 * days; // Heavy happiness penalty
    }

    processAetherDistillation(colony, state.stats, infraEff, days);

    const targetHappiness = 60 + (avgHabitability - 0.5) * 30 + (colony.infrastructure - 50) * 0.3 - (colony.population > colony.maxPopulation * 0.9 ? 10 : 0) + (colony.spaceport ? 5 : 0) + (govBonuses.happiness ? govBonuses.happiness * 100 : 0) - unemploymentPenalty + policyHappinessBonus;
    colony.happiness += (targetHappiness - colony.happiness) * 0.01 * days;
    colony.happiness = Math.max(0, Math.min(100, colony.happiness));

    if (colony.terraformProgress < 100) {
        const tfRate = constructionBP * BALANCING.TP_PER_TERRAFORMER;
        colony.terraformProgress = Math.min(100, colony.terraformProgress + tfRate * days);
        if (colony.terraformProgress >= 100) {
            events.push(makeEvent(state.turn, state.date, 'ResearchComplete',
                `Research complete: ${colony.name} terraforming`, { important: true }));
        }
    }

    const factoryBonus = 1 + (govBonuses.factory_output ?? 0);
    // Base industrial capacity (Colonization Kit + Population Labor)
    const baseIndustrialBP = 5 + (colony.population * 0.5) * (colony.laborAllocation.industry / 100);
    const bpPerDay = (colony.factories * BALANCING.BP_PER_FACTORY + baseIndustrialBP) * staffingLevel * bonus.industry * infraEff * factoryBonus * prodBonus;

    if (colony.productionQueue.length > 0) {
        const item = colony.productionQueue[0];
        const totalBpNeeded = item.bpCostPerUnit * item.quantity;
        let bpAppliedTarget = Math.min(bpPerDay * days, totalBpNeeded * (1 - item.progress / 100));

        if (bpAppliedTarget > 0) {
            let fractionOfJob = bpAppliedTarget / totalBpNeeded;
            if (item.costPerUnit) {
                for (const [res, cost] of Object.entries(item.costPerUnit)) {
                    if (cost > 0) {
                        const needed = cost * item.quantity * fractionOfJob;
                        const avail = colony.minerals[res] || 0;
                        if (avail < needed) {
                            fractionOfJob = Math.min(fractionOfJob, avail / (cost * item.quantity));
                            colony.demand[res] = (colony.demand[res] || 0) + (needed - avail);
                        }
                    }
                }
                for (const [res, cost] of Object.entries(item.costPerUnit)) {
                    if (cost > 0) {
                        const amount = cost * item.quantity * fractionOfJob;
                        colony.minerals[res] = Math.max(0, (colony.minerals[res] || 0) - amount);
                        colony.lastMineralRates![res] = (colony.lastMineralRates![res] || 0) - (amount / days);
                        state.stats.totalConsumed[res] = (state.stats.totalConsumed[res] || 0) + amount;
                    }
                }
            }
            item.progress = Math.min(100, item.progress + fractionOfJob * 100);
        }

        if (item.progress >= 99.99) {
            colony.productionQueue.shift();
            switch (item.type) {
                case 'Factory': colony.factories += item.quantity; break;
                case 'Mine': colony.mines += item.quantity; break;
                case 'ResearchLab': colony.researchLabs += item.quantity; break;
                case 'GroundDefense': colony.groundDefenses += item.quantity; break;
                case 'Spaceport': colony.spaceport = (colony.spaceport || 0) + 1; break;
                case 'Infrastructure': colony.infrastructure = Math.min(100, colony.infrastructure + item.quantity * 5); break;
                case 'Shipyard': colony.shipyards.push({ id: generateId('sy'), name: `${colony.name} Shipyard ${colony.shipyards.length + 1}`, slipways: 1, maxTonnage: 5000, activeBuilds: [] }); break;
                case 'ShipyardExpansion_Slipway':
                    if (colony.shipyards.length > 0) {
                        const targetShipyard = colony.shipyards.find(sy => sy.id === item.targetId);
                        if (targetShipyard) {
                            targetShipyard.slipways += item.quantity;
                        } else {
                            colony.shipyards[0].slipways += item.quantity; // Fallback to first shipyard
                        }
                    }
                    break;
                case 'ShipyardExpansion_Tonnage':
                    if (colony.shipyards.length > 0) {
                        const targetShipyard = colony.shipyards.find(sy => sy.id === item.targetId);
                        if (targetShipyard) {
                            targetShipyard.maxTonnage += item.quantity * 5000;
                        } else {
                            colony.shipyards[0].maxTonnage += item.quantity * 5000; // Fallback to first shipyard
                        }
                    }
                    break;
                case 'Ship':
                    // Ship construction is now handled by the shipyard's activeBuilds queue
                    // This case should ideally not be reached if ships are only built via shipyards
                    // For now, if it somehow gets here, we'll log an error or ignore.
                    console.warn(`Ship item found in global production queue for ${colony.name}. Should be in shipyard queue.`);
                    break;
                case 'AethericDistillery':
                    colony.aethericDistillery += item.quantity;
                    break;
            }
            events.push(makeEvent(state.turn, state.date, 'ProductionComplete', `${colony.name}: Completed ${item.quantity}x ${item.name}`, { important: false }));
        }
    }

    // ── Shipyard Construction (Parallel) ──
    // For now let's assume shipyards use their own internal capacity or a share of the colony's industrial base.
    // In many 4X games, shipyards have their own capacity.
    // Let's use the colony industrial BP but divide it among all shipyards/slipways if they are active.

    // For now let's assume shipyards use their own internal capacity or a share of the colony's industrial base.
    // Calculate total available BP for shipyards: baseline per slipway + share of industrial BP
    const industrialShareBP = (bpPerDay ?? 0) * BALANCING.SHIPYARD_BP_ALLOCATION_FACTOR;
    let remainingShipyardBP = industrialShareBP + (colony.shipyards.length * 5); // 5 BP per day base

    for (const sy of colony.shipyards) {
        if (!sy.activeBuilds) sy.activeBuilds = []; // Repair state if missing
        if (sy.activeBuilds.length > 0) {
            const activeCount = sy.activeBuilds.length;
            const activeSlipways = Math.min(sy.slipways, activeCount);
            const bpPerSlipway = activeSlipways > 0 ? (remainingShipyardBP / colony.shipyards.length / activeSlipways) * days : 0;

            for (let i = 0; i < activeSlipways; i++) {
                const item = sy.activeBuilds[i];
                if (!item) continue;
                const design = empire?.designLibrary.find(d => d.id === item.designId);
                const hullSize = design ? (design.maxHullPoints * 10) : 0;

                // Tonnage check
                if (design && hullSize > sy.maxTonnage) {
                    SimLogger.warn('SYSTEM', `Shipyard ${sy.name} STALL: ${item.name} too large (${hullSize} > ${sy.maxTonnage})`);
                    continue;
                }
                const totalBpNeeded = item.bpCostPerUnit * item.quantity;
                let bpToApply = Math.min(bpPerSlipway, Math.max(0.1, totalBpNeeded * (1 - item.progress / 100)));

                if (bpToApply > 0) {
                    let fractionOfJob = bpToApply / totalBpNeeded;
                    SimLogger.debug('SYSTEM', `Shipyard ${sy.name}: ${item.name} totalBP: ${totalBpNeeded}, bpToApply: ${bpToApply.toFixed(2)}, progress: ${item.progress.toFixed(2)}%`);
                    if (item.costPerUnit) {
                        for (const [res, cost] of Object.entries(item.costPerUnit)) {
                            if (cost <= 0) continue;
                            const needed = cost * item.quantity * fractionOfJob;
                            const avail = colony.minerals[res] || 0;
                            if (avail < needed) {
                                SimLogger.warn('SYSTEM', `Shipyard ${sy.name} STALL: ${item.name} missing ${res} (${avail.toFixed(1)} < ${needed.toFixed(1)})`);
                                fractionOfJob = Math.min(fractionOfJob, avail / (cost * item.quantity));
                            }
                        }
                        for (const [res, cost] of Object.entries(item.costPerUnit)) {
                            if (cost > 0) {
                                const amount = cost * item.quantity * fractionOfJob;
                                colony.minerals[res] = Math.max(0, (colony.minerals[res] || 0) - amount);
                                state.stats.totalConsumed[res] = (state.stats.totalConsumed[res] || 0) + amount;
                            }
                        }
                    }
                    item.progress = Math.min(100, item.progress + fractionOfJob * 100);

                    if (fractionOfJob > 0) {
                        SimLogger.debug('SYSTEM', `Shipyard ${sy.name}: Progressing ${item.name} by ${(fractionOfJob * 100).toFixed(4)}%`);
                    } else if (bpToApply > 0) {
                        SimLogger.debug('SYSTEM', `Shipyard ${sy.name}: ${item.name} stalled (Missing resources or tiny output)`);
                    }
                }

                if (item.progress >= 99.99) {
                    sy.activeBuilds.splice(i, 1);
                    i--; // Adjust index after splice

                    if (item.type === 'Ship' && item.designId && empire) {
                        const design = empire.designLibrary.find(d => d.id === item.designId);
                        if (design) {
                            for (let j = 0; j < item.quantity; j++) {
                                const shipId = generateId('ship');
                                state.ships[shipId] = {
                                    id: shipId,
                                    name: `${design.name} ${String.fromCharCode(65 + (j % 26))}`,
                                    designId: design.id,
                                    empireId: empire.id,
                                    hullPoints: design.maxHullPoints,
                                    maxHullPoints: design.maxHullPoints,
                                    fuel: design.fuelCapacity,
                                    experience: 0,
                                    cargo: {},
                                    inventory: [],
                                    sourceCompanyId: item.sourceCompanyId
                                };
                                state.stats.totalProduced['Fuel'] = (state.stats.totalProduced['Fuel'] || 0) + design.fuelCapacity;
                                const planet = Object.values(state.galaxy.stars).flatMap(s => s.planets).find(p => p.id === colony.planetId);
                                const parentStar = Object.values(state.galaxy.stars).find(s => s.planets.some(p => p.id === colony.planetId));

                                let isCivilian = false;
                                if (item.sourceCompanyId) {
                                    const company = empire.companies.find(c => c.id === item.sourceCompanyId);
                                    if (company) {
                                        if (design.hullClass === 'Freighter' || design.components.some(c => c.type.includes('Cargo'))) {
                                            company.activeFreighters = (company.activeFreighters ?? 0) + 1;
                                        }
                                        isCivilian = true;
                                    }
                                }

                                empire.fleets.push({
                                    id: generateId('fleet'),
                                    name: item.sourceCompanyId ? `${design.name} (Civilian)` : `${colony.name} Defense Flotilla ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
                                    empireId: empire.id,
                                    shipIds: [shipId],
                                    currentStarId: parentStar?.id || 'star_0',
                                    position: planet ? getPlanetPosition(planet, state.turn) : { x: 0, y: 0 },
                                    orbitingPlanetId: colony.planetId,
                                    orders: [],
                                    isCivilian: isCivilian,
                                    ownerCompanyId: item.sourceCompanyId
                                });
                            }
                        }
                    }
                    events.push(makeEvent(state.turn, state.date, 'ShipBuilt', `${colony.name}: Completed shipyard project ${item.name}`, { important: false }));
                }
            }
        }
    }

    if (planet && empire) {
        for (const mineral of planet.minerals) {
            const mineBonus = 1 + (govBonuses.mining_rate ?? 0);
            let extraction = (colony.mines + colony.civilianMines) * BALANCING.MINING_RATE_BASE * mineral.accessibility * staffingLevel * bonus.mining * infraEff * days * mineBonus * prodBonus;
            extraction = Math.min(extraction, mineral.amount);
            if (extraction > 0) {
                colony.minerals[mineral.name] = (colony.minerals[mineral.name] ?? 0) + extraction;
                mineral.amount -= extraction;
                colony.lastMineralRates![mineral.name] = (colony.lastMineralRates![mineral.name] || 0) + (extraction / days);
                state.stats.totalProduced[mineral.name] = (state.stats.totalProduced[mineral.name] || 0) + extraction;
            }
        }
    }

    // Decay demand over time (0.95 per cycle or similar)
    if (colony.demand) {
        for (const res in colony.demand) {
            colony.demand[res] *= Math.pow(0.5, days / 30); // Half-life of 30 days
            if (colony.demand[res] < 0.1) delete colony.demand[res];
        }
    }

    const consumedGoods = simulateColonyEconomy(colony, planet, infraEff, days);

    // Store income for the financial engine to process
    colony.privateWealthIncome = consumedGoods;
    colony.privateWealth = (colony.privateWealth || 0) + (consumedGoods * BALANCING.TRADE_GOOD_VALUE * 0.8);

    if ((colony.privateWealth || 0) > BALANCING.CIVILIAN_EXPANSION_THRESHOLD && colony.population > (colony.factories + colony.mines + colony.civilianFactories + colony.civilianMines) * 10) {
        if (Math.random() > 0.5) { colony.civilianFactories += 1; } else { colony.civilianMines += 1; }
        colony.privateWealth -= BALANCING.CIVILIAN_EXPANSION_COST;
        events.push(makeEvent(state.turn, state.date, 'CivilianExpansion', `Civilian investment on ${colony.name} built a new facility.`, { important: false }));
    }

    const SNAPSHOT_INTERVAL = 86400 * 30;
    const MAX_SNAPSHOTS = 24;
    const isSnapshotTick = Math.floor(state.turn / SNAPSHOT_INTERVAL) < Math.floor((state.turn + dt) / SNAPSHOT_INTERVAL);

    if (isSnapshotTick) {
        const snapshot: ColonySnapshot = {
            turn: state.turn + dt,
            date: new Date(state.date.getTime() + dt * 1000),
            population: colony.population,
            minerals: { ...colony.minerals },
            privateWealth: colony.privateWealth || 0,
            civilianFactories: colony.civilianFactories || 0,
            civilianMines: colony.civilianMines || 0,
            logisticsHubs: colony.logisticsHubs || 0,
            migrationMode: colony.migrationMode || 'Stable'
        };
        colony.history = [...(colony.history || []), snapshot].slice(-MAX_SNAPSHOTS);
    }

    return events;
}

export function tickAetherHarvesting(state: GameState, dt: number) {
    const days = dt / 86400;
    for (const empire of Object.values(state.empires)) {
        for (const fleet of empire.fleets) {
            if (!fleet.orbitingPlanetId) continue;

            const star = state.galaxy.stars[fleet.currentStarId];
            if (!star) continue;

            const planet = star.planets.find(p => p.id === fleet.orbitingPlanetId);
            if (!planet || planet.bodyType !== 'GasGiant') continue;

            const aetherDeposit = planet.minerals.find(m => m.name === 'Aether');
            if (!aetherDeposit || aetherDeposit.amount <= 0) continue;

            let totalHarvestRate = 0;
            for (const sid of fleet.shipIds) {
                const ship = state.ships[sid];
                if (!ship) continue;
                const design = empire.designLibrary.find(d => d.id === ship.designId);
                if (!design) continue;

                const mod = design.components.find((c: ShipComponent) => c.type === 'ColonizationModule');
                const scoop = design.components.find((c: ShipComponent) => c.id === 'scoop_aether');
                if (scoop) {
                    totalHarvestRate += (scoop.stats.harvestRate || 0);
                }
            }

            if (totalHarvestRate > 0) {
                let amount = totalHarvestRate * aetherDeposit.accessibility * days;
                amount = Math.min(amount, aetherDeposit.amount);

                let remainingToStore = amount;
                for (const sid of fleet.shipIds) {
                    const ship = state.ships[sid];
                    if (!ship) continue;
                    const design = empire.designLibrary.find(d => d.id === ship.designId);
                    if (!design) continue;

                    const cargoCap = design.components.reduce((sum: number, c: ShipComponent) => sum + (c.stats.cargoCapacity || 0), 0);
                    const currentCargo = Object.values(ship.cargo || {}).reduce((sum, v) => sum + v, 0);
                    const space = cargoCap - currentCargo;

                    if (space > 0) {
                        const toAdd = Math.min(remainingToStore, space);
                        ship.cargo = ship.cargo || {};
                        ship.cargo['Aether'] = (ship.cargo['Aether'] || 0) + toAdd;
                        remainingToStore -= toAdd;
                    }
                    if (remainingToStore <= 0) break;
                }

                const harvested = amount - remainingToStore;
                aetherDeposit.amount -= harvested;
            }
        }
    }
}
