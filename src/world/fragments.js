// Persistent, deterministic facade remains. Dust is short-lived; the physical structural
// bodies and these broken skin panels stay for the round, including for late spectators.
import * as T from 'three';
import {surface} from '../render/quality.js';
import {seeded} from '../../shared/math.js';
const temp=new T.Object3D(),pos=new T.Vector3(),quat=new T.Quaternion(),up=new T.Vector3(0,1,0);
export class Fragments {
 constructor(root,cells,tier){
  this.batches=new Map();this.pieces=new Map();this.active=new Set();this.dirty=new Set();
  for(const [material,color] of Object.entries({glass:0x7dabb8,stone:0xbcb4a3,brick:0x986450,concrete:0x9ca09b})){
   const count=cells.reduce((n,c)=>n+(material==='glass'||c.material===material?c.walls.filter(Boolean).length*2:0),0);
   const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),surface(tier,{color,roughness:.85}),Math.max(1,count));mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.receiveShadow=true;root.add(mesh);this.batches.set(material,mesh);
  }
 }
 add(c,side,layer,pose,animate){
  const material=layer==='glass'?'glass':c.material,mesh=this.batches.get(material),rand=seeded(c.id*157+side*19+(layer==='glass'?1:9)),angle=side*Math.PI/2;
  for(let j=0;j<2;j++){
   const key=`${c.id}:${side}:${layer}:${j}`;if(this.pieces.has(key))continue;
   pos.set(Math.sin(angle)*c.size[0]*.5,0,-Math.cos(angle)*c.size[2]*.5).applyQuaternion(pose.q).add(pose.p);
   const reach=1.4+rand()*3, end=new T.Vector3(c.p[0]+Math.sin(angle)*(c.size[0]*.5+reach)+(rand()-.5)*3,.21+(c.floor%7)*.035,c.p[2]-Math.cos(angle)*(c.size[2]*.5+reach)+(rand()-.5)*3);
   const width=c.size[0]*(.2+rand()*.22),height=layer==='glass'?.035:.13;
   const e={mesh,index:mesh.count++,start:pos.clone(),end,rotation:new T.Quaternion().setFromEuler(new T.Euler((rand()-.5)*.18,rand()*Math.PI,(rand()-.5)*.16)),scale:new T.Vector3(width,height,c.size[1]*(.3+rand()*.3)),age:0,duration:Math.max(.5,Math.sqrt(Math.max(0,pos.y)*2/25)),phase:rand()*6};
   this.pieces.set(key,e);if(animate)this.active.add(e);else e.age=e.duration;
   this.place(e);
  }
  this.commit();
 }
 place(e){
  const t=Math.min(1,e.age/e.duration),fall=t*t;temp.position.lerpVectors(e.start,e.end,fall);temp.position.y+=Math.sin(t*Math.PI)*.6;
  quat.setFromAxisAngle(up,(1-t)*(3+e.phase));temp.quaternion.copy(e.rotation).multiply(quat);temp.scale.copy(e.scale);temp.updateMatrix();e.mesh.setMatrixAt(e.index,temp.matrix);this.dirty.add(e.mesh);
 }
 commit(){for(const m of this.dirty)m.instanceMatrix.needsUpdate=true;this.dirty.clear();}
 update(dt){for(const e of this.active){e.age+=dt;this.place(e);if(e.age>=e.duration)this.active.delete(e);}this.commit();}
 reset(){this.active.clear();this.pieces.clear();for(const mesh of this.batches.values())mesh.count=0;}
}
