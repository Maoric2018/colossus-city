import * as T from 'three';
// Per-avatar material copies: the imported torso shares its source material with
// the arms, so changing that source would make the fists transparent as well.
export class SelfBodyVisibility {
 constructor(){this.opacity=1;this.materials=new Map();this.meshes=new WeakSet();}
 register(root){root.traverse(mesh=>{
  if(!mesh.isMesh||this.meshes.has(mesh))return;this.meshes.add(mesh);
  const copy=source=>{
   if(this.materials.has(source))return this.materials.get(source);
   const material=source.clone();this.materials.set(source,material);return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
 });}
 update({local=false,lookDown=0,dt=1/60}={}){
  // Start around 20 degrees below the horizon; reach 18% opacity near 55 degrees.
  const target=local?1-.82*T.MathUtils.smoothstep(lookDown,.34,.82):1;
  this.opacity=local?T.MathUtils.lerp(this.opacity,target,1-Math.exp(-Math.min(dt,.1)*12)):1;
  if(Math.abs(this.opacity-target)<.001)this.opacity=target;
  const fading=this.opacity<.999;
  for(const [source,material]of this.materials){
   material.opacity=source.opacity*this.opacity;
   const transparent=source.transparent||fading;
   if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
   material.depthWrite=fading?false:source.depthWrite;
  }
 }
}
