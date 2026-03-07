import { Vector3, Color3, StandardMaterial, Mesh } from '@babylonjs/core';
import React, { useRef, useEffect } from 'react';
import { useScene } from 'react-babylonjs';
import { BodyType, AtmosphereType } from '@/types';
import { createHighFidelityPlanetMaterial } from '../Materials/PlanetShader';

export interface PlanetMeshProps {
    id: string;
    name: string;
    bodyType: BodyType;
    position: Vector3;
    scale: number;
    isSelected: boolean;
    isSurveyed: boolean;
    hasRings?: boolean;
    onMeshCreated?: (mesh: Mesh) => void;
    sunPosition?: Vector3;
    atmosphereType?: AtmosphereType;
}

const ATMO_LEVELS: Record<AtmosphereType, number> = {
    None: 0, Thin: 1, Breathable: 2, Dense: 3, Toxic: 4, Corrosive: 5
};

const BODY_COLORS: Record<string, string> = {
    Terrestrial: '#4a8fa8',
    GasGiant: '#c07834',
    IceGiant: '#5a8fba',
    Dwarf: '#7a7a8a',
    Ocean: '#2b65ec',
    Desert: '#d2b48c',
    Volcanic: '#c04000',
    Protoplanetary: '#8b4513',
    AsteroidBelt: '#8a7a5a',
};

/**
 * A robust planet mesh component. 
 * Optimized for stability to ensure shaders compile correctly across all devices.
 */
export function PlanetMesh({
    id,
    name,
    bodyType,
    position,
    scale,
    isSelected,
    isSurveyed,
    hasRings,
    onMeshCreated,
    sunPosition = Vector3.Zero(),
    atmosphereType = 'None'
}: PlanetMeshProps) {
    const meshRef = useRef<Mesh>(null);
    const matRef = useRef<StandardMaterial>(null);
    const scene = useScene();

    const baseColorHex = isSurveyed ? (BODY_COLORS[bodyType] ?? '#6a7a8a') : '#2a3a4a';
    const baseColor = Color3.FromHexString(baseColorHex);

    useEffect(() => {
        if (!scene || !meshRef.current || !isSurveyed) return;

        let pType: 0 | 1 | 2 | 3 = 0; // Terrestrial
        let atmoColor = new Color3(0.3, 0.6, 1.0); // Earth-like blue Rim

        if (bodyType === 'GasGiant' || bodyType === 'IceGiant') {
            pType = 1;
            atmoColor = baseColor.scale(1.2);
        } else if (bodyType === 'Volcanic') {
            pType = 2;
            atmoColor = new Color3(1.0, 0.3, 0.1);
        } else if (bodyType === 'Dwarf' || ['S', 'C', 'M', 'D'].includes(bodyType as string)) {
            pType = 3;
            atmoColor = new Color3(0, 0, 0); // No atmosphere
        }

        const seedInt = parseInt(id.replace(/\\D/g, '').substring(0, 5)) || Math.random() * 1000;
        const atmoLevel = ATMO_LEVELS[atmosphereType] ?? 0;

        const shaderMat = createHighFidelityPlanetMaterial(
            `planet-shader-${id}`,
            scene,
            pType,
            atmoLevel,
            baseColor,
            atmoColor,
            seedInt,
            sunPosition
        );

        meshRef.current.material = shaderMat;

        return () => {
            shaderMat.dispose();
        };
    }, [id, bodyType, isSurveyed, scene, baseColorHex]);

    return (
        <box
            name={`planet-node-${id}`}
            position={position}
            isVisible={false}
            size={0.1}
            onCreated={onMeshCreated}
        >
            {/* Main Planet Body */}
            <sphere
                name={name}
                segments={32}
                diameter={scale}
                ref={meshRef}
            >
                <standardMaterial
                    ref={matRef}
                    name={`${name}-material`}
                    diffuseColor={baseColor}
                    specularColor={new Color3(0.1, 0.1, 0.1)}
                    emissiveColor={baseColor.scale(0.08)}
                />
            </sphere>

            {/* Atmosphere Glow */}
            {isSurveyed && atmosphereType !== 'None' && (
                <sphere name={`${name}-atmosphere`} segments={16} diameter={scale * 1.06} isPickable={false}>
                    <standardMaterial
                        name={`${name}-atmo-mat`}
                        emissiveColor={baseColor}
                        alpha={0.15}
                        backFaceCulling={false}
                        disableLighting={true}
                    />
                </sphere>
            )}

            {/* Selection Ring */}
            {isSelected && (
                <sphere name={`${name}-selection-ring`} segments={32} diameter={scale * 1.25} isPickable={false}>
                    <standardMaterial
                        name={`${name}-select-mat`}
                        emissiveColor={Color3.FromHexString('#4fc3f7')}
                        alpha={0.2}
                        wireframe={true}
                        disableLighting={true}
                    />
                </sphere>
            )}

            {/* Rings for giants */}
            {hasRings && (
                <disc
                    name={`${name}-rings`}
                    radius={scale * 1.6}
                    tessellation={64}
                    rotation={new Vector3(Math.PI / 2.5, 0, 0)}
                >
                    <standardMaterial
                        name={`${name}-rings-mat`}
                        diffuseColor={baseColor.scale(0.6)}
                        alpha={0.35}
                        backFaceCulling={false}
                    />
                </disc>
            )}
        </box>
    );
}
