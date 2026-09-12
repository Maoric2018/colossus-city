// Sparse fine destruction. Intact city geometry stays merged. A hit changes only
// nearby piece IDs and sends small debris groups, never another room-sized cube.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C,group} from '../shared/config.js';
import {fractureRecipe,pieceAlive,pieceDistance,pieceEnergy,fractureStrength,shardBallistic,unsupportedWallPieces} from '../shared/city/fracture.js';
import {refreshFineColliders,removeBody,bodyPose} from './destruction.js';
import {v,vec,arr,seeded} from '../shared/math.js';
import {axes,box,sweepBox} from '../shared/giant-rig.js';
export const MAX_ACTIVE_SHARDS=96,MAX_RESTING_SHARD_COLLIDERS=256;
export function initFracture(room){room.shards=new Map();room.activeShards=new Set();room.ballisticShards=new Set();room.shardSolids=new Map();room.restingShards=new Set();room.supportChecks=[];room.fractureEvents=new Map();room.nextShard=1000000;}
export function chipCell(room,c,point,radius,energy,by=0,direction=[0,0,0],all=false,volume=null,releasing=false){
 if(!c||room.detached.has(c.id))return [];
 const {pieces}=fractureRecipe(c),at=Array.isArray(point)?point:arr(point),local=at.map((n,k)=>n-c.p[k]),gone=new Set(c.skin.parts||[]),damage=c.skin.partHP??={},chosen=[];
 const basis=volume?axes(volume.q):null;
 const selected=p=>volume?!!sweepBox(volume.from,volume.to,basis,volume.half,box(p.p.map((n,k)=>n+c.p[k]),p.size.map(n=>n/2)),.025):all||pieceDistance(p,local)<=radius;
 const candidates=pieces.filter(p=>pieceAlive(p,c.skin,gone)&&selected(p)).map(p=>({p,d:pieceDistance(p,local)})).sort((a,b)=>a.d-b.d||a.p.id-b.p.id);
 let budget=energy;
 for(const {p,d}of candidates){
  const hp=damage[p.id]??pieceEnergy(p),spent=Math.min(hp,budget);if(spent<=0)break;budget-=spent;damage[p.id]=hp-spent;
  if(damage[p.id]<=1e-6){gone.add(p.id);chosen.push(p);delete damage[p.id];}
 }
 if(!chosen.length)return [];
 for(const p of unsupportedWallPieces(c,gone,new Set(chosen.map(p=>p.group)))){gone.add(p.id);chosen.push(p);delete damage[p.id];}
 c.skin.parts=[...gone].sort((a,b)=>a-b);c.lastHitBy=by;
 const hp=Math.min(c.skin.hp,c.skin.maxHp*fractureStrength(c,c.skin));if(hp!==c.skin.hp){c.skin.hp=hp;room.dirtyBuildings.add(c.building);}
 if(!releasing)refreshFineColliders(room,c,chosen);let event=room.fractureEvents.get(c.id);if(event)event.parts=c.skin.parts;else{event={type:'fracture',cell:c.id,parts:c.skin.parts};room.fractureEvents.set(c.id,event);room.event(event);}
 spawnShards(room,c,chosen,direction);return chosen;
}
export function spawnShards(room,c,pieces,direction=[0,0,0]){
 const clusters=new Map(),dir=Array.isArray(direction)?direction:arr(direction);
 for(const p of pieces){const key=p.group+':'+p.material+':'+p.p.map(n=>Math.floor(n/1.05)).join(',');if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(p);}
 for(const parts of clusters.values()){
  const lo=[0,1,2].map(k=>Math.min(...parts.map(p=>p.p[k]-p.size[k]/2))),hi=[0,1,2].map(k=>Math.max(...parts.map(p=>p.p[k]+p.size[k]/2))),center=lo.map((n,k)=>(n+hi[k])/2),id=room.nextShard++,rand=seeded(id+c.id),origin=c.p.map((n,k)=>n+center[k]);
  const velocity=dir.map((n,k)=>Math.max(-7,Math.min(7,n))+(rand()-.5)*(k===1?1:2));velocity[1]+=1;
  const e={type:'shards',id,cell:c.id,pieces:parts.map(p=>p.id),origin,p:[...origin],q:[0,0,0,1],half:lo.map((n,k)=>Math.max(.035,(hi[k]-n)*.47)),material:parts[0].material,born:room.time,velocity,settled:false};
  room.shards.set(id,e);
  if(room.activeShards.size<MAX_ACTIVE_SHARDS){
   e.body=room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...e.p).setLinearDamping(.22).setAngularDamping(.6).setCcdEnabled(true));
   // Fine fragments hit the city, larger rubble and hands, but never each other
   // or players. This avoids quadratic brick/brick contacts and incidental damage.
   const co=room.world.createCollider(RAPIER.ColliderDesc.cuboid(...e.half).setDensity(e.material==='steel'?3:1).setFriction(.9).setRestitution(.08).setCollisionGroups(group(32,C.COLLISION.WORLD|C.COLLISION.DEBRIS|C.COLLISION.GIANT)),e.body);room.colliderTags.set(co.handle,{shard:id});
   e.body.setLinvel(vec(velocity),true);e.body.setAngvel(v((rand()-.5)*5,(rand()-.5)*5,(rand()-.5)*5),true);room.activeShards.add(id);
  }else makeBallistic(room,e);
  room.event(shardMeta(e));
 }
}
function supportingHeight(room,p,half){
 // A ray starting inside a wall is not support. Only upward-facing surfaces
 // beneath the piece count, and fine rubble cannot support itself in a stack.
 let height=0;const origin=v(p[0],p[1]+.08,p[2]);
 room.world.intersectionsWithRay(new RAPIER.Ray(origin,v(0,-1,0)),Math.max(.2,origin.y+1),false,hit=>{const y=origin.y-hit.timeOfImpact;if(hit.normal.y>.55&&y<=p[1]+.01)height=Math.max(height,y);return true;},undefined,group(C.COLLISION.PLAYER,C.COLLISION.WORLD));return height;
}
function verticalHalf(e){const b=box(e.p,e.half,e.q);return b.extent[1];}
function planFall(room,e){
 const p=e.body?arr(e.body.translation()):e.p,velocity=e.body?arr(e.body.linvel()):[0,0,0],t=Math.sqrt(Math.max(0,p[1])*2/24);
 const ground=supportingHeight(room,[p[0]+velocity[0]*t,p[1]-.04,p[2]+velocity[2]*t],e.half)+e.half[1];
 return {ground,velocity,duration:Math.max(.08,(velocity[1]+Math.sqrt(velocity[1]**2+48*Math.max(0,p[1]-ground)))/24)};
}
function makeBallistic(room,e,plan){
 e.ballistic=true;e.start=[...e.p];e.born=room.time;
 // Budget overflow keeps every visible piece, using a deterministic fall to a
 // server-queried supporting surface rather than freezing or deleting it in air.
 const t=Math.sqrt(Math.max(0,e.p[1])*2/24),x=e.p[0]+e.velocity[0]*t,z=e.p[2]+e.velocity[2]*t;
 e.ground=plan?.ground??supportingHeight(room,[x,e.p[1]-.04,z],e.half)+e.half[1];
 e.duration=plan?.duration??Math.max(.08,(e.velocity[1]+Math.sqrt(e.velocity[1]**2+48*Math.max(0,e.p[1]-e.ground)))/24);room.ballisticShards.add(e.id);
}
export function shardMeta(e){const {body,...meta}=e;return {...meta,...(body?{...bodyPose(body),velocity:arr(body.linvel())}:{})};}
export function settleShard(room,e){
 if(e.body){Object.assign(e,bodyPose(e.body));removeBody(room,e.body);e.body=null;}
 e.settled=true;e.ballistic=false;room.activeShards.delete(e.id);room.ballisticShards.delete(e.id);room.restingShards.add(e.id);
 attachRestingShard(room,e);room.event(shardMeta(e));
}
function attachRestingShard(room,e){
 if(room.shardSolids.has(e.id))return;
 if(room.shardSolids.size>=MAX_RESTING_SHARD_COLLIDERS){const [id,body]=room.shardSolids.entries().next().value;removeBody(room,body);room.shardSolids.delete(id);}
 const body=room.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...e.p).setRotation({x:e.q[0],y:e.q[1],z:e.q[2],w:e.q[3]}));
 const co=room.world.createCollider(RAPIER.ColliderDesc.cuboid(...e.half).setFriction(.95).setCollisionGroups(group(C.COLLISION.DEBRIS,C.COLLISION.WORLD|C.COLLISION.PLAYER|C.COLLISION.GIANT|32)),body);room.colliderTags.set(co.handle,{shard:e.id});room.shardSolids.set(e.id,body);
}
export function updateShards(room){
 // Query the unchanged supporting world before adding/removing any shard bodies.
 // Otherwise each settling brick invalidates and rebuilds the entire query tree.
 const settle=[],resume=[];const falling=e=>resume.push([e,planFall(room,e)]);
 for(const id of room.activeShards){const e=room.shards.get(id);if(e.body.isSleeping()){Object.assign(e,bodyPose(e.body));if(e.p[1]-verticalHalf(e)<=supportingHeight(room,e.p,e.half)+.16)settle.push(e);else falling(e);}else if(room.time-e.born>8||e.body.translation().y<-.5)falling(e);}
 for(const id of room.ballisticShards){const e=room.shards.get(id);Object.assign(e,shardBallistic(e,room.time));if(room.time-e.born>=e.duration){const ground=supportingHeight(room,e.p,e.half)+verticalHalf(e);if(e.p[1]>ground+.16)falling(e);else{e.p[1]=ground;settle.push(e);}}}
 if(!room.supportChecks.length)room.supportChecks=[...room.restingShards];
 for(let i=0;i<24&&room.supportChecks.length;i++){const id=room.supportChecks.pop(),e=room.shards.get(id);if(e?.settled&&e.p[1]-verticalHalf(e)>supportingHeight(room,e.p,e.half)+.16)falling(e);}
 for(const [e,plan]of resume)resumeFall(room,e,plan);for(const e of settle)settleShard(room,e);
}
function resumeFall(room,e,plan){
 if(e.body){Object.assign(e,bodyPose(e.body));e.velocity=arr(e.body.linvel());removeBody(room,e.body);e.body=null;}else e.velocity=[0,0,0];
 if(room.shardSolids.has(e.id))removeBody(room,room.shardSolids.get(e.id));room.shardSolids.delete(e.id);room.restingShards.delete(e.id);room.activeShards.delete(e.id);e.settled=false;makeBallistic(room,e,plan);room.event(shardMeta(e));
}
export function restoreShards(room,meta){const e={...meta,body:null};room.shards.set(e.id,e);room.nextShard=Math.max(room.nextShard,e.id+1);if(e.settled){room.restingShards.add(e.id);attachRestingShard(room,e);}else makeBallistic(room,e);}
export function removeShards(room,id){const e=room.shards.get(id);if(e?.body)removeBody(room,e.body);if(room.shardSolids.has(id))removeBody(room,room.shardSolids.get(id));room.shardSolids.delete(id);room.restingShards.delete(id);room.activeShards.delete(id);room.ballisticShards.delete(id);room.shards.delete(id);}
