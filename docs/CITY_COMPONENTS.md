# Dense city architectural kit

The map contains 169 buildings and 5,452 hollow structural bays. Each occupied block has at least six buildings. Generated infill respects tower footprints, roads, the central plaza and alley clearance. Existing downloaded Kenney/Quaternius props and photographic textures are reused; custom code supplies the destructible architectural kit and landmark-specific geometry.

`shared/city/components.js` defines 45 real geometry types. Each building uses at least 30 of them, including the twins. `src/world/components.js` batches instances and attaches them to their parent bay and skin. These are modeled component assemblies, not 45 independently simulated bodies per bay. This keeps the dense city practical for multiplayer and headset rendering.

| Family | Parts |
| --- | --- |
| Structure / interior | slab edge, I girder, flanged column, cross brace, floor joists, service-core wall, elevator doors, ten-tread staircase, stair landing, stair rail, service riser |
| Facade / access | lintel, sill, mullions, transom, masonry pier, quoins, moulded cornice, dentils, shop doorway, storefront framing, shutter slats, canopy, balcony platform and railing, fire escape platform and ladder |
| Roof | parapet coping, roof drain, capped chimney, ventilation duct, ridge skylight, louvered vent |
| Twin towers | perimeter ribs, three-prong lobby tridents, spandrels, mechanical-floor louvers, rooftop hat trusses, flat crown rims |
| Empire State style | fluted limestone pilasters, Art Deco entrance sunburst, setback cornices, stepped crown, observation balustrade, mast buttresses |

The twin towers share 30-storey square shafts and matching roof heights; only the north tower has a tall antenna. The Empire State–style model has five setbacks, a dedicated limestone/window treatment and a spire. These are scaled, stylized game interpretations, with dimensions chosen for the arena. Architectural references: [Skyscraper Museum’s Twin Towers exhibition](https://www.skyscraper.org/exhibitions/giants-twin-towers-and-the-twentieth-century/) and the [Empire State Building’s architecture page](https://www.esbnyc.com/about/architecture-design).

Structural debris and its component attachments persist until round reset. Sleeping pieces retain fixed collision and final-pose replication. Destroyed glass and facade layers also leave deterministic visual fragments; temporary dust still dissipates. Late joins reconstruct both forms of remains. Falling bays use simplified solid collision proxies, not triangle meshes for every ornament.

`npm run test:city` renders the district and both landmarks, checks attachments against transformed bays, verifies fragment persistence and reset, compares late-join fragment positions, and checks that stale snapshots cannot move settled pieces. Its screenshots and report are written to `artifacts/`.
