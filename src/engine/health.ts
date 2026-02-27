import { GameState } from '@/types';

export interface HealthReport {
    isHealthy: boolean;
    issues: string[];
}

export function runHealthAudit(game: GameState): HealthReport {
    const issues: string[] = [];

    // 1. Empire & Colony Checks
    const playerEmpire = game.empires[game.playerEmpireId];
    if (!playerEmpire) issues.push('CRITICAL: Player empire missing or ID mismatch.');

    for (const [id, colony] of Object.entries(game.colonies)) {
        if (!colony.planetId) issues.push(`Colony ${id} has no planet ID.`);
        // Note: systemId is actually stored on the planet, not directly on the colony in some versions
        // Let's check if we can verify the star existence another way or if systemId is elsewhere
    }

    // 2. Corporate & Mineral Checks
    for (const company of playerEmpire?.companies || []) {
        if (isNaN(company.wealth)) issues.push(`Company ${company.name} has NaN wealth.`);
        if (!company.history) issues.push(`Company ${company.name} has no history array.`);
        if (!company.transactions) issues.push(`Company ${company.name} has no transactions array.`);
    }

    // 3. Fleet & Orbital Checks
    for (const fleet of playerEmpire?.fleets || []) {
        if (fleet.orbitingPlanetId) {
            const star = game.galaxy.stars[fleet.currentStarId];
            const planet = star?.planets.find(p => p.id === fleet.orbitingPlanetId);
            if (!planet) issues.push(`Fleet ${fleet.name} is orbiting non-existent planet ${fleet.orbitingPlanetId}.`);
        }
    }

    return {
        isHealthy: issues.length === 0,
        issues
    };
}
