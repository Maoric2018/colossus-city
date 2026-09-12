// Only nearby blocks have live Rapier bodies. Damaged blocks retain a sparse journal
// so returning players and late joins see the same holes, skins and resting wreckage.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C,group} from '../shared/config.js';
import {generateCells,initialSkin} from '../shared/environment.js';
import {generateBlock,blockAt,blockKey,homeBlock,cellBlock} from '../shared/city/layout.js';
import {box} from '../shared/giant-rig.js';
import {sidewalkSlabs} from '../shared/streets.js';
import {addBuildings,removeBody,bodyPose,debrisMeta,detachCellColliders,restoreSkin,restoreDebris} from './destruction.js';
import {shardMeta,restoreShards,removeShards} from './fracture.js';
import {rayBlocks,rayBounds,intersectsRayBounds,archivedRayBounds} from './ray-streaming.js';
export class CityStreaming{
 constructor(room){this.room=room;this.active=new Map();this.archive=new Map();this.free=[];this.landmarks=new Set();this.lastSpawn=-Infinity;this.lastFocus='';this.rayCache=new Map();}
 ensureAround(x,z,wanted=new Set()){
  const [cx,cz]=blockAt(x,z);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(!homeBlock(cx+dx,cz+dz)){const key=blockKey(cx+dx,cz+dz);wanted.add(key);if(!this.active.has(key))this.load(cx+dx,cz+dz);}
  return wanted;
 }
 update(){
  const r=this.room,points=[[r.boss.x,r.boss.z]];
  for(const p of r.players.values()){const at=p.body?.translation()||r.rags.get(p.rag)?.parts[0].body.translation();if(at)points.push([at.x,at.z]);}
  for(const m of r.missiles.values())points.push([m.p.x,m.p.z]);
  const signature=points.map(p=>blockAt(...p).join(',')).sort().join(';');if(signature===this.lastFocus&&!this.waiting&&r.tick%60!==0)return;this.lastFocus=signature;
  // Load before releasing previous blocks; at full soaring speed there is at least
  // one whole block of solid geometry ahead, including when players split up.
  const wanted=new Set(),missing=[];for(const p of points){const [cx,cz]=blockAt(...p);for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++)if(!homeBlock(x,z)){const key=blockKey(x,z);if(wanted.has(key))continue;wanted.add(key);if(!this.active.has(key))missing.push([x,z]);}}
  missing.sort((a,b)=>Math.min(...points.map(p=>(a[0]*70-p[0])**2+(a[1]*70-p[1])**2))-Math.min(...points.map(p=>(b[0]*70-p[0])**2+(b[1]*70-p[1])**2)));
  // The outer ring is at least 70 m ahead of a moving player. Amortize its
  // construction across ticks instead of pausing every match for a whole row.
  if(missing.length)this.load(...missing[0]);this.waiting=missing.length>1;
  for(const tile of [...this.active.values()])if(!wanted.has(tile.key)){
   // A thrown part can cross its original block boundary. Keep its owner loaded
   // while somebody can touch the part, even if they cannot see its old building.
   const nearby=[...r.debris.values(),...r.settled.values()].some(e=>tile.cellIds.has(e.cells[0])&&points.some(p=>{const at=e.body.translation();return Math.hypot(at.x-p[0],at.z-p[1])<100;}));
   if(!nearby)this.unload(tile.key);
  }
 }
 load(x,z){
  const r=this.room,env=generateBlock(x,z,r.env.seed,{landmark:this.landmarks.has(blockKey(x,z))?'chrysler':undefined}),indices=env.buildings.map(b=>{const i=this.free.length?this.free.pop():r.env.buildings.length;r.env.buildings[i]={...b,index:i};return i;});
  env.buildings=env.buildings.map((b,i)=>({...b,index:indices[i]}));const cells=generateCells(env);
  r.cells.push(...cells);addBuildings(r,cells,indices);r.handWorld.addCells(cells);
  const ground=r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x*70,-.3,z*70));r.world.createCollider(RAPIER.ColliderDesc.cuboid(35,.3,35).setFriction(.82).setCollisionGroups(group(C.COLLISION.WORLD)),ground);
  const groundBox=box([x*70,-.3,z*70],[35,.3,35]);r.handWorld.fixed.push(groundBox);
  const groundBoxes=[groundBox];
  for(const slab of sidewalkSlabs(env)){const half=slab.boxes[0].slice(3);r.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(0,slab.position[1]+.3,0).setFriction(.82).setCollisionGroups(group(C.COLLISION.WORLD)),ground);const b=box(slab.position,half);groundBoxes.push(b);r.handWorld.fixed.push(b);}
  const tile={key:env.key,x,z,landmark:env.landmark,indices,cells,cellIds:new Set(cells.map(c=>c.id)),ground,groundBox,groundBoxes};this.active.set(tile.key,tile);
  const saved=this.archive.get(tile.key);
  if(saved){
   for(const [id,kick]of saved.fineCollapses||[])r.fineCollapses.set(id,kick);
   for(const [id,skin]of saved.damage)restoreSkin(r,r.cellMap.get(id),skin);
   for(const id of saved.detached){const c=r.cellMap.get(id);detachCellColliders(r,c);r.detached.add(id);r.handWorld.setCell(id,null,undefined,true);}
   for(const e of saved.entities)restoreDebris(r,e);
   for(const e of saved.shards||[])restoreShards(r,e);
   for(const local of saved.collapsed)r.collapsed.add(indices[local]);
   for(const [id,delay]of saved.failures)r.pendingFailures.set(id,r.time+delay);
  }
  r.world.invalidateSceneQueries();r.event({type:'block-load',...this.meta(tile)});return tile;
 }
 spawnChrysler(client){
  const r=this.room;if(client.id!==r.hostId()||r.time-this.lastSpawn<2)return null;
  const at=r.players.get(client.id)?.body?.translation()||r.boss,[cx,cz]=blockAt(at.x,at.z),choices=[];
  for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
   const x=cx+dx,z=cz+dz,key=blockKey(x,z);if(homeBlock(x,z)||this.landmarks.has(key)||generateBlock(x,z,r.env.seed).landmark)continue;
   // Courtyard footprint plus a safety margin for live players and the giant.
   const occupied=Math.abs(r.boss.x-x*70)<14&&Math.abs(r.boss.z-z*70)<14||[...r.players.values()].some(p=>{const q=p.body?.translation();return q&&Math.abs(q.x-x*70)<10&&Math.abs(q.z-z*70)<10;})||[...r.debris.values(),...r.settled.values()].some(e=>{const q=e.body.translation();return Math.hypot(q.x-x*70,q.z-z*70)<18;});
   if(!occupied)choices.push({x,z,key,d:(x*70-at.x)**2+(z*70-at.z)**2});
  }
  choices.sort((a,b)=>a.d-b.d);const choice=choices[0];if(!choice)return null;
  const {x,z,key}=choice;this.lastSpawn=r.time;this.landmarks.add(key);let tile=this.active.get(key);
  if(!tile)tile=this.load(x,z);
  else{
   const env=generateBlock(x,z,r.env.seed,{landmark:'chrysler'}),local=env.buildings.length-1,index=this.free.length?this.free.pop():r.env.buildings.length;
   r.env.buildings[index]={...env.buildings[local],index};
   const cells=generateCells(env).filter(c=>c.building===local);for(const c of cells)c.building=index;
   tile.indices.push(index);tile.cells.push(...cells);for(const c of cells)tile.cellIds.add(c.id);tile.landmark='chrysler';
   r.cells.push(...cells);addBuildings(r,cells,[index]);r.handWorld.addCells(cells);r.world.invalidateSceneQueries();r.event({type:'block-load',...this.meta(tile)});
  }
  return {x:x*70,z:z*70,distance:Math.round(Math.sqrt(choice.d))};
 }
 capture(tile){
  const r=this.room,damage=[];
  for(const c of tile.cells){const s=initialSkin(c);if(c.skin.parts?.length||Object.keys(c.skin.partHP||{}).length||c.skin.hp!==s.hp||c.skin.glass!==s.glass||c.skin.facade!==s.facade||c.skin.facadeHp.some((h,i)=>h!==s.facadeHp[i])||c.skin.glassHp.some((h,i)=>h!==s.glassHp[i]))damage.push([c.id,structuredClone(c.skin)]);}
  return {x:tile.x,z:tile.z,key:tile.key,landmark:tile.landmark,damage,fineCollapses:[...r.fineCollapses].filter(([id])=>tile.cellIds.has(id)),shards:[...r.shards.values()].filter(e=>tile.cellIds.has(e.cell)).map(e=>shardMeta(e,r.time)),detached:tile.cells.filter(c=>r.detached.has(c.id)).map(c=>c.id),entities:[...r.debris.values(),...r.settled.values()].filter(e=>tile.cellIds.has(e.cells[0])).map(e=>({...debrisMeta(e),velocity:Object.values(e.body.linvel()),angular:Object.values(e.body.angvel())})),collapsed:tile.indices.flatMap((i,n)=>r.collapsed.has(i)?[n]:[]),failures:[...r.pendingFailures].filter(([id])=>tile.cellIds.has(id)).map(([id,t])=>[id,Math.max(0,t-r.time)])};
 }
 meta(tile){const saved=this.capture(tile);return this.publicState(saved,tile.indices);}
 publicState(saved,indices){const inDebris=new Set(saved.entities.flatMap(e=>e.cells));return {key:saved.key,x:saved.x,z:saved.z,landmark:saved.landmark,indices,skins:saved.damage.map(([id,s])=>[id,s.glass,s.facade]),fractures:saved.damage.filter(([,s])=>s.parts?.length).map(([id,s])=>[id,s.parts]),shards:saved.shards||[],clearedCells:saved.detached.filter(id=>!inDebris.has(id)),entities:saved.entities};}
 unload(key){
  const tile=this.active.get(key),r=this.room,saved=this.capture(tile);if(saved.damage.length||saved.detached.length||this.landmarks.has(key))this.archive.set(key,saved);
  r.event({type:'block-unload',...this.publicState(saved,tile.indices)});
  for(const e of saved.entities){const entity=r.debris.get(e.id)||r.settled.get(e.id);removeBody(r,entity.body);r.debris.delete(e.id);r.settled.delete(e.id);}
  for(const e of saved.shards||[])removeShards(r,e.id);
  for(const i of tile.indices){removeBody(r,r.buildingBodies[i]);r.buildingBodies[i]=null;r.cellsByBuilding[i]=[];r.floors[i]=[];r.buildingBounds[i]=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];r.buildingColumns[i]=null;r.env.buildings[i]=null;r.dirtyBuildings.delete(i);r.lastCreak.delete(i);r.collapsed.delete(i);this.free.push(i);}
  for(const c of tile.cells){r.fineCollapses.delete(c.id);r.cellMap.delete(c.id);r.handWorld.setCell(c.id,null,undefined,true);r.handWorld.cells.delete(c.id);r.detached.delete(c.id);r.pendingFailures.delete(c.id);}
  r.cells=r.cells.filter(c=>!tile.cellIds.has(c.id));removeBody(r,tile.ground);r.handWorld.fixed=r.handWorld.fixed.filter(b=>!tile.groundBoxes.includes(b));this.active.delete(key);
 }
 welcome(){return [...this.active.values()].map(t=>this.meta(t)).concat([...this.archive].filter(([key])=>!this.active.has(key)).map(([,s])=>this.publicState(s)));}
 // Stop at an existing obstruction and reject empty air from conservative
 // authored bounds before constructing new Rapier bodies. Actual hits still
 // come from the same authoritative collider query after the block is loaded.
 ensureRay(from,to){
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(delta.x,delta.y,delta.z);if(!length)return;
  const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length},ray=new RAPIER.Ray(from,direction),groups=group(C.COLLISION.PLAYER,C.COLLISION.WORLD|C.COLLISION.DEBRIS);
  const hit=()=>this.room.world.castRay(ray,length,true,undefined,groups)?.timeOfImpact??length;let distance=hit();
  for(const {x,z,t}of rayBlocks(from,to)){
   if(t*length>distance)break;const key=blockKey(x,z);if(homeBlock(x,z)||this.active.has(key))continue;
   const landmark=this.landmarks.has(key)?'chrysler':undefined,cacheKey=key+':'+(landmark||'');let bounds=this.rayCache.get(cacheKey);
   if(!bounds){bounds=rayBounds(generateBlock(x,z,this.room.env.seed,{landmark}));this.rayCache.set(cacheKey,bounds);if(this.rayCache.size>64)this.rayCache.delete(this.rayCache.keys().next().value);}
   if(!intersectsRayBounds(bounds,from,direction,distance)&&!intersectsRayBounds(archivedRayBounds(this.archive.get(key),bounds),from,direction,distance))continue;
   this.load(x,z);distance=hit();
  }
 }
}
