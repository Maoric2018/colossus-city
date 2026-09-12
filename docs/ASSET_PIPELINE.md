# Swapping environments and importing real art

The governing rule is **visual assets do not decide physics**. Client and server share a stable, explicit structural definition. A detailed asset can replace a bay's visuals without replacing its support graph or making simulation hardware-dependent.

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

Export ordinary glTF 2.0 binary `.glb` with embedded textures, PBR metal/rough materials, applied modifiers and sensible normals. Put it under `public/assets/`. The loader uses the local path through `GLTFLoader`. The current app does not instantiate Draco, Meshopt, KTX2 or external decoder workers: either export without those extensions or add and test them explicitly. Do not assume an arbitrary compressed download will load.

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

The fixed collider inherits the prop rotation and uniform scale. It is one box, not an automatically generated triangle mesh, and is not destructible. Omit `collider` only for genuinely decorative content outside active paths. A large decorative mesh placed in the gameplay area with no collider lets raiders fly through it. The camera's analytic occlusion query currently covers structural bays, not optional props; keep bulky props away from tight camera paths or extend that query.

Failed props log a warning rather than blocking the match. Download and host assets locally; the shipped CSP is same-origin. Record the original creator, source page, license and modification requirements alongside the GLB. Many internet assets are not freely redistributable. No unverified external GLBs are bundled with this source release.

## Texture upgrade

Five local generated maps are included. `npm run assets` optionally replaces only asphalt/concrete diffuse maps with 1K CC0 Poly Haven images, preserving `.original.jpg` backups and source records. This does not replace the authored facade atlas or suddenly turn the scene into photogrammetry. A grayscale high-resolution texture does not fix poor geometry/silhouette/material scale.

For a polished art pass, prioritize coherent building proportions, convincing glass/concrete roughness contrast, visible interior structure on broken surfaces, high-quality hero silhouette, and restrained effects. Import fewer, stronger materials instead of hundreds of unique textures. Avoid transparent facade stacks and unnecessary double-sided materials on Quest. Profile before increasing texture size or adding postprocessing.

## Swap acceptance checklist

Load with no console errors; check every texture response; verify all sides and roofs; break a foundation and follow the GLB with its physical chunk; join after the collapse; wait for rubble removal and join again; reset the round; verify collider alignment; compare both a laptop and Quest view; record frame time during maximum rubble. Failed loading should preserve fallback architecture, not invisible collision walls. A successful GLB parse alone is not a successful environment integration.
