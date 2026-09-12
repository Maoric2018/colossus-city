// Separate animation rig for the film. No live targeting, yaw wrapping, or
// unreachable controller poses. Hand orientation follows each forearm.
import * as T from 'three';
import {stuntPose} from './stunt-pose.js';
import {raiderParts} from '/shared/raider-rig.js';
const V=a=>new T.Vector3(...a),up=V([0,1,0]),front=V([0,0,-1]);
export const ease=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export const lerp=(a,b,x)=>a.map((v,i)=>T.MathUtils.lerp(v,b[i],x));
export function keys(t,frames){let i=0;while(i<frames.length-2&&t>frames[i+1][0])i++;const a=frames[i],b=frames[i+1],k=ease((t-a[0])/(b[0]-a[0]));return Array.isArray(a[1])?lerp(a[1],b[1],k):T.MathUtils.lerp(a[1],b[1],k);}
export function trajectory(t,frames){
 let i=0;while(i<frames.length-2&&t>frames[i+1][0])i++;const a=frames[i],b=frames[i+1],prev=frames[Math.max(0,i-1)],next=frames[Math.min(frames.length-1,i+2)],d=b[0]-a[0],u=(t-a[0])/d;
 const m0=b[1].map((v,k)=>(v-prev[1][k])/(b[0]-prev[0])),m1=next[1].map((v,k)=>(v-a[1][k])/(next[0]-a[0]));
 return V(a[1].map((v,k)=>(2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*d*m0[k]+(-2*u**3+3*u*u)*b[1][k]+(u**3-u*u)*d*m1[k]));
}
export class MovieRobot{
 constructor(giant){this.g=giant;this.maxReach=0;this.maxTurn=0;this.last=null;}
 reset(){this.last=null;}
 world(p){return V(p).applyAxisAngle(up,this.yaw).add(this.origin);}
 draw({at=[0,0,0],yaw=0,lean=0,roll=0,crouch=0,headYaw=0,left=[-5.7,16,-5.5],right=[5.7,16,-5.5],step=0},dt=1/24){
  const g=this.g;this.origin=V(at);this.yaw=yaw;
  const chest=this.world([lean*.6,16.8-crouch,0]),q=new T.Quaternion().setFromEuler(new T.Euler(lean,yaw,roll,'YXZ'));
  g.root.visible=true;g.selfBody.update();g.body.position.copy(chest);g.body.quaternion.copy(q);
  g.head.position.copy(V([0,7.2,0]).applyQuaternion(q).add(chest));g.head.quaternion.copy(q).multiply(new T.Quaternion().setFromEuler(new T.Euler(-lean*.35,headYaw,0)));
  for(let i=0;i<2;i++){
   const side=i?1:-1,arm=g.arms[i],shoulder=V([side*4.2,3.1,0]).applyQuaternion(q).add(chest),hand=this.world(i?right:left);
   // Solve toward the wrist, then orient the palm along the forearm. Stable
   // downward/outward elbow poles keep guards from folding behind the torso.
   const reach=hand.clone().sub(shoulder),d=Math.min(14.1,Math.max(3.4,reach.length()));reach.normalize();hand.copy(shoulder).addScaledVector(reach,d);
   const wrist=hand.clone().addScaledVector(reach,-2.85),dir=wrist.clone().sub(shoulder).normalize(),distance=wrist.distanceTo(shoulder);
   const pole=V([side*.85,-1.1,.25]).applyQuaternion(q);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
   const elbow=shoulder.clone().addScaledVector(dir,distance*.5).addScaledVector(pole,Math.sqrt(Math.max(0,36-distance*distance*.25)));
   const fore=hand.clone().sub(elbow).normalize(),hq=new T.Quaternion().setFromUnitVectors(front,fore);
   // Reconcile palm-to-wrist offset with the chosen forearm axis.
   const finalWrist=hand.clone().addScaledVector(fore,-2.85),axis=finalWrist.clone().sub(shoulder).normalize(),wd=Math.min(11.6,finalWrist.distanceTo(shoulder));
   const ep=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();elbow.copy(shoulder).addScaledVector(axis,wd/2).addScaledVector(ep,Math.sqrt(Math.max(0,36-wd*wd/4)));
   arm.shoulder.position.copy(shoulder);arm.elbow.position.copy(elbow);arm.wrist.position.copy(finalWrist);arm.fist.position.copy(hand);arm.fist.quaternion.copy(hq);arm.piston.visible=false;
   arm.upper.set(shoulder,elbow,q);arm.lower.set(elbow,finalWrist,q);this.maxReach=Math.max(this.maxReach,wd);
   const leg=g.legs[i],hip=V([side*1.6,-4.3,0]).applyQuaternion(q).add(chest),foot=this.world([side*2.5,1+Math.max(0,Math.sin(step+(i?Math.PI:0)))*Math.abs(step>0?1:0),-.5+Math.sin(step+(i?Math.PI:0))*.9]);
   const ankle=foot.clone().add(V([0,.55,.65]).applyAxisAngle(up,yaw)),knee=hip.clone().lerp(ankle,.5).add(V([side*.35,0,-1.5-crouch*.15]).applyAxisAngle(up,yaw));
   leg.hip.position.copy(hip);leg.knee.position.copy(knee);leg.ankle.position.copy(ankle);leg.foot.position.copy(foot);leg.foot.quaternion.setFromAxisAngle(up,yaw);leg.thigh.set(hip,knee,q);leg.shin.set(knee,ankle,q);
  }
  g.root.updateMatrixWorld(true);
  if(this.last&&dt>0)this.maxTurn=Math.max(this.maxTurn,Math.abs(yaw-this.last)/dt);this.last=yaw;
 }
}
export function moviePilot(p,path,time,{bank=0,tuck=0,brace=0,aim=0,scale=1.2}={}){
 const at=path(time),velocity=path(time+.02).sub(path(time-.02)).multiplyScalar(25),yaw=Math.atan2(-velocity.x,-velocity.z),pitch=Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z));
 p.root.visible=true;p.root.position.copy(at);p.root.rotation.set(0,yaw,0);p.root.scale.setScalar(scale);p.mesh.rotation.set(-Math.PI/2+pitch,0,bank,'XYZ');
 const pose=stuntPose({time,bank,tuck,brace,aim});
 for(let i=0;i<raiderParts.length;i++){const b=p.bones.get(raiderParts[i].name);b.position.fromArray(pose[i].p);b.quaternion.fromArray(pose[i].q);}
 for(let i=0;i<p.jets.length;i++){p.jets[i].visible=true;p.jets[i].scale.setScalar(1.05+Math.sin(time*26+i)*.08+tuck*.15);}
 p.root.updateMatrixWorld(true);return at;
}
