/**
 * verify_integration.ts
 *
 * End-to-End Automated Test Script for Phases 1-3 mechanics.
 * 
 * Scenario:
 * 1. Player has a colony and a sensor picket fleet with Active Scan capability.
 * 2. An enemy (pirate) stealth fleet approaches.
 * 3. The stealth fleet is undetected until the player activates Active Scan.
 * 4. Once detected, the player fleet intercepts and attacks the pirate fleet.
 * 5. Combat resolves. If the player loses, the pirate fleet proceeds to bombard the colony.
 * 6. Bombardment reduces defenses, causes a blockade, and eventually annexes the colony.
 *
 * Run with: npm run test:integration
 */

import { setupNewGame } from '../engine/setup';
import { updateVisibility } from '../engine/detection';
import { tickFleets, getPlanetPosition } from '../engine/fleets';
import { calculateColonyBudget } from '../engine/finances';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, ShipDesign, Colony } from '../types';

const SEED = 12345;

function fail(msg: string): never {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
}

function ok(msg: string) {
    console.log(`✅ PASS: ${msg}`);
}

async function main() {
    console.log('⚙️  Setting up E2E Integration Test...\n');

    const state: GameState = setupNewGame('E2E Test Empire', SEED);
    const rng = new RNG(SEED);

    const playerEmpireId = state.playerEmpireId;
    const playerEmpire = state.empires[playerEmpireId];

    const pirateEmpireId = 'empire_pirates';
    const pirateEmpire = state.empires[pirateEmpireId];

    // --- Setup Colony ---
    const homeColony = Object.values(state.colonies).find(c => c.empireId === playerEmpireId);
    if (!homeColony) fail('No player home colony found');
    const homeColonyId = homeColony.id;
    const homePlanetId = homeColony.planetId;
    const homeStarId = playerEmpire.homeSystemId;

    const homeStar = state.galaxy.stars[homeStarId];
    const homePlanet = homeStar?.planets.find(p => p.id === homePlanetId);
    if (!homePlanet) fail(`Home planet not found`);
    const planetPos = getPlanetPosition(homePlanet, state.turn);

    state.colonies[homeColonyId].groundDefenses = 10;
    state.colonies[homeColonyId].population = 10; // Millions
    state.colonies[homeColonyId].privateWealthIncome = 1000; // Generate trade revenue that can be blockaded

    // --- Setup Designs ---
    // Player Sensor/Combat Picket
    const picketDesign: ShipDesign = {
        id: 'design_picket',
        name: 'Sensor Picket',
        hullClass: 'Corvette',
        components: [
            { id: 'c1', type: 'Sensor', name: 'Array', size: 10, powerDraw: 10, stats: { range: 100, resolution: 80 } } as any,
            { id: 'c2', type: 'ActiveSensor', name: 'Pulse', size: 10, powerDraw: 50, stats: { activeScanBoost: 3.0 } } as any,
            { id: 'c3', type: 'Weapon', name: 'Laser', size: 10, powerDraw: 10, stats: { damage: 15, range: 2, rof: 1 } } as any,
            { id: 'c4', type: 'Engine', name: 'Drive', size: 10, powerDraw: 50, stats: { thrust: 800, fuelPerTick: 0 } } as any,
        ],
        maxHullPoints: 200,
        fuelCapacity: 1000,
        speed: 8,
        weaponSystems: [{ id: 'c3', type: 'Weapon', name: 'Laser', size: 10, powerDraw: 10, stats: { damage: 15, range: 2, rof: 1 } } as any],
        powerSupply: 200,
        powerDraw: 120,
        mineralCost: {},
        bpCost: 100,
        sensorRange: 100,
    };
    playerEmpire.designLibrary.push(picketDesign);

    // Pirate Stealth Siege Ship (Strong weapons, stealth hull)
    const pirateSiegeDesign: ShipDesign = {
        id: 'design_pirate_stealth_siege',
        name: 'Ghost Siege Cruiser',
        hullClass: 'Cruiser',
        components: [
            { id: 'p1', type: 'StealthHull', name: 'Damper', size: 10, powerDraw: 0, stats: { signatureReduction: 0.2 } } as any,
            { id: 'p2', type: 'Bombardment', name: 'Mortar', size: 10, powerDraw: 20, stats: { groundDefensesDamage: 20 } } as any,
            { id: 'p3', type: 'Weapon', name: 'Cannon', size: 10, powerDraw: 20, stats: { damage: 50, range: 5, rof: 0.5 } } as any,
            { id: 'p4', type: 'Engine', name: 'Drive', size: 10, powerDraw: 200, stats: { thrust: 600, fuelPerTick: 0 } } as any,
            { id: 'p5', type: 'Shield', name: 'Deflector', size: 10, powerDraw: 100, stats: { shieldPoints: 100, recharge: 10 } } as any,
        ],
        maxHullPoints: 1000,
        fuelCapacity: 2000,
        speed: 6,
        weaponSystems: [{ id: 'p3', type: 'Weapon', name: 'Cannon', size: 10, powerDraw: 20, stats: { damage: 50, range: 5, rof: 0.5 } } as any],
        powerSupply: 500,
        powerDraw: 340,
        mineralCost: {},
        bpCost: 500,
        sensorRange: 5,
    };
    pirateEmpire.designLibrary.push(pirateSiegeDesign);

    // --- Spawn Ships and Fleets ---
    const picketShipId = generateId('ship', rng);
    state.ships[picketShipId] = { id: picketShipId, name: 'Picket 1', designId: 'design_picket', empireId: playerEmpireId, hullPoints: 200, maxHullPoints: 200, shieldPoints: 0, fuel: 1000, experience: 0, cargo: {}, inventory: [] };

    // Player fleet orbiting the home planet
    const playerFleet: Fleet = {
        id: generateId('fleet', rng), name: 'Home Guard', empireId: playerEmpireId, shipIds: [picketShipId],
        currentStarId: homeStarId, position: { x: planetPos.x, y: planetPos.y }, orders: [],
        orbitingPlanetId: homePlanetId
    };
    playerEmpire.fleets.push(playerFleet);

    const pirateShipId = generateId('ship', rng);
    state.ships[pirateShipId] = { id: pirateShipId, name: 'Ghost 1', designId: 'design_pirate_stealth_siege', empireId: pirateEmpireId, hullPoints: 1000, maxHullPoints: 1000, shieldPoints: 100, fuel: 2000, experience: 0, cargo: {}, inventory: [] };

    // Pirate fleet approaching from 800 AU away
    const START_DISTANCE = 800;
    const pirateFleet: Fleet = {
        id: generateId('fleet', rng), name: 'Silent Strike Group', empireId: pirateEmpireId, shipIds: [pirateShipId],
        currentStarId: homeStarId, position: { x: planetPos.x + START_DISTANCE, y: planetPos.y },
        orders: [
            { id: generateId('order', rng), type: 'MoveTo', targetPlanetId: homePlanetId },
            { id: generateId('order', rng), type: 'Invade', targetPlanetId: homePlanetId }
        ] as any
    };
    pirateEmpire.fleets.push(pirateFleet);

    // --- STAGE 1: Stealth Approach ---
    console.log('--- Stage 1: Stealth Approach ---');
    updateVisibility(state);

    if (pirateFleet.detectedByEmpireIds?.includes(playerEmpireId)) {
        fail('Pirate fleet was detected too early! Stealth should hide it at 800 AU.');
    } else {
        ok('Pirate fleet remains undetected at 800 AU due to stealth hull.');
    }

    // --- STAGE 2: Active Scan Detection ---
    console.log('\n--- Stage 2: Active Scan Detection ---');
    playerFleet.isActiveScanning = true;
    updateVisibility(state);

    if (pirateFleet.detectedByEmpireIds?.includes(playerEmpireId)) {
        ok('Player activated Active Scan and successfully detected the stealth fleet.');
    } else {
        fail('Active scan failed to reveal the pirate fleet at 800 AU.');
    }

    // --- STAGE 3: Intercept & Combat ---
    console.log('\n--- Stage 3: Combat Engagement ---');
    // Player orders an attack
    playerFleet.orders = [{ id: generateId('order', rng), type: 'Attack', targetFleetId: pirateFleet.id }];
    // Pirate retaliates completely ignoring its siege orders temporarily
    pirateFleet.orders.unshift({ id: generateId('order', rng), type: 'Attack', targetFleetId: playerFleet.id } as any);

    // Warp fleets to engagement range to avoid spending 5000+ ticks in transit
    console.log('   Warping fleets to engagement range (5 AU)...');
    pirateFleet.position.x = playerFleet.position.x + 5;

    // Tick forward until they meet and resolve combat. (Max 2000 ticks)
    let combatResolved = false;
    for (let i = 0; i < 2000; i++) {
        tickFleets(state, 86400, rng);

        const pShip = state.ships[picketShipId];
        const eShip = state.ships[pirateShipId];
        if (i % 200 === 0 && pShip && eShip && playerFleet && pirateFleet) {
            const dx = playerFleet.position.x - pirateFleet.position.x;
            const dy = playerFleet.position.y - pirateFleet.position.y;
            console.log(`[Tick ${i}] Dist: ${Math.sqrt(dx * dx + dy * dy).toFixed(1)} AU | Player HP: ${pShip.hullPoints} Shields: ${pShip.shieldPoints} | Pirate HP: ${eShip.hullPoints} Shields: ${eShip.shieldPoints}`);
        }

        // If the player ship is destroyed, combat is over (pirate should win this matchup)
        if (!state.ships[picketShipId]) {
            combatResolved = true;
            break;
        }
    }

    if (combatResolved) {
        ok('Combat resolved. Player picket fleet was destroyed by the heavy pirate cruiser.');
    } else {
        fail('Combat did not fully resolve within expected timeframe.');
    }

    // --- STAGE 4: Bombardment & Blockade ---
    console.log('\n--- Stage 4: Bombardment & Blockade ---');

    // The pirate fleet should now proceed to the planet and begin bombarding.
    // Tick until it reaches orbit and starts bombarding
    let reachedOrbit = false;
    for (let i = 0; i < 500; i++) {
        tickFleets(state, 86400, rng);
        if (pirateFleet.orbitingPlanetId === homePlanetId && pirateFleet.orders[0]?.type === 'Invade') {
            reachedOrbit = true;
            break;
        }
    }

    if (!reachedOrbit) fail('Pirate fleet failed to reach planetary orbit to begin bombardment.');

    // Let it bombard for a tick
    tickFleets(state, 86400, rng);

    let currentDefenses = state.colonies[homeColonyId].groundDefenses;
    if (currentDefenses < 10) {
        ok(`Pirate fleet began bombardment. Defenses reduced from 10 to ${currentDefenses}.`);
    } else {
        fail('Bombardment failed to reduce ground defenses.');
    }

    // Check blockade economic impact
    const blockadedBudget = calculateColonyBudget(state.colonies[homeColonyId], 1);
    const fakeUnblockadedColony = { ...state.colonies[homeColonyId], isUnderBlockade: false };
    const normalBudget = calculateColonyBudget(fakeUnblockadedColony, 1);

    if (blockadedBudget.taxes < normalBudget.taxes) {
        ok(`Blockade active. Trade taxes significantly suppressed (${normalBudget.taxes.toFixed(0)}W -> ${blockadedBudget.taxes.toFixed(0)}W).`);
    } else {
        fail('Colony is under blockade, but trade taxes were not suppressed.');
    }

    // --- STAGE 5: Conquest ---
    console.log('\n--- Stage 5: Conquest ---');

    // Tick until defenses fall to 0 and the Invade order processes
    let conquered = false;
    for (let i = 0; i < 20; i++) {
        tickFleets(state, 86400, rng);
        if (state.colonies[homeColonyId] && state.colonies[homeColonyId].empireId === pirateEmpireId) {
            conquered = true;
            break;
        }
    }

    if (conquered) {
        ok('Pirates successfully bombarded defenses to 0 and invaded the planet, transferring ownership.');
    } else {
        fail('Pirates failed to conquer the colony.');
    }

    console.log('\n✅ End-to-End Integration Scenario completed successfully.');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
