# COLOSSUS CITY
### One giant. Eight jetpack raiders. Twenty-four towers that come apart.

Asymmetric multiplayer prototype for a **Meta Quest 2 giant** and **laptop raiders**. Three.js renders a Manhattan-style district; one Node.js server runs Rapier physics; WebSockets carry inputs, tracked poses, world snapshots and reliable destruction events.

**Merge validation (September 12, 2026):** the Midtown overhaul is integrated with the newer hand-contact, armored raider/ragdoll, hold-Shift flight and low-latency spectator changes. See [docs/VALIDATION.md](docs/VALIDATION.md) for checks on the combined version. No physical Quest 2 was connected; headset frame rate, tracking, haptics and comfort still need a device check.

## 1. Start on a laptop

Install Node.js **22 or later** and run these commands in this directory:

```sh
npm ci
npm test
npm run test:all
npm start
```

Open **http://localhost:8080**. Keep the terminal running. Do not open `index.html` directly and do not start a separate frontend server; the supplied server serves the client and the WebSocket endpoint together. No API keys, database, paid assets or build step are needed. `npm ci` gives repeatable installs from `package-lock.json`.

For a solo test, select **Raider → Enter Practice** to fight the AI giant, or **Colossus → Enter Practice** to swat three labelled server-controlled practice drones. The desktop giant exists so you can test without the headset.

For laptop multiplayer, select a role and **Create Room**. Other tabs/devices select their role, enter the six-character room code and select **Join Room**. **Copy Invite** copies the server URL with the room code filled in. A room has one giant seat, up to eight raiders and spectator seats; total connections per room are limited to sixteen.

## 2. Put the Quest and laptops in the same game

**Immersive WebXR needs a secure origin.** `http://localhost` works for local development, but a LAN address like `http://192.168.x.x:8080` is not a secure WebXR origin on the headset. Use USB port forwarding (below) or a deployed HTTPS address; clients automatically use WSS on HTTPS.

### Local Quest 2 test over USB

Enable Developer Mode on the Quest, connect a USB data cable and accept **USB debugging** inside the headset. With `npm start` running, in a second terminal:

```sh
npm run quest:usb
```

Open **http://localhost:8080** in Meta Quest Browser, choose **Colossus**, create a room (or enter practice), select **Continue**, then **Enter VR**. This forwards the headset's loopback port to the laptop, including the WebSocket. Other laptops on the same Wi-Fi join the laptop's LAN address with the room code. See [Meta's browser debugging workflow](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/).

Keep the Quest and spectator laptop on the same Wi-Fi: USB forwarding carries the game socket, while spectator video needs a reachable Wi-Fi path.

### Wireless / deployed setup

1. Open the deployed HTTPS address in **Meta Quest Browser**. Use both Touch controllers. Choose **Colossus**, create or join the room, close the panel, select **Enter VR** and grant the immersive-VR permission.
2. Open the **same address** on every laptop as **Raider** with the same room code. Do not mix a local server and a deployed server: they have different room state.
3. Keep a clear play area and the boundary system on. Start stationary, using the sticks.

The game uses tracked head and controller poses from an `immersive-vr` session with `local-floor`; both controllers must be tracked to send an attack pose. Tracking loss suspends movement and contact; entry, recentering, calibration and recovered tracking rebase the hands with a short grace period. It requests 72 Hz only when reported and uses feature-detected haptics/foveation. That is a request, **not an achieved-frame-rate measurement.**

### Fly.io deployment

The included `Dockerfile` and `fly.toml` host HTTP and WebSockets. These commands need your own authenticated Fly account and create billable infrastructure.

```sh
fly apps create YOUR-UNIQUE-APP
fly deploy --app YOUR-UNIQUE-APP --ha=false
fly scale count 1 --app YOUR-UNIQUE-APP
fly status --app YOUR-UNIQUE-APP
```

**Run exactly ONE Machine.** Rooms live in one process; a second machine is a second, independent lobby. Restarting or redeploying ends active matches. Stop the Machine after a demo to avoid charges.

## Controls

