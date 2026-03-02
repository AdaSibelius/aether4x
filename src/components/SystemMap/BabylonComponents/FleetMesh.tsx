'use client';
import { Vector3, Color3, AbstractMesh } from '@babylonjs/core';
import React, { useMemo } from 'react';

interface FleetMeshProps {
    id: string;
    name: string;
    position: Vector3;
    isCivilian: boolean;
    isPlayer: boolean;
    isSelected: boolean;
    destination?: Vector3;
    onMeshCreated?: (mesh: AbstractMesh) => void;
}

export function FleetMesh({ id, name, position, isCivilian, isPlayer, isSelected, destination, onMeshCreated }: FleetMeshProps) {
    const color = isPlayer ? Color3.FromHexString('#81d4fa') : Color3.FromHexString('#ff8a80');

    let rotationY = 0;
    if (destination) {
        const direction = destination.subtract(position);
        rotationY = Math.atan2(direction.x, direction.z);
    }

    // Generate a tiny deterministic offset so stacked fleets spread out
    const hash = useMemo(() => {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
        return h;
    }, [id]);

    const offsetX = (Math.abs(hash) % 100) / 100 * 4 - 2;
    const offsetZ = (Math.abs(hash >> 2) % 100) / 100 * 4 - 2;
    const offsetPosition = new Vector3(position.x + offsetX, position.y, position.z + offsetZ);

    return (
        <box
            name={`fleet-node-${id}`}
            position={offsetPosition}
            rotation={new Vector3(0, rotationY, 0)}
            isVisible={false}
            size={0.1}
            onCreated={onMeshCreated}
        >
            {isCivilian ? (
                /* Box for civilian transports */
                <box
                    name={name}
                    size={0.6}
                >
                    <standardMaterial
                        name={`${name}-material`}
                        emissiveColor={color}
                        disableLighting={true}
                    />
                </box>
            ) : (
                /* Pyramid/Triangle for military fleets */
                <disc
                    name={name}
                    radius={2.0} // Increased from 0.8 for visibility
                    tessellation={3} // Triangle
                    rotation={new Vector3(Math.PI / 2, 0, 0)} // Orient on XZ plane
                >
                    <standardMaterial
                        name={`${name}-material`}
                        emissiveColor={color}
                        disableLighting={true}
                        backFaceCulling={false} // Double-sided
                    />
                </disc>
            )}

            {/* Selection indicator */}
            {isSelected && (
                <disc
                    name={`${name}-selection`}
                    radius={1.5}
                    tessellation={32}
                    position={new Vector3(0, -0.1, 0)}
                    rotation={new Vector3(Math.PI / 2, 0, 0)}
                    isPickable={false}
                >
                    <standardMaterial
                        name={`${name}-selection-mat`}
                        emissiveColor={Color3.FromHexString('#4fc3f7')}
                        alpha={0.3}
                        disableLighting={true}
                    />
                </disc>
            )}
        </box>
    );
}
