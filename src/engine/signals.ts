import { GameState, Empire } from '../types';

/**
 * // @intent: Strategic Signal Layer
 * Detects and aggregates all physical resource demand across the empire.
 * This function decouples state construction needs from corporate trade execution.
 */
export function generateColonyResourceDemand(state: GameState, empire: Empire): void {
    const empireColonies = Object.values(state.colonies).filter(c => c.empireId === empire.id);

    for (const colony of empireColonies) {
        // --- 1. Construction Demand (Queued Projects) ---
        // Sum total remaining cost for items in the production queue
        for (const item of colony.productionQueue) {
            if (item.costPerUnit) {
                const fractionRemaining = (100 - (item.progress || 0)) / 100;
                for (const [res, cost] of Object.entries(item.costPerUnit)) {
                    if (cost > 0) {
                        const totalNeeded = cost * item.quantity * fractionRemaining;
                        colony.demand[res] = (colony.demand[res] || 0) + totalNeeded;
                    }
                }
            }
        }

        // Sum total remaining cost for ships in shipyards (Corporate and State)
        for (const sy of colony.shipyards) {
            for (const item of sy.activeBuilds) {
                if (item.costPerUnit) {
                    const fractionRemaining = (100 - (item.progress || 0)) / 100;
                    for (const [res, cost] of Object.entries(item.costPerUnit)) {
                        if (cost > 0) {
                            const totalNeeded = cost * item.quantity * fractionRemaining;
                            colony.demand[res] = (colony.demand[res] || 0) + totalNeeded;
                        }
                    }
                }
            }
        }

        // --- 2. Survival Demand (Consumables) ---
        // Basic reserves: Demand Food if stock < target and pop > 0
        if (colony.population > 0) {
            const foodStock = colony.minerals['Food'] || 0;
            const targetFood = colony.population * 2.0; // 10 days of food reserve
            if (foodStock < targetFood) {
                colony.demand['Food'] = (colony.demand['Food'] || 0) + (targetFood - foodStock);
            }

            // Demand Fuel if stock is low
            const fuelStock = colony.minerals['Fuel'] || 0;
            if (fuelStock < 500) {
                colony.demand['Fuel'] = (colony.demand['Fuel'] || 0) + (1000 - fuelStock);
            }
        }

        // --- 3. Maintenance Demand (Infrastructure) ---
        if (colony.infrastructure > 0) {
            const ironNeeded = colony.infrastructure * 0.1;
            if ((colony.minerals['Iron'] || 0) < ironNeeded) {
                colony.demand['Iron'] = (colony.demand['Iron'] || 0) + ironNeeded;
            }
        }
    }
}