| Player | Controls |
| --- | --- |
| Laptop raider | WASD move relative to view; mouse aim; hold Space to climb; hold either Shift to soar, release to hover; E + direction dodges; C descend; hold left mouse to fire; **hold right mouse to charge a breach shot**; V first/third person; Tab scores; Q quality; Escape releases the pointer. |
| Quest giant | Move your head and both controllers to embody the giant. Swing into raiders and buildings; walk into a tower to shove through it. Left stick moves, right stick turns smoothly (90°/s default), either trigger launches a missile, right A recalibrates height. |
| Desktop giant | WASD; mouse view; hold left click for a sweeping hand; Space for downward strikes; right click or R fires missiles. |
| Spectator | Live Views opens every player's camera feed; Free Camera flies with mouse + WASD, Space up, C down, Shift fast. |

**Giant reach:** the 14× world scale maps a physical 0.5 m controller move to 7 m in the city. Open **Quest Controls** in the lobby to adjust turn speed or reach gain; A calibrates the scale for your standing height.

Raiders start in first person. Press **V** or use the pause-menu camera button for the wider third-person shoulder view.

**Flight:** hold Space to take off, hold Shift to soar. Soaring flies prone at 32 m/s along the mouse; S brakes. Hover is 11 m/s. The giant walks at 13 m/s so it can catch a hovering raider. A full tank of hover thrust climbs about 115 m; soaring with the nose up climbs cheaper. E dodges (12 % thrust, 1.2 s cooldown). Passing within a few metres of a swinging hand without being hit is a **close call** that refills thrust.

**Breach shot:** hold right mouse for 0.7 s and release. The bolt cracks the bay it hits (and its neighbours), costs 22 % thrust and has a 3 s cooldown. Against the giant it deals 42 (76 on the head) and **staggers** it, which exposes the core: all raider damage gets +60 % while the giant is staggered.

**Missiles:** point a Touch controller and pull its trigger. Rockets travel at 55 m/s, explode on scenery or raiders and blow a hole through most bays. Shared 0.8 s cooldown, eight-projectile cap.

**Winning:** raiders win by reducing the core to zero within four minutes; the giant wins by surviving. Kills, towers down and city damage are tracked; the round-end scoreboard ranks raiders by score. **Dropping a tower on the colossus is the raiders' heaviest weapon**: falling structure that lands on its head or core deals up to 420 damage and staggers it.

**Spectator video:** Live Views shows each human player over WebRTC at up to 30 fps on desktop / 24 fps from the headset’s actual left-eye view. Failed video links use a bounded 15 fps image fallback. AI cameras are labeled simulated. Use one spectator for the demo; keep each player’s game visible on its device.

## What is implemented in source

### Midtown

The district (`shared/city/layout.js`) is a 320 m grid of four avenues and four streets with 24 named towers of four construction types, 6 to 34 storeys (up to 122 m), art-deco setbacks, spires, water towers and roof equipment, a central plaza, street traffic, lamps, bridges and a far skyline. 2,543 structural bays. Raiders spawn on the outer avenues; the giant starts on the plaza.

### Layered destruction with integrity

Every bay is a hollow storey: slab + four columns + exterior skins. **Curtain-wall** towers are glass on a steel frame; **brick**, **limestone** and **concrete** towers have windows plus a facade. A hit pops glass first (rifle fire shatters windows), then cracks the facade — which shields the frame while it stands — then wears down the structural frame; lower storeys are stronger. Broken solid layers become real openings: colliders go, raiders and missiles pass through.

Integrity is a load model on top of graph support. Weight flows down each column stack; a bay whose support is gone hangs from neighbours up to three bays away; capacity is the design load × a material safety factor × the frame's remaining HP. Overloaded columns creak, then fail after a short delay, so cascades read as progressive collapse. Failed columns are crushed to rubble immediately; a severed section falls as one rigid island, tips about whatever still stands beneath it, splits into floor bands on impact, bands into bays, and lone bays that land hard crumble into cosmetic bricks/shards. Falling chunks damage the towers they hit (domino collapses) and the giant if they land on it. The giant's torso shoves through bays it walks into and is slowed by them.

