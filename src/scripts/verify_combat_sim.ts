/**
 * verify_combat_sim.ts
 * 
 * An automated test script for AI coding agents to verify the 
 * deterministic dry-run `simulateBattle` function.
 * 
 * Run with: npm run test:combat
 */

import { setupNewGame } from '../engine/setup';
import { createDesign } from '../engine/ships';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import type { GameState, Fleet, Ship } from '../types';
import { simulateBattle } from '../engine/combat';
import { initShipShields } from '../engine/combat';

// ─── Config ─────────────────────────────────────────────────────────────────

const SEED = 42;
const FLEET_A_SIZE = 10;
const FLEET_B_SIZE = 10;

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
        // Initialize shields if design has them
        initShipShields(ship, state);
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
        orders: [],
    };

    empire.fleets.push(fleet);
    return fleet;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('⚙️  Setting up simulation state...');
    const rng = new RNG(SEED);
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
            // Unshielded corvette
            createDesign('design_corvette_e', 'Corsair Corsair', 'Corvette',
                ['reactor_coal_boiler', 'engine_furnace_sm', 'tank_phlogiston_sm', 'scanner_optic_sm', 'emitter_aetheric_sm', 'plating_bessemer']),
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

    console.log(`\n⚔️  Spawning ${FLEET_A_SIZE} (Shielded) vs ${FLEET_B_SIZE} (Unshielded) ships in ${homeStarId}...`);

    // Player gets the shielded destroyer design (already in setup.ts Terran fleet)
    const fleetA = spawnCombatFleet(
        state, playerEmpireId, 'design_destroyer', // from setup.ts (has shields)
        `TSN Battle Fleet Alpha`, FLEET_A_SIZE,
        { x: -2, y: 0 }, homeStarId, rng
    );

    const fleetB = spawnCombatFleet(
        state, enemyEmpireId, 'design_corvette_e',
        `Corsair Armada`, FLEET_B_SIZE,
        { x: 2, y: 0 }, homeStarId, rng
    );

    // Cross-target the two fleets
    fleetA.orders[0] = { id: generateId('order', rng), type: 'Attack', targetFleetId: fleetB.id };
    fleetB.orders[0] = { id: generateId('order', rng), type: 'Attack', targetFleetId: fleetA.id };

    console.log(`\n▶️  Running simulateBattle()...`);
    console.log('─'.repeat(60));

    const t0 = performance.now();
    const report1 = simulateBattle(fleetA.id, fleetB.id, state, 200);
    const dt1 = performance.now() - t0;

    console.log(`✅ Simulation 1 finished in ${dt1.toFixed(2)}ms`);
    console.log(`   Winner: ${report1.winner}`);
    console.log(`   Rounds: ${report1.rounds.length}`);
    console.log(`   Total Damage A -> B: ${report1.totalDamageAtoB}`);
    console.log(`   Total Damage B -> A: ${report1.totalDamageBtoA}`);
    console.log(`   Survivors A: ${report1.survivorsA} / ${FLEET_A_SIZE}`);
    console.log(`   Survivors B: ${report1.survivorsB} / ${FLEET_B_SIZE}`);

    console.log(`\n▶️  Running simulateBattle() again on SAME state to verify determinism and non-mutation...`);
    const t1 = performance.now();
    const report2 = simulateBattle(fleetA.id, fleetB.id, state, 200);
    const dt2 = performance.now() - t1;

    console.log(`✅ Simulation 2 finished in ${dt2.toFixed(2)}ms`);

    // Assertions
    let passed = true;
    if (report1.winner !== report2.winner) passed = false;
    if (report1.rounds.length !== report2.rounds.length) passed = false;
    if (report1.totalDamageAtoB !== report2.totalDamageAtoB) passed = false;
    if (report1.totalDamageBtoA !== report2.totalDamageBtoA) passed = false;

    if (!passed) {
        console.error('\n❌ ERROR: Simulation is not deterministic or is mutating the base state!');
        process.exit(1);
    }

    if (report1.winner === 'Draw') {
        console.warn('\n⚠️ WARNING: Simulation ended in a Draw. This might mean weapons are too weak or ships are out of range.');
    } else {
        console.log(`\n✅ DETERMINISM CHECK PASSED: Both simulation runs yielded identical results without modifying the live game state.`);
    }
}

main().catch(console.error);
