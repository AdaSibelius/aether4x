'use client';
import React, { useRef } from 'react';
import { Engine, Scene, useBeforeRender } from 'react-babylonjs';
import { Vector3, Color4, Color3, AbstractMesh } from '@babylonjs/core';
import { Planet, Star } from '@/types/celestial';
import { PlanetMesh } from '../SharedBabylon/Components/PlanetMesh';
import { StarMeshV2 } from '../SharedBabylon/Components/StarMeshV2';
import { Starfield } from '../SharedBabylon/Components/Starfield';

interface PlanetVisualizerBabylonProps {
    body: Planet | Star;
    orbitalParent?: Star;
}

function RotatingMesh({ children }: { children: React.ReactNode }) {
    const groupRef = useRef<AbstractMesh>(null);
    useBeforeRender(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.005;
        }
    });
    return <transformNode name="rotator" ref={groupRef}>{children}</transformNode>;
}

export default function PlanetVisualizerBabylon({ body, orbitalParent }: PlanetVisualizerBabylonProps) {
    const isStar = (body as any).type === 'Star' || 'spectralType' in body;
    const bodyScale = 10;

    return (
        <div style={{ width: '100%', height: '400px', background: '#050810', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <Engine antialias adaptToDeviceRatio canvasId={`visualizer-canvas-${body.id}`}>
                <Scene clearColor={new Color4(0.01, 0.012, 0.02, 1)}>
                    <arcRotateCamera
                        name="visualizer-camera"
                        alpha={-Math.PI / 2}
                        beta={Math.PI / 2.5}
                        radius={25}
                        target={Vector3.Zero()}
                        minZ={0.1}
                        lowerRadiusLimit={bodyScale * 1.5}
                        upperRadiusLimit={bodyScale * 10}
                        wheelPrecision={50}
                    />

                    <hemisphericLight name="ambient" direction={new Vector3(0, 1, 0)} intensity={0.4} />
                    <pointLight name="key-light" position={new Vector3(20, 10, 20)} intensity={2.5} />
                    <pointLight name="fill-light" position={new Vector3(-20, -10, -20)} intensity={1.0} diffuse={Color3.FromHexString('#8ab4d4')} />

                    <RotatingMesh>
                        {isStar ? (
                            <StarMeshV2
                                id={body.id}
                                spectralType={(body as Star).spectralType}
                                position={Vector3.Zero()}
                                scale={bodyScale}
                            />
                        ) : (
                            <PlanetMesh
                                id={body.id}
                                name={body.name}
                                bodyType={(body as Planet).bodyType}
                                position={Vector3.Zero()}
                                scale={bodyScale}
                                isSelected={false}
                                isSurveyed={true}
                                hasRings={(body as Planet).bodyType === 'GasGiant' || (body as Planet).bodyType === 'IceGiant'}
                                sunPosition={new Vector3(20, 10, 20)}
                                atmosphereType={(body as Planet).atmosphere}
                            />
                        )}
                    </RotatingMesh>

                    <Starfield seed={body.id} />
                </Scene>
            </Engine>

            {/* Visualizer Frame Overlay */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                border: '1px solid rgba(79, 195, 247, 0.2)',
                boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)',
                background: 'radial-gradient(circle at center, transparent 30%, rgba(5, 8, 16, 0.4) 100%)'
            }} />
        </div>
    );
}
