'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { Engine, Scene, useScene } from 'react-babylonjs';
import {
    Vector3,
    Color4,
    ArcRotateCamera,
    AbstractMesh,
    Color3,
    PointerEventTypes,
} from '@babylonjs/core';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { getPlanetPosition } from '@/engine/fleets';
import { StarMeshV2 } from '../SharedBabylon/Components/StarMeshV2';
import { PlanetMesh } from '../SharedBabylon/Components/PlanetMesh';
import { Starfield } from '../SharedBabylon/Components/Starfield';
import { OrbitMesh } from './BabylonComponents/OrbitMesh';
import { FleetMesh } from './BabylonComponents/FleetMesh';
import { EntityLabel } from './BabylonComponents/EntityLabel';
import { CombatLine } from './BabylonComponents/CombatLine';

export interface ClickTarget {
    id: string;
    name: string;
    type: 'Planet' | 'Fleet' | 'Star';
}

interface ClickManagerProps {
    onSceneClick: (targets: ClickTarget[], e: any) => void;
}

function ClickManager({ onSceneClick }: ClickManagerProps) {
    const scene = useScene();
    React.useEffect(() => {
        if (!scene) return;

        const observer = scene.onPointerObservable.add((pi) => {
            if (pi.type === PointerEventTypes.POINTERDOWN) {
                const isRightClick = pi.event.button === 2;

                // Left click uses a tight 10px cluster. Right click uses a wide 35px brush to capture orbital groups.
                const offsets = isRightClick ? [
                    [0, 0], [20, 0], [-20, 0], [0, 20], [0, -20],
                    [15, 15], [-15, -15], [15, -15], [-15, 15],
                    [35, 0], [-35, 0], [0, 35], [0, -35],
                    [25, 25], [-25, -25], [25, -25], [-25, 25]
                ] : [
                    [0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]
                ];

                const validTargets: ClickTarget[] = [];

                for (const [ox, oy] of offsets) {
                    const hits = scene.multiPick(scene.pointerX + ox, scene.pointerY + oy);
                    if (hits && hits.length > 0) {
                        for (const hit of hits) {
                            if (!hit.hit || !hit.pickedMesh) continue;

                            const mesh = hit.pickedMesh;
                            const parentName = mesh.parent?.name || '';

                            let type: 'Planet' | 'Fleet' | 'Star' | null = null;
                            let id = '';

                            if (parentName.startsWith('planet-node-')) {
                                type = 'Planet'; id = parentName.replace('planet-node-', '');
                            } else if (parentName.startsWith('star-node-')) {
                                type = 'Star'; id = parentName.replace('star-node-', '');
                            } else if (parentName.startsWith('fleet-node-')) {
                                type = 'Fleet'; id = parentName.replace('fleet-node-', '');
                            }

                            if (type && id && !validTargets.some(t => t.id === id)) {
                                validTargets.push({ id, name: mesh.name, type });
                            }
                        }
                    }
                }

                onSceneClick(validTargets, pi.event);
            }
        });

        return () => {
            scene.onPointerObservable.remove(observer);
        };
    }, [scene, onSceneClick]);

    return null;
}
// Removed duplicate imports

interface SystemMapBabylonProps {
    onContextMenu: (targets: ClickTarget[], x: number, y: number) => void;
}

