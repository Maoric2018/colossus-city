import {STREET,SIDEWALK_HALF} from '../../shared/streets.js';
import {surface} from '../render/quality.js';

// Paint is part of the road shader, never a second almost-coplanar road mesh.
// Derivative filtering keeps narrow paint and paving joints stable while moving.
const filtering=`
 float streetBand(float d,float halfWidth){float aa=max(fwidth(d),.008);return 1.-smoothstep(halfWidth-aa,halfWidth+aa,abs(d));}
 float streetAfter(float d,float edge){float aa=max(fwidth(d),.008);return smoothstep(edge-aa,edge+aa,d);}
 float streetStripe(float p,float period,float halfWidth){float d=mod(p+period*.5,period)-period*.5;return streetBand(d,halfWidth);}
`;
export function streetMaterial(tier,textures,sidewalk=false){
 const material=surface(tier,{color:0xffffff,roughness:.95});
 material.onBeforeCompile=shader=>{
  shader.uniforms.citySurface={value:sidewalk?textures.concrete:textures.asphalt};
  shader.vertexShader='varying vec3 cityGroundPosition;varying vec3 cityGroundNormal;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 cityGroundWorld=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    cityGroundWorld=instanceMatrix*cityGroundWorld;
   #endif
   cityGroundPosition=(modelMatrix*cityGroundWorld).xyz;
   cityGroundNormal=normalize(mat3(modelMatrix)*normal);
  `);
  shader.fragmentShader='varying vec3 cityGroundPosition;varying vec3 cityGroundNormal;uniform sampler2D citySurface;\n'+filtering+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 p=cityGroundPosition.xz;
   vec2 block=mod(p+${STREET.block/2}.,${STREET.block}.)-${STREET.block/2}.;
   vec3 grain=texture2D(citySurface,p/6.).rgb;
   ${sidewalk?`
    float edge=min(${SIDEWALK_HALF[0]}.-abs(block.x),${SIDEWALK_HALF[2]}.-abs(block.y));
    float curb=1.-streetAfter(edge,.24),walk=1.-streetAfter(edge,${STREET.sidewalk});
    vec3 tint=mix(vec3(.50,.48,.43),vec3(.88,.87,.82),walk);
    tint=mix(tint,vec3(.94,.93,.85),curb);
    float joint=max(streetStripe(p.x,1.6,.016),streetStripe(p.y,1.6,.016));
    float fade=1.-smoothstep(.12,.5,max(fwidth(p.x),fwidth(p.y)));
    tint*=1.-joint*fade*curb*.22;
    tint*=mix(.64,1.,abs(cityGroundNormal.y));
    diffuseColor.rgb*=mix(vec3(.70),grain,.48)*tint;
   `:`
    float dx=${STREET.block/2}.-abs(block.x),dz=${STREET.block/2}.-abs(block.y);
    diffuseColor.rgb*=grain*.53;
    // Inset utility covers live in the road paint layer, so they cannot z-fight.
    vec2 service=dx<dz?vec2(block.x-${STREET.block/2-2.4},block.y-11.):vec2(block.y-${STREET.block/2-2.4},block.x+11.);
    float radius=length(service),lid=1.-streetAfter(radius,.46),rim=streetBand(radius-.48,.025);
    float hatch=streetStripe(service.x+service.y,.16,.013);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.12,.15)*(1.-hatch*.3),lid);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.18,.21),rim*.35);
    float yellow=max(streetBand(dx-.3,.07)*streetAfter(dz,7.),streetBand(dz-.3,.07)*streetAfter(dx,9.));
    float dash=max(streetBand(dx-4.,.07)*streetAfter(dz,10.)*streetStripe(p.y,8.,1.5),streetBand(dz-3.,.07)*streetAfter(dx,12.)*streetStripe(p.x,8.,1.5));
    float walk=max(streetBand(dz-8.,1.3)*streetAfter(dx,1.5)*(1.-streetAfter(dx,6.))*streetStripe(p.x,1.3,.35),streetBand(dx-10.,1.3)*streetAfter(dz,1.5)*(1.-streetAfter(dz,4.5))*streetStripe(p.y,1.3,.35));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.51,.16),yellow*.9);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.75,.75,.68),max(dash,walk)*.94);
   `}
  `);
 };
 material.customProgramCacheKey=()=>sidewalk?'city-sidewalk-painted-v2':'city-road-painted-v3';
 return material;
}
