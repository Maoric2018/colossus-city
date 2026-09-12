# Colossus City — architecture diagrams

Three views of the same system: what talks to what, how a building actually comes apart, and
what happens inside one authoritative tick. GitHub renders these natively.

## 1. System architecture

Devices on the left, authority on the right, and `shared/` deliberately in the middle: it is the
only code both sides import, which is why the client can predict flight exactly and why the
server never has to trust a client for anything.

```mermaid
flowchart LR

classDef device fill:#0d212b,stroke:#7fd4c1,stroke-width:2px,color:#eaf6f2
classDef client fill:#11232b,stroke:#9ec7d6,color:#eaf6f2
classDef wire fill:#20262e,stroke:#ffd166,stroke-width:2px,color:#fff6e0
classDef shared fill:#1b2a1d,stroke:#ceff83,stroke-width:2px,color:#f2ffe2
classDef server fill:#241a2b,stroke:#c6a0ff,color:#f4ecff
classDef phys fill:#2b1d1d,stroke:#ff9a7a,stroke-width:2px,color:#ffeee8

subgraph DEVICES["DEVICES"]
  direction TB
  QUEST["Meta Quest 2<br/>the Colossus<br/>head + hand pose, sticks, triggers"]
  LAPTOP["Laptop<br/>raider, desktop giant, spectator<br/>keyboard, mouse, pointer lock"]
  PHONE["Phone / tablet<br/>two thumbs<br/>stick, drag-look, role pads"]
end

subgraph CLIENT["BROWSER CLIENT - src/"]
  direction TB
  MAIN["main.js<br/>bootstrap, 60 Hz frame loop"]

  subgraph APP["src/app - session and input"]
    direction TB
    INPUT["input.js + touch.js<br/>one held() input shape<br/>ability sequence counters"]
    PRED["prediction.js<br/>local sim, replays unacked inputs"]
    CAMERA["camera.js + shake.js<br/>dead-reckoned giant, trauma shake"]
    EVENTSM["events.js<br/>event to fx, audio, haptics, HUD"]
  end

  subgraph RENDER["src/render - budget"]
    direction TB
    QUALITY["quality.js<br/>mobile, quest, low, medium, high"]
    RENDERER["renderer.js<br/>adaptive resolution, bloom, XR scale"]
    LODM["catalog-lod, instances,<br/>fracture-geometry"]
  end

  subgraph WORLDC["src/world + presentation"]
    direction TB
    CITYV["city.js CityView<br/>spatial queries, skins, debris poses"]
    STREAMC["streaming.js<br/>block streaming"]
    BUILDC["buildings.js, fine-buildings,<br/>rubble, fragments, cars, textures"]
    XRM["xr.js<br/>rig scale, smooth turn, in-world HUD"]
    MEDIAC["avatars, effects, missiles,<br/>audio, spectator"]
  end

  MAIN --> APP
  MAIN --> RENDER
  MAIN --> WORLDC
  INPUT --> PRED --> CAMERA
  QUALITY --> RENDERER
  QUALITY --> LODM
  LODM --> BUILDC
  CITYV --> STREAMC
  CITYV --> BUILDC
  CITYV --> XRM
  EVENTSM --> CITYV
  EVENTSM --> MEDIAC
end

subgraph MID["CONTRACT"]
  direction TB

  subgraph WIRE["transport"]
    direction TB
    WS["WebSocket /ws<br/>JSON control + reliable events"]
    SNAP["COL3 binary snapshot<br/>20 Hz, float32"]
    VIEWCH["/views channel<br/>spectator video"]
  end

  subgraph SHARED["shared/ - imported by BOTH sides"]
    direction TB
    FLIGHTS["flight.js<br/>the one flight model"]
    PROTOS["protocol.js<br/>snapshot codec"]
    CITYDEF["city/layout, cells, materials,<br/>structure, catalog, landmarks"]
    CONFIG["config.js, math.js<br/>tunables, sweeps, sanitizeInput"]
    RIGS["giant-rig, raider-rig,<br/>hand-world, props, traffic"]
  end

  PROTOS --> SNAP
end

subgraph SERVER["AUTHORITATIVE SERVER - Node"]
  direction TB
  INDEXS["index.js<br/>HTTP, WS upgrade, rate limits,<br/>60 Hz accumulator"]
  ROOM["room.js<br/>one match: membership,<br/>step order, snapshot"]

  subgraph MECH["mechanics"]
    direction TB
    BOSSS["boss.js<br/>tracked hands, torso shove, combos"]
    PLAYERSS["players.js, combat.js<br/>spawn, rifle, breach, ragdolls"]
    ABILS["abilities.js, soar-breach.js<br/>flight, missiles"]
    CARSS["cars.js<br/>traffic, wrecks"]
  end

  subgraph DESTR["destruction"]
    direction TB
    DESTS["destruction.js<br/>layered damage, collapse scheduling,<br/>islands, topple, crumble"]
    FRACS["fracture.js + hand-destruction.js<br/>fine pieces"]
    QUERYS["queries.js<br/>broadphase helpers"]
  end

  subgraph SRVIO["delivery"]
    direction TB
    STREAMS["streaming.js<br/>per-client blocks"]
    VIEWSS["views.js<br/>authenticated relay"]
    STATICS["static.js<br/>cached assets"]
  end

  INDEXS --> ROOM
  ROOM --> MECH
  ROOM --> DESTR
  ROOM --> SRVIO
  BOSSS --> DESTS
  ABILS --> DESTS
  PLAYERSS --> DESTS
  DESTS --> FRACS
  QUERYS --> DESTS
end

subgraph SIM["WORLD SIM AND HOSTING"]
  direction TB
  RAPIER["Rapier3D WASM<br/>fixed 1/60 s step, CCD,<br/>merged floor colliders"]
  DOCKER["Dockerfile + fly.toml<br/>one machine, rooms live in process"]
  ASSETS["public/assets<br/>Kenney, Quaternius, Poly Haven"]
  TESTS["Node suite + Playwright<br/>real Rapier, IWER Quest 2"]
end

QUEST --> MAIN
LAPTOP --> MAIN
PHONE --> MAIN

INPUT -->|"input + pose, 30 Hz"| WS
WS --> INDEXS
SNAP -->|"interpolate ~100 ms behind"| PRED
WS -->|"reliable events"| EVENTSM
VIEWCH --> VIEWSS
MEDIAC --> VIEWCH

FLIGHTS -->|"one model"| PRED
FLIGHTS --> ABILS
CITYDEF --> CITYV
CITYDEF --> DESTS
CONFIG --> QUALITY
CONFIG --> ROOM
RIGS --> XRM
RIGS --> BOSSS

ROOM --> SNAP
STREAMS --> STREAMC
STATICS --> MAIN
ROOM <--> RAPIER
DOCKER --> INDEXS
ASSETS --> STATICS
TESTS -.-> ROOM

class QUEST,LAPTOP,PHONE device
class MAIN,INPUT,PRED,CAMERA,EVENTSM,QUALITY,RENDERER,LODM,CITYV,STREAMC,BUILDC,XRM,MEDIAC client
class WS,SNAP,VIEWCH wire
class FLIGHTS,PROTOS,CITYDEF,CONFIG,RIGS shared
class INDEXS,ROOM,BOSSS,PLAYERSS,ABILS,CARSS,DESTS,FRACS,QUERYS,STREAMS,VIEWSS,STATICS server
class RAPIER,DOCKER,ASSETS,TESTS phys
```

