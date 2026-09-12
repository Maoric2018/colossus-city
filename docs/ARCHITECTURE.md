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

Step order per tick: physics block streaming → giant (locomotion, hand sweeps, torso shove) → raiders (flight, rifle,
breach) → missiles → `world.step` → collision events (debris↔raider knockdowns, debris↔bay
damage, secondary fracture, crumble) → debris lifecycle → due structural
failures → new failure scheduling for dirty buildings → batched skin events → ragdoll expiry →
end-of-round check.

## Transport

Control messages are JSON: join, input, pose, restart, ping. Entity and gameplay events are
reliable JSON on the same ordered socket. Transforms use the versioned little-endian binary
snapshot **COL6** (`shared/protocol.js`):

| Component | Bytes |
| --- | ---: |
| Header, boss state, stagger, blocked walking, towers down, wrist quaternions, maximum HP | 140 |
| One raider (incl. `seq`, breach cooldown, score) | 64 |
| One chunk, ragdoll part or moving car | 32 |

At 144 legacy chunks + 96 fine fragment groups + 8 × 11 ragdoll parts + 37 awake cars + 8 raiders a snapshot is 12,332 bytes,
246,640 bytes/s per client at 20 Hz before overhead. Sleeping cars and settled structural
debris send reliable final poses and leave the repeated snapshot list.

Fine destruction uses `fracture` (cell and removed piece IDs), `shards` (small debris group with piece IDs and pose), and `fine-collapse` (fully released cells). Welcome and block states retain the same identities, including resting fragments. Unsupported fine sections release two bays per tick; intact sections remain visible until release. See [FINE_DESTRUCTION.md](FINE_DESTRUCTION.md).

Reliable events: `debris`, `remove`, `crumble` (a bay or chunk became cosmetic rubble),
`skin` (batched `[id, glassMask, facadeMask]` changes), `strike` (a bay was hit; material,
power, whether its frame failed), `creak` (a building has overloaded columns), `towerdown`,
`combo`, `stomp`, `closecall`, `gianthit` (kind `heavy`, damage), `shot`, `heavy`,
`missile`, `detonate`, `dodge`, `rag`, `kill`, `impact`, `end` (with scoreboard), `reset`,
`car-state` and `car-explode` (both carry `id`, `prop`, `p`, `q`, `wreck`, `sleeping`, `removed`
and remaining `burn` seconds). Welcome packets carry cleared cells, damaged skins, live and
settled chunks, ragdolls, missiles, cars and the roster so late joiners see the same city.

`block-load` and `block-unload` carry `key`, `x`, `z`, building `indices`, damaged `skins`, `clearedCells` and debris `entities`. Welcome `blocks` includes active generated blocks and archived damaged blocks. These events use JSON; streamed cell IDs can exceed 32 bits. The COL6 binary body-ID fields are unchanged; COL6 adds the authoritative `bossMaxHP` float after the wrist quaternions, increasing the fixed header to 140 bytes. Clients must refresh when upgrading from COL5.

`server/cars.js` owns 37 CCD dynamic vehicle bodies in the reserved `0x40000000` ID range. Shared
`cars.js` supplies intact and crushed box dimensions for physics, camera and prediction.
Vehicles replace the old fixed car proxies. Resolved hand sweeps, foot-level movement and
missile impacts apply impulses and damage; destructive hits emit one explosion and shrink
the collider to the persistent crushed model. Sleeping wrecks remain dynamic so later hits
can move them again. Car explosions are visual effects and never call colossus damage.

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

The colossus has 2,600 maximum HP per raider, with a one-raider minimum: 2,600 / 5,200 / 10,400 / 20,800 HP for one / two / four / eight raiders. The roster includes practice drones and dead or ragdolled players awaiting respawn; spectators and the giant seat do not count. Joins, departures and bot replacement preserve the remaining health fraction, including zero, so membership changes cannot heal the percentage or revive a defeated giant. A new round restores the scaled maximum. The server sends current and maximum HP together in each COL6 snapshot; desktop, Quest and spectator HUDs share the same clamped fraction.

