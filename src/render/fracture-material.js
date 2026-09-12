import * as T from 'three';
export function fractureMaterial(source){
 const material=source.clone();material.vertexColors=true;material.side=T.DoubleSide;material.forceSinglePass=true;
 // A pane's reverse face is still authored glass, not an exposed solid
 // interior. Changing its reflectivity recolors the entire window after a hit.
 if(!source.transparent)material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nif (!gl_FrontFacing) { metalnessFactor = 0.0; roughnessFactor = max(roughnessFactor, 0.8); }');};
 material.customProgramCacheKey=()=>source.transparent?'fracture-authored-glass-v1':'fracture-interior-v1';return material;
}
