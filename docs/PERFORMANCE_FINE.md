# Fine-destruction performance pass — September 12, 2026

This pass reduces repeated collision, geometry and network work while preserving the
authored building surfaces, exact holes, fragment identities, persistent rubble and
existing physics/detail budgets. It was coordinated with the separate driving, street
and viewing-distance work in the same checkout.

## Matched measurements

The pre-pass workspace snapshot and optimized source ran the same fixed workloads on
this Mac with Node 22.19.0 and Chromium. Each workload runs four times; the first is warmup.
These are CPU/workload measurements, not physical Quest frame rates. Concurrent project
changes to streets and viewing range are not credited as optimization gains.

| Workload | Before | After |
| --- | ---: | ---: |
| 20 progressively enlarged cuts: median total geometry CPU time across warm runs | 84.3 ms | 18.9 ms |
| Geometry CPU time per cut, median / p95 across warm runs | 4.6 / 6.0 ms | 0.9 / 1.3 ms |
| 30 wall hits followed by 600 physics ticks: median warm-run p95 step | 4.52 ms | 3.65 ms |
| Largest physics tick observed across the three warm runs | 18.23 ms | 5.96 ms |
| Most scene-query refreshes in a settlement tick | 17 | 1 |
| Reliable destruction payload for the same 768 pieces in 240 groups | 108,115 bytes | 78,976 bytes |

The geometry workload is about 80% faster and the measured event payload is 26.95%
smaller. The server still retains all 240 groups after settlement in every run. The
30-hit burst itself only improved modestly: median warm-run total 29.67 → 27.66 ms;
new geometry and first-time collider construction still cost work.

A separate reuse stress case creates 480 instances of the same authored fragment.
All 480 remain present. Stored geometry falls from 106,560 vertices to 222, and creation
fell from 234.3 ms to 3.2 ms in the final matched run. This deliberately measures
repeated geometry; 480 different new fragments will not get that reuse factor.

The baseline's complete repeated-replacement path failed on the second cut with
`THREE.BatchedMesh: Reserved space request exceeds the maximum buffer size.` The optimized
path completes all 80 replacements. Geometry-only timing above runs independently of
that buffer failure, so it compares the same complete 20-cut workload on both versions.

The exact shadow fixture has zero changed pixels compared with the previous main-pass
caster behavior and submits fewer triangles. This checks appearance, not a general GPU
speedup claim. The real worker produces the same generated cells and component placements
as synchronous preparation; integration checks cover streaming and damage restoration.

## Changes and boundaries

- **Physics:** cache unchanged per-cell/per-surface colliders; update only newly hit
  surfaces; recalculate structural loads only when strength changes. Fully released cells
  skip rebuilding colliders that would immediately be removed. Query support for all
  settling/resuming fragments before mutating bodies, avoiding repeated scene-query
  rebuilds. Solver rate, contact geometry, CCD and active/resting debris caps are preserved.
- **Cut geometry:** incrementally subtract new cuts, cache exact cross-sections, reject
  nonintersecting polygons early and preallocate output arrays. Reordered or reset damage
  rebuilds safely. Cut faces preserve original colors, normals, UVs, disconnected members
  and hollow interiors.
- **Fragment storage:** bounded caches share immutable geometry among identical fragment
  instances. Reference counts keep live geometry until its final instance is removed.
  Empty batches recycle safely when Three's compaction leaves its allocation cursor at
  the old end. No fragments are removed to meet the optimization target.
- **Visibility:** a spatial index narrows architectural-detail candidates before the same
  exact distance/stereo tests. Intact structure has separate exact shadow instances so
  off-camera core geometry need not enter the color pass. Clipped structure retains its
  shadow flag. Planar glass uses a single double-sided pass. Roof dressing follows bay
  visibility, movement and destruction, retaining nearby off-camera shadow casters.
- **Travel:** one optional module worker prepares generated cells and component placements
  for queued blocks. Scene/GPU construction remains on the main thread. Teleports or worker
  failure use the original synchronous path; reset/unload/landmark replacement ignores
  stale results. The separately requested final range is 150 m on both Quest and desktop, with
  up to 49 detailed blocks and no simplified distant ring.
- **Network:** opt-in `eventFormat:1` packs shard event rows and consecutive piece IDs
  without quantization or dropped events. Original objects and order are restored before
  dispatch. Legacy peers and COL6 snapshots remain compatible. Remote interpolation starts
  at 100 ms and adapts within 60–150 ms to measured arrival jitter; local prediction remains
  unchanged.
- **Spectators:** optional capture yields when the current frame is full and budgets its
  average CPU cost. Normal load keeps 24 fps XR / 30 fps desktop ceilings; under pressure
  the mirror may reduce cadence and source resolution. The player's rendering and
  destruction detail are preserved. This is a CPU heuristic, not a GPU timer.

## Verification and reproduction

- All 198 Node tests and 156 syntax/import checks passed at the integration checkpoint.
- Real-browser brick, glass, stone and concrete checks pass for visible/physical holes,
  reassembled appearance, exact source colors, finite geometry and round reset.
- All 480 fragments survive opposite-camera and stereo culling with zero changed pixels
  against rendering every instance.
- Imported-art browser checks pass for downloaded roof equipment following actual Rapier
  movement, removal and reset; equipment visibility also has a stereo/return regression.
- Full multiplayer and emulated Quest smoke passes, including tracking recovery,
  controller actions, VR re-entry, late participants and live spectator/fallback feeds.
  The passing local run presented 23.94–29.85 fps with capture-to-display p95 of 39–78 ms.
  A heavier headed run activated the capture budget; that feed reduced its own cadence.
- The separately requested doubled-distance streaming check passes: up to 25 detailed
  blocks, both eyes, returned damage, landmark openings and radial fog under giant scale.

```sh
npm run check
npm run test:all
npm run profile:destruction
npm run profile:destruction-render
npm run test:fine-destruction
npm run test:fracture-render
npm run test:visual
npm run test:streaming
npm run test:browser
```

Raw matched reports and screenshots are under
`artifacts/optimization/fine-before/` and `artifacts/optimization/fine-after/` (local,
ignored by Git). Browser integration reports are also under `artifacts/`.

First impacts, large new collapse surfaces, main-thread GPU uploads and block construction
can still cause spikes. The worker does not move rendering or physics off their owning
threads, and reliable WebSocket transport can still stall under packet loss. No physical
Quest was measured in this pass; use [QUEST2_TESTING.md](QUEST2_TESTING.md) for sustained
headset, thermal, Wi-Fi and comfort acceptance.
