# Architecture and engineering boundaries

See [MODULES.md](MODULES.md) for the file-by-file map and ownership rules.

## Authority

```text
Quest headset + Touch controllers ── poses/input ─┐
Laptop raiders ─────────────────────── input ──────┼── WebSocket /ws
Spectators ───────────────────────────────────────┘        │
                                                     Node server
                                              per-room Rapier world
                                                 fixed 1/60 s step
                                                        │
                                    reliable entity events + 20 Hz snapshots
                                                        │
                                     interpolated Three.js clients / WebXR
                                     + local raider prediction (replayed inputs)
```

Only the server decides movement, collision, shooting, damage, deaths, support loss, load
failure and physical body transforms. Rendering is never a source of collision authority. The
client simulations are: disposable particles and rubble, camera prediction, and a predicted copy
of the local raider that runs the **same shared flight model** (`shared/flight.js`) against the
held input at 60 Hz with simple box collision. Every authoritative snapshot re-bases that copy
and replays inputs the server has not consumed yet (`seq`); the residual error decays visually
over ~100 ms. There is no rewind hit validation or rollback of remote entities.

Local Quest hand/head rendering follows the current XR pose directly; a tracked hand crossing an
intact bay shows dust and a haptic tick immediately, but hit registration still uses bounded
poses on the server. The desktop giant camera is dead-reckoned from the held input.

The tracked controller's grip-space position defines its spherical hand. The head position and
yaw define the giant silhouette. Raiders are dynamic capsules approaching a target velocity;
no client position command bypasses physics. Inputs are sanitised, poses are bounded, stale
input expires, and stale tracking never extrapolates a punch. This limits accidents and exploit
severity but is not anti-cheat: a client can fabricate plausible poses.

## Fixed step and timestamps

60 Hz accumulator, at most eight catch-up steps per timer callback. Snapshots every three
steps. Round resets send a fresh welcome before the reset event; clients clear interpolation
history and instances. Remote interpolation targets ~100 ms behind the newest state.

Step order per tick: giant (locomotion, hand sweeps, torso shove) → raiders (flight, rifle,
rocket) → missiles → `world.step` → collision events (debris↔raider knockdowns, debris↔bay
damage, secondary fracture, crumble) → debris lifecycle and debris↔giant damage → due structural
failures → new failure scheduling for dirty buildings → batched skin events → ragdoll expiry →
end-of-round check.

## Transport

Control messages are JSON: join, input, pose, restart, ping. Entity and gameplay events are
reliable JSON on the same ordered socket. Transforms use the versioned little-endian binary
snapshot **COL3** (`shared/protocol.js`):

| Component | Bytes |
| --- | ---: |
| Header, boss state, stagger, towers down | 100 |
| One raider (incl. `seq`, rocket cooldown, score) | 64 |
| One chunk or ragdoll body | 32 |

At 144 chunks + 8 × 11 ragdoll parts + 8 raiders a snapshot is 8,036 bytes, ~161 KB/s per
client at 20 Hz before overhead. Sleeping bodies are still included until removed.

Reliable events: `debris`, `remove`, `crumble` (a bay or chunk became cosmetic rubble),
`skin` (batched `[id, glassMask, facadeMask]` changes), `strike` (a bay was hit; material,
power, whether its frame failed), `creak` (a building has overloaded columns), `towerdown`,
`combo`, `stomp`, `closecall`, `gianthit` (kind `debris`/`rocket`, damage), `shot`,
`missile` and `detonate` (both carry `owner`: 0 for the giant, otherwise the raider who fired),
`dodge`, `rag`, `kill`, `impact`, `end` (with scoreboard), `reset`.
Welcome packets carry cleared cells, damaged skins, live chunks, ragdolls, missiles and the
roster so late joiners see the same city.

Outgoing buffers above 128 KiB skip snapshots; above 1 MiB the client is dropped. Input is
limited to ~30 messages/s per client (server ceiling 100/s, 8 KiB). Same-origin WebSocket
policy, join timeout and heartbeat as before. The room code is an invitation, not
authentication.

