import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C} from '../shared/config.js';
import {soarBreachCells} from '../shared/soar-breach.js';
import {arr,v,add,mul,norm} from '../shared/math.js';
import {breakCells} from './destruction.js';
import {chipCell} from './fracture.js';
import {flightRotation} from '../shared/flight.js';

export function breachBuildings(room,p,input,velocity){
 const grace=p.breachCells;
 for(const [id,until]of grace)if(until<=room.time)grace.delete(id);
 if(room.phase||p.hp<=0||!p.soaring)return;
 const at=p.body.translation(),hits=soarBreachCells(p,at,velocity,input,room.handWorld).filter(id=>!room.detached.has(id));
 if(!hits.length)return;
 const forward=norm(velocity),side=norm(v(-forward.z,0,forward.x));
 let chipped=false;const reach=Math.max(1.5,Math.hypot(velocity.x,velocity.y,velocity.z)*C.TICK+1.1),center=add(at,mul(forward,reach*.5));
 const rotation=flightRotation(p,input),volume={from:arr(at),to:arr(add(at,mul(velocity,C.TICK))),q:[rotation.x,rotation.y,rotation.z,rotation.w],half:[.5,1.3,.5]};
 for(const id of hits){const c=room.cellMap.get(id);if(chipCell(room,c,arr(center),reach,Infinity,p.id,arr(mul(side,5)),false,volume).length){chipped=true;grace.set(id,room.time+C.SOAR_DEBRIS_GRACE);if(c.skin.hp<=0)breakCells(room,[id],mul(side,5),{at,granular:true});}}
 if(!chipped)return;
 if(room.time>=(p.breachFXAt||0)){p.breachFXAt=room.time+.12;room.event({type:'soar-breach',player:p.id,p:arr(at),direction:arr(forward)});}
}
// Hooks are enabled only on live raider capsules; scenery/scenery contacts stay
// entirely in Rapier. Cell IDs survive secondary fractures during the grace time.
export function breachHooks(room){return {
 filterContactPair(a,b){
  const ta=room.colliderTags.get(a),tb=room.colliderTags.get(b),player=ta?.player??tb?.player,cell=ta?.cell??tb?.cell;
  const shard=room.shards.get(ta?.shard??tb?.shard);if(shard&&(ta?.hand||tb?.hand)&&(room.boss.breakGrace.get(shard.cell)||0)>room.time)return null;
  if(shard&&player!=null&&(room.players.get(player)?.breachCells?.get(shard.cell)||0)>room.time)return null;
  if((ta?.hand||tb?.hand)&&cell!=null&&(room.boss.breakGrace.get(cell)||0)>room.time)return null;
  if(player!=null&&cell!=null&&(room.players.get(player)?.breachCells?.get(cell)||0)>room.time)return null;
  return RAPIER.SolverFlags.COMPUTE_IMPULSE;
 },
 filterIntersectionPair(){return true;}
};}
