import { GameState, TickLength, Fleet, Company, Ship, Colony, Empire, ShipDesign, Officer, CompanyType } from '@/types';
import { generateGalaxy } from './galaxy';
import { generateRealSpaceGalaxy } from './realspace';
import { createOfficer, generateCompanyName } from './officers';
import { getPlanetPosition } from './fleets';
import { createStartingDesigns } from './ships';
import { getEmpireTechBonuses } from './research';
import { generateId } from '@/utils/id';
import { RNG } from '@/utils/rng';
import { BALANCING } from './constants';

export function setupNewGame(playerName: string, seed: number, realSpace?: boolean): GameState {
    const rng = new RNG(seed);
    const galaxy = realSpace ? generateRealSpaceGalaxy() : generateGalaxy(seed);

    // 1. Create Base Empire
    const playerEmpireId = 'empire_player';
    const homeStarId = 'star_0'; // Sol is always index 0

    const playerEmpire: Empire = {
        id: playerEmpireId,
        name: playerName,
        color: '#4fc3f7',
        isPlayer: true,
        homeSystemId: homeStarId,
        homePlanetId: '', // Set below
        minerals: {
            Iron: 500000,
            Copper: 200000,
            Uranium: 50000,
            Titanium: 100000,
            Tungsten: 100000,
            Cobalt: 100000,
            Lithium: 100000,
            Platinum: 50000,
            Ambergris: 20000,
            Aether: 100000,
            Fuel: 100000,
            Food: 1000000
        },
        research: {
            activeProjects: [],
            completedTechs: ['analytical_engine', 'steam_refinement', 'bessemer_process', 'aetheric_dynamo'],
        },
        officers: [],
        fleets: [],
        designLibrary: [],
        treasury: 10000,
        privateWealth: 20000,
        tradeRoutes: [],
        companies: [],
        events: [{
            id: 'evt_start',
            turn: 0,
            date: '1920-03-20',
            type: 'SystemExplored',
            message: `The Analytical Engine has changed everything. Steam and computation have propelled the ${playerName} to the stars. The Mechanical Spring begins.`,
            important: true,
        }],
        history: [],
    };

    // 2. Set up Home System & Planet
    const homeStar = galaxy.stars[homeStarId];
    const homeIndex = realSpace ? 2 : (homeStar?.planets.length > 2 ? 2 : 0);
    const homePlanet = homeStar?.planets[homeIndex] ?? homeStar?.planets[0];
    const homePlanetId = homePlanet?.id ?? 'planet_Sol_Earth';

    playerEmpire.homePlanetId = homePlanetId;

    // 3. Create Home Colony
    const homeColony: Colony = {
        id: generateId('colony', rng),
        empireId: playerEmpireId,
        planetId: homePlanetId,
        name: realSpace ? 'Earth' : 'New Terra',
        population: realSpace ? 2000 : 800,
        populationSegments: [{
            speciesId: 'human' as const,
            count: realSpace ? 2000 : 800,
            happiness: 50,
            habitability: 1.0,
        }],
        maxPopulation: realSpace ? 25000 : 15000,
        populationGrowthRate: realSpace ? 0.015 : 0.02,
        policy: 'Normal' as const,
        happiness: 50,
        minerals: {
            Iron: 500000,
            Copper: 200000,
            Uranium: 50000,
            Titanium: 100000,
            Tungsten: 100000,
            Cobalt: 100000,
            Lithium: 100000,
            Platinum: 50000,
            Ambergris: 20000,
            Aether: 100000,
            Fuel: 100000,
            Food: 1000000
        },
        demand: { Iron: 0, Copper: 0, Uranium: 0, Titanium: 0, TradeGoods: 0 },
        privateWealth: realSpace ? 5000 : 2000,
        infrastructure: realSpace ? 3000 : 1000,
        colonyType: 'Core' as const,
        laborAllocation: {
            industry: 30,
            mining: 20,
            research: 15,
            construction: 15,
            agriculture: 5,
            commerce: 15,
        },
        governorId: undefined,
        productionQueue: [],
        factories: 25,
        mines: 10,
        civilianFactories: 25,
        civilianMines: 10,
        researchLabs: 3,
        spaceport: 1,
        groundDefenses: 0,
        shipyards: [{ id: generateId('sy', rng), name: 'Royal Orbital Yards', slipways: 1, maxTonnage: 100000, activeBuilds: [] }],
        constructionOffices: 10,
        farms: realSpace ? 300 : 100,
        commercialCenters: 20,
        terraformProgress: 100,
        logisticsHubs: 0,
        migrationMode: 'Stable',
        history: [],
        aethericDistillery: 5,
        aethericSiphons: 0,
        deepCoreExtractors: 0,
        reclamationPlants: 0,
    };

    if (homePlanet) {
        homePlanet.colonies = [homeColony];
        homePlanet.surveyedByEmpires = [playerEmpireId];
    }

    // 4. Starting Personnel
    const startBonuses = getEmpireTechBonuses(playerEmpire.research.completedTechs);
    const governor = createOfficer('Governor', startBonuses, rng.next() * 1000000);
    const scientists = [
        createOfficer('Scientist', startBonuses, rng.next() * 1000000),
        createOfficer('Scientist', startBonuses, rng.next() * 1000000),
        createOfficer('Scientist', startBonuses, rng.next() * 1000000),
    ];
    const engineers = [
        createOfficer('Engineer', startBonuses, rng.next() * 1000000),
        createOfficer('Engineer', startBonuses, rng.next() * 1000000),
    ];
    const admiral = createOfficer('Admiral', startBonuses, rng.next() * 1000000);
    const startingCEOs = Array.from({ length: 5 }, () => createOfficer('CEO', startBonuses, rng.next() * 1000000));

    governor.assignedTo = homeColony.id;
    homeColony.governorId = governor.id;
    playerEmpire.officers = [governor, ...scientists, ...engineers, admiral, ...startingCEOs];

    // 5. Initial Research
    playerEmpire.research.activeProjects = [
        {
            id: generateId('prj', rng),
            techId: 'rocket_propulsion',
            scientistId: scientists[0].id,
            labs: 3,
            investedPoints: 0,
            priority: 1
        }
    ];
    scientists[0].assignedTo = playerEmpire.research.activeProjects[0].id;

    // 6. Fleets & Designs
    playerEmpire.designLibrary = createStartingDesigns();
    const pos = homePlanet ? getPlanetPosition(homePlanet, 0) : { x: 0, y: 0 };
    const ships: Record<string, Ship> = {};

    // 7. Corporate Sector
    const companies: Company[] = startingCEOs.map((ceo, i) => {
        const types: CompanyType[] = ['Transport', 'Extraction', 'Manufacturing', 'Agricultural', 'Commercial'];
        const type = types[i];
        const name = generateCompanyName(rng, type);
        ceo.assignedTo = `company_${name}`;

        const corpId = generateId('corp', rng);

        // Spawn starting freighter for Transport company
        if (type === 'Transport') {
            const design = playerEmpire.designLibrary.find(d => d.id === 'design_freighter');
            if (design) {
                const shipId = generateId('ship', rng);
                const ship: Ship = {
                    id: shipId,
                    name: `GSC ${design.name} Alpha`, // GSC for Grand Shipping Co (tradition)
                    designId: design.id,
                    empireId: playerEmpireId,
                    hullPoints: design.maxHullPoints,
                    maxHullPoints: design.maxHullPoints,
                    fuel: design.fuelCapacity,
                    experience: 0,
                    cargo: {},
                    inventory: [],
                    sourceCompanyId: corpId,
                };
                ships[shipId] = ship;

                const fleetId = generateId('fleet', rng);
                const fleet: Fleet = {
                    id: fleetId,
                    name: `${name} Fleet #1`,
                    empireId: playerEmpireId,
                    shipIds: [shipId],
                    currentStarId: homeStarId,
                    position: pos,
                    orbitingPlanetId: homePlanet?.id,
                    orders: [],
                    isCivilian: true,
                    ownerCompanyId: corpId
                };
                playerEmpire.fleets.push(fleet);
            }
        }

        return {
            id: corpId,
            name,
            type,
            homeColonyId: homeColony.id,
            wealth: 10000,
            valuation: 10000,
            activeFreighters: 1,
            ceoId: ceo.id,
            strategy: rng.pick(['Expansionist', 'Optimized', 'Vanguard']),
            designBias: rng.pick(['Speed', 'Efficiency', 'Capacity']),
            explorationLicenseIds: [],
            history: [],
            transactions: []
        };
    });
    playerEmpire.companies = companies;

    // 8. Initial Military Fleets
    const startFleetConfigs = [
        { d: 'design_survey', n: 'Pioneer Survey Fleet' },
        { d: 'design_freighter', n: 'Mammoth Trade Fleet' },
        { d: 'design_colony', n: 'Ark Colonization Fleet' },
    ];

    for (const config of startFleetConfigs) {
        const design = playerEmpire.designLibrary.find(d => d.id === config.d);
        if (!design) continue;

        const shipId = generateId('ship');
        const ship: Ship = {
            id: shipId,
            name: `${design.name} Alpha`,
            designId: design.id,
            empireId: playerEmpireId,
            hullPoints: design.maxHullPoints,
            maxHullPoints: design.maxHullPoints,
            fuel: design.fuelCapacity,
            experience: 0,
            cargo: {},
            inventory: [],
        };
        ships[shipId] = ship;

        const fleetId = generateId('fleet', rng);
        const fleet: Fleet = {
            id: fleetId,
            name: config.n,
            empireId: playerEmpireId,
            shipIds: [shipId],
            currentStarId: homeStarId,
            position: pos,
            orbitingPlanetId: homePlanet?.id,
            orders: []
        };
        playerEmpire.fleets.push(fleet);

        if (config.n === 'Mammoth Trade Fleet') {
            admiral.assignedTo = fleetId;
        }
    }

    // 9. Final Assemble
    return {
        id: `game_${seed}`,
        phase: 'Playing',
        turn: 0,
        date: new Date('1920-03-20'),
        seed,
        initialSeed: seed,
        galaxy,
        empires: { [playerEmpireId]: playerEmpire },
        ships,
        colonies: { [homeColony.id]: homeColony },
        playerEmpireId,
        tickLength: 86400 as TickLength,
        tenders: [],
        stats: {
            totalProduced: {},
            totalConsumed: {},
            totalConverted: {},
        },
    };
}
