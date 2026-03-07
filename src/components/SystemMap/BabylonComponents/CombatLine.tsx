'use client';
import { useEffect, useRef } from 'react';
import { useScene } from 'react-babylonjs';
import { Vector3, Color3, MeshBuilder, StandardMaterial, LinesMesh } from '@babylonjs/core';

interface CombatLineProps {
    id: string;
    from: Vector3;
    to: Vector3;
}

/**
 * Draws an animated firing indicator line between two fleet positions.
 * Pulses in color/alpha to give a "live fire" feel.
 */
export function CombatLine({ id, from, to }: CombatLineProps) {
    const scene = useScene();
    const lineRef = useRef<LinesMesh | null>(null);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!scene) return;

        const mid = Vector3.Lerp(from, to, 0.5);

        // Draw a 3-segment kinked line to look like a weapons discharge arc
        const points = [from, mid, to];
        const line = MeshBuilder.CreateDashedLines(
            `combat-line-${id}`,
            { points, dashNb: 12, dashSize: 0.6, gapSize: 0.4 },
            scene
        );

        const mat = new StandardMaterial(`combat-line-mat-${id}`, scene);
        mat.emissiveColor = Color3.FromHexString('#ff4444');
        mat.disableLighting = true;
        line.material = mat;

        lineRef.current = line;

        // Pulse alpha: flicker between 0.4 and 1.0 each frame
        const observer = scene.onBeforeRenderObservable.add(() => {
            frameRef.current += 0.12;
            line.alpha = 0.5 + 0.5 * Math.sin(frameRef.current);
        });

        return () => {
            scene.onBeforeRenderObservable.remove(observer);
            line.dispose();
        };
    }, [scene, id, from.x, from.y, from.z, to.x, to.y, to.z]);

    return null;
}
