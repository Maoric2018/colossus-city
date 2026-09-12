# Swapping environments and importing real art

The governing rule is **visual assets do not decide physics**. Client and server share a stable, explicit structural definition. A detailed asset can replace a bay's visuals without replacing its support graph or making simulation hardware-dependent.

## Bundled visual upgrade

The default district loads the downloaded assets listed in `public/assets/imported/SOURCES.json`. It includes original source pages, pack URLs, transformations, file sizes and SHA-256 hashes. Kenney supplies skyline buildings, vehicles, roof/harbor equipment, rifles, modular rocket parts and effect sprites. Quaternius supplies the weathered Stan mech and armored Spacesuit raider. Poly Haven supplies diffuse, normal and roughness maps plus the HDR sky.

`src/assets.js` caches downloads, bakes source node transforms, grounds models and merges mesh parts by material. `src/district.js` instances repeated props and attaches roof equipment to cell transforms. The attachment uses a rigid cell transform, not the cell's nonuniform geometry scale. Hide/removal/reset and late asset loading all read the current cell state. Imported skyline buildings remain decorative; the playable bays retain their hollow collision geometry and new window trim.

`src/avatars.js` fits the imported armor to the existing tracked head, hands and limb segments. `scripts/prepare-mech.mjs` recreates its rigid armor GLB from the original Stan glTF (download URL in the manifest). The bundled 1K JPEG is derived from Stan's embedded texture. No runtime skinning or animation buffers are needed. Arms use rigid 6 m shells with two-link elbow posing; extreme reaches extend a piston while the fist retains its tracked position. Raiders use a downloaded Quaternius Spacesuit baked into one 10,558-triangle colored mesh by `scripts/prepare-raider.mjs`, with a flight pack and Kenney rifle. Both source forward axes are corrected to game -Z. `src/missiles.js` combines the downloaded rocket base, fuel section and nose into three instanced batches, capped at eight rockets. All 58 bundled files are hash-verified.

The five downloaded effect textures use bounded instanced billboard pools, including camera-facing quads that account for the scaled giant camera. Laser cores, glow and travelling pulses each share one capped instanced mesh; impacts add surface-aligned rings, sparks and smoke. Quest uses 36 skyline buildings, a 1K sky and smaller smoke/spark pools; desktop uses 84 skyline buildings and a 2K sky. Window framing uses flat rails with a modeled ledge. Only changed destruction batches upload transforms.

Run `npm run assets -- --verify` for a local asset-integrity check. `npm run assets` refreshes the photographic texture/HDR files after checking their published hashes, then verifies all bundled files. Run `npm run test:visual` for real Rapier collapse, attachment/removal/reset checks, browser error detection and screenshots. `HEADED=1 npm run test:browser` exercises the art in emulated Quest 2 stereo and desktop gameplay.

## The map contract

`shared/environment.js` exports `city`, the environment registry, and `activeEnvironment`. Both the server and browser import the selected environment. To add a new map, define/register another object and change the single active selection:

```js
const industrial = {
  ...city,
  id: 'industrial-yard',
  name: 'INDUSTRIAL YARD',
  seed: 251,
  buildings: [
    {x: -22, z: -18, nx: 3, nz: 2, floors: 5,
     bay: 4.8, story: 3.2, style: 0, name: 'WORKSHOP 01'},
    {x: 24, z: 20, nx: 2, nz: 2, floors: 8,
     bay: 4.5, story: 3.1, style: 1, name: 'TURBINE HOUSE'}
  ],
  props: [],
  cellAssets: {0: '/assets/industrial-bay.glb'},
  spawns: [[0,1.3,61],[61,1.3,0],[0,1.3,-61],[-61,1.3,0]]
};
export const environments = {'harbor-district': city, 'industrial-yard': industrial};
export const activeEnvironment = environments['industrial-yard'];
```

This is an example to replace the existing registry exports, not a second pair of exports to append. The sample GLB path must point to an asset you actually supply. If it fails to load, the default procedural bay is retained.

One world unit is one small-player-world meter. The giant scale is applied to XR tracking, not by rescaling the whole server world. Buildings are axis-aligned grid structures. A `bay` is its width/depth and `story` is floor height. Style values currently support 0, 1 and 2 for fallback facades. Keep buildings/spawns within the existing play footprint unless you also adjust server arena/altitude limits and scene ground/dressing. `radius` in the environment is descriptive in this version; the actual playable radius is `C.ARENA_RADIUS`.

