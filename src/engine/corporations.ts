'use client';
import type { GameState, Empire, Company, CompanyType, GameEvent, OfficerRole, Colony, Fleet } from '@/types';
import { generateId } from '@/utils/id';
import { RNG } from '@/utils/rng';
import { generateCompanyName, createOfficer } from './officers';
import { getEmpireTechBonuses } from './research';
import { BALANCING } from './constants';
import { COMPONENT_LIBRARY, createDesign } from './ships';

export function tickCorporations(next: GameState, empire: Empire, rng: RNG, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);

    // ── Corporate Operations (Every Tick) ──
    for (const company of empire.companies) {
        const homeColony = empireColonies.find(c => c.id === company.homeColonyId);

        // 1. Maintenance & Revenue
        const maintenance = calculateMaintenance(company, empire, homeColony?.staffingLevel);
        company.wealth -= maintenance;



        let tickRevenue = 0;
        if (homeColony) {
            const staffingEff = homeColony.staffingLevel || 1.0;
            if (company.type === 'Agricultural') {
                tickRevenue = ((homeColony.population * 0.1) / (homeColony.farms || 1)) * BALANCING.TRADE_GOOD_VALUE * staffingEff;
            } else if (company.type === 'Commercial') {
                tickRevenue = ((homeColony.privateWealthIncome ?? 0) / (homeColony.commercialCenters || 1)) * 0.5 * staffingEff;
            } else if (company.type === 'Manufacturing') {
                tickRevenue = ((homeColony.privateWealthIncome ?? 0) / (homeColony.civilianFactories || 1)) * 0.3 * staffingEff;
            } else if (company.type === 'Extraction') {
                tickRevenue = (1 + company.explorationLicenseIds.length * 0.2) * 20 * staffingEff;
            } else if (company.type === 'Transport') {
                tickRevenue = (company.activeFreighters || 0) * 15 * staffingEff;
            } else if (company.type === 'AethericSiphon') {
                tickRevenue = (homeColony.aethericSiphons || 0) * 80 * staffingEff;
            } else if (company.type === 'DeepCoreMining') {
                tickRevenue = (homeColony.deepCoreExtractors || 0) * 70 * staffingEff;
            } else if (company.type === 'Reclamation') {
                tickRevenue = (homeColony.reclamationPlants || 0) * 40 * staffingEff;
            }
        }
        company.wealth += tickRevenue;

        // 2. Valuation Update
        const assetsValue = ((company.activeFreighters || 0) * 1000) + (company.explorationLicenseIds.length * 500);
        company.valuation = company.wealth + assetsValue;

        // 3. History Logging
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
    const chancePerTick = (dt / 86400) / 365;
    if (rng.chance(chancePerTick)) {
        const totalMigrantDemand = empireColonies.reduce((sum, c) => sum + (c.migrantsWaiting || 0), 0);

        for (const company of empire.companies) {
            const homeColony = empireColonies.find(c => c.id === company.homeColonyId);
            const ceo = empire.officers.find(o => o.id === company.ceoId);
            const revBonus = ceo?.bonuses?.corp_revenue ? (1 + ceo.bonuses.corp_revenue) : 1;
            const buildThreshold = 5000 / revBonus;

            if (homeColony && company.wealth > buildThreshold) {
                let messageValue = '';
                if (company.wealth > buildThreshold) {
                    let messageValue = '';

                    // --- Find Best Target Colony for Expansion ---
                    let bestColony: Colony | undefined = homeColony;
                    const otherColonies = empireColonies.filter(c => c.id !== company.homeColonyId);

                    if (company.type === 'Extraction') {
                        // Pick colony with highest accessibility for a random mineral
                        const res = rng.pick(BALANCING.MINERAL_NAMES);
                        const planets = Object.values(next.galaxy.stars).flatMap(s => s.planets);
                        bestColony = empireColonies.sort((a, b) => {
                            const bPlanet = planets.find(p => p.id === b.planetId);
                            const aPlanet = planets.find(p => p.id === a.planetId);
                            const bAcc = bPlanet?.minerals.find(m => m.name === res)?.accessibility || 0;
                            const aAcc = aPlanet?.minerals.find(m => m.name === res)?.accessibility || 0;
                            return bAcc - aAcc;
                        })[0];

                        if (bestColony) {
                            bestColony.civilianMines = (bestColony.civilianMines ?? 0) + 1;
                            const cost = buildThreshold * 0.5;
                            company.wealth -= cost;
                            messageValue = `${company.name} expanded mining on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'Manufacturing') {
                        // Manufacturing likes population hubs
                        bestColony = empireColonies.sort((a, b) => b.population - a.population)[0];
                        if (bestColony) {
                            bestColony.civilianFactories = (bestColony.civilianFactories ?? 0) + 1;
                            const cost = buildThreshold * 0.5;
                            company.wealth -= cost;
                            messageValue = `${company.name} built a new factory on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'Agricultural') {
                        // Agri likes habitability and population
                        bestColony = empireColonies.sort((a, b) => (b.maxPopulation * b.happiness) - (a.maxPopulation * a.happiness))[0];
                        if (bestColony) {
                            bestColony.farms = (bestColony.farms ?? 0) + 1;
                            const cost = buildThreshold * 0.5;
                            company.wealth -= cost;
                            messageValue = `${company.name} established a new farm complex on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'Commercial') {
                        bestColony = empireColonies.sort((a, b) => b.population - a.population)[0];
                        if (bestColony) {
                            bestColony.commercialCenters = (bestColony.commercialCenters ?? 0) + 1;
                            const cost = buildThreshold * 0.5;
                            company.wealth -= cost;
                            messageValue = `${company.name} opened a new commercial center on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'Transport') {
                        // If high migrant demand, build a ship. Otherwise expansion logic below.
                        const highMigrationDemand = totalMigrantDemand > 5.0; // Signal to build more colonizers
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
                            .sort((a, b) => (a.id === company.homeColonyId ? -1 : 1))[0]
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
                                company.wealth -= (wealthCost + govTax);
                                empire.treasury += govTax;

                                sy.activeBuilds.push({
                                    id: generateId('item'),
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
                            // Expand logistics hubs on outposts with high trade volume or demand
                            bestColony = empireColonies.sort((a, b) => (Object.keys(a.demand).length) - (Object.keys(b.demand).length))[0];
                            if (bestColony) {
                                bestColony.logisticsHubs = (bestColony.logisticsHubs ?? 0) + 1;
                                const cost = buildThreshold * 0.5;
                                company.wealth -= cost;
                                messageValue = `${company.name} established a new logistics hub on ${bestColony.name}.`;
                            }
                        }
                    } else if (company.type === 'AethericSiphon') {
                        // Siphons like planets with high Aether accessibility
                        const planets = Object.values(next.galaxy.stars).flatMap(s => s.planets);
                        bestColony = empireColonies.sort((a, b) => {
                            const bPlanet = planets.find(p => p.id === b.planetId);
                            const aPlanet = planets.find(p => p.id === a.planetId);
                            const bAether = bPlanet?.minerals.find(m => m.name === 'Aether')?.accessibility || 0;
                            const aAether = aPlanet?.minerals.find(m => m.name === 'Aether')?.accessibility || 0;
                            return bAether - aAether;
                        })[0];
                        if (bestColony) {
                            bestColony.aethericSiphons = (bestColony.aethericSiphons ?? 0) + 1;
                            company.wealth -= buildThreshold * 0.5;
                            messageValue = `${company.name} installed a new Aetheric Siphon on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'DeepCoreMining') {
                        // Deep core mining finds rich minerals
                        bestColony = empireColonies.sort((a, b) => b.population - a.population)[0]; // Placeholder logic
                        if (bestColony) {
                            bestColony.deepCoreExtractors = (bestColony.deepCoreExtractors ?? 0) + 1;
                            company.wealth -= buildThreshold * 0.5;
                            messageValue = `${company.name} deployed a Deep Core Extractor on ${bestColony.name}.`;
                        }
                    } else if (company.type === 'Reclamation') {
                        // Reclamation works best on large industrial hubs
                        bestColony = empireColonies.sort((a, b) => (b.civilianFactories + b.factories) - (a.civilianFactories + a.factories))[0];
                        if (bestColony) {
                            bestColony.reclamationPlants = (bestColony.reclamationPlants ?? 0) + 1;
                            company.wealth -= buildThreshold * 0.5;
                            messageValue = `${company.name} opened a Reclamation Plant on ${bestColony.name}.`;
                        }
                    }
                }

                if (messageValue) {
                    events.push({
                        id: generateId('evt'),
                        turn: next.turn,
                        date: next.date.toISOString().split('T')[0],
                        type: 'CivilianExpansion',
                        message: messageValue,
                        important: false
                    } as GameEvent);
                }
            }

            // Dividends
            if (company.wealth > 5000) {
                const dividend = company.wealth * 0.02 * chancePerTick * 365;
                if (dividend > 1) {
                    company.wealth -= dividend;
                    empire.treasury += dividend;
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
        const foundationChance = 0.05 / (1 + existingOnColony); // Chance drops as more firms exist
        const avgHabitability = (colony.populationSegments && colony.populationSegments.length > 0 && colony.population > 0)
            ? colony.populationSegments.reduce((sum, s) => sum + (s.habitability || 0) * s.count, 0) / colony.population : 1.0;
        // Apply penalties to foundation chance
        const adjustedFoundationChance = foundationChance * avgHabitability;

        if ((colony.privateWealth || 0) > BALANCING.CORP_FOUND_WEALTH_THRESHOLD && colony.population > (existingOnColony + 1) * 20 && rng.chance(adjustedFoundationChance)) {
            const types: CompanyType[] = ['Transport', 'Extraction', 'Manufacturing', 'Agricultural', 'Commercial'];

            // Specialized Tech Unlocks
            const techBonuses = getEmpireTechBonuses(empire.research.completedTechs);
            // We check the specific tech IDs for simplicity, or we could look up company_unlock values
            if (empire.research.completedTechs.includes('aetheric_siphon_theory')) types.push('AethericSiphon');
            if (empire.research.completedTechs.includes('deep_core_mining')) types.push('DeepCoreMining');
            if (empire.research.completedTechs.includes('automated_reclamation_consortium')) types.push('Reclamation');

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
                id: generateId('corp'),
                name,
                type,
                homeColonyId: colony.id,
                wealth: 5000,
                valuation: 5000,
                activeFreighters: type === 'Transport' ? 1 : 0,
                ceoId,
                strategy: rng.pick(['Expansionist', 'Optimized', 'Vanguard']),
                designBias: designBias as any,
                explorationLicenseIds: [],
                history: [],
                transactions: []
            };
            colony.privateWealth -= 5000;
            empire.companies.push(newCompany);
            events.push({
                id: generateId('evt'),
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
    // Check for Migration Routes FIRST (Higher priority for colonizers)
    const hasColonizationModule = fleet.shipIds.some((sid: string) => {
        const s = state.ships[sid];
        const design = empire.designLibrary.find(d => d.id === s?.designId);
        return design?.components.some(c => c.type === 'ColonizationModule');
    });

    if (hasColonizationModule) {
        const sources = colonies.filter(c => c.migrationMode === 'Source' && (c.spaceport || 0) > 0 && (c.migrantsWaiting || 0) > 0.05);
        const targets = colonies.filter(c => c.migrationMode === 'Target');

        if (sources.length > 0 && targets.length > 0) {
            // Find source with most waiting
            const source = sources.sort((a, b) => (b.migrantsWaiting || 0) - (a.migrantsWaiting || 0))[0];

            // Pick target with lowest population percentage (highest need/space)
            const target = targets.sort((a, b) => (a.population / a.maxPopulation) - (b.population / b.maxPopulation))[0];

            fleet.orders = [
                { id: generateId('order'), type: 'MoveTo', targetPlanetId: source.planetId },
                { id: generateId('order'), type: 'Migrate', targetPlanetId: source.planetId, cargoAction: 'Load', amount: 1.0, originId: source.id, targetId: target.id },
                { id: generateId('order'), type: 'MoveTo', targetPlanetId: target.planetId },
                { id: generateId('order'), type: 'Migrate', targetPlanetId: target.planetId, cargoAction: 'Unload', originId: source.id, targetId: target.id }
            ];
            return true;
        }
    }

    // Check for Trade Routes
    const hasCargo = fleet.shipIds.some((sid: string) => {
        const s = state.ships[sid];
        const design = empire.designLibrary.find(d => d.id === s?.designId);
        return design?.components.some(c => c.type === 'Cargo');
    });

    if (hasCargo) {
        // Find shortages and surpluses
        const shortages: { colony: Colony, res: string, amount: number }[] = [];
        const surplus: { colony: Colony, res: string, amount: number }[] = [];

        for (const c of colonies) {
            // Loading (surplus) requires a spaceport. Unloading (shortage) does not.
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
                { id: generateId('order'), type: 'MoveTo', targetPlanetId: supplier.planetId },
                { id: generateId('order'), type: 'Transport', targetPlanetId: supplier.planetId, resourceName: validTrade.res, cargoAction: 'Load', originId: supplier.id, targetId: validTrade.colony.id },
                { id: generateId('order'), type: 'MoveTo', targetPlanetId: validTrade.colony.planetId },
                { id: generateId('order'), type: 'Transport', targetPlanetId: validTrade.colony.planetId, resourceName: validTrade.res, cargoAction: 'Unload', originId: supplier.id, targetId: validTrade.colony.id }
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
        // Chance to spawn a new officer
        if (empire.officers.length < 25 && rng.chance(0.15)) {
            const roles: OfficerRole[] = ['Governor', 'Scientist', 'Engineer', 'Admiral', 'Captain', 'CEO'];
            const role = rng.pick(roles);
            const bonuses = getEmpireTechBonuses(empire.research.completedTechs);
            const newOfficer = createOfficer(role, bonuses, rng.next() * 1000000);
            empire.officers.push(newOfficer);
            events.push({
                id: generateId('evt'),
                turn: next.turn,
                date: next.date.toISOString().split('T')[0],
                type: 'OfficerSpawned',
                message: `A promising new ${role}, ${newOfficer.name}, has risen through the ranks and joined the officer corps.`,
                important: true
            } as GameEvent);
        }

        // Retirement candidates
        const retirementCandidates = empire.officers.filter(o => o.level > 1 || o.experience > 50);
        for (const officer of retirementCandidates) {
            if (rng.chance(0.05)) {
                empire.officers = empire.officers.filter(o => o.id !== officer.id);
                const reason = rng.chance(0.2) ? 'died peacefully' : 'retired from active service';
                events.push({
                    id: generateId('evt'),
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

    // 1. Process active bids for ongoing tenders
    for (const tender of next.tenders) {
        if (tender.empireId !== empire.id) continue;
        if (nowStr >= tender.closingDate) continue;

        // Let companies bid
        for (const company of empire.companies) {
            // Extraction companies are most interested
            if (company.type !== 'Extraction') continue;

            // Don't bid if we already lead
            if (tender.highestBidderId === company.id) continue;

            // Expansionists take high risks
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
                        id: generateId('evt'),
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

    // 2. Resolve expired tenders
    const expiredIndices: number[] = [];
    next.tenders.forEach((tender, idx) => {
        if (tender.empireId === empire.id && nowStr >= tender.closingDate) {
            expiredIndices.push(idx);

            if (tender.highestBidderId) {
                const winner = empire.companies.find(c => c.id === tender.highestBidderId);
                if (winner) {
                    winner.wealth -= tender.highestBid;
                    if (!winner.transactions) winner.transactions = [];
                    winner.transactions.push({
                        date: nowStr,
                        amount: -tender.highestBid,
                        type: 'Investment',
                        description: `Won mining tender for system ${tender.systemId}`
                    });

                    winner.explorationLicenseIds.push(tender.systemId);
                    empire.treasury += tender.highestBid;

                    events.push({
                        id: generateId('evt'),
                        turn: next.turn,
                        date: nowStr,
                        type: 'TenderResolved',
                        message: `${winner.name} won the mining tender for system ${tender.systemId} with a bid of ${tender.highestBid}!`,
                        important: true
                    } as GameEvent);
                }
            } else {
                events.push({
                    id: generateId('evt'),
                    turn: next.turn,
                    date: nowStr,
                    type: 'TenderResolved',
                    message: `The mining tender for system ${tender.systemId} closed with no bidders.`,
                    important: true
                } as GameEvent);
            }
        }
    });

    // Remove resolved tenders
    next.tenders = next.tenders.filter((_, i) => !expiredIndices.includes(i));

    return events;
}

function calculateMaintenance(company: Company, empire: Empire, staffingLevel: number = 1.0): number {
    let cost = 0;
    // Maintenance based on active assets
    cost += company.activeFreighters * 2.0; // Daily cost per ship
    cost += company.explorationLicenseIds.length * 5.0; // Licensing/Survey overhead

    // Scale by CEO skill if available
    const ceo = empire.officers.find(o => o.id === company.ceoId);
    let strategyBonus = 0;
    if (company.strategy === 'Optimized') strategyBonus = 0.3; // -30% cost

    // Wage Premium if labor is scarce (Wage War)
    const wagePremium = staffingLevel < 0.9 ? (1 + (0.9 - staffingLevel) * 2) : 1.0;

    const efficiency = (ceo?.bonuses?.admin_cost ? (1 - ceo.bonuses.admin_cost) : 1) * (1 - strategyBonus);

    return cost * efficiency * wagePremium;
}

function updateCorporateDesign(company: Company, empire: Empire, game: GameState, rng: RNG) {
    if (company.type !== 'Transport') return;

    // Filter components by tech availability
    const unlockedTech = new Set(empire.research.completedTechs);

    const available = COMPONENT_LIBRARY.filter(c => !c.requiredTech || unlockedTech.has(c.requiredTech));

    // Simple auto-design logic for Freighter
    const reactors = available.filter(c => c.type === 'Reactor').sort((a, b) => (b.stats.powerOutput || 0) - (a.stats.powerOutput || 0));
    const engines = available.filter(c => c.type === 'Engine');
    const tanks = available.filter(c => c.type === 'FuelTank').sort((a, b) => (b.stats.capacity || 0) - (a.stats.capacity || 0));
    const holds = available.filter(c => c.type === 'Cargo').sort((a, b) => (b.stats.cargoCapacity || 0) - (a.stats.cargoCapacity || 0));
    const colModules = available.filter(c => c.type === 'ColonizationModule');

    if (reactors.length === 0 || engines.length === 0) return;

    // Design selection based on bias and demand
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

    // Vanguard Prototype Bonus
    if (company.strategy === 'Vanguard') {
        newDesign.speed *= 1.1; // 10% prototype performance boost
    }

    // Register in empire design library (performance: only if truly unique/better)
    const existing = empire.designLibrary.find(d => d.id === company.preferredDesignId);
    if (!existing || newDesign.speed !== existing.speed || newDesign.bpCost !== existing.bpCost) {
        empire.designLibrary.push(newDesign);
        company.preferredDesignId = designId;
    }
}
