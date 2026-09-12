// Film-only skeletal animation. The same pose is used at the physics handoff.
import {raiderParts,raiderLinks} from '../shared/raider-rig.js';
import {composeRotation} from '../shared/raider-pose.js';
import {rotate,plus,minus,identity} from '../shared/giant-rig.js';
const axis=(v,a)=>[...v.map(x=>x*Math.sin(a/2)),Math.cos(a/2)];
export const rotation=(x=0,y=0,z=0)=>composeRotation(composeRotation(axis([1,0,0],x),axis([0,1,0],y)),axis([0,0,1],z));
export function stuntPose({time=0,bank=0,tuck=0,brace=0,aim=0}={}){
 const breathe=Math.sin(time*4)*.025;
 const rot={chest:rotation(.08+tuck*.24-brace*.18,bank*.08,-bank*.12),head:rotation(1.2-tuck*.48,0,-bank*.12),
  upperL:rotation(-.24-tuck*.5+brace*.6,.1,-.5+tuck*.48-brace*.2),upperR:rotation(1.25-aim*.45-tuck*.45,-.08,.18+tuck*.14),
  thighL:rotation(.08+tuck*.9+brace*.25,0,-.08-bank*.1),thighR:rotation(-.04+tuck*.65-brace*.12,0,.08-bank*.1)};
 const bends={lowerL:.42+tuck*.65+brace*.4,lowerR:.12+tuck*.65,shinL:.15+tuck*1.15+brace*.25+breathe,shinR:.12+tuck*.95+brace*.4-breathe};
 const transforms=[{p:[0,0,0],q:identity}];
 for(const link of raiderLinks){const name=raiderParts[link.b].name,q=composeRotation(transforms[link.a].q,link.hinge?axis(link.axis,bends[name]||0):rot[name]||identity),pivot=plus(transforms[link.a].p,rotate(link.anchor,transforms[link.a].q));transforms[link.b]={p:minus(pivot,rotate(link.anchor,q)),q};}
 return transforms.map((x,i)=>({p:plus(x.p,rotate(raiderParts[i].o,x.q)),q:x.q}));
}
