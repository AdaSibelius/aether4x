import type { GameState, Colony, GameEvent, EventType, SpeciesId, ColonySnapshot, Empire, ShipComponent, Planet, GameStats } from '../types';
import { getGovernorBonuses } from './officers';
import { getEmpireTechBonuses } from './research';
import { BALANCING } from './constants';
import SimLogger from '../utils/logger';
import { generateId } from '../utils/id';
import { getPlanetPosition } from './fleets';
import { RNG } from '../utils/rng';
import { SPECIES, computeHabitability, getSpeciesGrowthMod, getAtmosphereHabitabilityMod } from './species';
import {
    transferWithLedger,
    createColonyPrivateWealthAccount,
    createExternalAccount,
    createTreasuryAccount,
    createCompanyAccount
} from './economy_ledger';

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
    Terraformer: 2000,
    GroundDefense: 1000,
    Spaceport: 2500,
    Infrastructure: 100,
    ConstructionOffice: 1500,
    AethericDistillery: 1200,
    AethericHarvester: 3000,
    CorporateOffice: 2000,
    Farm: 500,
    Store: 1000,
    CivilianFactory: 1500,
    CivilianMine: 1000,
    ElectronicsPlant: 2500,
    CivilianElectronicsPlant: 2500,
    MachineryPlant: 2500,
    CivilianMachineryPlant: 2500,
    ShipyardExpansion_Slipway: 2000,
    ShipyardExpansion_Tonnage: 1500,
};

export const STRUCTURE_MINERAL_COST: Record<string, Record<string, number>> = {
    Factory: { Iron: 600, Copper: 100 },
    Mine: { Iron: 400 },
    ResearchLab: { Iron: 200, Copper: 200, Electronics: 20 },
    Shipyard: { Iron: 2000, Machinery: 100 },
    Terraformer: { Iron: 500, Electronics: 100 },
    GroundDefense: { Iron: 400, Electronics: 20 },
    Spaceport: { Iron: 1000, Electronics: 100 },
    Infrastructure: { Iron: 40 },
    ConstructionOffice: { Iron: 600, Machinery: 50 },
    AethericDistillery: { Iron: 600, Machinery: 40 },
    AethericHarvester: { Iron: 1200, Electronics: 50 },
    CorporateOffice: { Iron: 800, ConsumerGoods: 20 },
    Farm: { Iron: 200 },
    Store: { Iron: 400, ConsumerGoods: 20 },
    CivilianFactory: { Iron: 800, Machinery: 40 },
    CivilianMine: { Iron: 500, Machinery: 20 },
    ElectronicsPlant: { Iron: 1200, Machinery: 100 },
    CivilianElectronicsPlant: { Iron: 1200, Machinery: 100 },
    MachineryPlant: { Iron: 1200, Machinery: 100 },
    CivilianMachineryPlant: { Iron: 1200, Machinery: 100 },
    ShipyardExpansion_Slipway: { Iron: 1000, Machinery: 50 },
    ShipyardExpansion_Tonnage: { Iron: 800, Machinery: 40 },
};

function updateColonyPopulation(colony: Colony, policyMod: number, agriMod: number, happyMod: number, days: number, habitability: number) {
    // Base survival threshold
    const popRequirementInfra = colony.population / BALANCING.INFRA_POP_SUPPORT;
    const survivalRatio = colony.infrastructure >= popRequirementInfra ? 1.0 : (colony.infrastructure / Math.max(0.01, popRequirementInfra));

    if (survivalRatio < 0.9) {
        // Infrastructure failure: severe population loss
        const loss = colony.population * (1 - survivalRatio) * 0.01 * days;
        colony.population = Math.max(0.1, colony.population - loss);
        // Habitability impact: if very low habitability and no infra, pop crashes even faster
        if (habitability < 0.2) {
            colony.population = Math.max(0, colony.population - colony.population * 0.02 * days);
        }
    }

    if (colony.population > 0) {
        let annualGrowth = colony.population * 0.05 * policyMod * agriMod * happyMod;
        const capacity = BALANCING.BASE_HABITABLE_POP + (colony.infrastructure * BALANCING.INFRA_POP_SUPPORT / 100);
        const capacityMod = 1 - (colony.population / capacity);

        const capacityAdjustedAnnual = capacityMod > 0
            ? annualGrowth * capacityMod
            : (colony.population * capacityMod * BALANCING.POP_DIE_OFF_RATE);

        colony.population = Math.max(0.1, colony.population + (capacityAdjustedAnnual / 365) * days);
    }
}

