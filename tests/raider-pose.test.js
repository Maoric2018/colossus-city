import test from 'node:test';
import assert from 'node:assert/strict';
import {raiderPose} from '../shared/raider-pose.js';
import {raiderParts,raiderLinks} from '../shared/raider-rig.js';
import {plus,minus,rotate} from '../shared/giant-rig.js';
const distance=(a,b)=>Math.hypot(...minus(a,b));
test('hover retains the original armor surface and soaring articulates arms, head and legs',()=>{
 const hover=raiderPose(),soar=raiderPose({soar:1,time:1});
 for(const [i,part]of raiderParts.entries())assert.ok(distance(hover[i].p,part.o)<1e-9);
 for(const name of ['head','lowerL','lowerR','shinL','shinR']){const i=raiderParts.findIndex(p=>p.name===name);assert.ok(distance(soar[i].p,hover[i].p)>.03,`${name} needs its own motion`);}
 const alternate=raiderPose({soar:1,time:.5});assert.ok(distance(soar[8].p,alternate[8].p)>.04,'Knees must keep moving in steady flight');
});
test('flight, banking, braking and dodging preserve every anatomical joint anchor',()=>{
 for(const soar of [0,.2,.5,.8,1])for(const time of [0,.3,.9,7])for(const bank of [-.4,0,.4])for(const dodge of [0,1]){
  const pose=raiderPose({soar,time,bank,dodge,id:3});
  for(const part of pose){assert.ok(part.p.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...part.q)-1)<1e-6);}
  for(const link of raiderLinks){const a=pose[link.a],b=pose[link.b],anchorA=plus(a.p,rotate(minus(link.anchor,raiderParts[link.a].o),a.q)),anchorB=plus(b.p,rotate(minus(link.anchor,raiderParts[link.b].o),b.q));assert.ok(distance(anchorA,anchorB)<1e-6,'Limbs must stay attached throughout transitions');}
 }
});