The giant walks at 13 m/s; normal raider flight is 11 m/s. Shared `giant-rig.js` dimensions drive the hand meshes, oriented collision sweeps and laser hitboxes. Wrist quaternions survive pose input, the COL6 snapshot and normalized interpolation. Inward tracked velocity along the contact normal (relative to the head, compensated for artificial yaw) enables crushing above 0.75 city m/s. `shared/hand-break.js` re-sweeps after each opening, up to 24 surface breaks per hand/pose; it never skips remaining solid geometry when capped or refused. `server/hand-destruction.js` removes the struck wall's remaining glass/facade HP without frame spillover, or detaches a directly struck structural bay. Local resistance is independent of load-bearing cohesion. Untouched surfaces stay intact, and terrain/props still block. Quest uses the same sweep with private 200 ms surface claims, while reliable events alone change the visible city. Claims expire and recenter clears them. Only deliberately moving hands predict breaks; head-relative motion avoids joystick translation attacks. Fresh directly crushed rubble ignores giant-hand contact for 0.18 seconds to prevent a newly spawned solid chunk from receiving a huge kinematic impulse; other rubble and raider contacts remain active. Entry/recenter/tracking recovery retain their no-attack grace period. The wrist offset attaches the forearm behind the palm; rigid upper/lower armor keeps fixed proportions.

`giant-visibility.js` copies only torso/hip/leg materials for each giant instance; arms and hands keep their original materials. The local pilot's view direction smoothly reduces body opacity from 100% at 20° down to 18% at 55° down, with depth writes disabled during the fade. Looking up restores opacity, and nonlocal rendering restores the original material flags immediately. Both XR eyes and the exact spectator mirror use the same appearance. Head pitch stays local; no network payload or collision geometry changes.

Raiders start in first person. V or the pause-menu button selects the 6.8 m shoulder camera (8.2 m while soaring). Hold either Shift to soar; release both, pause or lose focus to hover. The live pilot and physical ragdoll both clone the same armored eleven-bone skinned mesh. `shared/raider-pose.js` composes joint rotations around the original shoulder, elbow, hip and knee anchors: forward head/weapon arm, balancing arm, alternating leg corrections and a knee tuck during flight transitions. Elapsed-time blending gives the same transition duration at different frame rates; the shared match clock drives the loop without extra packets. The locally predicted soaring flag starts the transition immediately. Rifle and flight pack attach to their moving bones, with vectoring nozzle groups and attached jet glows. Knockdowns use the same pose function to initialize the existing physics bodies and joints. Blue laser core/glow/pulse meshes and surface effects use authoritative hitscan endpoints.

Powered soaring also breaches buildings. `shared/soar-breach.js` sweeps a conservative prone-capsule envelope against current solid bay geometry, selecting at most six intersected cells per tick and stopping at fixed props or settled wreckage. `server/soar-breach.js` detaches those cells through the existing support/collapse pipeline, shatters their skins and ejects single bays sideways. Real debris and facade fragments persist and replicate normally. Only the pilot who caused the break gets 0.9 seconds of contact filtering against the newly detached cells; all other contacts stay active. Filters use cell IDs so secondary fractures retain the short grace period. No broad invulnerability or collision-group bypass is added.

Prediction uses the same swept-cell selection and oriented capsule bounds to cross incoming holes without waiting for network events; it never changes city authority and keeps terrain/prop collision. The `soar-breach` event adds a blue impact pulse and sound without an event toast. Stale inputs, exhausted fuel, normal flight and normal dodges cannot activate a breach. Existing debris-body capacity limits still apply: when no new chunk can be created, the wall remains intact and server position wins.

## Continuous city generation

The original five-by-five Midtown grid remains the home district. Beyond it, `generateBlock(x,z,seed)` produces eight street-front buildings per 70 m block from 16 architectural families, with an occasional ninth Chrysler landmark in its courtyard. An optional `landmark: 'chrysler'` layout override adds that same tower without changing the eight original addresses. The host spawn action replicates overrides in block metadata; pristine manual overrides also survive unload and late join for the round. Signed coordinates are zigzag encoded, Cantor paired and assigned a 4,096-cell range above 1,000,000; cell IDs therefore stay independent of load order. IDs are stable for a given map revision; refresh all players after changing landmark layouts. Tier footprints retain continuous vertical support. The generator and roof-equipment selection are shared by browser and server.

`server/streaming.js` keeps a three-by-three physical neighborhood around every giant, raider/ragdoll and missile, in addition to the permanent home district. New outer blocks load one per tick; spawning preloads its immediate neighborhood synchronously, and long rifle rays preload the blocks they cross. Players can separate. The old horizontal flight/giant bounds are disabled for this map, and distant respawns follow the giant. Existing altitude and tracking-reach validation remain in force.

Unloading releases fixed structures, ground, hand-query entries and debris bodies, and recycles building array slots. The sparse round journal stores exact structural/glass/facade HP, skin masks, detached IDs, collapsed-building state, pending failure delays, body poses and velocities. Pristine blocks need no archive. Offscreen physics pauses; loading recreates the same damage and resumes movement and pending failures. An owner block stays active when one of its thrown pieces is within 100 m of a player. Damaged history grows with destruction until round reset; it is not saved across server restarts.

