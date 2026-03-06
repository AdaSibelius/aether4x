'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { Star } from '@/types';
import styles from './GalaxyMap.module.css';

const SPECTRAL_COLORS: Record<string, string> = {
    O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#fbf8ff',
    G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
    WhiteDwarf: '#e8e8ff', Neutron: '#ffffff', BlackHole: '#4a4a6a',
};

const SPECTRAL_SIZES: Record<string, number> = {
    O: 7, B: 6, A: 5, F: 5, G: 5, K: 4, M: 3,
    WhiteDwarf: 3, Neutron: 2, BlackHole: 4,
};

export default function GalaxyMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    const game = useGameStore(s => s.game);
    const { selectedStarId, galaxyMapCamera, updateGalaxyCamera, selectStar, setView, showTradeOverlay, toggleTradeOverlay } = useUIStore();

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !game) return;
        const ctx = canvas.getContext('2d')!;
        const { width: W, height: H } = canvas;
        const { x: camX, y: camY, zoom } = galaxyMapCamera;

        ctx.clearRect(0, 0, W, H);

        const now = performance.now() * 0.001;

        // Background
        ctx.fillStyle = '#050810';
        ctx.fillRect(0, 0, W, H);

        // Subtle star background
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        const bgSeed = 42;
        for (let i = 0; i < 200; i++) {
            const bx = ((bgSeed * (i * 7 + 3)) % W + W) % W;
            const by = ((bgSeed * (i * 13 + 7)) % H + H) % H;
            ctx.fillRect(bx, by, 1, 1);
        }

        const { stars } = game.galaxy;
        const galW = game.galaxy.width;
        const galH = game.galaxy.height;

        // Transform: galaxy coords → canvas coords
        const toCanvas = (gx: number, gy: number) => ({
            cx: W / 2 + (gx - galW / 2 + camX) * zoom,
            cy: H / 2 + (gy - galH / 2 + camY) * zoom,
        });

        // Draw jump lanes
        const drawn = new Set<string>();
        for (const star of Object.values(stars)) {
            for (const jp of star.jumpPoints) {
                if (!jp.discovered) continue;
                const key = [star.id, jp.targetStarId].sort().join('_');
                if (drawn.has(key)) continue;
                drawn.add(key);
                const target = stars[jp.targetStarId];
                if (!target) continue;
                const from = toCanvas(star.position.x, star.position.y);
                const to = toCanvas(target.position.x, target.position.y);
                ctx.beginPath();
                ctx.moveTo(from.cx, from.cy);
                ctx.lineTo(to.cx, to.cy);
                ctx.strokeStyle = 'rgba(79,195,247,0.12)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Border Tension overlay
                const claim1 = star.claimedByEmpireId;
                const claim2 = target.claimedByEmpireId;
                if (claim1 && claim2 && claim1 !== claim2) {
                    const emp1 = game.empires[claim1];
                    const tension = emp1?.relations?.[claim2]?.tension || 0;
                    if (tension > 10 && zoom > 0.5) {
                        const mx = (from.cx + to.cx) / 2;
                        const my = (from.cy + to.cy) / 2;

                        // Draw small tension meter
                        const w = 24 * zoom;
                        const h = 4 * zoom;
                        ctx.fillStyle = 'rgba(0,0,0,0.8)';
                        ctx.fillRect(mx - w / 2, my - h / 2, w, h);
                        ctx.fillStyle = tension > 75 ? '#ff3333' : tension > 40 ? '#ffaa33' : '#33cc33';
                        ctx.fillRect(mx - w / 2, my - h / 2, w * (Math.min(100, tension) / 100), h);
                        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                        ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
                    }
                }
            }
        }

        // Draw inter-system trade routes
        if (showTradeOverlay) {
            const empire = game.empires[game.playerEmpireId];
            if (empire.tradeRoutes) {
                const routesDrawn = new Set<string>();
                for (const route of empire.tradeRoutes) {
                    const sourceColony = game.colonies[route.sourceColonyId];
                    const targetColony = game.colonies[route.targetColonyId];
                    if (!sourceColony || !targetColony) continue;

                    const sourceStar = Object.values(stars).find(s => s.planets.some(p => p.id === sourceColony.planetId));
                    const targetStar = Object.values(stars).find(s => s.planets.some(p => p.id === targetColony.planetId));

                    if (sourceStar && targetStar && sourceStar.id !== targetStar.id) {
                        const key = `${sourceStar.id}_${targetStar.id}`;
                        if (routesDrawn.has(key)) continue;
                        routesDrawn.add(key);

                        const from = toCanvas(sourceStar.position.x, sourceStar.position.y);
                        const to = toCanvas(targetStar.position.x, targetStar.position.y);

                        ctx.beginPath();
                        ctx.moveTo(from.cx, from.cy);
                        ctx.lineTo(to.cx, to.cy);
                        ctx.strokeStyle = 'rgba(105, 240, 174, 0.4)';
                        ctx.lineWidth = 1.5;

                        const dashOffset = -(now * 20); // Flow direction
                        ctx.setLineDash([6, 8]);
                        ctx.lineDashOffset = dashOffset;
                        ctx.stroke();

                        ctx.setLineDash([]);
                        ctx.lineDashOffset = 0;

                        // Arrowhead
                        const mx = (from.cx + to.cx) / 2;
                        const my = (from.cy + to.cy) / 2;
                        const angle = Math.atan2(to.cy - from.cy, to.cx - from.cx);
                        ctx.beginPath();
                        ctx.moveTo(mx + Math.cos(angle) * 6, my + Math.sin(angle) * 6);
                        ctx.lineTo(mx + Math.cos(angle + 2.6) * 5, my + Math.sin(angle + 2.6) * 5);
                        ctx.lineTo(mx + Math.cos(angle - 2.6) * 5, my + Math.sin(angle - 2.6) * 5);
                        ctx.fillStyle = '#69f0ae';
                        ctx.fill();
                    }
                }
            }
        }

        // Draw stars
        for (const star of Object.values(stars)) {
            const { cx, cy } = toCanvas(star.position.x, star.position.y);
            if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) continue;

            const color = SPECTRAL_COLORS[star.spectralType] ?? '#ffffff';
            const radius = (SPECTRAL_SIZES[star.spectralType] ?? 4) * Math.max(0.5, zoom * 0.8);
            const isSelected = star.id === selectedStarId;
            const isExplored = star.explored;

            // Territory Claims
            const controllerId = star.claimedByEmpireId;
            if (controllerId && game.empires[controllerId]) {
                const emp = game.empires[controllerId];
                const tr = radius * 4.5;
                ctx.beginPath();
                ctx.arc(cx, cy, tr, 0, Math.PI * 2);
                ctx.fillStyle = `${emp.color}15`; // ~8% opacity hex string concatenation
                ctx.fill();
                ctx.strokeStyle = `${emp.color}66`; // ~40% opacity
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Glow effect
            if (isExplored || isSelected) {
                // Convert #rrggbb → rgba(r,g,b,a) properly
                const hex = color.startsWith('#') ? color : '#aaaaaa';
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const glowColor = isSelected ? `rgba(79,195,247,0.4)` : `rgba(${r},${g},${b},0.3)`;
                const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3.5);
                grd.addColorStop(0, glowColor);
                grd.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 3.5, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }

            // Star body
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = isExplored ? color : '#3a4a5a';
            ctx.fill();

            // Selected ring
            if (isSelected) {
                ctx.beginPath();
                ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = '#4fc3f7';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Colony dot indicator
            const hasPlayerColony = star.planets.some(p => p.colonies.some(c => c.empireId === game.playerEmpireId));
            if (hasPlayerColony) {
                ctx.beginPath();
                ctx.arc(cx + radius + 2, cy - radius - 2, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#69f0ae';
                ctx.fill();
            }

            // Star name label
            if (zoom > 0.7 && isExplored) {
                ctx.font = `${Math.max(9, 10 * zoom)}px Inter`;
                ctx.fillStyle = isSelected ? '#4fc3f7' : 'rgba(140,170,200,0.7)';
                ctx.textAlign = 'center';
                ctx.fillText(star.name, cx, cy + radius * 1.8 + 8);
            }
        }
    }, [game, selectedStarId, galaxyMapCamera]);

    // Animation loop
    useEffect(() => {
        const loop = () => { draw(); animFrameRef.current = requestAnimationFrame(loop); };
        animFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [draw]);

    // Resize canvas to fill container
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const w = Math.floor(rect.width);
            const h = Math.floor(rect.height);
            if (w > 0 && h > 0) {
                canvas.width = w;
                canvas.height = h;
            }
        };
        // Force immediate resize
        requestAnimationFrame(resize);
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas.parentElement ?? canvas);
        return () => observer.disconnect();
    }, []);

    // Mouse / wheel handlers
    const getStarAt = useCallback((px: number, py: number): Star | null => {
        if (!game) return null;
        const canvas = canvasRef.current!;
        const { x: camX, y: camY, zoom } = galaxyMapCamera;
        const { width: W, height: H } = canvas;
        const galW = game.galaxy.width, galH = game.galaxy.height;
        for (const star of Object.values(game.galaxy.stars)) {
            const cx = W / 2 + (star.position.x - galW / 2 + camX) * zoom;
            const cy = H / 2 + (star.position.y - galH / 2 + camY) * zoom;
            const r = (SPECTRAL_SIZES[star.spectralType] ?? 4) * Math.max(0.5, zoom * 0.8) + 8;
            if (Math.hypot(px - cx, py - cy) < r) return star;
        }
        return null;
    }, [game, galaxyMapCamera]);

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = false;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (e.buttons !== 1) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) isDragging.current = true;
        updateGalaxyCamera({ x: galaxyMapCamera.x + dx / galaxyMapCamera.zoom, y: galaxyMapCamera.y + dy / galaxyMapCamera.zoom });
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (e: React.MouseEvent) => {
        if (!isDragging.current) {
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const star = getStarAt(e.clientX - rect.left, e.clientY - rect.top);
            if (star) {
                selectStar(star.id);
                if (star.explored) setView('System');
            } else {
                selectStar(null);
            }
        }
        isDragging.current = false;
    };

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.18;
        const newZoom = Math.min(4, Math.max(0.2, galaxyMapCamera.zoom * delta));
        updateGalaxyCamera({ zoom: newZoom });
    };

    return (
        <div className={styles.container}>
            <div className={styles.title}>GALAXY MAP</div>
            <label style={{ position: 'absolute', top: 12, right: 16, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: showTradeOverlay ? '#69f0ae' : 'var(--text-muted)', zIndex: 10, background: 'rgba(5,8,16,0.8)', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                <input type="checkbox" checked={showTradeOverlay} onChange={toggleTradeOverlay} style={{ width: 12, height: 12, accentColor: '#69f0ae' }} />
                Trade Routes
            </label>
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onWheel={onWheel}
                style={{ cursor: isDragging.current ? 'grabbing' : 'crosshair' }}
            />
            <div className={styles.controls}>
                <button className="btn btn-secondary btn-sm" onClick={() => updateGalaxyCamera({ zoom: galaxyMapCamera.zoom * 1.3 })}>+</button>
                <button className="btn btn-secondary btn-sm" onClick={() => updateGalaxyCamera({ zoom: 1, x: 0, y: 0 })}>⌖</button>
                <button className="btn btn-secondary btn-sm" onClick={() => updateGalaxyCamera({ zoom: galaxyMapCamera.zoom * 0.75 })}>-</button>
            </div>
            <div className={styles.legend}>
                <span style={{ color: '#69f0ae' }}>● Colony</span>
                <span style={{ color: '#4fc3f7' }}>─ Jump Lane</span>
                <span style={{ color: '#3a4a5a' }}>● Unexplored</span>
            </div>
        </div>
    );
}
