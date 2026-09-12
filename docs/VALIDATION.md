# Validation record and acceptance gates

## Articulated soaring — September 12, 2026

- **95 Node tests, 89 JavaScript modules and 64 bundled assets: PASS.** Shared pose tests cover individual limb motion and connected joint anchors across hover, flight transitions, banking and dodges. The real physics knockdown stays connected while tumbling.
- **Animation render: PASS.** Flight/hover transitions match at 30 and 144 fps (blend error below 1e-6). Independently cloned skeletons animate the existing pilot surface. Sampled surface movement reaches 0.11 m during the loop; jet attachments also move with the torso. Fuel exhaustion hides the jets, first person hides the local body, and release returns to hover. Hover, soaring, banking/dodge and braking screenshots were inspected.
- **Ragdoll render and emulated Quest stereo: PASS.** Animated live and initial ragdoll surfaces match within 0.000002 m across all 31,674 vertices, including identical colors and attached gear. Late joins and removal pass.
- **Multiplayer/browser regression: PASS.** Held Shift, first/third-person toggles, authentic spectator feeds and Quest stereo pass with the animated pilot. The animation clock interpolates between 20 Hz snapshots so joint motion follows render frames.
- Preview: `artifacts/raider-soaring.mp4`; reports: `artifacts/flight-animation-report.json` and `artifacts/ragdoll-report.json`. Actual headset frame time still needs a hardware check.

## Movable cars — September 12, 2026

- **93 Node tests: PASS.** Includes movable car bodies, no leftover static proxies, gentle pushes, tracked hard hits, cover blocking punches, recenter protection, footsteps and missile destruction, single explosions, sleeping wrecks, late joins and round resets.
- **86 JavaScript modules and 64 bundled assets: PASS.** Five additional wreck components come from the already downloaded Kenney Car Kit.
- **Rendered car check: PASS.** All six vehicle/wreck pairs inspected. Actual Rapier poses drive the crushed model; camera queries follow the moved car and leave its old position clear. Stale snapshots cannot move a sleeping wreck. Late join and reset restore the correct model. Explosion and smoke sprites render without asset failures.
- **Multiplayer and emulated Quest browser smoke: PASS.** No browser errors; stereo, tracked controls, missiles, camera modes and live spectator feeds pass with dynamic cars present. The sampled emulated stereo scene submitted about 2.13 million triangles. This is not a physical headset performance measurement.
- **Existing visual and giant contact regressions: PASS.** Imported attachments, current car collision, raider lasers and aligned robot wrists remain correct.
- **Server benchmark with dynamic cars present:** intact city p95 2.43 ms; staged collapses and ragdolls p95 7.17 ms (28.21 ms maximum); active hand contact p95 4.55 ms. The largest collapse spike still exceeds the 16.67 ms tick budget. Parked cars produced no repeated pose records.
- Three concurrent local human video feeds delivered 24.0–29.5 presented fps, with capture-to-display p95 of 46–94 ms. This does not establish cross-device Wi-Fi latency.

The vehicle screenshots and report are `artifacts/cars-intact-and-wrecks.png`, `artifacts/car-explosion.png` and `artifacts/car-report.json`.

## Dense city and persistent destruction — September 12, 2026

Built on main's merged Midtown overhaul. Local environment: macOS, Apple M5 Pro, Node 22.19.0. No physical headset attached. The map has 169 buildings, 5,452 structural bays and a 45-type architectural kit, with at least 30 modeled component types used by each building.

- **87 Node tests: PASS.** Includes real Rapier and WebSocket tests, city packing and support, minor walking wear, no passive-hand grinding, 30 Hz tracked locomotion without false punches, deliberate strikes, persistent/settled debris, colossus immunity to debris at the head/core, late joins, bounded homing and COL5 replication.
- **Syntax/import checks and 59 assets: PASS.** Existing asset files verify against the download manifest; runtime dependency versions are unchanged.
- **Multiplayer/browser smoke: PASS.** Real multiplayer server, first/third-person cameras, held Shift and focus loss, Quest stereo/turn/reach, missiles, authenticated WebRTC feeds, fallback/reconnect and XR lifecycle.
- **Rendered giant, visual, XR-view and ragdoll checks: PASS.** Hand/forearm alignment, actual city contact, roof movement/removal/reset, solid props, laser effects and the matching pilot ragdoll.
- **New architectural render test: PASS.** District, twin towers, Empire State–style tower, part attachments, persistent fragments, reset, exact late-join fragment placement and settled-pose immunity to stale snapshots.
- Reports and screenshots are in `artifacts/`. These are software and local-machine checks, not physical Quest performance measurements.

