import { Officer } from './officer';
import { Fleet, ShipDesign } from './fleet';
import { GameEvent } from './base';
import { EmpireResearch, ResearchProject } from './research';

export interface Empire {
    id: string;
    name: string;
    color: string;
    isPlayer: boolean;
    homeSystemId: string;
    homePlanetId: string;
    minerals: Record<string, number>;
    research: EmpireResearch;
    officers: Officer[];
    fleets: Fleet[];
    designLibrary: ShipDesign[];
    treasury: number;
    privateWealth: number;
    tradeRoutes: TradeRoute[];
    companies: Company[];
    events: GameEvent[];
    history: EmpireSnapshot[];
    relations: Record<string, { treaty: TreatyType, tension: number }>;
    aiState?: {
        posture: 'Expansion' | 'Consolidation' | 'Aggression';
        targetSystems: string[];
        lastEvaluationTick: number;
    };
}

export type TreatyType = 'None' | 'NonAggression' | 'TradeAgreement' | 'ResearchAlliance' | 'War';

export interface EmpireSnapshot {
    turn: number;
    date: Date;
    treasury: number;
    revenue: number;
    expenses: number;
    privateWealth: number;
    corporateWealth: number;
}

// Research related types moved to research.ts

export interface TradeRoute {
    id: string;
    sourceColonyId: string;
    targetColonyId: string;
    resource: string;
    amountToMove: number;
    assignedFleetId?: string;
    active: boolean;
}

export type CompanyType = 'Transport' | 'Extraction' | 'Manufacturing' | 'Agricultural' | 'Commercial';
export type CompanyStrategy = 'Expansionist' | 'Optimized' | 'Vanguard';

export interface CompanySnapshot {
    date: string;
    wealth: number;
    valuation: number;
    revenue: number;
    expenses: number;
}

export interface CorporateTransaction {
    date: string;
    amount: number;
    type: 'Income' | 'Revenue' | 'Expense' | 'Investment' | 'Tax' | 'Dividend' | 'Grant';
    description: string;
}

export type CorporateDesignBias = 'Speed' | 'Efficiency' | 'Capacity';

export interface Company {
    id: string;
    name: string;
    type: CompanyType;
    homeColonyId: string;
    wealth: number;
    valuation: number;
    activeFreighters: number;
    ceoId?: string;
    strategy: CompanyStrategy;
    designBias: CorporateDesignBias;
    preferredDesignId?: string;
    explorationLicenseIds: string[]; // List of system IDs where they have mining rights
    history: CompanySnapshot[];
    transactions: CorporateTransaction[];
}

export interface MiningTender {
    id: string;
    systemId: string;
    openingDate: string;
    closingDate: string;
    highestBid: number;
    highestBidderId?: string; // id of the company
    bids: { companyId: string, amount: number }[];
    empireId: string; // The empire that opened the tender
}
