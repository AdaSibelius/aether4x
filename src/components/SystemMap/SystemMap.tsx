'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { getPlanetPosition } from '@/engine/fleets';
import { makePrng, strHash, drawPlanetSphere, drawStarfield } from '../SharedTabs/renderPlanets';
import styles from './SystemMap.module.css';

const BODY_COLORS: Record<string, string> = {
    Terrestrial: '#4a8fa8', GasGiant: '#c07834', IceGiant: '#5a8fba',
    Dwarf: '#7a7a8a', AsteroidBelt: '#8a7a5a',
};
const ATMO_COLORS: Record<string, string> = {
    Breathable: '#69f0ae', Thin: '#b0c4d8', Dense: '#e8c84a',
    Toxic: '#ff9800', Corrosive: '#ff5252', None: '#4a5a6a',
};

export default function SystemMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const timeRef = useRef(0);

    const game = useGameStore(s => s.game);
    const ObjectType = game ? typeof game : 'any'; // Dummy

    const {
        selectedStarId, selectedPlanetId, selectedFleetId,
        systemMapCamera, updateSystemCamera, selectPlanet, selectFleet,
        showTradeOverlay, toggleTradeOverlay,
        contextMenu, setContextMenu
    } = useUIStore();

    const star = selectedStarId ? game?.galaxy.stars[selectedStarId] : null;

    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

    const draw = useCallback((ts: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !star) return;
        const ctx = canvas.getContext('2d')!;
        const W = canvas.width, H = canvas.height;
        timeRef.current = ts * 0.0001;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#050810';
        ctx.fillRect(0, 0, W, H);

        // Draw stable starfield background for this specific system
        drawStarfield(ctx, W, H, makePrng(strHash(star.id)));

        const cx = W / 2 + systemMapCamera.x;
        const cy = H / 2 + systemMapCamera.y;
        const scale = Math.min(W, H) / 14 * systemMapCamera.zoom; // pixels per AU

        // Star glow
        const spectralColors: Record<string, string> = {
            O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#fbf8ff', G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
            WhiteDwarf: '#e8e8ff', Neutron: '#ffffff', BlackHole: '#222'
        };
        const starColor = spectralColors[star.spectralType] ?? '#fff4ea';
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.8);
        grd.addColorStop(0, starColor);
        grd.addColorStop(0.3, `${starColor}88`);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = starColor;
        ctx.fill();

        // Planets
        for (const planet of star.planets) {
            const orbitR = planet.orbitRadius * scale;
            // Orbit ring
            ctx.beginPath();
            ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(79,195,247,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Kepler's Third Law approximation for 1 Solar Mass: T = R^1.5 years.
            const speed = (2 * Math.PI) / (365.25 * Math.pow(planet.orbitRadius, 1.5));
            const gameTimeDays = (game?.turn || 0) / 86400; // Convert seconds to days
            const angle = planet.orbitAngle + gameTimeDays * speed;
            const px = cx + Math.cos(angle) * orbitR;
            const py = cy + Math.sin(angle) * orbitR;

            const pRadius = Math.max(4, planet.radius * 5 * systemMapCamera.zoom);
            const isSelected = planet.id === selectedPlanetId;
            const isSurveyed = planet.surveyedByEmpires.includes(game?.playerEmpireId ?? '');
            const hasColony = planet.colonies.length > 0;

            const bodyColor = BODY_COLORS[planet.bodyType] ?? '#6a7a8a';

            // Planet glow
            if (isSelected) {
                ctx.beginPath();
                ctx.arc(px, py, pRadius + 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(79,195,247,0.15)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, pRadius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = '#4fc3f7';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Planet body or Asteroid Belt
            if (planet.type === 'Asteroid') {
                ctx.beginPath();
                ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(138,122,90,0.4)';
                ctx.lineWidth = 6 * systemMapCamera.zoom;
                ctx.stroke();
            } else {
                if (isSurveyed || hasColony) {
                    const seed = strHash(planet.id);
                    // Slow rotation on the map to look majestic
                    const rot = (game?.turn || 0) / 86400 * 5;
                    const colony = planet.colonies.find(c => c.empireId === game?.playerEmpireId) || null;

                    drawPlanetSphere(
                        ctx, px, py, pRadius,
                        planet.bodyType, planet.atmosphere,
                        makePrng(seed), rot, colony, null,
                        angle
                    );
                } else {
                    // Unexplored planet: dull grey sphere
                    ctx.beginPath();
                    ctx.arc(px, py, pRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#2a3a4a';
                    ctx.fill();

                    // Add a subtle ? mark on unexplored planets when zoomed in
                    if (systemMapCamera.zoom > 1.5) {
                        ctx.font = `bold ${pRadius * 1.2}px Inter`;
                        ctx.fillStyle = 'rgba(255,255,255,0.4)';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('?', px, py);
                    }
                }
            }

            // Colony indicator
            if (hasColony) {
                ctx.beginPath();
                ctx.arc(px, py - pRadius - 5, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#69f0ae';
                ctx.fill();
            }

            // Labels
            if (isSurveyed || isSelected) {
                ctx.font = `${10 * systemMapCamera.zoom}px Inter`;
                ctx.fillStyle = isSelected ? '#4fc3f7' : 'rgba(140,170,200,0.7)';
                ctx.textAlign = 'center';
                ctx.fillText(planet.name, px, py + pRadius + 12);
            }
        }

        // Jump points
        for (const jp of star.jumpPoints.filter(j => j.discovered)) {
            const angle = Math.atan2(jp.position.y, jp.position.x);
            const dist = Math.min(W, H) * 0.42;
            const jpx = cx + Math.cos(angle) * dist;
            const jpy = cy + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(jpx, jpy, 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(79,195,247,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = '9px Inter';
            ctx.fillStyle = 'rgba(79,195,247,0.6)';
            ctx.textAlign = 'center';
            const dest = game?.galaxy.stars[jp.targetStarId];
            ctx.fillText(`→ ${dest?.name ?? '?'}`, jpx, jpy + 16);
        }

        // Trade Routes
        if (game && showTradeOverlay) {
            const empire = game.empires[game.playerEmpireId];
            if (empire.tradeRoutes) {
                for (const route of empire.tradeRoutes) {
                    const sourceColony = game.colonies[route.sourceColonyId];
                    const targetColony = game.colonies[route.targetColonyId];
                    if (!sourceColony || !targetColony) continue;

                    const sourceStarId = Object.values(game.galaxy.stars).find(s => s.planets.some(p => p.id === sourceColony.planetId))?.id;
                    const targetStarId = Object.values(game.galaxy.stars).find(s => s.planets.some(p => p.id === targetColony.planetId))?.id;

                    if (sourceStarId === star.id || targetStarId === star.id) {
                        let sx, sy, tx, ty;

                        // Source
                        if (sourceStarId === star.id) {
                            const p = star.planets.find(pl => pl.id === sourceColony.planetId);
                            if (p) {
                                const pos = getPlanetPosition(p, game.turn);
                                sx = cx + pos.x * scale;
                                sy = cy + pos.y * scale;
                            }
                        } else {
                            const jp = star.jumpPoints.find(j => j.targetStarId === sourceStarId);
                            if (jp) {
                                const angle = Math.atan2(jp.position.y, jp.position.x);
                                const dist = Math.min(W, H) * 0.42;
                                sx = cx + Math.cos(angle) * dist;
                                sy = cy + Math.sin(angle) * dist;
                            }
                        }

                        // Target
                        if (targetStarId === star.id) {
                            const p = star.planets.find(pl => pl.id === targetColony.planetId);
                            if (p) {
                                const pos = getPlanetPosition(p, game.turn);
                                tx = cx + pos.x * scale;
                                ty = cy + pos.y * scale;
                            }
                        } else {
                            const jp = star.jumpPoints.find(j => j.targetStarId === targetStarId);
                            if (jp) {
                                const angle = Math.atan2(jp.position.y, jp.position.x);
                                const dist = Math.min(W, H) * 0.42;
                                tx = cx + Math.cos(angle) * dist;
                                ty = cy + Math.sin(angle) * dist;
                            }
                        }

                        if (sx !== undefined && sy !== undefined && tx !== undefined && ty !== undefined && (sourceStarId !== targetStarId || sx !== tx || sy !== ty)) {
                            ctx.beginPath();
                            ctx.moveTo(sx, sy);
                            ctx.lineTo(tx, ty);
                            ctx.strokeStyle = 'rgba(105, 240, 174, 0.4)';
                            ctx.lineWidth = 1.5;

                            const dashOffset = -timeRef.current * 20;
                            ctx.setLineDash([6, 8]);
                            ctx.lineDashOffset = dashOffset;
                            ctx.stroke();

                            ctx.setLineDash([]);
                            ctx.lineDashOffset = 0;

                            const mx = (sx + tx) / 2;
                            const my = (sy + ty) / 2;
                            const angle = Math.atan2(ty - sy, tx - sx);
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
        }

        // Fleets
        if (game) {
            const fleetsInSystem = Object.values(game.empires)
                .flatMap(e => e.fleets)
                .filter(f => f.currentStarId === star.id);

            // Group fleets by exact position to stagger them visually
            const positionGroups: Record<string, typeof fleetsInSystem> = {};
            for (const fleet of fleetsInSystem) {
                const key = `${Math.round(fleet.position.x * 1000)},${Math.round(fleet.position.y * 1000)}`;
                if (!positionGroups[key]) positionGroups[key] = [];
                positionGroups[key].push(fleet);
            }

            for (const group of Object.values(positionGroups)) {
                for (let i = 0; i < group.length; i++) {
                    const fleet = group[i];
                    const isPlayer = fleet.empireId === game.playerEmpireId;

                    // Stagger visually by index in group
                    const staggerX = (i % 3 - 1) * 12;
                    const staggerY = (Math.floor(i / 3)) * 12;

                    let fx = cx + fleet.position.x * scale + staggerX;
                    let fy = cy + fleet.position.y * scale + staggerY;

                    // If orbiting, visually peg to the animated planet position
                    if (fleet.orbitingPlanetId && !fleet.destination) {
                        const planet = star.planets.find(p => p.id === fleet.orbitingPlanetId);
                        if (planet) {
                            const orbitR = planet.orbitRadius * scale;
                            const speed = (2 * Math.PI) / (365.25 * Math.pow(planet.orbitRadius, 1.5));
                            const gameTimeDays = (game?.turn || 0) / 86400;
                            const angle = planet.orbitAngle + gameTimeDays * speed;
                            fx = cx + Math.cos(angle) * orbitR + staggerX;
                            fy = cy + Math.sin(angle) * orbitR + staggerY;
                        }
                    }

                    // Selection glow
                    if (fleet.id === selectedFleetId) {
                        ctx.beginPath();
                        ctx.arc(fx, fy, 15, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(79,195,247,0.15)';
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(fx, fy, 15, 0, Math.PI * 2);
                        ctx.strokeStyle = '#4fc3f7';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }

                    // Draw destination line if active
                    if (fleet.destination && isPlayer) {
                        const destX = cx + fleet.destination.x * scale;
                        const destY = cy + fleet.destination.y * scale;
                        ctx.beginPath();
                        ctx.moveTo(fx, fy);
                        ctx.lineTo(destX, destY);
                        ctx.strokeStyle = 'rgba(79,195,247,0.3)';
                        ctx.setLineDash([4, 4]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    // Draw fleet icon (triangle)
                    ctx.save();
                    ctx.translate(fx, fy);
                    // Rotate towards destination or just point up
                    if (fleet.destination) {
                        const angle = Math.atan2(fleet.destination.y - fleet.position.y, fleet.destination.x - fleet.position.x);
                        ctx.rotate(angle);
                    } else {
                        ctx.rotate(-Math.PI / 2); // default point up
                    }

                    // Glow effect back
                    ctx.shadowColor = isPlayer ? 'rgba(129, 212, 250, 0.8)' : 'rgba(255, 138, 128, 0.8)';
                    ctx.shadowBlur = 8;

                    if (fleet.isCivilian) {
                        ctx.fillStyle = fleet.civilianType === 'transport' ? '#ffcc80' : '#a5d6a7';
                        ctx.fillRect(-3, -3, 6, 6);
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = fleet.civilianType === 'transport' ? '#ef6c00' : '#2e7d32';
                        ctx.strokeRect(-3, -3, 6, 6);
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(8, 0); // slightly smaller
                        ctx.lineTo(-4, 4);
                        ctx.lineTo(-2, 0);
                        ctx.lineTo(-4, -4);
                        ctx.closePath();
                        ctx.fillStyle = isPlayer ? '#81d4fa' : '#ff8a80';
                        ctx.fill();

                        // Outline
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = isPlayer ? '#0288d1' : '#d50000';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }

                    ctx.restore();

                    // Draw fleet name label only if selected or hovered
                    const isHovered = hoverPos && Math.hypot(hoverPos.x - fx, hoverPos.y - fy) < 20;
                    if (isPlayer && (fleet.id === selectedFleetId || isHovered)) {
                        ctx.font = `italic 400 ${Math.max(10, 11 * systemMapCamera.zoom)}px 'Playfair Display'`;
                        ctx.fillStyle = '#b3e5fc';
                        ctx.textAlign = 'center';
                        ctx.shadowColor = '#000';
                        ctx.shadowBlur = 4;
                        ctx.fillText(fleet.name, fx, fy + (isHovered ? 20 : 16));
                        ctx.shadowBlur = 0;
                    }
                }
            }
        }
    }, [star, game, selectedPlanetId, selectedFleetId, systemMapCamera, hoverPos]);

    useEffect(() => {
        const loop = (ts: number) => { draw(ts); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const w = Math.floor(rect.width), h = Math.floor(rect.height);
            if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
        };
        requestAnimationFrame(resize);
        resize();
        const obs = new ResizeObserver(resize);
        obs.observe(canvas.parentElement ?? canvas);
        return () => obs.disconnect();
    }, []);

    const onMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setHoverPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const onClick = (e: React.MouseEvent) => {
        if (!star || !game) return;
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const W = canvas.width, H = canvas.height;
        const cx2 = W / 2 + systemMapCamera.x, cy2 = H / 2 + systemMapCamera.y;
        const scale2 = Math.min(W, H) / 14 * systemMapCamera.zoom;
        const gameTimeDays = (game?.turn || 0) / 86400;

        const targets: { id: string, name: string, type: 'Planet' | 'Fleet' }[] = [];

        // Check Fleets
        const fleetsInSystem = Object.values(game.empires)
            .flatMap(emp => emp.fleets)
            .filter(f => f.currentStarId === star.id);

        const positionGroups: Record<string, typeof fleetsInSystem> = {};
        for (const fleet of fleetsInSystem) {
            const key = `${Math.round(fleet.position.x * 1000)},${Math.round(fleet.position.y * 1000)}`;
            if (!positionGroups[key]) positionGroups[key] = [];
            positionGroups[key].push(fleet);
        }

        for (const group of Object.values(positionGroups)) {
            for (let i = 0; i < group.length; i++) {
                const fleet = group[i];
                const staggerX = (i % 3 - 1) * 12;
                const staggerY = (Math.floor(i / 3)) * 12;

                let fx = cx2 + fleet.position.x * scale2 + staggerX;
                let fy = cy2 + fleet.position.y * scale2 + staggerY;

                if (fleet.orbitingPlanetId && !fleet.destination) {
                    const planet = star.planets.find(p => p.id === fleet.orbitingPlanetId);
                    if (planet) {
                        const orbitR = planet.orbitRadius * scale2;
                        const speed = (2 * Math.PI) / (365.25 * Math.pow(planet.orbitRadius, 1.5));
                        const angle = planet.orbitAngle + gameTimeDays * speed;
                        fx = cx2 + Math.cos(angle) * orbitR + staggerX;
                        fy = cy2 + Math.sin(angle) * orbitR + staggerY;
                    }
                }

                if (Math.hypot(mx - fx, my - fy) < 15) {
                    targets.push({ id: fleet.id, name: fleet.name, type: 'Fleet' });
                }
            }
        }

        // Check Planets
        for (const planet of star.planets) {
            const orbitR = planet.orbitRadius * scale2;
            const speed = (2 * Math.PI) / (365.25 * Math.pow(planet.orbitRadius, 1.5));
            const angle = planet.orbitAngle + gameTimeDays * speed;
            const px = cx2 + Math.cos(angle) * orbitR;
            const py = cy2 + Math.sin(angle) * orbitR;
            const r = Math.max(4, planet.radius * 5 * systemMapCamera.zoom) + 8;

            if (Math.hypot(mx - px, my - py) < r) {
                targets.push({ id: planet.id, name: planet.name, type: 'Planet' });
            }
        }

        if (targets.length > 1) {
            useUIStore.getState().setContextMenu({ x: e.clientX, y: e.clientY, targets });
        } else if (targets.length === 1) {
            const t = targets[0];
            if (t.type === 'Fleet') {
                selectPlanet(null);
                selectFleet(t.id);
            } else {
                selectPlanet(t.id);
                selectFleet(null);
            }
            useUIStore.getState().setContextMenu(null);
        } else {
            selectPlanet(null);
            selectFleet(null);
            useUIStore.getState().setContextMenu(null);
        }
    };

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.18;
        updateSystemCamera({ zoom: Math.min(3, Math.max(0.4, systemMapCamera.zoom * delta)) });
    };

    if (!star) {
        return (
            <div className={styles.empty}>
                <span>Select a star system in the Galaxy Map</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.starName}>{star.name}</span>
                <span className={styles.spectral}>{star.spectralType}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 15, alignItems: 'center' }}>
                    <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', color: showTradeOverlay ? '#69f0ae' : 'var(--text-muted)' }}>
                        <input type="checkbox" checked={showTradeOverlay} onChange={toggleTradeOverlay} style={{ width: 12, height: 12, accentColor: '#69f0ae' }} />
                        Trade Routes
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {star.planets.length} bodies · {star.jumpPoints.filter(j => j.discovered).length} jump points
                    </span>
                </div>
            </div>
            <canvas ref={canvasRef} className={styles.canvas} onClick={onClick} onWheel={onWheel} />

            {/* Selection Disambiguation Menu */}
            {contextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={styles.menuHeader}>Select Target</div>
                    {contextMenu.targets.map((t: { id: string, name: string, type: 'Planet' | 'Fleet' }) => (
                        <div
                            key={t.id}
                            className={styles.menuItem}
                            onClick={() => {
                                if (t.type === 'Fleet') {
                                    selectPlanet(null);
                                    selectFleet(t.id);
                                } else { // t.type === 'Planet'
                                    const p = star.planets.find(pl => pl.id === t.id);
                                    if (p?.type === 'Asteroid') {
                                        selectPlanet(null);
                                        selectFleet(t.id);
                                    } else {
                                        selectPlanet(t.id);
                                        selectFleet(null);
                                    }
                                }
                                useUIStore.getState().setContextMenu(null);
                            }}
                        >
                            <span className={styles.icon}>{t.type === 'Fleet' ? '🚀' : '🪐'}</span>
                            <span className={styles.name}>{t.name}</span>
                        </div>
                    ))}
                    <div
                        className={styles.menuItem}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
                        onClick={() => useUIStore.getState().setContextMenu(null)}
                    >
                        Cancel
                    </div>
                </div>
            )}
        </div>
    );
}
