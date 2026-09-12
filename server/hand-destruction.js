import {C} from '../shared/config.js';
import {resolveBreakableHand} from '../shared/hand-break.js';
import {dot} from '../shared/giant-rig.js';
import {vec,mul} from '../shared/math.js';
import {sideBit} from '../shared/city/materials.js';
import {damageCell,breakCells} from './destruction.js';
// Local crush resistance is independent of the building's load-bearing cohesion.
export function breakHandPath(room,from,target,q,velocity){
 let detached=0;
 const result=resolveBreakableHand(from,target,q,room.handWorld,velocity,contact=>{
  const c=room.cellMap.get(contact.cell);if(!c||room.detached.has(c.id))return false;
  const speed=Math.min(C.MAX_HAND_SPEED,-dot(velocity,contact.normal));let broke=false;
  if(contact.kind==='wall'){
   const side=contact.side,energy=c.skin.glassHp[side]+c.skin.facadeHp[side];
   if(energy<=0)return false;
   // Strip only this wall, without spilling a giant's crushing force into hidden supports.
   damageCell(room,c,energy,sideBit(side),0,contact);
  }else{
   damageCell(room,c,c.skin.hp,0,0,contact);
   const created=breakCells(room,[c.id],mul(vec(contact.normal),-Math.min(6,1+speed*.12)),{at:vec(contact.point)});
   if(!created.length)return false;
   room.boss.breakGrace.set(c.id,room.time+C.HAND_DEBRIS_GRACE);detached++;broke=true;
  }
  room.event({type:'strike',cell:c.id,side:contact.side,normal:contact.normal,p:contact.point,power:Math.max(.15,Math.min(1,speed/30)),material:c.material,broke});
  return true;
 });
 return {...result,detached};
}
