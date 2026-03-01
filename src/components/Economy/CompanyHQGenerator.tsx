'use client';
import { useRef, useEffect } from 'react';
import type { Company } from '@/types';

// Simple Linear Congruential Generator for seeded randoms
function makePrng(seed: number) {
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

export default function CompanyHQGenerator({ company, width = 250, height = 200 }: { company: Company; width?: number; height?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use the company ID's fast hash as a seed
        let seed = 0;
        for (let i = 0; i < company.id.length; i++) {
            seed = (seed << 5) - seed + company.id.charCodeAt(i);
            seed = seed & seed;
        }
        const rng = makePrng(Math.abs(seed) || 12345);

        // Fixed parameters based on seed
        const typeStr = company.type;
        const mainColor = typeStr === 'Transport' ? '#3498db' : typeStr === 'Extraction' ? '#e67e22' : '#9b59b6';
        const darkColor = typeStr === 'Transport' ? '#2980b9' : typeStr === 'Extraction' ? '#d35400' : '#8e44ad';
        const accentColor = '#f1c40f'; // Brass/gold

        const buildingWidth = 85 + rng() * 45;
        const buildingHeight = 110 + rng() * 50;
        const startX = (width - buildingWidth) / 2;
        const startY = height - buildingHeight - 10;

        // Static distant skyline
        const backgroundBuildings: { x: number, w: number, h: number, c: string }[] = [];
        for (let i = 0; i < 6; i++) {
            backgroundBuildings.push({
                x: rng() * width,
                w: 20 + rng() * 30,
                h: 40 + rng() * 60,
                c: `rgba(22, 33, 62, ${0.4 + rng() * 0.4})`
            });
        }

        let frame = 0;
        const render = () => {
            frame++;
            ctx.clearRect(0, 0, width, height);

            // 1. Sky Background (Deep Space Gradient)
            const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
            bgGradient.addColorStop(0, '#0f0f1a');
            bgGradient.addColorStop(0.5, '#1a1a2e');
            bgGradient.addColorStop(1, '#16213e');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);

            // 2. Stars (Parallax subtle movement?)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            const starRng = makePrng(Math.abs(seed));
            for (let i = 0; i < 30; i++) {
                const sx = starRng() * width;
                const sy = starRng() * height * 0.8;
                const size = starRng() * 1.2;
                const alpha = 0.3 + Math.abs(Math.sin((frame + i * 10) * 0.02)) * 0.7;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. Haze/Atmospheric Depth
            const hazeGradient = ctx.createRadialGradient(width / 2, height, 0, width / 2, height, height);
            hazeGradient.addColorStop(0, 'rgba(52, 152, 219, 0.1)');
            hazeGradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = hazeGradient;
            ctx.fillRect(0, 0, width, height);

            // 4. Distant Background Buildings
            backgroundBuildings.forEach(b => {
                ctx.fillStyle = b.c;
                ctx.fillRect(b.x - 20, height - b.h, b.w, b.h);
            });

            // 5. Main Building Base & Shadows
            const buildingGradient = ctx.createLinearGradient(startX, startY, startX + buildingWidth, startY);
            buildingGradient.addColorStop(0, darkColor);
            buildingGradient.addColorStop(0.5, mainColor);
            buildingGradient.addColorStop(1, darkColor);

            ctx.fillStyle = buildingGradient;
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillRect(startX, startY, buildingWidth, buildingHeight);
            ctx.shadowBlur = 0;

            // 6. Windows with Volumetric Glow
            const winRng = makePrng(Math.abs(seed) + 50);
            const rows = Math.floor(buildingHeight / 18);
            const cols = Math.floor(buildingWidth / 18);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (winRng() > 0.4) {
                        const wx = startX + 8 + c * 18;
                        const wy = startY + 12 + r * 18;
                        const pulsate = 0.5 + Math.abs(Math.sin((frame + r * 5 + c * 5) * 0.05)) * 0.5;

                        // Window glow
                        ctx.fillStyle = `rgba(241, 196, 15, ${0.3 * pulsate})`;
                        ctx.fillRect(wx - 2, wy - 2, 10, 10);

                        ctx.fillStyle = `rgba(241, 196, 15, ${0.8 * pulsate})`;
                        ctx.fillRect(wx, wy, 6, 6);
                    }
                }
            }

            // 7. Role-Specific Details (Animated)
            ctx.fillStyle = accentColor;
            if (typeStr === 'Extraction') {
                // Silos and animated sparks/steam
                ctx.fillStyle = '#34495e';
                ctx.fillRect(startX - 15, startY + 30, 15, buildingHeight - 40);

                // Pulsing lights on silos
                const siloPulse = Math.abs(Math.sin(frame * 0.1));
                ctx.fillStyle = `rgba(231, 76, 60, ${siloPulse})`;
                ctx.beginPath();
                ctx.arc(startX - 7.5, startY + 45, 3, 0, Math.PI * 2);
                ctx.fill();

                // Steam/Gas puffs
                if (frame % 60 < 30) {
                    ctx.fillStyle = 'rgba(236, 240, 241, 0.2)';
                    ctx.beginPath();
                    ctx.arc(startX + 30, startY - 20 - (frame % 60) * 0.5, 10 + (frame % 60) * 0.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (typeStr === 'Transport') {
                // Rotating radar dish
                const angle = frame * 0.05;
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(startX + buildingWidth * 0.7, startY);
                ctx.lineTo(startX + buildingWidth * 0.7, startY - 30);
                ctx.stroke();

                ctx.save();
                ctx.translate(startX + buildingWidth * 0.7, startY - 30);
                ctx.rotate(Math.sin(angle) * 0.5);
                ctx.beginPath();
                ctx.arc(0, 0, 15, Math.PI, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                // Flight beacons
                if (frame % 40 < 20) {
                    ctx.fillStyle = '#e74c3c';
                    ctx.beginPath();
                    ctx.arc(startX + 5, startY, 3, 0, Math.PI * 2);
                    ctx.arc(startX + buildingWidth - 5, startY, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (typeStr === 'Manufacturing') {
                // Moving assembly crane arm silhouette
                const armMove = Math.sin(frame * 0.03) * 20;
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(startX + 20, startY);
                ctx.lineTo(startX + 20, startY - 40);
                ctx.lineTo(startX + 20 + 30 + armMove, startY - 40 + 10);
                ctx.stroke();
            }

            // 8. Ground & Platform
            const groundGrad = ctx.createLinearGradient(0, height - 20, 0, height);
            groundGrad.addColorStop(0, '#2c3e50');
            groundGrad.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, height - 20, width, 20);

            // 9. Company Holographic Sign
            ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
            ctx.fillRect(startX + 15, startY + 15, buildingWidth - 30, 25);

            const holoFlicker = Math.random() > 0.98 ? 0.3 : 1;
            ctx.fillStyle = `rgba(52, 152, 219, ${0.8 * holoFlicker})`;
            ctx.font = "bold 11px 'Outfit', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let shortName = company.name.toUpperCase();
            if (shortName.length > 15) shortName = shortName.substring(0, 13) + '...';
            ctx.fillText(shortName, startX + buildingWidth / 2, startY + 28);

            // Scanning lines on holographic sign
            ctx.strokeStyle = `rgba(52, 152, 219, ${0.1 * holoFlicker})`;
            ctx.lineWidth = 1;
            const scanY = (frame % 25) + startY + 15;
            ctx.beginPath();
            ctx.moveTo(startX + 15, scanY);
            ctx.lineTo(startX + buildingWidth - 15, scanY);
            ctx.stroke();

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [company.id, company.name, company.type, width, height]);

    return (
        <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ display: 'block' }}
            />
            {/* Glossy Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.05) 100%)',
                pointerEvents: 'none'
            }} />
        </div>
    );
}