## 2. How a tower comes down

Every bay is a hollow storey: slab, four corner columns and exterior skins. Damage peels the
skins before it ever reaches structure, and structure fails on a load model rather than on hit
points alone.

```mermaid
flowchart LR

classDef hit fill:#2b1d1d,stroke:#ff9a7a,color:#ffeee8
classDef skin fill:#11232b,stroke:#9ec7d6,color:#eaf6f2
classDef load fill:#241a2b,stroke:#c6a0ff,color:#f4ecff
classDef out fill:#1b2a1d,stroke:#ceff83,color:#f2ffe2

SRC["Damage source<br/>tracked hand sweep, torso shove,<br/>rifle round, breach bolt, missile,<br/>soaring raider, falling debris"]:::hit
SIDE["facingSide()<br/>which wall took it"]:::hit
GLASS{"glass intact<br/>on that side?"}:::skin
POP["Windows shatter<br/>skin event, shards, tinkle"]:::skin
FACADE{"facade standing?"}:::skin
CRACK["Facade cracks<br/>absorbs most of the hit,<br/>shields the frame"]:::skin
OPEN["Solid layer gone<br/>collider removed, the bay is now an opening<br/>raiders and rockets fly through"]:::skin
FRAME["Structural frame HP<br/>lower storeys are stronger"]:::load
GRAPH["unsupportedCells()<br/>graph path to a foundation"]:::load
LOADM["structuralLoads()<br/>weight down each stack,<br/>hanging bays beam to neighbours,<br/>capacity = stack x safety x HP ratio"]:::load
OVER{"carried > capacity?"}:::load
CREAK["Creak<br/>scheduled failure + jitter"]:::load
CRUSH["Column crushed to rubble at once<br/>never left propping the storeys above"]:::out
ISLAND["Severed section becomes<br/>ONE rigid island"]:::out
TOPPLE["topple(): angular velocity about<br/>the far edge of what still stands"]:::out
LAND{"hard landing?"}:::out
BANDS["Island splits into floor bands,<br/>bands into bays"]:::out
CRUMBLE["Lone bay crumbles<br/>body freed, cosmetic rubble on clients"]:::out
DOMINO["Chunk batters what it lands on<br/>and crushes the giant on its head or core"]:::hit

SRC --> SIDE --> GLASS
GLASS -- yes --> POP --> FACADE
GLASS -- no --> FACADE
FACADE -- yes --> CRACK --> FRAME
FACADE -- no --> FRAME
CRACK -.-> OPEN
POP -.-> OPEN
FRAME --> GRAPH
FRAME --> LOADM
LOADM --> OVER
OVER -- yes --> CREAK --> CRUSH
OVER -- no --> LOADM
GRAPH --> ISLAND
CRUSH --> GRAPH
ISLAND --> TOPPLE --> LAND
LAND -- yes --> BANDS --> CRUMBLE
LAND -- no --> DOMINO
BANDS --> DOMINO
DOMINO --> SRC
```