function simulateSectoralEconomy(colony: Colony, state: GameState, infraEff: number, days: number, rng: RNG): void {
    if (!colony.buildingOwners) colony.buildingOwners = {};
    if (!colony.resourcePrices) colony.resourcePrices = {};
    if (colony.educationIndex === undefined) colony.educationIndex = 50;
    if (colony.educationBudget === undefined) colony.educationBudget = 0;

    const empire = state.empires[colony.empireId];
    if (!empire) return;

    // 1. Education
    const educationGrowth = (colony.educationBudget / Math.max(1, colony.population)) * 0.1 * days;
    const educationDecay = BALANCING.EDUCATION_DECAY_RATE * days;
    const oldEdu = colony.educationIndex || 0;
    colony.educationIndex = Math.max(0, Math.min(100, (colony.educationIndex || 0) + educationGrowth - educationDecay));

    if (days > 0.1) {
        // SimLogger.debug('ECONOMY', `Colony ${colony.name} Edu: ${oldEdu.toFixed(2)} -> ${colony.educationIndex.toFixed(2)} (dt: ${days.toFixed(2)}d, budget: ${colony.educationBudget})`);
    }

    if (colony.educationBudget > 0) {
        const copayRatio = 0.3 * (colony.educationIndex / 100);
        const totalReq = colony.educationBudget * days;
        const privateShare = Math.min((colony.privateWealth || 0), totalReq * copayRatio);
        const publicShare = totalReq - privateShare;

        if (privateShare > 0) {
            colony.privateWealth = (colony.privateWealth || 0) - privateShare;
            transferWithLedger(state, createColonyPrivateWealthAccount(colony), createExternalAccount('education_sink'), privateShare, 'EDUCATION_COPAY', { colonyId: colony.id }, rng);
        }
        if (publicShare > 0) {
            transferWithLedger(state, createTreasuryAccount(empire), createExternalAccount('education_sink'), publicShare, 'EDUCATION_FUNDING', { colonyId: colony.id }, rng);
        }
    }

    // 2. Wages & Private Wealth
    const workerFactor = 1.0;
    const staffingLevel = colony.staffingLevel || 1.0;
    const colonyWage = 10.0 * staffingLevel * (1 + (colony.educationIndex / 100));

    const publicWorkersM = ((colony as any).publicWorkers || 0) * staffingLevel;
    const privateWorkersM = ((colony as any).privateWorkers || 0) * staffingLevel;

    let totalPublicWages = publicWorkersM * colonyWage * days;
    let totalPrivateWages = privateWorkersM * colonyWage * days;

    colony.privateWealth = (colony.privateWealth || 0) + totalPublicWages + totalPrivateWages;

    if ((colony.privateWealth || 0) > BALANCING.CORP_FOUND_WEALTH_THRESHOLD * 2) {
        const excess = colony.privateWealth! - (BALANCING.CORP_FOUND_WEALTH_THRESHOLD * 2);
        const transfer = excess * 0.02 * (days / 365);
        if (transfer > 0) {
            colony.privateWealth! -= transfer;
            colony.investmentPool = (colony.investmentPool || 0) + transfer;
        }
    }

    if (totalPublicWages > 0) {
        transferWithLedger(state, createTreasuryAccount(empire), createColonyPrivateWealthAccount(colony), totalPublicWages, 'WAGES_PAID', { colonyId: colony.id }, rng);
    }
    if (totalPrivateWages > 0) {
        transferWithLedger(state, createExternalAccount('civilian_capital'), createColonyPrivateWealthAccount(colony), totalPrivateWages, 'WAGES_PAID', { colonyId: colony.id }, rng);
    }

    // 3. Sectoral Production (Recipes)
    const outputByOwner: Record<string, Record<string, number>> = {};

    const processPlant = (type: string, reqIndex: number, good: string, recipe: any) => {
        const count = (colony as any)[type] || 0;
        if (count <= 0) return;

        const eduFactor = Math.min(1.0, (colony.educationIndex || 0) / Math.max(1, reqIndex));
        const efficiency = staffingLevel * eduFactor * infraEff;
        const potentialOutput = count * (BALANCING.BP_PER_FACTORY / (recipe.time || 1)) * efficiency * days;

        let possibleOutput = potentialOutput;
        for (const [res, amt] of Object.entries(recipe.inputs || {})) {
            const avail = colony.minerals[res as string] || 0;
            const needed = (amt as number) * potentialOutput;
            if (avail < needed) {
                possibleOutput = Math.min(possibleOutput, avail / (amt as number));
                colony.demand[res as string] = (colony.demand[res as string] || 0) + (needed - avail);
            }
        }

        const finalOutput = possibleOutput * (recipe.outputMultiplier || 1);
        if (finalOutput > 0) {
            for (const [res, amt] of Object.entries(recipe.inputs || {})) {
                const consumed = possibleOutput * (amt as number);
                colony.minerals[res as string] -= consumed;
                state.stats.totalConsumed[res as string] = (state.stats.totalConsumed[res as string] || 0) + consumed;
            }
            colony.minerals[good] = (colony.minerals[good] || 0) + finalOutput;
            state.stats.totalProduced[good] = (state.stats.totalProduced[good] || 0) + finalOutput;
            if (good === 'ConsumerGoods' && finalOutput > 0) {
                console.log(`DEBUG: Produced ${finalOutput.toFixed(2)} units of ${good} on ${colony.name}. New total: ${colony.minerals[good].toFixed(2)}`);
            }

            if (!outputByOwner[good]) outputByOwner[good] = {};
            const owners = colony.buildingOwners![type] || { [empire.id]: count };
            const totalInType = Object.values(owners).reduce((sum, v) => sum + v, 0);
            for (const [ownerId, ownerCount] of Object.entries(owners)) {
                outputByOwner[good][ownerId] = (outputByOwner[good][ownerId] || 0) + (ownerCount / totalInType) * finalOutput;
            }
        }
    };

    processPlant('electronicsPlants', BALANCING.JOB_REQUIREMENTS.ElectronicsPlant, 'Electronics', BALANCING.INDUSTRY_RECIPES.Electronics);
    processPlant('civilianElectronicsPlants', BALANCING.JOB_REQUIREMENTS.CivilianElectronicsPlant, 'Electronics', BALANCING.INDUSTRY_RECIPES.Electronics);
    processPlant('machineryPlants', BALANCING.JOB_REQUIREMENTS.MachineryPlant, 'Machinery', BALANCING.INDUSTRY_RECIPES.Machinery);
    processPlant('civilianMachineryPlants', BALANCING.JOB_REQUIREMENTS.CivilianMachineryPlant, 'Machinery', BALANCING.INDUSTRY_RECIPES.Machinery);
    processPlant('factories', BALANCING.JOB_REQUIREMENTS.Factory, 'ConsumerGoods', BALANCING.INDUSTRY_RECIPES.ConsumerGoods);
    processPlant('civilianFactories', BALANCING.JOB_REQUIREMENTS.CivilianFactory, 'ConsumerGoods', BALANCING.INDUSTRY_RECIPES.ConsumerGoods);

    // Food production proportionality — attribute to farm owners for MARKET_PURCHASE payment.
    // Falls back to splitting equally among all Agricultural companies if ownership unregistered.
    const farmOwners = colony.buildingOwners?.['Farm'];
    const totalFarms = colony.farms || 0;
    if (totalFarms > 0) {
        outputByOwner['Food'] = {};
        if (farmOwners && Object.keys(farmOwners).length > 0) {
            // Use explicit ownership records
            for (const [ownerId, count] of Object.entries(farmOwners)) {
                outputByOwner['Food'][ownerId] = count / totalFarms;
            }
        } else {
            // Fallback: split food revenue equally among Agricultural companies
            const agrCorps = empire.companies.filter(c => c.type === 'Agricultural');
            if (agrCorps.length > 0) {
                const share = 1 / agrCorps.length;
                for (const corp of agrCorps) {
                    outputByOwner['Food'][corp.id] = share;
                }
            }
            // If no agricultural corps exist, food revenue goes to empire treasury
            if (!agrCorps.length) {
                outputByOwner['Food'][empire.id] = 1;
            }
        }
    }

    // 4. Market & Pricing
    const processMarket = (good: string, demandAmt: number, retailMarkupPercent: number = 0.0) => {
        const supplyStock = colony.minerals[good] || 0;
        let basePrice = 5.0;
        if (good === 'Food') basePrice = BALANCING.FARM_YIELD_BASE > 0 ? 1.0 : 1.0;
        if (good === 'Electronics') basePrice = 15.0;
        if (good === 'Machinery') basePrice = 10.0;
        if (good === 'ConsumerGoods') basePrice = 8.0;

        let currentPrice = basePrice * (demandAmt / Math.max(1, (1 + supplyStock)));
        if (good === 'Food') {
            const daysSupply = supplyStock / Math.max(0.001, demandAmt / days);
            if (daysSupply < BALANCING.FOOD_PRICE_SURGE_THRESHOLD) {
                const surgeMult = 1 + ((BALANCING.FOOD_PRICE_SURGE_THRESHOLD - daysSupply) / BALANCING.FOOD_PRICE_SURGE_THRESHOLD) * (BALANCING.FOOD_PRICE_MAX - 1);
                currentPrice = Math.max(currentPrice, basePrice * surgeMult);
            }
        }
        currentPrice = Math.max(basePrice * 0.1, Math.min(currentPrice, basePrice * 10));

        colony.resourcePrices![good] = currentPrice;
        const purchasedAmt = Math.min(supplyStock, demandAmt);
        colony.minerals[good] -= purchasedAmt;
        state.stats.totalConsumed[good] = (state.stats.totalConsumed[good] || 0) + purchasedAmt;

        const spendMult = 1.0 + retailMarkupPercent;
        const factoryRevenue = purchasedAmt * currentPrice;
        const retailMarkup = purchasedAmt * currentPrice * retailMarkupPercent;

        if (factoryRevenue > 0 || retailMarkup > 0) {
            const totalSpend = factoryRevenue + retailMarkup;
            colony.privateWealth = Math.max(0, (colony.privateWealth || 0) - totalSpend);

            // Pay Producers
            const owners = outputByOwner[good];
            if (owners) {
                const totalShares = Object.values(owners).reduce((sum, v) => sum + v, 0);
                if (totalShares > 0) {
                    for (const [ownerId, shares] of Object.entries(owners)) {
                        const ownerShare = (shares / totalShares) * factoryRevenue;
                        if (ownerShare > 0) {
                            let toAccount = null;
                            if (ownerId === empire.id) toAccount = createTreasuryAccount(empire);
                            else if (ownerId === 'private') toAccount = createExternalAccount('civilian_capital');
                            else {
                                const corp = empire.companies.find(c => c.id === ownerId);
                                if (corp) toAccount = createCompanyAccount(corp);
                            }
                            if (toAccount) transferWithLedger(state, createColonyPrivateWealthAccount(colony), toAccount, ownerShare, 'MARKET_PURCHASE', { colonyId: colony.id, resource: good }, rng);
                        }
                    }
                }
            }

            // Pay Retailers (Stores)
            if (retailMarkup > 0) {
                const storeOwners = colony.buildingOwners?.['Store'];
                if (storeOwners) {
                    const totalStores = Object.values(storeOwners).reduce((sum, v) => sum + v, 0);
                    if (totalStores > 0) {
                        for (const [ownerId, count] of Object.entries(storeOwners)) {
                            const storeShare = (count / totalStores) * retailMarkup;
                            if (storeShare > 0) {
                                let toAccount = null;
                                const corp = empire.companies.find(c => c.id === ownerId);
                                if (corp) toAccount = createCompanyAccount(corp);
                                else if (ownerId === empire.id) toAccount = createTreasuryAccount(empire);

                                if (toAccount) transferWithLedger(state, createColonyPrivateWealthAccount(colony), toAccount, storeShare, 'RETAIL_MARKUP', { colonyId: colony.id, resource: good }, rng);
                            }
                        }
                    }
                }
            }
        }
    };

    // 5. Consumption Logic
    const populationM = colony.population;
    processMarket('Food', populationM * BALANCING.FOOD_CONSUMPTION_RATE * days, 1.0);

    const cgNeeded = populationM * BALANCING.POP_CONSUMPTION_RATE * days;
    const initialWealth = colony.privateWealth || 0;
    processMarket('ConsumerGoods', cgNeeded, 0.25); // Stores markup is +25%
    const boughtCG = initialWealth - (colony.privateWealth || 0);
    if (boughtCG < cgNeeded * 0.8) {
        colony.happiness -= 1 * days;
    } else {
        colony.happiness += 0.5 * days;
    }

    const electronicsForLabs = (colony.researchLabs || 0) * BALANCING.ELECTRONICS_PER_RESEARCH_LAB * days;
    const electronicsForLux = ((colony.privateWealth || 0) / BALANCING.ELECTRONICS_LUXURY_THRESHOLD) * BALANCING.ELECTRONICS_LUXURY_CONSUMPTION * colony.population * days;
    const totalElectronics = electronicsForLabs + electronicsForLux;
    if (totalElectronics > 0) processMarket('Electronics', totalElectronics, 0.25);

    const machineryNeeded = (colony.shipyards || []).reduce((sum, sy) => {
        return sum + (sy.activeBuilds || []).reduce((s, _b) => s + (BALANCING.MACHINERY_PER_SHIPYARD_BP * days), 0);
    }, 0);
    if (machineryNeeded > 0) processMarket('Machinery', machineryNeeded, 1.0);

    // 6. Cost of Living sink
    const costOfLiving = (colony.privateWealth || 0) * BALANCING.COST_OF_LIVING_RATE * days;
    if (costOfLiving > 0) {
        transferWithLedger(state, createColonyPrivateWealthAccount(colony), createExternalAccount('cost_of_living_sink'), costOfLiving, 'COST_OF_LIVING', { colonyId: colony.id }, rng);
    }

    // 7. Office Rent
    const corporateOfficesCount = colony.corporateOffices || 0;
    if (corporateOfficesCount > 0 && colony.buildingOwners?.['CorporateOffice']) {
        let rentPool = 0;
        for (const corp of empire.companies) {
            if (corp.homeColonyId !== colony.id || corp.type === 'Commercial') continue;

            let buildingsOwned = 0;
            for (const bType in colony.buildingOwners) {
                buildingsOwned += (colony.buildingOwners[bType][corp.id] || 0);
            }
            if (buildingsOwned > 0) {
                const rent = buildingsOwned * BALANCING.CORP_POOL.OFFICE * days;
                transferWithLedger(state, createCompanyAccount(corp), createExternalAccount('office_rent_routing'), rent, 'OFFICE_RENT', { colonyId: colony.id }, rng);
                rentPool += rent;
            }
        }

        if (rentPool > 0) {
            const officeOwners = colony.buildingOwners['CorporateOffice'];
            const totalOffices = Object.values(officeOwners).reduce((sum, v) => sum + v, 0);
            for (const [ownerId, count] of Object.entries(officeOwners)) {
                const share = (count / totalOffices) * rentPool;
                if (share > 0) {
                    const ownerCorp = empire.companies.find(c => c.id === ownerId);
                    if (ownerCorp) {
                        transferWithLedger(state, createExternalAccount('office_rent_routing'), createCompanyAccount(ownerCorp), share, 'OFFICE_RENT_INCOME', { colonyId: colony.id }, rng);
                    }
                }
            }
        }
    }
}

