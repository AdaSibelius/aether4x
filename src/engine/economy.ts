import type { GameState, Empire, Colony, Fleet, GameEvent, SpeciesId } from '../types';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';
import { getPlanetPosition } from './fleets';

/**
 * Handles civilian economy and trade demand generation.
 * @intent Orchestrates colony-level supply/demand signals to drive physical trade.
 */
export function tickCivilianEconomy(next: GameState, empire: Empire, dt: number, rng: RNG): GameEvent[] {
    const events: GameEvent[] = [];
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);

    // Physical Trade matching: for every demanded resource, find a colony with excess
    for (const colony of empireColonies) {
        for (const [res, amountNeeded] of Object.entries(colony.demand || {})) {
            if (amountNeeded <= 1.0) continue; // Ignore tiny dust demand

            // Find supplier (must have surplus over 100)
            const suppliers = empireColonies
                .filter(c => c.id !== colony.id && (c.minerals[res] || 0) > 100)
                .sort((a, b) => (b.minerals[res] || 0) - (a.minerals[res] || 0));

            if (suppliers.length > 0) {
                const supplier = suppliers[0];

                // We no longer move the minerals here (abstractly). 
                // Instead, we just establish/update the trade route signal.
                // tickCorporateLogistics will use these routes to task REAL fleets.

                const routeId = generateId('route', rng);
                let route = empire.tradeRoutes?.find(r => r.sourceColonyId === supplier.id && r.targetColonyId === colony.id && r.resource === res);
                if (!route) {
                    route = {
                        id: routeId,
                        sourceColonyId: supplier.id,
                        targetColonyId: colony.id,
                        resource: res,
                        amountToMove: 0,
                        active: true,
                    };
                    if (!empire.tradeRoutes) empire.tradeRoutes = [];
                    empire.tradeRoutes.push(route);
                }

                // The amount to move is the demand, capped by supplier surplus
                const possibleMove = Math.min(amountNeeded, (supplier.minerals[res] || 0) - 100);
                route.amountToMove = possibleMove;
                route.active = true;

                // Wealth creation now happens in tickCorporateLogistics when goods are physically delivered!
                // (This removes the "free money" abstract logic)
            }
        }
    }

    // Clean up inactive trade routes (if they haven't moved anything this tick)
    if (empire.tradeRoutes) {
        empire.tradeRoutes = empire.tradeRoutes.filter(r => r.amountToMove > 0);
        for (const r of empire.tradeRoutes) {
            // Reset for next tick so they disappear if not renewed by demand generator
            r.active = false;
        }
    }

    return events;
}

export function tickCivilianMigration(next: GameState, empire: Empire, rng: RNG): void {
    const empireColonies = Object.values(next.colonies).filter(c => c.empireId === empire.id);
    const overcrowdedColonies = empireColonies.filter(c => c.population > c.maxPopulation);
    const underdevelopedColonies = empireColonies.filter(c => c.population < c.maxPopulation * 0.5 && c.happiness > 40);

    // --- Opportunity Migration (Pull Factor) ---
    // People commit to move to attractive target colonies (Pull factor demand)
    const targetColonies = empireColonies.filter(c => c.migrationMode === 'Target' && c.population < c.maxPopulation * 0.9);
    const sourceColonies = empireColonies.filter(c => c.migrationMode === 'Source' && c.population > 1.0);

    if (targetColonies.length > 0 && sourceColonies.length > 0) {
        for (const target of targetColonies) {
            const source = sourceColonies.sort((a, b) => b.population - a.population)[0];

            // Commitment to move: 0.1% of source population per tick
            const pullAmount = Math.min(0.2, source.population * 0.001);

            if (pullAmount > 0.01) {
                // People prepare to leave (they are now Migrants Waiting)
                // Cap waiting queue at 20% of population
                const currentWaiting = source.migrantsWaiting || 0;
                if (currentWaiting < source.population * 0.2) {
                    source.migrantsWaiting = currentWaiting + pullAmount;
                }
            }
        }
    }

    // --- Overcrowding Migration (Push Factor) ---
    if (overcrowdedColonies.length > 0 && underdevelopedColonies.length > 0) {
        for (const source of overcrowdedColonies) {
            const excessPop = source.population - source.maxPopulation;

            if (excessPop > 0.1) {
                const pushAmount = Math.min(excessPop * 0.1, 1.0); // People desperate to leave
                const currentWaiting = source.migrantsWaiting || 0;
                if (currentWaiting < source.population * 0.5) { // Higher cap for desperate push
                    source.migrantsWaiting = currentWaiting + pushAmount;
                }
            }
        }
    }
}

