import { ShaderMaterial, Scene, Effect, Color3, Vector3 } from '@babylonjs/core';

// 3D Simplex Noise and FBM functions
const noiseGLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - 0.5;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857; 
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);    

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}
`;

Effect.ShadersStore["highFidelityPlanetVertexShader"] = `
precision highp float;
precision highp int;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 world;

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vPositionLocal;

uniform int planetType;
uniform float seed;

${noiseGLSL}

void main() {
    vec3 wPos = position;

    // Asteroid lumpiness via Vertex Displacement
    if (planetType == 3) {
        // Lower frequency, much higher amplitude for big chunks
        float displacement = fbm(normalize(position) * 1.5 + vec3(seed * 10.0));
        // Push the vertices in or out along their normals (exaggerated)
        wPos += normal * (displacement * 1.5); 
    }

    gl_Position = worldViewProjection * vec4(wPos, 1.0);
    vPositionW = vec3(world * vec4(wPos, 1.0));
    vNormalW = normalize(vec3(world * vec4(normal, 0.0)));
    vPositionLocal = wPos;
}
`;

Effect.ShadersStore["highFidelityPlanetFragmentShader"] = `
precision highp float;
precision highp int;
varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vPositionLocal;

uniform vec3 cameraPosition;
uniform vec3 sunPosition;

// Base configuration
uniform int planetType; // 0 = Terrestrial, 1 = GasGiant, 2 = Volcanic, 3 = Asteroid
uniform int atmosphereType; // 0=None, 1=Thin, 2=Breathable, 3=Dense, 4=Toxic, 5=Corrosive
uniform float time;
uniform vec3 baseColor;
uniform vec3 atmoColor;
uniform float seed;

${noiseGLSL}

