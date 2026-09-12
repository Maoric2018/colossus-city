# Architecture and engineering boundaries

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
```

Only the server decides movement, collision, shooting, damage, deaths, support loss and physical body transforms. Rendering is not a source of collision authority. Local particles and cameras are cosmetic. Quest hands use a local solid-contact preview against the same map boxes as the server, so the rendered palm stops at a wall immediately while the raw controller target continues to reach the server. Only the server applies damage and destruction. Newly broken geometry can still differ briefly during network delay; full reconciliation/rollback is not implemented.

The tracked grip defines the palm center and orientation. `shared/giant-rig.js` supplies the same 2.9 × 2.5 × 2.8 m oriented hand box to rendering, laser hit tests and kinematic Rapier bodies. Both wrist quaternions are validated, replicated and interpolated. Static hand contact uses continuous 15-axis box sweeps against actual hollow bay components, roof equipment, fixed props and ground, with a small contact skin and surface sliding. Slow contact produces feedback; continued pressure deals bounded repeated damage. Detached bays leave the fixed contact cache and remain movable Rapier debris. Recenter/tracking recovery retain their contact grace period, and artificial yaw does not count as punch velocity.

The head position and yaw define the remaining simplified giant silhouette. Arm armor spans 88% of each 6 m joint link, leaving room for exposed shoulder, elbow and wrist sockets. Imported fingers are oriented into the grip frame, and the lower arm ends at a wrist behind the palm. Neck, hip, knee and ankle sockets connect the body sections. These are visual joints, not physical elbow bodies. Core/head player collision still uses server overlap tests. Giant locomotion/feet are not a physics character controller. Raiders are dynamic capsules whose desired speed is approached smoothly, rather than setting client-supplied positions.

Head/controllers are finite bounded triples, head height/reach is checked, damage velocity is clamped (the tracked hand position is preserved), stale input expires, stale tracking stops attack extrapolation. This limits accident/exploit severity but does not prove anti-cheat security: an untrusted client can fabricate plausible tracked poses. The optional debug channel transmits rendered game images while a spectator watches. No passthrough camera images, microphone recordings or user accounts are transmitted.

## Fixed step and timestamps

The server uses an accumulator at 60 Hz. At most eight catch-up steps run in one timer callback, avoiding an unbounded spiral of death. This can slow simulation relative to wall time under overload; it is not a real-time scheduling guarantee. Snapshot interval is three steps. Room time/tick are server-owned and monotonically increase across rounds. A world reset sends a fresh welcome before the reset event/snapshots; clients clear their interpolation history and entity instances.

Remote interpolation targets approximately 100 ms behind the newest received world state. Quaternion interpolation uses the shortest hemisphere and normalization. Discrete entity/health flags are not invented by interpolation. Local raider camera lead is capped at 75 ms and disabled during ragdolls/death. There is no client rigid-body simulation, full replay of unacknowledged inputs, rewind shooting or prediction correction animation.

## Transport

Control messages are JSON: join, input, pose, restart and ping. Entity creation/removal/events are reliable JSON in the same ordered WebSocket. Transforms use a versioned little-endian binary format:

| Component | Bytes |
| --- | ---: |
| Frame and boss state | 124 |
| One raider | 56 |
| One chunk or ragdoll body | 32 |

At 144 chunks + 8 × 11 ragdoll parts + 8 raiders, a snapshot is 7,996 bytes. At 20 snapshots/s, one receiving client uses approximately 159,920 bytes/s for snapshots. Nine receiving players imply roughly 1.44 MB/s aggregate server snapshot egress at that configured maximum, excluding all JSON, protocol, TLS and spectator overhead. Sleeping bodies are still included until removed: this is deliberately simple full-snapshot replication, not aggressive delta compression. Empty/sparse scenes are smaller.

The current snapshot magic is COL3 (0x434f4c33), including both wrist quaternions as well as raider pitch, soar/dodge flags and cooldown. Every client must reload after updating from COL2. Missile creation/detonation uses reliable JSON events; welcome packets include active projectiles so late joiners see them. Server ray sweeps decide impact and splash damage. Client projectile motion is cosmetic extrapolation from the authoritative origin, direction and timestamp.

Live views use a separate `/views` WebSocket for room-token authentication, offers/answers, ICE candidates and mode metadata. Only active room spectators can negotiate with human publishers. The video travels directly over WebRTC: a 640 × 400 canvas track, manually requested at up to 30 fps on desktop or 24 fps in XR, with a 1.2 Mb/s sender limit per spectator and a preference to maintain frame rate. Spectators display muted inline video elements; supported receiver buffering hints request minimal delay. Frame callbacks measure delivered fps and optionally estimate capture-to-presentation age. Metadata changes are sent immediately, otherwise once per second. No audio, camera or microphone permission is requested.

Capture exists only while at least one spectator watches; closing/disconnecting releases media tracks and peer connections. XR preserves the actual left-eye projection and matrices, including the in-world HUD, and restores framebuffer, scissor and XR state afterward. Desktop copies its rendered canvas plus a compact HUD. The panel skips the obscured full-screen scene render. AI cameras render locally into their own canvases at up to ten updates/s each, staggered one per animation frame, and are explicitly labeled simulated.

After eight seconds without usable video, the viewer requests a per-publisher JPEG fallback. It targets 15 fps, requires publisher and viewer acknowledgements, allows one in-flight image plus one replaceable newest pending image per feed, and discards pending images older than 250 ms. Buffers prevent additional image sends under congestion. Slow viewers cannot build an application-level history of frames or force video-capable viewers onto the fallback. Reopening the panel retries video. TCP loss can still delay fallback packets already on the wire.

`VIEW_ICE_SERVERS` configures STUN/TURN (JSON array); the default uses Google's public STUN service. A TURN service is not included. Local USB HTTP forwarding does not forward WebRTC media; Quest and laptop still need a reachable Wi-Fi/ICE path. Use one spectator for the demo to limit per-publisher bandwidth/encoding overhead. Background tabs can suspend rendering; each actual player's game should stay visible on its device. Menus, browser chrome, operating-system overlays and audio are not streamed.

When a socket's outgoing buffer exceeds 128 KiB, fresh snapshots are skipped; reliable destruction events are not silently dropped. Beyond 1 MiB, a slow client is disconnected. This prevents application-level unbounded queues, but TCP's ordering can still stall newer data behind a lost packet. WebRTC unreliable data channels could improve snapshot delivery under loss, but require signaling plus a suitable trusted server-side data-channel endpoint. Gameplay remains on WebSockets; the spectator video transport does not change simulation or snapshot delivery.

Client input is limited to ~30 messages/s, with a server ceiling of 100 messages/s per connection and an 8 KiB inbound message limit. Handshake timeout and ping/pong heartbeat remove idle connections. There is a room/client cap and same-origin WebSocket policy. The room code is a convenience invitation, **not authentication**. This is suitable for a controlled demo, not an untrusted large public launch.

## Flight and tracked hands

The giant moves at 13 m/s versus normal raider flight at 11 m/s. Keyboard diagonals and Quest sticks are normalized to the same walking speed. The XR rig defaults to scale 14; hand reach is head + (tracked grip − head) × reach gain. Height calibration changes the rig scale, while the optional reach slider changes only the hands. Smooth yaw uses elapsed frame time and an analog deadzone. Turning preserves the head’s world position. Pose packets include accumulated artificial yaw so the server can rotate the previous collision point before measuring a physical swing. Tracking entry/recovery/recenter still rebase with a short contact grace period.

Raiders start in first person; V or the pause-menu camera button toggles to third person. Desktop third person sits over the right shoulder, 6.8 m behind the raider (8.2 m while soaring), with a 72-degree base field of view and wider fast-flight/dodge views. Obstructions shorten the camera arm. The imported raider faces game -Z; its whole body leans into flight. Lasers retain authoritative hitscan endpoints and add bounded core/glow/pulse meshes and surface impact particles.

Either held Shift key requests soaring; releasing both, pausing or losing focus clears it. Shift replaces the former separate desktop boost and F toggle. Hover and soaring approach server-owned target velocities; soaring follows camera pitch/yaw and rotates the raider’s capsule to match the prone body. Directional dodges use a monotonically increasing input sequence, fuel debit and cooldown, so holding or resending one input cannot retrigger them. Soar, dodge and pitch are replicated to all clients. No client position command bypasses the physics world.

## Structural destruction

Each generated cell has stable identity, original pose, six-neighbor connectivity, a ground-anchor flag and a hollow compound collision representation. Static cells initially belong to fixed bodies. A swept giant-hand volume damages cells; a support flood fill finds remaining components disconnected from all foundations. Hit bays become separate chunks. Unsupported floors are grouped by building/storey so the first failure is a moving structural section rather than hundreds of particles.

A cluster stores its constituent cell IDs and their original positions. Each cell's current transform is computed from the cluster's current pose and its offset to the cluster's original center. A collision with sufficient pre-impact speed can split a multi-cell chunk. Each child inherits parent orientation and velocity plus angular-velocity-cross-offset, with a small separation term. This is game fracture, not exact energetic conservation.

At body-cap pressure, newly detached cells from each building are merged into a larger coarse chunk. If no body slot exists, a new break is deferred. This avoids removing still-falling geometry or freezing disconnected floors to fake a performance target. Note that coarsening reduces body count but not the same proportion of collision shapes. Maximal whole-city rubble still needs CPU profiling.

After at least 35 seconds, sleeping debris can be removed. It never returns as an intact building: a late join receives cleared-cell tombstones. Chunks below the world are removed immediately. Ragdoll corpses expire after nine seconds; nonfatal recovery/respawn can happen sooner. There are eight ragdoll slots; orphaned corpses are reclaimed first to preserve live knocked-down players.

Limits: graph connectivity is not load capacity; one remaining foundation can support an entire connected overhang. Materials use tuned game density/friction. No plasticity, bending moments, fatigue or material-specific fracture. The broad swept building test uses a bay envelope; the physical debris collider itself is hollow. A hand can therefore fracture an empty part of the bay envelope. Raider ragdolls have constrained elbows/knees, but free spherical shoulders/hips and no self-collision. `shared/raider-rig.js` supplies model-derived part bounds and joint anchors; creation metadata names all eleven bones. The client clones one skinned version of the same live-pilot geometry and drives its bones from the existing body snapshots. The chest carries the flight pack, and the forearm carries the rifle. Bind-pose inverse matrices preserve the original surface; each ragdoll owns its skeleton but shares immutable geometry/materials. Per-body removal messages release the complete avatar when its last body is removed. Initial body transforms include yaw, prone flight pitch and bank. Debris does not recursively apply a full structural stress solver to intact neighbors.

## Rendering

The default map has three facade material styles, shared slab/column geometry, batched exterior walls and attached roof details. Distant towers use instancing; road marks, lamp posts and bridge details use merged geometry. Custom bay GLBs are instanced per source mesh across cells of that style; each semantic wall/roof part can be hidden independently. Harbor cars, lamp posts, signboards, pavement and bridge geometry have fixed collision proxies. Rooftop tanks, dishes and solar panels contribute compound shapes to their supporting bay, including after collapse and fragmentation. Car/roof art and physics share measured model bounds and placements in `shared/props.js`; distant skyline/harbor dressing remains decorative. Camera and aim rays use the same prop bounds.

Quest selects a lower-cost path: no effects composer allocation by default, no default shadows, no bloom, reduced particle/background counts, framebuffer scale 0.85 and feature-detected foveation. The same scene is rendered to WebXR stereo views. A 72 Hz session-rate request is made only when supported; achieving it remains a hardware profiling task. Renderer draw calls and measured browser frames/s appear on the desktop HUD; an in-world HUD carries gameplay information in VR. Do not mistake desktop FPS for headset FPS.

## Scaling and operations

One process owns all rooms. Exactly one Fly Machine is required until sticky room routing or a room directory/worker design is added. A second copy has independent room codes/worlds. More CPUs do not parallelize this event loop. Server restart and immediate deployment lose all matches. Empty rooms are removed after one minute. No database, persistence, save game, account system, cross-region federation or reconnect identity is implemented.

First escalation after measurement: reduce dynamic collision shapes through offline convex proxies, prioritize/delta-send nearby debris, limit concurrent rooms, move rooms to worker processes, add deliberate room routing, and then consider WebRTC snapshots. Do not implement five independent client physics worlds and hope their rubble stays synchronized.
