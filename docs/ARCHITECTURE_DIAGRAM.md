# Colossus City — architecture diagrams

Three views of the same system: the stack it runs on, how a building actually comes apart, and
what happens inside one authoritative tick. GitHub renders these natively.

## 1. Tech stack

One slide's worth: every technology the game runs on and how they connect. No individual files —
for those see [MODULES.md](MODULES.md).

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 48, "rankSpacing": 56, "htmlLabels": true, "curve": "basis"}} }%%
flowchart LR

classDef device fill:#0d212b,stroke:#7fd4c1,stroke-width:2px,color:#eaf6f2
classDef client fill:#11232b,stroke:#9ec7d6,stroke-width:2px,color:#eaf6f2
classDef shared fill:#1b2a1d,stroke:#ceff83,stroke-width:2px,color:#f2ffe2
classDef server fill:#241a2b,stroke:#c6a0ff,stroke-width:2px,color:#f4ecff
classDef plat fill:#2b1d1d,stroke:#ff9a7a,stroke-width:2px,color:#ffeee8

subgraph D["CLIENTS"]
  direction TB
  Q["<b>Meta Quest 2</b><br/>Quest Browser<br/>the colossus"]
  L["<b>Laptop</b><br/>Chrome, Edge, Safari<br/>raider, giant, spectator"]
  P["<b>Phone / tablet</b><br/>mobile browser<br/>touch raider"]
end

subgraph C["BROWSER RUNTIME"]
  direction TB
  THREE["<b>Three.js r180</b><br/>WebGL 2, instanced meshes,<br/>quality tiers, adaptive resolution"]
  XR["<b>WebXR Device API</b><br/>immersive-vr, local-floor,<br/>Touch controllers, haptics"]
  IN["<b>Pointer + touch input</b><br/>pointer lock, Pointer Events,<br/>client-side prediction"]
  AUD["<b>Web Audio API</b><br/>procedural synthesis,<br/>no audio files"]
  DOM["<b>Canvas 2D + DOM/CSS</b><br/>HUD, procedural facade textures"]
  ESM["<b>ES modules + importmap</b><br/>no bundler, no build step"]
end

subgraph S["SHARED CONTRACT"]
  direction TB
  SM["<b>Shared ES modules</b><br/>one flight model, one city<br/>definition, one config"]
  PR["<b>COL3 binary protocol</b><br/>float32 transforms, 20 Hz"]
  WSC["<b>WebSocket</b><br/>reliable JSON events<br/>+ binary snapshots, 30 Hz input"]
  VID["<b>Live view channel</b><br/>encoded video, JPEG fallback"]
end

subgraph SV["AUTHORITATIVE SERVER"]
  direction TB
  NODE["<b>Node.js 22</b><br/>single process, one room registry,<br/>60 Hz fixed-step accumulator"]
  WSS["<b>ws</b><br/>WebSocket server, per-room fan-out,<br/>rate limits, origin policy"]
  RAP["<b>Rapier3D 0.17 (WASM)</b><br/>rigid bodies, CCD, joints,<br/>merged static colliders"]
  SIM["<b>Room simulation</b><br/>movement, tracked-hand contact,<br/>structural collapse, ragdolls"]
end

subgraph PL["PLATFORM"]
  direction TB
  FLY["<b>Docker + Fly.io</b><br/>exactly one machine,<br/>rooms live in process"]
  AST["<b>Static assets</b><br/>GLB from Kenney and Quaternius,<br/>HDR from Poly Haven, all CC0"]
  TST["<b>node:test + Playwright</b><br/>real Rapier, Meta IWER<br/>Quest 2 emulation"]
end

Q --> XR
L --> IN
P --> IN
XR --> THREE
IN --> THREE
ESM --> THREE
AUD --> DOM
THREE --> DOM

IN -->|"input + pose"| WSC
SM -->|"one model, both sides"| IN
PR --> WSC
WSC -->|"snapshots + events"| THREE
VID --- DOM

WSC <--> WSS
SM --> SIM
VID <--> NODE
WSS --> NODE
NODE --> SIM
SIM <--> RAP

FLY --> NODE
AST --> THREE
TST -.-> SIM

