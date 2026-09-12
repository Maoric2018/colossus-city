# Validation record and acceptance gates

## Current local validation — September 11, 2026

- **44 Node tests: PASS:** 24 dependency-free unit tests, 11 real Rapier physics tests, one real two-client WebSocket integration test, and eight XR lifecycle/input tests using fake XR frames with real Three.js math.
- **22 JavaScript modules: syntax/import checks PASS.**
- **Actual browser renderer and multiplayer: PASS.** A visible Chromium browser rendered the scene, joined the shared server and used real pointer capture/keyboard controls to ascend.
- **Meta IWER Quest 2 emulation: PASS.** Two stereo views, both Touch grips, left-stick movement, 30-degree right-stick turns, A calibration, controller tracking loss/recovery, session visibility changes, recentering and repeated exit/re-entry. No browser JavaScript, resource or shader errors were reported. The sampled intact VR view submitted 120 draw calls / 127,696 triangles across both eyes with shadows disabled. This is one view, not a worst-case GPU budget.
- **Real server benchmark: PASS on this Mac (Apple M5 Pro, Node 22.19.0).** Eight raiders, six staged collapses and repeated ragdolls: p95 2.39 ms, p99 4.11 ms, maximum 5.46 ms versus a 16.67 ms simulation budget. These are CPU measurements without network transport or headset rendering.
- **Dependency audit: zero reported vulnerabilities.** Runtime packages, test tools and transitive versions are locked in `package-lock.json`; `ws` was patched to 8.21.3. Rapier 0.17.3 now loads its explicit ES module because its default Node entry was broken.
- **USB tool installed, headset unavailable.** Android Platform Tools 37.0.1 was downloaded from Google; `npm run quest:check` found no connected device.

Current logs: `artifacts/test-results.txt`, `artifacts/syntax-results.txt`, `artifacts/browser-smoke.json`, `artifacts/physics-benchmark.json`, `artifacts/dependency-audit.json`. Screenshots: `artifacts/desktop-smoke.png` and `artifacts/quest2-emulated-stereo.png`. The original `validation-unit.txt`, `validation-syntax.txt` and `validation-layout.json` are historical source-authoring records.

## Still not validated

- Physical Quest 2 stereo/optics, head and controller tracking accuracy, haptics, comfort, sustained frame rate or thermal throttling.
- Extended interactive play, gameplay balance, eight real players, weak Wi-Fi or long-running sessions.
- USB forwarding on a connected headset; the helper is ready but no device was available.
- Docker build, Fly deployment, or trusted HTTPS/WSS end-to-end access on a headset.
- Optional Poly Haven downloads or imported third-party GLB replacements.

See [Quest 2 testing](QUEST2_TESTING.md) for the local USB workflow. Emulation does not turn these remaining hardware checks into passes.

## First connected-machine checks

Run from project root:

```sh
npm install
npm run check
npm test
npm run test:physics
npm run test:network
npm run bench
npm start
```

The physics suite checks real stepping, support loss/gravity, ragdoll creation, death/respawn, nonlethal recovery, exclusive boss ownership, cleared-cell late-join state, secondary fragmentation, body budget and round-reset body validity. A failure needs investigation, not deletion of the assertion.

In a second terminal run the optional Playwright smoke test after installing its browser. It opens two real clients, renders the actual scene, joins the same room, sends real controls and checks ascent and draw calls. Its screenshot is diagnostic output, not proof of visual quality. Software-rendered headless FPS is not representative of a laptop GPU or Quest.

`npm run bench` reports CPU/Node identity and mean/p50/p95/p99/max step times for an intact eight-player room and staged collapse/ragdoll stress. It includes some fracture/codec cost but not transport, full process contention, background rooms, GPU or headset cost. Compare the 16.67 ms simulation budget and leave substantial headroom; do not only compare the mean. Do not advertise 72 FPS based on this script.

