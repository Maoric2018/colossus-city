import * as T from 'three';
import {fractureMaterial} from './fracture-material.js';

// Keep compiled fracture programs alive before the first hit. Preparation runs
// outside rendering callbacks, one material at a time in browser idle periods.
export class RenderWarmup{
 constructor(renderer,city){this.renderer=renderer;this.city=city;this.seen=new Set();this.queue=[];this.retained=[];this.textures=new WeakSet();this.nextScan=0;this.pending=false;}
 observe(camera){
  this.camera=camera;if(this.disposed||performance.now()<this.nextScan)return;this.nextScan=performance.now()+1000;
  const b=this.city.buildings,environment=this.city.scene.environment?.uuid||'',sources=[b.frame,b.empireFrame,b.roof,...Object.values(b.facade),...Object.values(b.glass),...[...b.components.batches.values()]];
  for(const mesh of sources){const material=mesh.material,key=environment+':'+material.uuid;if(this.seen.has(key))continue;this.seen.add(key);this.queue.push(material);}
  this.schedule();
 }
 schedule(){
  if(this.pending||this.disposed||!this.queue.length)return;this.pending=true;
  const run=deadline=>{if(this.disposed){this.pending=false;return;}if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<4){this.pending=false;this.schedule();return;}this.prepare().catch(error=>{if(!this.disposed)console.warn('Optional render warmup failed',error);}).finally(()=>{this.pending=false;this.schedule();});};
  if(typeof requestIdleCallback==='function')this.handle=requestIdleCallback(run,{timeout:3000});else this.handle=setTimeout(()=>run(),50);
 }
 async prepare(){
  const source=this.queue.shift();if(!source||this.disposed)return;
  for(const texture of Object.values(source))if(texture?.isTexture&&!this.textures.has(texture)){
   const image=texture.image;if(image&&(image.complete!==false)&&(image.width||image.data)){this.renderer.initTexture(texture);this.textures.add(texture);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geometry.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1],2));geometry.setAttribute('color',new T.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));
  const material=fractureMaterial(source),mesh=new T.BatchedMesh(1,3,0,material),group=new T.Group();mesh.addInstance(mesh.addGeometry(geometry));group.add(mesh);geometry.dispose();
  this.retained.push(mesh);mesh.userData.compiling=true;
  try{await this.renderer.compileAsync(group,this.camera,this.city.scene);}catch(error){if(!this.disposed)console.warn('Optional fracture shader warmup failed',error);}finally{mesh.userData.compiling=false;if(this.disposed){mesh.dispose();mesh.material.dispose();}}
 }
 dispose(){this.disposed=true;if(typeof cancelIdleCallback==='function')cancelIdleCallback(this.handle);else clearTimeout(this.handle);for(const mesh of this.retained)if(!mesh.userData.compiling){mesh.dispose();mesh.material.dispose();}this.retained=[];this.queue=[];}
}
