import type { Galaxy, Star, Planet, JumpPoint, Mineral, SpectralType, AtmosphereType, CelestialType, CelestialSubtype } from '../types';
import { generatePlanets } from './galaxy';
import { RNG } from '../utils/rng';

// ─── Real Star Catalog ───────────────────────────────────────────────────────
interface StarEntry {
    name: string;
    spectral: SpectralType;
    luminosity: number;
    x: number; y: number; z: number; // ly from Sol
}

const STAR_CATALOG: StarEntry[] = [
    { name: 'Sol', spectral: 'G', luminosity: 1.00, x: 0.00, y: 0.00, z: 0.00 },
    { name: 'Alpha Centauri', spectral: 'G', luminosity: 1.52, x: -1.64, y: -1.37, z: -3.84 },
    { name: 'Barnard\'s Star', spectral: 'M', luminosity: 0.0004, x: -0.01, y: 1.81, z: 5.62 },
    { name: 'Wolf 359', spectral: 'M', luminosity: 0.001, x: -3.86, y: -2.47, z: 5.82 },
    { name: 'Lalande 21185', spectral: 'M', luminosity: 0.025, x: -3.41, y: 0.48, z: 7.54 },
    { name: 'Sirius', spectral: 'A', luminosity: 25.4, x: -1.61, y: 8.06, z: -2.47 },
    { name: 'Luyten 726-8', spectral: 'M', luminosity: 0.0001, x: 5.09, y: -3.36, z: -5.78 },
    { name: 'Ross 154', spectral: 'M', luminosity: 0.005, x: 1.91, y: -8.65, z: -3.91 },
    { name: 'Ross 248', spectral: 'M', luminosity: 0.002, x: 7.38, y: 0.58, z: 7.19 },
    { name: 'Epsilon Eridani', spectral: 'K', luminosity: 0.34, x: 6.21, y: 8.31, z: -1.73 },
    { name: 'Lacaille 9352', spectral: 'M', luminosity: 0.013, x: 8.47, y: -2.83, z: -6.27 },
    { name: 'Ross 128', spectral: 'M', luminosity: 0.004, x: -0.98, y: 1.67, z: -10.77 },
    { name: 'EZ Aquarii', spectral: 'M', luminosity: 0.0003, x: 10.19, y: -3.76, z: -2.96 },
    { name: '61 Cygni', spectral: 'K', luminosity: 0.15, x: -6.11, y: -6.04, z: 7.24 },
    { name: 'Procyon', spectral: 'F', luminosity: 6.93, x: -4.76, y: 10.31, z: 1.04 },
    { name: 'Struve 2398', spectral: 'M', luminosity: 0.003, x: -7.87, y: -3.82, z: 7.10 },
    { name: 'Groombridge 34', spectral: 'M', luminosity: 0.006, x: -0.48, y: 2.87, z: 11.22 },
    { name: 'Epsilon Indi', spectral: 'K', luminosity: 0.22, x: 5.66, y: -3.15, z: -9.89 },
    { name: 'Tau Ceti', spectral: 'G', luminosity: 0.52, x: 10.27, y: 5.01, z: -3.26 },
    { name: 'GJ 1061', spectral: 'M', luminosity: 0.001, x: -5.13, y: -6.92, z: -8.37 },
    { name: 'YZ Ceti', spectral: 'M', luminosity: 0.002, x: 7.71, y: -8.52, z: -2.06 },
    { name: 'Luyten\'s Star', spectral: 'M', luminosity: 0.001, x: -4.59, y: 11.44, z: -3.00 },
    { name: 'Teegarden\'s Star', spectral: 'M', luminosity: 0.0001, x: 3.40, y: 11.47, z: -0.41 },
    { name: 'Kapteyn\'s Star', spectral: 'M', luminosity: 0.013, x: 1.89, y: -9.47, z: -8.86 },
    { name: 'Lacaille 8760', spectral: 'M', luminosity: 0.03, x: -6.18, y: -0.29, z: -10.79 },
];

// ─── Sol System Templates ───────────────────────────────────────────────────

interface BodyTemplate {
    name: string;
    type: CelestialType;
    subtype: CelestialSubtype;
    orbitRadius: number;
    orbitAngle: number;
    radius: number;
    albedo: number;
    surfaceTemperature: number;
    atmosphericPressure: number;
    atmosphere: AtmosphereType;
    atmosphereComposition: { name: string; percentage: number }[];
    minerals: Mineral[];
    moons?: BodyTemplate[];
}

