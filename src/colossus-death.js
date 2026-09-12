import * as T from 'three';
import {ROUND_END} from '../shared/round-end.js';

const up=new T.Vector3(0,1,0),rotation=new T.Matrix4();
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const bursts=[0,.24,.49,.73,.98,1.2,1.42,1.6,1.76,2.02,2.3,2.65,3.05,3.5,4.1];

// Cosmetic pieces reuse the actual robot meshes and materials. Their trajectory
// is a function of server time, so viewers and late joiners see the same breakup.
export class ColossusDeath {
 constructor(scene,giant,{fx,onBlast=()=>{}}={}){this.scene=scene;this.giant=giant;this.fx=fx;this.onBlast=onBlast;this.root=new T.Group();scene.add(this.root);this.pieces=[];this.materials=new Set();}
 start(pose,seed=1){
  this.reset();this.pose=structuredClone(pose);this.seed=seed;this.active=true;this.age=-.001;this.burstIndex=0;this.trailTime=0;
  this.center=new T.Vector3(pose.head[0],pose.head[1]-7,pose.head[2]);
 }
 failingPose(t){
  const p=this.pose,k=T.MathUtils.smoothstep(t,0,ROUND_END.breakApart),forward=new T.Vector3(0,0,-1).applyAxisAngle(up,p.bossYaw||0);
  const shifted=a=>[a[0]+forward.x*k*1.6,a[1]-k*4.5,a[2]+forward.z*k*1.6];
  const head=shifted(p.head),left=shifted(p.left),right=shifted(p.right);left[1]-=k*1.5;right[1]-=k*2;
  return {...p,head,left,right,bossYaw:(p.bossYaw||0)+Math.sin(t*22)*.025*k};
 }
 poseRobot(t,local=false){
  this.giant.root.visible=true;this.giant.selfBody.update();this.giant.update(this.failingPose(t),{local});
  this.giant.body.rotateX(-.13*T.MathUtils.smoothstep(t,0,1.6));this.giant.head.rotateX(.23*T.MathUtils.smoothstep(t,0,1.6));
  this.giant.root.updateMatrixWorld(true);
 }
 split(){
  // Always sample the same failed pose, independent of the frame that crossed
  // the explosion time. Include the head even when the owner was in first person.
  this.poseRobot(ROUND_END.breakApart);
  const sources=this.giant.root.children.flatMap(o=>o===this.giant.body?o.children:[o]);
  for(const source of sources){
   if(source.isSprite||!source.visible)continue;
   const part=source.clone(true),drop=[];let meshes=0;
   part.traverse(o=>{if(o.isSprite||o.isLight)drop.push(o);if(o.isMesh){meshes++;const copy=m=>{const c=m.clone();c.opacity=1;c.transparent=false;c.depthWrite=true;if(c.isMeshBasicMaterial)c.color.set(0x753821);this.materials.add(c);return c;};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);}});
   for(const o of drop)o.removeFromParent();if(!meshes)continue;
   part.matrix.copy(source.matrixWorld);part.matrixAutoUpdate=false;part.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(part),origin=bounds.getCenter(new T.Vector3()),half=bounds.getSize(new T.Vector3()).multiplyScalar(.5);
   if(!Number.isFinite(half.length())||half.length()<.04)continue;
   part.matrix.elements[12]-=origin.x;part.matrix.elements[13]-=origin.y;part.matrix.elements[14]-=origin.z;
   const group=new T.Group();group.add(part);group.position.copy(origin);this.root.add(group);
   group.updateMatrixWorld(true);const corners=[];
   part.traverse(o=>{if(!o.isMesh)return;const b=o.geometry.boundingBox;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld).sub(origin));
   });
   const i=this.pieces.length,n=i+this.seed*41,angle=noise(n)*Math.PI*2;
   const radial=origin.clone().sub(this.center);radial.y=0;if(radial.lengthSq()<.1)radial.set(Math.cos(angle),0,Math.sin(angle));radial.normalize();
   const speed=7+noise(n+1)*10,velocity=radial.multiplyScalar(speed);velocity.y=7+noise(n+2)*9;
   const axis=new T.Vector3(noise(n+3)-.5,noise(n+4)-.5,noise(n+5)-.5).normalize(),spin=(noise(n+6)-.5)*4;
   const flight=(velocity.y+Math.sqrt(velocity.y*velocity.y+36*Math.max(0,origin.y-half.y)))/18;
   this.pieces.push({group,origin,half,corners,velocity,axis,spin,flight,delay:noise(n+7)*.22});
  }
  this.giant.root.visible=false;
 }
 update(age,{local=false}={}){
  if(!this.active)return;age=Math.max(this.age,age);const previous=this.age;this.age=age;
  if(age<ROUND_END.breakApart)this.poseRobot(age,local);
  else{
   if(!this.pieces.length)this.split();this.giant.root.visible=false;
   for(const p of this.pieces){
    const t=Math.max(0,age-ROUND_END.breakApart-p.delay),air=Math.min(t,p.flight),land=Math.max(0,t-p.flight),travel=air+(1-Math.exp(-land*3))*.3;
    p.group.position.copy(p.origin).addScaledVector(p.velocity,travel);
    p.group.quaternion.setFromAxisAngle(p.axis,p.spin*(air+(1-Math.exp(-land*5))*.12));
    rotation.makeRotationFromQuaternion(p.group.quaternion);const m=rotation.elements;
    // Individual mesh bounds keep an articulated fist or head on the pavement;
    // rotating one enclosing box would leave empty corners propping it in midair.
    let bottom=Infinity;for(const v of p.corners)bottom=Math.min(bottom,m[1]*v.x+m[5]*v.y+m[9]*v.z);const floor=.08-bottom;
    p.group.position.y=t<p.flight?Math.max(floor,p.origin.y+p.velocity.y*t-9*t*t):floor+Math.abs(Math.sin(land*7))*Math.exp(-land*4)*.7;
   }
  }
  while(this.burstIndex<bursts.length&&age>=bursts[this.burstIndex]){
   const i=this.burstIndex++,at=bursts[i];if(age-at>.3)continue; // no blast backlog after a hidden tab or late join
   const major=i===7,p=major?this.center.clone().add(new T.Vector3(0,-3,0)):this.blastPosition(i,Math.min(at,1.6));
   this.fx?.reactorExplosion(p.toArray(),major?2.5:.65+(i%3)*.16);this.onBlast(p.toArray(),major);
   if(major)this.fx?.dustRing([p.x,.2,p.z],1.5);
  }
  if(age>1.6&&age<5.5&&age-this.trailTime>.12){
   this.trailTime=age;
   for(let i=0;i<this.pieces.length;i+=6){const p=this.pieces[i].group.position;this.fx?.particle(this.fx.smoke,p.toArray(),{reactor:true,life:1.5,size:.75,growth:2.3,opacity:.48,color:new T.Color(0x333b40),v:new T.Vector3(0,1.2,0)});}
  }
  return {age,split:age>=ROUND_END.breakApart,advanced:age>previous};
 }
 blastPosition(i,t){
  const p=this.failingPose(t),sites=[p.head,p.left,p.right,[p.head[0]-3,p.head[1]-6,p.head[2]],[p.head[0]+3,p.head[1]-6,p.head[2]],[p.head[0]-2,6,p.head[2]],[p.head[0]+2,9,p.head[2]]];
  if(this.pieces.length&&i>7)return this.pieces[(i*7)%this.pieces.length].group.position.clone();
  return new T.Vector3(...sites[i%sites.length]);
 }
 reset(){
  this.active=false;this.root.clear();this.pieces.length=0;for(const m of this.materials)m.dispose();this.materials.clear();this.giant.root.visible=true;this.fx?.clearReactor?.();
 }
}
