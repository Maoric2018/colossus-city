# Infinite city building catalog

This urban/New York expansion adds 52 building recipes: 44 ordinary building types and eight New York landmarks, with 101 modeled component types. Each recipe actually places 33–56 distinct types on the Quest detail tier. The subsequent [world landmark expansion](WORLD_LANDMARKS.md) adds another 18 recipes and 100 components. The current infinite street-address catalog contains 86 recipes and the shared component registry contains 415 types, plus the existing special Chrysler courtyard and home landmarks. Counts below are component **types**, not repeated bricks or instances.

## Generation

Six neighborhood mixes—residential, industrial, civic, arts, office and market—bias nearby blocks toward related uses. Each block independently randomizes its building selections, ordinary building heights, bay widths, story heights, setback directions and material variation. Eight different street-address types are selected per block; approximately one block in three includes one of the 26 New York/world catalog landmarks. Existing occasional Chrysler courtyards still work, including manual host spawning.

All random choices derive from the world seed and block coordinates. The server, every player and late-joining spectators generate the same buildings regardless of exploration order. Reloading a district preserves its geometry, damage and resting debris. The original home buildings retain their previous geometry, IDs and architecture assignments.

## Recipes

Dimensions are adapted to the game's city scale. Structural storeys group real-world floors. These are recognizable architectural interpretations, not measured replicas. Ordinary recipes combine different massing, entrances, window systems and roofs; their shared service and structural assemblies provide detailed exposed interiors after destruction.

| New building type | Massing recipe | Roof | Distinct placed components |
| --- | --- | --- | --- |
| Brooklyn rowhouse | flat | mansard | 56 |
| Dutch gabled house | flat | gable | 55 |
| Federal townhouse | flat | hip | 56 |
| Greystone apartments | setback | mansard | 54 |
| Limestone mansion | wings | hip | 54 |
| Carriage house | flat | gable | 56 |
| Corner bodega apartments | flat | flat | 52 |
| Chrome diner | flat | barrel | 50 |
| Art Moderne cinema | setback | flat | 53 |
| City firehouse | rear-tower | hip | 53 |
| Neighborhood precinct | setback | flat | 50 |
| Public library | wings | hip | 51 |
| Courthouse | wings | dome | 51 |
| Post office | flat | hip | 53 |
| Transit headhouse | flat | gable | 51 |
| Power substation | flat | saw | 51 |
| Municipal clock tower | tower | pyramid | 53 |
| Neighborhood church | rear-tower | pyramid | 51 |
| Neighborhood synagogue | wings | dome | 51 |
| Gothic cathedral | twin-tower | pyramid | 51 |
| Glass conservatory | flat | glass-ridge | 54 |
| University hall | wings | hip | 53 |
| City school | wings | flat | 54 |
| Hospital wing | slab | flat | 50 |
| Research laboratory | setback | plant | 50 |
| Parking garage | flat | flat | 49 |
| Bus depot | flat | saw | 53 |
| Railway terminal | wings | barrel | 51 |
| Ferry terminal | rear-tower | hip | 53 |
| Shipping warehouse | flat | saw | 53 |
| Textile mill | rear-tower | saw | 53 |
| Brewery | setback | plant | 53 |
| Cold storage warehouse | flat | plant | 51 |
| Printing house | setback | saw | 53 |
| Converted industrial lofts | setback | flat | 54 |
| Music hall | wings | barrel | 54 |
| Contemporary museum | terrace | flat | 52 |
| Art gallery | setback | glass-ridge | 54 |
| Garden apartments | terrace | garden | 55 |
| Balcony condominiums | setback | garden | 54 |
| Slender point tower | flat | plant | 50 |
| Slab apartments | slab | garden | 53 |
| Stepped offices | tower | flat | 50 |
| Solar office building | terrace | solar | 50 |
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

Close components use global instance batches allocated only when a type appears. Small detail remains distance-limited; roof silhouettes and landmark signatures persist farther out. Distant landmarks use one shared instance batch per design and flat façade strips instead of solid trim boxes. Distant ordinary roofs also share batches. Nearby district loading remains capped at nine detailed client blocks; no per-detail physics bodies or unbounded per-address mesh cache are introduced.

## Verification

- 1,024 generated blocks: every type appears; deterministic reloads, seed variation, unique neighbors, clear streets/plots and bounded cell counts.
- Every new recipe at four variants and both detail tiers: 30+ distinct placed components, finite geometry, reciprocal support links, no pristine collapse or overload.
- Real server collision checks: open mechanical floors, cathedral gaps, roof contacts and detached roof colliders.
- Browser model gallery: all 52 recipes, moving roof attachment matrices and valid distant meshes. Gallery inspection enables full detail; gameplay uses the normal distance limits.
- Streaming browser checks: district traversal, both-eye culling, persistent rubble after unload/reload, and emulated Quest 2 stereo traversal. This verifies the rendering path, not physical Quest frame rate.

Run `npm run test:all`, `npm run test:catalog`, `npm run test:streaming` and `npm run check`. Browser artifacts are written to the ignored `artifacts/` directory.

Restart the server and refresh all clients together, then create a new room after changing the generation recipe.
