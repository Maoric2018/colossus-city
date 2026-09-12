import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C} from '../shared/config.js';
import {soarBreachCells,soarBreachVolume} from '../shared/soar-breach.js';
import {arr,v,add,mul,norm} from '../shared/math.js';
import {breakCells} from './destruction.js';
import {chipCell} from './fracture.js';

export function breachBuildings(room,p,input,velocity){
 const grace=p.breachCells;
 for(const [id,until]of grace)if(until<=room.time)grace.delete(id);
 if(room.phase||p.hp<=0||!p.soaring)return;
 const at=p.body.translation(),hits=soarBreachCells(p,at,velocity,input,room.handWorld).filter(id=>!room.detached.has(id));
 if(!hits.length)return;
 const forward=norm(velocity),side=norm(v(-forward.z,0,forward.x));
 let chipped=false;const volume=soarBreachVolume(p,at,velocity,input),reach=Math.hypot(...volume.to.map((n,i)=>n-volume.from[i])),center=add(at,mul(forward,reach*.5));
 const shardVelocity=(origin,id)=>{
  const offset=v(origin[0]-at.x,origin[1]-at.y,origin[2]-at.z),along=offset.x*forward.x+offset.y*forward.y+offset.z*forward.z;
  let outward=add(offset,mul(forward,-along));if(Math.hypot(outward.x,outward.y,outward.z)<.15)outward=mul(side,id%2?1:-1);
  return arr(mul(norm(outward),14));
 };
 for(const id of hits){
  const c=room.cellMap.get(id),offset=v(c.p[0]-at.x,c.p[1]-at.y,c.p[2]-at.z),along=offset.x*forward.x+offset.y*forward.y+offset.z*forward.z;
  let outward=add(offset,mul(forward,-along));if(Math.hypot(outward.x,outward.y,outward.z)<.3)outward=mul(side,id%2?1:-1);
  const impulse=mul(norm(outward),6);
  if(chipCell(room,c,arr(center),reach,Infinity,p.id,shardVelocity,false,volume).length){chipped=true;grace.set(id,room.time+C.SOAR_DEBRIS_GRACE);if(c.skin.hp<=0)breakCells(room,[id],impulse,{at,granular:true,shardVelocity});}
 }
 if(!chipped)return;
 if(room.time>=(p.breachFXAt||0)){p.breachFXAt=room.time+.18;room.event({type:'soar-breach',player:p.id,p:arr(center),direction:arr(forward)});}
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