void main() {
    // 1. Core normal and view vectors
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(sunPosition - vPositionW);
    vec3 V = normalize(cameraPosition - vPositionW);
    vec3 R = reflect(-L, N);

    // Dynamic scale based on seed
    vec3 noisePos = vPositionLocal * 3.5 + vec3(seed * 10.0);

    float specAmount = 0.0;
    vec3 albedo = baseColor;
    float emissive = 0.0;

    // TERRESTRIAL PLANET (0)
    if (planetType == 0) {
        // Much lower multiplier for massive continents, less spotty "lakes"
        vec3 genPos = noisePos * 0.15;
        float h = fbm(genPos); 
        // Add a low-frequency domain warp to group landmasses
        h += snoise(genPos * 0.5) * 0.5;
        
        bool hasOceans = atmosphereType >= 2 && atmosphereType != 4; // Breathable, Dense (sometimes), Corrosive (acid oceans)
        
        if (hasOceans && h <= 0.1) { // Raised sea level slightly to bury the splotchy valleys
            // OCEAN
            float depth = smoothstep(-1.0, 0.1, h);
            albedo = mix(vec3(0.01, 0.05, 0.15), vec3(0.05, 0.2, 0.35), depth);
            // Toxic/Acid oceans are greenish
            if (atmosphereType == 5) albedo = mix(albedo, vec3(0.1, 0.5, 0.2), 0.8);
            
            specAmount = 1.0; // Highly reflective
            // Tiny wave bumps
            N = normalize(N + vec3(snoise(noisePos * 15.0) * 0.04));
        } else {
            // LAND
            float ele = smoothstep(0.1, 1.0, h);
            vec3 beachColor = vec3(0.7, 0.6, 0.4);
            vec3 landColor = mix(baseColor, vec3(0.15, 0.35, 0.15), 0.6);
            
            // Barren / Unbreathable planets are rocky and match their base color more closely
            // If they are strictly terrestrial and barren, mix with a rusty Mars orange just in case the baseColor is blue
            if (!hasOceans) {
                beachColor = mix(baseColor, vec3(0.8, 0.4, 0.2), 0.5);
                landColor = mix(baseColor * 0.8, vec3(0.6, 0.2, 0.1), 0.6);
            }

            vec3 mountainColor = vec3(0.35, 0.35, 0.35);
            vec3 snowColor = vec3(0.95, 0.95, 0.95);

            if (ele < 0.05 && hasOceans) {
                albedo = mix(beachColor, landColor, ele / 0.05);
            } else if (ele < 0.5) {
                albedo = landColor;
            } else if (ele < 0.8) {
                albedo = mix(landColor, mountainColor, (ele - 0.5) / 0.3);
            } else {
                albedo = hasOceans ? snowColor : mountainColor; // No snow without atmo
            }
            specAmount = 0.0;
            // Bump map using local derivative approximation
            float bumpStrength = hasOceans ? 0.15 : 0.05; // Much lower to prevent self-shadowing micro-pits
            N = normalize(N + vec3(snoise(noisePos * 2.0) * bumpStrength));
        }

        // CLOUDS overlay (soft transparent fbm)
        // Only render clouds on Breathable (2) or greater atmospheres
        if (atmosphereType >= 2) {
            // Extremely low frequency Swirling domain warp for massive weather fronts
            vec3 cloudWarp = vec3(
                snoise(noisePos * 0.05 + vec3(time * 0.005)),
                snoise(noisePos * 0.05 + vec3(time * 0.008 + 100.0)),
                snoise(noisePos * 0.05 + vec3(time * 0.006 + 200.0))
            );
            
            // Massively scaled down high-frequency detail noise (huge, fluffy structures) with the swirling warp applied
            float cloudDetail = fbm(noisePos * 0.2 + cloudWarp * 1.5 + vec3(time * 0.01));
            
            // Extremely low frequency Macro structure to group clouds into continental systems
            float macroCloud = fbm(noisePos * 0.08 - vec3(time * 0.002));
            
            // Multiply detail by the macro-mask to clump the weather systems
            // Map the macro to allow very wide contiguous bands of clouds and huge unbroken gaps
            float macroMask = smoothstep(-0.6, 0.4, macroCloud);
            float cloudNoise = cloudDetail * macroMask;

            float cloudBase = (atmosphereType >= 3) ? -0.2 : 0.02; // Dense/Toxic covers everything, lowered base threshold significantly
            float cloudMult = (atmosphereType >= 3) ? 1.5 : 1.3; // Push core clouds up to solid white
            
            if (cloudNoise > cloudBase) {
                // Tighter smoothstep to give clouds sharper, fluffy edges rather than sheer fog
                float cloudAlpha = smoothstep(cloudBase, 0.4, cloudNoise);
                vec3 cColor = vec3(1.0);
                if (atmosphereType == 4 || atmosphereType == 5) {
                    cColor = vec3(0.6, 0.8, 0.4);
                }
                albedo = mix(albedo, cColor, cloudAlpha * cloudMult);
                specAmount *= (1.0 - cloudAlpha); // Clouds block specularity
            }
        }
    } 
    // GAS GIANT (1)
    else if (planetType == 1) {
        // Severe banding distortion on Y axis
        vec3 gPos = vec3(vPositionLocal.x, vPositionLocal.y * 8.0, vPositionLocal.z);
        // Add swirling storms
        float storm = snoise(gPos * 2.0 + vec3(time * 0.02));
        float band = sin(vPositionLocal.y * 15.0 + fbm(gPos) * 3.0);
        
        float bandAlpha = smoothstep(-1.0, 1.0, band);
        albedo = mix(baseColor, baseColor * 1.5, bandAlpha);
        albedo = mix(albedo, vec3(1.0, 0.9, 0.7), smoothstep(0.5, 1.0, storm) * 0.5); // Add storms
        specAmount = 0.1; // Matte
    }
    // VOLCANIC (2)
    else if (planetType == 2) {
        float h = fbm(noisePos * 1.5);
        if (h < -0.2) {
            // LAVA LAKES
            albedo = vec3(0.8, 0.2, 0.0);
            emissive = 1.0; // Glows in the dark
        } else {
            // ROCK
            albedo = mix(vec3(0.1), vec3(0.2, 0.1, 0.1), h);
            specAmount = 0.05;
            N = normalize(N + vec3(snoise(noisePos * 6.0) * 0.3));
        }
    }
    // ASTEROID / DWARF (3)
    else {
        float h = fbm(noisePos * 2.0);
        albedo = mix(vec3(0.15), vec3(0.35), h * 0.5 + 0.5);
        specAmount = 0.05;
        N = normalize(N + vec3(snoise(noisePos * 8.0) * 0.5)); // Heavy crater/rock bumps
    }

    // 2. Compute Lighting (Phong)
    float diffuse = max(dot(N, L), 0.0);
    // Add ambient term so the dark side isn't pitch black
    float ambient = 0.08;
    
    float specular = 0.0;
    if (diffuse > 0.0) {
        float specPower = pow(max(dot(R, V), 0.0), 32.0);
        specular = specPower * specAmount;
    }

    // 3. Atmosphere (Fresnel rim light)
    float fresnel = 0.0;
    if ((planetType == 0 && atmosphereType > 0) || planetType == 1) {
        vec3 smoothNormal = normalize(vNormalW);
        fresnel = pow(1.0 - max(dot(smoothNormal, V), 0.0), 3.0);
        // Fade fresnel out on the dark side, but let some bleed for a twilight effect
        float terminatorAlpha = smoothstep(-0.2, 0.2, dot(normalize(vNormalW), L));
        fresnel *= terminatorAlpha;
    }

    vec3 finalColor = albedo * (diffuse + ambient) + (vec3(1.0) * specular) + (atmoColor * fresnel);
    
    // Add Volcanic Emissive glow (ignores lighting)
    if (emissive > 0.0) {
        // Pulse lava with time
        float pulse = sin(time * 2.0 + vPositionLocal.x * 10.0) * 0.5 + 0.5;
        finalColor += vec3(1.0, 0.3, 0.0) * 0.8 * pulse;
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export function createHighFidelityPlanetMaterial(name: string, scene: Scene, planetType: 0 | 1 | 2 | 3, atmosphereType: number, baseColor: Color3, atmoColor: Color3, seed: number, sunPosition: Vector3 = Vector3.Zero()): ShaderMaterial {
    const mat = new ShaderMaterial(
        name,
        scene,
        {
            vertex: "highFidelityPlanet",
            fragment: "highFidelityPlanet",
        },
        {
            attributes: ["position", "normal", "uv"],
            uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "cameraPosition", "sunPosition", "planetType", "atmosphereType", "time", "baseColor", "atmoColor", "seed"],
        }
    );

    // Initial constants
    mat.setInt("planetType", planetType);
    mat.setInt("atmosphereType", atmosphereType);
    mat.setColor3("baseColor", baseColor);
    mat.setColor3("atmoColor", atmoColor);
    mat.setFloat("seed", seed);

    // dynamic light
    mat.setVector3("sunPosition", sunPosition);

    // Update variables every frame
    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
        time += scene.getEngine().getDeltaTime() / 1000;
        mat.setFloat("time", time);
    });

    return mat;
}
