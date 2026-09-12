# Asset sources

The game includes downloaded assets in `imported/`, served locally with no runtime CDN requests:

- Kenney City Kit Commercial and Industrial: skyline, buildings, roof and harbor equipment.
- Kenney Car Kit and Space Kit: vehicles, rifles and satellite dishes.
- Kenney Particle Pack and Smoke Particles: smoke, dust, sparks, flares and muzzle flashes.
- Quaternius Animated Mech Pack: Stan, converted into rigid tracked armor parts with a 1K texture.
- Quaternius Ultimate Modular Men: armored Spacesuit pilot, posed and merged with -Z forward.
- Poly Haven: aerial_asphalt_01, concrete_wall_006 and kloofendal_48d_partly_cloudy_puresky, including real normal/roughness maps and 1K/2K HDR panoramas.

Source pages, original download URLs and bundled file hashes are recorded in [imported/SOURCES.json](imported/SOURCES.json). Kenney pack license files accompany the models and effects. These downloaded packs are CC0; project source uses MIT.

The original five procedural JPEG maps remain available; the facade atlas is still used for the hollow destructible building bays. `scripts/generate-textures.py` recreates those original maps. `npm run assets -- --verify` checks bundled art without networking; `npm run assets` refreshes the photographic textures with hash verification. No asset download is necessary to start the game.
