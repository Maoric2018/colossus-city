import * as T from 'three';
import {C} from '../shared/config.js';
import {bakedModel} from './assets.js';
import {MissileExhaust} from './render/missile-exhaust.js';
const dummy=new T.Object3D(),up=new T.Vector3(0,1,0);
export class MissileView{
 constructor(scene,fx){this.scene=scene;this.fx=fx;this.active=new Map();this.batches=[];this.lastTrail=-Infinity;this.nozzleY=-1;this.exhaust=new MissileExhaust(scene);this.ready=Promise.all([this.load(),this.exhaust.ready]);}
 async load(){
  for(const [name,height,y]of [['rocket_baseA',.65,-1],['rocket_fuelA',1,-.35],['rocket_topA',.7,.65]]){
   const model=await bakedModel(`/assets/imported/space-kit/${name}.glb`);for(const part of model.parts){const geometry=part.geometry.clone();geometry.scale(.65/model.size.x,height/model.size.y,.65/model.size.z);geometry.translate(0,y,0);if(name==='rocket_baseA'){geometry.computeBoundingBox();this.nozzleY=Math.min(this.nozzleY,geometry.boundingBox.min.y+.035);}const mesh=new T.InstancedMesh(geometry,part.material,C.MAX_MISSILES);mesh.frustumCulled=false;mesh.castShadow=false;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.scene.add(mesh);this.batches.push(mesh);}
  }
 }
 add(e){this.active.set(e.id,{...e,p:[...(e.p||e.origin)],time:e.time??e.born,rendered:null});}
 pose(e){const m=this.active.get(e.id);if(m)Object.assign(m,{p:e.p,direction:e.direction,time:e.time});}
 remove(id){this.active.delete(id);}
 reset(){this.active.clear();this.lastTrail=-Infinity;for(const batch of this.batches)batch.count=0;this.exhaust.reset();}
 update(time){
  const trail=time-this.lastTrail>.055;if(trail)this.lastTrail=time;let i=0;
  for(const [id,m]of this.active){const age=Math.max(0,time-m.born);if(age>m.life+.3){this.active.delete(id);continue;}if(i>=C.MAX_MISSILES)break;
   const dir=new T.Vector3(...m.direction).normalize(),target=new T.Vector3(...m.p).addScaledVector(dir,Math.max(0,Math.min(.1,time-m.time))*C.MISSILE_SPEED);if(!m.rendered)m.rendered=target.clone();else m.rendered.lerp(target,.65);const position=m.rendered.clone();dummy.position.copy(position);dummy.quaternion.setFromUnitVectors(up,dir);dummy.scale.setScalar(1);dummy.updateMatrix();for(const batch of this.batches)batch.setMatrixAt(i,dummy.matrix);
   const tail=position.addScaledVector(dir,this.nozzleY);this.exhaust.set(i,tail,dummy.quaternion);i++;
   if(trail)this.fx.particle(this.fx.smoke,tail.toArray(),{v:dir.clone().multiplyScalar(-1.8).add(new T.Vector3(0,.7,0)),life:1.05,size:.65,color:new T.Color(0xadb8bf),growth:2.2,opacity:.38,gravity:.3});
  }for(const batch of this.batches){batch.count=i;batch.instanceMatrix.needsUpdate=true;}this.exhaust.commit(i,time);
 }
}
