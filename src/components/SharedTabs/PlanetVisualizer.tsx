'use client';
import { useRef, useEffect } from 'react';
import type { Planet, Colony, AtmosphereType, BodyType, CelestialType, CelestialSubtype } from '@/types';
import styles from './SharedTabs.module.css';

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function makePrng(seed: number) {
    let s = Math.abs(seed) | 1;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function strHash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function rgba(r: number, g: number, b: number, a = 1) {
    return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

// ─── Atmosphere halo config ──────────────────────────────────────────────────

const ATMO_HALO: Record<AtmosphereType, { inner: string; outer: string; width: number } | null> = {
    None: null,
    Thin: { inner: rgba(200, 210, 220, 0.18), outer: rgba(200, 210, 220, 0), width: 14 },
    Breathable: { inner: rgba(80, 160, 255, 0.35), outer: rgba(80, 160, 255, 0), width: 22 },
    Dense: { inner: rgba(255, 180, 80, 0.40), outer: rgba(255, 180, 80, 0), width: 28 },
    Toxic: { inner: rgba(100, 255, 60, 0.38), outer: rgba(60, 200, 40, 0), width: 22 },
    Corrosive: { inner: rgba(180, 40, 200, 0.45), outer: rgba(100, 20, 120, 0), width: 30 },
};

// ─── Planet base colors ──────────────────────────────────────────────────────

function getBaseColors(type: CelestialType, subtype: CelestialSubtype, rng: () => number) {
    if (type === 'Star') {
        switch (subtype) {
            case 'MainSequence': return { base: '#fff2a0', glow: 'rgba(255,200,50,0.8)', core: '#ffffff' };
            case 'RedGiant': return { base: '#ff6030', glow: 'rgba(255,80,20,0.7)', core: '#ff9060' };
            case 'WhiteDwarf': return { base: '#e0f0ff', glow: 'rgba(100,180,255,0.6)', core: '#ffffff' };
            case 'NeutronStar': return { base: '#a0c0ff', glow: 'rgba(120,100,255,0.9)', core: '#ffffff' };
            case 'BlackHole': return { base: '#000000', glow: 'rgba(180,100,255,0.4)', core: '#101010' };
            default: return { base: '#fff260', glow: 'rgba(255,180,40,0.8)', core: '#ffffff' };
        }
    }
    if (type === 'Comet') {
        return { base: '#d0e8ff', dark: '#507090', highlight: '#ffffff' };
    }

    switch (subtype) {
        case 'Terrestrial':
        case 'Ocean':
        case 'Desert':
        case 'Volcanic': {
            const oceanHue = subtype === 'Ocean' ? 220 : subtype === 'Volcanic' ? 10 : 200 + rng() * 30;
            return {
                ocean: `hsl(${oceanHue},60%,25%)`,
                land1: `hsl(${100 + rng() * 30},35%,28%)`,
                land2: `hsl(${30 + rng() * 20},45%,30%)`,
                pole: '#c8dce8',
            };
        }
        case 'GasGiant': {
            const hue = 20 + rng() * 40;
            return {
                band1: `hsl(${hue},55%,48%)`,
                band2: `hsl(${hue + 15},65%,62%)`,
                band3: `hsl(${hue - 10},40%,35%)`,
                storm: `hsl(${hue + 5},70%,68%)`,
            };
        }
        case 'IceGiant': {
            const hue = 185 + rng() * 40;
            return {
                band1: `hsl(${hue},55%,50%)`,
                band2: `hsl(${hue + 20},45%,65%)`,
                band3: `hsl(${hue - 15},40%,40%)`,
                storm: '#e8f4ff',
            };
        }
        case 'Dwarf':
        case 'S': case 'C': case 'M':
            return { base: '#5a5a62', dark: '#3a3a40', highlight: '#8a8a92' };
        default:
            return { base: '#5a5a62', dark: '#3a3a40', highlight: '#8a8a92' };
    }
}

// ─── Drawing functions ────────────────────────────────────────────────────────

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) {
    ctx.save();
    for (let i = 0; i < 120; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = rng() * 1.2;
        const a = 0.3 + rng() * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(200, 210, 255, a);
        ctx.fill();
    }
    ctx.restore();
}

function drawAtmosphereHalo(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    atmo: AtmosphereType
) {
    const cfg = ATMO_HALO[atmo];
    if (!cfg) return;
    const grad = ctx.createRadialGradient(cx, cy, R - 2, cx, cy, R + cfg.width);
    grad.addColorStop(0, cfg.inner);
    grad.addColorStop(1, cfg.outer);
    ctx.beginPath();
    ctx.arc(cx, cy, R + cfg.width, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
}

/** Draw a clipped sphere with custom content via callback */
function withSphereClip(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    fn: () => void
) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    fn();
    ctx.restore();
}

function drawTerminator(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
    const offset = R * 0.18;
    const grad = ctx.createRadialGradient(cx + offset, cy, R * 0.4, cx + R * 0.7, cy, R * 1.5);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
}

/** Draw Earth using the equirectangular texture map */
function drawEarthTexture(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    tex: HTMLImageElement, rot: number
) {
    const diameter = R * 2;
    // Scale texture to fill sphere height; width wraps
    const texH = diameter;
    const texW = tex.width * (texH / tex.height);
    const scrollX = -(rot * 0.3) % texW;
    const y = cy - R;

    // Draw texture twice for seamless wrapping
    ctx.drawImage(tex, cx - R + scrollX, y, texW, texH);
    ctx.drawImage(tex, cx - R + scrollX - texW, y, texW, texH);
    ctx.drawImage(tex, cx - R + scrollX + texW, y, texW, texH);
}

// Earth city positions as calibrated map fractions for the specific generated texture
// The AI-generated texture is not a perfect geometrical projection, so these
// are visually matched to the continents drawn in public/earth_texture.png
const EARTH_CITIES = [
    { fx: 0.22, fy: 0.35, label: 'NewYork' },       // US East Coast
    { fx: 0.32, fy: 0.60, label: 'SaoPaulo' },      // Brazil East Coast
    { fx: 0.44, fy: 0.25, label: 'London' },        // Western Europe
    { fx: 0.48, fy: 0.48, label: 'Lagos' },         // West Africa coast
    { fx: 0.69, fy: 0.45, label: 'Mumbai' },        // India
    { fx: 0.81, fy: 0.36, label: 'Shanghai' },      // East China
    { fx: 0.87, fy: 0.34, label: 'Tokyo' },         // Japan
    { fx: 0.53, fy: 0.22, label: 'Moscow' },        // Russia
    { fx: 0.55, fy: 0.38, label: 'Cairo' },         // Egypt
    { fx: 0.15, fy: 0.45, label: 'MexicoCity' },    // Central America
    { fx: 0.87, fy: 0.62, label: 'Sydney' },        // SE Australia
];

function drawEarthCityLights(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colony: Colony, tex: HTMLImageElement, rot: number
) {
    // Use exact same scroll math as drawEarthTexture
    const diameter = R * 2;
    const texH = diameter;
    const texW = tex.width * (texH / tex.height);
    const scrollX = -(rot * 0.3) % texW;

    const intensity = Math.min(30, (colony.factories ?? 0) + Math.floor((colony.population ?? 0) / 100));
    const dotsPerCity = Math.max(4, Math.round(intensity / 3));

    for (const city of EARTH_CITIES) {
        // Convert map fraction to pixel position on the drawn texture
        const mapX = cx - R + scrollX + city.fx * texW;
        const mapY = cy - R + city.fy * texH;
        const cityRng = makePrng(strHash(colony.id + city.label));

        // Draw at multiple wrap positions for seamless wrapping
        for (const wrapOff of [0, texW, -texW]) {
            const bx = mapX + wrapOff;
            // Skip if too far outside sphere for performance
            if (bx < cx - R * 1.5 || bx > cx + R * 1.5) continue;

            for (let d = 0; d < dotsPerCity; d++) {
                const dx = bx + (cityRng() - 0.5) * R * 0.10;
                const dy = mapY + (cityRng() - 0.5) * R * 0.06;
                const dr = 1.0 + cityRng() * 2.2;
                const bright = cityRng() > 0.3;

                const glow = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr * 3);
                glow.addColorStop(0, bright ? 'rgba(255,230,120,0.55)' : 'rgba(255,190,80,0.35)');
                glow.addColorStop(1, 'rgba(255,200,80,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(dx, dy, dr * 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.arc(dx, dy, dr * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = bright ? 'rgba(255,250,200,0.95)' : 'rgba(255,220,140,0.8)';
                ctx.fill();
            }
        }
    }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, colors: Record<string, string>, rot: number) {
    const time = rot * 0.05;

    // Core glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    grad.addColorStop(0, colors.core);
    grad.addColorStop(0.3, colors.base);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Corona pulses
    for (let i = 0; i < 8; i++) {
        const angle = i * (Math.PI / 4) + time * 0.2;
        const len = R * (1.2 + Math.sin(time + i) * 0.3);
        const w = R * 0.4;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - 0.2) * w, cy + Math.sin(angle - 0.2) * w);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.lineTo(cx + Math.cos(angle + 0.2) * w, cy + Math.sin(angle + 0.2) * w);
        ctx.closePath();

        const rayGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        rayGrad.addColorStop(0, colors.base);
        rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rayGrad;
        ctx.fill();
    }
}