## Two-laptop acceptance

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, takeoff/movement directions, mouse aim, core/head damage, occlusion behind buildings, boost/fuel, first/third-person cameras and spectator flight. Hold the desktop giant's click to strike a visible raider; verify both screens show matching ragdoll trajectory and recovery/death. Knock out a complete building support level and verify upper floor gravity. Shoot while another object crosses the ray; verify the server blocks the shot. Examine camera behavior in tight alleys.

Join midway through a collapse, again after old rubble has been cleared, and after round reset. No building should return simply because someone joins. Repeatedly reset the round after players have died and rubble exists: freed WASM body handles must not survive the reset. Confirm a second boss cannot take the seat. Disconnect the giant and confirm the roster labels the stand-in AI. Disconnect a laptop mid-flight; the remaining match should continue without ghost input.

## Quest 2 acceptance

Use either the local USB workflow in `QUEST2_TESTING.md` (all clients must reach the same Mac server) or the HTTPS deployed origin on all devices. Use both Touch controllers and select Colossus. Select Enter VR only via a deliberate browser click.

- Enter/exit immersive mode repeatedly. Confirm correct handedness, floor height, scale, stereo depth, head tracking and in-world HUD. Confirm the scene does not disappear when turning around.
- Press A to calibrate while standing. Move each hand slowly, then swing moderately. Confirm remote hand positions and impact timing. Compare local hand rendering against server-visible contact under ordinary Wi-Fi latency.
- Test left-stick direction while facing different ways, 30° snap-turns, controller tracking loss, headset removal, browser suspension and room disconnection. Look especially for snap-turn/recalibration movement being interpreted as an unintended high-speed strike; explicit pose resets now rebase kinematic hands with a 200 ms contact grace period; verify this still feels correct on hardware.
- Test a single raider first, then four, then eight. Cause building failures while all raiders fly and several are ragdolls. Run long enough for thermal throttling to appear. Record actual XR frame timing; a requested 72 Hz is not necessarily a delivered 72 FPS.
- Confirm no cockpit/head mesh obscures the view and no uncontrolled camera shake occurs in VR. Stop immediately if artificial locomotion is uncomfortable. Tune movement speed/comfort before public play.

This code intentionally does not request passthrough camera, real-world hit testing, scene depth, articulated hand tracking or DOM-overlay support. Those are separate feature paths, not prerequisites of this fully virtual game.

## Network/failure acceptance

Use a network shaper or actual weak Wi-Fi to test roughly 100 ms RTT, a jittering connection, packet loss and temporary stalls. WebSockets are ordered: inspect delayed chunks/events and rubber-banding rather than assuming reliable delivery means low latency. Test reconnect through Leave/Join; prior player identity is not preserved. If the server disappears, the UI must say disconnected rather than imply a still-live match. Confirm stale inputs expire and no disconnected hand continues attacking.

Test one Fly Machine, HTTPS static files, WSS upgrade, health checks, origin policy and game asset paths. Do not provision a second machine to "fix" a missing room: first check that all clients use the same address and that only one process hosts the registry. Restarting the machine loses matches by design.

## Known limits / not completed features

The art is authored stylized procedural content, not a high-detail imported NYC environment. The giant/raiders are not full animation-rig assets. Destruction is bay-level game fracture using graph connectivity, not engineering-grade structural analysis. Intact structures may retain unrealistic cantilevers. Decorations/far skyline do not break. Lower giant limbs are not a full collision rig. Imported props use optional fixed boxes. Avatar hits use simplified server shapes rather than skinned-mesh collision.

Movement uses bounded camera extrapolation, not a reconciled prediction/rollback system. No rewind hit validation, WebRTC/TURN, authenticated accounts, reconnect tokens, persistence, horizontal scaling or public-service abuse protection is implemented. Graph/body/particle limits bound some costs but not every GPU/solver workload. Polished art, physical plausibility, stability and smooth Quest frame rate still require real-device evaluation and iteration.
