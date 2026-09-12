import {C} from './config.js';
import {resolveHand,dot} from './giant-rig.js';
export const handSurfaceKey=contact=>contact.kind==='wall'?`${contact.cell}:wall:${contact.side}`:`${contact.cell}:frame`;
// Re-sweep after each local opening so one motion can pass a wall, a column and
// the far wall. Prediction only omits claimed surfaces; authority changes geometry.
export function resolveBreakableHand(from,target,q,world,velocity=[0,0,0],open=()=>true,ignored=new Set()){
 const filtered={*near(a,b){for(const box of world.near(a,b))if(!ignored.has(`${box.cell}:frame`)&&!ignored.has(handSurfaceKey(box)))yield box;}},broken=[];
 let result;
 for(let pass=0;pass<C.HAND_BREAK_LIMIT;pass++){
  result=resolveHand(from,target,q,filtered);let changed=false;
  for(const contact of result.contacts){
   if(contact.cell==null||contact.debris||-dot(velocity,contact.normal)<=C.HAND_BREAK_SPEED||broken.length>=C.HAND_BREAK_LIMIT)continue;
   if(ignored.has(`${contact.cell}:frame`)||ignored.has(handSurfaceKey(contact)))continue;
   if(open(contact)){
    ignored.add(handSurfaceKey(contact));broken.push(contact);changed=true;
   }
  }
  if(!changed)return {...result,broken};
 }
 return {...resolveHand(from,target,q,filtered),broken};
}
