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
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';

// ─── Account References ───────────────────────────────────────────────────────

/** Interface for an account that can be used in a monetary transfer.
 *  Uses the naming convention from origin/main (MonetaryAccount). */
export interface MonetaryAccount {
    id: string;
    label: string;
    getBalance: () => number;
    applyDelta: (delta: number) => void;
}

export function createTreasuryAccount(empire: Empire): MonetaryAccount {
    return {
        id: `empire:${empire.id}:treasury`,
        label: `treasury:${empire.id}`,
        getBalance: () => empire.treasury,
        applyDelta: (d) => { empire.treasury += d; },
    };
}

export function createColonyPrivateWealthAccount(colony: Colony): MonetaryAccount {
    return {
        id: `colony:${colony.id}:privateWealth`,
        label: `colony_pw:${colony.id}`,
        getBalance: () => colony.privateWealth,
        applyDelta: (d) => { colony.privateWealth += d; },
    };
}

export function createCompanyAccount(company: Company): MonetaryAccount {
    return {
        id: `company:${company.id}:wealth`,
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
export function createExternalAccount(label: string): MonetaryAccount {
    return {
        id: `external:${label}`,
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
    from: MonetaryAccount,
    to: MonetaryAccount,
    amount: number,
    reasonCode: MonetaryReasonCode,
    metadata?: Record<string, string | number | boolean>,
    rng?: RNG,
): TransferResult {
    if (amount <= 0) return { settled: 0, shortfall: 0 };

    const available = isFinite(from.getBalance()) ? from.getBalance() : Infinity;
    const settled = Math.min(amount, Math.max(0, available));
    const shortfall = amount - settled;

    if (settled > 0) {
        from.applyDelta(-settled);
        to.applyDelta(settled);
    }

    if (!game.monetaryLedger) game.monetaryLedger = [];

    const entry: MonetaryLedgerEntry = {
        id: generateId('ml', rng),
        turn: game.turn,
        from: from.label,
        to: to.label,
        amount: settled,
        shortfall,
        reasonCode,
        metadata: metadata ?? {},
    };

    game.monetaryLedger.push(entry);

    // Also mirror to stats for backward compatibility with main branch analytics if needed
    if (!game.stats.monetaryLedger) game.stats.monetaryLedger = [];
    game.stats.monetaryLedger.push({
        source: from.id,
        sink: to.id,
        sourceType: (from.label.split(':')[0] as any), // Best effort cast
        sinkType: (to.label.split(':')[0] as any),
        amount: settled,
        reason: reasonCode,
        tick: game.turn,
    });

    pruneMonetaryLedger(game);

    return { settled, shortfall };
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

/** Keep only the most recent entries to prevent unbounded memory growth. */
function pruneMonetaryLedger(game: GameState): void {
    if (!game.monetaryLedger) return;
    const max = BALANCING.MAX_MONETARY_LEDGER_ENTRIES;
    if (game.monetaryLedger.length > max) {
        game.monetaryLedger = game.monetaryLedger.slice(-max);
    }
    if (game.stats.monetaryLedger && game.stats.monetaryLedger.length > max) {
        game.stats.monetaryLedger = game.stats.monetaryLedger.slice(-max);
    }
}

