# COLOSSUS CITY
### One giant. Eight jetpack raiders. An endless city that comes apart.

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

Looking down smoothly makes your own torso, hips and legs translucent, clearing the ground view while your arms and hands stay solid. Looking up restores the body. Raiders and free-camera spectators see an opaque robot; the live colossus feed matches the pilot's view.

Raiders start in first person. Press **V** or use the pause-menu camera button for the wider third-person shoulder view.

**Flight:** hold Space to take off, hold Shift to soar. Soaring flies prone at 32 m/s along the mouse; S brakes. Hover is 11 m/s. The giant walks at 13 m/s so it can catch a hovering raider. A full tank of hover thrust climbs about 115 m; soaring with the nose up climbs cheaper. E dodges (12 % thrust, 1.2 s cooldown). Passing within a few metres of a swinging hand without being hit is a **close call** that refills thrust.

**Soaring through buildings:** while holding Shift, fly into a building to punch a narrow opening through its walls and structural bays. Glass and facade panels shatter, the broken structure remains as debris, and you keep flying through the opening. Normal flight and normal dodges cannot break walls. Terrain, cars and unrelated wreckage remain solid; only your freshly broken pieces briefly stop colliding with you.

Soaring animates the existing armored pilot: the helmet looks forward, the weapon arm reaches ahead, the other arm balances, and knees and feet make small continuous corrections. Turns bank the body and vector the jetpack nozzles; entering and leaving flight tuck the legs smoothly. Press **V** for third person to see your own pilot. The same articulated model becomes the ragdoll on a hit.

**Breach shot:** hold right mouse for 0.7 s and release. The bolt cracks the surface it hits and nearby surfaces within 2.4 m, costs 22 % thrust and has a 3 s cooldown. Against the giant it deals 42 (76 on the head) and **staggers** it, which exposes the core: all raider damage gets +60 % while the giant is staggered.

**Missiles:** point a Touch controller and pull its trigger. Rockets travel at 55 m/s, explode on scenery or raiders and blow a hole through most bays. Shared 0.8 s cooldown, eight-projectile cap.

**Colossus health:** 2,600 HP per raider: one = 2,600, two = 5,200, four = 10,400, eight = 20,800. Joining or leaving preserves the current health percentage. Practice drones count; spectators do not. A dead raider still counts while waiting to respawn, and each new round restores full scaled health.

**Winning:** raiders win by reducing the core to zero within four minutes; the giant wins by surviving. Kills, towers down and city damage are tracked; the round-end scoreboard ranks raiders by score. Building debris does not damage or stagger the colossus. Raiders damage it with their weapons.

**Spectator video:** Live Views shows each human player over WebRTC at up to 30 fps on desktop / 24 fps from the headset’s actual left-eye view. Failed video links use a bounded 15 fps image fallback. AI cameras are labeled simulated. Use one spectator for the demo; keep each player’s game visible on its device.

## What is implemented in source

### Midtown

The original **169 buildings and 5,827 structural bays** form the center of a continuously generated city. Travel in any horizontal direction to discover more 70 m blocks, each with eight street-front buildings, courtyards, alleys and connected streets. Some courtyards contain a Chrysler-style landmark. Sixteen building families vary footprints, heights, setbacks and facade details: brownstones, tenements, warehouses, cast-iron storefronts, Beaux-Arts, Art Deco, curtain-wall offices, terraces, brutalist buildings, hotels, apartments, factories, markets, Gothic buildings, copper-roofed buildings and modern offices. The custom twin towers, Empire State–style tower, Chrysler Building, 30 Hudson Yards and One Vanderbilt remain in Midtown.

The **214-type architectural kit** supplies at least **75 distinct component types per building**: detailed entrances and windows, stairs, fire escapes, interior services, ornamental masonry, balconies, roof machinery and family-specific parts. Downloaded photographic textures and roof models are reused. Fine geometry is concentrated nearby; simpler distant buildings blend into matching horizon fog (105–230 m on Quest, 140–340 m on desktop).

Nearby blocks have full destruction and collision. Distant blocks unload, retaining a sparse record of damage, broken skins and rubble for the current round. Returning players and late spectators see the same destruction. Offscreen physics pauses and resumes when the block reloads; round reset starts a fresh city. Raiders who die far from the start respawn near the giant.

### New York landmark models

