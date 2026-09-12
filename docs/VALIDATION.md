# Validation record and acceptance gates

## Current local validation — September 11, 2026

- **68 Node tests: PASS:** 24 dependency-free unit tests, 11 real Rapier physics tests, six movement/projectile tests, three prop collision/impact tests, three ragdoll/speed tests, one real multiplayer/debug-channel integration test, three video signaling/fallback tests, seven hand-contact/replication tests, and ten XR lifecycle/input tests using fake XR frames with real Three.js math.
- **50 JavaScript modules: syntax/import checks PASS.** All 59 bundled asset files pass SHA-256 verification.
- **Actual browser renderer and multiplayer: PASS.** Chromium renders the imported art and uses real pointer capture/keyboard controls for ascent, hold-Shift soaring, release/focus-loss return to hover, fast flight and directional dodge. Two raider clients and a Quest client publish WebRTC video into a fourth spectator client. Closing the panel stops capture.
- **Meta IWER Quest 2 emulation: PASS.** Stereo views, Touch mapping, proportional smooth yaw, 0.5 m physical controller extension reaching 7 m on the actual server, trigger-fired missiles, A calibration, controller tracking loss/recovery, visibility changes, recentering and repeated exit/re-entry. No browser JavaScript, resource or shader errors were reported. The sampled intact VR view submitted 154 draw calls / 442,524 triangles across both eyes with shadows disabled, before live-view capture. This is one view, not a worst-case GPU budget.
- **Spectator visual inspection: PASS.** Headset left-eye scene, projection and in-world HUD match the emulated headset. Smoke/glow billboards now account for the giant camera scale; they no longer swamp the mirrored view. Actual player images are separated from explicitly simulated AI cameras.
- **Real server benchmark: PASS on this Mac (Apple M5 Pro, Node 22.19.0).** Eight raiders, six staged collapses and repeated ragdolls: p95 2.79 ms, p99 3.84 ms, maximum 9.02 ms versus a 16.67 ms simulation budget. These are CPU measurements without network transport or headset rendering.
- **Dependency installation audit: zero reported vulnerabilities.** Runtime packages, test tools and transitive versions are locked in `package-lock.json`. This audit was performed during dependency setup, not repeated for this controls-only dependency tree.
- **USB tool installed, headset unavailable.** Android Platform Tools 37.0.1 was downloaded from Google; the earlier `npm run quest:check` found no connected device.

Current logs: `artifacts/test-results.txt`, `artifacts/syntax-results.txt`, `artifacts/browser-smoke.json`, `artifacts/visual-report.json`, `artifacts/physics-benchmark.json`. Screenshots include `artifacts/raider-soaring.png`, `artifacts/spectator-panel.png`, `artifacts/quest2-while-watched.png` and `artifacts/quest2-emulated-stereo.png`. Older validation files are historical records.

## Arm orientation and self-glow regression

`npm run test:xr-view` reproduces stationary-controller turning with the real Quest 2 emulator and imported armor. Before the fix, forearms could twist by about 163 degrees in headset space while the fists stayed still. Limb swing is now solved relative to the giant’s body rotation before applying world yaw. The test covers tilted head/wrists, an offset standing position, a complete turn and yaw wraparound, and checks rendered mesh transforms. The pilot and its mirrored view exclude the local reactor halo; other players retain it. Reports and before/after-turn images are in `artifacts/xr-view-report.json` and `artifacts/xr-hands-*.png`.

## Rigid arms, solid props and raider art

`test:xr-view` now also sweeps short, extended, overhead and backward reaches with the rendered imported armor. The largest scale change was below 0.00000002; tracked fist position error was zero, and extreme reach exercised the extending piston. Existing full-yaw and hidden self-halo checks still pass.

The three prop regressions use real Rapier ray casts and movement: cars stop raider capsules; lamps/signboards block shots; antenna collision follows a detached bay and resets; car impacts emit surface normals without boss damage. The structural tests separately retain their hollow-bay volume/containment assertions, excluding equipment above the roof. The visual check follows actual collapsed roof art, verifies the padded camera ray stops at a car, and renders the new raider front/back and laser core, glow, travelling pulse, sparks and surface ring. Screenshots are `artifacts/visual-raider-front-back.png`, `artifacts/visual-raider-laser.png`, `artifacts/desktop-smoke.png` and `artifacts/raider-soaring.png`.

## Raider ragdoll and giant catch-up speed

`npm run test:ragdoll` compares all 31,674 surface vertices against the live pilot at knockdown, both hovering and soaring: maximum position difference below 0.000004 m and identical vertex colors. It then follows 90 actual Rapier steps, checks that the skin stays near the body, recreates the fallen pose from late-join metadata, and exercises the application add/remove handlers. Skeletons remain independent, and a separate Quest-profile stereo view renders the skin without shader errors. Screenshots and measurements are in `artifacts/ragdoll-*.png` and `artifacts/ragdoll-report.json`.

