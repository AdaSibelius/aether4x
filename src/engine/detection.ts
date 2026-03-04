import type { GameState, Fleet, Empire } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────
/**
 * Base detection range (AU) per unit of sensor resolution.
 * A sensor with resolution 40 can detect a ship with signature 1.0 at 40 * BASE_DETECTION_RANGE AU.
 */
const BASE_DETECTION_RANGE_PER_RESOLUTION = 0.1; // AU per resolution point

/**
 * Signature grows logarithmically with power draw to prevent high-end ships
 * from being trivially detectable across entire systems.
 */
const SIGNATURE_POWER_FACTOR = 0.05;
const SIGNATURE_SIZE_FACTOR = 0.001;

// ─── Signature Calculation ────────────────────────────────────────────────────

/**
 * Calculates the total Aetheric Flux signature for a fleet.
 * Signature is the sum of each ship's power draw multiplied by its hull size.
 * Stealth hulls (future tech) can reduce this.
 */
export function calculateFleetSignature(fleet: Fleet, state: GameState): number {
    const empire = state.empires[fleet.empireId];
    if (!empire || fleet.shipIds.length === 0) return 0;

    let totalSignature = 0;

    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        // Signature = power draw (how much Aetheric energy is emitted) + hull bulk
        const powerSignature = design.powerDraw * SIGNATURE_POWER_FACTOR;
        const sizeSignature = design.maxHullPoints * SIGNATURE_SIZE_FACTOR;
        totalSignature += Math.max(1, powerSignature + sizeSignature);
    }

    return totalSignature;
}

/**
 * Calculates the maximum sensor range (AU) for a fleet.
 * Uses the best sensor in the fleet across all ships.
 */
export function getFleetSensorRange(fleet: Fleet, state: GameState): number {
    const empire = state.empires[fleet.empireId];
    if (!empire) return 0;

    let bestRange = 0;
    let bestResolution = 0;

    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;

        for (const comp of design.components) {
            if (comp.type === 'Sensor') {
                const range = comp.stats.range ?? 0;
                const resolution = comp.stats.resolution ?? 0;
                if (range > bestRange) bestRange = range;
                if (resolution > bestResolution) bestResolution = resolution;
            }
        }
    }

    // Effective detection range is scaled by sensor resolution vs. target signature
    // but base range is pure sensor range for now - resolution modifies detection in canDetect()
    return bestRange;
}

/**
 * Determines if a sensor fleet can detect a target fleet given their respective stats.
 * Detection succeeds if the sensor's effective range (scaled by resolution vs. signature) >= distance.
 */
export function canDetect(
    sensorRange: number,
    sensorResolution: number,
    targetSignature: number,
    distanceAU: number
): boolean {
    if (targetSignature <= 0) return false;
    // Effective detection range: higher signature extends the range you can be seen at.
    // Higher sensor resolution also extends the range you can see.
    const effectiveRange = sensorRange * (sensorResolution * BASE_DETECTION_RANGE_PER_RESOLUTION) * Math.log10(1 + targetSignature);
    return distanceAU <= effectiveRange;
}

// ─── Best Sensor Stats ────────────────────────────────────────────────────────

function getBestSensorStats(fleet: Fleet, state: GameState): { range: number; resolution: number } {
    const empire = state.empires[fleet.empireId];
    if (!empire) return { range: 0, resolution: 0 };

    let bestRange = 1; // Minimum visual range (eyeshot)
    let bestResolution = 10; // Minimum passive resolution

    for (const shipId of fleet.shipIds) {
        const ship = state.ships[shipId];
        if (!ship) continue;
        const design = empire.designLibrary.find(d => d.id === ship.designId);
        if (!design) continue;
        for (const comp of design.components) {
            if (comp.type === 'Sensor') {
                if ((comp.stats.range ?? 0) > bestRange) bestRange = comp.stats.range ?? 0;
                if ((comp.stats.resolution ?? 0) > bestResolution) bestResolution = comp.stats.resolution ?? 0;
            }
        }
    }
    return { range: bestRange, resolution: bestResolution };
}

// ─── Main Visibility Update ───────────────────────────────────────────────────

/**
 * Updates Fog of War for all empires each tick.
 *
 * Performance: O(F²) in the same star system. We first bucket fleets by star,
 * so fleets in different systems never interact. This keeps the inner loop small.
 */
export function updateVisibility(state: GameState): void {
    // 1. Re-calculate signatures for all fleets
    const allFleets: Fleet[] = Object.values(state.empires).flatMap(e => e.fleets);

    for (const fleet of allFleets) {
        fleet.signature = calculateFleetSignature(fleet, state);
        fleet.detectedByEmpireIds = [fleet.empireId]; // Always visible to own empire
    }

    // 2. Bucket fleets by star system
    const fleetsByStar: Record<string, Fleet[]> = {};
    for (const fleet of allFleets) {
        if (!fleetsByStar[fleet.currentStarId]) {
            fleetsByStar[fleet.currentStarId] = [];
        }
        fleetsByStar[fleet.currentStarId].push(fleet);
    }

    // 3. Within each star system, check all empire pairs for detection
    for (const starId in fleetsByStar) {
        const starFleets = fleetsByStar[starId];
        if (starFleets.length < 2) continue;

        for (let i = 0; i < starFleets.length; i++) {
            const sensor = starFleets[i];
            if (!state.empires[sensor.empireId]) continue;
            const { range, resolution } = getBestSensorStats(sensor, state);

            for (let j = 0; j < starFleets.length; j++) {
                if (i === j) continue;
                const target = starFleets[j];
                if (target.empireId === sensor.empireId) continue; // Same empire, already visible

                const dx = target.position.x - sensor.position.x;
                const dy = target.position.y - sensor.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const targetSignature = target.signature ?? 0;
                if (canDetect(range, resolution, targetSignature, dist)) {
                    if (!target.detectedByEmpireIds) target.detectedByEmpireIds = [];
                    if (!target.detectedByEmpireIds.includes(sensor.empireId)) {
                        target.detectedByEmpireIds.push(sensor.empireId);
                    }
                }
            }
        }
    }
}
