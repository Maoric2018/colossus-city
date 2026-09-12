# COLOSSUS CITY
### One giant. Eight jetpack raiders. A city that comes apart.

Asymmetric multiplayer source prototype for a **Meta Quest 2 giant** and **laptop raiders**. Three.js renders the city; one Node.js server runs Rapier physics; WebSockets carry inputs, tracked poses, world snapshots and reliable destruction events.

**Validation status (September 11, 2026):** dependencies installed and locked; **52 Node tests pass**, including real Rapier physics and WebSocket multiplayer. The real Three.js renderer and Meta IWER's **Quest 2 profile** pass browser tests for stereo VR, Touch controls, calibration, tracking loss/recovery, suspension and repeated VR entry/exit. The server's eight-player collapse benchmark passes its 16.67 ms step budget on this Mac. **No physical Quest 2 was connected: headset frame rate, physical tracking, haptics and comfort remain unverified.** See [Quest 2 setup and results](docs/QUEST2_TESTING.md).

## 1. Start on a laptop

Install Node.js **22 or later**, unzip the project, and run these commands in this directory:

```sh
npm ci
npm test
npm run test:physics
npm run test:network
npm start
```

Open **http://localhost:8080**. Keep the terminal running. Do not open `index.html` directly. Do not start a separate frontend development server; the supplied server serves the client and WebSocket endpoint together. No API keys, database, paid art assets or build step are needed. Package versions and the full dependency tree are pinned in `package-lock.json`; use `npm ci` for repeatable installs.

For a solo test, select **Raider → Enter Practice** to fight the AI giant, or **Colossus → Enter Practice** to swat three clearly labeled server-controlled practice drones. The desktop giant exists so you can test the game without the headset.

For laptop multiplayer, select a role and **Create Room**. Other tabs/devices select their role, enter the six-character room code, and select **Join Room**. **Copy Invite** copies the same server URL with the room code filled in. A room has one giant seat, up to eight raiders, and spectator seats; total connections per room are limited to sixteen. A second giant is rejected. An empty giant seat is filled by an explicitly labeled AI stand-in. Humans replace practice drones.

## 2. Put the Quest and laptops in the same game

**Immersive WebXR needs a secure origin.** Laptop loopback `http://localhost` is usable for local development, but `http://192.168.x.x:8080` is not a secure WebXR origin on the headset. On the Quest, `localhost` refers to the Quest unless USB port forwarding is configured as below. Use a deployed HTTPS address for a wireless cross-device setup; clients automatically use WSS on HTTPS. A plain LAN HTTP address can serve desktop clients but is not the headset VR solution.

### Local Quest 2 test over USB

Android Platform Tools have been downloaded to `.tools/platform-tools/` on this Mac. Enable Developer Mode for the Quest, connect a USB data cable and accept **USB debugging** inside the headset. Keep `npm start` running, then use a second terminal:

```sh
npm run quest:usb
```

Open **http://localhost:8080 in Meta Quest Browser**, choose **Colossus**, create a room (or enter practice), select **Continue**, then **Enter VR**. This forwards the headset's loopback port to the Mac, including the WebSocket connection. Keep the cable connected. The Mac can use the same localhost address as a Raider; other laptops on the same Wi-Fi can join the Mac's LAN address and room code. The local USB route follows [Meta's browser debugging workflow](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/).

### Wireless / deployed setup

After deploying:

1. Open the deployed HTTPS address in **Meta Quest Browser** on the Quest 2. Use both Touch controllers. Choose **Colossus**, create or join the room, close the initial panel, then select **Enter VR** and grant the browser's immersive-VR permission.
2. Open the **same deployed address** on every laptop, choose **Raider**, and join using the same room code. Do not mix the local server and deployed server: they have different room state.
3. Keep a clear physical play area and the headset's boundary system enabled. Start stationary, using the sticks. Large arm swings in the game do not make real furniture safe.

This game does not require its own native Android app, Unity export, camera passthrough access, mixed-reality depth API, or Quest 3 features. The normal headset/browser setup still applies. It uses tracked head and controller poses from an `immersive-vr` session with `local-floor`. Both controllers must be tracked to send a fresh attack pose. Tracking loss suspends movement/contact; entry, recentering, calibration and recovered tracking rebase the hands with a short contact grace period. It requests 72 Hz only when that capability is reported, and uses feature-detected haptics/foveation. That is **not** an achieved-frame-rate measurement.

