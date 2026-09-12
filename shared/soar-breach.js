import {C} from './config.js';
import {flightRotation} from './flight.js';
import {axes,sweepBox} from './giant-rig.js';

// A conservative swept envelope around the prone capsule. Both prediction and
// authority select the same nearby bays; only the server changes the buildings.
export function soarBreachCells(state,from,velocity,input,world){
 if(!state.soaring||!world||Math.hypot(velocity.x,velocity.y,velocity.z)<.5)return [];
 const q=flightRotation(state,input),basis=axes([q.x,q.y,q.z,q.w]),a=[from.x,from.y,from.z];
 const b=a.map((n,i)=>n+[velocity.x,velocity.y,velocity.z][i]*C.TICK),hits=new Map();let stop=1;
 for(const obstacle of world.near(a,b)){
  const hit=sweepBox(a,b,basis,[.5,1.3,.5],obstacle,.04);if(!hit)continue;
  if(obstacle.cell==null||obstacle.debris){stop=Math.min(stop,hit.t);continue;}
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
