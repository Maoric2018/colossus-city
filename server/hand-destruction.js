import {C} from '../shared/config.js';
import {resolveBreakableHand} from '../shared/hand-break.js';
import {dot,GIANT} from '../shared/giant-rig.js';
import {vec} from '../shared/math.js';
import {breakCells} from './destruction.js';
import {chipCell} from './fracture.js';
// Local crush resistance is independent of the building's load-bearing cohesion.
export function breakHandPath(room,from,target,q,velocity){
 let detached=0;const strikes=new Map();
 const result=resolveBreakableHand(from,target,q,room.handWorld,velocity,contact=>{
  const c=room.cellMap.get(contact.cell);if(!c||room.detached.has(c.id))return false;
  const speed=Math.min(C.MAX_HAND_SPEED,-dot(velocity,contact.normal)),kick=contact.normal.map(n=>-n*Math.min(6,1+speed*.12));
  const removed=chipCell(room,c,contact.point,1.5,Infinity,0,kick,false,{from,to:target,q,half:GIANT.handHalf});if(!removed.length)return false;
  room.boss.breakGrace.set(c.id,room.time+C.HAND_DEBRIS_GRACE);
  let broke=false;if(c.skin.hp<=0){breakCells(room,[c.id],vec(kick),{at:vec(contact.point),granular:true});detached++;broke=true;}
  strikes.set(c.id+':'+contact.side,{type:'strike',cell:c.id,side:contact.side,normal:contact.normal,p:contact.point,power:Math.max(.15,Math.min(1,speed/30)),material:c.material,broke});
  return 'changed';
 });
 for(const e of strikes.values())room.event(e);return {...result,detached};
}