### Fly.io deployment

The included `Dockerfile` and `fly.toml` host both HTTP and WebSockets. These commands require your own authenticated Fly CLI/account. Deployment creates billable infrastructure; nothing has been deployed by the source author.

Replace `YOUR-UNIQUE-APP` consistently with an unused app name:

```sh
fly apps create YOUR-UNIQUE-APP
fly deploy --app YOUR-UNIQUE-APP --ha=false
fly scale count 1 --app YOUR-UNIQUE-APP
fly status --app YOUR-UNIQUE-APP
fly logs --app YOUR-UNIQUE-APP
```

Open `https://YOUR-UNIQUE-APP.fly.dev`. The `--app` option overrides the placeholder app name in `fly.toml`; alternatively edit that field once. The default region is `iad`; choose a supported region close to all players. The default is one performance CPU / 1 GB RAM as a starting point, **not a validated capacity claim**. The process is single-threaded, so multiple CPUs alone do not parallelize room physics.

**Run exactly ONE Machine.** Rooms live in one process, not Redis or a database. Fly's default redundant deployment can create two independent room registries unless high availability is disabled. Scaling to two independent machines will cause missing rooms or split lobbies. Horizontal scale requires deliberate room-to-process routing and is not implemented. The config uses immediate deployment; updating or restarting the process ends active matches. Autostop is disabled for a live demo: stop/delete the Machine afterward to avoid ongoing runtime charges. Do not redeploy during a match.

The server supports local TLS when both `TLS_CERT` and `TLS_KEY` are set. A certificate must actually be trusted by the headset; bypassing a browser certificate warning is not a dependable WebXR setup. Use the deployed HTTPS route rather than disabling browser security.

## Controls

| Player | Controls |
| --- | --- |
| Laptop raider | WASD move relative to view; mouse aim; hold Space for jetpack ascent; F toggles hover/soar; E + direction dodges; Shift boost; C descend; hold left mouse to fire; V first/third-person view; Q quality; Escape release pointer. |
| Quest giant | Move your head and both controllers to embody the giant. Swing into raiders/buildings; no trigger is required for contact damage. Left stick moves the giant; right stick turns smoothly (90°/s default); either trigger launches a missile; right-controller A recalibrates standing height. |
| Desktop giant | WASD locomotion; mouse view; hold left click for a sweeping hand; Space for repeated downward strikes; right click or R fires missiles. |
| Spectator | Live views opens a panel with every player’s game camera. Select a feed to enlarge it. Free Camera enables mouse + WASD flight; Space up; C down. |

**Giant reach:** the default 14× world scale maps a physical 0.5 m controller movement to 7 m in the city. The server now preserves that full reach without a slow positional catch-up. Before entering VR, open **Quest Controls** to adjust turn speed (30–180°/s) or reach gain (0.5–1.5×). A calibration adjusts the giant scale for your standing height; the headset HUD shows the resulting reach. Smooth turning pivots around your head, and artificial rotation is excluded from hand-strike velocity.

**Flight:** hold Space to take off, then press F to soar. The pilot flies prone, mouse aim steers the flight path, and S brakes. Hover stays at 11 m/s (20 boosted); soaring reaches 32 m/s (42 boosted). E dodges in your held WASD/Space/C direction, or forward when no direction is held. Dodges use 12% thrust and have a 1.2-second cooldown. Speed streaks, a wider field of view and banking communicate acceleration.

**Missiles:** point a Touch controller and pull its trigger. Rockets travel at 55 m/s, explode against scenery/raiders, damage nearby raiders and destroy building bays. The server enforces a shared 0.8-second firing cooldown and an eight-projectile cap.

**Debugging:** on a laptop in the same room, press **Escape → Live Views** to open a spectator tab, or enter the room code and select **Spectate**. It receives live game images from every human player, including the colossus’s actual left-eye pose and in-world HUD. Feeds are 640 × 400 at up to six updates per second, with aspect ratio preserved; they are delayed debug previews, not a headset system-screen recording. AI drone cameras are explicitly labeled simulated. Capture runs only while the panel is open; headset rendering incurs an extra low-resolution eye render when watched. Free Camera stops capture. A small indicator on the playing client shows when viewers are watching.

