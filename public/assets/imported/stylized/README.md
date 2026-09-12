# Painted surface sources

Selected downloaded artwork used by the live game:

- **JulioVII — [Stylized Bricks & Pavement](https://juliovii.itch.io/ftp-bricks-pavement)**: `brick.webp`, `paving.webp`. Creator listing: CC-BY.
- **JulioVII — [Materials Stylized Metal Panels](https://juliovii.itch.io/ftp-stylized-metal-panels)**: `metal.webp`, `vent.webp`. Creator listing: CC-BY.
- **rubberduck — [8 handpainted style textures #2](https://opengameart.org/content/8-handpainted-style-textures-2)**: `concrete.webp`, `marble.webp`. CC0.

The source base colors were resized to 512 × 512 and encoded as WebP. No source normal, displacement, or roughness images are shipped in this set. `SOURCES.json` records the original archive entry and source/output SHA-256 hashes.

The game composites these images into its existing materials: palette tinting, window recesses, reflection bands, blinds, lit windows, roof seams, and restrained metal wear. Quest/mobile use 256px maps; desktop uses 512px. Facades keep their original window openings and destruction UVs. Vehicles keep their vertex colors, and live/ragdoll raiders share the same textured model.

To rebuild, download the free creator archives, name them `brick.zip`, `metal.zip`, and `pack2.zip` in a local folder, then run `node scripts/prepare-surface-assets.mjs --source=/path/to/folder`. To check the committed files, run `node scripts/prepare-surface-assets.mjs --verify`.
