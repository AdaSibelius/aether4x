import type { GameState, Empire, Colony, EmpireSnapshot, ColonySnapshot } from '../types';
import { RNG } from '../utils/rng';
import { BALANCING } from './constants';
import {
    transferWithLedger,
    createTreasuryAccount,
    createColonyPrivateWealthAccount,
    createExternalAccount,
} from './economy_ledger';

export interface BudgetBreakdown {
    taxes: number;
    tradeIncome: number;
    maintenance: {
        factories: number;
        mines: number;
        researchLabs: number;
        shipyards: number;
        groundDefenses: number;
        spaceports: number;
        distilleries: number;
        stores: number;
        total: number;
    };
    netIncome: number;
}

export interface EmpireBudget {
    colonyRevenue: {
        taxes: number;
        corporateFees: number;
        tradeRevenue: number;
    };
    maintenance: {
        facilities: number;
        ships: number;
        offices: number;
    };
    salaries: number;
    publicSectorPayroll: number;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
}

export function calculateColonyBudget(colony: Colony, days: number): BudgetBreakdown {
    const revenue = (colony.privateWealthIncome || 0) * BALANCING.CONSUMER_GOOD_VALUE;
    const taxes = (revenue * BALANCING.TRADE_TAX_RATE) + (colony.population * BALANCING.TAX_INCOME_BASE * (colony.happiness / 50) * days);

    // Maintenance
    const maint = {
        factories: colony.factories * BALANCING.MAINTENANCE.FACTORY * days,
        mines: colony.mines * BALANCING.MAINTENANCE.MINE * days,
        researchLabs: colony.researchLabs * BALANCING.MAINTENANCE.RESEARCH_LAB * days,
        groundDefenses: colony.groundDefenses * BALANCING.MAINTENANCE.GROUND_DEFENSE * days,
        shipyards: colony.shipyards.length * BALANCING.MAINTENANCE.SHIPYARD * days,
        spaceports: (colony.spaceport ? BALANCING.MAINTENANCE.SPACEPORT : 0) * days,
        distilleries: (colony.aethericDistillery ?? 0) * BALANCING.MAINTENANCE.DISTILLERY * days,
        stores: (colony.stores ?? 0) * BALANCING.MAINTENANCE.STORE * days,
        total: 0
    };

    maint.total = maint.factories + maint.mines + maint.researchLabs + maint.groundDefenses + maint.shipyards + maint.spaceports + maint.distilleries + maint.stores;

    return {
        taxes,
        tradeIncome: revenue * (1 - BALANCING.TRADE_TAX_RATE),
        maintenance: maint,
        netIncome: taxes - maint.total
    };
}

export function calculateEmpireBudget(game: GameState, empireId: string): EmpireBudget {
    const empire = game.empires[empireId];
    const colonies = Object.values(game.colonies).filter(c => c.empireId === empireId);

    let totalTax = 0;
    let totalFacilityMaint = 0;
    let totalTradeRev = 0;
    let publicSectorPayroll = 0;

    for (const colony of colonies) {
        const budget = calculateColonyBudget(colony, 1);
        totalTax += budget.taxes;
        totalFacilityMaint += budget.maintenance.total;
        totalTradeRev += budget.tradeIncome;
        publicSectorPayroll += (colony.publicWages || 0);
    }

    // Corporate Fees (Daily license fee per corp)
    const corporateFees = empire.companies.length * BALANCING.MAINTENANCE.CORP_LICENSE_FEE;

    // Officer Salaries
    const totalSalaries = empire.officers.reduce((a, o) => a + (o.level * BALANCING.OFFICER_SALARY_BASE), 0);

    // Ship Maintenance
    const shipMaint = Object.values(game.ships)
        .filter(s => s.empireId === empireId)
        .reduce((a, _s) => a + (BALANCING.MAINTENANCE.SHIP_BASE), 0);

    // Office maintenance (Per company)
    const officeMaint = empire.companies.length * BALANCING.MAINTENANCE.OFFICE_BASE;

    const totalRevenue = totalTax + corporateFees + totalTradeRev;
    const totalExpenses = totalFacilityMaint + shipMaint + officeMaint + totalSalaries + publicSectorPayroll;

    return {
        colonyRevenue: {
            taxes: totalTax,
            corporateFees,
            tradeRevenue: totalTradeRev,
        },
        maintenance: {
            facilities: totalFacilityMaint,
            ships: shipMaint,
            offices: officeMaint,
        },
        salaries: totalSalaries,
        publicSectorPayroll,
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
    };
}