class Q,L,P device
class THREE,XR,IN,AUD,DOM,ESM client
class SM,PR,WSC,VID shared
class NODE,WSS,RAP,SIM server
class FLY,AST,TST plat
```

## 2. How a tower comes down

Four stages. Damage peels the skins before it ever reaches structure, and structure fails on a
load model rather than on hit points alone — which is why collapses read as progressive.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 44, "rankSpacing": 62, "htmlLabels": true, "curve": "basis"}} }%%
flowchart LR

classDef hit fill:#2b1d1d,stroke:#ff9a7a,stroke-width:2px,color:#ffeee8
classDef skin fill:#11232b,stroke:#9ec7d6,stroke-width:2px,color:#eaf6f2
classDef load fill:#241a2b,stroke:#c6a0ff,stroke-width:2px,color:#f4ecff
classDef out fill:#1b2a1d,stroke:#ceff83,stroke-width:2px,color:#f2ffe2

subgraph A["1 · IMPACT"]
  direction TB
  SRC["<b>Damage source</b><br/>tracked hand, torso shove,<br/>rifle, breach bolt, missile,<br/>soaring raider, falling debris"]
  SIDE["<b>Which wall took it</b><br/>dominant horizontal axis"]
  SRC --> SIDE
end

subgraph B["2 · SKINS"]
  direction TB
  GLASS["<b>Glass shatters first</b><br/>cheap, loud, cosmetic shards"]
  FACADE["<b>Facade cracks</b><br/>brick, limestone, concrete<br/>absorbs the hit, shields the frame"]
  OPEN["<b>Solid layer gone = an opening</b><br/>collider removed, raiders and<br/>rockets fly straight through"]
  GLASS --> FACADE --> OPEN
end

subgraph C["3 · INTEGRITY"]
  direction TB
  FRAME["<b>Structural frame HP</b><br/>lower storeys are stronger"]
  GRAPH["<b>Graph support</b><br/>is there still a path<br/>to a foundation?"]
  LOADM["<b>Load model</b><br/>weight down each stack,<br/>hanging bays beam to neighbours,<br/>capacity = stack x safety x HP"]
  CREAK["<b>Overloaded, so it creaks</b><br/>failure scheduled with jitter"]
  FRAME --> GRAPH
  FRAME --> LOADM --> CREAK
end

subgraph E["4 · COLLAPSE"]
  direction TB
  CRUSH["<b>Column crushed to rubble</b><br/>never left propping<br/>the storeys above"]
  ISLAND["<b>Severed section becomes<br/>one rigid island</b><br/>and topples about whatever stands"]
  BREAKUP["<b>Hard landing breaks it up</b><br/>island to floor bands to bays,<br/>lone bays crumble to rubble"]
  DOMINO["<b>Debris keeps hitting things</b><br/>batters neighbours, crushes the<br/>giant on its head or core"]
  CRUSH --> ISLAND --> BREAKUP --> DOMINO
end

SIDE --> GLASS
OPEN --> FRAME
GRAPH --> ISLAND
CREAK --> CRUSH
DOMINO -->|"cascades back in"| SRC

class SRC,SIDE,DOMINO hit
class GLASS,FACADE,OPEN skin
class FRAME,GRAPH,LOADM,CREAK load
class CRUSH,ISLAND,BREAKUP out
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

## Reading the stack

- **Teal** is the three devices. One codebase serves all of them; the role and the input scheme
  are decided at runtime, not at build time.
- **Blue** is the browser runtime — platform APIs plus Three.js. There is no bundler and no build
  step: the browser loads ES modules through an importmap, which is why a hackathon checkout runs
  with `npm start` and nothing else.
- **Green** is the contract, and it is the load-bearing idea. `shared/` is pure logic with no
  Three.js, Rapier, DOM or Node in it, imported unchanged by both sides — that is why the client
  can predict flight exactly and why the server never has to trust a client. Alongside it sits the
  wire: reliable JSON for events, a versioned binary snapshot for transforms.
- **Purple** is authority. Nothing in the client decides damage, position or structural failure.
- **Orange** is everything around the game: hosting, CC0 art, and the test rigs that run real
  physics and an emulated Quest 2.

See [MODULES.md](MODULES.md) for the file-by-file map and the rules for changing each layer,
and [ARCHITECTURE.md](ARCHITECTURE.md) for the budgets and failure modes.
