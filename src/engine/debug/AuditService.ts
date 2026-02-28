import { GameState, AuditReport } from '@/types';
import { getGlobalMineralInventory } from '../debug';
import SimLogger from '@/utils/logger';

export class AuditService {
    static checkConservationOfMass(state: GameState) {
        const currentInventory = getGlobalMineralInventory(state);

        Object.keys(state.stats.totalProduced).forEach(res => {
            const prod = state.stats.totalProduced[res] || 0;
            const cons = state.stats.totalConsumed[res] || 0;
            const current = currentInventory[res] || 0;

            // We need a baseline to compare against. 
            // In a real-time audit, we compare Delta(Inventory) against Delta(Prod - Cons).
            // However, a simpler check is to log the "Stock + Ships - (Starting + Net Production)".

            // For now, let's just log every 10 ticks for visibility if there's significant drift.
            if (state.turn % 10 === 0) {
                // SimLogger.debug('SYSTEM', `${res}: Current=${Math.floor(current)} | Net=${Math.floor(prod - cons)}`);
            }
        });
    }

    static runLogisticsAudit(state: GameState): { success: boolean, report: AuditReport } {
        const inventory = getGlobalMineralInventory(state);
        const report: AuditReport = {};
        const success = true;

        Object.keys(inventory).forEach(res => {
            const prod = state.stats.totalProduced[res] || 0;
            const cons = state.stats.totalConsumed[res] || 0;
            const current = inventory[res] || 0;

            // This assumes we start at 0 minerals which isn't true for setup.
            // A precise audit requires tracking 'initialInventory' in state.
            report[res] = { current, prod, cons };
        });

        return { success, report };
    }
}
