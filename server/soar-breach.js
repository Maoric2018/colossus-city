import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C} from '../shared/config.js';
import {soarBreachCells} from '../shared/soar-breach.js';
import {arr,v,add,mul,norm,sub} from '../shared/math.js';
import {breakCells} from './destruction.js';

export function breachBuildings(room,p,input,velocity){
 const grace=p.breachCells;
 for(const [id,until]of grace)if(until<=room.time)grace.delete(id);
 if(room.phase||p.hp<=0||!p.soaring)return;
 const at=p.body.translation(),hits=soarBreachCells(p,at,velocity,input,room.handWorld).filter(id=>!room.detached.has(id));
 if(!hits.length)return;
 const forward=norm(velocity),side=norm(v(-forward.z,0,forward.x));
 const created=breakCells(room,hits,mul(side,18),{at,shatter:true,by:p.id});if(!created.length)return;
 // Eject hit bays sideways, leaving the flight corridor open. Temporary filtering
 // applies only to this pilot and the cells this breach actually detached.
 for(const e of created){
  for(const id of e.cells)grace.set(id,room.time+C.SOAR_DEBRIS_GRACE);
  if(e.cells.length===1){const offset=sub(e.body.translation(),at),sign=offset.x*side.x+offset.z*side.z>=0?1:-1;e.body.setLinvel(add(add(mul(side,22*sign),mul(forward,4)),v(0,3,0)),true);}
 }
 if(room.time>=(p.breachFXAt||0)){p.breachFXAt=room.time+.12;room.event({type:'soar-breach',player:p.id,p:arr(at),direction:arr(forward)});}
}
// Hooks are enabled only on live raider capsules; scenery/scenery contacts stay
// entirely in Rapier. Cell IDs survive secondary fractures during the grace time.
export function breachHooks(room){return {
 filterContactPair(a,b){
  const ta=room.colliderTags.get(a),tb=room.colliderTags.get(b),player=ta?.player??tb?.player,cell=ta?.cell??tb?.cell;
  if(player!=null&&cell!=null&&(room.players.get(player)?.breachCells?.get(cell)||0)>room.time)return null;
  return RAPIER.SolverFlags.COMPUTE_IMPULSE;
 },
 filterIntersectionPair(){return true;}
};}
