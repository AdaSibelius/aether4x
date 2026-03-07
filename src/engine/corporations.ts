/**
 * @module corporations
 * @description
 * Core simulation logic for AI-driven civilian companies and market dynamics.
 * 
 * **Architecture & State Mutations:**
 * - `tickCorporations` mutates `GameState.empires[id].companies` and `GameState.colonies[id]` (for corporate buildings).
 * - Companies generate revenue, pay wages, and autonomously queue construction projects via `processCompanyStrategy`.
 * - Financial transactions are funneled through the `economy_ledger`.
 */
import type { GameState, Empire, Company, CompanyType, GameEvent, OfficerRole, Colony, Fleet } from '../types';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import { generateCompanyName, createOfficer } from './officers';
import { getEmpireTechBonuses } from './research';
import { BALANCING } from './constants';
import { COMPONENT_LIBRARY, createDesign } from './ships';
import {
    transferWithLedger,
    createTreasuryAccount,
    createColonyPrivateWealthAccount,
    createCompanyAccount,
    createExternalAccount,
} from './economy_ledger';

export function tickCorporations(next: GameState, empire: Empire, rng: RNG, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const days = dt / 86400;
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);
    const treasuryAccount = createTreasuryAccount(empire);

    // Unit conventions:
    // - Recurring economic rates below are expressed in per-day terms.
    // - Tick-level cashflow must multiply those rates by `days` for consistency across tick lengths.

    // ── Corporate Operations (Every Tick) ──
    for (const company of empire.companies) {
        const homeColony = empireColonies.find(c => c.id === company.homeColonyId);
        const companyAccount = createCompanyAccount(company);
        const externalSink = createExternalAccount('corp_maintenance_sink');

        // 1. Maintenance
        const maintenance = calculateMaintenance(company, empire, homeColony?.staffingLevel) * days;
        transferWithLedger(next, companyAccount, externalSink, maintenance, 'MAINTENANCE_PAYMENT',
            { companyId: company.id, empireId: empire.id }, rng);

        // 1b. Farm upkeep (Agricultural only) — scanned colony-by-colony since calculateMaintenance has no colony access
        if (company.type === 'Agricultural') {
            let totalOwnedFarms = 0;
            for (const colony of empireColonies) {
                totalOwnedFarms += colony.buildingOwners?.['Farm']?.[company.id] || 0;
            }
            const farmUpkeep = totalOwnedFarms * BALANCING.MAINTENANCE.FARM * days;
            if (farmUpkeep > 0) {
                transferWithLedger(next, companyAccount, externalSink, farmUpkeep, 'FARM_UPKEEP',
                    { companyId: company.id, empireId: empire.id }, rng);
            }
        }

        // 2. Revenue via opportunity pools (econ-003: replaces inverse-divisor formulas)
        let tickRevenue = 0;
        if (homeColony) {
            const staffingEff = homeColony.staffingLevel || 1.0;

            if (company.type === 'Agricultural') {
                // Agricultural revenue flows via processMarket → outputByOwner['Food'] → buildingOwners['Farm'].
                // No abstract CORP_POOL pool — income comes purely from food sold to colonies at market price.
                tickRevenue = 0;
            } else if (company.type === 'Commercial') {
                const pool = ((homeColony.stores || 0) * BALANCING.CORP_POOL.COMMERCIAL + (homeColony.corporateOffices || 0) * BALANCING.CORP_POOL.OFFICE) * days;
                const comCos = empire.companies.filter(c => c.type === 'Commercial' && c.homeColonyId === homeColony.id).length || 1;
                tickRevenue = (pool / comCos) * staffingEff;
            } else if (company.type === 'Manufacturing') {
                // Main manufacturing revenue handled dynamically via MARKET_PURCHASE
                const pool = (homeColony.aethericDistillery || 0) * BALANCING.CORP_POOL.DISTILLERY * days;
                const manCos = empire.companies.filter(c => c.type === 'Manufacturing' && c.homeColonyId === homeColony.id).length || 1;
                tickRevenue = (pool / manCos) * staffingEff;
            } else if (company.type === 'Extraction') {
                const baseTick = (1 + company.explorationLicenseIds.length * 0.2) * 20 * staffingEff * days;
                const pool = (homeColony.aethericHarvesters || 0) * BALANCING.CORP_POOL.HARVESTER * days;
                const extCos = empire.companies.filter(c => c.type === 'Extraction' && c.homeColonyId === homeColony.id).length || 1;
                tickRevenue = baseTick + (pool / extCos) * staffingEff;
            } else if (company.type === 'Transport') {
                const pool = (homeColony.constructionOffices || 0) * BALANCING.CORP_POOL.CONSTRUCTION * days;
                const transCos = empire.companies.filter(c => c.type === 'Transport' && c.homeColonyId === homeColony.id).length || 1;
                tickRevenue = (pool / transCos) * staffingEff;
            }
        }

        // Credit revenue from external source (trade goods sold, services rendered)
        if (tickRevenue > 0) {
            transferWithLedger(next, createExternalAccount('corp_revenue'), companyAccount, tickRevenue, 'EXTERNAL_GRANT',
                { companyId: company.id, type: company.type }, rng);
        }

        // 3. Valuation Update
        const assetsValue = ((company.activeFreighters || 0) * 1000) + (company.explorationLicenseIds.length * 500);
        company.valuation = company.wealth + assetsValue;

        // 4. History Logging
        if (rng.chance(0.05)) {
            company.history.push({
                date: next.date.toISOString().split('T')[0],
                wealth: company.wealth,
                valuation: company.valuation,
                revenue: tickRevenue,
                expenses: maintenance
            });
            if (company.history.length > 30) company.history.shift();
        }
    }

    // ── Corporate Strategy (Yearly odds for yearly logic) ──
    const chancePerTick = days / 365;
    if (rng.chance(chancePerTick)) {
        const totalMigrantDemand = empireColonies.reduce((sum, c) => sum + (c.migrantsWaiting || 0), 0);

        for (const company of empire.companies) {
            const homeColony = empireColonies.find(c => c.id === company.homeColonyId);
            const ceo = empire.officers.find(o => o.id === company.ceoId);
            const companyAccount = createCompanyAccount(company);
            const revBonus = ceo?.bonuses?.corp_revenue ? (1 + ceo.bonuses.corp_revenue) : 1;
            // Agricultural companies expand at a lower wealth threshold — food security is a public good
            const buildThreshold = (company.type === 'Agricultural' ? 2000 : 5000) / revBonus;

            if (homeColony && company.wealth > buildThreshold) {
                let messageValue = '';

                // --- Find Best Target Colony for Expansion ---
                let bestColony: Colony | undefined = homeColony;

                // Slots logic
                const getAvailableSlots = (c: Colony) => {
                    const capacity = BALANCING.COLONY_BASELINE_SLOTS + (c.corporateOffices || 0) * BALANCING.OFFICE_CAPACITY_PER_BUILDING;
                    // Farms are excluded from slot cap — food security is a public good
                    const used = (c.civilianFactories || 0) + (c.civilianMines || 0) + (c.civilianElectronicsPlants || 0) + (c.civilianMachineryPlants || 0) + (c.stores || 0) + (c.constructionOffices || 0) + (c.aethericDistillery || 0) + (c.aethericHarvesters || 0);
                    return capacity - used;
                };

                const eligibleColonies = empireColonies.filter(c => getAvailableSlots(c) > 0);

                if (company.type === 'Extraction') {
                    const isOrbital = rng.chance(0.3);
                    const planetPool = eligibleColonies.filter(c => isOrbital ? c.colonyType === 'Orbital' : c.colonyType !== 'Orbital');

                    if (planetPool.length > 0) {
                        const res = isOrbital ? 'Aether' : rng.pick(BALANCING.MINERAL_NAMES.filter(m => m !== 'Aether'));
                        const planets = Object.values(next.galaxy.stars).flatMap(s => s.planets);
                        bestColony = planetPool.sort((a, b) => {
                            const bPlanet = planets.find(p => p.id === b.planetId);
                            const aPlanet = planets.find(p => p.id === a.planetId);
                            const bAcc = bPlanet?.minerals.find(m => m.name === res)?.accessibility || 0;
                            const aAcc = aPlanet?.minerals.find(m => m.name === res)?.accessibility || 0;
                            const bScore = bAcc * (b.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                            const aScore = aAcc * (a.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                            return bScore - aScore;
                        })[0];

                        if (bestColony) {
                            const targetBuilding = isOrbital ? 'AethericHarvester' : 'CivilianMine';
                            if (targetBuilding === 'CivilianMine') bestColony.civilianMines = (bestColony.civilianMines ?? 0) + 1;
                            if (targetBuilding === 'AethericHarvester') bestColony.aethericHarvesters = (bestColony.aethericHarvesters ?? 0) + 1;

                            const cost = buildThreshold * 0.5;
                            transferWithLedger(next, companyAccount, createExternalAccount('corp_expansion_sink'), cost, 'CORP_EXPANSION',
                                { companyId: company.id, colonyId: bestColony.id, type: targetBuilding }, rng);
                            messageValue = `${company.name} expanded ${res} extraction on ${bestColony.name}.`;
                        }
                    }
                } else if (company.type === 'Manufacturing') {
                    // Manufacturing AI: Looks for high Aether base or high demand goods
                    const hasElectronics = homeColony.resourcePrices?.Electronics && homeColony.resourcePrices.Electronics > 15;
                    const hasMachinery = homeColony.resourcePrices?.Machinery && homeColony.resourcePrices.Machinery > 10;

                    let targetBuilding = rng.chance(0.3) ? 'AethericDistillery' : 'CivilianFactory';
                    if (targetBuilding !== 'AethericDistillery') {
                        if (hasElectronics && hasMachinery) {
                            targetBuilding = rng.chance(0.5) ? 'CivilianElectronicsPlant' : 'CivilianMachineryPlant';
                        } else if (hasElectronics) {
                            targetBuilding = 'CivilianElectronicsPlant';
                        } else if (hasMachinery) {
                            targetBuilding = 'CivilianMachineryPlant';
                        }
                    }

                    bestColony = eligibleColonies.sort((a, b) => {
                        let bScore = b.population;
                        let aScore = a.population;
                        if (targetBuilding === 'AethericDistillery') {
                            bScore = b.minerals['Aether'] || 0;
                            aScore = a.minerals['Aether'] || 0;
                        }
                        bScore *= (b.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                        aScore *= (a.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                        return bScore - aScore;
                    })[0];

                    if (bestColony) {
                        if (targetBuilding === 'CivilianFactory') bestColony.civilianFactories = (bestColony.civilianFactories ?? 0) + 1;
                        if (targetBuilding === 'CivilianElectronicsPlant') bestColony.civilianElectronicsPlants = (bestColony.civilianElectronicsPlants ?? 0) + 1;
                        if (targetBuilding === 'CivilianMachineryPlant') bestColony.civilianMachineryPlants = (bestColony.civilianMachineryPlants ?? 0) + 1;
                        if (targetBuilding === 'AethericDistillery') bestColony.aethericDistillery = (bestColony.aethericDistillery ?? 0) + 1;

                        if (!bestColony.buildingOwners) bestColony.buildingOwners = {};
                        if (!bestColony.buildingOwners[targetBuilding]) bestColony.buildingOwners[targetBuilding] = {};
                        bestColony.buildingOwners[targetBuilding][company.id] = (bestColony.buildingOwners[targetBuilding][company.id] || 0) + 1;

                        const cost = buildThreshold * 0.5;
                        transferWithLedger(next, companyAccount, createExternalAccount('corp_expansion_sink'), cost, 'CORP_EXPANSION',
                            { companyId: company.id, colonyId: bestColony.id, type: targetBuilding }, rng);
                        messageValue = `${company.name} built a new ${targetBuilding} on ${bestColony.name}.`;
                    }
                } else if (company.type === 'Agricultural') {
                    // Farms bypass slot cap, so use all empire colonies as candidates.
                    // Prefer colonies with the most food scarcity (low food / high consumption).
                    bestColony = empireColonies.sort((a, b) => {
                        const bDaySupply = (b.minerals['Food'] || 0) / Math.max(1, b.population * BALANCING.FOOD_CONSUMPTION_RATE);
                        const aDaySupply = (a.minerals['Food'] || 0) / Math.max(1, a.population * BALANCING.FOOD_CONSUMPTION_RATE);
                        const bScore = -bDaySupply * (b.incentives?.preferredSector === company.type ? 0.5 : 1.0); // most scarce = highest priority
                        const aScore = -aDaySupply * (a.incentives?.preferredSector === company.type ? 0.5 : 1.0);
                        return bScore - aScore;
                    })[0];

                    if (bestColony) {
                        bestColony.farms = (bestColony.farms ?? 0) + 1;
                        if (!bestColony.buildingOwners) bestColony.buildingOwners = {};
                        if (!bestColony.buildingOwners['Farm']) bestColony.buildingOwners['Farm'] = {};
                        bestColony.buildingOwners['Farm'][company.id] = (bestColony.buildingOwners['Farm'][company.id] || 0) + 1;

                        const cost = 500; // Flat build cost per farm — cheaper than other buildings to encourage food investment
                        transferWithLedger(next, companyAccount, createExternalAccount('corp_expansion_sink'), cost, 'CORP_EXPANSION',
                            { companyId: company.id, colonyId: bestColony.id, type: 'Farm' }, rng);
                        messageValue = `${company.name} established a new farm complex on ${bestColony.name}.`;
                    }
                } else if (company.type === 'Commercial') {
                    // Decide if building Office or Store based on slot scarcity or randomly
                    const buildingOffices = rng.chance(0.3);
                    const pool = buildingOffices ? empireColonies : eligibleColonies; // Offices ignore slot cap!

                    bestColony = pool.sort((a, b) => {
                        const bScore = b.population * (b.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                        const aScore = a.population * (a.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                        return bScore - aScore;
                    })[0];

                    if (bestColony) {
                        const targetBuilding = buildingOffices ? 'CorporateOffice' : 'Store';
                        if (targetBuilding === 'Store') bestColony.stores = (bestColony.stores ?? 0) + 1;
                        if (targetBuilding === 'CorporateOffice') bestColony.corporateOffices = (bestColony.corporateOffices ?? 0) + 1;

                        const cost = buildThreshold * 0.5;
                        transferWithLedger(next, companyAccount, createExternalAccount('corp_expansion_sink'), cost, 'CORP_EXPANSION',
                            { companyId: company.id, colonyId: bestColony.id, type: targetBuilding }, rng);
                        messageValue = `${company.name} opened a new ${targetBuilding} on ${bestColony.name}.`;
                    }
                } else if (company.type === 'Transport') {
                    const highMigrationDemand = totalMigrantDemand > 5.0;
                    const shortages: { colony: Colony, res: string, amount: number }[] = [];
                    const surplus: { colony: Colony, res: string, amount: number }[] = [];
                    for (const c of empireColonies) {
                        for (const res of BALANCING.MINERAL_NAMES) {
                            const demand = c.demand[res] || 0;
                            const stock = c.minerals[res] || 0;
                            if (demand > stock + 100) shortages.push({ colony: c, res, amount: demand - stock });
                            if (stock > demand + 1000) surplus.push({ colony: c, res, amount: stock - demand });
                        }
                    }
                    const validTradePair = shortages.find(s => surplus.some(sup => sup.res === s.res));

                    const sy = empireColonies
                        .filter(c => c.shipyards.some(sy => sy.activeBuilds.length < sy.slipways))
                        .sort((a) => (a.id === company.homeColonyId ? -1 : 1))[0]
                        ?.shipyards.find(s => s.activeBuilds.length < s.slipways);

                    if (sy && (highMigrationDemand || validTradePair)) {
                        let selectedDesign = null;
                        if (highMigrationDemand && company.wealth > 8000) {
                            selectedDesign = empire.designLibrary.find(d => d.role === 'ColonyShip');
                        } else if (validTradePair && company.wealth > 10000) {
                            selectedDesign = empire.designLibrary.find(d => d.role === 'Freighter');
                        }

                        if (selectedDesign) {
                            const wealthCost = selectedDesign.bpCost * 10;
                            const govTax = wealthCost * 0.1;
                            transferWithLedger(next, companyAccount, createExternalAccount('shipyard_build'), wealthCost, 'CORP_EXPANSION',
                                { companyId: company.id, designId: selectedDesign.id }, rng);
                            transferWithLedger(next, companyAccount, treasuryAccount, govTax, 'SHIP_PURCHASE_TAX',
                                { companyId: company.id, empireId: empire.id }, rng);

                            sy.activeBuilds.push({
                                id: generateId('item', rng),
                                type: 'Ship',
                                name: selectedDesign.name,
                                designId: selectedDesign.id,
                                quantity: 1,
                                progress: 0,
                                bpCostPerUnit: selectedDesign.bpCost,
                                costPerUnit: { ...selectedDesign.mineralCost },
                                sourceCompanyId: company.id
                            });
                            messageValue = `${company.name} commissioned a ${selectedDesign.role} to meet empire demands.`;
                        }
                    } else {
                        bestColony = eligibleColonies.sort((a, b) => {
                            const bScore = (b.productionQueue.length || 1) * (b.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                            const aScore = (a.productionQueue.length || 1) * (a.incentives?.preferredSector === company.type ? 2.0 : 1.0);
                            return bScore - aScore;
                        })[0];

                        if (bestColony) {
                            bestColony.constructionOffices = (bestColony.constructionOffices ?? 0) + 1;
                            const cost = buildThreshold * 0.5;
                            transferWithLedger(next, companyAccount, createExternalAccount('corp_expansion_sink'), cost, 'CORP_EXPANSION',
                                { companyId: company.id, colonyId: bestColony.id, type: 'ConstructionOffice' }, rng);
                            messageValue = `${company.name} established a new construction office on ${bestColony.name}.`;
                        }
                    }
                }

                if (messageValue) {
                    events.push({
                        id: generateId('evt', rng),
                        turn: next.turn,
                        date: next.date.toISOString().split('T')[0],
                        type: 'CivilianExpansion',
                        message: messageValue,
                        important: false
                    } as GameEvent);
                }
            }

            // Dividends: explicit company → treasury transfer
            if (company.wealth > 5000) {
                const dividend = company.wealth * 0.02 * chancePerTick * 365;
                if (dividend > 1) {
                    transferWithLedger(next, companyAccount, treasuryAccount, dividend, 'CORPORATE_DIVIDEND',
                        { companyId: company.id, empireId: empire.id }, rng);
                }
            }

            // R&D
            const rdChance = company.strategy === 'Vanguard' ? 0.05 : 0.01;
            if (rng.chance(rdChance)) updateCorporateDesign(company, empire, next, rng);
        }
    }

    // --- Tender Processing ---
    events.push(...processTenders(next, empire, rng));

    // --- Company Founding (Balanced) ---
    for (const colony of empireColonies) {
        const existingOnColony = empire.companies.filter(c => c.homeColonyId === colony.id).length;
        const foundationChance = 0.05 / (1 + existingOnColony);
        const avgHabitability = (colony.populationSegments && colony.populationSegments.length > 0 && colony.population > 0)
            ? colony.populationSegments.reduce((sum, s) => sum + (s.habitability || 0) * s.count, 0) / colony.population : 1.0;
        const adjustedFoundationChance = foundationChance * avgHabitability;

        if ((colony.privateWealth || 0) > BALANCING.CORP_FOUND_WEALTH_THRESHOLD && colony.population > (existingOnColony + 1) * 20 && rng.chance(adjustedFoundationChance)) {
            const types: CompanyType[] = ['Transport', 'Extraction', 'Manufacturing', 'Agricultural', 'Commercial'];

            const type = rng.pick(types);
            const name = generateCompanyName(rng, type);

            const availableCEOs = empire.officers.filter(o => !o.assignedTo && o.role === 'CEO');
            let ceoId: string;
            if (availableCEOs.length > 0) {
                const ceo = rng.pick(availableCEOs);
                ceoId = ceo.id;
                ceo.assignedTo = `company_${name}`;
            } else {
                const bonuses = getEmpireTechBonuses(empire.research.completedTechs);
                const ceo = createOfficer('CEO', bonuses, rng.next() * 1000000);
                ceo.assignedTo = `company_${name}`;
                empire.officers.push(ceo);
                ceoId = ceo.id;
            }

            const designBias = rng.pick(['Speed', 'Efficiency', 'Capacity']);
            const newCompany: Company = {
                id: generateId('corp', rng),
                name,
                type,
                homeColonyId: colony.id,
                wealth: 5000,
                valuation: 5000,
                activeFreighters: type === 'Transport' ? 1 : 0,
                ceoId,
                strategy: rng.pick(['Expansionist', 'Optimized', 'Vanguard']),
                designBias: designBias as 'Speed' | 'Efficiency' | 'Capacity',
                explorationLicenseIds: [],
                history: [],
                transactions: []
            };

            // econ-001/econ-005: Founding debit is an explicit colony→company transfer
            const colAccount = createColonyPrivateWealthAccount(colony);
            transferWithLedger(next, colAccount, createCompanyAccount(newCompany), 5000, 'CORP_FOUNDING',
                { colonyId: colony.id, empireId: empire.id, companyType: type }, rng);

            empire.companies.push(newCompany);
            events.push({
                id: generateId('evt', rng),
                turn: next.turn,
                date: next.date.toISOString().split('T')[0],
                type: 'CompanyFounded',
                message: `A new ${type} corporation, ${name}, was founded on ${colony.name}.`,
                important: true
            } as GameEvent);
        }
    }

    // --- Fleet AI (Physical Logistics) ---
    tickCorporateLogistics(next, empire, rng);

    return events;
}

/**
 * Assigns orders to idle corporate fleets for trade and migration.
 * @intent Physical Logistics AI. Ensures that fleets respond to shortage signals without phantom resoruce creation.
 */
function tickCorporateLogistics(state: GameState, empire: Empire, rng: RNG) {
    const empireColonies = Object.values(state.colonies).filter(c => c.empireId === empire.id);

    // 1. Identify all corporate fleets belonging to this empire
    const corpFleets = empire.fleets.filter(f => f.isCivilian && f.shipIds.length > 0);

    for (const fleet of corpFleets) {
        // Only task idle fleets
        if (fleet.orders.length > 0 || fleet.destination) continue;

        const firstShip = state.ships[fleet.shipIds[0]];
        const company = empire.companies.find(c => c.id === firstShip?.sourceCompanyId);
        if (!company || company.type !== 'Transport') continue;

        // Try to find a task for this fleet
        assignTaskToFleet(fleet, company, state, empire, empireColonies, rng);
    }
}

function assignTaskToFleet(fleet: Fleet, company: Company, state: GameState, empire: Empire, colonies: Colony[], rng: RNG): boolean {
    const hasColonizationModule = fleet.shipIds.some((sid: string) => {
        const s = state.ships[sid];
        const design = empire.designLibrary.find(d => d.id === s?.designId);
        return design?.components.some(c => c.type === 'ColonizationModule');
    });

    if (hasColonizationModule) {
        const sources = colonies.filter(c => (c.spaceport || 0) > 0 && (c.migrantsWaiting || 0) > 0.05);
        const targets = colonies.filter(c => c.migrationMode === 'Target');

        if (sources.length > 0 && targets.length > 0) {
            const source = sources.sort((a, b) => (b.migrantsWaiting || 0) - (a.migrantsWaiting || 0))[0];
            const target = targets.sort((a, b) => (a.population / a.maxPopulation) - (b.population / b.maxPopulation))[0];

            fleet.orders = [
                { id: generateId('order', rng), type: 'MoveTo', targetPlanetId: source.planetId },
                { id: generateId('order', rng), type: 'Migrate', targetPlanetId: source.planetId, cargoAction: 'Load', amount: 1.0, originId: source.id, targetId: target.id },
                { id: generateId('order', rng), type: 'MoveTo', targetPlanetId: target.planetId },
                { id: generateId('order', rng), type: 'Migrate', targetPlanetId: target.planetId, cargoAction: 'Unload', originId: source.id, targetId: target.id }
            ];
            return true;
        }
    }

    const hasCargo = fleet.shipIds.some((sid: string) => {
        const s = state.ships[sid];
        const design = empire.designLibrary.find(d => d.id === s?.designId);
        return design?.components.some(c => c.type === 'Cargo');
    });

    if (hasCargo) {
        const shortages: { colony: Colony, res: string, amount: number }[] = [];
        const surplus: { colony: Colony, res: string, amount: number }[] = [];

        for (const c of colonies) {
            for (const res of BALANCING.MINERAL_NAMES) {
                const demand = c.demand[res] || 0;
                const stock = c.minerals[res] || 0;
                if (demand > stock + 10) shortages.push({ colony: c, res, amount: demand - stock });
                if (stock > demand + 500 && c.spaceport > 0) surplus.push({ colony: c, res, amount: stock - demand });
            }
        }

        const validTrade = shortages.find(s => surplus.some(sup => sup.res === s.res));
        if (validTrade) {
            const supplier = surplus.find(sup => sup.res === validTrade.res)!.colony;

            fleet.orders = [
                { id: generateId('order', rng), type: 'MoveTo', targetPlanetId: supplier.planetId },
                { id: generateId('order', rng), type: 'Transport', targetPlanetId: supplier.planetId, resourceName: validTrade.res, cargoAction: 'Load', originId: supplier.id, targetId: validTrade.colony.id },
                { id: generateId('order', rng), type: 'MoveTo', targetPlanetId: validTrade.colony.planetId },
                { id: generateId('order', rng), type: 'Transport', targetPlanetId: validTrade.colony.planetId, resourceName: validTrade.res, cargoAction: 'Unload', originId: supplier.id, targetId: validTrade.colony.id }
            ];
            return true;
        }
    }

    return false;
}

export function tickOfficerLifecycle(next: GameState, empire: Empire, rng: RNG, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const officerChancePerTick = (dt / 86400) / 30;

    if (rng.chance(officerChancePerTick)) {
        if (empire.officers.length < 25 && rng.chance(0.15)) {
            const roles: OfficerRole[] = ['Governor', 'Scientist', 'Engineer', 'Admiral', 'Captain', 'CEO'];
            const role = rng.pick(roles);
            const bonuses = getEmpireTechBonuses(empire.research.completedTechs);
            const newOfficer = createOfficer(role, bonuses, rng.next() * 1000000);
            empire.officers.push(newOfficer);
            events.push({
                id: generateId('evt', rng),
                turn: next.turn,
                date: next.date.toISOString().split('T')[0],
                type: 'OfficerSpawned',
                message: `A promising new ${role}, ${newOfficer.name}, has risen through the ranks and joined the officer corps.`,
                important: true
            } as GameEvent);
        }

        const retirementCandidates = empire.officers.filter(o => o.level > 1 || o.experience > 50);
        for (const officer of retirementCandidates) {
            if (rng.chance(0.05)) {
                empire.officers = empire.officers.filter(o => o.id !== officer.id);
                const reason = rng.chance(0.2) ? 'died peacefully' : 'retired from active service';
                events.push({
                    id: generateId('evt', rng),
                    turn: next.turn,
                    date: next.date.toISOString().split('T')[0],
                    type: 'OfficerRetired',
                    message: `Level ${officer.level} ${officer.role} ${officer.name} has ${reason}.`,
                    important: true
                } as GameEvent);
                break;
            }
        }
    }
    return events;
}

export function processTenders(next: GameState, empire: Empire, rng: RNG): GameEvent[] {
    const events: GameEvent[] = [];
    const nowStr = next.date.toISOString().split('T')[0];
    const treasuryAccount = createTreasuryAccount(empire);

    for (const tender of next.tenders) {
        if (tender.empireId !== empire.id) continue;
        if (nowStr >= tender.closingDate) continue;

        for (const company of empire.companies) {
            if (company.type !== 'Extraction') continue;
            if (tender.highestBidderId === company.id) continue;

            const maxBidPercent = company.strategy === 'Expansionist' ? 0.8 : 0.5;
            const maxBid = company.wealth * maxBidPercent;
            if (maxBid > tender.highestBid && rng.chance(0.1)) {
                const bidIncrease = Math.floor(tender.highestBid * 0.1) + 100;
                const newBid = tender.highestBid + bidIncrease;

                if (newBid <= maxBid) {
                    tender.highestBid = newBid;
                    tender.highestBidderId = company.id;
                    tender.bids.push({ companyId: company.id, amount: newBid });

                    events.push({
                        id: generateId('evt', rng),
                        turn: next.turn,
                        date: nowStr,
                        type: 'TenderBid',
                        message: `${company.name} placed a leading bid of ${newBid} for system ${tender.systemId}.`,
                        important: false
                    } as GameEvent);
                }
            }
        }
    }

    const expiredIndices: number[] = [];
    next.tenders.forEach((tender, idx) => {
        if (tender.empireId === empire.id && nowStr >= tender.closingDate) {
            expiredIndices.push(idx);

            if (tender.highestBidderId) {
                const winner = empire.companies.find(c => c.id === tender.highestBidderId);
                if (winner) {
                    transferWithLedger(next, createCompanyAccount(winner), treasuryAccount, tender.highestBid, 'TENDER_PAYMENT',
                        { companyId: winner.id, empireId: empire.id, systemId: tender.systemId }, rng);

                    if (!winner.transactions) winner.transactions = [];
                    winner.transactions.push({
                        date: nowStr,
                        amount: -tender.highestBid,
                        type: 'Investment',
                        description: `Won mining tender for system ${tender.systemId}`
                    });

                    winner.explorationLicenseIds.push(tender.systemId);
                    events.push({
                        id: generateId('evt', rng),
                        turn: next.turn,
                        date: nowStr,
                        type: 'TenderResolved',
                        message: `${winner.name} won the mining tender for system ${tender.systemId} with a bid of ${tender.highestBid}!`,
                        important: true
                    } as GameEvent);
                }
            } else {
                events.push({
                    id: generateId('evt', rng),
                    turn: next.turn,
                    date: nowStr,
                    type: 'TenderResolved',
                    message: `The mining tender for system ${tender.systemId} closed with no bidders.`,
                    important: true
                } as GameEvent);
            }
        }
    });

    next.tenders = next.tenders.filter((_, i) => !expiredIndices.includes(i));
    return events;
}

function calculateMaintenance(company: Company, empire: Empire, staffingLevel: number = 1.0): number {
    let cost = 0;
    cost += company.activeFreighters * 2.0;
    cost += company.explorationLicenseIds.length * 5.0;

    const ceo = empire.officers.find(o => o.id === company.ceoId);
    let strategyBonus = 0;
    if (company.strategy === 'Optimized') strategyBonus = 0.3;

    const wagePremium = staffingLevel < 0.9 ? (1 + (0.9 - staffingLevel) * 2) : 1.0;
    const efficiency = (ceo?.bonuses?.admin_cost ? (1 - ceo.bonuses.admin_cost) : 1) * (1 - strategyBonus);

    return cost * efficiency * wagePremium;
}

function updateCorporateDesign(company: Company, empire: Empire, game: GameState, rng: RNG) {
    if (company.type !== 'Transport') return;

    const unlockedTech = new Set(empire.research.completedTechs);
    const available = COMPONENT_LIBRARY.filter(c => !c.requiredTech || unlockedTech.has(c.requiredTech));

    const reactors = available.filter(c => c.type === 'Reactor').sort((a, b) => (b.stats.powerOutput || 0) - (a.stats.powerOutput || 0));
    const engines = available.filter(c => c.type === 'Engine');
    const tanks = available.filter(c => c.type === 'FuelTank').sort((a, b) => (b.stats.capacity || 0) - (a.stats.capacity || 0));
    const holds = available.filter(c => c.type === 'Cargo').sort((a, b) => (b.stats.cargoCapacity || 0) - (a.stats.cargoCapacity || 0));
    const colModules = available.filter(c => c.type === 'ColonizationModule');

    if (reactors.length === 0 || engines.length === 0) return;

    const migrationDemand = Object.values(game.colonies).some(c => (c.migrantsWaiting || 0) > 1.0);

    let selectedEngine = engines[0];
    if (company.designBias === 'Speed') {
        selectedEngine = [...engines].sort((a, b) => (b.stats.thrust || 0) - (a.stats.thrust || 0))[0];
    } else if (company.designBias === 'Efficiency') {
        selectedEngine = [...engines].sort((a, b) => (a.stats.fuelPerTick || 0) - (b.stats.fuelPerTick || 0))[0];
    }

    const isColonistTransport = migrationDemand && colModules.length > 0 && rng.chance(0.4);

    const componentIds = [
        reactors[0].id,
        selectedEngine.id,
        tanks[0].id,
        isColonistTransport ? colModules[0].id : holds[0].id,
        'scanner_optic_sm'
    ];

    const role = isColonistTransport ? 'ColonyShip' : 'Freighter';
    const designId = `corp_design_${company.id}_${game.turn}`;
    const designName = `${company.name} ${rng.pick(isColonistTransport ? ['Pioneer', 'Mayflower', 'Voyager', 'Pathfinder'] : ['Venture', 'Bulk', 'Express', 'Hauler'])}-class`;

    const newDesign = createDesign(designId, designName, role, componentIds);
    newDesign.role = role;

    if (company.strategy === 'Vanguard') {
        newDesign.speed *= 1.1;
    }

    const existing = empire.designLibrary.find(d => d.id === company.preferredDesignId);
    if (!existing || newDesign.speed !== existing.speed || newDesign.bpCost !== existing.bpCost) {
        empire.designLibrary.push(newDesign);
        company.preferredDesignId = designId;
    }
}