function drawComet(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, colors: Record<string, string>, rng: () => number, rot: number) {
    // Nucleus
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * 0.01);

    // Irregular nucleus
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = R * (0.6 + rng() * 0.6);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.8;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colors.base;
    ctx.fill();
    ctx.restore();

    // Tail (always pointing "away" or in a set direction)
    const tailLen = R * 20;
    const tailAngle = -Math.PI / 4;
    const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(tailAngle) * tailLen, cy + Math.sin(tailAngle) * tailLen);
    grad.addColorStop(0, 'rgba(200,230,255,0.4)');
    grad.addColorStop(0.1, 'rgba(180,210,255,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(tailAngle - 0.1) * tailLen, cy + Math.sin(tailAngle - 1.1) * tailLen);
    ctx.arc(cx, cy, tailLen, tailAngle - 0.1, tailAngle + 0.1);
    ctx.lineTo(cx, cy);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
}

function drawPlanetSphere(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    type: CelestialType, subtype: CelestialSubtype, atmo: AtmosphereType,
    rng: () => number, rot: number, colony: Colony | null,
    earthTex?: HTMLImageElement | null
) {
    const colors = getBaseColors(type, subtype, rng) as any;

    if (type === 'Star') {
        drawStar(ctx, cx, cy, R, colors, rot);
        return;
    }

    if (type === 'Comet') {
        drawComet(ctx, cx, cy, R, colors, rng, rot);
        return;
    }

    // ── Sphere base fill ──────────────────────────────────────────────────────
    const baseGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);

    switch (subtype) {
        case 'Terrestrial':
        case 'Ocean':
        case 'Desert':
        case 'Volcanic':
            baseGrad.addColorStop(0, adjustL(colors.ocean, 15));
            baseGrad.addColorStop(1, adjustL(colors.ocean, -10));
            break;
        case 'GasGiant':
            baseGrad.addColorStop(0, colors.band2);
            baseGrad.addColorStop(1, colors.band3);
            break;
        case 'IceGiant':
            baseGrad.addColorStop(0, colors.band2);
            baseGrad.addColorStop(1, colors.band3);
            break;
        case 'Dwarf':
        case 'S': case 'C': case 'M':
            baseGrad.addColorStop(0, colors.highlight || '#888');
            baseGrad.addColorStop(1, colors.dark || '#333');
            break;
    }
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // ── Terrain layer ─────────────────────────────────────────────────────────
    const terrainSeed = (rng() * 0xffffffff) >>> 0;
    withSphereClip(ctx, cx, cy, R, () => {
        const isTerrestrial = subtype === 'Terrestrial' || subtype === 'Ocean' || subtype === 'Desert' || subtype === 'Volcanic';

        if (isTerrestrial) {
            if (earthTex && earthTex.complete && earthTex.naturalWidth > 0) {
                drawEarthTexture(ctx, cx, cy, R, earthTex, rot);
                if (colony) drawEarthCityLights(ctx, cx, cy, R, colony, earthTex, rot);
            } else {
                drawTerrestrialTerrain(ctx, cx, cy, R, colors, terrainSeed, rot);
                if (colony) drawCityLights(ctx, cx, cy, R, colony, terrainSeed, rot);
            }
        } else if (subtype === 'GasGiant' || subtype === 'IceGiant') {
            drawGasBands(ctx, cx, cy, R, colors, rot, subtype === 'IceGiant' ? 0.6 : 1.0);
            if (colony) drawAtmosphericStations(ctx, cx, cy, R, colony, rot);
        } else if (subtype === 'Dwarf') {
            drawCraters(ctx, cx, cy, R, colors, rng, rot);
            if (colony) drawSurfaceStructures(ctx, cx, cy, R, colony, rng, rot, false);
        } else if (['S', 'C', 'M'].includes(subtype as string) || type === 'Asteroid') {
            drawAsteroidDetail(ctx, cx, cy, R, colors, rng, rot);
            if (colony) drawSurfaceStructures(ctx, cx, cy, R, colony, rng, rot, true);
        }

        drawTerminator(ctx, cx, cy, R);
    });

    // ── Sphere edge highlight ─────────────────────────────────────────────────
    withSphereClip(ctx, cx, cy, R, () => {
        const rim = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
        rim.addColorStop(0, 'rgba(255,255,255,0)');
        rim.addColorStop(1, 'rgba(180,210,255,0.12)');
        ctx.fillStyle = rim;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

        const sheen = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.38, 0, cx, cy, R * 0.9);
        sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
        sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
        sheen.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    });

    // ── Atmosphere halo (outside clip) ────────────────────────────────────────
    drawAtmosphereHalo(ctx, cx, cy, R, atmo);
}

