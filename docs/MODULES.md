# Module map and ownership boundaries

Two agents work on this codebase in parallel. Keep changes inside one layer where possible, keep
the public surface of each module stable, and add tests next to the layer you change.

```text
shared/            pure, dependency-free logic imported by BOTH server and browser
  config.js        every tunable constant (C), collision groups, player flag bits (F)
  math.js          vectors, quaternions, sweeps, input sanitising
  protocol.js      binary snapshot codec (COL3). Bump MAGIC when the layout changes.
  flight.js        raider flight model (flightStep) used by the server AND client prediction
  environment.js   facade: the active district + re-exports of shared/city/*
  city/layout.js   district data: towers (tiers, material, spire, water tower), roads, spawns
  city/materials.js material table: glass/facade/frame HP, safety factor, tint, haptics
  city/cells.js    generateCells (bays, walls, stacks), cellColliders (skin-aware), initialSkin
  city/structure.js unsupportedCells (graph), structuralLoads / overloadedCells (load model)

server/            authoritative simulation (Node + Rapier). Nothing here renders.
  index.js         HTTP static hosting, WebSocket upgrade, rate limits, tick loop, snapshots
  room.js          one match: world creation, membership, input routing, step order, snapshot
  boss.js          giant locomotion (VR pose / desktop / AI), hand sweeps, torso shove, combos
  players.js       raider spawn/lifecycle, per-tick input, practice drones
  combat.js        rifle, knockdowns, ragdolls
  abilities.js     flight (shared/flight.js), giant missiles and raider rockets
  destruction.js   layered damage (glass -> facade -> frame), collapse scheduling, islands,
                   topple, secondary fracture, crumble, debris vs buildings / giant
  views.js         spectator image channel (/views)

src/               browser client (Three.js). Reads snapshots/events; never decides gameplay.
  main.js          bootstrap and the frame loop only. Wires the modules below together.
  app/state.js     shared client state object + $ helper
  app/input.js     keyboard/mouse -> input packets, ability sequence counters
  app/prediction.js client-side prediction + reconciliation for the local raider
  app/camera.js    desktop cameras (predicted raider, dead-reckoned giant, spectator, intro)
  app/shake.js     trauma camera shake (desktop only; never in XR)
  app/hud.js       DOM HUD, announcer feed, damage numbers, charge ring, scoreboard, overlay
  app/events.js    server event -> effects/audio/haptics/HUD dispatcher (one switch)
  app/lobby.js     lobby/menu DOM wiring (pure UI, callbacks from main.js)
  render/quality.js GPU tier detection + material factories (Lambert on integrated GPUs)
  render/renderer.js WebGL renderer, bloom composer, adaptive resolution, Q toggle
  world/city.js    CityView: sky, lights, ground, buildings, debris poses, skins, rubble,
                   spatial queries (rayDistance, overlapBox, cellsAlongSegment)
  world/buildings.js instanced bays: frame + per-material facade/glass batches, roof caps
  world/ground.js  avenues/streets/sidewalks/plaza/spawn pads/lamps/water/bridges
  world/textures.js procedural brick/stone/concrete/glass facade maps
  world/rubble.js  cosmetic instanced bricks/shards (client only, bounded per tier)
  district.js      downloaded dressing: HDR sky, skyline ring, cars, roof props, spires
  avatars.js       giant (mech armour), raiders, ragdoll parts
  effects.js       sprite particle pools and tracers
  audio.js         procedural Web Audio synth (no audio files)
  missiles.js, flight-fx.js, spectator.js, xr.js, assets.js, art.js  (unchanged roles)

tests/             node --test. unit (pure shared), physics (real Rapier rooms), abilities,
                   network (real server + sockets), xr (fake frames, real Three math)
scripts/           check (syntax/imports), benchmark (server CPU), profile (real GPU, headed
                   Chromium), browser-smoke (Playwright + IWER Quest 2 emulation), quest-usb
```

## Rules of the road

- **Server is the only authority.** Add gameplay rules under `server/` and mirror only the
  presentation in `src/app/events.js`. Never let the client decide damage or positions.
- **Shared code stays pure.** `shared/` must not import Three.js, Rapier, DOM or Node APIs.
- **Protocol changes**: edit `shared/protocol.js`, bump `MAGIC`, update the size test in
  `tests/unit.test.js`, and note it in `docs/ARCHITECTURE.md`. Clients must reload after.
- **New event types**: emit in `server/*`, handle in `src/app/events.js`, and document the
  payload in `docs/ARCHITECTURE.md`. Unknown events are ignored by the client.
- **Map changes**: only `shared/city/layout.js`. Cells, colliders, loads and rendering derive
  from it; the unit tests assert every tower stays inside the district and off the plaza.
- **Materials**: only `shared/city/materials.js` (+ a texture painter in
  `src/world/textures.js` and a tint in `src/effects.js` when adding a new one).
- **Performance budgets**: `MAX_ACTIVE_CHUNKS` (server bodies), tier `rubble`/`particles`
  (client), `npm run bench` (server step time), `npm run profile` (real GPU frame times).
- **Tests before merge**: `npm run check && npm run test:all`. Keep the browser smoke test
  passing when touching `src/main.js`, `src/xr.js` or the lobby DOM ids.
