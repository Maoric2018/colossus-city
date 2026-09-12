import {C} from './config.js';
import {flightRotation} from './flight.js';
import {axes,sweepBox} from './giant-rig.js';

// A camera-wide pressure field clears ahead of the pilot. The very same volume
// selects bays for prediction and individual pieces for authoritative fracture.
export function soarBreachVolume(state,from,velocity,input){
 const rotation=flightRotation(state,input),q=[rotation.x,rotation.y,rotation.z,rotation.w],speed=Math.hypot(velocity.x,velocity.y,velocity.z);
 const lead=Math.min(C.SOAR_FIELD_LEAD,Math.max(3.5,speed*.2)),a=[from.x,from.y,from.z],direction=[velocity.x,velocity.y,velocity.z].map(n=>n/(speed||1));
 return {from:a,to:a.map((n,i)=>n+direction[i]*(lead+speed*C.TICK)),q,half:[C.SOAR_FIELD_RADIUS,1.3,C.SOAR_FIELD_RADIUS]};
}
export function soarBreachCells(state,from,velocity,input,world){
 if(!state.soaring||!world||Math.hypot(velocity.x,velocity.y,velocity.z)<.5)return [];
 const volume=soarBreachVolume(state,from,velocity,input),basis=axes(volume.q),a=volume.from,b=volume.to,hits=new Map();let stop=1;
 // HandWorld's normal broadphase adds 2.5 m. Expand it for this wider rotated
 // field too, including pitched flights across a spatial-bucket boundary.
 const extra=basis[0].map((_,i)=>Math.max(0,basis.reduce((s,axis,k)=>s+Math.abs(axis[i])*volume.half[k],0)-2.5));
 const min=a.map((n,i)=>Math.min(n,b[i])-extra[i]),max=a.map((n,i)=>Math.max(n,b[i])+extra[i]);
 for(const obstacle of world.near(min,max)){
  if(obstacle.cell==null||obstacle.debris){
   // Only solids actually in the pilot's path stop the field. A nearby sidewalk
   // touching its outer edge must not disable low-altitude breaching.
   const hit=sweepBox(a,b,basis,[.38,1.15,.38],obstacle,.025);if(hit)stop=Math.min(stop,hit.t);continue;
  }
  const hit=sweepBox(a,b,basis,volume.half,obstacle,.025);if(!hit)continue;
  if(!hits.has(obstacle.cell)||hit.t<hits.get(obstacle.cell))hits.set(obstacle.cell,hit.t);
 }
 return [...hits].filter(([,t])=>t<=stop).sort((a,b)=>a[1]-b[1]||a[0]-b[0]).slice(0,C.SOAR_BREACH_LIMIT).map(([id])=>id);
}
// Axis-aligned bounds of the physics capsule, including its soaring rotation.
export function flightHalf(state,input){
 if(!state.soaring)return {x:.36,y:1.14,z:.36};
 const q=flightRotation(state,input),up=axes([q.x,q.y,q.z,q.w])[1];
 return {x:.36+.8*Math.abs(up[0]),y:.36+.8*Math.abs(up[1]),z:.36+.8*Math.abs(up[2])};
}