/**
 * econ-001: Tick empire finances using explicit colony→treasury transfers.
 *
 * Taxes are now debited from colony.privateWealth and credited to empire.treasury
 * via transferWithLedger. Maintenance costs are debited from the treasury and
 * credited to an external sink. No silent money creation.
 */
export function tickEmpireFinances(next: GameState, empire: Empire, dt: number, rng: RNG): void {
    const days = dt / 86400;
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);
    const treasuryAccount = createTreasuryAccount(empire);
    const externalSink = createExternalAccount('maintenance_sink');

    let totalSettledTax = 0;
    let totalMaint = 0;

    for (const colony of empireColonies) {
        const budget = calculateColonyBudget(colony, days);
        const colonyAccount = createColonyPrivateWealthAccount(colony);

        // econ-001: Explicit debit from colony private wealth → empire treasury
        const { settled, shortfall } = transferWithLedger(
            next,
            colonyAccount,
            treasuryAccount,
            budget.taxes,
            'TAX_COLLECTION',
            { colonyId: colony.id, empireId: empire.id },
            rng,
        );
        totalSettledTax += settled;

        // Log partial settlement for audit awareness (non-blocking)
        if (shortfall > 0.01) {
            // Colony couldn't fully pay taxes — privateWealth clamped at 0
            // Shortfall is recorded in the ledger entry itself (entry.shortfall)
            colony.happiness = Math.max(0, colony.happiness - 1 * days);
        }

        // Auto-allocate 10% of collected taxes back to education
        const eduAllocation = settled * 0.1;
        colony.educationBudget = Math.max(0, (colony.educationBudget ?? 0) + eduAllocation / days);

        // Happiness impact of empire bankruptcy (unchanged behavior)
        if (empire.treasury < 0) {
            colony.happiness = Math.max(0, colony.happiness - 5 * days);
        }

        totalMaint += budget.maintenance.total;
    }

    // Maintenance: debit treasury → external sink (facilities consumed resources)
    if (totalMaint > 0) {
        transferWithLedger(
            next,
            treasuryAccount,
            externalSink,
            totalMaint,
            'MAINTENANCE_PAYMENT',
            { empireId: empire.id },
            rng,
        );
    }
}

export function recordEmpireHistory(next: GameState, empire: Empire, isSnapshotTick: boolean): void {
    if (!isSnapshotTick) return;

    const MAX_SNAPSHOTS = 24;
    const corpWealth = empire.companies.reduce((a, c) => a + c.wealth, 0);
    const totalCivWealth = Object.values(next.colonies)
        .filter(c => c.empireId === empire.id)
        .reduce((a, c) => a + (c.privateWealth || 0), 0);

    const snapshot: EmpireSnapshot = {
        turn: next.turn,
        date: new Date(next.date),
        treasury: empire.treasury,
        revenue: 0,
        expenses: 0,
        privateWealth: totalCivWealth,
        corporateWealth: corpWealth
    };

    empire.history = [...(empire.history || []), snapshot].slice(-MAX_SNAPSHOTS);
}

export function recordColonyHistory(next: GameState, colony: Colony, isSnapshotTick: boolean): void {
    if (!isSnapshotTick) return;

    const MAX_SNAPSHOTS = 24;
    const snapshot: ColonySnapshot = {
        turn: next.turn,
        date: new Date(next.date),
        population: colony.population,
        minerals: { ...colony.minerals },
        privateWealth: colony.privateWealth || 0,
        civilianFactories: colony.civilianFactories || 0,
        civilianMines: colony.civilianMines || 0,
        migrationMode: colony.migrationMode,
        averageWage: colony.privateWages ? (colony.privateWages / Math.max(1, colony.population)) : 0,
        educationIndex: colony.educationIndex || 0,
        consumerGoodsPrice: colony.resourcePrices?.ConsumerGoods || BALANCING.CONSUMER_GOOD_VALUE,
    };

    colony.history = [...(colony.history || []), snapshot].slice(-MAX_SNAPSHOTS);
}