const SOL_PLANETS: BodyTemplate[] = [
    {
        name: 'Mercury', type: 'Planet', subtype: 'Terrestrial',
        orbitRadius: 0.39, orbitAngle: 0.84, radius: 0.38, albedo: 0.12, surfaceTemperature: 440, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Iron', amount: 20000, accessibility: 0.5 }, { name: 'Lithium', amount: 8000, accessibility: 0.3 }, { name: 'Ambergris', amount: 30000, accessibility: 0.7 }],
    },
    {
        name: 'Venus', type: 'Planet', subtype: 'Terrestrial',
        orbitRadius: 0.72, orbitAngle: 2.15, radius: 0.95, albedo: 0.75, surfaceTemperature: 737, atmosphericPressure: 92.0,
        atmosphere: 'Corrosive', atmosphereComposition: [{ name: 'Carbon Dioxide', percentage: 0.965 }, { name: 'Nitrogen', percentage: 0.035 }],
        minerals: [{ name: 'Uranium', amount: 10000, accessibility: 0.2 }, { name: 'Titanium', amount: 15000, accessibility: 0.4 }, { name: 'Tungsten', amount: 6000, accessibility: 0.3 }],
    },
    {
        name: 'Earth', type: 'Planet', subtype: 'Terrestrial',
        orbitRadius: 1.00, orbitAngle: 0.0, radius: 1.00, albedo: 0.30, surfaceTemperature: 288, atmosphericPressure: 1.0,
        atmosphere: 'Breathable', atmosphereComposition: [{ name: 'Nitrogen', percentage: 0.781 }, { name: 'Oxygen', percentage: 0.209 }, { name: 'Argon', percentage: 0.01 }],
        minerals: [{ name: 'Iron', amount: 50000, accessibility: 0.8 }, { name: 'Uranium', amount: 25000, accessibility: 0.5 }, { name: 'Titanium', amount: 40000, accessibility: 0.7 }],
        moons: [
            {
                name: 'The Moon', type: 'Moon', subtype: 'Dwarf',
                orbitRadius: 0.00257, orbitAngle: 1.2, radius: 0.27, albedo: 0.12, surfaceTemperature: 250, atmosphericPressure: 0,
                atmosphere: 'None', atmosphereComposition: [],
                minerals: [{ name: 'Iron', amount: 15000, accessibility: 0.6 }, { name: 'Platinum', amount: 2000, accessibility: 0.4 }],
            }
        ]
    },
    {
        name: 'Mars', type: 'Planet', subtype: 'Terrestrial',
        orbitRadius: 1.52, orbitAngle: 4.71, radius: 0.53, albedo: 0.15, surfaceTemperature: 210, atmosphericPressure: 0.006,
        atmosphere: 'Thin', atmosphereComposition: [{ name: 'Carbon Dioxide', percentage: 0.953 }, { name: 'Nitrogen', percentage: 0.027 }],
        minerals: [{ name: 'Iron', amount: 20000, accessibility: 0.5 }, { name: 'Uranium', amount: 35000, accessibility: 0.6 }],
        moons: [
            { name: 'Phobos', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.00006, orbitAngle: 0.5, radius: 0.01, albedo: 0.07, surfaceTemperature: 230, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
            { name: 'Deimos', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.00015, orbitAngle: 2.5, radius: 0.006, albedo: 0.08, surfaceTemperature: 230, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Ceres', type: 'Asteroid', subtype: 'C',
        orbitRadius: 2.77, orbitAngle: 1.68, radius: 0.07, albedo: 0.09, surfaceTemperature: 167, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Iron', amount: 15000, accessibility: 0.9 }, { name: 'Lithium', amount: 5000, accessibility: 0.7 }],
    },
    {
        name: 'Vesta', type: 'Asteroid', subtype: 'S',
        orbitRadius: 2.36, orbitAngle: 3.92, radius: 0.04, albedo: 0.42, surfaceTemperature: 150, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Iron', amount: 12000, accessibility: 0.8 }, { name: 'Copper', amount: 8000, accessibility: 0.6 }],
    },
    {
        name: 'Pallas', type: 'Asteroid', subtype: 'S',
        orbitRadius: 2.77, orbitAngle: 5.2, radius: 0.04, albedo: 0.12, surfaceTemperature: 160, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Platinum', amount: 4000, accessibility: 0.5 }],
    },
    {
        name: 'Hygiea', type: 'Asteroid', subtype: 'C',
        orbitRadius: 3.14, orbitAngle: 0.8, radius: 0.03, albedo: 0.07, surfaceTemperature: 155, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Ambergris', amount: 8000, accessibility: 0.4 }],
    },
    {
        name: 'Jupiter', type: 'Planet', subtype: 'GasGiant',
        orbitRadius: 5.20, orbitAngle: 0.52, radius: 11.2, albedo: 0.52, surfaceTemperature: 165, atmosphericPressure: 1000,
        atmosphere: 'Dense', atmosphereComposition: [{ name: 'Hydrogen', percentage: 0.898 }, { name: 'Helium', percentage: 0.102 }],
        minerals: [{ name: 'Aether', amount: 120000, accessibility: 0.9 }],
        moons: [
            { name: 'Io', type: 'Moon', subtype: 'Volcanic', orbitRadius: 0.0028, orbitAngle: 0, radius: 0.28, albedo: 0.63, surfaceTemperature: 130, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [{ name: 'Iron', amount: 5000, accessibility: 1.0 }] },
            { name: 'Europa', type: 'Moon', subtype: 'Ocean', orbitRadius: 0.0044, orbitAngle: 1.5, radius: 0.24, albedo: 0.67, surfaceTemperature: 102, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
            { name: 'Ganymede', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.007, orbitAngle: 3.1, radius: 0.41, albedo: 0.43, surfaceTemperature: 110, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
            { name: 'Callisto', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.012, orbitAngle: 4.7, radius: 0.38, albedo: 0.22, surfaceTemperature: 134, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Saturn', type: 'Planet', subtype: 'GasGiant',
        orbitRadius: 9.54, orbitAngle: 3.14, radius: 9.45, albedo: 0.47, surfaceTemperature: 134, atmosphericPressure: 1000.0,
        atmosphere: 'Dense', atmosphereComposition: [{ name: 'Hydrogen', percentage: 0.963 }, { name: 'Helium', percentage: 0.032 }],
        minerals: [{ name: 'Aether', amount: 100000, accessibility: 0.8 }],
        moons: [
            { name: 'Titan', type: 'Moon', subtype: 'Terrestrial', orbitRadius: 0.008, orbitAngle: 0.8, radius: 0.4, albedo: 0.21, surfaceTemperature: 94, atmosphericPressure: 1.45, atmosphere: 'Dense', atmosphereComposition: [{ name: 'Nitrogen', percentage: 0.98 }, { name: 'Methane', percentage: 0.02 }], minerals: [] },
            { name: 'Enceladus', type: 'Moon', subtype: 'Ocean', orbitRadius: 0.0016, orbitAngle: 2.2, radius: 0.04, albedo: 0.99, surfaceTemperature: 75, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Uranus', type: 'Planet', subtype: 'IceGiant',
        orbitRadius: 19.2, orbitAngle: 1.20, radius: 4.0, albedo: 0.51, surfaceTemperature: 76, atmosphericPressure: 1000.0,
        atmosphere: 'Dense', atmosphereComposition: [{ name: 'Hydrogen', percentage: 0.83 }, { name: 'Helium', percentage: 0.15 }, { name: 'Methane', percentage: 0.02 }],
        minerals: [{ name: 'Aether', amount: 80000, accessibility: 0.7 }],
        moons: [
            { name: 'Titania', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.0029, orbitAngle: 1.1, radius: 0.12, albedo: 0.27, surfaceTemperature: 80, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
            { name: 'Oberon', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.0039, orbitAngle: 4.5, radius: 0.11, albedo: 0.23, surfaceTemperature: 75, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Neptune', type: 'Planet', subtype: 'IceGiant',
        orbitRadius: 30.1, orbitAngle: 4.40, radius: 3.88, albedo: 0.29, surfaceTemperature: 72, atmosphericPressure: 1000.0,
        atmosphere: 'Dense', atmosphereComposition: [{ name: 'Hydrogen', percentage: 0.80 }, { name: 'Helium', percentage: 0.19 }, { name: 'Methane', percentage: 0.01 }],
        minerals: [{ name: 'Aether', amount: 90000, accessibility: 0.8 }],
        moons: [
            { name: 'Triton', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.0023, orbitAngle: 2.8, radius: 0.21, albedo: 0.76, surfaceTemperature: 38, atmosphericPressure: 0.00001, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Pluto', type: 'Planet', subtype: 'Dwarf',
        orbitRadius: 39.5, orbitAngle: 2.80, radius: 0.18, albedo: 0.49, surfaceTemperature: 44, atmosphericPressure: 0.00001,
        atmosphere: 'None', atmosphereComposition: [{ name: 'Nitrogen', percentage: 0.90 }, { name: 'Methane', percentage: 0.10 }],
        minerals: [{ name: 'Tungsten', amount: 3000, accessibility: 0.5 }, { name: 'Copper', amount: 2000, accessibility: 0.4 }],
        moons: [
            { name: 'Charon', type: 'Moon', subtype: 'Dwarf', orbitRadius: 0.00013, orbitAngle: 0, radius: 0.09, albedo: 0.35, surfaceTemperature: 50, atmosphericPressure: 0, atmosphere: 'None', atmosphereComposition: [], minerals: [] },
        ]
    },
    {
        name: 'Halley\'s Comet', type: 'Comet', subtype: 'ShortPeriod',
        orbitRadius: 17.8, orbitAngle: 0.10, radius: 0.01, albedo: 0.04, surfaceTemperature: 200, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Uranium', amount: 8000, accessibility: 0.9 }, { name: 'Platinum', amount: 4000, accessibility: 0.8 }],
    },
    {
        name: 'Hale-Bopp', type: 'Comet', subtype: 'LongPeriod',
        orbitRadius: 186, orbitAngle: 3.80, radius: 0.03, albedo: 0.04, surfaceTemperature: 200, atmosphericPressure: 0,
        atmosphere: 'None', atmosphereComposition: [],
        minerals: [{ name: 'Uranium', amount: 20000, accessibility: 0.7 }, { name: 'Cobalt', amount: 5000, accessibility: 0.5 }],
    }
];

function buildPlanetFromTemplate(temp: BodyTemplate, parentId: string, empireId?: string): Planet {
    const planetId = `planet_Sol_${temp.name.replace(/\s+/g, '_')}`;
    const moons = (temp.moons || []).map(m => buildPlanetFromTemplate(m, planetId));

    return {
        id: planetId,
        name: temp.name,
        type: temp.type,
        subtype: temp.subtype,
        bodyType: temp.subtype,
        orbitRadius: temp.orbitRadius,
        orbitAngle: temp.orbitAngle,
        radius: temp.radius,
        albedo: temp.albedo,
        surfaceTemperature: temp.surfaceTemperature,
        atmosphericPressure: temp.atmosphericPressure,
        atmosphere: temp.atmosphere,
        atmosphereComposition: temp.atmosphereComposition,
        colonies: [],
        surveyedByEmpires: empireId ? [empireId] : [],
        minerals: temp.minerals,
        parentId: parentId,
        moons: moons,
    };
}

function createSolPlanets(): Planet[] {
    return SOL_PLANETS.map(temp => buildPlanetFromTemplate(temp, 'star_0', 'empire_player'));
}

// ─── Jump Point Network (distance-based) ─────────────────────────────────────

function dist3D(a: StarEntry, b: StarEntry): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function buildJumpPoints(rng: RNG, stars: Star[], catalog: StarEntry[]): JumpPoint[] {
    const jumpPoints: JumpPoint[] = [];
    const MAX_JUMP_DIST = 8; // light years

    for (let i = 0; i < catalog.length; i++) {
        for (let j = i + 1; j < catalog.length; j++) {
            const d = dist3D(catalog[i], catalog[j]);
            if (d <= MAX_JUMP_DIST) {
                const s1 = stars[i], s2 = stars[j];
                const jpId1 = `jp_${s1.id}_${s2.id}`;
                const jpId2 = `jp_${s2.id}_${s1.id}`;
                const jp1: JumpPoint = {
                    id: jpId1, starId: s1.id, targetStarId: s2.id,
                    position: { x: rng.between(-4, 4), y: rng.between(-4, 4) },
                    discovered: i === 0,
                };
                const jp2: JumpPoint = {
                    id: jpId2, starId: s2.id, targetStarId: s1.id,
                    position: { x: rng.between(-4, 4), y: rng.between(-4, 4) },
                    discovered: false,
                };
                s1.jumpPoints.push(jp1);
                s2.jumpPoints.push(jp2);
                jumpPoints.push(jp1, jp2);
            }
        }
    }
    return jumpPoints;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateRealSpaceGalaxy(): Galaxy {
    const rng = new RNG(42);
    const WIDTH = 1000, HEIGHT = 1000;
    const SCALE = 800 / 30;
    const CX = WIDTH / 2, CY = HEIGHT / 2;

    const stars: Star[] = STAR_CATALOG.map((entry, i) => {
        const mapX = CX + entry.x * SCALE;
        const mapY = CY + entry.z * SCALE;

        const isSol = i === 0;
        const planets = isSol
            ? createSolPlanets()
            : generatePlanets(rng, entry.name, entry.spectral, entry.luminosity);

        return {
            id: `star_${i}`,
            name: entry.name,
            spectralType: entry.spectral,
            luminosity: entry.luminosity,
            position: { x: mapX, y: mapY },
            planets,
            jumpPoints: [],
            explored: isSol,
            surveyedByEmpires: isSol ? ['empire_player'] : [],
        };
    });

    const jumpPoints = buildJumpPoints(rng, stars, STAR_CATALOG);
    const starsById: Record<string, Star> = {};
    for (const s of stars) starsById[s.id] = s;

    return { stars: starsById, jumpPoints, width: WIDTH, height: HEIGHT, seed: 42 };
}