30 Hudson Yards has a tapering blue-glass tower, lower shoulder, angled roof, triangular Edge deck with a faceted underside and glass balustrades, observation steps, roof ascent stairs and custom lobby parts. One Vanderbilt has four staggered tapering volumes, an open upper corner, terra-cotta spandrels and flutes, bronze entrance details, SUMMIT skyboxes, a glass crown and needle spire. The two towers add **78 component types** and use **89 / 85 distinct assemblies** respectively, including shared services. They are scaled interpretations of the architects' references, with structural bays grouped for gameplay. Crowns and decks have shared collision proxies and remain attached to falling bays. See [references and modeling notes](docs/NYC_LANDMARKS.md).

### Spawn a Chrysler Building

The host can open the pause menu and select **SPAWN CHRYSLER NEARBY**. It adds a tower in the nearest clear generated courtyard; the menu reports its location. Existing buildings and damage stay intact. The home district also has one west of the central plaza, and approximately one in 29 generated blocks gets another naturally.

Each Chrysler has **313 destructible bays and 35 custom component types**, including seven curved steel crown shells with triangular window cutouts, a vertex spire, eagle heads, hubcaps and fenders, marble piers, brick patterns, revolving doors and terrace details. The crown and eagles have collision proxies and move with their broken supporting bays. Spawns and destruction replicate to all players and late spectators, survive block unloading, and reset with the round.

### Layered destruction with integrity

Every bay is a hollow storey: slab + four columns + exterior skins. **Curtain-wall** towers are glass on a steel frame; **brick**, **limestone** and **concrete** towers have windows plus a facade. A hit pops glass first (rifle fire shatters windows), then cracks the facade — which shields the frame while it stands — then wears down the structural frame. Light hits accumulate on the struck face; an intact wall no longer leaks damage into a hidden frame. Direct column/slab hits damage the frame. Lower storeys are stronger, while small bays and low-rise buildings have less structural HP. Broken solid layers become real openings: colliders go, raiders and missiles pass through.

Integrity combines support connections and load redistribution. Frame strength scales with bay width, building height, floor and landmark reinforcement; surviving supports have more reserve capacity and failures creak for 0.65–1 seconds before propagating. **Walking stops at a wall and can chip at most 5% of a contacted frame; it cannot grind a building down.** Moving a hand deliberately damages its contacted layers at the actual surface, including both bays when a fist straddles a seam. Each hand has its own 0.14 s contact interval, and energy uses inward movement over the actual pose interval. Holding it still does no continuing damage. Punch exposed columns to sever structure after the facade opens.

Broken bays stay as visible, collidable debris. Only connected sections form rigid islands; unsupported neighbours fall under gravity, with no artificial lift or sideways launch. Hard impacts split them while preserving velocity; even failed foundation pieces remain. Secondary fractures leave 16 slots for fresh hits; a failure blocked by a full budget retries when capacity returns. Sleeping rubble becomes fixed geometry for the rest of the round, freeing the 144 active-body slots and avoiding repeated pose traffic. Glass and facade panels leave persistent visual fragments as well as temporary dust. Late joiners receive fallen geometry, damaged skins and final settled poses; a round reset clears the remains.

Robot missiles gently correct toward visible raiders inside a 22° forward cone, up to 75 m away, at no more than 27.5°/second. They ignore protected players and targets behind solid cover. The server sends curved-path corrections at 20 Hz; aiming and dodging still matter.

The 37 street cars have independent physics bodies. Gentle hand pushes move them; hard punches, full-speed footsteps, crashes after a shove and missile blasts make them explode. Each of the six vehicle models has its own crushed wreck with downloaded torn doors, bumpers, tires and engine parts. Fire and smoke fade; the solid wreck remains movable until the round resets. Moving cars, final resting poses and wreck state are shared with all players and late spectators. These explosions do not damage the colossus.

This is a game structural model, not engineering analysis: no bending moments, fatigue, rebar or arbitrary cracks; bays are rigid compounds. Distant silhouettes become detailed, destructible buildings as you approach.

### Game feel

Client-side prediction runs the shared flight model locally against the held input and reconciles with each snapshot, so the raider's own movement has no interpolation lag; the desktop giant camera is dead-reckoned. Procedural Web Audio (no audio files) covers weapons, glass, masonry, steel, creaks, collapses, thrust and wind with distance attenuation. Trauma camera shake (desktop only), hit markers, material-specific haptics for the giant, a camera-locked damage vignette in VR (the VR camera is never shaken), and a round-end scoreboard. Gameplay announcements, combo banners and floating damage numbers are removed from the desktop and headset views; health, thrust, controls and connection notices remain.

## 3. Performance and verification

