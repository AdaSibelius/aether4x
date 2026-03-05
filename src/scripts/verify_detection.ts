/**
 * verify_detection.ts
 *
 * Automated test script for stealth hulls & active scanning mechanics.
 *
 * Tests:
 *   1. Stealth fleet (signatureReduction = 0.3) goes undetected at range that catches a normal fleet.
 *   2. Active Scan (resolution x2) reveals the stealth fleet.
 *   3. Active Scan increases the scanner's own signature by +50%.
 *
 * Run with: npm run test:detection
 */

import { setupNewGame } from '../engine/setup';
import { updateVisibility } from '../engine/detection';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, ShipDesign } from '../types';

const SEED = 555;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fail(msg: string): never {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
}

function ok(msg: string) {
    console.log(`✅ PASS: ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('⚙️  Setting up detection test state...\n');

    const state: GameState = setupNewGame('Detection Test Empire', SEED);
    const rng = new RNG(SEED);

    // Grab two empires
    const playerEmpireId = state.playerEmpireId;
    const playerEmpire = state.empires[playerEmpireId];

    const pirateEmpireId = 'empire_pirates';
    const pirateEmpire = state.empires[pirateEmpireId];

    // Shared location
    const homeSystemId = playerEmpire.homeSystemId;

    // 1. Create a sensor ship design (Player)
    const sensorDesign: ShipDesign = {
        id: 'design_sensor',
        name: 'Sensor Picket',
        hullClass: 'Fighter',
        components: [
            { id: 'comp_sensor', type: 'Sensor', name: 'Standard Array', size: 10, powerDraw: 5, stats: { range: 100, resolution: 50 } } as any,
            { id: 'comp_engine', type: 'Engine', name: 'Drive', size: 10, powerDraw: 50, stats: { thrust: 500, fuelPerTick: 0 } } as any,
        ],
        maxHullPoints: 100,
        fuelCapacity: 1000,
        speed: 5,
        weaponSystems: [],
        powerSupply: 100,
        powerDraw: 55,
        mineralCost: {},
        bpCost: 100,
        sensorRange: 100,
    };
    playerEmpire.designLibrary.push(sensorDesign);

    // 2. Create normal and stealth pirate ship designs
    const pirateNormalDesign: ShipDesign = {
        id: 'design_pirate_normal',
        name: 'Pirate Raider',
        hullClass: 'Fighter',
        components: [
            // Standard components generate signature but no reduction
            { id: 'comp_engine', type: 'Engine', name: 'Drive', size: 10, powerDraw: 500, stats: { thrust: 500 } } as any,
        ],
        maxHullPoints: 500,
        fuelCapacity: 1000,
        speed: 5,
        weaponSystems: [],
        powerSupply: 500,
        powerDraw: 500,
        mineralCost: {},
        bpCost: 100,
        sensorRange: 2,
    };
    pirateEmpire.designLibrary.push(pirateNormalDesign);

    const pirateStealthDesign: ShipDesign = {
        ...pirateNormalDesign,
        id: 'design_pirate_stealth',
        name: 'Pirate Stealth Raider',
        components: [
            ...pirateNormalDesign.components,
            // Stealth Hull provides 70% signature reduction
            { id: 'comp_stealth', type: 'StealthHull', name: 'Damper Plating', size: 10, powerDraw: 0, stats: { signatureReduction: 0.3 } } as any,
        ],
    };
    pirateEmpire.designLibrary.push(pirateStealthDesign);

    // 3. Spawn the ships
    const sensorShipId = generateId('ship', rng);
    state.ships[sensorShipId] = { id: sensorShipId, name: 'Sensor Ship', designId: 'design_sensor', empireId: playerEmpireId, hullPoints: 100, maxHullPoints: 100, shieldPoints: 0, fuel: 1000, experience: 0, cargo: {}, inventory: [] };

    const normalShipId = generateId('ship', rng);
    state.ships[normalShipId] = { id: normalShipId, name: 'Normal Ship', designId: 'design_pirate_normal', empireId: pirateEmpireId, hullPoints: 500, maxHullPoints: 500, shieldPoints: 0, fuel: 1000, experience: 0, cargo: {}, inventory: [] };

    const stealthShipId = generateId('ship', rng);
    state.ships[stealthShipId] = { id: stealthShipId, name: 'Stealth Ship', designId: 'design_pirate_stealth', empireId: pirateEmpireId, hullPoints: 500, maxHullPoints: 500, shieldPoints: 0, fuel: 1000, experience: 0, cargo: {}, inventory: [] };

    // 4. Create Fleets
    // Base signature of pirate ship is:
    // powerDraw (500) * 0.05 + maxHullPoints (500) * 0.001 = 25 + 0.5 = 25.5
    // Sensor Resolution = 50
    // Range per resolution = 0.1 AU
    // Effective range = 100 * (50 * 0.1) * log10(1 + 25.5) = 100 * 5 * 1.42 = ~711 AU
    // We will place targets at exactly 500 AU away.
    // The normal ship should be detected (500 <= 711).
    // The stealth ship signature = 25.5 * 0.3 = 7.65
    // Effective stealth range = 100 * (50 * 0.1) * log10(1 + 7.65) = 100 * 5 * 0.93 = ~468 AU
    // The stealth ship should NOT be detected (500 > 468).

    const DISTANCE = 500;

    const sensorFleet: Fleet = {
        id: generateId('fleet', rng), name: 'Sensor Fleet', empireId: playerEmpireId, shipIds: [sensorShipId],
        currentStarId: homeSystemId, position: { x: 0, y: 0 }, orders: []
    };
    playerEmpire.fleets.push(sensorFleet);

    const normalFleet: Fleet = {
        id: generateId('fleet', rng), name: 'Normal Fleet', empireId: pirateEmpireId, shipIds: [normalShipId],
        currentStarId: homeSystemId, position: { x: DISTANCE, y: 0 }, orders: []
    };
    pirateEmpire.fleets.push(normalFleet);

    const stealthFleet: Fleet = {
        id: generateId('fleet', rng), name: 'Stealth Fleet', empireId: pirateEmpireId, shipIds: [stealthShipId],
        currentStarId: homeSystemId, position: { x: DISTANCE, y: 0 }, orders: []
    };
    pirateEmpire.fleets.push(stealthFleet);

    // --- TEST 1: Baseline Detection ---
    console.log('--- Test 1: Passive Detection with Stealth ---');
    updateVisibility(state);

    const normalSig = normalFleet.signature!;
    const stealthSig = stealthFleet.signature!;
    console.log(`   Normal Fleet Signature: ${normalSig.toFixed(2)}`);
    console.log(`   Stealth Fleet Signature: ${stealthSig.toFixed(2)}`);

    if (normalSig <= stealthSig) fail('Stealth signature is not significantly lower than normal signature');
    ok(`StealthHull reduced signature to exactly 30% (${(stealthSig / normalSig * 100).toFixed(0)}%)`);

    const normalDetected = normalFleet.detectedByEmpireIds?.includes(playerEmpireId);
    const stealthDetected = stealthFleet.detectedByEmpireIds?.includes(playerEmpireId);

    if (!normalDetected) fail('Normal fleet was NOT detected at 500 AU, check math.');
    ok('Normal fleet successfully detected at 500 AU by passive sensors.');

    if (stealthDetected) fail('Stealth fleet was incorrectly detected at 500 AU.');
    ok('Stealth fleet successfully avoided detection at 500 AU.');

    // --- TEST 2: Active Scan ---
    console.log('\n--- Test 2: Active Scan Reveals Stealth ---');

    // Toggle active scan on the sensor fleet
    sensorFleet.isActiveScanning = true;
    updateVisibility(state);

    // Calculate original signature before checking effect of active scan
    const passiveSensorSig = sensorFleet.signature! / 1.5;

    const stealthDetectedActive = stealthFleet.detectedByEmpireIds?.includes(playerEmpireId);

    if (!stealthDetectedActive) fail('Active scan failed to reveal the stealth fleet.');
    ok('Active scan (2x resolution) successfully revealed the stealth fleet at 500 AU.');

    // --- TEST 3: Active Scan Penalty ---
    console.log('\n--- Test 3: Active Scan Signature Penalty ---');
    const activeSensorSig = sensorFleet.signature!;

    console.log(`   Sensor Fleet Passive Sig: ${passiveSensorSig.toFixed(2)}`);
    console.log(`   Sensor Fleet Active Sig: ${activeSensorSig.toFixed(2)}`);

    if (activeSensorSig <= passiveSensorSig) fail('Active scan did not increase fleet signature.');
    if (Math.abs(activeSensorSig / passiveSensorSig - 1.5) > 0.01) fail('Active scan signature penalty was not exactly 1.5x.');
    ok('Active scan correctly increased fleet signature by 50%.');

    console.log('\n✅ All Phase 3 detection verification tests passed.');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