// Crude lightness shift for HSL strings
function adjustL(hsl: string, delta: number): string {
    return hsl.replace(/(\d+)%\)/, (_, l) => `${Math.max(0, Math.min(100, +l + delta))}%)`);
}

// ─── Terrestrial terrain ──────────────────────────────────────────────────────

interface ContinentData {
    rx: number;  // center x relative to planet center
    ry: number;  // center y relative to planet center
    w: number;   // half-width
    h: number;   // half-height
    tilt: number;
    col: string;
    noiseSeed: number; // for coastline perturbation
}

/** Generate continent geometry — deterministic from seed */
function generateContinents(R: number, seed: number, colors: Record<string, string>): ContinentData[] {
    const rng = makePrng(seed);
    const count = 6 + Math.floor(rng() * 4); // 6-9 continents
    const continents: ContinentData[] = [];

    for (let i = 0; i < count; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * R * 0.68;
        const rx = Math.cos(angle) * dist;
        const ry = Math.sin(angle) * dist * 0.55;
        const w = (0.12 + rng() * 0.22) * R;
        const h = w * (0.4 + rng() * 0.5);
        const tilt = rng() * Math.PI;
        const col = rng() > 0.4 ? (colors.land1 ?? '#4a7a38') : (colors.land2 ?? '#6b5a3a');
        const noiseSeed = (rng() * 0xffffffff) >>> 0;
        continents.push({ rx, ry, w, h, tilt, col, noiseSeed });
    }
    return continents;
}

