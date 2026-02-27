import type { Galaxy, Star, Planet, JumpPoint, Mineral, SpectralType, BodyType, AtmosphereType, CelestialType, CelestialSubtype } from '@/types';
import { RNG } from '@/utils/rng';

// ─── Name Generation ─────────────────────────────────────────────────────────
const PREFIXES = ['Sol', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Tau', 'Sigma', 'Omicron', 'Psi', 'Kepler', 'Gliese', 'HD', 'Wolf', 'Lacaille', 'Ross', 'Vega', 'Sirius', 'Proxima', 'Rigel', 'Deneb', 'Altair', 'Spica', 'Antares', 'Polaris'];
const SUFFIXES = ['Prime', 'Major', 'Minor', 'Secundus', 'Tertius', 'IV', 'VII', 'IX', 'A', 'B', 'Centauri', 'Eridani', 'Cygni'];

function generateStarName(rng: RNG, index: number): string {
    if (index === 0) return 'Sol';
    if (rng.chance(0.4)) return `${rng.pick(PREFIXES)} ${rng.pick(SUFFIXES)}`;
    return `${rng.pick(PREFIXES)} ${rng.intBetween(100, 9999)}`;
}

function generatePlanetName(starName: string, index: number): string {
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return `${starName} ${roman[index] ?? index + 1}`;
}

// ─── Spectral Type Distribution ───────────────────────────────────────────────
const SPECTRAL_WEIGHTS: { type: SpectralType; weight: number }[] = [
    { type: 'M', weight: 0.35 },
    { type: 'K', weight: 0.25 },
    { type: 'G', weight: 0.15 },
    { type: 'F', weight: 0.10 },
    { type: 'A', weight: 0.07 },
    { type: 'B', weight: 0.04 },
    { type: 'O', weight: 0.01 },
    { type: 'WhiteDwarf', weight: 0.02 },
    { type: 'Neutron', weight: 0.01 },
];
function pickSpectral(rng: RNG): SpectralType {
    const r = rng.next();
    let acc = 0;
    for (const { type, weight } of SPECTRAL_WEIGHTS) { acc += weight; if (r < acc) return type; }
    return 'M';
}

// ─── Classification Helpers ───────────────────────────────────────────────────

export function canHostBuildings(body: Planet): boolean {
    // Stars and Gas/Ice Giants are too hazardous/gaseous for standard structures
    if (body.type === 'Star') return false;
    if (body.subtype === 'GasGiant' || body.subtype === 'IceGiant') return false;
    // Comets and small Asteroids might also be restricted depending on size, 
    // but for now let's allow them if they are big enough or specifically for mining.
    return true;
}

export function isBodyHabitable(body: Planet): boolean {
    if (body.type === 'Star') return false;
    if (body.subtype === 'GasGiant' || body.subtype === 'IceGiant') return false;
    if (body.atmosphere === 'Breathable' && body.surfaceTemperature >= 250 && body.surfaceTemperature <= 320) return true;
    return false;
}

// ─── Mineral Generation ───────────────────────────────────────────────────────
const MINERAL_NAMES = ['Iron', 'Copper', 'Titanium', 'Uranium', 'Tungsten', 'Cobalt', 'Lithium', 'Platinum', 'Ambergris', 'Aether'];

export function generateMinerals(rng: RNG, rich: boolean): Mineral[] {
    const count = rng.intBetween(1, rich ? 6 : 4);
    const names = [...MINERAL_NAMES].sort(() => rng.next() - 0.5).slice(0, count);
    return names.map(name => ({
        name,
        amount: Math.round(rng.between(100, rich ? 8000 : 3000)),
        accessibility: Math.round(rng.between(0.1, 1.0) * 10) / 10,
    }));
}

// ─── Planet Generation ────────────────────────────────────────────────────────
export function generatePlanets(rng: RNG, starName: string, spectral: SpectralType, starLuminosity: number): Planet[] {
    const count = rng.intBetween(1, 10);
    const planets: Planet[] = [];
    const atmospheres: AtmosphereType[] = ['None', 'Thin', 'Breathable', 'Dense', 'Toxic', 'Corrosive'];

    for (let i = 0; i < count; i++) {
        const orbitRadius = 0.3 + i * rng.between(0.4, 1.8);
        const inHabitableZone = spectral === 'G' && orbitRadius >= 0.8 && orbitRadius <= 1.6;

        // Determine Hierarchy & Type
        let type: CelestialType = 'Planet';
        let subtype: CelestialSubtype = 'Terrestrial';

        if (orbitRadius > 3 && rng.chance(0.6)) {
            subtype = rng.pick(['GasGiant', 'IceGiant'] as CelestialSubtype[]);
        } else if (rng.chance(0.1)) {
            subtype = 'Dwarf';
        } else if (rng.chance(0.05)) {
            type = 'Asteroid';
            subtype = rng.pick(['S', 'C', 'M'] as CelestialSubtype[]);
        }

        let atmosphere: AtmosphereType = inHabitableZone ? (rng.chance(0.25) ? 'Breathable' : rng.pick(atmospheres)) : rng.pick(atmospheres);

        let albedo = 0.3;
        if (subtype === 'Dwarf' || type === 'Asteroid') albedo = rng.between(0.05, 0.2);
        else if (subtype === 'IceGiant') albedo = rng.between(0.4, 0.7);
        else if (subtype === 'GasGiant') albedo = rng.between(0.3, 0.5);

        let atmosphericPressure = 0;
        let atmosphereComposition: { name: string, percentage: number }[] = [];

        if (subtype === 'Dwarf' || type === 'Asteroid') {
            atmosphere = 'None';
            atmosphericPressure = 0;
        } else if (subtype === 'GasGiant' || subtype === 'IceGiant') {
            atmosphere = 'Dense';
            atmosphericPressure = rng.between(50, 1000);
            atmosphereComposition = [{ name: 'Hydrogen', percentage: 0.8 }, { name: 'Helium', percentage: 0.19 }, { name: 'Methane', percentage: 0.01 }];
        } else {
            switch (atmosphere) {
                case 'None': atmosphericPressure = 0; break;
                case 'Thin':
                    atmosphericPressure = rng.between(0.01, 0.5);
                    atmosphereComposition = [{ name: 'Carbon Dioxide', percentage: 0.95 }, { name: 'Nitrogen', percentage: 0.05 }];
                    break;
                case 'Breathable':
                    atmosphericPressure = rng.between(0.7, 1.5);
                    atmosphereComposition = [{ name: 'Nitrogen', percentage: 0.78 }, { name: 'Oxygen', percentage: 0.21 }, { name: 'Argon', percentage: 0.01 }];
                    break;
                case 'Dense':
                    atmosphericPressure = rng.between(2.0, 100.0);
                    atmosphereComposition = [{ name: 'Carbon Dioxide', percentage: 0.9 }, { name: 'Sulfur Dioxide', percentage: 0.1 }];
                    break;
                case 'Toxic':
                case 'Corrosive':
                    atmosphericPressure = rng.between(1.0, 90.0);
                    atmosphereComposition = [{ name: 'Carbon Dioxide', percentage: 0.8 }, { name: 'Sulfur Dioxide', percentage: 0.15 }, { name: 'Ammonia', percentage: 0.05 }];
                    break;
            }
        }

        const baseTemp = 278.5 * Math.pow(starLuminosity, 0.25) * Math.pow(orbitRadius, -0.5) * Math.pow(1 - albedo, 0.25);
        let greenhouseFactor = 1.0;
        if (atmosphericPressure > 0) {
            const hasCO2 = atmosphereComposition.some(g => g.name === 'Carbon Dioxide' && g.percentage > 0.1);
            if (hasCO2) greenhouseFactor += Math.log10(1 + atmosphericPressure * 10) * 0.5;
            else if (atmosphere === 'Breathable') greenhouseFactor += 0.13;
            else if (subtype === 'GasGiant' || subtype === 'IceGiant') greenhouseFactor += 0.5;
        }

        const surfaceTemperature = Math.round(baseTemp * greenhouseFactor);
        const isGasGiant = subtype === 'GasGiant' || subtype === 'IceGiant';
        const minerals = isGasGiant
            ? [{ name: 'Aether', amount: Math.round(rng.between(8000, 15000)), accessibility: Math.round(rng.between(0.8, 1.0) * 10) / 10 }]
            : generateMinerals(rng, rng.chance(0.2)).filter(m => m.name !== 'Aether');

        const planetId = `planet_${starName.replace(/\s+/g, '_')}_${i}`;
        const planetName = generatePlanetName(starName, i);

        // Generate Moons
        const moons: Planet[] = [];
        if (isGasGiant || (subtype === 'Terrestrial' && rng.chance(0.3))) {
            const moonCount = isGasGiant ? rng.intBetween(2, 6) : 1;
            for (let j = 0; j < moonCount; j++) {
                moons.push({
                    id: `${planetId}_moon_${j}`,
                    name: `${planetName}-${String.fromCharCode(97 + j)}`,
                    type: 'Moon',
                    subtype: 'Dwarf', // Most moons are dwarf/rocky
                    bodyType: 'Dwarf',
                    orbitRadius: 0.002 + j * 0.001, // Very small AU for moons
                    orbitAngle: rng.next() * Math.PI * 2,
                    radius: rng.between(0.05, 0.2),
                    albedo: rng.between(0.05, 0.2),
                    surfaceTemperature: surfaceTemperature, // Simplified
                    atmosphericPressure: 0,
                    atmosphere: 'None',
                    atmosphereComposition: [],
                    colonies: [],
                    minerals: generateMinerals(rng, false).filter(m => m.name !== 'Aether'),
                    surveyedByEmpires: [],
                    parentId: planetId,
                    moons: [],
                });
            }
        }

        planets.push({
            id: planetId,
            name: planetName,
            type,
            subtype,
            bodyType: subtype,
            orbitRadius,
            orbitAngle: rng.next() * Math.PI * 2,
            radius: isGasGiant ? rng.between(3, 12) : rng.between(0.3, 2.0),
            albedo: Math.round(albedo * 100) / 100,
            surfaceTemperature,
            atmosphericPressure: Math.round(atmosphericPressure * 100) / 100,
            atmosphere,
            atmosphereComposition,
            colonies: [],
            minerals,
            surveyedByEmpires: [],
            moons,
        });
    }
    return planets;
}

// ─── Poisson Disk Sampling for star positions ─────────────────────────────────
function poissonDiskSample(rng: RNG, count: number, width: number, height: number, minDist: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const maxAttempts = 30;
    for (let i = 0; i < count * 10 && points.length < count; i++) {
        const candidate = { x: rng.between(0, width), y: rng.between(0, height) };
        const valid = points.every(p => {
            const dx = p.x - candidate.x, dy = p.y - candidate.y;
            return Math.sqrt(dx * dx + dy * dy) >= minDist;
        });
        if (valid) points.push(candidate);
        if (i > count * maxAttempts) break;
    }
    return points;
}

// ─── Jump Point Generation ────────────────────────────────────────────────────
function generateJumpPointNetwork(rng: RNG, stars: Star[]): JumpPoint[] {
    const jumpPoints: JumpPoint[] = [];
    const connected = new Set<string>([stars[0].id]);
    const remaining = stars.slice(1).map(s => s.id);

    // Minimum spanning tree: connect every star to at least one other
    while (remaining.length > 0) {
        const fromId = rng.pick([...connected]);
        const from = stars.find(s => s.id === fromId)!;
        // Find nearest unconnected
        const sorted = remaining.map(id => {
            const s = stars.find(x => x.id === id)!;
            const dx = s.position.x - from.position.x;
            const dy = s.position.y - from.position.y;
            return { id, dist: Math.sqrt(dx * dx + dy * dy) };
        }).sort((a, b) => a.dist - b.dist);

        const target = sorted[0];
        if (!target) break;

        const jpId1 = `jp_${fromId}_${target.id}`;
        const jpId2 = `jp_${target.id}_${fromId}`;
        const fromStar = from;
        const toStar = stars.find(s => s.id === target.id)!;

        const jp1: JumpPoint = { id: jpId1, starId: fromId, targetStarId: target.id, position: { x: rng.between(-4, 4), y: rng.between(-4, 4) }, discovered: false };
        const jp2: JumpPoint = { id: jpId2, starId: target.id, targetStarId: fromId, position: { x: rng.between(-4, 4), y: rng.between(-4, 4) }, discovered: false };
        fromStar.jumpPoints.push(jp1);
        toStar.jumpPoints.push(jp2);
        jumpPoints.push(jp1, jp2);

        connected.add(target.id);
        remaining.splice(remaining.indexOf(target.id), 1);
    }

    // Add some extra connections for network richness
    const extraCount = Math.floor(stars.length * 0.3);
    for (let e = 0; e < extraCount; e++) {
        const s1 = rng.pick(stars);
        const s2 = rng.pick(stars.filter(s => s.id !== s1.id));
        const exists = s1.jumpPoints.some(jp => jp.targetStarId === s2.id);
        if (!exists) {
            const jp1: JumpPoint = { id: `jp_extra_${s1.id}_${s2.id}`, starId: s1.id, targetStarId: s2.id, position: { x: rng.between(-4, 4), y: rng.between(-4, 4) }, discovered: false };
            const jp2: JumpPoint = { id: `jp_extra_${s2.id}_${s1.id}`, starId: s2.id, targetStarId: s1.id, position: { x: rng.between(-4, 4), y: rng.between(-4, 4) }, discovered: false };
            s1.jumpPoints.push(jp1);
            s2.jumpPoints.push(jp2);
            jumpPoints.push(jp1, jp2);
        }
    }

    return jumpPoints;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function generateGalaxy(seed: number, starCount: number = 80): Galaxy {
    const rng = new RNG(seed);
    const WIDTH = 1000, HEIGHT = 1000;
    const MIN_DIST = 30;

    const positions = poissonDiskSample(rng, starCount, WIDTH, HEIGHT, MIN_DIST);
    // Ensure we place Sol at the center-ish
    positions[0] = { x: WIDTH / 2 + rng.between(-30, 30), y: HEIGHT / 2 + rng.between(-30, 30) };

    const stars: Star[] = positions.map((pos, i) => {
        const spectral = i === 0 ? 'G' : pickSpectral(rng);
        const name = generateStarName(rng, i);
        const luminosity = rng.between(0.1, 10);
        return {
            id: `star_${i}`,
            name,
            spectralType: spectral,
            luminosity,
            position: pos,
            planets: generatePlanets(rng, name, spectral, luminosity),
            jumpPoints: [],
            explored: i === 0,    // Sol starts explored
            surveyedByEmpires: [],
        };
    });

    const jumpPoints = generateJumpPointNetwork(rng, stars);
    const starsById: Record<string, Star> = {};
    for (const s of stars) starsById[s.id] = s;

    return { stars: starsById, jumpPoints, width: WIDTH, height: HEIGHT, seed };
}
