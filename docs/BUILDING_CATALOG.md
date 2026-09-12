# Infinite city building catalog

This urban/New York expansion adds 52 building recipes: 44 ordinary building types and eight New York landmarks. The subsequent [world landmark expansion](WORLD_LANDMARKS.md) adds another 18 recipes. The infinite street-address catalog contains 86 recipes, plus the special Chrysler courtyard and home landmarks. Counts below are component **types** in the default Quest gallery variant, not repeated bricks or instances; ordinary buildings use useful details without a minimum type quota.

## Generation

Six neighborhood mixes—residential, industrial, civic, arts, office and market—bias nearby blocks toward related uses. Each block independently randomizes its building selections, ordinary building heights, bay widths, story heights, setback directions and material variation. Eight different street-address types are selected per block; approximately one block in three includes one of the 26 New York/world catalog landmarks. Occasional courtyards contain a Chrysler landmark.

All random choices derive from the world seed and block coordinates. The server, every player and late-joining spectators generate the same buildings regardless of exploration order. Reloading a district preserves its geometry, damage and resting debris. Home buildings keep their massing, IDs and architecture assignments; the generic detail cleanup applies to home buildings and generated districts alike.

## Generic detail rules

Masonry and concrete window surrounds follow the actual pane outlines in the facade texture. Glass facades reuse their existing mullion texture. Extra grids, diagonal braces, window grilles and decorative panels that cross panes are omitted. Each building has one main entrance; brick walkups can have a continuous rear fire escape. Appropriate balconies and roof profiles remain.

Flat roofs have one access area with a hatch and vent, or one small water tower where specified. Plant, garden and solar roofs place their service feature once on the highest roof, with adjacent access where space permits. Random satellite dishes and repeated equipment on every roof bay are removed. Shared placement rules keep visible roof props, previews and collision geometry aligned. Landmark-specific components retain their existing placement.

## Recipes

Dimensions are adapted to the game's city scale. Structural storeys group real-world floors. These are recognizable architectural interpretations, not measured replicas. Ordinary recipes combine different massing, entrances, window systems and roofs; their shared service and structural assemblies provide detailed exposed interiors after destruction.

| New building type | Massing recipe | Roof | Distinct placed components |
| --- | --- | --- | --- |
| Brooklyn rowhouse | flat | mansard | 18 |
| Dutch gabled house | flat | gable | 16 |
| Federal townhouse | flat | hip | 16 |
| Greystone apartments | setback | mansard | 15 |
| Limestone mansion | wings | hip | 15 |
| Carriage house | flat | gable | 17 |
| Corner bodega apartments | flat | flat | 20 |
| Chrome diner | flat | barrel | 16 |
| Art Moderne cinema | setback | flat | 17 |
| City firehouse | rear-tower | hip | 16 |
| Neighborhood precinct | setback | flat | 17 |
| Public library | wings | hip | 16 |
| Courthouse | wings | dome | 15 |
| Post office | flat | hip | 16 |
| Transit headhouse | flat | gable | 17 |
| Power substation | flat | saw | 16 |
| Municipal clock tower | tower | pyramid | 15 |
| Neighborhood church | rear-tower | pyramid | 15 |
| Neighborhood synagogue | wings | dome | 16 |
| Gothic cathedral | twin-tower | pyramid | 16 |
| Glass conservatory | flat | glass-ridge | 14 |
| University hall | wings | hip | 15 |
| City school | wings | flat | 18 |
| Hospital wing | slab | flat | 18 |
| Research laboratory | setback | plant | 16 |
| Parking garage | flat | flat | 18 |
| Bus depot | flat | saw | 16 |
| Railway terminal | wings | barrel | 15 |
| Ferry terminal | rear-tower | hip | 15 |
| Shipping warehouse | flat | saw | 16 |
| Textile mill | rear-tower | saw | 16 |
| Brewery | setback | plant | 17 |
| Cold storage warehouse | flat | plant | 17 |
| Printing house | setback | saw | 15 |
| Converted industrial lofts | setback | flat | 18 |
| Music hall | wings | barrel | 15 |
| Contemporary museum | terrace | flat | 17 |
| Art gallery | setback | glass-ridge | 14 |
| Garden apartments | terrace | garden | 21 |
| Balcony condominiums | setback | garden | 17 |
| Slender point tower | flat | plant | 16 |
| Slab apartments | slab | garden | 19 |
| Stepped offices | tower | flat | 17 |
| Solar office building | terrace | solar | 16 |
| 432 Park Avenue | flat | flat | 45 |
| Woolworth Building | gothic-tower | woolworth | 46 |
| 40 Wall Street | wall-tower | wall40 | 46 |
| 30 Rockefeller Plaza | rock-slab | rock | 46 |
| Seagram Building | flat | seagram | 37 |
| Lever House | lever-slab | lever | 40 |
| Citigroup Center | stilt-tower | citi | 33 |
| Hearst Tower | hearst-tower | hearst | 48 |