## Structural destruction

The district (`shared/city/layout.js`) is a grid of avenues and streets with 24 towers built
from **tiers** on one integer bay grid (setbacks keep support continuity). Every bay is a hollow
storey: slab + four corner columns + exterior skins. 2,543 bays, ~16,500 static colliders,
attached to one fixed body per building so bays can be removed individually.

Each exterior wall has up to two **skin layers** over the frame, by material
(`shared/city/materials.js`): a *curtain wall* is all glass on a steel frame; *brick*, *stone*
and *concrete* have windows plus a facade. `damageCell(energy, sides)` pops glass first (cheap),
then cracks the facade (which shields the frame while it stands), then reduces the frame's
structural HP. Lower storeys have stronger frames (`frameScale`). A broken solid layer becomes an
**opening**: its collider is removed, raiders and missiles pass through, and the client hides that
instance and throws shards/bricks.

**Integrity** has two parts. Graph support (`unsupportedCells`): bays with no path to a
foundation. Load (`structuralLoads`): weight flows down each stack; a bay whose support below is
gone hangs from lateral neighbours up to three bays away, splitting its load among the nearest
supported bays; capacity is `(stack + 1) × material safety × frameHP ratio`, so damaged columns
carry less. Overloaded bays are scheduled to fail after `COLLAPSE_DELAY` (+ jitter) with a
`creak`, which makes cascades read as progressive collapse. A failed column is **crushed into
rubble** immediately (never a body that could keep propping the storeys above).

Detachment: kicked bays fly as single chunks; a severed section becomes **one rigid island per
building** (floors when small) so towers topple and pancake. Islands receive an angular velocity
about the far edge of whatever still stands beneath them (`topple`). On a hard landing an island
splits into floor bands, bands into bays, and a lone bay that lands hard **crumbles** (body freed,
cosmetic rubble on clients). Falling chunks damage bays they hit (domino collapses) and hurt the
giant when they land on its head or core (`DEBRIS_GIANT_DAMAGE`, capped), which staggers it and
exposes the core (+60 % rifle damage while staggered). The giant's torso shoves through
bays it walks into and is slowed by them.

Budgets: 144 chunk bodies (coarse per-building islands under pressure, deferred breaks at the
cap), eight ragdolls. Limits: graph/load are still a game model, not FEA — no bending moments,
fatigue, rebar or arbitrary cracks; bays are rigid compounds; no self-collision on ragdolls.

## Rendering

Quality tiers (`src/render/quality.js`) are chosen from the GPU string once: `quest`, `low`
(integrated GPUs), `medium`, `high`. Lower tiers use Lambert shading for opaque surfaces,
no normal maps, no shadows, no bloom, pixel ratio 1, a low-poly skyline ring and smaller
particle/rubble pools; `Q` toggles cinematic extras. Adaptive resolution lowers the pixel ratio
when the frame-time EMA exceeds 20 ms and raises it back below 12.5 ms (never in XR; hidden tabs
are ignored). `?quality=low|medium|high|quest` forces a tier for profiling.

The towers render as instanced batches regardless of city size: one frame batch (slab + open
prism columns), one facade batch per masonry material, one glass batch per material, one roof
batch, plus roof props and spires attached to their bays. Broken layers get a zero matrix.
Debris posing, snapshot sampling, rubble and HUD updates avoid per-frame allocation.

XR uses the tier's framebuffer scale (0.8 on Quest) and foveation; the camera is never shaken
(haptics and a camera-locked red vignette carry damage instead). Do not mistake desktop FPS for
headset FPS: `npm run profile` measures a laptop GPU with a visible Chromium; the Quest needs a
device.

## Scaling and operations

One process owns all rooms; exactly one Fly Machine. World creation with 16,500 colliders takes
a few hundred milliseconds per room/round on a laptop. No persistence, accounts or reconnect
identity. First escalation after measurement: delta/prioritised snapshots, worker processes per
room, deliberate room routing, then WebRTC.