export default function SystemMapBabylon({ onContextMenu }: SystemMapBabylonProps) {
    const game = useGameStore(s => s.game);
    const { selectedStarId, selectedPlanetId, selectedFleetId, selectPlanet, selectFleet } = useUIStore();

    const [meshes, setMeshes] = useState<Record<string, AbstractMesh>>({});
    const [uiLayer, setUiLayer] = useState<any>(null);

    const star = selectedStarId ? game?.galaxy.stars[selectedStarId] : null;

    const ORBIT_SCALE = 50;
    const DEFAULT_ORTO = 80;

    const registerMesh = useCallback((id: string, mesh: AbstractMesh) => {
        setMeshes(prev => {
            if (prev[id] === mesh) return prev;
            return { ...prev, [id]: mesh };
        });
    }, []);

    const handleSceneClick = useCallback((targets: ClickTarget[], e: any) => {
        const nativeEvent = e.event || e.pointerEvent || e.nativeEvent || e;

        if (!targets || targets.length === 0) {
            selectPlanet(null);
            selectFleet(null);
            return;
        }

        // Right Click: Open Context Menu with all layered targets
        if (nativeEvent && nativeEvent.button === 2) {
            onContextMenu(targets, nativeEvent.clientX || 0, nativeEvent.clientY || 0);
            return;
        }

        // Left Click: Auto-select and navigate to the top-most target
        const topTarget = targets[0];
        if (topTarget.type === 'Fleet') {
            selectFleet(topTarget.id);
            selectPlanet(null);
            useUIStore.getState().setView('Fleets');
        } else { // Planet or Star
            selectPlanet(topTarget.id);
            selectFleet(null);
            const hasColony = Object.values(useGameStore.getState().game?.colonies || {}).some(c => c.planetId === topTarget.id);
            useUIStore.getState().setView(hasColony ? 'Colonies' : 'Planets');
        }
    }, [selectPlanet, selectFleet, onContextMenu]);

    const fleetsInSystem = useMemo(() => {
        if (!game || !star) return [];
        return Object.values(game.empires)
            .flatMap(e => e.fleets)
            .filter(f => f.currentStarId === star.id);
    }, [game, star]);

    // Build a list of active combat engagement pairs (attacker → target)
    // Only include pairs where both fleets are currently in this system
    const combatPairs = useMemo(() => {
        if (!game || !star) return [];
        const fleetMap = new Map(fleetsInSystem.map(f => [f.id, f]));
        const pairs: Array<{ id: string; attacker: typeof fleetsInSystem[0]; target: typeof fleetsInSystem[0] }> = [];
        for (const fleet of fleetsInSystem) {
            if (!fleet.combatTargetFleetId) continue;
            const target = fleetMap.get(fleet.combatTargetFleetId);
            if (target) {
                pairs.push({ id: `${fleet.id}->${target.id}`, attacker: fleet, target });
            }
        }
        return pairs;
    }, [game, star, fleetsInSystem]);

    const maxZoomRadius = useMemo(() => {
        if (!star || star.planets.length === 0) return 200;
        const maxOrbit = Math.max(...star.planets.map(p => p.orbitRadius));
        // Screen half-height in world units = DEFAULT_ORTO * (camera.radius / 100) = 0.8 * camera.radius
        // To comfortably fit maxOrbit * 50 (ORBIT_SCALE) with padding, we need a radius of roughly maxOrbit * 100.
        return Math.max(200, maxOrbit * 100);
    }, [star]);

    const handleCameraCreated = (camera: ArcRotateCamera) => {
        camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;

        // Fix for black screen clipping at extreme zoom distances
        camera.maxZ = 100000;

        // Makes scrolling scale exponentially with distance, rather than linear
        camera.wheelPrecision = 0; // Disable flat precision
        camera.wheelDeltaPercentage = 0.05;

        // Panning should also scale with zoom
        camera.panningSensibility = 5000 / camera.radius;

        const zoomFactor = camera.radius / 100;
        camera.orthoLeft = -DEFAULT_ORTO * zoomFactor;
        camera.orthoRight = DEFAULT_ORTO * zoomFactor;
        camera.orthoTop = DEFAULT_ORTO * zoomFactor;
        camera.orthoBottom = -DEFAULT_ORTO * zoomFactor;

        camera.getScene().onBeforeRenderObservable.add(() => {
            const zf = camera.radius / 100;
            camera.orthoLeft = -DEFAULT_ORTO * zf;
            camera.orthoRight = DEFAULT_ORTO * zf;
            camera.orthoTop = DEFAULT_ORTO * zf;
            camera.orthoBottom = -DEFAULT_ORTO * zf;

            // Dynamically scale panning sensitivity based on zoom level
            camera.panningSensibility = 5000 / camera.radius;
        });
    };

    if (!star || !game) return null;

    return (
        <Engine antialias adaptToDeviceRatio canvasId="system-map-canvas">
            <Scene clearColor={new Color4(0.01, 0.015, 0.03, 1)}>
                <ClickManager onSceneClick={handleSceneClick} />
                <arcRotateCamera
                    name="system-camera"
                    alpha={-Math.PI / 2}
                    beta={Math.PI / 4} // default tilted view
                    radius={100}
                    target={Vector3.Zero()}
                    minZ={0.1}
                    maxZ={100000}
                    upperRadiusLimit={maxZoomRadius}
                    lowerBetaLimit={0}
                    upperBetaLimit={Math.PI / 2.2} // allow tilt to near horizontal
                    useAutoRotationBehavior={false}
                    angularSensibilityX={1500}
                    angularSensibilityY={1500}
                    onCreated={handleCameraCreated}
                />

                <Starfield seed={star.id} />
                <hemisphericLight name="ambient-light" direction={new Vector3(0, 1, 0)} intensity={0.5} />
                <pointLight name="sun-light" position={new Vector3(0, 0.5, 0)} intensity={1.5} diffuse={Color3.White()} />

                <StarMeshV2
                    id={star.id}
                    name={star.name}
                    spectralType={star.spectralType}
                    position={Vector3.Zero()}
                    scale={5}
                    onMeshCreated={(m) => registerMesh(star.id, m)}
                />

                <adtFullscreenUi
                    name="ui-layer"
                    onCreated={(ui) => setUiLayer(ui)}
                >
                    {/* UI Layer initialized silently */}
                </adtFullscreenUi>

                {/* Imperative Labels */}
                {uiLayer && (
                    <React.Fragment>
                        <EntityLabel name={star.name} mesh={meshes[star.id]} yOffset={45} uiLayer={uiLayer} />
                        {star.planets.map((planet) => (
                            <React.Fragment key={`labels-${planet.id}`}>
                                <EntityLabel name={planet.name} mesh={meshes[planet.id]} yOffset={35} uiLayer={uiLayer} />
                                {planet.moons?.map(moon => (
                                    <EntityLabel key={`label-${moon.id}`} name={moon.name} mesh={meshes[moon.id]} yOffset={25} uiLayer={uiLayer} />
                                ))}
                            </React.Fragment>
                        ))}
                        {fleetsInSystem.map(fleet => (
                            <EntityLabel key={`label-${fleet.id}`} name={fleet.name} mesh={meshes[fleet.id]} yOffset={30} uiLayer={uiLayer} />
                        ))}
                    </React.Fragment>
                )}

                {star.planets.map((planet) => {
                    const pos = getPlanetPosition(planet, game.turn);
                    const babylonPos = new Vector3(pos.x * ORBIT_SCALE, 0, pos.y * ORBIT_SCALE);
                    const orbitRadius = planet.orbitRadius * ORBIT_SCALE;
                    const isSurveyed = planet.surveyedByEmpires.includes(game.playerEmpireId ?? '');

                    return (
                        <React.Fragment key={planet.id}>
                            <OrbitMesh radius={orbitRadius} />
                            <PlanetMesh
                                id={planet.id}
                                name={planet.name}
                                bodyType={planet.bodyType}
                                position={babylonPos}
                                scale={Math.max(2, planet.radius * 3)}
                                isSelected={planet.id === selectedPlanetId}
                                isSurveyed={isSurveyed}
                                hasRings={planet.bodyType === 'GasGiant' || planet.bodyType === 'IceGiant'}
                                atmosphereType={planet.atmosphere}
                                onMeshCreated={(m) => registerMesh(planet.id, m)}
                            />

                            {planet.moons?.map(moon => {
                                const mPos = getPlanetPosition(moon, game.turn);
                                const exaggerateMoonDist = 40;
                                const mBabylonPos = new Vector3(
                                    babylonPos.x + mPos.x * ORBIT_SCALE * exaggerateMoonDist,
                                    0,
                                    babylonPos.z + mPos.y * ORBIT_SCALE * exaggerateMoonDist
                                );
                                return (
                                    <PlanetMesh
                                        key={moon.id}
                                        id={moon.id}
                                        name={moon.name}
                                        bodyType={moon.bodyType}
                                        position={mBabylonPos}
                                        scale={Math.max(1, moon.radius * 3)}
                                        isSelected={moon.id === selectedPlanetId}
                                        isSurveyed={true}
                                        atmosphereType={moon.atmosphere}
                                        onMeshCreated={(m) => registerMesh(moon.id, m)}
                                    />
                                );
                            })}
                        </React.Fragment>
                    );
                })}

                {fleetsInSystem.map((fleet) => (
                    <FleetMesh
                        key={fleet.id}
                        id={fleet.id}
                        name={fleet.name}
                        position={new Vector3(fleet.position.x * ORBIT_SCALE, 3, fleet.position.y * ORBIT_SCALE)}
                        isCivilian={fleet.isCivilian ?? false}
                        isPlayer={fleet.empireId === game.playerEmpireId}
                        isSelected={fleet.id === selectedFleetId}
                        onMeshCreated={(m) => registerMesh(fleet.id, m)}
                    />
                ))}

                {/* Combat firing lines between engaged fleets */}
                {combatPairs.map(({ id, attacker, target }) => (
                    <CombatLine
                        key={id}
                        id={id}
                        from={new Vector3(attacker.position.x * ORBIT_SCALE, 3, attacker.position.y * ORBIT_SCALE)}
                        to={new Vector3(target.position.x * ORBIT_SCALE, 3, target.position.y * ORBIT_SCALE)}
                    />
                ))}
            </Scene>
        </Engine>
    );
}
