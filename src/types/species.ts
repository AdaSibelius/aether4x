import { AtmosphereType } from './base';

export type SpeciesId = 'human' | 'silicoid' | 'aquan' | 'thermian' | 'cryogen';

export interface SpeciesDefinition {
    id: SpeciesId;
    name: string;
    description: string;
    icon: string;
    portrait: string;
    idealTemperature: number;
    temperatureTolerance: number;
    preferredAtmosphere: AtmosphereType[];
    toxicGases: string[];
    growthRateModifier: number;
    miningModifier: number;
    researchModifier: number;
}

export interface PopulationSegment {
    speciesId: SpeciesId;
    count: number;
    happiness: number;
    habitability: number;
}
