# Fine building destruction

The player-facing Chrysler spawn shortcut is removed. The Chrysler still appears in the home district and through normal procedural generation.

## Pieces instead of room chunks

`shared/city/fracture.js` supplies deterministic piece recipes for the existing building catalog. Only touched bays allocate fine pieces; intact city rendering, continuous column colliders, merged floors and the support graph keep their existing inexpensive representation.

| Material or member | Maximum piece dimensions in city metres |
| --- | --- |
| Brick face | 0.42 × 0.24 × 0.12 |
| Glass pane | 0.76 × 0.82 × 0.12; thinner rendered glass shards |
| Stone/concrete face | 0.58 × 0.38 × 0.12 |
| Steel column | 0.30 × 0.62 × 0.30; artwork cut from original frame members |
| Floor slab | 0.72 × 0.26 × 0.72 |
| Roof/crown contact proxy | 0.80 m per axis |

Recipes preserve open landmark portals and exterior-wall masks. Existing authored landmark components remain until their supporting surface or roof attachment is damaged. Damage selection still uses simplified shared contact proxies. Artwork is cut directly from the authored triangles, including roof ornaments and downloaded roof models, rather than rendering those proxies.

Hands and soaring capsules select pieces by continuous oriented sweeps. Bullets accumulate damage on specific piece IDs; blasts remove nearby pieces. A small hole changes neither another wall nor the entire bay. Greedy merging of surviving adjacent pieces makes a few collision rectangles around a hole instead of a collider per brick. Client aim, movement, hands and the server share that exact recipe.

The fragment renderer clips the original frame, masonry, glazing, architectural components and roof meshes. It interpolates their existing UVs, normals and vertex colors, keeps the source materials and creates both the surviving surface and loose debris from those same triangles. Material batches draw different clipped geometries together; undamaged buildings retain their original instancing. Closed cross-sections add cut faces with the same material, interpolated UVs and vertex colors. Disconnected members and hollow sections keep their gaps. Exposed reverse faces use the source texture too, with reduced metallic sky reflection inside. This replaces the former generic fragment palette and proxy-shaped artwork. Steel and slab loss weaken support; wall-only damage does not. Cutting all four columns releases a bay, while the existing strong neighbor connections prevent easy global toppling.

## Persistent rubble and budgets

Nearby removed pieces of the same material share compact groups on a 1.05 m grid. These groups preserve the individually rendered bricks/panes/bars and stay much smaller than a room. At most 96 groups use active Rapier bodies. Additional groups keep every visible piece and use a server-directed ballistic fall to a queried supporting surface. Fine debris does not damage the colossus or raiders.

Sleeping fragments retain their pose while supported. Upward-facing surface checks reject wall interiors as support, recheck completed ballistic falls, and resume gravity when a supporting floor disappears. Enclosed islands of disconnected facade pieces also detach. The latest 256 resting groups have static collision proxies; older rubble remains visible. Groups beyond the active budget avoid fragment-to-fragment physics. Surviving pieces and loose fragments share material-based BatchedMesh pools with distance culling and reusable geometry/instance slots. Each BatchedMesh now culls individual draws against the current camera, both headset eyes or the shadow camera. This also applies when a spectator changes views. Simulation and persistence continue for culled pieces. Block unloading releases detailed render instances and active physics while journaling the pieces.

Directly severed bays release immediately. Unsupported upper bays shed bottom to top, two bays per simulation tick. Each bay remains visible and solid until its small fragments appear. This avoids hiding a whole tower ahead of its debris, or creating a large one-frame burst of physics and reliable network messages.

`fracture` records removed IDs, `shards` records small groups and their poses, and `fine-collapse` records fully released cells. Active physical groups reuse the binary body snapshot format. Settled groups stop sending snapshots. Welcome messages, streamed block journals and distant damaged silhouettes retain the holes; returning players and late spectators receive the same IDs. Round reset clears the entire fine state. Legacy direct bay-detachment APIs remain for existing structural tools and tests; normal point/sweep gameplay uses fine destruction.

## Verification

- `npm run test:all`: local-hit geometry and contact accuracy, exact-piece accumulated damage, sticky support, progressive collapse, debris budgets, streaming and multiplayer regressions.
- `npm run test:fine-destruction`: real browser before/after renders for brick, glass, stone and concrete; matching ray openings, valid clipped geometry and round reset. After textures finish loading, both the intact-to-fragment representation and reassembled loose fragments are compared pixel by pixel against the original building.
- `npm run test:fracture-render`: actual brick cut-interior color, 480 persistent debris groups, opposite camera views and stereo; compares culled and unculled frames pixel by pixel.
- `npm run test:giant`: Quest 2 stereo emulation, live authoritative hand crushing and a late-joining spectator with identical piece/rubble identities.
- `npm run test:soar-breach`: predicted flight through both walls under delayed snapshots, with no backward corrections and persistent fine fragments.

The flight check also covers a corrected Rapier capsule rotation: rotation is relative to its parent body, so the prone hitbox survives subsequent physics steps.

The current pass has 180 passing automated tests. Four material browser fixtures compare original and reassembled exteriors, allowing for the newly visible colored inner faces. The 480-group debris fixture submitted 6,992 triangles with culling versus 48,000 without it (about 85% less), with identical pixels; opposite-camera and stereo comparisons also matched exactly. These counts describe this debris fixture, not an overall frame-rate increase. Browser flight and Quest 2 stereo emulation also pass. Physical Quest 2 testing is still needed to establish headset frame rate under extended destruction.

Soaring no longer checks or burns fuel, including boosted soaring. Hover thrust, dodges and breach weapons retain their existing fuel costs. An authoritative rising-edge event triggers a sonic boom and expanding world shockwave; desktop peripheral streamlines, condensation arcs and the brief entry ring are included in spectator captures. These screen effects remain outside XR.
