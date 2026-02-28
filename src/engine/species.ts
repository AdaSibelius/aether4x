import type { SpeciesDefinition, SpeciesId, AtmosphereType, Planet, PopulationSegment } from '../types';

// ─── Species Definitions ─────────────────────────────────────────────────────

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
    human: {
        id: 'human',
        name: 'Human',
        description: 'Adaptable and balanced. Thrive in temperate, breathable atmospheres.',
        icon: '🧑',
        portrait: '/species/human.png',
        idealTemperature: 288,
        temperatureTolerance: 40,
        preferredAtmosphere: ['Breathable'],
        toxicGases: ['Sulfur Dioxide', 'Ammonia', 'Chlorine'],
        growthRateModifier: 1.0,
        miningModifier: 1.0,
        researchModifier: 1.0,
    },
    silicoid: {
        id: 'silicoid',
        name: 'Silicoid',
        description: 'Crystalline beings of living rock. Resilient to extreme heat and barren worlds.',
        icon: '💎',
        portrait: '/species/silicoid.png',
        idealTemperature: 450,
        temperatureTolerance: 100,
        preferredAtmosphere: ['None', 'Thin', 'Corrosive'],
        toxicGases: [],
        growthRateModifier: 0.7,
        miningModifier: 1.3,
        researchModifier: 0.9,
    },
    aquan: {
        id: 'aquan',
        name: 'Aquan',
        description: 'Amphibious scholars. Excel at research but need specific atmospheric conditions.',
        icon: '🐟',
        portrait: '/species/aquan.png',
        idealTemperature: 280,
        temperatureTolerance: 20,
        preferredAtmosphere: ['Breathable', 'Dense'],
        toxicGases: ['Sulfur Dioxide'],
        growthRateModifier: 0.9,
        miningModifier: 0.8,
        researchModifier: 1.2,
    },
    thermian: {
        id: 'thermian',
        name: 'Thermian',
        description: 'Volcanic dwellers forged in extreme heat. Powerful miners but poor researchers.',
        icon: '🔥',
        portrait: '/species/thermian.png',
        idealTemperature: 600,
        temperatureTolerance: 80,
        preferredAtmosphere: ['Dense', 'Toxic'],
        toxicGases: [],
        growthRateModifier: 0.8,
        miningModifier: 1.2,
        researchModifier: 0.9,
    },
    cryogen: {
        id: 'cryogen',
        name: 'Cryogen',
        description: 'Ethereal ice beings. Brilliant minds but fragile and slow to reproduce.',
        icon: '❄️',
        portrait: '/species/cryogen.png',
        idealTemperature: 80,
        temperatureTolerance: 30,
        preferredAtmosphere: ['Thin', 'None'],
        toxicGases: ['Carbon Dioxide', 'Ammonia'],
        growthRateModifier: 0.6,
        miningModifier: 0.8,
        researchModifier: 1.15,
    },
};

/**
 * Get growth rate modifier for a species.
 */
export function getSpeciesGrowthMod(speciesId: SpeciesId): number {
    return SPECIES[speciesId]?.growthRateModifier ?? 1.0;
}

/**
 * Compute how habitable a planet is for a given species.
 * Returns a value between 0.0 (completely hostile) and 1.0 (ideal).
 */
export function computeHabitability(species: SpeciesDefinition, planet: Planet): number {
    // 1. Temperature score — linear falloff outside tolerance band
    const tempDiff = Math.abs(planet.surfaceTemperature - species.idealTemperature);
    const tempScore = tempDiff <= species.temperatureTolerance
        ? 1.0
        : Math.max(0, 1.0 - (tempDiff - species.temperatureTolerance) / (species.temperatureTolerance * 2));

    // 2. Atmosphere score
    let atmoScore: number;
    if (species.preferredAtmosphere.includes(planet.atmosphere)) {
        atmoScore = 1.0;
    } else if (planet.atmosphere === 'None' || planet.atmosphere === 'Thin') {
        atmoScore = 0.4; // survivable but not ideal
    } else {
        atmoScore = 0.15; // hostile
    }

    // 3. Toxic gas penalty
    let toxicPenalty = 0;
    for (const gas of planet.atmosphereComposition) {
        if (species.toxicGases.includes(gas.name) && gas.percentage > 0.05) {
            toxicPenalty += 0.2;
        }
    }

    return Math.max(0, Math.min(1.0, tempScore * atmoScore - toxicPenalty));
}

/**
 * Helper to get habitability modifier for atmosphere types as a fallback.
 * @intent Centralized atmosphere effect logic.
 */
export function getAtmosphereHabitabilityMod(planet: Planet): number {
    if (planet.atmosphere === 'Breathable') return 1.0;
    if (planet.atmosphere === 'Thin' || planet.atmosphere === 'Dense') return 0.5;
    return 0.1;
}

/**
 * Get the species definition by id.
 */
export function getSpecies(id: SpeciesId): SpeciesDefinition {
    return SPECIES[id];
}

/**
 * Get all species definitions as an array.
 */
export function getAllSpecies(): SpeciesDefinition[] {
    return Object.values(SPECIES);
}
