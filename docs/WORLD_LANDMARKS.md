# World landmarks

The infinite street-address generator now includes **18 additional landmarks from 11 cities**, alongside the 52 urban/New York additions and 16 original recipes: **86 street-address recipes** in total. The original home landmarks and special Chrysler courtyard remain available. World landmarks contribute **100 custom component types**, bringing the shared registry to **415**.

These are destructible, gameplay-scaled architectural interpretations. Floor counts, footprints, curves and proportions are simplified to fit the dense street plots and combat scale; they are not measured replicas. The generator mixes cities within the existing neighborhoods rather than reproducing their geographical street layouts. No building names or text signs appear in the game.

## Models and identifying parts

Every recipe places 38–49 distinct component types, including its custom architectural kit plus shared structural, entrance, service and roof details. This counts actual placed types rather than repeated instances.

| City | Landmark | Modeled identifying features | Types |
| --- | --- | --- | --- |
| San Francisco | Transamerica Pyramid | Tapered quartz exterior, projecting elevator wings, splayed lobby braces, pyramidal spire | 38 |
| San Francisco | Ferry Building | Long arcaded hall, pitched hall roof, central clock tower, cornice dentils | 47 |
| Shanghai | Jin Mao Tower | Stepped pagoda profile, projecting eaves, stainless ribs, layered crown | 46 |
| Shanghai | Shanghai World Financial Center | Tapered glass tower, open sky portal, silver aperture lining and lintel | 46 |
| Hong Kong | Bank of China Tower | Stepped volumes, diagonal megabraces, sloped crown and twin masts | 49 |
| Hong Kong | HSBC Main Building | Open base, exposed paired service masts, suspension trusses and exterior galleries | 40 |
| London | The Shard | Tapered glass body, projecting blades, split upper crown and mechanical vents | 38 |
| London | Elizabeth Tower | Limestone piers, Gothic tracery, white clock dials and modeled hands, pyramidal roof | 39 |
| London | Lloyd’s Building | External cylindrical service risers, access galleries, valve assemblies and roof plant | 46 |
| Dubai | Burj Khalifa | Branching stepped base, narrowing setbacks, silver flutes and long spire | 46 |
| Dubai | Emirates Towers | Unequal twin towers, connecting podium, slanted roof sections and stainless fins | 47 |
| Chicago | Willis Tower | Dark bundled tubes, staggered roof levels, mechanical screens and antennas | 46 |
| Chicago | 875 North Michigan Avenue | Tapered dark tower, sectional exterior X-bracing and paired roof antennas | 41 |
| Taipei | Taipei 101 | Flared bamboo sections, jade fins, projecting cloud brackets and tiered spire | 46 |
| Kuala Lumpur | Petronas Twin Towers | Paired towers, upper setbacks, skybridge, stainless rings and matching crowns | 46 |
| Singapore | Marina Bay Sands | Three towers, open gaps, continuous SkyPark, projecting bow and roof gardens | 47 |
| Tokyo | Tokyo Metropolitan Government Building | Gridded stone exterior, broad stepped base, twin upper towers and crown vents | 46 |
| Paris | Grande Arche | Square framed portal, recessed glazing, marble plinth and roof balustrades | 46 |

## Generation, contact and rendering

The 18 world recipes join the eight New York catalog landmarks in the existing landmark pool. Approximately one block in three selects a landmark for one of its eight street addresses. The pool and all ordinary building choices use the world seed and block coordinates, keeping server, players and spectators consistent and revisits deterministic. The original home geometry and IDs are unchanged.

Openings in SWFC, Petronas, Marina Bay Sands and Grande Arche are absent structural cells, with matching rendering and collision gaps. The HSBC base has open skins and solid structural portals. Stepped and flared column runs are divided at changes in profile so a long merged collider does not cross their ledges. Custom roof sections, masts and projecting equipment have local collision proxies that follow their supporting bay into persistent debris. Tapered crowns use several smaller collision slices to avoid a single oversized hitbox.

