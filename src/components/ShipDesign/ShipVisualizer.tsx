'use client';
import { useEffect, useRef } from 'react';
import type { ShipDesign } from '@/types';

// Simple PRNG
function splitmix32(a: number) {
    return function () {
        a |= 0; a = a + 0x9e3779b9 | 0;
        let t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    }
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

interface Props {
    design: Partial<ShipDesign>;
    width?: number;
    height?: number;
}

interface Particle {
    x: number;
    y: number;
    life: number;
    maxLife: number;
    size: number;
    vx: number;
    vy: number;
}

export default function ShipVisualizer({ design, width = 200, height = 120 }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        if (!design.hullClass) {
            ctx.clearRect(0, 0, width, height);
            return;
        }

        const seed = hashCode(design.name || 'default');
        const rng = splitmix32(seed);
        const random = (min: number, max: number) => min + rng() * (max - min);

        // Pre-generate starfield
        const stars = Array.from({ length: 60 }).map(() => ({
            x: random(0, width),
            y: random(0, height),
            s: random(0.5, 1.8),
            speed: random(0.05, 0.4)
        }));

        const hullType = design.hullClass;
        const isDirigible = ['Freighter', 'ColonyShip', 'Carrier'].includes(hullType);

        let hullLength = 40;
        let hullWidth = 15;
        if (isDirigible) {
            hullLength = random(70, 90);
            hullWidth = random(25, 35);
        } else if (['Battleship', 'Dreadnought', 'Battlecruiser', 'Cruiser'].includes(hullType)) {
            hullLength = hullType === 'Dreadnought' || hullType === 'Battleship' ? random(80, 100) : random(60, 80);
            hullWidth = random(15, 25);
        } else {
            hullLength = random(30, 50);
            hullWidth = random(8, 15);
        }

        const baseHue = rng() > 0.5 ? random(15, 35) : random(200, 220);
        const trimHue = random(30, 50);
        const windowColor = `hsl(${random(180, 220)}, 90%, 70%)`;

        const comps = design.components || [];
        const engines = comps.filter(comp => comp.type === 'Engine');
        const weapons = comps.filter(comp => comp.type === 'Weapon');
        const sensors = comps.filter(comp => comp.type === 'Sensor');

        const particles: Particle[] = [];
        let animationFrameId: number;
        let time = 0;

        const render = () => {
            time += 1;
            ctx.clearRect(0, 0, width, height);

            // 1. Draw Space Background (Nebula + Stars)
            const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
            bgGrad.addColorStop(0, '#0a0a1a');
            bgGrad.addColorStop(1, '#020205');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // Move & Draw Stars
            ctx.fillStyle = '#fff';
            stars.forEach(star => {
                star.x -= star.speed;
                if (star.x < 0) star.x = width;
                ctx.globalAlpha = 0.3 + Math.sin(time * 0.05 + star.x) * 0.4;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.s, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            const cx = width / 2;
            const cy = height / 2;

            ctx.save();
            ctx.translate(cx, cy);

            // Adding hover effect up and down
            const hoverY = Math.sin(time * 0.03) * 3;
            ctx.translate(0, hoverY);

            // 2. Manage Particles (Smoke/Aether)
            if (time % 4 === 0) {
                engines.forEach((_, i) => {
                    const stackX = -hullLength + (i * 10) + 10;
                    if (!isDirigible) {
                        particles.push({
                            x: stackX + 3,
                            y: -hullWidth - 10,
                            life: 0,
                            maxLife: 60 + Math.random() * 20,
                            size: 2 + Math.random() * 3,
                            vx: -1.5 - Math.random(),
                            vy: -0.2 - Math.random() * 0.5
                        });
                    } else {
                        // Dirigible aether trail
                        particles.push({
                            x: -hullLength,
                            y: 0,
                            life: 0,
                            maxLife: 40 + Math.random() * 20,
                            size: 3 + Math.random() * 5,
                            vx: -2 - Math.random() * 1.5,
                            vy: (Math.random() - 0.5) * 0.5
                        });
                    }
                });
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.size += 0.15;
                p.life++;
                if (p.life >= p.maxLife) {
                    particles.splice(i, 1);
                } else {
                    const alpha = Math.max(0, 1 - (p.life / p.maxLife));
                    if (isDirigible) {
                        // Aether glow
                        ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.4})`;
                    } else {
                        // Smoke
                        ctx.fillStyle = `rgba(80, 80, 80, ${alpha * 0.5})`;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 3. Draw Hull with Gradients
            const hullGrad = ctx.createLinearGradient(0, -hullWidth, 0, hullWidth);
            hullGrad.addColorStop(0, `hsl(${baseHue}, 30%, 65%)`); // Highlight
            hullGrad.addColorStop(0.3, `hsl(${baseHue}, 30%, 45%)`); // Mid
            hullGrad.addColorStop(0.8, `hsl(${baseHue}, 30%, 25%)`); // Shadow
            hullGrad.addColorStop(1, `hsl(${baseHue}, 30%, 15%)`); // Deep shadow

            const trimGrad = ctx.createLinearGradient(0, -hullWidth, 0, hullWidth);
            trimGrad.addColorStop(0, `hsl(${trimHue}, 80%, 75%)`);
            trimGrad.addColorStop(1, `hsl(${trimHue}, 80%, 35%)`);

            ctx.fillStyle = hullGrad;
            ctx.strokeStyle = trimGrad;
            ctx.lineWidth = 2;

            ctx.beginPath();
            if (isDirigible) {
                ctx.ellipse(0, -10, hullLength, hullWidth, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Gondola
                ctx.beginPath();
                ctx.rect(-hullLength * 0.4, hullWidth - 15, hullLength * 0.8, 15);
                ctx.fillStyle = `hsl(${baseHue}, 20%, 25%)`;
                ctx.fill();
                ctx.stroke();

                // Panel lines & Rivets logic
                ctx.strokeStyle = `rgba(0,0,0,0.3)`;
                ctx.lineWidth = 1;
                for (let j = -2; j <= 2; j += 1) {
                    ctx.beginPath();
                    ctx.ellipse(0, -10, hullLength, Math.max(1, Math.abs(j * hullWidth / 3)), 0, 0, Math.PI);
                    ctx.stroke();
                }
            } else if (['Battleship', 'Dreadnought', 'Battlecruiser', 'Cruiser'].includes(hullType)) {
                ctx.moveTo(-hullLength, 0);
                ctx.lineTo(-hullLength * 0.8, -hullWidth);
                ctx.lineTo(hullLength * 0.6, -hullWidth * 0.8);
                ctx.lineTo(hullLength, 0);
                ctx.lineTo(hullLength * 0.6, hullWidth * 0.8);
                ctx.lineTo(-hullLength * 0.8, hullWidth);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Panel line through middle
                ctx.strokeStyle = `rgba(0,0,0,0.5)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-hullLength * 0.8, 0);
                ctx.lineTo(hullLength * 0.6, 0);
                ctx.stroke();
            } else {
                ctx.moveTo(-hullLength, -hullWidth * 0.5);
                ctx.lineTo(hullLength, 0);
                ctx.lineTo(-hullLength, hullWidth * 0.5);
                ctx.lineTo(-hullLength * 0.7, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            // Draw Rivets along the edge/center
            ctx.fillStyle = `rgba(0,0,0,0.6)`;
            for (let r = 0; r < 10; r++) {
                if (!isDirigible) {
                    ctx.beginPath();
                    ctx.arc(-hullLength * 0.5 + (r * hullLength * 0.1), 0, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 4. Components

            // Engines
            ctx.fillStyle = '#222';
            engines.forEach((_, i) => {
                const stackX = -hullLength + (i * 10) + 10;
                if (isDirigible) {
                    // Propellers
                    ctx.save();
                    ctx.translate(-hullLength * 0.4 - 5, hullWidth - 5 + (i * 5));
                    ctx.rotate(time * 0.3); // Rotating paddle/propeller
                    ctx.fillStyle = trimGrad;
                    ctx.fillRect(-6, -1, 12, 2);
                    ctx.fillRect(-1, -6, 2, 12);
                    ctx.restore();
                } else {
                    // Smokestacks
                    ctx.fillRect(stackX, -hullWidth - 10, 6, 12);
                    // Glowing furnace interior
                    ctx.fillStyle = `rgba(255, 120, 0, ${0.4 + Math.sin(time * 0.15 + i) * 0.4})`;
                    ctx.fillRect(stackX + 1, -hullWidth - 10, 4, 3);
                    ctx.fillStyle = '#222'; // reset
                }
            });

            // Weapons
            ctx.fillStyle = trimGrad;
            weapons.forEach((_, i) => {
                if (isDirigible) return;
                const wX = -hullLength * 0.5 + (i * 15) % (hullLength * 1.2);
                const wY = (i % 2 === 0) ? -hullWidth * 0.6 : hullWidth * 0.6;
                // Tracking turret
                ctx.save();
                ctx.translate(wX, wY);
                ctx.rotate(Math.sin(time * 0.02 + i) * 0.4); // Slowly sweep
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(8, -2);
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            });

            // Sensors
            sensors.forEach(() => {
                ctx.save();
                const sX = isDirigible ? 0 : hullLength * 0.2;
                const sY = isDirigible ? -hullWidth - 5 : 0;
                ctx.translate(sX, sY);
                // Radar sweep
                ctx.rotate(time * 0.05);
                ctx.beginPath();
                ctx.arc(0, 0, 6, Math.PI, 0);
                ctx.strokeStyle = trimGrad;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -10);
                ctx.stroke();
                // Blinking sensor light
                ctx.fillStyle = (time % 40 < 20) ? '#ff3333' : '#550000';
                ctx.beginPath();
                ctx.arc(0, -10, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Windows / Bridge (Blinking)
            const bridgeX = isDirigible ? -hullLength * 0.2 : hullLength * 0.3;
            const bridgeY = isDirigible ? hullWidth - 10 : -hullWidth * 0.3;
            for (let i = 0; i < 3; i++) {
                const isBlinking = (i === 1) && (time % 80 < 40);
                ctx.fillStyle = isBlinking ? '#fff' : windowColor;

                // Add window glow
                ctx.shadowColor = windowColor;
                ctx.shadowBlur = isBlinking ? 8 : 4;
                ctx.fillRect(bridgeX + (i * 4), bridgeY, 2, 4);
                ctx.shadowBlur = 0; // reset
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [design, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ borderRadius: '4px', background: '#020205' }}
        />
    );
}
