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

Local Quest head rendering follows the current XR pose. Hands resolve against a shared cache of the current solid walls, columns, slabs and props, with immediate contact feedback. The authoritative server uses the same oriented sweep, while physical tracking remains the raw input. Skin changes rebuild the cache, and detached/crushed bays leave it so Rapier controls falling debris. The desktop giant camera is dead-reckoned from the held input.

The tracked controller's grip-space position and quaternion define its palm-centered 2.9 × 2.5 × 2.8 m oriented hand box. The head position and
yaw define the giant silhouette. Raiders are dynamic capsules approaching a target velocity;
no client position command bypasses physics. Inputs are sanitised, poses are bounded, stale
input expires, and stale tracking never extrapolates a punch. This limits accidents and exploit
severity but is not anti-cheat: a client can fabricate plausible poses.

## Fixed step and timestamps

60 Hz accumulator, at most eight catch-up steps per timer callback. Snapshots every three
steps. Round resets send a fresh welcome before the reset event; clients clear interpolation
history and instances. Remote interpolation targets ~100 ms behind the newest state.

Step order per tick: giant (locomotion, hand sweeps, torso shove) → raiders (flight, rifle,
breach) → missiles → `world.step` → collision events (debris↔raider knockdowns, debris↔bay
damage, secondary fracture, crumble) → debris lifecycle and debris↔giant damage → due structural
failures → new failure scheduling for dirty buildings → batched skin events → ragdoll expiry →
end-of-round check.

## Transport

Control messages are JSON: join, input, pose, restart, ping. Entity and gameplay events are
reliable JSON on the same ordered socket. Transforms use the versioned little-endian binary
snapshot **COL4** (`shared/protocol.js`):

| Component | Bytes |
| --- | ---: |
| Header, boss state, stagger, towers down, wrist quaternions | 132 |
| One raider (incl. `seq`, breach cooldown, score) | 64 |
| One chunk or ragdoll body | 32 |

At 144 chunks + 8 × 11 ragdoll parts + 8 raiders a snapshot is 8,068 bytes, 161,360 bytes/s per
client at 20 Hz before overhead. Sleeping bodies are still included until removed.

Reliable events: `debris`, `remove`, `crumble` (a bay or chunk became cosmetic rubble),
`skin` (batched `[id, glassMask, facadeMask]` changes), `strike` (a bay was hit; material,
power, whether its frame failed), `creak` (a building has overloaded columns), `towerdown`,
`combo`, `stomp`, `closecall`, `gianthit` (kind `debris`/`heavy`, damage), `shot`, `heavy`,
`missile`, `detonate`, `dodge`, `rag`, `kill`, `impact`, `end` (with scoreboard), `reset`.
Welcome packets carry cleared cells, damaged skins, live chunks, ragdolls, missiles and the
roster so late joiners see the same city.

Outgoing buffers above 128 KiB skip snapshots; above 1 MiB the client is dropped. Input is
limited to ~30 messages/s per client (server ceiling 100/s, 8 KiB). Same-origin WebSocket
policy, join timeout and heartbeat as before. The room code is an invitation, not
authentication.

## Live spectator video

Live views use a separate `/views` WebSocket for room-token authentication, offers/answers, ICE candidates and mode metadata. Only active room spectators can negotiate with human publishers. The video travels directly over WebRTC: a 640 × 400 canvas track, manually requested at up to 30 fps on desktop or 24 fps in XR, with a 1.2 Mb/s sender limit per spectator and a preference to maintain frame rate. Spectators display muted inline video elements; supported receiver buffering hints request minimal delay. Frame callbacks measure delivered fps and optionally estimate capture-to-presentation age. Metadata changes are sent immediately, otherwise once per second. No audio, camera or microphone permission is requested.

Capture exists only while at least one spectator watches; closing/disconnecting releases media tracks and peer connections. XR preserves the actual left-eye projection and matrices, including the in-world HUD, and restores framebuffer, scissor and XR state afterward. Desktop copies its rendered canvas plus a compact HUD. The panel skips the obscured full-screen scene render. AI cameras render locally into their own canvases at up to ten updates/s each, staggered one per animation frame, and are explicitly labeled simulated.

After eight seconds without usable video, the viewer requests a per-publisher JPEG fallback. It targets 15 fps, requires publisher and viewer acknowledgements, allows one in-flight image plus one replaceable newest pending image per feed, and discards pending images older than 250 ms. Buffers prevent additional image sends under congestion. Slow viewers cannot build an application-level history of frames or force video-capable viewers onto the fallback. Reopening the panel retries video. TCP loss can still delay fallback packets already on the wire.

`VIEW_ICE_SERVERS` configures STUN/TURN (JSON array); the default uses Google's public STUN service. A TURN service is not included. Local USB HTTP forwarding does not forward WebRTC media; Quest and laptop still need a reachable Wi-Fi/ICE path. Use one spectator for the demo to limit per-publisher bandwidth/encoding overhead. Background tabs can suspend rendering; each actual player's game should stay visible on its device. Menus, browser chrome, operating-system overlays and audio are not streamed.

## Giant and raider embodiment

The giant walks at 13 m/s; normal raider flight is 11 m/s. Shared `giant-rig.js` dimensions drive the hand meshes, oriented collision sweeps and laser hitboxes. Wrist quaternions survive pose input, the COL4 snapshot and normalized interpolation. Raw tracked displacement (compensated for artificial yaw) controls strike energy; a contact blocks visible hands immediately and continued physical pressure damages the contacted layers. Entry/recenter/tracking recovery retain their no-attack grace period. The wrist offset attaches the forearm behind the palm; rigid upper/lower armor keeps fixed proportions.

Raiders start in first person. V or the pause-menu button selects the 6.8 m shoulder camera (8.2 m while soaring). Hold either Shift to soar; release both, pause or lose focus to hover. The same armored pilot geometry and named eleven-bone skeleton drive the physical ragdoll, including prone knockdown pose, rifle and flight pack. Blue laser core/glow/pulse meshes and surface effects use authoritative hitscan endpoints.

## Structural destruction

The district (`shared/city/layout.js`) is a grid of avenues and streets with 24 towers built
from **tiers** on one integer bay grid (setbacks keep support continuity). Every bay is a hollow
storey: slab + four corner columns + exterior skins. 2,543 bays. Intact floors share slabs, a column grid and exterior walls on one fixed body per building. Only affected floors/wall sides split into per-bay collision shapes when damaged. Roof equipment and street props retain separate solid proxies; falling debris uses one coarse box per bay plus roof equipment.

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
exposes the core (+60 % rifle/breach damage while staggered). The giant's torso shoves through
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

One process owns all rooms; exactly one Fly Machine. World creation builds the merged structural colliders plus the shared prop and hand caches. Profile creation and round resets on the hosting machine. No persistence, accounts or reconnect
identity. First escalation after measurement: delta/prioritised snapshots, worker processes per
room, deliberate room routing, then a different gameplay snapshot transport. Spectator video already uses WebRTC.
