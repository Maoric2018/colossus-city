import {ShaderChunk} from 'three';

// Match the city's radial visibility checks in every view, including both XR
// eyes. Depth-only fog leaves wide-screen edges clear after their buildings cull.
// Measure per pixel: interpolating vertex distances would fog the entire large
// ground plane, even directly under the player.
let installed=false;
export function installDistanceFog(){
 if(installed)return;installed=true;
 for(const name of ['fog_pars_vertex','fog_pars_fragment'])ShaderChunk[name]=ShaderChunk[name].replace('varying float vFogDepth;','varying vec3 vCityFogPosition;');
 // All game camera rigs use uniform scale. Undo that scale to measure world
 // metres, including for sprites and particles that only expose mvPosition.
 ShaderChunk.fog_vertex=ShaderChunk.fog_vertex.replace('vFogDepth = - mvPosition.z;',
  'vCityFogPosition = mvPosition.xyz / length(viewMatrix[0].xyz);');
 ShaderChunk.fog_fragment=ShaderChunk.fog_fragment.replace('#ifdef USE_FOG','#ifdef USE_FOG\n float vFogDepth = length(vCityFogPosition);');
}
