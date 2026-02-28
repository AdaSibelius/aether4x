import { Star, JumpPoint } from './celestial';
import { GamePhase, TickLength } from './base';
import { Empire, MiningTender } from './empire';
import { Ship } from './fleet';
import { Colony } from './colony';

// ─── Economy Ledger Types ────────────────────────────────────────────────────

/** Typed reason codes for all monetary transfers. Enables machine analytics
 *  without parsing free-text reason strings. */
export type MonetaryReasonCode =
    | 'TAX_COLLECTION'       // Colony private wealth → empire treasury
    | 'MAINTENANCE_PAYMENT'  // Treasury → external (facility upkeep)
    | 'SALARY_PAYMENT'       // Treasury → external (officer wages)
    | 'CORPORATE_DIVIDEND'   // Company → treasury
    | 'TENDER_PAYMENT'       // Company → treasury (bid settlement)
    | 'FREIGHT_FEE'          // Colony/company → transport company
    | 'MIGRATION_FEE'        // Colony/company → transport company
    | 'CORP_FOUNDING'        // Colony private wealth → company (seed capital)
    | 'SHIP_PURCHASE_TAX'    // Company → treasury (on ship commission)
    | 'CORP_EXPANSION'       // Company → external (facility build cost)
    | 'CIVILIAN_EXPANSION'   // Colony private wealth → external (housing/shops)
    | 'EXTERNAL_GRANT';      // External → any account (startup/event grants)

/** One entry in the bounded monetary ledger. */
export interface MonetaryLedgerEntry {
    id: string;
    turn: number;
    from: string;            // Account label (e.g. "colony_pw:col_001")
    to: string;              // Account label (e.g. "treasury:emp_001")
    amount: number;          // Amount actually transferred
    shortfall: number;       // Amount that could NOT be transferred (insufficient funds)
    reasonCode: MonetaryReasonCode;
    metadata: Record<string, string | number | boolean>;
}

/** Slim per-tick cashflow record (separate from full monetary ledger). */
export interface CashflowLedgerEntry {
    turn: number;
    empireId: string;
    totalRevenue: number;
    totalExpenses: number;
    netFlow: number;
    breakdown: Record<string, number>;
}

export interface Galaxy {
    stars: Record<string, Star>;
    jumpPoints: JumpPoint[];
    width: number;
    height: number;
    seed: number;
}

export interface GameStats {
    totalProduced: Record<string, number>;
    totalConsumed: Record<string, number>;
    totalConverted: Record<string, number>; // e.g., Aether to Fuel
}

export interface GameState {
    id: string;
    phase: GamePhase;
    turn: number;
    date: Date;
    seed: number;
    initialSeed: number;
    galaxy: Galaxy;
    empires: Record<string, Empire>;
    ships: Record<string, Ship>;
    colonies: Record<string, Colony>;
    tenders: MiningTender[];
    playerEmpireId: string;
    tickLength: TickLength;
    stats: GameStats;
    /** Bounded ledger of all wealth transfers. Pruned to MAX_MONETARY_LEDGER_ENTRIES. */
    monetaryLedger: MonetaryLedgerEntry[];
    /** Bounded per-tick cashflow summaries. Pruned to MAX_CASHFLOW_LEDGER_ENTRIES. */
    cashflowLedger: CashflowLedgerEntry[];
}
export interface GameSnapshot {
    id: string;
    name: string;
    turn: number;
    date: Date;
    gameState: GameState;
}

export interface DiffReport {
    idA: string;
    idB: string;
    turnA: number;
    turnB: number;
    dateA: string;
    dateB: string;
    deltaPopulation: number;
    deltaResources: number;
    deltaValuation: number;
}

export interface AuditReport {
    [resource: string]: {
        current: number;
        prod: number;
        cons: number;
    };
}