Changing street topology, land shape, bridge layout or a different environment genre also requires changes to `CityView.makeWorld()` and `makeDetails()`. The structural/asset system is modular; the Harbor background dressing is not a universal terrain generator. Environment choice is server configuration, not an in-lobby per-room selector. Restart the server and reload every client after changes.

## A destructible bay GLB

Author an **unskinned 1 × 1 × 1 hollow bay centered at the origin** in Blender or another modeler. World axes: +Y up, -Z north. Apply object transforms before export and retain named objects. Keep material groups small; each distinct source mesh/material contributes draw calls even when instanced. Use one atlas and a small number of shared materials where possible.

Suggested object layout:

```text
bay_root
  slab          # near y=+0.46, spans bay width/depth
  col_nw        # x≈-0.47, z≈-0.47
  col_ne        # x≈+0.47, z≈-0.47
  col_sw        # x≈-0.47, z≈+0.47
  col_se        # x≈+0.47, z≈+0.47
  wall_n        # z≈-0.48
  wall_e        # x≈+0.48
  wall_s        # z≈+0.48
  wall_w        # x≈-0.48
  roof          # optional roof-only objects grouped below this node
```

`wall_n/e/s/w` and `roof` names are semantic: their descendants are rendered only on exposed sides or the top floor. Other mesh names are drawn on every bay. Slab/column names document your structure but are not individually fractured. Node transforms are retained. No skinned meshes or animated morph targets are supported by the instanced-bay replacement path. It instances ordinary mesh geometry/material per source node.

Export ordinary glTF 2.0 binary `.glb` with local external texture files, PBR metal/rough materials, applied modifiers and sensible normals. Put it under `public/assets/`. The loader uses the local path through `GLTFLoader`. The current app does not instantiate Draco, Meshopt, KTX2 or external decoder workers: either export without those extensions or add and test them explicitly. Do not assume an arbitrary compressed download will load.

The server still uses its hollow slab, column and exterior-wall cuboids. Keep art close to those envelopes. Oversized balconies, diagonal braces and inward protrusions will otherwise look collidable without having matching collision. Extending geometry meaningfully requires extending `cellColliders()` and its tests. A downloaded monolithic tower does not gain physically valid seams merely because a filename is listed in the manifest. Retopologize/split it into bays or design a new pre-fractured structural descriptor.

## Decorative/solid props

```js
props: [{
  url: '/assets/harbor-crane.glb',
  position: [65, 0, 35],
  rotation: [0, Math.PI / 2, 0], // XYZ Euler radians
  scale: 1,
  collider: {
    half: [2, 6, 2],            // unscaled LOCAL half-extents, optional
    offset: [0, 6, 0]           // unscaled LOCAL center, optional
  }
}]
```

The fixed collider inherits the prop rotation and uniform scale. It is one box, not an automatically generated triangle mesh, and is not destructible. Omit `collider` only for genuinely decorative content outside active paths. A large decorative mesh placed in the gameplay area with no collider lets raiders fly through it. The camera and aim queries include structural bays, rooftop equipment, street props and optional prop boxes. Harbor car and rooftop bounds are measured from the bundled models by `scripts/measure-props.mjs`; `shared/props.js` shares their placement and scale with rendering and physics. Cars, lamps, signboards, pavements and bridges are fixed, solid props. Roof equipment is part of its bay's compound collider and follows collapse, splitting and reset.

Failed props log a warning rather than blocking the match. Download and host assets locally; the shipped CSP is same-origin. Record the original creator, source page, license and modification requirements alongside the GLB. Keep texture files next to their GLBs: the current CSP permits local images but does not allow the fetch-to-blob path used for embedded GLB images.

## Texture upgrade

The default environment selects downloaded 1K photographic diffuse/normal/roughness maps through `env.textures`. The facade diffuse, normal and emission atlas remains authored for the destructible bays. Original generated ground textures remain available as alternatives. Normal and roughness maps use linear color space; diffuse maps use sRGB.

For a polished art pass, prioritize coherent building proportions, convincing glass/concrete roughness contrast, visible interior structure on broken surfaces, high-quality hero silhouette, and restrained effects. Import fewer, stronger materials instead of hundreds of unique textures. Avoid transparent facade stacks and unnecessary double-sided materials on Quest. Profile before increasing texture size or adding postprocessing.

## Swap acceptance checklist

Load with no console errors; check every texture response; verify all sides and roofs; break a foundation and follow the GLB with its physical chunk; join after the collapse; wait for rubble removal and join again; reset the round; verify collider alignment; compare both a laptop and Quest view; record frame time during maximum rubble. Failed loading should preserve fallback architecture, not invisible collision walls. A successful GLB parse alone is not a successful environment integration.
