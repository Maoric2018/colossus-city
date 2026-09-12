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

// Real expanding toroidal pressure fronts, aligned with flight direction and
// depth-tested against the city. The downloaded smoke animates their surface.
export class SonicBursts{
 constructor(scene){
  this.items=[];const {map,ready}=vfxTexture(BOOM_SHEET);this.ready=ready;
  const geometry=new T.TorusGeometry(1,.075,8,64);this.frames=new T.InstancedBufferAttribute(new Float32Array(16),1).setUsage(T.DynamicDrawUsage);this.alpha=new T.InstancedBufferAttribute(new Float32Array(16),1).setUsage(T.DynamicDrawUsage);geometry.setAttribute('frame',this.frames);geometry.setAttribute('opacity',this.alpha);
  const material=new T.ShaderMaterial({uniforms:{spriteMap:{value:map}},transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
   vertexShader:`attribute float frame;attribute float opacity;varying vec2 vUV;varying float vFrame;varying float vAlpha;varying vec3 vNormal;varying vec3 vView;
    void main(){vUV=uv;vFrame=frame;vAlpha=opacity;vec4 view=modelViewMatrix*instanceMatrix*vec4(position,1.);vView=-view.xyz;vNormal=normalMatrix*mat3(instanceMatrix)*normal;gl_Position=projectionMatrix*view;}`,
   fragmentShader:`uniform sampler2D spriteMap;varying vec2 vUV;varying float vFrame;varying float vAlpha;varying vec3 vNormal;varying vec3 vView;${atlasShader}
    void main(){
     float angle=vUV.x*6.2831853;
     // Follow the animated sheet's annulus to retain its wispy breakup on a
     // curved surface, rather than projecting a flat ring over the camera.
     float radius=mix(.23,.43,clamp((vFrame-16.)/14.,0.,1.));
     vec2 smokeUV=.5+vec2(cos(angle),sin(angle))*(radius+.035*cos(vUV.y*6.2831853));
     float mist=texture2D(spriteMap,atlasUV(smokeUV,vFrame,vec2(9.),vec2(2556.))).a;
     float facing=abs(dot(normalize(vNormal),normalize(vView)));
     float alpha=vAlpha*(.18+mist*.65)*(.2+.8*pow(1.-facing,1.5));
     if(alpha<.005)discard;gl_FragColor=vec4(mix(vec3(.55,.8,1.),vec3(1.),mist),alpha);
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.InstancedMesh(geometry,material,16);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;this.mesh.visible=false;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;scene.add(this.mesh);this.dummy=new T.Object3D();
 }
 add(p,direction,{breach=false}={}){
  if(this.items.length>=16)this.items.shift();const axis=new T.Vector3(...direction);if(axis.lengthSq()<.001)axis.set(0,0,-1);axis.normalize();
  // The entry front starts just ahead of the pilot, who then flies through it.
  this.items.push({p:new T.Vector3(...p).addScaledVector(axis,breach?0:2),q:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis),age:0,life:breach?.55:.8,breach});
 }
 update(dt){
  let count=0;const d=this.dummy;
  for(const b of this.items){b.age+=dt;if(b.age>=b.life)continue;const t=b.age/b.life;
   d.position.copy(b.p);d.quaternion.copy(b.q);d.scale.setScalar(b.breach?1.8+t*3.4:1.1+t*7);d.updateMatrix();this.mesh.setMatrixAt(count,d.matrix);
   this.frames.setX(count,16+Math.min(44,Math.floor(t*45)));this.alpha.setX(count,Math.min(1,b.age/.045)*(1-t)*.9);this.items[count++]=b;
  }
  this.items.length=count;this.mesh.count=count;this.mesh.visible=count>0;
  if(count)for(const a of [this.mesh.instanceMatrix,this.frames,this.alpha]){a.clearUpdateRanges();a.addUpdateRange(0,count*a.itemSize);a.needsUpdate=true;}
 }
}
