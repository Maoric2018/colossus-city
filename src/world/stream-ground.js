import * as T from 'three';
import {surface} from '../render/quality.js';
// One moving plane, world-space markings and downloaded pavement/asphalt maps.
// Its edge stays hundreds of metres beyond opaque fog, including at high altitude.
export function streamGround(root,tier,textures){
 const material=surface(tier,{color:0xffffff,roughness:.95});
 material.onBeforeCompile=shader=>{
  shader.uniforms.cityAsphalt={value:textures.asphalt};shader.uniforms.cityPavement={value:textures.concrete};
  shader.vertexShader='varying vec3 cityGroundPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityGroundPosition=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader='varying vec3 cityGroundPosition;uniform sampler2D cityAsphalt;uniform sampler2D cityPavement;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 p=cityGroundPosition.xz;float dx=abs(mod(p.x,70.)-35.),dz=abs(mod(p.y,70.)-35.);
   float road=max(1.-step(8.,dx),1.-step(6.,dz));
   vec3 pavement=texture2D(cityPavement,p/14.).rgb*.86,asphalt=texture2D(cityAsphalt,p/12.).rgb*.56;
   diffuseColor.rgb*=mix(pavement,asphalt,road);
   float yellow=max((1.-step(.07,abs(dx-.3)))*step(7.,dz),(1.-step(.07,abs(dz-.3)))*step(9.,dx));
   float dash=max((1.-step(.07,abs(dx-4.)))*step(10.,dz)*step(4.,mod(p.y,8.)),(1.-step(.07,abs(dz-3.)))*step(12.,dx)*step(4.,mod(p.x,8.)));
   float walk=max((1.-step(1.3,abs(dz-8.)))*step(1.5,dx)*(1.-step(6.,dx))*step(.6,mod(p.x,1.3)),(1.-step(1.3,abs(dx-10.)))*step(1.5,dz)*(1.-step(4.5,dz))*step(.6,mod(p.y,1.3)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.51,.16),yellow*.9);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.7,.7,.63),max(dash,walk)*.9);
  `);
 };
 material.customProgramCacheKey=()=> 'infinite-street-v1';
 const mesh=new T.Mesh(new T.PlaneGeometry(2000,2000),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.001;mesh.receiveShadow=true;root.add(mesh);
 return {mesh,update(p){mesh.position.x=Math.round(p.x/70)*70;mesh.position.z=Math.round(p.z/70)*70;}};
}
