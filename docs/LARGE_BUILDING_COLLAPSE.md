# Large-building collapse performance

September 12, 2026. This fixes the browser-side allocation and preparation burst
when destruction of the lower supports releases a complete tower. Server physics,
fragment IDs, fragmentation recipes, damage and rubble persistence are unchanged.

## Reproduction and results

`scripts/collapse-profile.mjs` destroys the entire ground floor through the server's
granular collapse path and records 600 actual physics ticks. The browser replay uses
those authoritative events, renders each frame, checks for lost WebGL contexts and
verifies that every fragment is retained. Measurements below are local Mac/Chromium
observations, not physical Quest frame rates.

| Workload | Before | After |
| --- | ---: | ---: |
| WTC, checkpoint with 14,844 retained fragment groups: allocated geometry buffers | 209.69 MiB | 35.16 MiB |
| Same checkpoint: rendered triangles | 1,247,644 | 1,247,644 |
| Same checkpoint: browser-reported JS heap before forced collection | 661.57 MiB | 296.21 MiB |
| WTC initial foundation event processing | 213.6 ms | 1.4 ms |

The geometry-buffer reduction is 83.2%, including the new index buffers. Before,
all geometry was non-indexed: the recorded capacity of 4,997,120 vertices used
44 bytes per vertex. The original baseline stopped at this checkpoint to avoid
exhausting the host. Heap readings also include temporary garbage; they are not
equivalent to GPU memory or total browser process memory.

The final WTC replay completed all **270 sections and 22,736 fragment groups**.
It used 49.72 MiB of geometry buffers and approximately 224 MiB of retained page
heap after collection. Preparing the final collapse took 145 render frames; the
server released it across 131 physics ticks. Preparation slices peaked at 3 ms
in this run; total per-frame update work peaked at 8.1 ms. These figures do not
include the worker's CPU time and do not represent total frame time.

The larger **One Vanderbilt** replay also completed all **424 sections and 21,409
fragment groups**, without missing fragments, worker failures or context loss.
Its many distinct tapered floors use 170.55 MiB of geometry buffers and about
407 MiB of retained page heap. It remains a substantial rendering workload:
the final view draws about 2.65 million triangles and took approximately 18.6 ms
in the measured render call. This fix does not claim a guaranteed headset frame
rate or reduce the geometry to reach one.

Reports: `artifacts/optimization/collapse-before/`, `collapse-final/` and
`collapse-vanderbilt/`. The server event input for the final WTC replay lives in
`collapse-before/events.json`; the renderer report lives in `collapse-final/client.json`.

## Implementation

- Share sources and clipped fragments only when their complete authored inputs
  match, including geometry, transformations, materials, tint, roof attachments
  and fracture groups. Unique landmark floors retain their unique geometry.
- Prepare full collapses in a module worker, with one request in flight and an
  eight-source cache. An explicit readiness handshake prevents the first request
  from being lost during asynchronous module loading. Worker errors and timeouts
  fall back to preparation spread across frames.
- Install the returned geometry under a cooperative 2 ms Quest / 3 ms desktop
  budget. Continue displaying the falling original section until all its fragments
  are ready, then switch them together. Apply authoritative pose and settlement
  updates even while their geometry is pending. Regular local hits stay immediate.
- Index exactly equal complete vertices, retaining UV seams, normals, colors,
  triangle order and cut faces. Share cached vertex arrays with their render-buffer
  storage, refreshing those views after growth and compaction. Released cache
  entries regenerate when needed instead of keeping obsolete buffers alive.
- Page opaque geometry in blocks of at most 65,536 vertices (a single larger
  authored draw can occupy its own larger page). Retain one globally sorted batch
  for transparent fragments so glass blending remains unchanged.
- Discard temporary cutting surfaces after a section fully collapses. Unloading
  releases empty pages; reset/disposal cancel workers and pending geometry. Shader
  warmup now waits for compilation before disposing the material being compiled.

## Verification

- Full test suite: 220 passing, including the eight collapse regression cases
  covering buffer views, worker startup, room uptime, cancellation and cleanup.
- Normal destruction render checks pass for brick, glass, stone and concrete,
  including original appearance, reassembled pieces, openings and reset.
- Stereo rubble rendering matches the unculled reference with zero differing
  pixels, retaining all 480 fragments in that comparison.
- The WTC replay compares background-worker output against synchronous cutting
  for three fragments across the tower, checking every vertex attribute and index.
  Resetting with a worker request in flight leaves no pending jobs, templates,
  fragments or geometry pages.
- The latest multiplayer browser smoke run passed desktop controls, real networking
  and physics, emulated Quest stereo/tracking, replicated missile firing, additional
  client joining/HP scaling, and all three spectator video connections, with no
  browser errors. Its simultaneous spectator-video throughput assertion then failed.
  This was reported to the concurrent render-distance task; the complete multiplayer
  smoke run is not being reported as passing. An earlier run at the temporary longer
  render distance had timed out loading the additional client; that timeout did not
  recur with the revised 150 m distance.

Reproduce with:

```sh
node scripts/collapse-profile.mjs artifacts/optimization/collapse-wtc
node scripts/collapse-render-profile.mjs artifacts/optimization/collapse-wtc
node scripts/collapse-profile.mjs artifacts/optimization/collapse-vanderbilt vanderbilt
node scripts/collapse-render-profile.mjs artifacts/optimization/collapse-vanderbilt
node --test tests/collapse-rendering.test.js
```
