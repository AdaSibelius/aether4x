'use client';
import { useRef, useEffect } from 'react';
import type { OfficerRole } from '@/types';

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function makePrng(seed: number) {
    let s = Math.abs(seed) | 1;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function hsl(h: number, s: number, l: number) { return `hsl(${h},${s}%,${l}%)`; }
function hsla(h: number, s: number, l: number, a: number) { return `hsla(${h},${s}%,${l}%,${a})`; }

// ─── Role uniform colors ────────────────────────────────────────────────────

const UNIFORM_COLORS: Record<OfficerRole, { base: string; accent: string; epauletteColor: string }> = {
    Admiral: { base: hsl(220, 35, 22), accent: hsl(45, 80, 55), epauletteColor: hsl(45, 90, 60) },
    Captain: { base: hsl(220, 30, 25), accent: hsl(0, 0, 75), epauletteColor: hsl(0, 0, 80) },
    Scientist: { base: hsl(160, 30, 22), accent: hsl(140, 60, 50), epauletteColor: hsl(140, 70, 55) },
    Engineer: { base: hsl(25, 40, 25), accent: hsl(30, 70, 55), epauletteColor: hsl(30, 80, 60) },
    Governor: { base: hsl(230, 35, 26), accent: hsl(210, 70, 55), epauletteColor: hsl(210, 80, 60) },
    CEO: { base: hsl(0, 0, 15), accent: hsl(0, 0, 40), epauletteColor: hsl(45, 60, 40) },
};

// ─── Skin tone palettes ──────────────────────────────────────────────────────

const SKIN_PALETTES = [
    { h: 28, s: 50, l: 72 },   // fair
    { h: 30, s: 45, l: 65 },   // light
    { h: 25, s: 55, l: 55 },   // medium
    { h: 22, s: 50, l: 45 },   // olive
    { h: 20, s: 45, l: 38 },   // tan
    { h: 18, s: 40, l: 30 },   // dark
    { h: 15, s: 35, l: 24 },   // deep
];

// ─── Hair colors ─────────────────────────────────────────────────────────────

const HAIR_COLORS = [
    hsl(30, 20, 15),   // black
    hsl(25, 40, 28),   // dark brown
    hsl(30, 50, 38),   // brown
    hsl(35, 60, 48),   // chestnut
    hsl(40, 70, 55),   // auburn
    hsl(45, 80, 65),   // blonde
    hsl(15, 70, 40),   // red
    hsl(0, 0, 60),     // grey
    hsl(0, 0, 75),     // silver
];

// ─── Eye colors ──────────────────────────────────────────────────────────────

const EYE_COLORS = [
    hsl(25, 60, 30),   // brown
    hsl(210, 50, 45),  // blue
    hsl(120, 40, 35),  // green
    hsl(90, 30, 40),   // hazel
    hsl(0, 0, 30),     // dark
    hsl(200, 60, 50),  // light blue
    hsl(30, 70, 40),   // amber
];

// ─── Drawing functions ───────────────────────────────────────────────────────

function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, role: OfficerRole) {
    const rng = makePrng(seed);
    const cx = w / 2;

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, hsl(220, 25, 12));
    bgGrad.addColorStop(1, hsl(220, 20, 8));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle vignette
    const vigGrad = ctx.createRadialGradient(cx, h * 0.4, w * 0.2, cx, h * 0.4, w * 0.8);
    vigGrad.addColorStop(0, 'transparent');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Uniform / Shoulders ──
    const uniform = UNIFORM_COLORS[role];
    const shoulderY = h * 0.72;

    // Shoulders - broad trapezoid
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.48, h);
    ctx.lineTo(cx - w * 0.35, shoulderY);
    ctx.lineTo(cx + w * 0.35, shoulderY);
    ctx.lineTo(cx + w * 0.48, h);
    ctx.closePath();
    ctx.fillStyle = uniform.base;
    ctx.fill();

    // Collar
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.12, shoulderY + 2);
    ctx.lineTo(cx, shoulderY - h * 0.04);
    ctx.lineTo(cx + w * 0.12, shoulderY + 2);
    ctx.closePath();
    ctx.fillStyle = uniform.accent;
    ctx.fill();

    // Epaulettes
    for (const side of [-1, 1]) {
        const ex = cx + side * w * 0.28;
        const ey = shoulderY + h * 0.02;
        ctx.fillStyle = uniform.epauletteColor;
        ctx.fillRect(ex - w * 0.04, ey, w * 0.08, h * 0.025);
        // Fringe
        ctx.fillStyle = uniform.accent;
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(ex - w * 0.03 + i * w * 0.025, ey + h * 0.025, w * 0.012, h * 0.015);
        }
    }

    // ── Neck ──
    const skin = SKIN_PALETTES[Math.floor(rng() * SKIN_PALETTES.length)];
    const skinColor = hsl(skin.h, skin.s, skin.l);
    const skinShadow = hsl(skin.h, skin.s, skin.l - 10);

    ctx.fillStyle = skinShadow;
    ctx.fillRect(cx - w * 0.07, shoulderY - h * 0.08, w * 0.14, h * 0.1);

    // ── Head (oval) ──
    const headW = w * (0.22 + rng() * 0.06);
    const headH = h * (0.28 + rng() * 0.06);
    const headCy = shoulderY - headH * 0.65;

    ctx.beginPath();
    ctx.ellipse(cx, headCy, headW, headH, 0, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();

    // Jaw variation
    const jawW = headW * (0.85 + rng() * 0.15);
    ctx.beginPath();
    ctx.ellipse(cx, headCy + headH * 0.3, jawW, headH * 0.6, 0, 0, Math.PI);
    ctx.fillStyle = skinColor;
    ctx.fill();

    // ── Eyes ──
    const eyeColor = EYE_COLORS[Math.floor(rng() * EYE_COLORS.length)];
    const eyeY = headCy - headH * 0.05;
    const eyeSpread = headW * (0.35 + rng() * 0.15);
    const eyeW = headW * 0.18;
    const eyeH = headH * 0.08;

    for (const side of [-1, 1]) {
        const ex = cx + side * eyeSpread;

        // Eye white
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fillStyle = hsl(0, 0, 90);
        ctx.fill();

        // Iris
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeH * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = eyeColor;
        ctx.fill();

        // Pupil
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeH * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = hsl(0, 0, 5);
        ctx.fill();

        // Eye highlight
        ctx.beginPath();
        ctx.arc(ex + eyeH * 0.2, eyeY - eyeH * 0.2, eyeH * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();

        // Eyebrow
        ctx.strokeStyle = hsl(skin.h, skin.s - 15, skin.l - 25);
        ctx.lineWidth = headH * 0.035;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - eyeW * 1.1, eyeY - eyeH * 2.0);
        ctx.quadraticCurveTo(ex, eyeY - eyeH * 2.8, ex + eyeW * 1.1, eyeY - eyeH * 1.8);
        ctx.stroke();
    }

    // ── Nose ──
    const noseY = eyeY + headH * 0.22;
    ctx.strokeStyle = hsl(skin.h, skin.s, skin.l - 12);
    ctx.lineWidth = headW * 0.04;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, eyeY + headH * 0.06);
    ctx.lineTo(cx + headW * 0.04, noseY);
    ctx.lineTo(cx - headW * 0.06, noseY + headH * 0.02);
    ctx.stroke();

    // ── Mouth ──
    const mouthY = noseY + headH * 0.14;
    const mouthW = headW * (0.25 + rng() * 0.1);
    ctx.strokeStyle = hsl(0, 30, 45);
    ctx.lineWidth = headH * 0.025;
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + headH * 0.04, cx + mouthW, mouthY);
    ctx.stroke();

    // ── Hair ──
    const hairColor = HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)];
    const hairStyle = Math.floor(rng() * 6); // 0=bald, 1=short, 2=medium, 3=parted, 4=swept, 5=long

    if (hairStyle > 0) {
        ctx.fillStyle = hairColor;

        // Top of head hair
        ctx.beginPath();
        const hairTop = headCy - headH * 1.0;
        const hairSideL = cx - headW * (hairStyle >= 4 ? 1.05 : 0.95);
        const hairSideR = cx + headW * (hairStyle >= 4 ? 1.05 : 0.95);

        ctx.moveTo(hairSideL, headCy - headH * 0.15);
        ctx.quadraticCurveTo(hairSideL, hairTop, cx, hairTop - headH * 0.08);
        ctx.quadraticCurveTo(hairSideR, hairTop, hairSideR, headCy - headH * 0.15);

        // Hair sides - varies by style
        if (hairStyle >= 3) {
            // Longer sides
            ctx.lineTo(hairSideR, headCy + headH * 0.1);
            ctx.quadraticCurveTo(cx + headW * 0.8, headCy + headH * 0.2, cx + headW * 0.5, headCy + headH * 0.05);
        }

        ctx.lineTo(cx, headCy - headH * 0.35);

        if (hairStyle >= 3) {
            ctx.lineTo(cx - headW * 0.5, headCy + headH * 0.05);
            ctx.quadraticCurveTo(cx - headW * 0.8, headCy + headH * 0.2, hairSideL, headCy + headH * 0.1);
        }

        ctx.closePath();
        ctx.fill();
    }

    // ── Facial Hair ──
    const hasFacialHair = rng() > 0.45;
    if (hasFacialHair) {
        ctx.fillStyle = hairColor;
        const facialType = Math.floor(rng() * 4); // 0=mustache, 1=goatee, 2=sideburns, 3=full beard

        // Mustache (all facial hair types include it)
        ctx.beginPath();
        ctx.moveTo(cx - headW * 0.2, noseY + headH * 0.04);
        ctx.quadraticCurveTo(cx, noseY + headH * 0.1, cx + headW * 0.2, noseY + headH * 0.04);
        ctx.quadraticCurveTo(cx, noseY + headH * 0.02, cx - headW * 0.2, noseY + headH * 0.04);
        ctx.fill();

        if (facialType >= 1) {
            // Goatee
            ctx.beginPath();
            ctx.moveTo(cx - headW * 0.1, mouthY + headH * 0.04);
            ctx.quadraticCurveTo(cx, mouthY + headH * 0.18, cx + headW * 0.1, mouthY + headH * 0.04);
            ctx.fill();
        }

        if (facialType >= 2) {
            // Sideburns
            for (const side of [-1, 1]) {
                ctx.fillRect(cx + side * headW * 0.85, eyeY, headW * 0.1, headH * 0.5);
            }
        }
    }

    // ── Steampunk Accessory ──
    const accessory = rng();
    if (accessory < 0.25) {
        // Monocle on right eye
        ctx.strokeStyle = hsl(45, 70, 55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + eyeSpread, eyeY, eyeW * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        // Chain
        ctx.beginPath();
        ctx.moveTo(cx + eyeSpread + eyeW * 1.5, eyeY);
        ctx.quadraticCurveTo(cx + eyeSpread + w * 0.15, eyeY + h * 0.15, cx + w * 0.2, shoulderY);
        ctx.strokeStyle = hsla(45, 70, 55, 0.5);
        ctx.lineWidth = 0.8;
        ctx.stroke();
    } else if (accessory < 0.42) {
        // Medals on chest
        const medalColors = [hsl(45, 80, 55), hsl(0, 60, 45), hsl(210, 70, 50)];
        for (let i = 0; i < 3; i++) {
            const mx = cx - w * 0.1 + i * w * 0.08;
            const my = shoulderY + h * 0.06;
            ctx.fillStyle = medalColors[i];
            ctx.beginPath();
            ctx.arc(mx, my, w * 0.02, 0, Math.PI * 2);
            ctx.fill();
            // Ribbon
            ctx.fillStyle = medalColors[i];
            ctx.fillRect(mx - w * 0.01, my - h * 0.03, w * 0.02, h * 0.03);
        }
    } else if (accessory < 0.55) {
        // Goggles on forehead
        const goggleY = headCy - headH * 0.55;
        ctx.fillStyle = hsl(30, 40, 30);
        ctx.fillRect(cx - headW * 0.6, goggleY - headH * 0.06, headW * 1.2, headH * 0.12);
        for (const side of [-1, 1]) {
            ctx.strokeStyle = hsl(30, 50, 45);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + side * headW * 0.3, goggleY, headW * 0.18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = hsla(180, 40, 50, 0.3);
            ctx.fill();
        }
    }

    // ── Subtle lighting overlay ──
    const lightGrad = ctx.createLinearGradient(0, 0, w, h);
    lightGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    lightGrad.addColorStop(0.5, 'transparent');
    lightGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PortraitProps {
    seed: number;
    role: OfficerRole;
    size?: number;
}

export default function PortraitGenerator({ seed, role, size = 64 }: PortraitProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const res = size * 2; // 2× for retina

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, res, res);
        drawPortrait(ctx, res, res, seed, role);
    }, [seed, role, res]);

    return (
        <canvas
            ref={canvasRef}
            width={res}
            height={res}
            style={{
                width: size,
                height: size,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        />
    );
}
