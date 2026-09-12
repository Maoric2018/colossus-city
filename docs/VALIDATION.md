# Validation record and acceptance gates

## Current local validation — September 11, 2026 (branch `overhaul/smooth-city`, Windows 11, Intel Core i7-1355U / Iris Xe)

- **62 Node tests: PASS.** 28 dependency-free unit tests (district generation, setback continuity, graph support, load model, skin openings, codec COL3, shared flight model), 16 real Rapier physics tests (layered skins, merged-floor colliders, delayed load cascades, islands and toppling, two-stage fracture, crumble, giant crushed by debris, torso shove, budgets, resets, XR recenter/tracking loss), 7 movement/projectile tests (incl. the breach shot), one real multiplayer/debug-channel integration test and 11 XR lifecycle tests.
- **57 JavaScript modules: syntax/import checks PASS.**
- **Server benchmark (`npm run bench`)**: eight raiders intact 1.7 ms mean / 3.4 ms p99 per tick; eight raiders with six staged tower collapses and repeated ragdolls 7.2 ms mean / 15.9 ms p99, worst single tick 29.8 ms (an island creation/split) against the 16.67 ms budget. Before the merged-floor and box-debris collider work the same scenarios measured 5.5 ms and 25 ms mean (max 122 ms) on this CPU.
- **Real GPU profile (`npm run profile`, visible Chromium, 1600×900)**: tier `low` (auto-selected for Iris Xe) 55–58 fps vsync-locked with ~7.7 ms frame work in lobby, flight and combat; `quest` tier equivalent on this GPU; `medium` (shadows) 43–50 fps; `high` (shadows + bloom, the previous default look) 36–39 fps. Draw calls ~120 in play on `low`.
- **Browser smoke test (`npm run test:browser`)**: real WebGL/WebSocket/Rapier with Meta IWER's Quest 2 profile — see `artifacts/browser-smoke.json` for the latest run and its check list.

Artifacts: `artifacts/render-profile.json`, `artifacts/physics-benchmark.json`, `artifacts/browser-smoke.json`, `artifacts/profile-*.png`.

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

Create a giant room in one browser and join from a second laptop as a raider. Confirm matching room/round, the raider's own movement is immediate (prediction) while remote players interpolate, mouse aim, core/head damage, occlusion behind buildings, boost/fuel, F hover/soar, E dodge, the breach shot (charge ring, cooldown, cracked bay), first/third-person cameras and spectator feeds. Shatter windows with rifle fire and confirm the opening lets you fly inside. Break a brick base bay and watch the creak → delayed failure → cascade. Knock out enough of a tower base for it to tip as one island, split on landing and crumble. Drop structure on the giant and confirm the stagger, the exposed-core bonus and the announcer feed on both screens. Reset rounds after collapses; no building should return on join.

## Quest 2 acceptance

Follow `QUEST2_TESTING.md`. In addition to the previous checks: confirm the dust/haptic tick when a hand crosses a bay is immediate and the server-side strike follows shortly; confirm material haptics differ (glass tinkle vs stone thud); confirm the red vignette on being crushed is comfortable and the camera never shakes; confirm walking into a tower slows the giant and breaks bays; record delivered FPS with `?quality=quest` during a full tower collapse with eight raiders and rubble on screen, both with Live Views closed and open.

## Network/failure acceptance

As before: shaped ~100 ms RTT, jitter, loss and stalls; watch prediction corrections (they should read as nudges, never teleports) and delayed chunk events; reconnect through Leave/Join; server disappearance must read as disconnected.

## Known limits

Game structural model, not engineering analysis; rigid compounds; decorative skyline; simplified giant collision; no rewind hit validation, WebRTC, accounts, persistence or horizontal scaling. Live feeds are low-resolution previews. All numbers above are from one laptop; the headset is the missing measurement.
