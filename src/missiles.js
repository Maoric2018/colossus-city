import * as T from 'three';
import {C} from '../shared/config.js';
import {bakedModel} from './assets.js';
const dummy=new T.Object3D(),up=new T.Vector3(0,1,0);
export class MissileView{
 constructor(scene,fx){this.scene=scene;this.fx=fx;this.active=new Map();this.batches=[];this.lastTrail=0;this.ready=this.load();}
 async load(){
  for(const [name,height,y]of [['rocket_baseA',.65,-1],['rocket_fuelA',1,-.35],['rocket_topA',.7,.65]]){
   const model=await bakedModel(`/assets/imported/space-kit/${name}.glb`);for(const part of model.parts){const geometry=part.geometry.clone();geometry.scale(.65/model.size.x,height/model.size.y,.65/model.size.z);geometry.translate(0,y,0);const mesh=new T.InstancedMesh(geometry,part.material,C.MAX_MISSILES);mesh.frustumCulled=false;mesh.castShadow=false;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.scene.add(mesh);this.batches.push(mesh);}
  }
 }
 add(e){this.active.set(e.id,{...e});}
 remove(id){this.active.delete(id);}
 reset(){this.active.clear();for(const batch of this.batches)batch.count=0;}
 update(time){
  const trail=time-this.lastTrail>.07;if(trail)this.lastTrail=time;let i=0;
  for(const [id,m]of this.active){const age=Math.max(0,time-m.born);if(age>m.life+.3){this.active.delete(id);continue;}if(i>=C.MAX_MISSILES)break;
   const dir=new T.Vector3(...m.direction),position=new T.Vector3(...m.origin).addScaledVector(dir,age*C.MISSILE_SPEED);dummy.position.copy(position);dummy.quaternion.setFromUnitVectors(up,dir);dummy.scale.setScalar(1);dummy.updateMatrix();for(const batch of this.batches)batch.setMatrixAt(i,dummy.matrix);i++;
   if(trail){const tail=position.addScaledVector(dir,-1.2).toArray();this.fx.particle(this.fx.flares,tail,{life:.15,size:1.8,color:new T.Color(0xffa057),growth:1});this.fx.particle(this.fx.smoke,tail,{life:.9,size:.7,color:new T.Color(0xb7c3c5),growth:2,opacity:.35,gravity:.3});}
  }for(const batch of this.batches){batch.count=i;batch.instanceMatrix.needsUpdate=true;}
 }
}
