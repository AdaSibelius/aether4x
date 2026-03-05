import { GameState, Colony } from '../types';
import { simulateBattle, BattleReport } from './combat';

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
 * Returns a quick health snapshot for a single colony.
 */
export function getColonyHealthSnapshot(colony: Colony) {
    return {
        name: colony.name,
        population: colony.population.toFixed(2) + 'M',
        waiting: (colony.migrantsWaiting || 0).toFixed(2) + 'M',
        infrastructure: colony.infrastructure,
        spaceport: colony.spaceport,
        demandCount: Object.keys(colony.demand || {}).length,
        stock: colony.minerals
    };
}

/**
 * Returns the total count of all minerals across all colonies and ships.
 * Used for "Conservation of Mass" invariant checks.
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

/**
 * Generates a telemetry snapshot of the empire's performance.
 * @intent longitudinal data analysis for simulation trends.
 */
export function exportTelemetrySnapshot(state: GameState) {
    const colonies = Object.values(state.colonies);
    const empires = Object.values(state.empires);

    return {
        turn: state.turn,
        date: state.date.toISOString().split('T')[0],
        globalMetrics: {
            totalPopulation: colonies.reduce((sum, c) => sum + c.population, 0),
            totalWealth: empires.reduce((sum, e) => sum + e.treasury, 0),
            totalMinerals: getGlobalMineralInventory(state),
            activeShips: Object.keys(state.ships).length,
        },
        sectoralWealth: Object.fromEntries(
            empires.map(e => [e.name, e.companies.map(c => ({ name: c.name, type: c.type, wealth: c.wealth }))])
        )
    };
}

/**
 * Runs a deterministic dry-run battle between two fleets and returns a full BattleReport.
 * Uses simulateBattle() internally — does NOT mutate game state.
 *
 * @param fleetAId - ID of the first fleet.
 * @param fleetBId - ID of the second fleet.
 * @param state    - Live game state.
 * @param maxRounds - Maximum simulation rounds (default 200).
 */
export function runBattleSim(
    fleetAId: string,
    fleetBId: string,
    state: GameState,
    maxRounds = 200
): BattleReport {
    return simulateBattle(fleetAId, fleetBId, state, maxRounds);
}