This is a game structural model, not engineering analysis: no bending moments, fatigue, rebar or arbitrary cracks; bays are rigid compounds; the skyline ring is decoration.

### Game feel

Client-side prediction runs the shared flight model locally against the held input and reconciles with each snapshot, so the raider's own movement has no interpolation lag; the desktop giant camera is dead-reckoned. Procedural Web Audio (no audio files) covers weapons, glass, masonry, steel, creaks, collapses, thrust and wind with distance attenuation. Trauma camera shake (desktop only), hit markers, floating damage numbers, an announcer feed (tower down, close call, core exposed, combos), material-specific haptics for the giant, a camera-locked damage vignette in VR (the VR camera is never shaken), and a round-end scoreboard.

## 3. Performance and verification

Physics runs at 60 fixed steps/s, snapshots at 20/s, inputs/poses at 30/s. Remote objects interpolate ~100 ms behind; the local raider is predicted. Caps: 144 debris bodies, eight ragdolls, eight raiders; a maximal snapshot is 8,068 bytes.

Rendering picks a quality tier from the GPU: `quest`, `low` (integrated GPUs such as Intel Iris Xe: Lambert shading, no shadows/bloom, pixel ratio 1, low-poly skyline), `medium`, `high`. Adaptive resolution lowers the pixel ratio under sustained load. Towers render as a handful of instanced batches regardless of size (~120 draw calls in play on `low`). `Q` toggles cinematic extras; `?quality=low|medium|high|quest` forces a tier.

```sh
npm run check          # Syntax and local import existence, no packages needed
npm test               # Dependency-free unit tests (map, loads, codec, flight model)
npm run test:physics   # Real Rapier: layers, cascades, islands, crumble, giant crush
npm run test:network   # Real multiplayer + spectator channel integration
npm run test:xr        # VR lifecycle/input regressions (fake frames, real Three math)
npm run test:all       # All Node tests
npm run test:giant     # Rendered hand anatomy and real Midtown contact in Quest emulation
npm run test:visual    # Imported art, roof movement, props and lasers
npm run test:ragdoll   # Matching pilot/ragdoll skin and physics
npm run test:xr-view   # Smooth yaw, hand orientation and rigid armor
npm run bench          # Server physics: intact city, staged collapses, active hand contact
npm run profile        # Real GPU frame times in a visible Chromium, per quality tier
```

Real desktop rendering and Quest 2 emulation test (starts its own isolated server):

```sh
PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium
npm run test:browser
```

Do not treat a syntax check, unit test, server benchmark or emulated browser session as headset verification.

## 4. Swap the city or use imported assets

`shared/city/layout.js` is the single source of truth: towers (tiers, material, spire, water tower), roads and spawns. Materials live in `shared/city/materials.js`. Server and browser import the same definition. See [docs/MODULES.md](docs/MODULES.md) for the module map and ownership rules, and `docs/ASSET_PIPELINE.md` for GLB conventions. `npm run assets -- --verify` checks the bundled photographic textures and models; nothing needs downloading to play.

## Source guide

Read [docs/MODULES.md](docs/MODULES.md) first. In short: `shared/` is pure logic used by both sides (config, math, protocol, flight model, city layout/materials/cells/structure); `server/` is the authoritative simulation (room, boss, players, combat, abilities, destruction); `src/app` is the client app layer (state, input, prediction, camera, shake, HUD, events, lobby); `src/render` picks quality and owns the renderer; `src/world` renders the district (city, buildings, ground, textures, rubble). [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers authority, transport, the destruction model and rendering budgets.

Original source and generated textures use the MIT license. Bundled Kenney, Quaternius and Poly Haven assets retain their own (CC0) licenses; see `LICENSE` and `public/assets/README.md`.

## API references

- WebXR session/security: https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession
- Three.js XR manager: https://threejs.org/docs/pages/WebXRManager.html
- Rapier rigid bodies and joints: https://rapier.rs/docs/user_guides/javascript/rigid_bodies/
- Meta WebXR performance: https://developers.meta.com/horizon/documentation/web/webxr-perf/
- Fly deployment: https://fly.io/docs/launch/deploy/
