import React, { useMemo } from 'react';
import { Effect } from '@babylonjs/core';

interface StarfieldProps {
    seed?: string;
}

const injectStarfieldShader = () => {
    if (Effect.ShadersStore['starfieldVertexShader']) return;

    Effect.ShadersStore['starfieldVertexShader'] = `
        precision highp float;
        attribute vec3 position;
        uniform mat4 worldViewProjection;
        varying vec3 vPositionLocal;
        void main() {
            gl_Position = worldViewProjection * vec4(position, 1.0);
            vPositionLocal = position;
        }
    `;

    Effect.ShadersStore['starfieldFragmentShader'] = `
        precision highp float;
        varying vec3 vPositionLocal;
        uniform float seedFloat;

        // 3D hash for procedural stars
        float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        // Draws smooth sub-pixel anti-aliased dots
        float getStars(vec3 dir, float scale, float density) {
            vec3 p = dir * scale;
            vec3 pFloor = floor(p);
            
            // Random offset within the cell to break the grid pattern
            vec3 offset = vec3(
                hash(pFloor + vec3(17.0)),
                hash(pFloor + vec3(31.0)),
                hash(pFloor + vec3(53.0))
            ) - 0.5;
            
            vec3 pFract = fract(p) - 0.5 - offset * 0.5;
            float dist = length(pFract);
            float h = hash(pFloor);
            
            // Only draw a star if hash is above the density threshold
            if (h > density) {
                // Determine raw intensity 0.0 - 1.0
                float intensity = (h - density) / (1.0 - density);
                // Hard-coded size that guarantees 1-2 pixel rendering in perspective
                // We use intensity to give a slight size variation
                float size = 0.08 + intensity * 0.12; 
                // In orthographic projection, the camera frustum cuts a cylinder out of the sphere
                // If it looks "too big", we adjust the smoothstep blur to make it softer 
                // smoothstep(edge0, edge1, x). If distance is less than size*0.1 (center), alpha is 1.0
                // If distance is at size (edge), alpha is 0.0.
                return smoothstep(size, size * 0.1, dist) * intensity;
            }
            return 0.0;
        }

        void main() {
            vec3 dir = normalize(vPositionLocal);
            // Offset by seed
            dir += vec3(seedFloat * 1.13, seedFloat * -0.27, seedFloat * 0.41);

            // Layer 1: Fine dense stars
            float star1 = getStars(dir, 400.0, 0.95) * 1.2;

            // Layer 2: Medium scattered stars
            float star2 = getStars(dir + vec3(10.0), 200.0, 0.98) * 2.0;

            // Layer 3: Sparse bright stars with varied color
            float star3 = getStars(dir + vec3(35.0), 80.0, 0.995) * 3.0;

            vec3 starColor = mix(vec3(0.6, 0.8, 1.0), vec3(1.0, 0.9, 0.6), hash(floor(dir * 100.0 + vec3(35.0))));
            
            vec3 finalColor = vec3(0.015, 0.02, 0.035) + vec3(star1) * 0.5 + vec3(star2) + starColor * star3;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;
};

export function Starfield({ seed }: StarfieldProps) {
    injectStarfieldShader();

    const seedFloat = useMemo(() => {
        if (!seed) return 0.0;
        let s = 0;
        for (let i = 0; i < seed.length; i++) {
            s = (s << 5) - s + seed.charCodeAt(i);
            s = s & s; // Convert to 32bit integer
        }
        return Math.abs(s) / 2147483647;
    }, [seed]);

    return (
        <sphere name="safe-skybox" segments={32} diameter={4000}>
            <shaderMaterial
                name="starfield-mat"
                shaderPath="starfield"
                options={{
                    attributes: ["position"],
                    uniforms: ["worldViewProjection", "seedFloat"]
                }}
                backFaceCulling={false}
                onCreated={(mat) => mat.setFloat("seedFloat", seedFloat)}
            />
        </sphere>
    );
}
