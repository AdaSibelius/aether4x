import type { Colony, Company, Empire, GameState, MonetaryAccountType, MonetaryTransferEntry } from '@/types';

export interface MonetaryAccount {
    id: string;
    type: MonetaryAccountType;
    getBalance: () => number;
    setBalance: (value: number) => void;
}

export interface MonetaryTransferOptions {
    state: GameState;
    source: MonetaryAccount;
    sink: MonetaryAccount;
    amount: number;
    reason: string;
    tick?: number;
}

export interface TickMonetaryAuditReport {
    tick: number;
    transfers: number;
    amountMoved: number;
    netByAccountType: {
        treasury: number;
        colonyPrivateWealth: number;
        companyWealth: number;
    };
}

function ensureLedger(state: GameState): MonetaryTransferEntry[] {
    if (!state.stats.monetaryLedger) state.stats.monetaryLedger = [];
    return state.stats.monetaryLedger;
}

export function createExternalAccount(id: string): MonetaryAccount {
    return {
        id,
        type: 'external',
        getBalance: () => Number.POSITIVE_INFINITY,
        setBalance: () => undefined,
    };
}

export function createTreasuryAccount(empire: Empire): MonetaryAccount {
    return {
        id: `empire:${empire.id}:treasury`,
        type: 'treasury',
        getBalance: () => empire.treasury,
        setBalance: (value: number) => {
            empire.treasury = value;
        },
    };
}

export function createColonyPrivateWealthAccount(colony: Colony): MonetaryAccount {
    return {
        id: `colony:${colony.id}:privateWealth`,
        type: 'colonyPrivateWealth',
        getBalance: () => colony.privateWealth || 0,
        setBalance: (value: number) => {
            colony.privateWealth = value;
        },
    };
}

export function createCompanyWealthAccount(company: Company): MonetaryAccount {
    return {
        id: `company:${company.id}:wealth`,
        type: 'companyWealth',
        getBalance: () => company.wealth,
        setBalance: (value: number) => {
            company.wealth = value;
        },
    };
}

export function transferWithLedger(options: MonetaryTransferOptions): number {
    const { state, source, sink, amount, reason } = options;
    const tick = options.tick ?? state.turn;
    if (amount <= 0) return 0;

    const maxAvailable = source.type === 'external' ? amount : Math.max(0, source.getBalance());
    const settledAmount = Math.min(amount, maxAvailable);
    if (settledAmount <= 0) return 0;

    if (source.type !== 'external') {
        source.setBalance(Math.max(0, source.getBalance() - settledAmount));
    }
    if (sink.type !== 'external') {
        sink.setBalance(sink.getBalance() + settledAmount);
    }

    ensureLedger(state).push({
        source: source.id,
        sink: sink.id,
        sourceType: source.type,
        sinkType: sink.type,
        amount: settledAmount,
        reason,
        tick,
    });

    return settledAmount;
}

export function buildTickMonetaryAuditReport(state: GameState, tick: number): TickMonetaryAuditReport {
    const ledger = state.stats.monetaryLedger || [];
    const entries = ledger.filter(entry => entry.tick === tick);

    const netByAccountType = {
        treasury: 0,
        colonyPrivateWealth: 0,
        companyWealth: 0,
    };

    for (const entry of entries) {
        if (entry.sourceType in netByAccountType) {
            netByAccountType[entry.sourceType as keyof typeof netByAccountType] -= entry.amount;
        }
        if (entry.sinkType in netByAccountType) {
            netByAccountType[entry.sinkType as keyof typeof netByAccountType] += entry.amount;
        }
    }

    return {
        tick,
        transfers: entries.length,
        amountMoved: entries.reduce((sum, entry) => sum + entry.amount, 0),
        netByAccountType,
    };
}