function processAetherDistillation(colony: Colony, stats: GameStats, infraEff: number, days: number): number {
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

export function tickColony(colony: Colony, state: GameState, dt: number, rng: RNG): GameEvent[] {
    const events: GameEvent[] = [];
    colony.lastMineralRates = {};
    const days = dt / 86400;
    const bonus = COLONY_TYPE_BONUS[colony.colonyType] ?? COLONY_TYPE_BONUS.Core;

    colony.maxPopulation = 10 + (colony.infrastructure * BALANCING.INFRA_POP_SUPPORT / 100);
    const infraEff = 0.5 + (colony.infrastructure / 100) * 0.5;
    const empire = state.empires[colony.empireId];
    const techBonuses = empire ? getEmpireTechBonuses(empire.research.completedTechs) : {};
    const govBonuses = getGovernorBonuses(empire?.officers || [], colony.governorId);
    const prodBonus = (1 + (govBonuses.all_production ?? 0)) * (1 + (techBonuses.all_production ?? 0));

    const planet = Object.values(state.galaxy.stars).flatMap(s => s.planets).find(p => p.id === colony.planetId);

    if (planet && colony.populationSegments) {
        for (const seg of colony.populationSegments) {
            const speciesDef = SPECIES[seg.speciesId];
            if (speciesDef) seg.habitability = computeHabitability(speciesDef, planet);
        }
    }

    const requiredPublicLabor =
        colony.factories * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FACTORY +
        colony.mines * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_MINE +
        colony.researchLabs * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_RESEARCH_LAB +
        colony.shipyards.length * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SHIPYARD +
        (colony.spaceport ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SPACEPORT : 0) +
        colony.groundDefenses * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_GROUND_DEFENSE +
        (colony.constructionOffices || 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CONSTRUCTION_OFFICE +
        (colony.aethericDistillery ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_DISTILLERY +
        (colony.factories > 0 && colony.terraformProgress < 100 ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_TERRAFORMER : 0);

    const companiesOnColony = (empire?.companies || []).filter(c => c.homeColonyId === colony.id).length;
    const requiredPrivateLabor =
        colony.civilianFactories * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_FACTORY +
        colony.civilianMines * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_MINE +
        companiesOnColony * BALANCING.EMPLOYMENT.OFFICE_WORKERS_PER_CORP;

    const totalRequiredLabor = requiredPublicLabor + requiredPrivateLabor + (colony.farms ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FARM + (colony.stores ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_STORE;

    (colony as any).publicWorkers = requiredPublicLabor;
    (colony as any).privateWorkers = totalRequiredLabor - requiredPublicLabor;


    const baselineStaffing = totalRequiredLabor > 0 ? Math.min(1.0, colony.population / totalRequiredLabor) : 1.0;
    const staffingLevel = Math.min(BALANCING.MAX_STAFFING_LEVEL, (baselineStaffing * (colony.laborEfficiency ?? 1.0) * (1 + (techBonuses.load_speed ?? 0))) || 0.001);
    colony.staffingLevel = staffingLevel;

    const constructionBP = (colony.constructionOffices || 0) * BALANCING.EMPLOYMENT.CONSTRUCTION_BP_PER_OFFICE * staffingLevel;

    // Growth & Population
    let policyGrowthMod = 1.0;
    let policyHappinessBonus = 0;
    switch (colony.policy) {
        case 'Encourage Growth': policyGrowthMod = 1.5; policyHappinessBonus = -10; break;
        case 'Population Control': policyGrowthMod = 0.0; policyHappinessBonus = 15; break;
        case 'Forced Labor': policyGrowthMod = 0.8; policyHappinessBonus = -30; break;
    }

    const avgHabitability = (colony.populationSegments && colony.populationSegments.length > 0 && colony.population > 0)
        ? colony.populationSegments.reduce((sum, s) => sum + (s.habitability || 0) * s.count, 0) / colony.population : 1.0;

    updateColonyPopulation(colony, policyGrowthMod, 1.0 + (staffingLevel * 0.1), colony.happiness > 70 ? 1.1 : colony.happiness < 30 ? 0.95 : 1.0, days, avgHabitability);

    // Food Production
    const foodProduced = (colony.farms ?? 0) * BALANCING.FARM_YIELD_BASE * staffingLevel * days * (1 + (govBonuses.agriculture ?? 0)) * (1 + (techBonuses.farm_yield ?? 0)) * prodBonus;
    colony.minerals['Food'] = (colony.minerals['Food'] || 0) + foodProduced;
    state.stats.totalProduced['Food'] = (state.stats.totalProduced['Food'] || 0) + foodProduced;

    processAetherDistillation(colony, state.stats, infraEff, days);

    const targetHappiness = 60 + (avgHabitability - 0.5) * 30 + (colony.infrastructure - 50) * 0.3 - (colony.population > colony.maxPopulation * 0.9 ? 10 : 0) + (colony.spaceport ? 5 : 0) - (colony.population > 0 ? Math.max(0, (colony.population - totalRequiredLabor) / colony.population) * 15 : 0) + policyHappinessBonus;
    colony.happiness += (targetHappiness - colony.happiness) * 0.01 * days;
    colony.happiness = Math.max(0, Math.min(100, colony.happiness));

    if (colony.terraformProgress < 100) {
        colony.terraformProgress = Math.min(100, colony.terraformProgress + (constructionBP * BALANCING.TP_PER_TERRAFORMER) * days);
        if (colony.terraformProgress >= 100) events.push(makeEvent(state.turn, state.date, 'ResearchComplete', `Research complete: ${colony.name} terraforming`, rng, { important: true }));
    }

    const bpPerDay = (colony.factories * BALANCING.BP_PER_FACTORY + 5 + (colony.population * 0.5) * (colony.laborAllocation.industry / 100)) * staffingLevel * bonus.industry * infraEff * (1 + (govBonuses.factory_output ?? 0)) * (1 + (techBonuses.factory_output ?? 0)) * prodBonus;

    if (colony.productionQueue.length > 0) {
        const item = colony.productionQueue[0];
        const totalBpNeeded = item.bpCostPerUnit * item.quantity;
        const bpAppliedTarget = Math.min(bpPerDay * days, totalBpNeeded * (1 - item.progress / 100));

        if (bpAppliedTarget > 0) {
            let fractionOfJob = bpAppliedTarget / totalBpNeeded;
            for (const [res, cost] of Object.entries(item.costPerUnit || {})) {
                if (cost > 0) {
                    const needed = cost * item.quantity * fractionOfJob;
                    const avail = colony.minerals[res] || 0;
                    if (avail < needed) {
                        fractionOfJob = Math.min(fractionOfJob, avail / (cost * item.quantity));
                        colony.demand[res] = (colony.demand[res] || 0) + (needed - avail);
                    }
                }
            }
            for (const [res, cost] of Object.entries(item.costPerUnit || {})) {
                if (cost > 0) {
                    const amount = cost * item.quantity * fractionOfJob;
                    colony.minerals[res] = Math.max(0, (colony.minerals[res] || 0) - amount);
                    state.stats.totalConsumed[res] = (state.stats.totalConsumed[res] || 0) + amount;
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
                case 'Spaceport': colony.spaceport += item.quantity; break;
                case 'Infrastructure': colony.infrastructure = Math.min(100, colony.infrastructure + item.quantity * 5); break;
                case 'AethericDistillery': colony.aethericDistillery = (colony.aethericDistillery ?? 0) + item.quantity; break;
                case 'AethericHarvester': colony.aethericHarvesters = (colony.aethericHarvesters ?? 0) + item.quantity; break;
                case 'CorporateOffice': colony.corporateOffices = (colony.corporateOffices ?? 0) + item.quantity; break;
                case 'Store': colony.stores = (colony.stores ?? 0) + item.quantity; break;
            }
            events.push(makeEvent(state.turn, state.date, 'ProductionComplete', `${colony.name}: Completed ${item.quantity}x ${item.name}`, rng, { important: false }));
        }
    }

    // Shipyard Construction
    const remainingShipyardBP = (bpPerDay * BALANCING.SHIPYARD_BP_ALLOCATION_FACTOR) + (colony.shipyards.length * 5);
    for (const sy of colony.shipyards) {
        if (!sy.activeBuilds) sy.activeBuilds = [];
        if (sy.activeBuilds.length > 0) {
            const activeCount = sy.activeBuilds.length;
            const activeSlipways = Math.min(sy.slipways, activeCount);
            const bpPerSlipway = activeSlipways > 0 ? (remainingShipyardBP / colony.shipyards.length / activeSlipways) * days : 0;

            for (let i = 0; i < activeSlipways; i++) {
                const item = sy.activeBuilds[i];
                if (!item) continue;
                const totalBpNeeded = item.bpCostPerUnit * item.quantity;
                let fractionOfJob = Math.min(bpPerSlipway, totalBpNeeded * (1 - item.progress / 100)) / totalBpNeeded;

                for (const [res, cost] of Object.entries(item.costPerUnit || {})) {
                    if (cost > 0) {
                        const needed = cost * item.quantity * fractionOfJob;
                        const avail = colony.minerals[res] || 0;
                        if (avail < needed) {
                            fractionOfJob = Math.min(fractionOfJob, avail / (cost * item.quantity));
                            colony.demand[res] = (colony.demand[res] || 0) + (needed - avail);
                        }
                    }
                }
                for (const [res, cost] of Object.entries(item.costPerUnit || {})) {
                    if (cost > 0) {
                        const amount = cost * item.quantity * fractionOfJob;
                        colony.minerals[res] -= amount;
                        state.stats.totalConsumed[res] = (state.stats.totalConsumed[res] || 0) + amount;
                    }
                }
                item.progress = Math.min(100, item.progress + fractionOfJob * 100);
            }
        }
    }

    if (planet && empire) {
        for (const mineral of planet.minerals) {
            const isOrbital = colony.colonyType === 'Orbital';
            let extraction = 0;
            if (!isOrbital) {
                extraction = (colony.mines + colony.civilianMines) * BALANCING.MINING_RATE_BASE * mineral.accessibility * staffingLevel * bonus.mining * infraEff * days * (1 + (govBonuses.mining_rate ?? 0)) * (1 + (techBonuses.mining_rate ?? 0)) * prodBonus;
            } else if (mineral.name === 'Aether') {
                extraction = (colony.aethericHarvesters || 0) * BALANCING.AETHER_HARVEST_RATE_BASE * mineral.accessibility * staffingLevel * days;
            }
            extraction = Math.min(extraction, mineral.amount);
            if (extraction > 0) {
                colony.minerals[mineral.name] = (colony.minerals[mineral.name] ?? 0) + extraction;
                mineral.amount -= extraction;
                state.stats.totalProduced[mineral.name] = (state.stats.totalProduced[mineral.name] || 0) + extraction;
            }
        }
    }

    if (colony.demand) {
        for (const res in colony.demand) {
            colony.demand[res] *= Math.pow(0.5, days / 30);
            if (colony.demand[res] < 0.1) delete colony.demand[res];
        }
    }

    simulateSectoralEconomy(colony, state, infraEff, days, rng);

    if ((colony.privateWealth || 0) > BALANCING.CIVILIAN_EXPANSION_THRESHOLD && colony.population > (colony.factories + colony.mines + colony.civilianFactories + colony.civilianMines) * 10) {
        if (rng.next() > 0.5) colony.civilianFactories += 1; else colony.civilianMines += 1;
        transferWithLedger(state, createColonyPrivateWealthAccount(colony), createExternalAccount('civilian_expansion_sink'), BALANCING.CIVILIAN_EXPANSION_COST, 'CIVILIAN_EXPANSION', { colonyId: colony.id }, rng);
    }

    return events;
}

function makeEvent(turn: number, date: Date, type: EventType, message: string, rng: RNG, params?: any): GameEvent {
    return { id: generateId('evt', rng), turn, date: date.toISOString().split('T')[0], type, message, ...params };
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
                const scoop = design?.components.find((c: ShipComponent) => c.id === 'scoop_aether');
                if (scoop) totalHarvestRate += (scoop.stats.harvestRate || 0);
            }

            if (totalHarvestRate > 0) {
                let amount = Math.min(totalHarvestRate * aetherDeposit.accessibility * days, aetherDeposit.amount);
                let remainingToStore = amount;
                for (const sid of fleet.shipIds) {
                    const ship = state.ships[sid];
                    const design = empire.designLibrary.find(d => d.id === ship!.designId);
                    const cargoCap = design!.components.reduce((sum: number, c: ShipComponent) => sum + (c.stats.cargoCapacity || 0), 0);
                    const space = cargoCap - Object.values(ship!.cargo || {}).reduce((sum, v) => sum + v, 0);
                    if (space > 0) {
                        const toAdd = Math.min(remainingToStore, space);
                        ship!.cargo = ship!.cargo || {};
                        ship!.cargo['Aether'] = (ship!.cargo['Aether'] || 0) + toAdd;
                        remainingToStore -= toAdd;
                    }
                    if (remainingToStore <= 0) break;
                }
                aetherDeposit.amount -= (amount - remainingToStore);
            }
        }
    }
}
