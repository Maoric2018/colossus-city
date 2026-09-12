// Rendering tiers. The tier is chosen once from the GPU before any material is created;
// the Q key only toggles the cheap runtime switches (shadows, bloom, pixel ratio).
import * as T from 'three';
export const TIERS = Object.freeze({
 mobile: {name:'MOBILE',      pixelRatio:1,   antialias:false, shadows:false, shadowSize:0,    bloom:false, normalMaps:false, lambert:true,  particles:.3,  rubble:180, skyline:.3, xrScale:.8,  textureSize:256, far:520},
 quest:  {name:'QUEST',       pixelRatio:1,   antialias:false, shadows:false, shadowSize:0,    bloom:false, normalMaps:false, lambert:true,  particles:.45, rubble:260, skyline:.4, xrScale:.8,  textureSize:256, far:700},
 low:    {name:'PERFORMANCE', pixelRatio:1,   antialias:true,  shadows:false, shadowSize:0,    bloom:false, normalMaps:false, lambert:true,  particles:.7,  rubble:520, skyline:.6, xrScale:.85, textureSize:512, far:900},
 medium: {name:'BALANCED',    pixelRatio:1,   antialias:true,  shadows:true,  shadowSize:1024, bloom:false, normalMaps:true,  lambert:false, particles:1,   rubble:900, skyline:1,  xrScale:.85, textureSize:512, far:900},
 high:   {name:'CINEMATIC',   pixelRatio:1.5, antialias:true,  shadows:true,  shadowSize:2048, bloom:true,  normalMaps:true,  lambert:false, particles:1,   rubble:900, skyline:1,  xrScale:.85, textureSize:512, far:900}
});
const INTEGRATED = /Intel|Iris|UHD|HD Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Apple GPU|Radeon\(TM\) Vega|Radeon Graphics/i;
export function gpuName(renderer){
 try{ const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); }catch{ return 'unknown'; }
}
// "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x...) Direct3D11 ...)" -> "Intel(R) Iris(R) Xe Graphics"
export function gpuLabel(name){
 const angle = /^ANGLE \(([^,]+), ([^(]+)/.exec(name); const label = angle ? angle[2] : name;
 return label.replace(/\s*(Direct3D|OpenGL|Metal|Vulkan).*$/i, '').trim().slice(0, 30);
}
export function detectTier(renderer, quest, touch){
 const forced = new URLSearchParams(location.search).get('quality') || localStorage.getItem('colossus-tier');
 if(forced && TIERS[forced]) return forced;
 if(quest) return 'quest';
 if(touch) return 'mobile';
 return INTEGRATED.test(gpuName(renderer)) ? 'low' : 'medium';
}
// Materials: integrated GPUs pay per pixel, so opaque surfaces use Lambert shading there while
// glass keeps a cheap PBR reflection. The API mirrors MeshStandardMaterial's options.
export function surface(tier, options = {}){
 const {normalMap, normalScale, roughnessMap, roughness, metalness, envMapIntensity, ...rest} = options;
 if(tier.lambert) return new T.MeshLambertMaterial(rest);
 return new T.MeshStandardMaterial({normalMap:tier.normalMaps ? normalMap : null, normalScale, roughnessMap:tier.normalMaps ? roughnessMap : null, roughness, metalness, envMapIntensity, ...rest});
}
export function glassMaterial(tier, options = {}){
 return new T.MeshStandardMaterial({color:0x9fd3ea, metalness:.85, roughness:.14, transparent:true, opacity:tier.lambert ? .62 : .55, envMapIntensity:1.2, depthWrite:false, side:T.DoubleSide, forceSinglePass:true, ...options});
}
