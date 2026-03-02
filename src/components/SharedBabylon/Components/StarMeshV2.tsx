'use client';
import { Vector3, Color3, Effect, ShaderMaterial, Mesh, AbstractMesh } from '@babylonjs/core';
import React, { useMemo, useRef, useEffect } from 'react';
import { useScene } from 'react-babylonjs';
import { SpectralType } from '@/types/celestial';

const NOISE_GLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100);
    for (int i = 0; i < 5; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}
`;

const SHADER_NAME = "directPlasmaShader";

const injectStarShaders = () => {
    if (Effect.ShadersStore[`${SHADER_NAME}VertexShader`]) return;
    Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = `
        precision highp float;
        attribute vec3 position;
        attribute vec3 normal;
        uniform mat4 worldViewProjection;
        uniform float time;
        varying vec3 vPositionLocal;
        ${NOISE_GLSL}
        void main() {
            vec3 pos = position;
            float d = snoise(normalize(position) * 2.5 + vec3(time * 0.12)) * 0.035;
            pos += normal * d;
            gl_Position = worldViewProjection * vec4(pos, 1.0);
            vPositionLocal = position;
        }
    `;
    Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = `
        precision highp float;
        precision highp int;
        varying vec3 vPositionLocal;
        uniform vec3 baseColor;
        uniform float time;
        uniform int spectralType;
        ${NOISE_GLSL}
        void main() {
            vec3 pos = normalize(vPositionLocal);

            float speedMult = 1.0; float scaleMult = 1.0; float brightness = 1.2; float flare = 0.4;
            if (spectralType <= 1) { speedMult = 2.0; scaleMult = 0.7; brightness = 1.5; flare = 0.5; }
            else if (spectralType == 5 || spectralType == 6) { speedMult = 0.6; scaleMult = 1.5; brightness = 0.9; flare = 0.6; }
            else if (spectralType == 7) { speedMult = 3.5; scaleMult = 0.4; brightness = 1.3; flare = 0.2; }
            else if (spectralType == 8) { speedMult = 10.0; scaleMult = 0.15; brightness = 2.0; flare = 0.8; }
            else if (spectralType == 9) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

            float h = fbm(pos * (4.0 * scaleMult) + vec3(time * 0.1 * speedMult)) * (1.0 - flare) 
                    + fbm(pos * (12.0 * scaleMult) - vec3(time * 0.25 * speedMult)) * flare;

            vec3 low = baseColor * 0.4; if (spectralType >= 5 && spectralType <= 6) low = baseColor * 0.1;
            vec3 high = mix(baseColor, vec3(1.0), 0.8);
            
            vec3 res = mix(low, baseColor, smoothstep(-0.4, 0.2, h));
            res = mix(res, high, smoothstep(0.3, 0.8, h));
            
            gl_FragColor = vec4(res * brightness, 1.0);
        }
    `;
};

// Immediate injection
injectStarShaders();

export interface StarMeshProps {
    id: string;
    spectralType: SpectralType;
    position: Vector3;
    scale: number;
    name?: string;
    onMeshCreated?: (mesh: AbstractMesh) => void;
}

const SPECTRAL_COLORS: Record<string, string> = {
    O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#fbf8ff', G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
    WhiteDwarf: '#e8e8ff', Neutron: '#ffffff', BlackHole: '#111111'
};

export function StarMeshV2({ id, spectralType, position, scale, onMeshCreated }: StarMeshProps) {
    const scene = useScene();
    const coreRef = useRef<Mesh>(null);

    const colorHex = SPECTRAL_COLORS[spectralType] ?? '#fff4ea';
    const color = useMemo(() => Color3.FromHexString(colorHex), [colorHex]);
    const spectralTypeInt = useMemo(() => {
        const typeMap: any = { 'O': 0, 'B': 1, 'A': 2, 'F': 3, 'G': 4, 'K': 5, 'M': 6, 'WhiteDwarf': 7, 'Neutron': 8, 'BlackHole': 9 };
        return typeMap[spectralType] ?? 4;
    }, [spectralType]);

    useEffect(() => {
        if (!scene || !coreRef.current) return;

        injectStarShaders();

        const mat = new ShaderMaterial(
            `star-mat-imp-${id}`,
            scene,
            { vertex: SHADER_NAME, fragment: SHADER_NAME },
            {
                attributes: ["position", "normal"],
                uniforms: ["worldViewProjection", "time", "baseColor", "spectralType"]
            }
        );

        mat.setColor3("baseColor", color);
        mat.setInt("spectralType", spectralTypeInt);
        mat.backFaceCulling = true;

        console.log(`IMPERATIVE: Assigning shader to star ${id}`, { spectralType, spectralTypeInt, colorHex });
        coreRef.current.material = mat;

        let isDisposed = false;
        const observer = scene.onBeforeRenderObservable.add(() => {
            if (!isDisposed) {
                mat.setFloat('time', performance.now() / 1000);
            }
        });

        return () => {
            isDisposed = true;
            scene.onBeforeRenderObservable.remove(observer);
            mat.dispose();
        };
    }, [scene, id, color, spectralTypeInt]);

    return (
        <box name={`star-node-${id}`} position={position} size={0.1} isVisible={false} onCreated={onMeshCreated}>
            <sphere name={`star-core-${id}`} segments={64} diameter={scale} ref={coreRef} />
        </box>
    );
}
