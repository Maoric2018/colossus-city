# Asset provenance

The five bundled JPEG textures were generated specifically for this project by
`scripts/generate-textures.py`: asphalt, concrete, facade, facade-normal and
facade-emissive. Their source and generated outputs are included under the
project's MIT license. They are not scans of New York or downloaded photographs.
All default architectural/character geometry is authored in project JavaScript.
No proprietary models, font files, copyrighted music, or externally hosted
runtime assets are included.

`npm run assets` is an OPTIONAL network-dependent photographic surface upgrade.
It fetches two 1K diffuse textures from Poly Haven and retains a `.source.json`
record for each successful download. Those assets use Poly Haven's CC0 license,
not this project's license. This command has not been run successfully in the
source-authoring environment. The bundled textures are sufficient to launch.

Three.js, Rapier and ws are installed separately and retain their own licenses
inside node_modules. Review and retain the licenses of any assets you add.

Source pages for the optional upgrade:
- https://polyhaven.com/a/aerial_asphalt_01
- https://polyhaven.com/a/concrete_wall_006
- https://polyhaven.com/license
