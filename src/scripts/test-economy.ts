/**
 * test-economy.ts — econ-006: Economy Invariant Regression Checks
 *
 * Run with: npm run test:economy
 *
 * Verifies:
 * 1. Monetary conservation: no internal money creation (sum of all accounts stable)
 * 2. Partial settlement: colonies with zero private wealth are handled gracefully
 * 3. Tick-length invariance: 1×N-day tick ≈ N×1-day ticks for same elapsed time
 */

// Node.js entry point — imports engine directly (no browser environment needed)
import { setupNewGame } from '../engine/setup';
import { tickEmpireFinances } from '../engine/finances';
import { tickCorporations } from '../engine/corporations';
import type { GameState } from '../types/game';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalWealth(game: GameState): number {
    const treasury = Object.values(game.empires).reduce((s, e) => s + e.treasury, 0);
    const colonies = Object.values(game.colonies).reduce((s, c) => s + c.privateWealth, 0);
    const companies = Object.values(game.empires)
        .flatMap(e => e.companies)
        .reduce((s, c) => s + c.wealth, 0);
    return treasury + colonies + companies;
}

function runTick(game: GameState, dt: number): void {
    for (const empire of Object.values(game.empires)) {
        tickEmpireFinances(game, empire, dt);
    }
    game.turn++;
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`  ✓ ${message}`);
}

// ─── Test 1: Monetary Conservation ───────────────────────────────────────────

function testMonetaryConservation(): void {
    console.log('\n[Test 1] Monetary Conservation');
    const SEED = 42;
    const game = setupNewGame('TestEmpire', SEED);

    // Measure how much wealth is created/destroyed by EXTERNAL sources only
    // (external grants like company revenue should be accounted for)
    const externalCredit = { amount: 0 };

    // Patch transferWithLedger to track externals — instead we count shortfalls vs transfers
    const wealthBefore = totalWealth(game);

    const DAYS = 30;
    for (let i = 0; i < DAYS; i++) {
        runTick(game, 86400); // 1 day ticks
    }

    const wealthAfter = totalWealth(game);
    const delta = wealthAfter - wealthBefore;

    // Track external credits from ledger (corp_revenue etc.)
    const externalCredits = game.monetaryLedger
        .filter(e => e.from.startsWith('external:') && !e.to.startsWith('external:'))
        .reduce((s, e) => s + e.amount, 0);

    const externalDebits = game.monetaryLedger
        .filter(e => !e.from.startsWith('external:') && e.to.startsWith('external:'))
        .reduce((s, e) => s + e.amount, 0);

    const expectedDelta = externalCredits - externalDebits;
    const conservationError = Math.abs(delta - expectedDelta);

    console.log(`  Wealth before: ${wealthBefore.toFixed(2)}`);
    console.log(`  Wealth after:  ${wealthAfter.toFixed(2)}`);
    console.log(`  Net delta:     ${delta.toFixed(2)}`);
    console.log(`  External net:  ${expectedDelta.toFixed(2)}`);
    console.log(`  Error:         ${conservationError.toFixed(4)}`);

    assert(conservationError < 0.01,
        `Conservation error < 0.01 (got ${conservationError.toFixed(4)})`);
    assert(game.monetaryLedger.length > 0,
        'Monetary ledger has entries');
    assert(game.monetaryLedger.length <= 500,
        `Ledger size bounded (got ${game.monetaryLedger.length})`);
}

// ─── Test 2: Partial Settlement (Zero Private Wealth Colony) ──────────────────

function testPartialTaxSettlement(): void {
    console.log('\n[Test 2] Partial Tax Settlement (Zero Private Wealth)');
    const game = setupNewGame('TestEmpire', 99);

    // Zero out all colony private wealth to force partial settlements
    for (const colony of Object.values(game.colonies)) {
        colony.privateWealth = 0;
    }

    const treasuryBefore = Object.values(game.empires)[0].treasury;

    // Should NOT throw, even with zero colony wealth
    runTick(game, 86400);

    for (const colony of Object.values(game.colonies)) {
        assert(colony.privateWealth >= 0,
            `Colony ${colony.id} privateWealth >= 0 after tax (got ${colony.privateWealth.toFixed(2)})`);
    }

    // Ledger should record shortfalls
    const shortfallEntries = game.monetaryLedger.filter(e => e.shortfall > 0);
    console.log(`  Shortfall entries recorded: ${shortfallEntries.length}`);
    // (At least one colony should have hit a shortfall)
    assert(shortfallEntries.length > 0,
        'Shortfall entries recorded in ledger when colony wealth is zero');

    // Ledger entries should all have typed reason codes
    const untyped = game.monetaryLedger.filter(e => !e.reasonCode);
    assert(untyped.length === 0,
        'All ledger entries have typed reason codes');
}

// ─── Test 3: Tick-Length Invariance ──────────────────────────────────────────

function testTickLengthInvariance(): void {
    console.log('\n[Test 3] Tick-Length Invariance (5×1-day vs 1×5-day)');

    const SEED = 7;
    const ELAPSED = 5 * 86400; // 5 days in seconds

    // Scenario A: five 1-day ticks
    const gameA = setupNewGame('TestEmpire', SEED);
    // Ensure same starting colony wealth
    for (const c of Object.values(gameA.colonies)) c.privateWealth = 10000;
    for (let i = 0; i < 5; i++) runTick(gameA, 86400);

    // Scenario B: one 5-day tick
    const gameB = setupNewGame('TestEmpire', SEED);
    for (const c of Object.values(gameB.colonies)) c.privateWealth = 10000;
    runTick(gameB, ELAPSED);

    const treasuryA = Object.values(gameA.empires)[0].treasury;
    const treasuryB = Object.values(gameB.empires)[0].treasury;
    const colWealthA = Object.values(gameA.colonies).reduce((s, c) => s + c.privateWealth, 0);
    const colWealthB = Object.values(gameB.colonies).reduce((s, c) => s + c.privateWealth, 0);

    console.log(`  Treasury A (5×1d): ${treasuryA.toFixed(2)}, B (1×5d): ${treasuryB.toFixed(2)}`);
    console.log(`  Colony wealth A: ${colWealthA.toFixed(2)}, B: ${colWealthB.toFixed(2)}`);

    const treasuryDiff = Math.abs(treasuryA - treasuryB);
    const wealthDiff = Math.abs(colWealthA - colWealthB);

    // Allow 0.01 floating point tolerance
    assert(treasuryDiff < 0.01,
        `Treasury tick-length invariant (diff=${treasuryDiff.toFixed(4)})`);
    assert(wealthDiff < 0.01,
        `Colony wealth tick-length invariant (diff=${wealthDiff.toFixed(4)})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════');
console.log('  Aether 4X — Economy Regression Suite ');
console.log('═══════════════════════════════════════');

try {
    testMonetaryConservation();
    testPartialTaxSettlement();
    testTickLengthInvariance();
    console.log('\n✅ All economy invariant checks passed!\n');
    process.exit(0);
} catch (err) {
    console.error('\n❌ Unexpected error in regression suite:', err);
    process.exit(1);
}