The raiders win by reducing the giant's core health to zero. Headshots do more damage. The giant wins by surviving the four-minute round; kills and city destruction are tracked as its score. Dead raiders respawn after five seconds. Nonfatal impacts temporarily knock players into ragdolls before recovery. A fresh round begins twenty seconds after the result; the host can also select New Round. **Escape does not pause the server.**

## What is implemented in source

### Contact and ragdolls

Raider movement is server-owned dynamic-capsule physics. A hand's **swept path** is checked each physics tick to catch fast contact. Relative impact velocity determines knockback/damage. A struck player becomes **eleven actual rigid bodies joined at the pelvis, spine, neck, shoulders, elbows, hips and knees**; elbows/knees use limited hinges. Debris can also knock down raiders. Clients receive the same authoritative limb transforms rather than inventing different local collisions. Live avatars are lightweight rigid humanoid meshes, not high-end animated/skinned characters.

### Destruction

The city has ten destructible buildings comprising **316 hollow structural bays**, with slabs, columns and exterior wall collision pieces. A support graph starts at foundation cells. Knocked-out bays detach; disconnected upper sections become falling compound floor chunks. High-speed subsequent impacts can split a floor chunk into its constituent bays, preserving its linear and rotational motion approximately. Debris receives gravity and collides with the world; impact particles are purely cosmetic. Late joiners receive all surviving chunks and cleared-cell tombstones.

This is **pre-authored, support-based game destruction**, not finite-element engineering or automatic fracture of arbitrary downloaded meshes. Connected structures can retain unrealistic cantilevers; material fatigue, bending strength, rebar, rubble crushing and arbitrary cracks are not modeled. Slabs/columns/walls within one bay remain a compound piece. Decorations such as cars, bridges and the far skyline are not destructible. The giant uses tracked hands and simplified head/core collision zones, not a fully simulated giant body.

### Environment and presentation

The harbor now uses downloaded Kenney skyscrapers, vehicles, industrial equipment and astronauts, plus Quaternius's textured Stan mech adapted to tracked armor parts. Poly Haven provides photographic asphalt/concrete maps and the cloud panorama used for lighting and reflections. New window framing, animated water and downloaded smoke, spark and muzzle sprites complete the scene. Rooftop equipment follows its supporting bay through collapse, removal and reset.

Repeated models are merged by material and instanced. Quest uses a smaller skyline, capped particle pools, a 1K sky and no shadow/bloom passes; desktop uses a 2K sky and shadows/bloom. All assets are served locally and are bundled in the repository. The scene has been inspected in Chromium and in emulated Quest 2 stereo.

## 3. Swap the city or use imported assets

The single source of truth is `shared/environment.js`. Change the layout/sky/texture paths, register a different environment, and select it via `activeEnvironment`. The server and browser import the same definition. The default ground, roads, bridge/background arrangement are Harbor-specific style code in `src/city.js`; a very different setting also requires replacing those dressing functions. See `docs/ASSET_PIPELINE.md`.

For repeated custom building art, put a **normalized, unskinned GLB structural bay** in `public/assets/`, then set `cellAssets[style]`. The loader instances its source meshes across matching cells and moves them with server destruction. Use separate `wall_n`, `wall_e`, `wall_s`, `wall_w`, and `roof` nodes so the loader can hide interior walls and non-roof decorations. Collision remains the shared hollow-bay representation. Entire monolithic city GLBs are decoration, not magically breakable architecture.

`props` accepts local GLBs and optional simple fixed-box collision descriptors. Prefer same-origin assets: the supplied content security policy intentionally does not permit arbitrary asset CDNs. There is no Draco/KTX2 decoder pipeline wired in yet; export ordinary GLB or add/test the required decoders.

Refresh the bundled photographic textures, or verify every imported asset without downloading:

```sh
npm run assets
npm run assets -- --verify
```

