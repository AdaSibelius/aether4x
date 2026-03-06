import type { GameState } from '../types';

/**
 * Returns a condensed summary of global logistics health.
 * Primarily used for AI-assisted debugging and simulation audits.
 */
export function getLogisticHealthSnapshot(state: GameState) {
    const colonies = Object.values(state.colonies);
    const totalResourceDemand: Record<string, number> = {};
    const totalResourceStock: Record<string, number> = {};

    colonies.forEach(colony => {
        // Aggregate Demand
        Object.entries(colony.demand || {}).forEach(([res, amount]) => {
            totalResourceDemand[res] = (totalResourceDemand[res] || 0) + amount;
        });

        // Aggregate Stock
        Object.entries(colony.minerals).forEach(([res, amount]) => {
            totalResourceStock[res] = (totalResourceStock[res] || 0) + amount;
        });
    });

    const waitingMigrants = colonies.reduce((sum, c) => sum + (c.migrantsWaiting || 0), 0);
    const ships = Object.values(state.ships);
    const cargoInTransit: Record<string, number> = {};

    ships.forEach(ship => {
        if (ship.cargo) {
            Object.entries(ship.cargo).forEach(([res, amount]) => {
                cargoInTransit[res] = (cargoInTransit[res] || 0) + amount;
            });
        }
    });

    return {
        timestamp: new Date().toISOString(),
        turn: state.turn,
        colonies: colonies.length,
        metrics: {
            globalDemand: totalResourceDemand,
            globalStock: totalResourceStock,
            inTransit: cargoInTransit,
            waitingMigrants: waitingMigrants.toFixed(2) + 'M'
        }
    };
}

/**
 * Returns the total count of all minerals across all colonies and ships.
 * Used for "Conservation of Mass" invariant checks in scenarios.
 */
export function getGlobalMineralInventory(state: GameState): Record<string, number> {
    const total: Record<string, number> = {};

    // Sum from colonies
    Object.values(state.colonies).forEach(colony => {
        Object.entries(colony.minerals).forEach(([res, amount]) => {
            total[res] = (total[res] || 0) + amount;
        });
    });

    // Sum from ships
    Object.values(state.ships).forEach(ship => {
        if (ship.cargo) {
            Object.entries(ship.cargo).forEach(([res, amount]) => {
                total[res] = (total[res] || 0) + amount;
            });
        }
        if (ship.fuel > 0) {
            total['Fuel'] = (total['Fuel'] || 0) + ship.fuel;
        }
    });

    return total;
}