The client independently keeps up to nine detailed generated blocks around the viewing camera with no simplified silhouette ring. State arriving for an unloaded view is retained and applied when approached. Shared architectural batches span all detailed views. Hand contact queries use 35 m spatial buckets and query child views, avoiding a scan of every bay for each sweep.

## Structural destruction

The home district (`shared/city/layout.js`) is a grid of avenues and streets with 169 buildings built
from **tiers** on one integer bay grid (setbacks keep support continuity). Every bay is a hollow
storey: slab + four corner columns + exterior skins. 5,827 bays. Intact floors share slabs and exterior walls on one fixed body per building. Notched landmark shoulders merge only occupied slab rectangles and keep their re-entrant walls; no collision plane spans their open corner. Columns are merged by logical grid corner into continuous runs (inclined on tapering towers) until the first structural failure in their building; only then are those runs split by floor. Only affected floors/wall sides split into per-bay collision shapes when damaged. Roof equipment and street props retain separate solid proxies; falling debris uses one coarse box per bay plus roof equipment.

Each exterior wall has up to two **skin layers** over the frame, by material
(`shared/city/materials.js`): a *curtain wall* is all glass on a steel frame; *brick*, *stone*
and *concrete* have windows plus a facade. `damageCell(energy, sides)` pops glass first (cheap),
then cracks the facade (which shields the frame while it stands), then reduces the frame's
structural HP. Glass and facade HP accumulate per face, and their remaining HP consumes energy before it reaches the frame. Slab/column/attachment contacts bypass skins. `frameScale` combines bay width, building height, floor reinforcement and landmark strength; low-rise bays are less durable. Shared cuboid contact metadata identifies the component kind and wall side. Fist contact points clamp to the actual box, and coplanar bay seams report both bays. Merged collider hits resolve against that side's actual shapes. Blasts select nearby surfaces in distance order, with a per-hit cap; heavy bolts use a local 2.4 m blast rather than unconditional neighbour damage. A broken solid layer becomes an
**opening**: its collider is removed, raiders and missiles pass through, and the client hides that
instance, animates dust and retains two deterministic skin fragments per destroyed layer until round reset. The latter are visual pieces; structural wreckage retains Rapier collision.

**Integrity** has two parts. Graph support (`unsupportedCells`): bays with no path to a
foundation. Load (`structuralLoads`): weight flows down each stack; a bay whose support below is
gone hangs from lateral neighbours up to six bays away, splitting its load among the nearest
supported bays; capacity is `(stack + 1) × material safety × 3 × frameHP ratio`, so damaged columns
carry less. Overloaded bays are scheduled to fail after `COLLAPSE_DELAY` (2.2 s + up to 0.6 s jitter) with a
`creak`, which makes cascades read as progressive collapse. Destroyed frames detach in the same tick; overloads that become safe are cancelled. A failed column becomes a modeled debris body and can temporarily prop up adjacent fallen structure.

Detachment: kicked bays fly as single chunks; unsupported sections form connected graph islands (floors when small). Separated wings never share a rigid body. Only directly hit pieces inherit the blow; unsupported neighbours start at rest and fall under gravity, with no upward boost or height-amplified launch. Debris uses linear/angular damping 0.3/0.8. On a hard landing an island
splits into connected floor bands, bands into bays, preserving velocity and angular motion without an extra radial kick, and a lone bay that lands hard gains damping and emits impact effects without disappearing. Once asleep after two seconds, debris becomes a fixed body, leaves the active snapshot list, and sends its final `settled` pose. Welcome state includes settled entities; clients ignore stale interpolated poses for them. Falling chunks can damage bays at Rapier solver contact points using the normal component of impact velocity (mass scaling capped at 16 bays, at most 120 energy), and raiders, but never damage or stagger the colossus. Heavy weapon hits still stagger it and expose the core (+60 % rifle/breach damage while staggered). The giant slides along intact bays at torso height. Walking chips one contacted bay every 0.7 seconds, capped at 5% frame wear, and cannot demolish its way through. The COL6 blocked flag stops desktop camera dead reckoning at walls.

Budgets: 144 chunk bodies (connected coarse islands under pressure, deferred breaks at the cap that remain queued until a slot is available). Secondary fractures reserve 16 slots for new hits. Destruction events leave on their 60 Hz physics tick independently of 20 Hz snapshots. There are eight ragdolls. Limits: graph/load are still a game model, not FEA — no bending moments,
fatigue, rebar or arbitrary cracks; bays are rigid compounds; no self-collision on ragdolls.