Physics runs at 60 fixed steps/s, snapshots at 20/s, inputs/poses at 30/s. Hit and destruction events are sent on their physics tick without waiting for the next snapshot. Remote objects interpolate ~100 ms behind; the local raider is predicted. Caps: 144 debris bodies, eight ragdolls, eight raiders and 37 cars; a maximal snapshot for this map is 9,260 bytes. Parked and sleeping cars send no repeated poses.

Rendering picks a quality tier from the GPU: `quest`, `low` (integrated GPUs such as Intel Iris Xe: Lambert shading, no shadows/bloom, pixel ratio 1), `medium`, `high`. Adaptive resolution lowers the desktop pixel ratio under sustained load. All nearby blocks share the architectural detail batches; core geometry outside both headset views is removed from submitted instances. Render and physics neighborhoods follow players, while fog covers the distant cutoff. `Q` toggles cinematic extras; `?quality=low|medium|high|quest` forces a tier.

Building instances retain their slots while visible, upload only changed buffer ranges and reuse cached transforms. Empty effects skip rendering; persistent facade debris allocates storage on demand. Physics refreshes its ray-query tree only when gameplay needs it, and idle raiders can sleep. Assets use Brotli/gzip plus ETag validation; low tiers skip unused normal/roughness maps. See [measured before/after results and limits](docs/PERFORMANCE.md).

```sh
npm run check          # Syntax and local import existence, no packages needed
npm test               # Dependency-free unit tests (map, loads, codec, flight model)
npm run test:physics   # Real Rapier: layers, cascades, islands, persistent rubble, debris immunity
npm run test:network   # Real multiplayer + spectator channel integration
npm run test:xr        # VR lifecycle/input regressions (fake frames, real Three math)
npm run test:all       # All Node tests
npm run test:giant     # Rendered hand anatomy and real Midtown contact in Quest emulation
npm run test:city
npm run test:streaming # Generated blocks, stereo visibility, return-trip rubble and Quest travel
npm run test:cars      # Moving cars, crushed models, explosions, collision queries and late joins
npm run test:visual    # Imported art, roof movement, props and lasers
npm run test:ragdoll   # Matching pilot/ragdoll skin and physics
npm run test:flight-animation # Soaring limbs, transitions, nozzles and animation preview
npm run test:soar-breach # Building pass-through, debris effects and delayed local prediction
npm run test:xr-view   # Smooth yaw, rigid armor and local look-down body fade
npm run bench          # Server physics: intact city, staged collapses, active hand contact
npm run profile        # Real GPU frame times in a visible Chromium, per quality tier
npm run profile:optimization # Repeatable city CPU/upload samples and asset transfer sizes
```

Real desktop rendering and Quest 2 emulation test (starts its own isolated server):

```sh
PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium
npm run test:browser
```

Do not treat a syntax check, unit test, server benchmark or emulated browser session as headset verification.

## 4. Swap the city or use imported assets

`shared/city/layout.js` is the single source of truth: towers (tiers, material, spire, water tower), roads and spawns. Materials live in `shared/city/materials.js`. Server and browser import the same definition. The architectural kit and source references are documented in [docs/CITY_COMPONENTS.md](docs/CITY_COMPONENTS.md). See [docs/MODULES.md](docs/MODULES.md) for the module map and ownership rules, and `docs/ASSET_PIPELINE.md` for GLB conventions. `npm run assets -- --verify` checks the bundled photographic textures and models; nothing needs downloading to play.

## Source guide

Read [docs/MODULES.md](docs/MODULES.md) first. In short: `shared/` is pure logic used by both sides (config, math, protocol, flight model, city layout/materials/cells/structure); `server/` is the authoritative simulation (room, boss, players, combat, abilities, destruction); `src/app` is the client app layer (state, input, prediction, camera, shake, HUD, events, lobby); `src/render` picks quality and owns the renderer; `src/world` renders the district (city, buildings, ground, textures, rubble). [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers authority, transport, the destruction model and rendering budgets.

Original source and generated textures use the MIT license. Bundled Kenney, Quaternius and Poly Haven assets retain their own (CC0) licenses; see `LICENSE` and `public/assets/README.md`.

## API references

- WebXR session/security: https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession
- Three.js XR manager: https://threejs.org/docs/pages/WebXRManager.html
- Rapier rigid bodies and joints: https://rapier.rs/docs/user_guides/javascript/rigid_bodies/
- Meta WebXR performance: https://developers.meta.com/horizon/documentation/web/webxr-perf/
- Fly deployment: https://fly.io/docs/launch/deploy/
