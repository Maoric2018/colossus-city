# Validation record and acceptance gates

## Combined main validation — September 12, 2026

Merged `overhaul/smooth-city` (834e4f0) with main's hand-contact, armored raider/ragdoll, hold-Shift flight and WebRTC spectator changes. Local environment: macOS, Apple M5 Pro, Node 22.19.0. No physical headset attached.

- **80 Node tests: PASS.** Tests cover the combined gameplay, Rapier, WebSocket, XR lifecycle and COL4 protocol, including wall-layer changes in hand geometry and late-join skin state.
- **76 modules and 59 assets: PASS.** JavaScript modules checked for syntax and local imports; bundled assets verified against the source manifest. Dependency versions and lockfile are unchanged.
- **Multiplayer/browser smoke: PASS.** Checks exercise the real multiplayer server, first-person default and V/menu toggles, either held Shift and focus loss, Quest stereo/turn/reach, missiles, WebRTC feeds, fallback/reconnect and Quest lifecycle.
- **Rendered giant, visual, XR-view and ragdoll checks: PASS.** Cover palm/forearm separation, actual Midtown hand contact, roof movement/removal/reset, solid props, layered laser effects and the matching pilot ragdoll.
- Latest machine-readable results and screenshots are in `artifacts/`; performance measurements are specific to that machine and workload, not physical Quest performance.

## Local performance measurements

Three simultaneous human video feeds delivered 24.0–29.8 presented fps; capture-to-display p95 was 52–74 ms. Encoded timestamp measurements exclude physical tracking and the work before capture. Same-machine results do not establish Wi-Fi or headset latency.

| Server scenario (8 raiders, 900 ticks) | Mean ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| 8 raiders, intact city | 2.18 | 3.33 | 4.68 |
| 8 raiders, 6 staged building collapses, repeated ragdolls | 5.24 | 6.97 | 19.94 |
| 8 raiders, active giant hand contact | 3.79 | 5.71 | 9.95 |

The 16.67 ms tick budget held for typical frames; the largest one-time collapse/fracture spike was 19.94 ms. The active-hand scenario recorded 55 structural strikes. These are server CPU measurements, not renderer/headset FPS.

## Still not validated

- Physical Quest 2 stereo/optics, tracking accuracy, haptics, comfort, sustained frame rate and thermal throttling. The `quest` tier (Lambert shading, 0.8 framebuffer scale, low-poly skyline, small pools) is sized from Meta's published guidance, not measured on a headset.
- Eight real humans, weak Wi-Fi, long sessions, and gameplay balance of the new breach shot / stagger / tower-drop loop.
- USB forwarding on a connected headset; Docker/Fly deployment with trusted HTTPS on a headset.

## First connected-machine checks

```sh
npm ci
npm run check
npm run test:all
npm run bench
npm run profile
npm start
```

## Two-laptop acceptance

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, the raider's own movement is immediate (prediction) while remote players interpolate, mouse aim, core/head damage, occlusion behind buildings, fuel, hold-Shift soar/release-to-hover, E dodge, the breach shot (charge ring, cooldown, cracked bay), first/third-person cameras and spectator feeds. Shatter windows with rifle fire and confirm the opening lets you fly inside. Break a brick base bay and watch the creak → delayed failure → cascade. Knock out enough of a tower base for it to tip as one island, split on landing and crumble. Drop structure on the giant and confirm the stagger, the exposed-core bonus and the announcer feed on both screens. Reset rounds after collapses; no building should return on join.

## Quest 2 acceptance

Follow `QUEST2_TESTING.md`. In addition to the previous checks: confirm the dust/haptic tick when a hand crosses a bay is immediate and the server-side strike follows shortly; confirm material haptics differ (glass tinkle vs stone thud); confirm the red vignette on being crushed is comfortable and the camera never shakes; confirm walking into a tower slows the giant and breaks bays; record delivered FPS with `?quality=quest` during a full tower collapse with eight raiders and rubble on screen, both with Live Views closed and open.

## Network/failure acceptance

As before: shaped ~100 ms RTT, jitter, loss and stalls; watch prediction corrections (they should read as nudges, never teleports) and delayed chunk events; reconnect through Leave/Join; server disappearance must read as disconnected.

## Known limits

Game structural model, not engineering analysis; rigid compounds; decorative skyline; simplified giant collision; no rewind hit validation, accounts, persistence or horizontal scaling. Live video targets 640 × 400 at 30 desktop / 24 headset frames per second. Cross-device Wi-Fi, remote ICE/TURN paths and headset encoding cost still need a demo-device test.