## Rendering

Quality tiers (`src/render/quality.js`) are chosen from the GPU string once: `quest`, `low`
(integrated GPUs), `medium`, `high`. Lower tiers use Lambert shading for opaque surfaces,
no normal maps, no shadows, no bloom, pixel ratio 1, shorter fog distance and smaller
particle/rubble pools; `Q` toggles cinematic extras. Adaptive resolution lowers the pixel ratio
when the frame-time EMA exceeds 20 ms and raises it back below 12.5 ms (never in XR; hidden tabs
are ignored). `?quality=low|medium|high|quest` forces a tier for profiling.

The towers render as instanced batches regardless of city size: one frame batch (slab + open
prism columns), one facade batch per masonry material, one glass batch per material, one roof
batch, plus roof props and spires attached to their bays. Broken layers get a zero matrix.
The 214-type architectural kit uses one shared set of reusable instanced geometry across loaded blocks. Detail is selected within 64 m on Quest, 85 m on performance tier and 115 m on higher tiers; landmark-specific ribs and crowns extend to 230 m. Core batches compact visible instances without changing logical bay poses. Visibility uses the union of both XR eye frustums; desktop shadow rendering retains nearby offscreen casters. Nearby assemblies retain their skin masks and moving-bay transforms. Building name labels and their street-level signboards are omitted from the scene and collision map. No extra dynamic body is created for each ornament. See `CITY_COMPONENTS.md`.

Visible core/detail instances retain their slots; removing one swaps only the last affected slot. Unchanged camera matrices skip core visibility scans, and detail world matrices are cached per bay pose. `render/instances.js` merges changed attribute ranges until Three uploads them, including multiple commits before an XR/capture render. Growing detail buffers copy existing transforms and release the old instance buffer. Empty effects submit no draws or buffer updates. Persistent facade fragments allocate power-of-two capacity only after damage, retaining every existing fragment when growing. City dressing and structural batches have separate ownership to avoid retaining replaced buffers.

The exact left-eye spectator mirror reuses visibility from the just-rendered stereo frame. Independent bot/free cameras still select their own view. Nearby block construction uses a queue rebuilt at block boundaries instead of sorting all preview blocks every frame. Low tiers avoid fetching maps their materials do not use, and the infinite city's source HDR texture is released after preparing its reflection map.

Linear fog covers 32–60 m on Quest and 40–65 m on desktop, inside the fully detailed neighborhood. The shader measures distance per pixel, so the sides of a wide or stereo view also fade before radial visibility culling. The moving sky uses the same horizon color and output color space as full fog, hiding the terrain and detailed-block cutoff. A world-space road shader repeats the street grid over a moving plane using downloaded asphalt/concrete textures. Nearby roof equipment reuses the existing downloaded models and rides destructible bays. Generated blocks replace the old decorative skyline ring and harbor boundary.

XR uses the tier's framebuffer scale (0.8 on Quest) and foveation; the camera is never shaken
(haptics and a camera-locked red vignette carry damage instead). Do not mistake desktop FPS for
headset FPS: `npm run profile` measures a laptop GPU with a visible Chromium; the Quest needs a
device.

## Scaling and operations

Rapier 0.17.3 normally rebuilds its scene-query acceleration tree after every solver step. `server/queries.js` uses the same public physics pipeline call, preserving collision resolution, CCD and events, and defers the separate query-tree refresh until a ray/shape/point query. Creation/removal, the start/end of a tick, streamed blocks and changed collider shapes invalidate it. Code that changes an existing pose or shape and queries it in the same tick must call `world.invalidateSceneQueries()`; explicit `world.updateSceneQueries()` remains available. Recheck the adapter when upgrading the pinned Rapier version. Idle flight updates no longer force sleeping bodies awake; movement and dodge still wake immediately.

Static delivery compresses eligible files asynchronously and caches at most 16 MiB / 128 compressed entries across the process. ETags revalidate unchanged files, including scripts with `no-cache`; HEAD and compression negotiation preserve response metadata. Event broadcasts serialize once per room rather than per recipient. Binary snapshots and spectator transport remain unchanged. Benchmark methods and remaining limits are in `PERFORMANCE.md`.

One process owns all rooms; exactly one Fly Machine. World creation builds the merged structural colliders plus the shared prop and hand caches. Profile creation and round resets on the hosting machine. No persistence, accounts or reconnect
identity. First escalation after measurement: delta/prioritised snapshots, worker processes per
room, deliberate room routing, then a different gameplay snapshot transport. Spectator video already uses WebRTC.