/** Draw continent as an irregular noise-perturbed polygon */
function drawContinentShape(
    ctx: CanvasRenderingContext2D,
    baseCx: number, baseCy: number,
    cont: ContinentData, fillStyle: string
) {
    const VERTS = 28;
    const noiseRng = makePrng(cont.noiseSeed);
    // Pre-generate noise displacements
    const displacements: number[] = [];
    for (let v = 0; v < VERTS; v++) displacements.push(0.65 + noiseRng() * 0.7); // 0.65–1.35

    ctx.beginPath();
    for (let v = 0; v <= VERTS; v++) {
        const idx = v % VERTS;
        const a = (idx / VERTS) * Math.PI * 2;
        // Ellipse base radius at this angle
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const baseR = (cont.w * cont.h) / Math.sqrt((cont.h * cosA) ** 2 + (cont.w * sinA) ** 2);
        const r = baseR * displacements[idx];
        // Rotate by continent tilt
        const rx = Math.cos(a + cont.tilt) * r;
        const ry = Math.sin(a + cont.tilt) * r * 0.6; // flatten for sphere projection

        const px = baseCx + rx;
        const py = baseCy + ry;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
}

function drawTerrestrialTerrain(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colors: Record<string, string>,
    terrainSeed: number, rot: number
) {
    const diameter = R * 2;
    const scrollX = (rot * 0.3) % diameter;
    const continents = generateContinents(R, terrainSeed, colors);

    const drawContinentsAt = (offsetX: number) => {
        for (const c of continents) {
            const baseCx = cx + c.rx + offsetX;
            const baseCy = cy + c.ry;

            // Main landmass (noise-perturbed polygon)
            drawContinentShape(ctx, baseCx, baseCy, c, c.col);

            // Darker interior region for terrain variation (mountains/desert)
            ctx.save();
            ctx.globalAlpha = 0.3;
            const innerCont = { ...c, w: c.w * 0.55, h: c.h * 0.55, noiseSeed: c.noiseSeed + 13 };
            drawContinentShape(ctx, baseCx, baseCy, innerCont, colors.land2 ?? '#6b5a3a');
            ctx.restore();

            // Coastal shelf (slightly larger, very faint)
            ctx.save();
            ctx.globalAlpha = 0.12;
            const shelfCont = { ...c, w: c.w * 1.15, h: c.h * 1.15, noiseSeed: c.noiseSeed + 3 };
            drawContinentShape(ctx, baseCx, baseCy, shelfCont, 'hsl(180,30%,35%)');
            ctx.restore();
        }
    };

    drawContinentsAt(scrollX);
    drawContinentsAt(scrollX - diameter);

    // North polar cap
    const poleCap = ctx.createLinearGradient(cx, cy - R, cx, cy - R * 0.55);
    poleCap.addColorStop(0, colors.pole ?? '#ddeeff');
    poleCap.addColorStop(1, 'rgba(180,210,230,0)');
    ctx.fillStyle = poleCap;
    ctx.fillRect(cx - R, cy - R, R * 2, R);

    // South polar cap
    const southCap = ctx.createLinearGradient(cx, cy + R, cx, cy + R * 0.6);
    southCap.addColorStop(0, colors.pole ?? '#ddeeff');
    southCap.addColorStop(1, 'rgba(180,210,230,0)');
    ctx.fillStyle = southCap;
    ctx.fillRect(cx - R, cy + R * 0.5, R * 2, R * 0.5);
}

// ─── City lights ─────────────────────────────────────────────────────────────

function drawCityLights(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colony: Colony, terrainSeed: number, rot: number
) {
    const diameter = R * 2;
    const scrollX = (rot * 0.3) % diameter;

    const intensity = Math.min(20, (colony.factories ?? 0) + Math.floor((colony.population ?? 0) / 100));
    const clusters = Math.max(2, Math.round(intensity / 3));

    // Same seed → identical continent geometry
    const continents = generateContinents(R, terrainSeed, {} as Record<string, string>);

    const drawCities = (offsetX: number) => {
        for (let c = 0; c < Math.min(clusters, continents.length); c++) {
            const cont = continents[c % continents.length];
            const baseCx = cx + cont.rx + offsetX;
            const baseCy = cy + cont.ry;
            const cityRng = makePrng(strHash(colony.id + 'city' + c));
            const dotsInCluster = 5 + Math.floor(cityRng() * 12);

            for (let d = 0; d < dotsInCluster; d++) {
                // Scatter within continent bounds — use polar placement so dots stay inside the shape
                const angle = cityRng() * Math.PI * 2;
                const radFrac = cityRng() * 0.6; // stay well inside, max 60% of boundary
                const dx = baseCx + Math.cos(angle + cont.tilt) * cont.w * radFrac;
                const dy = baseCy + Math.sin(angle + cont.tilt) * cont.h * radFrac * 0.6;
                const dr = 1.0 + cityRng() * 2.0;
                const bright = cityRng() > 0.35;

                const glow = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr * 3);
                glow.addColorStop(0, bright ? 'rgba(255,230,120,0.5)' : 'rgba(255,190,80,0.3)');
                glow.addColorStop(1, 'rgba(255,200,80,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(dx, dy, dr * 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.arc(dx, dy, dr * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = bright ? 'rgba(255,250,200,0.95)' : 'rgba(255,220,140,0.8)';
                ctx.fill();
            }
        }
    };

    drawCities(scrollX);
    drawCities(scrollX - diameter);
}

// ─── Gas / Ice Giant bands ────────────────────────────────────────────────────

function drawGasBands(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colors: Record<string, string>, rot: number, opacity: number
) {
    const numBands = 6;
    for (let i = 0; i < numBands; i++) {
        const frac = i / numBands;
        const y = cy - R + frac * R * 2;
        const bandH = (R * 2) / numBands;
        const col = i % 3 === 0 ? colors.band1 : i % 3 === 1 ? colors.band2 : colors.band3;
        // Wavy edge via sin
        const wave = Math.sin(frac * Math.PI * 3 + rot * 0.008) * R * 0.04;

        ctx.fillStyle = col.replace(')', `,${opacity})`).replace('hsl', 'hsla');
        ctx.beginPath();
        ctx.rect(cx - R, y + wave, R * 2, bandH);
        ctx.fill();
    }

    // Great spot for gas giants
    if (opacity > 0.8) {
        const spotX = cx + Math.sin(rot * 0.004) * R * 0.3;
        const spotY = cy + R * 0.2;
        const grad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, R * 0.14);
        grad.addColorStop(0, colors.storm ?? 'rgba(255,240,200,0.8)');
        grad.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, R * 0.14, R * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── Atmospheric stations (gas / ice giant) ───────────────────────────────────

function drawAtmosphericStations(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colony: Colony, rot: number
) {
    const numRings = Math.min(3, 1 + Math.floor(((colony.factories ?? 0) + (colony.shipyards?.length ?? 0)) / 12));

    for (let ring = 0; ring < numRings; ring++) {
        const altitude = R * (1.12 + ring * 0.10);
        const tilt = 0.22 + ring * 0.08; // perspective tilt
        const speed = 0.006 + ring * 0.002;
        const platformCount = 3 + ring * 2;

        // Ring arc (dashed ellipse approximation)
        ctx.save();
        ctx.strokeStyle = `rgba(160,220,255,${0.25 - ring * 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, altitude, altitude * tilt, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Platform dots
        for (let p = 0; p < platformCount; p++) {
            const angle = (p / platformCount) * Math.PI * 2 + rot * speed;
            const px = cx + Math.cos(angle) * altitude;
            const py = cy + Math.sin(angle) * altitude * tilt;

            // Only draw above the planet center (front half approximation)
            if (Math.sin(angle) < 0.3) {
                const dotGlow = ctx.createRadialGradient(px, py, 0, px, py, 5);
                dotGlow.addColorStop(0, 'rgba(180,240,255,0.9)');
                dotGlow.addColorStop(1, 'rgba(100,200,255,0)');
                ctx.fillStyle = dotGlow;
                ctx.beginPath();
                ctx.arc(px, py, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Small cross = station body
                ctx.strokeStyle = 'rgba(200,240,255,0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py);
                ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

// ─── Dwarf craters ────────────────────────────────────────────────────────────

function drawCraters(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colors: Record<string, string>, rng: () => number, rot: number
) {
    const num = 12 + Math.floor(rng() * 10);
    for (let i = 0; i < num; i++) {
        const angle = rng() * Math.PI * 2 + rot * 0.01;
        const dist = rng() * R * 0.82;
        const ox = cx + Math.cos(angle) * dist;
        const oy = cy + Math.sin(angle) * dist * 0.6;
        const cr = (0.04 + rng() * 0.10) * R;

        // Crater rim
        ctx.beginPath();
        ctx.arc(ox, oy, cr, 0, Math.PI * 2);
        ctx.strokeStyle = colors.highlight ?? '#aaa';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Crater floor
        ctx.beginPath();
        ctx.arc(ox, oy, cr * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = colors.dark ?? '#333';
        ctx.fill();

        // Central peak for large craters
        if (cr > R * 0.1) {
            ctx.beginPath();
            ctx.arc(ox, oy, cr * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = colors.highlight ?? '#aaa';
            ctx.fill();
        }
    }
}

// ─── Asteroid detail ──────────────────────────────────────────────────────────

function drawAsteroidDetail(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colors: Record<string, string>, rng: () => number, rot: number
) {
    // Irregular shape via polygon
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * 0.005);

    const pts = 10;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const r = R * (0.6 + rng() * 0.4);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.7;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const rockGrad = ctx.createRadialGradient(-R * 0.2, -R * 0.2, 0, 0, 0, R);
    rockGrad.addColorStop(0, colors.highlight ?? '#888');
    rockGrad.addColorStop(1, colors.dark ?? '#333');
    ctx.fillStyle = rockGrad;
    ctx.fill();

    // Crack lines
    for (let c = 0; c < 5; c++) {
        ctx.beginPath();
        ctx.moveTo((rng() - 0.5) * R, (rng() - 0.5) * R);
        ctx.lineTo((rng() - 0.5) * R, (rng() - 0.5) * R);
        ctx.strokeStyle = `rgba(0,0,0,0.35)`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

// ─── Dwarf planet / asteroid surface structures ───────────────────────────────

function drawSurfaceStructures(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number,
    colony: Colony, rng: () => number, rot: number, isAsteroid: boolean
) {
    const total = (colony.factories ?? 0) + (colony.mines ?? 0) + (colony.researchLabs ?? 0);
    const count = Math.min(16, Math.max(1, Math.round(total / 3)));
    const sr = isAsteroid ? R * 0.55 : R * 0.88;

    const rng2 = makePrng(strHash(colony.id + 'structs'));
    for (let i = 0; i < count; i++) {
        const angle = rng2() * Math.PI * 2 + rot * 0.008;
        const px = cx + Math.cos(angle) * sr;
        const py = cy + Math.sin(angle) * sr * (isAsteroid ? 0.55 : 0.6);

        // Determine color by type
        const roll = rng2();
        const colSolid = roll < 0.4 ? '#ff9040' : roll < 0.7 ? '#40b0ff' : '#ffdd40';
        const colGlow = roll < 0.4 ? 'rgba(255,144,64,0.8)' : roll < 0.7 ? 'rgba(64,176,255,0.8)' : 'rgba(255,221,64,0.8)';

        const glow = ctx.createRadialGradient(px, py, 0, px, py, 4);
        glow.addColorStop(0, colGlow);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colSolid;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Antenna mast
        ctx.strokeStyle = `rgba(200,210,220,0.5)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 5);
        ctx.stroke();
    }
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function drawLegend(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    type: CelestialType, subtype: CelestialSubtype, colony: Colony | null
) {
    ctx.font = '11px Inter, sans-serif';
    const isGas = subtype === 'GasGiant' || subtype === 'IceGiant';
    const items: { color: string; label: string }[] = isGas
        ? [
            { color: 'rgba(180,240,255,0.9)', label: 'Atmospheric stations' },
            { color: '#ffffff', label: 'Station core' },
        ]
        : subtype === 'Terrestrial' || subtype === 'Ocean'
            ? [
                { color: 'rgba(255,230,120,0.9)', label: 'City clusters' },
                { color: '#68a850', label: 'Landmass' },
            ]
            : [
                { color: '#ff9040', label: 'Industry' },
                { color: '#40b0ff', label: 'Research' },
                { color: '#ffdd40', label: 'Mining rig' },
            ];

    let ly = y;
    for (const item of items) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x + 5, ly, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,190,210,0.85)';
        ctx.fillText(item.label, x + 14, ly + 4);
        ly += 18;
    }
}

