import { TECH_TREE } from '../engine/research';

function simulateResearch() {
    console.log("=== Research Progression Simulation ===");
    console.log("Assuming aggressive lab expansion and scientist growth.\n");

    let currentYear = 0;

    const labsPerEra = [
        3,  // Tier 2 era
        8,  // Tier 3 era
        20, // Tier 4 era
        50, // Tier 5 era
        100, // Tier 6 era
        200, // Tier 7 era
        500  // Tier 8 era
    ];

    const tiersToSimulate = [2, 3, 4, 5, 6, 7, 8];

    for (const tier of tiersToSimulate) {
        const techsInTier = TECH_TREE.filter(t => t.tier === tier);
        const totalTierCost = techsInTier.reduce((sum, t) => sum + t.cost, 0);
        const labs = labsPerEra[tier - 2];

        // Estimated bonuses: Leveling scientists + tech bonuses
        let baseBonus = 1.0;
        if (tier >= 3) baseBonus += 0.2; // Level 4 scientist avg
        if (tier >= 4) baseBonus += 0.4; // Research techs + Level 6 scientist
        if (tier >= 5) baseBonus += 0.8; // Specialized training + Level 8
        if (tier >= 6) baseBonus += 1.5; // Neural links + Level 10

        const dailyRP = (labs * 20) * baseBonus;
        const yearlyRP = dailyRP * 365;

        const yearsForTier = totalTierCost / yearlyRP;

        console.log(`Tier ${tier}:`);
        console.log(`  Techs: ${techsInTier.length}`);
        console.log(`  Total Cost: ${totalTierCost.toLocaleString()} RP`);
        console.log(`  Est. Labs: ${labs}`);
        console.log(`  Est. Yearly RP: ${Math.round(yearlyRP).toLocaleString()}`);
        console.log(`  Time to Clear: ${yearsForTier.toFixed(2)} years`);
        console.log("-----------------------------------");

        currentYear += yearsForTier;
    }

    console.log(`Total estimated time to complete full tree: ${currentYear.toFixed(2)} years.`);
}

simulateResearch();
