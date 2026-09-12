# Validation record and acceptance gates

## Current local validation — September 11, 2026

- **52 Node tests: PASS:** 24 dependency-free unit tests, 11 real Rapier physics tests, six movement/projectile tests, one real multiplayer/debug-channel integration test, and ten XR lifecycle/input tests using fake XR frames with real Three.js math.
- **33 JavaScript modules: syntax/import checks PASS.** All 55 bundled asset files pass SHA-256 verification.
- **Actual browser renderer and multiplayer: PASS.** Chromium renders the imported art and uses real pointer capture/keyboard controls for ascent, hover/soar switching, fast flight and directional dodge. Two raider clients and a Quest client publish real images into a fourth spectator client. Closing the panel stops capture.
- **Meta IWER Quest 2 emulation: PASS.** Stereo views, Touch mapping, proportional smooth yaw, 0.5 m physical controller extension reaching 7 m on the actual server, trigger-fired missiles, A calibration, controller tracking loss/recovery, visibility changes, recentering and repeated exit/re-entry. No browser JavaScript, resource or shader errors were reported. The sampled intact VR view submitted 156 draw calls / 442,548 triangles across both eyes with shadows disabled, before live-view capture. This is one view, not a worst-case GPU budget.
- **Spectator visual inspection: PASS.** Headset left-eye scene, projection and in-world HUD match the emulated headset. Smoke/glow billboards now account for the giant camera scale; they no longer swamp the mirrored view. Actual player images are separated from explicitly simulated AI cameras.
- **Real server benchmark: PASS on this Mac (Apple M5 Pro, Node 22.19.0).** Eight raiders, six staged collapses and repeated ragdolls: p95 4.37 ms, p99 7.08 ms, maximum 9.89 ms versus a 16.67 ms simulation budget. These are CPU measurements without network transport or headset rendering.
- **Dependency installation audit: zero reported vulnerabilities.** Runtime packages, test tools and transitive versions are locked in `package-lock.json`. This audit was performed during dependency setup, not repeated for this controls-only dependency tree.
- **USB tool installed, headset unavailable.** Android Platform Tools 37.0.1 was downloaded from Google; the earlier `npm run quest:check` found no connected device.

Current logs: `artifacts/test-results.txt`, `artifacts/syntax-results.txt`, `artifacts/browser-smoke.json`, `artifacts/visual-report.json`, `artifacts/physics-benchmark.json`. Screenshots include `artifacts/raider-soaring.png`, `artifacts/spectator-panel.png`, `artifacts/quest2-while-watched.png` and `artifacts/quest2-emulated-stereo.png`. Older validation files are historical records.

## Arm orientation and self-glow regression

`npm run test:xr-view` reproduces stationary-controller turning with the real Quest 2 emulator and imported armor. Before the fix, forearms could twist by about 163 degrees in headset space while the fists stayed still. Limb swing is now solved relative to the giant’s body rotation before applying world yaw. The test covers tilted head/wrists, an offset standing position, a complete turn and yaw wraparound, and checks rendered mesh transforms. The pilot and its mirrored view exclude the local reactor halo; other players retain it. Reports and before/after-turn images are in `artifacts/xr-view-report.json` and `artifacts/xr-hands-*.png`.

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

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, takeoff/movement directions, mouse aim, core/head damage, occlusion behind buildings, boost/fuel, F hover/soar, E directional dodge, first/third-person cameras and spectator feeds/flight. Hold the desktop giant's click to strike a visible raider; verify both screens show matching ragdoll trajectory and recovery/death. Knock out a complete building support level and verify upper floor gravity. Shoot while another object crosses the ray; verify the server blocks the shot. Examine camera behavior in tight alleys.

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

The environment combines downloaded Kenney/Poly Haven assets and Quaternius mech armor with authored destructible bays. It is a stylized harbor, not a photorealistic NYC environment. The giant/raiders use rigid posing rather than full animation rigs. Destruction is bay-level game fracture using graph connectivity, not engineering-grade structural analysis. Intact structures may retain unrealistic cantilevers. Decorations/far skyline do not break. Lower giant limbs are not a full collision rig. Imported props use optional fixed boxes. Avatar hits use simplified server shapes rather than skinned-mesh collision.

Movement uses bounded camera extrapolation, not a reconciled prediction/rollback system. No rewind hit validation, WebRTC/TURN, authenticated accounts, reconnect tokens, persistence, horizontal scaling or public-service abuse protection is implemented. Graph/body/particle limits bound some costs but not every GPU/solver workload. Physical plausibility, balance, stability and sustained Quest frame rate still require real-device evaluation and iteration. Live feeds are low-resolution previews capped at six updates per second, with transport delay and extra capture cost; they do not record headset system overlays or passthrough.