// ─── Main React component ─────────────────────────────────────────────────────

interface Props {
    planet: Planet | null;
    colony?: Colony | null;
    compact?: boolean;
}

export default function PlanetVisualizer({ planet, colony, compact }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const rotRef = useRef<number>(0);
    const earthTexRef = useRef<HTMLImageElement | null>(null);

    // Load Earth texture once
    useEffect(() => {
        if (planet?.name === 'Earth' && !earthTexRef.current) {
            const img = new Image();
            img.src = '/earth_texture.png';
            img.onload = () => { earthTexRef.current = img; };
        }
    }, [planet?.name]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const seed = planet ? strHash(planet.id) : 12345;
        const type: CelestialType = planet?.type ?? 'Planet';
        const subtype: CelestialSubtype = planet?.subtype ?? 'Terrestrial';
        const atmo: AtmosphereType = planet?.atmosphere ?? 'None';
        const isEarth = planet?.name === 'Earth';

        const draw = () => {
            const W = canvas.width;
            const H = canvas.height;
            rotRef.current += 0.15;
            const rot = rotRef.current;

            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#070b14';
            ctx.fillRect(0, 0, W, H);

            // Starfield (stable seed, not rotating)
            drawStarfield(ctx, W, H, makePrng(seed + 1));

            const R = compact ? Math.min(H, W) * 0.45 : Math.min(H * 0.42, W * 0.28);
            const cx = compact ? W / 2 : W * 0.62;
            const cy = H / 2;

            // Fresh rng per frame but seeded so terrain shapes are stable
            const rng = makePrng(seed);

            drawPlanetSphere(ctx, cx, cy, R, type, subtype, atmo, rng, rot, colony ?? null,
                isEarth ? earthTexRef.current : null);

            if (!compact) {
                // Labels
                const labelX = 18;
                ctx.font = 'bold 13px "Orbitron", sans-serif';
                ctx.fillStyle = '#8ab4d4';
                ctx.fillText(planet?.name ?? 'Unknown', labelX, 30);

                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = 'rgba(140,160,190,0.8)';
                ctx.fillText(`${subtype} ${type} · ${atmo} Atmosphere`, labelX, 50);

                if (colony) {
                    ctx.fillStyle = 'rgba(120,140,170,0.7)';
                    ctx.fillText(`Population: ${colony.population?.toFixed(1) ?? '?'}M`, labelX, 72);
                    ctx.fillText(`Factories: ${colony.factories ?? 0}  ·  Mines: ${colony.mines ?? 0}`, labelX, 90);
                }

                drawLegend(ctx, labelX, H - 70, type, subtype, colony ?? null);
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [planet, colony]);

    // Resize canvas to match CSS size
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const observer = new ResizeObserver(() => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        });
        observer.observe(canvas);
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        return () => observer.disconnect();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={styles.visualizerCanvas}
        />
    );
}
