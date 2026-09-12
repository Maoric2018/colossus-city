# Dense city architectural kit

Midtown contains 169 buildings and 5,589 hollow structural bays. Outside its original five-by-five block grid, deterministic 70 m blocks generate in every horizontal direction. Each new block has eight buildings around a courtyard (occasionally a ninth Chrysler landmark), with footprints that preserve roads and alley clearance. Sixteen architecture families vary material, height, footprint, roofline and details. Existing downloaded Kenney/Quaternius props and photographic textures are reused; custom code supplies the destructible architectural kit and landmark-specific geometry.

`shared/city/components.js` defines **136 real geometry types**. Every building uses at least **75 distinct types**, including the landmarks and the reduced headset kit (the starting district currently has a minimum of 78). `src/world/components.js` shares one batch set across loaded blocks and attaches each part to its parent bay and skin. Physics operates on structural bays and simplified equipment proxies; ornaments do not each create a separate rigid body.

| Family | Parts |
| --- | --- |
| Structure / interior | slab edge, I girder, flanged column, cross brace, floor joists, service-core wall, elevator doors, ten-tread staircase, stair landing, stair rail, service riser |
| Facade / access | lintel, sill, mullions, transom, masonry pier, quoins, moulded cornice, dentils, shop doorway, storefront framing, shutter slats, canopy, balcony platform and railing, fire escape platform and ladder |
| Roof | parapet coping, roof drain, capped chimney, ventilation duct, ridge skylight, louvered vent |
| Window detail | recessed reveals, casements, hoods, arches, keystones, grilles, air conditioners, bay windows, French doors, sunshades and vertical fins |
| Entrance / storefront | door handles, thresholds, intercoms, mailboxes, shelves, signs, awnings, lanterns and arcades |
| Expanded services / interior | lights, sprinklers, cable trays, partitions, desks, radiators, fire-service doors, exit signs, stair stringers and conduits |
| Expanded roof / ornament | downspouts, gutters, soffits, corbels, friezes, fixings, roof hatches, fans, walkways, solar frames, tanks, lightning rods, chimney caps, planters, screens and balustrade posts |
| Architecture families | Gothic arches, copper mansards, sawtooth roofs, Deco chevrons and cast-iron capitals, alongside family-specific placement of the shared kit |
| Twin towers | perimeter ribs, three-prong lobby tridents, spandrels, mechanical-floor louvers, rooftop hat trusses, flat crown rims |
| Chrysler | 35 custom types: curved crown shells, triangular windows, rolled arch rims, standing seams, crown decks, spire collar/needle/ribs, marble piers, brick spandrels/basketweave/zigzags, steel sashes, black bands, grille/hubcaps/enamel/fenders/hood ornaments, eagle plinth/neck/head/eyes/feathers, finials, coping/rails, mechanical louvers and seven entrance assemblies |
| Empire State style | fluted limestone pilasters, Art Deco entrance sunburst, setback cornices, stepped crown, observation balustrade, mast buttresses |

The twin towers share 30-storey square shafts and matching roof heights; only the north tower has a tall antenna. The Empire State–style model has five setbacks, a dedicated limestone/window treatment and a spire. These are scaled, stylized game interpretations, with dimensions chosen for the arena. Architectural references: [Skyscraper Museum’s Twin Towers exhibition](https://www.skyscraper.org/exhibitions/giants-twin-towers-and-the-twentieth-century/) and the [Empire State Building’s architecture page](https://www.esbnyc.com/about/architecture-design).

Structural debris and its component attachments persist until round reset. Sleeping pieces retain fixed collision and final-pose replication. Destroyed glass and facade layers also leave deterministic visual fragments; temporary dust still dissipates. Late joins reconstruct both forms of remains. Falling bays use simplified solid collision proxies, not triangle meshes for every ornament.

The client retains at most nine detailed generated blocks around its camera and a bounded ring of inexpensive silhouettes. Detail parts are selected within 64 m on Quest, 85 m on performance tier and 115 m on higher tiers; landmark parts extend to 230 m. Selection includes both XR eyes. Core instances are compacted by visibility on tiers without shadows, while desktop shadow casters remain available. Fog and the sky use matching horizon colors. Offscreen blocks retain damage records for the round; their physics resumes on return, and pristine blocks regenerate from the seed.

`npm run test:city` renders the district and its landmarks, checks attachments against transformed bays, verifies fragment persistence and reset, compares late-join fragment positions, and checks that stale snapshots cannot move settled pieces. Its screenshots and report are written to `artifacts/`.

`npm run test:streaming` visits distant positive and negative coordinates, checks unloading and return-trip rubble, tests culling across both eye frustums, and walks an emulated Quest player beyond the old map boundary. `tests/streaming.test.js` checks stable IDs, architecture variety, server physics neighborhoods, split players, saved damage and real movement across the former boundary.

## Chrysler landmark

`shared/city/chrysler.js` contains the shared factory, 35 component specifications, crown profiles and physical proxies. The recognizable crown, eagle heads and automotive frieze follow the [NYC Landmarks Preservation Commission designation report](https://s-media.nyc.gov/agencies/lpc/lp/0992.pdf). This is a scaled game interpretation, not a survey model of the real building.

The factory builds 313 hollow bays with 115 distinct component types including the shared kit. The home copy occupies the existing western landmark site. Generated copies fit a 14 m courtyard; eight surrounding addresses retain their IDs. A deterministic approximately 1/29 frequency creates natural copies. The host's pause-menu button adds a copy in the nearest unoccupied generated courtyard, with a two-second cooldown. It appends cells to an active block without resetting its buildings, damage or physics bodies. Manual layout overrides are included in load/unload and late-join messages, even for pristine unloaded towers.

Custom geometry supports extruded polygons with real triangular openings, bent crown profiles, cones and cylinders. Large crown faces subdivide before bending to prevent folds across windows. All detailed copies share the existing global instance batches. Distant copies use a simpler crown in one extra shared draw. Roof proxies extend hand-query, missile-blast and building broad-phase bounds; a moving or settled crown retains these shapes. Its 35 visual assemblies share supporting structural bays rather than creating 35 independent physics bodies.

`npm run test:chrysler` exercises the actual spawn button and WebSocket flow, an already loaded client block, a late spectator, crown attachment transforms, unload/return, reset and emulated Quest stereo. `tests/chrysler.test.js` checks component coverage, courtyard clearance, stable original IDs, host authorization/cooldown, preserved live damage, pristine late-join metadata, crown debris colliders and high-spire hits.
