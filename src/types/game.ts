import { Star, JumpPoint } from './celestial';
import { GamePhase, TickLength } from './base';
import { Empire, MiningTender } from './empire';
import { Ship } from './fleet';
import { Colony } from './colony';

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
    cashflowLedger?: CashflowEntry[];
}

export interface CashflowEntry {
    id: string;
    date: string;
    category: 'MigrationFee' | 'TransportFee';
    description: string;
    amount: number;
    debitAccount: string;
    creditAccount: string;
    status: 'Settled' | 'Partial' | 'DebtRecorded';
    metadata?: Record<string, string | number>;
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
