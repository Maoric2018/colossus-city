// Articulated flight pose for the existing downloaded pilot. Body-space transforms
// are shared with knockdowns so the same surface can pass directly to physics.
import {raiderParts,raiderLinks} from './raider-rig.js';
import {clamp} from './math.js';
import {identity,plus,minus,rotate} from './giant-rig.js';
export function composeRotation(a,b){return [
 a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
 a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
 a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
 a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
const axisAngle=(axis,angle)=>{const s=Math.sin(angle/2);return [...axis.map(v=>v*s),Math.cos(angle/2)];};
const euler=(x=0,y=0,z=0)=>composeRotation(composeRotation(axisAngle([1,0,0],x),axisAngle([0,1,0],y)),axisAngle([0,0,1],z));
export function raiderPose({soar=0,time=0,id=0,bank=0,dodge=0}={}){
 const blend=clamp(soar,0,1),phase=time*3.8+id*.73,flutter=Math.sin(phase),counter=Math.sin(phase+1.7),tuck=Math.sin(blend*Math.PI)*.48;
 const rotations={
  chest:euler(blend*(.1+flutter*.025),blend*bank*.12,blend*counter*.015),
  head:euler(blend*1.28,blend*bank*.18,-blend*bank*.12),
  upperL:euler(blend*(-.2+counter*.08),blend*.12,blend*(-.78+flutter*.08-bank*.25)),
  upperR:euler(blend*(1.34+flutter*.025),blend*(-.12+bank*.12),blend*(.24+counter*.035)),
  thighL:euler(blend*(.09+flutter*.065),0,blend*(-.13-bank*.12)),
  thighR:euler(blend*(-.06-counter*.065),0,blend*(.11-bank*.12))
 };
 const bends={lowerL:blend*(.48+counter*.1+dodge*.35),lowerR:blend*(.08+flutter*.025),shinL:blend*(.24+flutter*.13+dodge*.3)+tuck,shinR:blend*(.2-counter*.12+dodge*.24)+tuck};
 const transforms=[{p:[0,0,0],q:identity}];
 for(const link of raiderLinks){
  const name=raiderParts[link.b].name,local=link.hinge?axisAngle(link.axis,bends[name]||0):rotations[name]||identity,parent=transforms[link.a];
  const q=composeRotation(parent.q,local),pivot=plus(parent.p,rotate(link.anchor,parent.q));
  transforms[link.b]={p:minus(pivot,rotate(link.anchor,q)),q};
 }
 return transforms.map((transform,i)=>({p:plus(transform.p,rotate(raiderParts[i].o,transform.q)),q:transform.q}));
}
