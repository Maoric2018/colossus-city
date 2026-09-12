# Local destruction, rendering and streaming optimization

September 12, 2026. This continues the earlier fine-destruction pass while preserving
the concurrent building-detail, soaring-effects and Colossus-death changes.

## Measured results

The comparison baseline is `a51a919`, including the same generic-building cleanup.
It ran in an isolated temporary checkout with the same assets and dependencies.
These are local Mac/Chromium measurements, not physical Quest frame rates.

| Workload | Before | After |
| --- | ---: | ---: |
| One structural cut in a 20-storey, 3×3-bay building: median across seven runs after warmup | 0.990 ms | 0.473 ms |
| Additional live collision shapes after that cut | 334 | 62 |
| Collision shapes on an untouched floor after that cut | 17 | 1 |
| Same city view: rendering submissions with original instancing / material batching | 134 | 95 |
| Same street view: rendering submissions with original instancing / material batching | 148 | 99 |
| 20 successive cuts including GPU-buffer replacement: median warm-run CPU total | 13.5 ms | 9.3 ms |

The structural fixture removes one identical piece and retains one identical fragment
group in every run. Its approximately 52% reduction in hit-processing time is specific
to this fixture. The 20-cut measurements precede the final transparent-material fix;
the structural and batching comparisons are independent of that fix.

The batching comparison switches renderers inside the same scene. No pixels exceeded
the comparison tolerance (sum of RGB differences greater than 9); the largest mean
channel error was 0.0000049 on the 0–255 scale. Returning to the optimized renderer
restored identical pixels. This isolates batching from the other task's art changes.
Per-object culling also avoids submitting invisible geometry.

The cooperative streaming check loaded the complete detailed neighborhood. Its largest
observed construction slice was 3.6 ms with a 3 ms target. A single indivisible job can
exceed the target; this is a cooperative deadline, not a hard real-time guarantee.

Reports are in `artifacts/optimization/locality-before/` and `locality-after/`.

## Changes

- **Localized collision expansion:** split the affected storey out of continuous
  column runs, retaining the original slopes and spans elsewhere. Floor slabs still
  split into per-bay shapes when damaged. Support, collision groups and solver settings
  remain the same. Static support maps and floor ordering are cached between load checks.
- **Localized visual updates:** cache standing surfaces and their geometry by material,
  wall side and layer. Retain GPU allocations for unchanged sections. Transparent walls
  retain their joint draw order to preserve blending. Glass keeps its authored back-face
  reflectivity; the solid-interior shader previously recolored intact panes after damage.
- **Architectural material batches:** share exact component geometry within material
  and district batches, retaining stable identities, transforms and per-object culling.
  Browsers without `WEBGL_multi_draw` use the existing instanced path. Empty batch caches
  are bounded and released on disposal.
- **Cooperative streaming:** construct contact caches and component registrations in
  small jobs under a 2 ms Quest / 3 ms desktop target. Prioritize blocks toward estimated
  travel direction. Activate a block after construction and saved damage restoration.
  Cancel staged blocks on travel, reset or landmark replacement. Worker-side serialized
  templates retain up to 12 blocks / 12 MiB for revisits, independent of mutable client data.
- **First-use rendering:** prepare fracture shaders and ready textures during browser
  idle periods, retain the compiled programs, and isolate optional warmup failures.
  Draw the sky after opaque geometry so covered sky pixels can fail the depth test.
- **Persistent rubble selection:** index fine fragments and damaged bays spatially;
  update visibility only for nearby or previously visible entries. Moving pieces update
  their index positions. Fragment count, persistence, geometry and motion are preserved.
- **Network relevance:** opt-in clients receive every nearby body pose at normal cadence,
  with a speed and debris-size margin. Distant poses are spread across one second.
  Spectators and legacy clients retain full snapshots. Reliable destruction, spawn and
  settlement events remain complete.
- **Lossless damage deltas:** opt-in peers send newly removed IDs against verified prior
  state. Welcome, block state and reset seed/invalidate that history. Missing state requests
  a full authoritative fracture event. History is bounded to 2,048 cells per peer.
- **Long shots:** walk every crossed grid cell, stop at the first actual obstruction,
  and use conservative building/roof bounds to reject empty air before loading physics.
  Archived rubble is included even when it lies outside the original building footprint.
  Final hits still use the original authoritative Rapier query.

## Validation

- The combined suite passed 208 tests at the final integration checkpoint; the subsequent
  archived-road-rubble case and relevant ray/streaming tests were checked separately.
- 173 JavaScript modules passed syntax/import validation at that checkpoint.
- Brick, glass, stone and concrete pass rendered appearance, reassembled fragments,
  physical openings, finite geometry and reset checks. The intact glass reconstruction
  has zero changed pixels; the damaged/reassembled glass case remains within the existing
  tolerance. The same baseline check exposed the old back-face recoloring issue.
- All 480 persistent test fragments survive camera reversals and stereo selection with
  zero pixel difference against rendering every fragment.
- Detailed streaming, returned damage, landmark openings, giant-scale fog and stereo pass.
- The actual worker revisit test returns the original template after the client mutates
  its first result. Canceled staging leaves no component registrations behind.
- Full multiplayer and emulated Quest browser regression passes with no browser errors.

Reproduction:

```sh
npm run check
npm run test:all
node scripts/locality-profile.mjs . artifacts/optimization/locality-after
node scripts/destruction-render-profile.mjs artifacts/optimization/locality-after
node scripts/locality-smoke.mjs
npm run test:fine-destruction
npm run test:fracture-render
npm run test:streaming
npm run test:browser
```

## Follow-up measurements

Physical Quest CPU/GPU timing, thermal behavior and constrained Wi-Fi remain unmeasured.
Profile sustained soaring, many unique fragments, late joins after long sessions and
multiple busy rooms. Saved-damage restoration and individual GPU uploads can still
exceed a streaming slice. Asset compression, more aggressive particle changes, clipping
workers, unreliable pose transport and separate room workers remain later candidates;
they need targeted measurements and acceptance checks before changing those systems.
