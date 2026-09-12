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

Only the server decides movement, collision, shooting, damage, deaths, support loss and physical body transforms. Rendering is not a source of collision authority. The only local simulations are disposable visual particles and camera prediction. Local Quest hand/head rendering follows the current XR pose directly; hit registration still uses bounded poses on the server. Therefore a hand can appear ahead of its server-effective contact during network delay. Full reconciliation/rollback is not implemented.

The tracked controller's grip-space position defines its simplified spherical hand. The head position and yaw define the simplified giant silhouette. Arms are visual articulated segments, not physical elbow joints. Core/head player collision uses server overlap tests; hands also have kinematic Rapier bodies for pushing debris/ragdolls. Giant locomotion/feet are not a physics character controller. Raiders are dynamic capsules whose desired speed is approached smoothly, rather than setting client-supplied positions.

Head/controllers are finite bounded triples, head height/reach is checked, damage velocity is clamped (the tracked hand position is preserved), stale input expires, stale tracking stops attack extrapolation. This limits accident/exploit severity but does not prove anti-cheat security: an untrusted client can fabricate plausible tracked poses. The optional debug channel transmits rendered game images while a spectator watches. No passthrough camera images, microphone recordings or user accounts are transmitted.

## Fixed step and timestamps

The server uses an accumulator at 60 Hz. At most eight catch-up steps run in one timer callback, avoiding an unbounded spiral of death. This can slow simulation relative to wall time under overload; it is not a real-time scheduling guarantee. Snapshot interval is three steps. Room time/tick are server-owned and monotonically increase across rounds. A world reset sends a fresh welcome before the reset event/snapshots; clients clear their interpolation history and entity instances.

Remote interpolation targets approximately 100 ms behind the newest received world state. Quaternion interpolation uses the shortest hemisphere and normalization. Discrete entity/health flags are not invented by interpolation. Local raider camera lead is capped at 75 ms and disabled during ragdolls/death. There is no client collision solver, full replay of unacknowledged inputs, rewind shooting or prediction correction animation.

## Transport

Control messages are JSON: join, input, pose, restart and ping. Entity creation/removal/events are reliable JSON in the same ordered WebSocket. Transforms use a versioned little-endian binary format:

| Component | Bytes |
| --- | ---: |
| Frame and boss state | 92 |
| One raider | 56 |
| One chunk or ragdoll body | 32 |

At 144 chunks + 8 × 11 ragdoll parts + 8 raiders, a snapshot is 7,964 bytes. At 20 snapshots/s, one receiving client uses approximately 159,280 bytes/s for snapshots. Nine receiving players imply roughly 1.43 MB/s aggregate server snapshot egress at that configured maximum, excluding all JSON, protocol, TLS and spectator overhead. Sleeping bodies are still included until removed: this is deliberately simple full-snapshot replication, not aggressive delta compression. Empty/sparse scenes are smaller.

The current snapshot magic is COL2 (0x434f4c32), including raider pitch, soar/dodge flags and cooldown. Every client must reload after updating from COL1. Missile creation/detonation uses reliable JSON events; welcome packets include active projectiles so late joiners see them. Server ray sweeps decide impact and splash damage. Client projectile motion is cosmetic extrapolation from the authoritative origin, direction and timestamp.

Live views use a separate `/views` WebSocket, authenticated with a random per-connection token delivered in the game welcome. Only room spectators can subscribe. Human players publish JPEGs at up to six frames/s, 640 × 400, below 96 KiB each. Publishers capture only while subscribed; buffers beyond 192 KiB drop debug frames without blocking the game socket. The server caps channel messages and rejects non-JPEG binary input. This is room access control, not an account system. Budget additional image bandwidth and one extra XR eye render per captured frame. The laptop dashboard renders bot cameras locally and labels them simulated. Human views originate at that player: desktop canvas plus a compact gameplay HUD, or a render using the actual headset left-eye matrices including its in-world HUD. Menus, browser chrome, operating-system overlays and audio are not streamed.

When a socket's outgoing buffer exceeds 128 KiB, fresh snapshots are skipped; reliable destruction events are not silently dropped. Beyond 1 MiB, a slow client is disconnected. This prevents application-level unbounded queues, but TCP's ordering can still stall newer data behind a lost packet. WebRTC unreliable data channels could improve snapshot delivery under loss, but require signaling plus a suitable trusted server-side data-channel endpoint. Neither WebRTC nor TURN is silently substituted into this build.