New physics checks verify all eleven named bodies, connected joints through a ground tumble, and inherited soaring orientation. Giant locomotion covers 13 m in one second with either keyboard or Quest inputs, including diagonals; normal raider flight is 11 m/s. Soaring remains the faster escape option. Existing knockdown recovery and death/respawn tests still pass.

## Low-latency spectator video and camera toggle

The browser test runs two actual raider clients, a stereo Quest-profile giant and a spectator. Each publisher stamps a binary timestamp into its outgoing canvas; the spectator decodes those pixels when video is presented. This covers the encoder, media transport and video presentation on the same Mac. The last measured run presented 29.6 / 27.5 fps for raiders and 23.9 fps for the emulated Quest; median capture-to-display delays were 72 / 61 / 55 ms, with p95 at 73 / 63 / 58 ms respectively. No decoder frames were dropped. These are local measurements, not physical Quest or remote-network results.

The test uses the video's `presentedFrames` counter because frame callbacks can skip presentations; counting callbacks alone incorrectly understated the Quest rate. It also verifies first-person default, both camera-toggle controls, actual video on every human card, a forced per-feed fallback without interrupting other feeds, track/peer cleanup on closing the panel, and automatic player/spectator reconnection with the current roster. Protocol tests reject unauthorized signaling and confirm a slow fallback viewer receives the newest queued image rather than a backlog. See `artifacts/browser-smoke.json` and `scripts/measure-views.mjs` for the reproducible measurements. The test requires at least 20 presented fps per human feed and local p95 below 250 ms.

## Solid giant hands and anatomical joints

The imported forearm previously extended roughly 3.55 m past its intended wrist endpoint, while building damage used a smaller spherical sweep and ignored speeds below 3 m/s. The rebuilt rigid armor now stays within its joint span. A separate wrist connector keeps the forearm away from the palm; neck, shoulder, elbow, hip, knee and ankle sockets join the visible body parts. Hand meshes and contact boxes share dimensions and grip-space orientation.

`npm run test:giant` measures every rendered fist vertex against a wall and checks nine ordinary pitch/roll wrist poses: zero palm/forearm vertex overlap, zero wrist attachment error and zero visible hand penetration at wall contact. In a live Quest-profile session approaching an actual city wall, local and authoritative palm positions matched within 0.000001 m after the next pose/snapshot exchange. The Node regressions cover slow first touch, sustained pressure, a punch crossing an entire building in one tick, rotated knuckle corners, surface sliding, open space, recenter/yaw suppression, real Rapier shape agreement, and wrist rotation through the server, codec and interpolator. `test:xr-view` retains its full-turn, reach and self-halo checks. Screenshots and metrics are saved as `artifacts/giant-*.png` and `artifacts/giant-contact-report.json`.

The server benchmark now includes eight raiders with active giant hand contacts. The most recent run measured p95 1.95 ms for that scenario and 2.79 ms for staged collapses/ragdolls, below the 16.67 ms step budget. These remain local CPU measurements. Physical Quest contact feel and long-session frame rate still require a headset test.

## Still not validated

- Physical Quest 2 stereo/optics, head and controller tracking accuracy, haptics, comfort, sustained frame rate or thermal throttling.
- Extended interactive play, gameplay balance, eight real players, weak Wi-Fi or long-running sessions.
- USB forwarding on a connected headset; the helper is ready but no device was available.
- Docker build, Fly deployment, or trusted HTTPS/WSS end-to-end access on a headset.
- Optional replacement GLBs beyond the bundled imported assets.

See [Quest 2 testing](QUEST2_TESTING.md) for the local USB workflow. Emulation does not turn these remaining hardware checks into passes.

## First connected-machine checks

Run from project root:

```sh
npm ci
npm run check
npm run test:all
npm run bench
npm start
```

The physics suite checks real stepping, support loss/gravity, ragdoll creation, death/respawn, nonlethal recovery, exclusive boss ownership, cleared-cell late-join state, secondary fragmentation, body budget and round-reset body validity. A failure needs investigation, not deletion of the assertion.

In a second terminal run the optional Playwright smoke test after installing its browser. It opens four real clients, renders the actual scene, joins the same room and exercises flight, missiles, tracked reach and the live spectator panel. Its screenshot is diagnostic output, not proof of visual quality. Software-rendered headless FPS is not representative of a laptop GPU or Quest.

`npm run bench` reports CPU/Node identity and mean/p50/p95/p99/max step times for an intact eight-player room and staged collapse/ragdoll stress. It includes some fracture/codec cost but not transport, full process contention, background rooms, GPU or headset cost. Compare the 16.67 ms simulation budget and leave substantial headroom; do not only compare the mean. Do not advertise 72 FPS based on this script.

