# Dense city architectural kit

Midtown contains 169 buildings and 5,452 hollow structural bays. Outside its original five-by-five block grid, deterministic 70 m blocks generate in every horizontal direction. Each new block has eight buildings around a courtyard, with footprints that preserve roads and alley clearance. Sixteen architecture families vary material, height, footprint, roofline and details. Existing downloaded Kenney/Quaternius props and photographic textures are reused; custom code supplies the destructible architectural kit and landmark-specific geometry.

`shared/city/components.js` defines **101 real geometry types**. Every building uses at least **75 distinct types**, including the landmarks and the reduced headset kit (the starting district currently has a minimum of 78). `src/world/components.js` shares one batch set across loaded blocks and attaches each part to its parent bay and skin. Physics operates on structural bays and simplified equipment proxies; ornaments do not each create a separate rigid body.

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
| Empire State style | fluted limestone pilasters, Art Deco entrance sunburst, setback cornices, stepped crown, observation balustrade, mast buttresses |

The twin towers share 30-storey square shafts and matching roof heights; only the north tower has a tall antenna. The Empire State–style model has five setbacks, a dedicated limestone/window treatment and a spire. These are scaled, stylized game interpretations, with dimensions chosen for the arena. Architectural references: [Skyscraper Museum’s Twin Towers exhibition](https://www.skyscraper.org/exhibitions/giants-twin-towers-and-the-twentieth-century/) and the [Empire State Building’s architecture page](https://www.esbnyc.com/about/architecture-design).

Structural debris and its component attachments persist until round reset. Sleeping pieces retain fixed collision and final-pose replication. Destroyed glass and facade layers also leave deterministic visual fragments; temporary dust still dissipates. Late joins reconstruct both forms of remains. Falling bays use simplified solid collision proxies, not triangle meshes for every ornament.

The client retains at most nine detailed generated blocks around its camera and a bounded ring of inexpensive silhouettes. Detail parts are selected within 64 m on Quest, 85 m on performance tier and 115 m on higher tiers; landmark parts extend to 230 m. Selection includes both XR eyes. Core instances are compacted by visibility on tiers without shadows, while desktop shadow casters remain available. Fog and the sky use matching horizon colors. Offscreen blocks retain damage records for the round; their physics resumes on return, and pristine blocks regenerate from the seed.

`npm run test:city` renders the district and both landmarks, checks attachments against transformed bays, verifies fragment persistence and reset, compares late-join fragment positions, and checks that stale snapshots cannot move settled pieces. Its screenshots and report are written to `artifacts/`.

`npm run test:streaming` visits distant positive and negative coordinates, checks unloading and return-trip rubble, tests culling across both eye frustums, and walks an emulated Quest player beyond the old map boundary. `tests/streaming.test.js` checks stable IDs, architecture variety, server physics neighborhoods, split players, saved damage and real movement across the former boundary.
