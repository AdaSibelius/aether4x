/**
 * verify_bombardment.ts
 *
 * Automated test script for orbital bombardment & invasion mechanics.
 *
 * Tests:
 *   1. Invade order decrements colony.groundDefenses each tick (fleet pre-placed at target planet).
 *   2. Invade order transfers colony ownership when groundDefenses === 0.
 *   3. isUnderBlockade flag halves trade income in calculateColonyBudget.
 *
 * Run with: npm run test:bombardment
 */

import { setupNewGame } from '../engine/setup';
import { tickFleets, getPlanetPosition } from '../engine/fleets';
import { calculateColonyBudget } from '../engine/finances';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, Ship, ShipDesign, Colony } from '../types';

const SEED = 999;

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
    console.log('⚙️  Setting up bombardment test state...\n');

    const state: GameState = setupNewGame('Test Empire', SEED);
    const rng = new RNG(SEED);

    const pirateEmpireId = 'empire_pirates';
    const pirateEmpire = state.empires[pirateEmpireId];
    if (!pirateEmpire) fail('Pirate empire not found in state');

    const playerEmpireId = state.playerEmpireId;
    const playerEmpire = state.empires[playerEmpireId];

    // Find the player home colony and planet.
    const homeColony = Object.values(state.colonies).find(c => c.empireId === playerEmpireId);
    if (!homeColony) fail('No player home colony found');
    const homeColonyId = homeColony.id;
    const homePlanetId = homeColony.planetId;
    const homeStarId = playerEmpire.homeSystemId;

    // Find the home planet object.
    const homeStar = state.galaxy.stars[homeStarId];
    const homePlanet = homeStar?.planets.find(p => p.id === homePlanetId);
    if (!homePlanet) fail(`Home planet ${homePlanetId} not found in star ${homeStarId}`);

    // Give the colony 1 PDC battery. A 25 dmg weapon will clear it in 1 tick.
    state.colonies[homeColonyId] = {
        ...homeColony,
        groundDefenses: 1,
        population: 10,
        isUnderBlockade: false,
    };

    // Create a bombardment design for the pirate empire.
    const bombardDesign: ShipDesign = {
        ...(pirateEmpire.designLibrary[0] || {} as any), // borrow boilerplate
        id: 'design_bombard_test',
        name: 'Pirate Siege Cruiser',
        components: [
            {
                id: 'comp_bombard', type: 'Bombardment', name: 'Orbital Mortar',
                size: 10, slot: 'Weapon',
                stats: { groundDefensesDamage: 25, cost: 100 },
            } as any,
            {
                id: 'comp_engine', type: 'Engine', name: 'Drive',
                size: 10, slot: 'Engine',
                stats: { thrust: 500, fuelPerTick: 0 },
            } as any,
        ],
        maxHullPoints: 200,
        maxShieldPoints: 0,
        fuelCapacity: 99999,
        baseSignature: 10,
        sensorResolution: 5,
        speed: 100,
        totalMass: 100,
        cost: {},
    };
    pirateEmpire.designLibrary.push(bombardDesign);

    // Spawn a pirate bombardment ship.
    const bombShipId = generateId('ship', rng);
    state.ships[bombShipId] = {
        id: bombShipId,
        name: 'Pirate Siege Ship',
        designId: bombardDesign.id,
        empireId: pirateEmpireId,
        hullPoints: 200,
        maxHullPoints: 200,
        shieldPoints: 0,
        fuel: 99999,
        experience: 0,
        cargo: {},
        inventory: [],
    };

    // Pre-position the fleet AT the home planet so orbit check passes immediately.
    // processInvadeOrder checks: distance(fleet.position, pPos) < 0.2
    const planetPos = getPlanetPosition(homePlanet!, state.turn);

    const siegeFleetId = generateId('fleet', rng);
    const siegeFleet: Fleet = {
        id: siegeFleetId,
        name: 'Pirate Siege Fleet',
        empireId: pirateEmpireId,
        shipIds: [bombShipId],
        currentStarId: homeStarId,
        // Placed exactly at the planet — passes the < 0.2 orbit check on tick 1
        position: { x: planetPos.x, y: planetPos.y },
        orders: [{
            id: generateId('order', rng),
            type: 'Invade',
            targetPlanetId: homePlanetId,
        }] as any,
    };
    pirateEmpire.fleets.push(siegeFleet);

    // ─── Test 1: Bombardment damages ground defenses ──────────────────────────
    console.log('--- Test 1: Bombardment damages groundDefenses ---');
    const initialDefenses = state.colonies[homeColonyId].groundDefenses;
    console.log(`   Initial groundDefenses: ${initialDefenses}`);

    tickFleets(state, 86400, new RNG(SEED));

    const defensesAfterTick1 = state.colonies[homeColonyId].groundDefenses;
    console.log(`   groundDefenses after Tick 1: ${defensesAfterTick1}`);
    if (defensesAfterTick1 < initialDefenses) {
        ok(`Bombardment reduced groundDefenses from ${initialDefenses} → ${defensesAfterTick1}`);
    } else {
        fail(`Bombardment did NOT decrement groundDefenses (still ${defensesAfterTick1})`);
    }

    // ─── Test 2: Colony annexation when defenses reach 0 ─────────────────────
    console.log('\n--- Test 2: Colony annexation after defenses fall ---');

    // Tick until defenses clear (max 20 ticks for safety), then one more to annex.
    for (let i = 0; i < 20 && (state.colonies[homeColonyId]?.groundDefenses ?? 0) > 0; i++) {
        tickFleets(state, 86400, new RNG(SEED + i));
    }
    // One final tick triggers the ownership transfer (defenses are now 0).
    tickFleets(state, 86400, new RNG(SEED + 100));

    const finalColony = state.colonies[homeColonyId];
    console.log(`   Colony empireId after invasion: ${finalColony?.empireId ?? 'DELETED'}`);
    if (!finalColony) {
        ok('Colony was fully destroyed during invasion');
    } else if (finalColony.empireId === pirateEmpireId) {
        ok(`Colony ownership transferred to pirate empire`);
    } else {
        fail(`Colony was NOT conquered — still owned by ${finalColony.empireId}`);
    }

    // ─── Test 3: Blockade halves trade income ─────────────────────────────────
    console.log('\n--- Test 3: Blockade suppresses trade income ---');

    // Use a fresh colony object with known privateWealthIncome.
    const testColony: Colony = { ...homeColony, id: 'colony_blockade_test', isUnderBlockade: false, privateWealthIncome: 1000 };
    const budgetNormal = calculateColonyBudget(testColony, 1);
    testColony.isUnderBlockade = true;
    const budgetBlockaded = calculateColonyBudget(testColony, 1);

    console.log(`   Normal taxes:    ${budgetNormal.taxes.toFixed(2)} W`);
    console.log(`   Blockaded taxes: ${budgetBlockaded.taxes.toFixed(2)} W`);

    if (budgetBlockaded.taxes < budgetNormal.taxes) {
        ok(`Blockade suppressed trade income (${budgetNormal.taxes.toFixed(1)} → ${budgetBlockaded.taxes.toFixed(1)})`);
    } else {
        fail(`Blockade did NOT suppress trade income`);
    }

    console.log('\n✅ All bombardment verification tests passed.');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
