import * as T from 'three';

// Original downloaded sheets, without re-drawing or resampling their frames.
export const SPEED_SHEET={url:'/assets/imported/flight-vfx/hyperspeed.png',columns:6,rows:5,frames:30,width:3102,height:2575};
export const BOOM_SHEET={url:'/assets/imported/flight-vfx/sonic-smoke.png',columns:9,rows:9,first:8,frames:68,width:2556,height:2556};
const textures=new Map();
export function vfxTexture(sheet){
 if(!textures.has(sheet.url)){
  let map;const ready=new Promise((resolve,reject)=>{map=new T.TextureLoader().load(sheet.url,resolve,undefined,reject);});
  map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=T.LinearFilter;map.magFilter=T.LinearFilter;
  textures.set(sheet.url,{map,ready});
 }
 return textures.get(sheet.url);
}
export const atlasShader=`
 vec2 atlasUV(vec2 uv,float frame,vec2 grid,vec2 pixels){
  vec2 inset=.5*grid/pixels;
  uv=clamp(uv,inset,1.-inset);
  return (uv+vec2(mod(frame,grid.x),grid.y-1.-floor(frame/grid.x)))/grid;
 }
`;

// Up to eight simultaneous entries share one draw call and one atlas texture.
export class SonicBursts{
 constructor(scene){
  this.items=[];const {map,ready}=vfxTexture(BOOM_SHEET);this.ready=ready;
  const geometry=new T.PlaneGeometry(1,1);this.frames=new T.InstancedBufferAttribute(new Float32Array(8),1).setUsage(T.DynamicDrawUsage);this.alpha=new T.InstancedBufferAttribute(new Float32Array(8),1).setUsage(T.DynamicDrawUsage);geometry.setAttribute('frame',this.frames);geometry.setAttribute('opacity',this.alpha);
  const material=new T.ShaderMaterial({uniforms:{spriteMap:{value:map}},transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:`attribute float frame;attribute float opacity;varying vec2 vUV;varying float vFrame;varying float vAlpha;void main(){vUV=uv;vFrame=frame;vec3 center=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float size=length((modelMatrix*instanceMatrix)[0].xyz);vAlpha=opacity*smoothstep(.25,.9,distance(cameraPosition,center)/size);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform sampler2D spriteMap;varying vec2 vUV;varying float vFrame;varying float vAlpha;${atlasShader}void main(){vec4 tex=texture2D(spriteMap,atlasUV(vUV,vFrame,vec2(9.),vec2(2556.)));if(tex.a<.005)discard;gl_FragColor=vec4(tex.rgb,tex.a*vAlpha);\n#include <colorspace_fragment>\n}`});
  this.mesh=new T.InstancedMesh(geometry,material,8);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;this.mesh.visible=false;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;scene.add(this.mesh);this.dummy=new T.Object3D();
 }
 add(p,direction){
  if(this.items.length>=8)this.items.shift();const axis=new T.Vector3(...direction).normalize();
  this.items.push({p:new T.Vector3(...p),q:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis),age:0});
 }
 update(dt){
  let count=0;const d=this.dummy;
  for(const b of this.items){b.age+=dt;if(b.age>=.8)continue;const t=b.age/.8;
   d.position.copy(b.p);d.quaternion.copy(b.q);d.scale.setScalar(9+t*7);d.updateMatrix();this.mesh.setMatrixAt(count,d.matrix);
   this.frames.setX(count,BOOM_SHEET.first+Math.min(67,Math.floor(t*68)));this.alpha.setX(count,.5*(1-t*.45));this.items[count++]=b;
  }
  this.items.length=count;this.mesh.count=count;this.mesh.visible=count>0;
  if(count)for(const a of [this.mesh.instanceMatrix,this.frames,this.alpha]){a.clearUpdateRanges();a.addUpdateRange(0,count*a.itemSize);a.needsUpdate=true;}
 }
}
