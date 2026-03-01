import type { GameState } from '../types';

/**
 * economy_format.ts
 * Helper utility to provide human-readable names for monetary accounts.
 */

export function getAccountName(game: GameState, accountLabel: string): string {
    if (!accountLabel) return 'Unknown';

    // External accounts - Format: external:label
    if (accountLabel.startsWith('external:')) {
        const label = accountLabel.replace('external:', '');
        return label.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Treasury accounts - Format: treasury:empireId
    if (accountLabel.startsWith('treasury:')) {
        const empireId = accountLabel.replace('treasury:', '');
        const empire = game.empires[empireId];
        return empire ? `${empire.name} Treasury` : 'State Treasury';
    }

    // Colony Private Wealth - Format: colony_pw:colonyId
    if (accountLabel.startsWith('colony_pw:')) {
        const colonyId = accountLabel.replace('colony_pw:', '');
        const colony = game.colonies[colonyId];
        return colony ? `${colony.name} Private Wealth` : 'Colony Wealth';
    }

    // Company Wealth - Format: company:companyId
    if (accountLabel.startsWith('company:')) {
        const companyId = accountLabel.replace('company:', '');
        // We have to search all empires for the company
        for (const emp of Object.values(game.empires)) {
            const comp = emp.companies?.find(c => c.id === companyId);
            if (comp) return comp.name;
        }
        return 'Corporate Account';
    }

    // Fallback pass-through
    return accountLabel;
}
