'use client';
import type { GameState, Empire, Colony, EmpireSnapshot } from '@/types';
import { BALANCING } from './constants';

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
        logisticsHubs: number;
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
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
}

export function calculateColonyBudget(colony: Colony, days: number): BudgetBreakdown {
    const revenue = (colony.privateWealthIncome || 0) * BALANCING.TRADE_GOOD_VALUE;
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
        logisticsHubs: (colony.logisticsHubs ?? 0) * BALANCING.MAINTENANCE.LOGISTICS_HUB * days,
        total: 0
    };

    maint.total = maint.factories + maint.mines + maint.researchLabs + maint.groundDefenses + maint.shipyards + maint.spaceports + maint.distilleries + maint.logisticsHubs;

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

    for (const colony of colonies) {
        const budget = calculateColonyBudget(colony, 1);
        totalTax += budget.taxes;
        totalFacilityMaint += budget.maintenance.total;
        totalTradeRev += budget.tradeIncome;
    }

    // Corporate Fees (Daily license fee per corp)
    const corporateFees = empire.companies.length * BALANCING.MAINTENANCE.CORP_LICENSE_FEE;

    // Officer Salaries
    const totalSalaries = empire.officers.reduce((a, o) => a + (o.level * BALANCING.OFFICER_SALARY_BASE), 0);

    // Ship Maintenance
    const shipMaint = Object.values(game.ships)
        .filter(s => s.empireId === empireId)
        .reduce((a, s) => a + (BALANCING.MAINTENANCE.SHIP_BASE), 0);

    // Office maintenance (Per company)
    const officeMaint = empire.companies.length * BALANCING.MAINTENANCE.OFFICE_BASE;

    const totalRevenue = totalTax + corporateFees + totalTradeRev;
    const totalExpenses = totalFacilityMaint + shipMaint + officeMaint + totalSalaries;

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
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
    };
}

export function tickEmpireFinances(next: GameState, empire: Empire, dt: number): void {
    const days = dt / 86400;
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);

    let totalTax = 0;
    let totalMaint = 0;

    for (const colony of empireColonies) {
        const budget = calculateColonyBudget(colony, days);
        totalTax += budget.taxes;
        totalMaint += budget.maintenance.total;

        // Happiness impact of bankruptcy
        if (empire.treasury < 0) {
            colony.happiness = Math.max(0, colony.happiness - 5 * days);
        }
    }

    empire.treasury += totalTax - totalMaint;
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
        revenue: 0, // Could be populated with more detail if needed
        expenses: 0,
        privateWealth: totalCivWealth,
        corporateWealth: corpWealth
    };

    empire.history = [...(empire.history || []), snapshot].slice(-MAX_SNAPSHOTS);
}
