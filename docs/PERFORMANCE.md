# Performance pass — September 12, 2026

Measured against `589d9d1` on an Apple M5 Pro, macOS, Node 22.19.0. The city density,
101-part architectural kit, persistent destruction, collision solver settings and simulation
rates are preserved. These results measure this Mac; they are not Quest 2 FPS claims.

## Rendering and graphics transfers

Headed Chromium uses the actual Apple Metal GPU at 1440 × 900 with `?quality=quest`.
Each scene warms for 24 frames and samples 240 frames. CPU timings include city/effects
updates and issuing the render; they exclude waiting for GPU completion. Both runs use the
same CPU profiler and buffer-upload instrumentation. Camera motion and scene placement are
fixed by `scripts/optimization-profile.mjs`. The forced tier is a desktop proxy, not the
full physical-headset path (which has different fog, HDR resolution and stereo rendering).

| Scene | Mean CPU before → after | p95 CPU before → after | Buffer uploads before → after |
| --- | ---: | ---: | ---: |
| Stationary home view | 1.59 → 1.03 ms | 3.60 → 1.80 ms | 14.40 → 0 MB |
| Turning at home | 1.93 → 1.52 ms | 4.10 → 2.50 ms | 440.86 → 58.33 MB |
| Flying through generated streets | 2.64 → 2.07 ms | 4.60 → 3.50 ms | 135.94 → 32.66 MB |

Transfers cover the complete 240-frame sample, not one frame. Movement/turning uploads
fell 76–87%; mean CPU frame work fell 21–36%. The final street sample had a 12.2 ms CPU
maximum, so this does not promise every individual frame is faster. Browser scheduling,
asynchronous roof loading and detail-selection timing introduce run-to-run variation.

The street scene retained nine detailed generated blocks while its tracked geometries fell
from 238 to 185 and textures from 41 to 35. Empty cosmetic rubble no longer submits
zero-scale triangles. Before/after screenshots were inspected: mean absolute RGB difference
is below 0.004 on a 0–255 scale for all three samples, without changing resolution or detail
budgets. Buffer and scene counts are workload indicators, not VRAM byte measurements.

Changes:

- Visible structural/detail instances keep stable slots; entering/leaving pieces update
  only affected slots. Cached camera/part transforms avoid repeated unchanged work.
- GPU buffers upload only dirty ranges. Pending writes survive multiple scene/capture
  passes; resized buffers preserve old transforms and release replaced storage.
- Empty particle, laser and rubble batches skip draws/uploads. Persistent facade debris
  allocates capacity when damaged and grows without losing settled pieces.
- Block-load queues rebuild at block boundaries. All loaded blocks continue sharing the
  same detail geometry/material batches; stale references to replaced buffers are removed.
- The exact XR spectator mirror reuses the just-rendered stereo visibility. Other cameras
  still select their own geometry.

## Server simulation

The same `scripts/benchmark.mjs` ran sequentially on the baseline and final source, without
a CPU profiler or concurrent browser benchmark. Each scenario uses eight raiders and 900
ticks and measures server step + snapshot only, excluding transport and client rendering.

| Scenario | Mean before → after | p95 before → after | Maximum before → after |
| --- | ---: | ---: | ---: |
| Intact city | 3.29 → 1.88 ms | 3.43 → 1.94 ms | 4.09 → 2.47 ms |
| Six staged collapses and repeated ragdolls | 7.76 → 6.06 ms | 9.37 → 7.23 ms | 30.68 → 27.72 ms |
| Active giant hand contact | 3.76 → 2.22 ms | 4.84 → 3.80 ms | 7.04 → 5.57 ms |

The solver still runs at 60 Hz with the same iterations, CCD and collision events.
Rapier's separate scene-query tree now refreshes only when gameplay queries it, after
invalidation for movement, collider changes or streaming. Idle raiders can sleep; movement
and dodges wake them immediately. Events serialize once per broadcast instead of once per
client. Active firing still requires current query data, so savings vary with gameplay.

The largest staged-collapse spike still exceeds the 16.67 ms tick budget. Large fractures,
new district construction, simultaneous firing and separated players remain useful next
profiling targets. No physics ticks or contact geometry were removed to hide those costs.

## Loading

Brotli/gzip responses and ETag validation reduce transfers on first load and refresh. The
server asynchronously compresses eligible text, models, WASM and HDR files, with a shared
16 MiB / 128-entry cache. JPEG/PNG files are streamed directly. The final cold desktop
Quest-tier sample transferred **7.58 MB for 15.30 MB of decoded resources** across 118
resources, excluding the HTML navigation itself and HTTP headers: about 50% less transfer
through compression. Low tiers also skip four unused normal/roughness maps, avoiding
another approximately 2.32 MB. The raw infinite-city HDR texture is released after its
filtered reflection map is prepared. Actual loading time depends on connection and decode
speed; no cross-device startup-time claim is made.

## Verification and reproduction

- 115 Node tests and 105 syntax/import checks pass. New tests exercise real Rapier lazy
  queries, same-tick wall openings, sleep/wake, render-slot compaction, fragment capacity
  growth, pending GPU writes, compression, HEAD and conditional responses.
- City, streaming, visual, cars, giant-contact, XR-view and full multiplayer/browser smoke
  checks pass. The final loading cleanup was rechecked in desktop and emulated Quest views.
- Both headset eyes, body fading, solid hands, persistent debris, moved/wrecked cars and
  authentic spectator feeds remain correct. Three local feeds presented 24.1–29.4 fps with
  capture-to-display p95 of 61–83 ms; that excludes physical tracking and Wi-Fi latency.
- `npm run quest:check` found no connected headset. Sustained physical Quest 2 FPS, thermal
  behavior and cross-device demo latency still need a headset session.

Run `npm run profile:optimization`, `npm run bench`, `npm run test:all` and the relevant
`test:*` browser scripts. Current reports/screenshots go under `artifacts/`. This pass's raw
render comparisons are in `artifacts/optimization/{before,final}/`; the unprofiled server
baseline is `artifacts/optimization/before-unprofiled/physics.json`. Those generated artifacts
are local and ignored by Git. See `QUEST2_TESTING.md` for the device acceptance procedure.
