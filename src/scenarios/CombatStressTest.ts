/**
 * CombatStressTest.ts
 * 
 * Stress test for the live combat engine.
 * Spawns two large fleets and measures tick latency during sustained combat.
 * 
 * Run with: npx tsx src/scenarios/CombatStressTest.ts
 */

import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { createDesign } from '../engine/ships';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, Ship } from '../types';

// ─── Config ─────────────────────────────────────────────────────────────────

const FLEET_A_SIZE = 200; // Ships per side. Test at 200, 500, 1000.
const FLEET_B_SIZE = 200;
const COMBAT_TICKS = 20;
const TICK_SIZE = 86400; // 1 day ticks

// ─── Helpers ─────────────────────────────────────────────────────────────────

function spawnCombatFleet(
    state: GameState,
    empireId: string,
    designId: string,
    fleetName: string,
    size: number,
    position: { x: number; y: number },
    starId: string,
    rng: RNG
): Fleet {
    const empire = state.empires[empireId];
    if (!empire) throw new Error(`Empire ${empireId} not found`);

    const design = empire.designLibrary.find(d => d.id === designId);
    if (!design) throw new Error(`Design ${designId} not found in ${empireId}`);

    const shipIds: string[] = [];
    for (let i = 0; i < size; i++) {
        const shipId = generateId('ship', rng);
        const ship: Ship = {
            id: shipId,
            name: `${design.name} ${i + 1}`,
            designId: design.id,
            empireId,
            hullPoints: design.maxHullPoints,
            maxHullPoints: design.maxHullPoints,
            shieldPoints: 0,
            fuel: design.fuelCapacity,
            experience: 0,
            cargo: {},
            inventory: [],
        };
        state.ships[shipId] = ship;
        shipIds.push(shipId);
    }

    const fleetId = generateId('fleet', rng);
    const fleet: Fleet = {
        id: fleetId,
        name: fleetName,
        empireId,
        shipIds,
        currentStarId: starId,
        position,
        orders: [{
            id: generateId('order', rng),
            type: 'Attack',
            targetFleetId: '', // Set after both fleets created
        }],
    };

    empire.fleets.push(fleet);
    return fleet;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const SEED = 42;
    const rng = new RNG(SEED + 9999);

    console.log('⚙️  Setting up game state...');
    let state = setupNewGame('Terran Sovereignty', SEED);

    // Add a second enemy empire
    const enemyEmpireId = 'empire_enemy';
    state.empires[enemyEmpireId] = {
        id: enemyEmpireId,
        name: 'Corsair Federation',
        color: '#ff4444',
        isPlayer: false,
        homeSystemId: 'star_0',
        homePlanetId: '',
        minerals: {},
        research: { activeProjects: [], completedTechs: [] },
        officers: [],
        fleets: [],
        designLibrary: [
            // Give enemy a corvette and destroyer design
            createDesign('design_corvette_e', 'Corsair Corsair', 'Corvette',
                ['reactor_coal_boiler', 'engine_furnace_sm', 'tank_phlogiston_sm', 'scanner_optic_sm', 'emitter_aetheric_sm', 'plating_bessemer']),
            createDesign('design_destroyer_e', 'Corsair Hunter', 'Destroyer',
                ['reactor_dynamo', 'engine_furnace_md', 'engine_furnace_sm', 'tank_phlogiston_md', 'scanner_optic_md', 'emitter_aetheric_md', 'battery_magnetic_sm', 'plating_bessemer', 'plating_bessemer']),
        ],
        treasury: 0,
        privateWealth: 0,
        tradeRoutes: [],
        companies: [],
        events: [],
        history: [],
    };

    const homeStarId = 'star_0';
    const playerEmpireId = state.playerEmpireId;

    // Spawn two large fleets at opposite ends of the system
    console.log(`\n⚔️  Spawning ${FLEET_A_SIZE} vs ${FLEET_B_SIZE} ships in ${homeStarId}...`);

    const fleetA = spawnCombatFleet(
        state, playerEmpireId, 'design_destroyer',
        `TSN Battle Fleet Alpha`, FLEET_A_SIZE,
        { x: -2, y: 0 }, homeStarId, rng // Spawn 4 AU apart - within weapon range (range: 5-8 AU)
    );

    const fleetB = spawnCombatFleet(
        state, enemyEmpireId, 'design_destroyer_e',
        `Corsair Armada`, FLEET_B_SIZE,
        { x: 2, y: 0 }, homeStarId, rng
    );

    // Cross-target the two fleets
    fleetA.orders[0]!.targetFleetId = fleetB.id;
    fleetB.orders[0] = {
        id: generateId('order', rng),
        type: 'Attack',
        targetFleetId: fleetA.id,
    };

    console.log(`\n▶️  Starting combat simulation for ${COMBAT_TICKS} ticks...`);
    console.log('─'.repeat(60));
    console.log(`${'Tick'.padEnd(6)} ${'TSN Ships'.padStart(10)} ${'Corsair Ships'.padStart(14)} ${'ms/tick'.padStart(8)}`);
    console.log('─'.repeat(60));

    for (let tick = 0; tick < COMBAT_TICKS; tick++) {
        const tsnShipsBefore = fleetA.shipIds.length;
        const corsairShipsBefore = fleetB.shipIds.length;

        if (tsnShipsBefore === 0 && corsairShipsBefore === 0) {
            console.log('\n🏁 Both fleets destroyed. Mutual annihilation.');
            break;
        }
        if (tsnShipsBefore === 0) {
            console.log(`\n🏴 TSN fleet destroyed after ${tick} ticks.`);
            break;
        }
        if (corsairShipsBefore === 0) {
            console.log(`\n🏆 Corsair fleet destroyed after ${tick} ticks!`);
            break;
        }

        const t0 = performance.now();
        state = advanceTick(state);
        const dt = performance.now() - t0;

        const tsnShipsAfter = fleetA.shipIds.length;
        const corsairShipsAfter = fleetB.shipIds.length;

        const tickStr = String(tick + 1).padEnd(6);
        const tsnStr = `${tsnShipsAfter}`.padStart(10);
        const corsairStr = `${corsairShipsAfter}`.padStart(14);
        const msStr = `${dt.toFixed(1)}ms`.padStart(8);

        const warning = dt > 16 ? ' ⚠️ ' : '';
        console.log(`${tickStr} ${tsnStr} ${corsairStr} ${msStr}${warning}`);
    }

    console.log('─'.repeat(60));
    console.log('\n✅ Stress test complete.');
    console.log(`   Fleet A (TSN) remaining: ${fleetA.shipIds.length} ships`);
    console.log(`   Fleet B (Corsair) remaining: ${fleetB.shipIds.length} ships`);

    // Count combat events
    const allEmpireEvents = Object.values(state.empires).flatMap(e => e.events);
    const combatEvents = allEmpireEvents.filter(e => e.type === 'CombatEngagement' || e.type === 'ShipDestroyed');
    console.log(`   Combat events fired: ${combatEvents.length}`);
}

main().catch(console.error);
