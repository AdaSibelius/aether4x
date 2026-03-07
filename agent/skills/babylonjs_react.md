---
name: babylonjs_react
description: How to successfully use BabylonJS within React for Aether4X
---

# BabylonJS + React Integration Guide for AI Agents

This guide documents the critical architecture, "gotchas", and best practices for developing and modifying the 3D visual engine in Aether4X using `@babylonjs/core` and `react-babylonjs`.

## Core Technologies
- `@babylonjs/core`: The underlying WebGL/WebGPU 3D rendering engine.
- `react-babylonjs`: A React renderer for BabylonJS, allowing declarative creation of meshes, lights, and materials.

## The Canvas Setup
A robust React canvas is critical, otherwise, the application will suffer from WebGL context loss or resize bugs when navigating between Next.js routes.

**CRITICAL RULES:**
1. **Conditional Mounting:** Always wait for the component to mount on the client before rendering the `<Engine>` tag. Wrap your main component in a `mounted` state check.
   ```tsx
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return null;
   ```
2. **Absolute Height Constraints:** The Canvas *will* auto-shrink to 0px height if placed inside dynamic flex containers without explicit sizing in React 18 / Next.js. Always give the wrapper element absolute positioning or force `style={{ width: '100%', height: '100%' }}`.
3. **Engine Settings:** Provide `adaptToDeviceRatio={true}` and `antialias={true}` to the `<Engine>` tag for sharp rendering.

## Material & Shader Pitfalls

### Dynamic Textures vs. React Reconciliation
If you generate a `DynamicTexture` on the CPU via a Canvas API (e.g. for procedural starfields):
- **DO NOT** pass the texture instance directly into a declarative tag like `<standardMaterial emissiveTexture={myTexture} />`. React's reconciler will frequently bypass the update, leaving the mesh completely un-textured (resulting in a blank white sphere).
- **SOLUTION:** Assign it imperatively. Create a `useRef<Mesh>(null)` for the sphere, instantiate the `StandardMaterial` inside a `useEffect`, assign the texture to it, and manually attach it to `meshRef.current.material`. Remember to `.dispose()` the material and texture in the cleanup block.

### GLSL Custom Shaders
Custom shaders are vastly preferred over CPU canvas generation for performance.
- Inject raw GLSL code directly into `Effect.ShadersStore["myCustomVertexShader"]` before the React component renders.
- Use `<shaderMaterial name="..." shaderPath="myCustom" options={{ attributes: ["position"], uniforms: ["worldViewProjection", "time", "seed"] }} />`
- Pass data via the `onCreated` callback: `<shaderMaterial onCreated={(mat) => mat.setFloat("time", timeVariable)} />` or by attaching a `onBeforeRenderObservable` loop on the scene.

## Camera UX Constraints
When building ArcRotateCameras to orbit celestial bodies:
- Set `lowerRadiusLimit` and `upperRadiusLimit` to prevent users from clipping the camera *inside* the planet or zooming out so far the object z-indexes pop.
- Configure `wheelPrecision` proportionally to the scale of the object so zooming feels natural (e.g., `wheelPrecision={50 / scale}`).

## Clean Code
- Avoid cluttering the UI with Post-Process Bloom nodes (`<BloomEffect> / <EffectLayer>`) unless carefully tuned, as they often wash out the entire monitor with glaring white light when applied to large emissive bodies like suns. Write the glow directly into the GLSL shader instead!