## 3. One authoritative tick

The server owns everything. The client only predicts its own raider, using the same flight
model, and reconciles on the next snapshot.

```mermaid
sequenceDiagram
  autonumber
  participant P as Phone / Laptop raider
  participant Q as Quest colossus
  participant S as Server room.js
  participant R as Rapier world
  participant A as All clients

  Note over P: input.held() at 60 Hz
  P->>P: prediction.advance() with shared/flight.js
  P-->>S: input packet at 30 Hz, seq n
  Q-->>S: tracked head and hand pose at 30 Hz

  Note over S,R: fixed 1/60 s step
  S->>S: updateBoss() sweep hands, shove torso
  S->>S: updatePlayer() flight, rifle, breach
  S->>S: updateMissiles()
  S->>R: world.step()
  R-->>S: collision events
  S->>S: debris vs bay damage, fracture, crumble
  S->>S: debris vs giant, stagger
  S->>S: due structural failures, then schedule new ones
  S->>S: batch skin changes

  S-->>A: reliable events: skin, debris, crumble, creak, towerdown, gianthit
  S-->>A: binary COL3 snapshot every 3rd tick, ack seq n
  A->>A: interpolate remote entities ~100 ms behind
  P->>P: reconcile at seq n, replay unacked inputs, decay the error
  A->>A: events drive particles, rubble, audio, haptics, HUD
```

## Reading the first diagram

- **Green** is `shared/` — pure logic with no Three.js, Rapier, DOM or Node in it. It is imported
  unchanged by both sides, which is why the client can predict flight exactly and why an analog
  thumbstick value survives to the server untouched.
- **Amber** is the wire. Control and gameplay events are reliable JSON; transforms are a
  versioned binary snapshot. Bump `MAGIC` in `shared/protocol.js` and every client must reload.
- **Purple** is authority. Nothing in the client decides damage, position or structural failure.
- **Red** is the physics world and anything that can hurt something.

See [MODULES.md](MODULES.md) for the file-by-file map and the rules for changing each layer,
and [ARCHITECTURE.md](ARCHITECTURE.md) for the budgets and failure modes.
