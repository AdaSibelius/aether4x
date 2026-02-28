/**
 * economy_ledger.ts
 *
 * Single source of truth for all monetary transfers in the simulation.
 * All wealth movements MUST go through transferWithLedger() to maintain
 * conservation invariants. No silent money creation is permitted.
 *
 * @module economy_ledger
 */

import type { GameState, Colony, MonetaryLedgerEntry, MonetaryReasonCode } from '../types';
import type { Empire, Company } from '../types';
import { BALANCING } from './constants';

// ─── Account References ───────────────────────────────────────────────────────

export interface LedgerAccount {
    /** Human-readable label for debug / UI */
    label: string;
    /** Get the current balance */
    getBalance: () => number;
    /** Mutate the balance by delta (positive = credit, negative = debit) */
    applyDelta: (delta: number) => void;
}

export function createTreasuryAccount(empire: Empire): LedgerAccount {
    return {
        label: `treasury:${empire.id}`,
        getBalance: () => empire.treasury,
        applyDelta: (d) => { empire.treasury += d; },
    };
}

export function createColonyPrivateWealthAccount(colony: Colony): LedgerAccount {
    return {
        label: `colony_pw:${colony.id}`,
        getBalance: () => colony.privateWealth,
        applyDelta: (d) => { colony.privateWealth += d; },
    };
}

export function createCompanyAccount(company: Company): LedgerAccount {
    return {
        label: `company:${company.id}`,
        getBalance: () => company.wealth,
        applyDelta: (d) => { company.wealth += d; },
    };
}

/**
 * An external account represents money entering/leaving the simulation system
 * (e.g. startup grants, AI subsidies, event rewards). Using this is intentional
 * and must be explicitly named so audits can identify external minting.
 */
export function createExternalAccount(label: string): LedgerAccount {
    return {
        label: `external:${label}`,
        getBalance: () => Infinity,
        applyDelta: (_d) => { /* external — no balance to track */ },
    };
}

// ─── Transfer Primitive ───────────────────────────────────────────────────────

export interface TransferResult {
    /** Amount that was successfully transferred */
    settled: number;
    /** Amount that could not be transferred (payer had insufficient funds) */
    shortfall: number;
}

/**
 * Transfer wealth from one account to another, recording the event in the
 * monetary ledger. If the payer has insufficient funds the transfer is
 * settled partially — the shortfall is logged but no panic is thrown.
 *
 * @param game   Current game state (ledger is appended to game.monetaryLedger)
 * @param from   Source account
 * @param to     Destination account
 * @param amount Desired transfer amount (must be positive)
 * @param reasonCode Typed reason for the transfer (enables machine analytics)
 * @param metadata Optional structured metadata (colonyId, empireId, etc.)
 */
export function transferWithLedger(
    game: GameState,
    from: LedgerAccount,
    to: LedgerAccount,
    amount: number,
    reasonCode: MonetaryReasonCode,
    metadata?: Record<string, string | number | boolean>,
): TransferResult {
    if (amount <= 0) return { settled: 0, shortfall: 0 };

    const available = isFinite(from.getBalance()) ? from.getBalance() : Infinity;
    const settled = Math.min(amount, Math.max(0, available));
    const shortfall = amount - settled;

    if (settled > 0) {
        from.applyDelta(-settled);
        to.applyDelta(settled);
    }

    const entry: MonetaryLedgerEntry = {
        id: `ml_${game.turn}_${game.monetaryLedger.length}`,
        turn: game.turn,
        from: from.label,
        to: to.label,
        amount: settled,
        shortfall,
        reasonCode,
        metadata: metadata ?? {},
    };

    game.monetaryLedger.push(entry);
    pruneMonetaryLedger(game);

    return { settled, shortfall };
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

/** Keep only the most recent entries to prevent unbounded memory growth. */
export function pruneMonetaryLedger(game: GameState): void {
    const max = BALANCING.MAX_MONETARY_LEDGER_ENTRIES;
    if (game.monetaryLedger.length > max) {
        game.monetaryLedger = game.monetaryLedger.slice(-max);
    }
}

export function pruneCashflowLedger(game: GameState): void {
    const max = BALANCING.MAX_CASHFLOW_LEDGER_ENTRIES;
    if (game.cashflowLedger.length > max) {
        game.cashflowLedger = game.cashflowLedger.slice(-max);
    }
}

// ─── Debug / Export ───────────────────────────────────────────────────────────

/** Returns all ledger entries for external audit. Safe to call in any context. */
export function exportMonetaryLedger(game: GameState): MonetaryLedgerEntry[] {
    return [...game.monetaryLedger];
}

/** Filter ledger by reason code for targeted analysis. */
export function queryLedger(
    game: GameState,
    reasonCode: MonetaryReasonCode,
): MonetaryLedgerEntry[] {
    return game.monetaryLedger.filter(e => e.reasonCode === reasonCode);
}