## Two-laptop acceptance

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, takeoff/movement directions, mouse aim, core/head damage, occlusion behind buildings, fuel, hold/release either Shift to soar/hover, E directional dodge, first/third-person cameras and spectator feeds/flight. Hold the desktop giant's click to strike a visible raider; verify both screens show matching ragdoll trajectory and recovery/death. Knock out a complete building support level and verify upper floor gravity. Shoot while another object crosses the ray; verify the server blocks the shot. Examine camera behavior in tight alleys.

Join midway through a collapse, again after old rubble has been cleared, and after round reset. No building should return simply because someone joins. Repeatedly reset the round after players have died and rubble exists: freed WASM body handles must not survive the reset. Confirm a second boss cannot take the seat. Disconnect the giant and confirm the roster labels the stand-in AI. Disconnect a laptop mid-flight; the remaining match should continue without ghost input.

## Quest 2 acceptance

Use either the local USB workflow in `QUEST2_TESTING.md` (all clients must reach the same Mac server) or the HTTPS deployed origin on all devices. Use both Touch controllers and select Colossus. Select Enter VR only via a deliberate browser click.

- Enter/exit immersive mode repeatedly. Confirm correct handedness, floor height, scale, stereo depth, head tracking and in-world HUD. Confirm the scene does not disappear when turning around.
- Press A to calibrate while standing. Move each hand slowly, then swing moderately. Confirm remote hand positions and impact timing. Compare local hand rendering against server-visible contact under ordinary Wi-Fi latency.
- Test left-stick direction while facing different ways, continuous analog right-stick turns, controller tracking loss, headset removal, browser suspension and room disconnection. Look especially for artificial turn/recalibration movement being interpreted as an unintended high-speed strike; artificial yaw is excluded from physical strike velocity, and explicit pose resets rebase kinematic hands with a 200 ms contact grace period; verify this still feels correct on hardware.
- Fire both controller triggers. Check visible rocket direction, collision with thin walls and raiders, cooldown, splash damage and destruction. Open Live Views on a laptop and compare its left-eye preview to the headset while moving. Record headset FPS with capture both open and closed.
- Test a single raider first, then four, then eight. Cause building failures while all raiders fly and several are ragdolls. Run long enough for thermal throttling to appear. Record actual XR frame timing; a requested 72 Hz is not necessarily a delivered 72 FPS.
- Confirm no cockpit/head mesh obscures the view and no uncontrolled camera shake occurs in VR. Stop immediately if artificial locomotion is uncomfortable. Tune movement speed/comfort before public play.

This code intentionally does not request passthrough camera, real-world hit testing, scene depth, articulated hand tracking or DOM-overlay support. Those are separate feature paths, not prerequisites of this fully virtual game.

## Network/failure acceptance

Use a network shaper or actual weak Wi-Fi to test roughly 100 ms RTT, a jittering connection, packet loss and temporary stalls. WebSockets are ordered: inspect delayed chunks/events and rubber-banding rather than assuming reliable delivery means low latency. Test reconnect through Leave/Join; prior player identity is not preserved. If the server disappears, the UI must say disconnected rather than imply a still-live match. Confirm stale inputs expire and no disconnected hand continues attacking.

Test one Fly Machine, HTTPS static files, WSS upgrade, health checks, origin policy and game asset paths. Do not provision a second machine to "fix" a missing room: first check that all clients use the same address and that only one process hosts the registry. Restarting the machine loses matches by design.

## Known limits / not completed features

The environment combines downloaded Kenney/Poly Haven assets and Quaternius mech armor with authored destructible bays. It is a stylized harbor, not a photorealistic NYC environment. The giant and live raider use rigid posing; the matching ragdoll uses a continuous skin driven by eleven server physics bodies. Destruction is bay-level game fracture using graph connectivity, not engineering-grade structural analysis. Intact structures may retain unrealistic cantilevers. Decorations/far skyline do not break. Lower giant limbs are not a full collision rig. Street props use fixed box proxies; rooftop equipment contributes boxes to its collapsing bay. Avatar hits use simplified server shapes rather than skinned-mesh collision.

Movement uses bounded camera extrapolation, not a reconciled prediction/rollback system. No rewind hit validation, bundled TURN service, authenticated accounts, reconnect tokens, persistence, horizontal scaling or public-service abuse protection is implemented. Graph/body/particle limits bound some costs but not every GPU/solver workload. Physical plausibility, balance, stability and sustained Quest frame rate still require real-device evaluation and iteration. Live video has transport delay and extra capture cost; its 30 fps desktop / 24 fps VR capture targets are not measured headset frame rates; the feeds do not record headset system overlays or passthrough.