## Dense-city performance measurements before dynamic cars

Three simultaneous human video feeds delivered 23.9–29.3 presented fps; capture-to-display p95 was 63–86 ms. Encoded timestamp measurements exclude physical tracking and the work before capture. Same-machine results do not establish Wi-Fi or headset latency.

| Server scenario (8 raiders, 900 ticks) | Mean ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| Intact city | 2.19 | 2.72 | 3.76 |
| Six staged building collapses, repeated ragdolls | 6.00 | 8.01 | 28.96 |
| Active giant hand contact | 3.83 | 5.58 | 8.16 |

Typical ticks stay below the 16.67 ms budget; the largest one-time collapse/fracture spike exceeded it at 28.96 ms. The active-hand scenario recorded 52 structural contacts. Sleeping rubble leaves the active-body/snapshot budget but retains fixed collision until reset; fixed wreckage and visual fragments are bounded by the finite city rather than recycled away.

Visible Chromium on the Mac sustained 120 fps in the sampled Quest/performance rendering settings, at 1600 × 900. The Quest preset submitted about 0.98–1.01 million triangles and 145–150 draw calls in those desktop samples. The three-client emulated stereo browser test submitted about 1.89 million triangles across both eyes. Detail selection and the shared name atlas substantially reduce the full-detail district workload, but this **does not establish a physical Quest 2 frame rate**.

## Still not validated

- Physical Quest 2 stereo/optics, tracking accuracy, haptics, comfort, sustained frame rate and thermal throttling. The `quest` tier (Lambert shading, 0.8 framebuffer scale, low-poly skyline, small pools) has not been timed on a headset with the new dense district.
- Eight real humans, weak Wi-Fi, long sessions, and gameplay balance of the new breach shot / stagger / collapse loop.
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

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, the raider's own movement is immediate (prediction) while remote players interpolate, mouse aim, core/head damage, occlusion behind buildings, fuel, hold-Shift soar/release-to-hover, E dodge, the breach shot (charge ring, cooldown, cracked bay), first/third-person cameras and spectator feeds. Shatter windows with rifle fire and confirm the opening lets you fly inside. Break a brick base bay and watch the creak → delayed failure → cascade. Knock out enough of a tower base for it to tip as one island, split on landing and keep its rubble. Join late and confirm the same wreckage remains. Drop structure on the giant and confirm its health and stagger do not change. Push and destroy cars; verify synchronized moving wrecks, late spectator state and clean round resets. Use a charged weapon hit to check stagger and the exposed-core bonus. Reset rounds after collapses; no building should return on join.

## Quest 2 acceptance

Follow `QUEST2_TESTING.md`. In addition to the previous checks: confirm the dust/haptic tick when a hand crosses a bay is immediate and the server-side strike follows shortly; confirm material haptics differ (glass tinkle vs stone thud); confirm the red vignette on a weapon hit is comfortable and the camera never shakes; confirm walking stops against a tower with minor wear, holding a hand still causes no continuing damage, and deliberate punches break exposed framing; record delivered FPS with `?quality=quest` during a full tower collapse with eight raiders and rubble on screen, both with Live Views closed and open.

## Network/failure acceptance

As before: shaped ~100 ms RTT, jitter, loss and stalls; watch prediction corrections (they should read as nudges, never teleports) and delayed chunk events; reconnect through Leave/Join; server disappearance must read as disconnected.

## Known limits

Game structural model, not engineering analysis; rigid compounds; decorative skyline; simplified giant collision; no rewind hit validation, accounts, persistence or horizontal scaling. Live video targets 640 × 400 at 30 desktop / 24 headset frames per second. Cross-device Wi-Fi, remote ICE/TURN paths and headset encoding cost still need a demo-device test.