Client input is limited to ~30 messages/s, with a server ceiling of 100 messages/s per connection and an 8 KiB inbound message limit. Handshake timeout and ping/pong heartbeat remove idle connections. There is a room/client cap and same-origin WebSocket policy. The room code is a convenience invitation, **not authentication**. This is suitable for a controlled demo, not an untrusted large public launch.

## Flight and tracked hands

The XR rig defaults to scale 14; hand reach is head + (tracked grip − head) × reach gain. Height calibration changes the rig scale, while the optional reach slider changes only the hands. Smooth yaw uses elapsed frame time and an analog deadzone. Turning preserves the head’s world position. Pose packets include accumulated artificial yaw so the server can rotate the previous collision point before measuring a physical swing. Tracking entry/recovery/recenter still rebase with a short contact grace period.

Hover and soaring approach server-owned target velocities; soaring follows camera pitch/yaw and rotates the raider’s capsule to match the prone body. Directional dodges use a monotonically increasing input sequence, fuel debit and cooldown, so holding or resending one input cannot retrigger them. Soar, dodge and pitch are replicated to all clients. No client position command bypasses the physics world.

## Structural destruction

Each generated cell has stable identity, original pose, six-neighbor connectivity, a ground-anchor flag and a hollow compound collision representation. Static cells initially belong to fixed bodies. A swept giant-hand volume damages cells; a support flood fill finds remaining components disconnected from all foundations. Hit bays become separate chunks. Unsupported floors are grouped by building/storey so the first failure is a moving structural section rather than hundreds of particles.

A cluster stores its constituent cell IDs and their original positions. Each cell's current transform is computed from the cluster's current pose and its offset to the cluster's original center. A collision with sufficient pre-impact speed can split a multi-cell chunk. Each child inherits parent orientation and velocity plus angular-velocity-cross-offset, with a small separation term. This is game fracture, not exact energetic conservation.

At body-cap pressure, newly detached cells from each building are merged into a larger coarse chunk. If no body slot exists, a new break is deferred. This avoids removing still-falling geometry or freezing disconnected floors to fake a performance target. Note that coarsening reduces body count but not the same proportion of collision shapes. Maximal whole-city rubble still needs CPU profiling.

After at least 35 seconds, sleeping debris can be removed. It never returns as an intact building: a late join receives cleared-cell tombstones. Chunks below the world are removed immediately. Ragdoll corpses expire after nine seconds; nonfatal recovery/respawn can happen sooner. There are eight ragdoll slots; orphaned corpses are reclaimed first to preserve live knocked-down players.

Limits: graph connectivity is not load capacity; one remaining foundation can support an entire connected overhang. Materials use tuned game density/friction. No plasticity, bending moments, fatigue or material-specific fracture. The broad swept building test uses a bay envelope; the physical debris collider itself is hollow. A hand can therefore fracture an empty part of the bay envelope. Live raider ragdolls have constrained elbows/knees, but free spherical shoulders/hips and no self-collision. Debris does not recursively apply a full structural stress solver to intact neighbors.

## Rendering

The default map has three facade material styles, shared slab/column geometry, batched exterior walls and attached roof details. Distant towers use instancing; road marks, lamp posts and bridge details use merged geometry. Custom bay GLBs are instanced per source mesh across cells of that style; each semantic wall/roof part can be hidden independently. The default background/props are static art, not authoritative gameplay bodies unless a prop explicitly provides collision.

Quest selects a lower-cost path: no effects composer allocation by default, no default shadows, no bloom, reduced particle/background counts, framebuffer scale 0.85 and feature-detected foveation. The same scene is rendered to WebXR stereo views. A 72 Hz session-rate request is made only when supported; achieving it remains a hardware profiling task. Renderer draw calls and measured browser frames/s appear on the desktop HUD; an in-world HUD carries gameplay information in VR. Do not mistake desktop FPS for headset FPS.

## Scaling and operations

One process owns all rooms. Exactly one Fly Machine is required until sticky room routing or a room directory/worker design is added. A second copy has independent room codes/worlds. More CPUs do not parallelize this event loop. Server restart and immediate deployment lose all matches. Empty rooms are removed after one minute. No database, persistence, save game, account system, cross-region federation or reconnect identity is implemented.

First escalation after measurement: reduce dynamic collision shapes through offline convex proxies, prioritize/delta-send nearby debris, limit concurrent rooms, move rooms to worker processes, add deliberate room routing, and then consider WebRTC snapshots. Do not implement five independent client physics worlds and hope their rubble stays synchronized.
