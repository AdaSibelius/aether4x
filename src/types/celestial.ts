import { Vec2, AtmosphereType, AtmosphericGas } from './base';
import { Colony } from './colony';

export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'WhiteDwarf' | 'Neutron' | 'BlackHole';

export type CelestialType = 'Star' | 'Planet' | 'Moon' | 'Asteroid' | 'Comet';

export type CelestialSubtype =
    | 'MainSequence' | 'RedGiant' | 'Supergiant' | 'WhiteDwarf' | 'NeutronStar' | 'BlackHole' // Star subtypes
    | 'Terrestrial' | 'GasGiant' | 'IceGiant' | 'Dwarf' | 'Ocean' | 'Desert' | 'Volcanic'  // Planet/Moon subtypes
    | 'Protoplanetary' | 'Rogue'
    | 'S' | 'C' | 'M' | 'D' // Asteroid types
    | 'ShortPeriod' | 'LongPeriod'; // Comet types

export interface Star {
    id: string;
    name: string;
    spectralType: SpectralType;
    luminosity: number;         // relative to Sol
    position: Vec2;             // galaxy-map coordinates
    planets: Planet[];
    jumpPoints: JumpPoint[];
    explored: boolean;          // has any empire surveyed this system?
    surveyedByEmpires: string[]; // empire IDs
    claimedByEmpireId?: string;
    claimProgress?: { empireId: string, ticks: number }[];
}

export type BodyType = CelestialSubtype; // Legacy compatibility

export interface Mineral {
    name: string;
    amount: number;      // 0–10000 units
    accessibility: number; // 0.1 – 1.0
}

export interface Planet {
    id: string;
    name: string;
    type: CelestialType;
    subtype: CelestialSubtype;
    bodyType: BodyType;
    orbitRadius: number;
    orbitAngle: number;
    radius: number;
    albedo: number;
    surfaceTemperature: number;
    atmosphericPressure: number;
    atmosphere: AtmosphereType;
    atmosphereComposition: AtmosphericGas[];
    colonies: Colony[];
    minerals: Mineral[];
    surveyedByEmpires: string[];
    parentId?: string;
    moons: Planet[];
}

export interface JumpPoint {
    id: string;
    starId: string;
    targetStarId: string;
    position: Vec2;
    discovered: boolean;
}
