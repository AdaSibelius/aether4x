import { setupNewGame } from '../engine/setup';
import { advanceTick } from '../engine/time';
import { RNG } from '../utils/rng';
import { getEmpireTechBonuses } from '../engine/research';
import fs from 'fs';

/**
 * Headless simulation to verify the impact of specialized companies and buildings.
 * Focuses on long-term resource production and company count.
 */
function simulateTechImpact() {
    const rng = new RNG(42);
    let state = setupNewGame('Player', 42);
    state.tickLength = 86400; // 1 day ticks
    const durationYears = 50;
    const ticksPerDay = 1;
    const totalTicks = durationYears * 365 * ticksPerDay;

    console.log(`Starting 50-year Tech Impact Simulation...`);

    // Track stats over time
    const snapshots: Record<string, number | string | boolean>[] = [];

    for (let i = 0; i < totalTicks; i++) {
        state = advanceTick(state);

        // Every year, log status
        if (i % (365 * ticksPerDay) === 0) {
            const year = Math.floor(i / (365 * ticksPerDay));
            const empire = state.empires[state.playerEmpireId];
            const colony = Object.values(state.colonies).find(c => c.empireId === empire.id)!;
            const techBonuses = getEmpireTechBonuses(empire.research.completedTechs);

            const stats = {
                year,
                population: colony.population.toFixed(2) + 'M',
                wealth: colony.privateWealth.toFixed(0),
                companies: empire.companies.length,
                specializedCompanies: empire.companies.filter(c => ['AethericSiphon', 'DeepCoreMining', 'Reclamation'].includes(c.type)).length,
                techCount: empire.research.completedTechs.length,
                miningRate: techBonuses.mining_rate?.toFixed(2) || 1.0,
                farmYield: techBonuses.farm_yield?.toFixed(2) || 1.0,
                aether: colony.minerals.Aether?.toFixed(0) || 0
            };
            snapshots.push(stats);
            console.log(`Year ${year}: Pop=${stats.population} Corps=${stats.companies} (Spec=${stats.specializedCompanies}) Aether=${stats.aether}`);
        }
    }

    // Export snapshots
    fs.writeFileSync('tech_impact_sim.json', JSON.stringify(snapshots, null, 2));
    console.log(`Simulation complete. Snapshots saved to tech_impact_sim.json`);
}

simulateTechImpact();