The live city renders detailed landmarks only, with no distant silhouette substitutes. Fog reaches full opacity at 150 m on Quest and desktop before the detailed neighborhood ends. Damage recorded while a landmark is unloaded is restored on approach, including removed bays and open portals. Glass towers share an opaque curtain-wall material with per-instance tint; this avoids internal surfaces showing through and reduces transparent overdraw. Streamed districts reuse that material and its textures. Detailed loading remains capped at 49 blocks. The standalone model-review tools retain the silhouette geometry for comparison.

## Reference sources

Architectural descriptions and project photographs informed the modeled interpretations. Existing downloaded game textures are reused; these modular models are authored in the repository so their pieces match the destruction system.

- San Francisco: [Transamerica Pyramid](https://transamericapyramid.com/transamerica-pyramid), [Ferry Building history](https://www.ferrybuildingmarketplace.com/about/).
- Shanghai: [SOM: Jin Mao Tower](https://www.som.com/projects/jin-mao-tower/), [KPF: Shanghai World Financial Center](https://www.kpf.com/project/shanghai-world-financial-center).
- Hong Kong: [Pei Cobb Freed: Bank of China Tower](https://www.pcf-p.com/projects/bank-of-china-tower/), [Foster + Partners: HSBC headquarters](https://www.fosterandpartners.com/projects/hongkong-and-shanghai-bank-headquarters).
- London: [The Shard’s architectural vision](https://www.the-shard.com/about/vision), [UK Parliament: its towers](https://www.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/towers-of-parliament/), [RSHP: Lloyd’s project sheet](https://rshp.com/assets/uploads/0170_LloydsOfLondon_JS_en_2.pdf).
- Dubai: [SOM: Burj Khalifa](https://www.som.com/projects/burj-khalifa/), [HH Angus: Emirates Towers](https://hhangus.com/projects/emirates-towers/).
- Chicago: [SOM: Willis Tower](https://www.som.com/projects/willis-tower-formerly-sears-tower/), [SOM: 875 North Michigan Avenue](https://www.som.com/projects/875-north-michigan-avenue-formerly-john-hancock-center/).
- Taipei: [Taipei 101 architecture and design](https://www.taipei-101.com.tw/en/concept).
- Kuala Lumpur: [Petronas design and structure](https://www.petronastwintowers.com.my/the-towers/design-structure/).
- Singapore: [Safdie Architects: Marina Bay Sands Hotel and SkyPark](https://www.safdiearchitects.com/projects/marina-bay-sands-hotel-and-skypark).
- Tokyo: [Tokyo Metropolitan University architectural tour sheet](https://tmu-mi6up.fpark.tmu.ac.jp/file20/20512%E9%83%BD%E5%BA%81%E8%88%8E%28English%29.pdf).
- Paris: [Paris La Défense: Grande Arche](https://www.parisladefense.com/en/district/towers-buildings/grande-arche).

## Verification

- `npm run test:all`: 165 tests, including recipe coverage, deterministic generation, geometry bounds, pristine physical stability, actual portal collision clearance, crown contacts, detached debris and streaming persistence.
- `npm run test:world-landmarks`: browser review of all 18 close models and their distant silhouettes on the Quest detail tier; validates 30+ types, finite geometry, roof-site agreement and moving crown attachments. Outputs `artifacts/world-landmarks-contact-sheet.png` and `artifacts/world-landmarks-report.json`.
- `npm run test:streaming`: actual travel beyond the original city boundary, stereo culling, persistent rubble, distant damaged portal clearance, material reuse and emulated Quest 2 stereo visits to generated SWFC and Marina Bay buildings.
- `npm run test:catalog` and `npm run check`: existing catalog browser regression and module checks.

Quest emulation verifies stereo rendering and controls, not frame rate on physical Quest 2 hardware. Restart the server and refresh all players together, then create a new room after changing the generation recipes.