The refresh checks source hashes before replacing files. Models, textures and source records are already bundled under `public/assets/imported/`; launching the game needs no art download. `npm run test:visual` verifies imported models against real physics collapse and saves screenshots.

## 4. Performance and verification

Physics is targeted at **60 fixed steps/s**, snapshots at **20/s**, inputs/poses at **30/s**. Remote objects are interpolated over ~100 ms. The local raider camera uses bounded extrapolation, not a second authoritative solver. WebSockets are reliable and ordered; poor Wi-Fi can introduce head-of-line delay. This is a hackathon networking choice, not a rollback/lag-compensated competitive netcode stack.

Caps: 144 debris bodies, eight ragdolls, eight raiders. Under pressure, new collapses are coarsened; at full capacity additional damage waits rather than deleting a falling tower. Rigid-body caps do not imply only 144 colliders: hollow bays have multiple collision shapes. The maximum configured binary snapshot example is 7,964 bytes, or ~159 KB/s per receiving client at 20 Hz, **before** event/WS/TLS overhead. This is a calculated budget, not a network measurement.

Rendering uses instanced building pieces, merged detail geometry, shared materials, bounded particles, and no bloom/shadow pass by default on Quest. XR uses a 0.85 framebuffer scale request and foveation where supported. None of these settings proves that your Quest achieves 72 FPS. Profile the full eight-player collapse, not just the lobby.

```sh
npm run check          # Syntax and local import existence, no packages needed
npm test               # 24 dependency-free checks
npm run test:physics   # Actual Rapier stepping, joints, collapse, reset
npm run test:network   # Actual multiplayer + spectator-channel integration
npm run test:xr        # VR lifecycle/input regressions (fake frames, real Three math)
npm run test:all       # All 52 Node tests after installation
npm run bench          # Real server-physics profile; outputs local results
```

Real desktop rendering and Quest 2 emulation test (starts its own isolated server):

```sh
# Chromium is already downloaded on this Mac. For a fresh installation:
PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium
# Visible browser required for reliable real mouse capture on macOS:
HEADED=1 npm run test:browser
```

The browser test uses real Three.js, WebSockets and Rapier; only the headset hardware is emulated by Meta IWER. Screenshots and results go into `artifacts/`. Python is not needed for this test. The original optional Python smoke script remains available.

Inspect `docs/VALIDATION.md` for headset testing and known limitations. Do not treat a syntax check, unit test, server benchmark or emulated browser session as headset verification.

## Source guide

- `server/room.js`: authoritative movement, tracked contacts, ragdolls, support graph, fractures, match lifecycle.
- `server/index.js`: HTTP/WSS hosting, room routing, input limits, tick loop and snapshots.
- `server/abilities.js`: server-owned flight, directional dodges and missile collisions.
- `server/views.js`, `src/spectator.js`: bounded room-authenticated live debug feeds.
- `src/missiles.js`, `src/flight-fx.js`: imported rockets and flight presentation.
- `shared/`: environment definition, physics/network budgets, analytic helpers, binary codec.
- `src/city.js`, `avatars.js`, `effects.js`: render-side art, imports and cosmetic effects.
- `src/xr.js`: standard WebXR session, Quest controller input, scale, smooth turning and HUD.
- `src/main.js`, `network.js`: lobby, desktop controls/camera, input and interpolation.
- `docs/ARCHITECTURE.md`: authority, bandwidth, failure modes and scaling boundary.
- `docs/ASSET_PIPELINE.md`: precise GLB conventions and environment replacement.
- `docs/VALIDATION.md`: performed/not-performed checks and real-device acceptance list.

Original source/assets use the MIT license. Dependencies and subsequently imported assets retain their own licenses. See `LICENSE` and `public/assets/README.md`.

## API references

Implementation references checked September 11, 2026; installed versions are pinned in package.json.

- WebXR session/security: https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession
- Three.js XR manager: https://threejs.org/docs/pages/WebXRManager.html
- Rapier rigid bodies: https://rapier.rs/docs/user_guides/javascript/rigid_bodies/
- Rapier joints: https://rapier.rs/docs/user_guides/javascript/joints/
- Fly deployment/configuration: https://fly.io/docs/launch/deploy/ and https://fly.io/docs/reference/configuration/
