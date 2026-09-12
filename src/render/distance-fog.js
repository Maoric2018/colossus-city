import {Color,ShaderChunk,ShaderLib,UniformsLib} from 'three';
import {atmosphereSkyGLSL} from './atmosphere-sky.js';

// Match the city's radial visibility checks in every view, including both XR
// eyes. Depth-only fog leaves wide-screen edges clear after their buildings cull.
// Measure per pixel: interpolating vertex distances would fog the entire large
// ground plane, even directly under the player.
let installed=false;
const atmosphere={citySkyMap:{value:null},citySkyReady:{value:0},citySkyHorizon:{value:new Color(0xb8cede)},citySkyRotation:{value:.4},citySkyIntensity:{value:.8}};
export function installDistanceFog(){
 if(installed)return;installed=true;
 // Built-in materials clone these uniforms when compiling. Texture clones
 // share the HDR source with the sky, so this needs no additional sky image.
 Object.assign(UniformsLib.fog,atmosphere);
 for(const shader of Object.values(ShaderLib))if(shader.uniforms.fogColor)Object.assign(shader.uniforms,atmosphere);
 for(const name of ['fog_pars_vertex','fog_pars_fragment'])ShaderChunk[name]=ShaderChunk[name].replace('varying float vFogDepth;','varying vec3 vCityFogPosition;');
 // All game camera rigs use uniform scale. Undo that scale to measure world
 // metres, including for sprites and particles that only expose mvPosition.
 ShaderChunk.fog_vertex=ShaderChunk.fog_vertex.replace('vFogDepth = - mvPosition.z;',
  'vCityFogPosition = mvPosition.xyz / length(viewMatrix[0].xyz);');
 ShaderChunk.fog_pars_fragment+=`
 #if defined(USE_FOG) && !defined(FOG_EXP2)
  uniform sampler2D citySkyMap;
  uniform float citySkyReady;uniform vec3 citySkyHorizon;uniform float citySkyRotation;uniform float citySkyIntensity;
  ${atmosphereSkyGLSL}
 #endif
 `;
 ShaderChunk.fog_fragment=`
 #ifdef USE_FOG
  float vFogDepth=length(vCityFogPosition);
  vec3 cityFogColor=fogColor;
  #ifdef FOG_EXP2
   float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
   vec3 cityFogDirection=inverseTransformDirection(vCityFogPosition,viewMatrix);
   // Keep the city clear until fogNear, then steepen the final approach to
   // fogFar. Smooth endpoints hide the cutoff without a hard popping edge.
   float t=clamp((vFogDepth-fogNear)/max(1.,fogFar-fogNear),0.,1.);
   float fogFactor=smoothstep(0.,1.,t*t);
   if(citySkyReady>.5&&fogFactor>0.){
    cityFogColor=citySkyRadiance(citySkyMap,cityFogDirection,citySkyHorizon,citySkyRotation,citySkyIntensity);
    #ifdef TONE_MAPPING
     cityFogColor=toneMapping(cityFogColor);
    #endif
    cityFogColor=linearToOutputTexel(vec4(cityFogColor,1.)).rgb;
   }
  #endif
  gl_FragColor.rgb=mix(gl_FragColor.rgb,cityFogColor,fogFactor);
 #endif
 `;
}

export function setAtmospherePanorama(scene,panorama,rotation=.4){
 installDistanceFog();atmosphere.citySkyMap.value=panorama;atmosphere.citySkyRotation.value=rotation;atmosphere.citySkyReady.value=1;
 scene.fog.color.copy(atmosphere.citySkyHorizon.value);
 // Asset loading is asynchronous. Recompile existing materials once with the
 // real sky; later streamed materials receive it on their first compilation.
 const materials=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.fog&&!m.isShaderMaterial)materials.add(m);});
 for(const material of materials){material.defines={...material.defines,CITY_SKY_READY:1};material.needsUpdate=true;}
}
