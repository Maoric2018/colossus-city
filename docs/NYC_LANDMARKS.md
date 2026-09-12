# New York landmark modeling references

The named Hudson Yards placeholder now represents **30 Hudson Yards**, the tower with Edge. **One Vanderbilt** also has its own massing and architectural kit. These are destructible game-scale interpretations, not surveyed digital twins or a geographically accurate reconstruction of Manhattan. Existing street locations and clearances are retained.

## Sources inspected

- [KPF — 10 & 30 Hudson Yards](https://www.kpf.com/project/10-30-hudson-yards): official photographs and description of the tapering towers, sloping rooflines, lobby and terraces. The current model depicts 30, not the entire Hudson Yards complex or its neighboring 10 Hudson Yards tower.
- [KPF — Edge](https://www.kpf.com/project/edge): triangular cantilever, reflective stainless underside, inclined glass perimeter, glass-floor motif and bleacher stairs.
- [KPF — One Vanderbilt](https://www.kpf.com/project/one-vanderbilt): photographs of four interlocking tapering volumes, asymmetrical crown, narrow spire, warm terra-cotta façade, angled base reveals and bronze lobby flutes.

Official reference photographs were downloaded into the ignored `artifacts/landmark-reference/` directory for visual comparison. They are not shipped as game textures. Geometry and texture patterns are modeled in the repository so architectural pieces can separate with the destruction system.

## Representation

| Feature | 30 Hudson Yards | One Vanderbilt |
| --- | --- | --- |
| Destructible bays | 228 | 424 |
| Custom assemblies | 31, plus 20 shared modern types | 27, plus 20 shared modern types |
| Total component types used | 89 | 85 |
| Body | Gradual taper, lower shoulder, taller offset volume | Four clockwise staggered volumes, gradual taper and a real open upper corner |
| Façade | Blue glass, dark floor ribbons, silver lips, fine panel joints | Blue glass, fluted terra-cotta spandrels, glazed edges and narrow vertical mullions |
| Crown / projections | Sloped crown split between six owning roof bays; triangular Edge deck | Glass lantern, needle and collars; SUMMIT skyboxes |
| Base | Tall lobby piers, diagonal braces, folded soffits and canopy | Bronze flutes, terra-cotta ceiling, diagonal reveals and transit entrance framing |

The 18 m footprints fit the game's existing dense blocks. Structural storeys group multiple visible office levels. Floor plates taper in small steps, and fine architectural dimensions are adapted to remain legible at the game's scale. Lobby interiors, detailed curtain-wall fabrication, interiors above the lobby and the complete real roof engineering are simplified. No text or name signs are placed in the world.

The glazed crowns and decks are part of their supporting structural assemblies. Simple cuboid slices approximate the sloped crowns and deck perimeter for server physics, hand contact and debris. They remain collidable when detached; missiles striking those projections can damage their owning bay. Vanderbilt's notched shoulders retain genuinely empty space, and the same cell table drives client and server.

Both models use instanced component batches. Fine façade flutes and seams are distance-limited, while crowns, deck and massing remain visible farther away. The reflective modern façade is opaque while intact, which avoids expensive stacked transparency and the appearance of an unfinished open frame. Breaking the glass layer still reveals the interior.

## Verification

- Structural and geometry tests: deterministic bays, support continuity, occupied shoulder slabs, empty notches, all part geometry finite, extended collision bounds and detached colliders.
- Rendered city checks: individual towers, crown/deck close-ups, façade details, fragment persistence and reset.
- Emulated Quest 2: both-eye rendering, crown/deck visibility and attachment transforms after a bay falls. This does not measure frame rate on physical Quest hardware.

After updating, restart the server and refresh every client into a new room: home-city bay IDs change with the revised landmarks.