## Landmark reference notes

- **432 Park Avenue:** exposed square concrete grid, inset window seals and six open mechanical breaks. [Rafael Viñoly Architects](https://www.rvapc.com/works/432-park-avenue/).
- **Woolworth:** clustered terra-cotta piers, Gothic window tracery, an entrance arch, corner pinnacles and a green pyramidal crown. [NYC Landmarks Preservation Commission designation report](https://s-media.nyc.gov/agencies/lpc/lp/1273.pdf).
- **40 Wall Street:** stepped tower, vertical stone piers, bronze spandrels, bank entrance and green roof lantern/pyramid. [Building owner's gallery](https://40wallstreet.com/gallery/).
- **30 Rockefeller Plaza:** stepped limestone slab, vertical façade ribbons, entrance relief and observation screens. [Rockefeller Center building description](https://www.rockefellercenter.com/leasing/30-rockefeller-plaza).
- **Seagram:** dark bronze I-beams, bronze spandrels and a restrained rectangular tower. [NYC Landmarks Preservation Commission designation report](https://s-media.nyc.gov/agencies/lpc/lp/1664.pdf).
- **Lever House:** green spandrels, stainless mullions, a thin slab over a broad garden podium and open ground-floor columns. [SOM project description](https://www.som.com/projects/lever-house/).
- **Citigroup Center:** horizontal aluminum bands, open raised base and a continuous sloping roof split across nine destructible bays. [NYC Landmarks Preservation Commission](https://www.nyc.gov/site/lpc/about/pr2016/12-06.page).
- **Hearst:** historic masonry base with a contrasting glass tower, stainless diagonal grid and node plates. [Foster + Partners](https://www.fosterandpartners.com/news/next-venice-biennale-8-september-to-3-november-2002), [structural engineer WSP](https://www.wsp.com/en-us/projects/hearst-tower-new-york).

No new building names or text signs are shown in the game. Reference descriptions inform repository-modeled geometry; existing downloaded textures and compatible roof props are reused.

## Collision and performance

Roof geometry is attached to its supporting bay and follows that bay into persistent debris. Stepped cuboid proxies approximate pitched roofs and crowns for the server, local hand prediction and missiles. Open mechanical levels and raised bases have matching open collision skins. Disconnected cathedral tower tops no longer acquire an invisible bounding slab across their gap.

Close components use instance batches allocated only when a type appears. Small detail remains distance-limited; roof silhouettes and landmark signatures persist farther out. Up to 25 detailed generated blocks surround the camera, and fog hides their outer boundary without a simplified distant building ring. The generic cleanup reduces repeated geometry without introducing per-detail physics bodies.

## Verification

- 1,024 generated blocks: every type appears; deterministic reloads, seed variation, unique neighbors, clear streets/plots and bounded cell counts.
- Every new recipe at four variants and both detail tiers: valid components, finite geometry, reciprocal support links, no pristine collapse or overload. Landmarks retain 30+ distinct placed types.
- Generic home and catalog buildings: window trims stay outside panes, entrances and roof services have bounded placement, and random window bars and satellite dishes are absent.
- Real server collision checks: open mechanical floors, cathedral gaps, roof contacts and detached roof colliders.
- Browser model gallery: all 52 recipes, moving roof attachment matrices and valid distant meshes. Gallery inspection enables full detail; gameplay uses the normal distance limits.
- Streaming browser checks: district traversal, both-eye culling, persistent rubble after unload/reload, and emulated Quest 2 stereo traversal. This verifies the rendering path, not physical Quest frame rate.

Run `npm run test:all`, `npm run test:catalog`, `npm run test:streaming` and `npm run check`. Browser artifacts are written to the ignored `artifacts/` directory.

Restart the server and refresh all clients together, then create a new room after changing the generation recipe.
