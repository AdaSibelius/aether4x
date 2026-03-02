'use client';
import { Vector3, Color3 } from '@babylonjs/core';

interface OrbitMeshProps {
    radius: number;
    color?: string;
}

export function OrbitMesh({ radius, color = 'rgba(79,195,247,0.15)' }: OrbitMeshProps) {
    // Generate points for a circle
    const points: Vector3[] = [];
    const segments = 128; // Smoother orbits
    for (let i = 0; i <= segments; i++) {
        const phi = (i / segments) * 2 * Math.PI;
        points.push(new Vector3(Math.cos(phi) * radius, 0, Math.sin(phi) * radius));
    }

    return (
        <lines
            name={`orbit-${radius}`}
            points={points}
            color={Color3.FromHexString('#4fc3f7')} // Fixed blue for now, matching aesthetic
            alpha={0.15}
        />
    );
}
