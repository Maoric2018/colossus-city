// Only nearby blocks have live Rapier bodies. Damaged blocks retain a sparse journal
// so returning players and late joins see the same holes, skins and resting wreckage.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C,group} from '../shared/config.js';
import {generateCells,initialSkin} from '../shared/environment.js';
import {generateBlock,blockAt,blockKey,homeBlock,cellBlock} from '../shared/city/layout.js';
import {box} from '../shared/giant-rig.js';
import {addBuildings,removeBody,bodyPose,debrisMeta,detachCellColliders,restoreSkin,restoreDebris} from './destruction.js';
export class CityStreaming{
 constructor(room){this.room=room;this.active=new Map();this.archive=new Map();this.free=[];this.lastFocus='';}
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
  const r=this.room,env=generateBlock(x,z,r.env.seed),indices=env.buildings.map(b=>{const i=this.free.length?this.free.pop():r.env.buildings.length;r.env.buildings[i]={...b,index:i};return i;});
  env.buildings=env.buildings.map((b,i)=>({...b,index:indices[i]}));const cells=generateCells(env);
  r.cells.push(...cells);addBuildings(r,cells,indices);r.handWorld.addCells(cells);
  const ground=r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x*70,-.3,z*70));r.world.createCollider(RAPIER.ColliderDesc.cuboid(35,.3,35).setFriction(.82).setCollisionGroups(group(C.COLLISION.WORLD)),ground);
  const groundBox=box([x*70,-.3,z*70],[35,.3,35]);r.handWorld.fixed.push(groundBox);
  const tile={key:env.key,x,z,indices,cells,cellIds:new Set(cells.map(c=>c.id)),ground,groundBox};this.active.set(tile.key,tile);
  const saved=this.archive.get(tile.key);
  if(saved){
   for(const [id,skin]of saved.damage)restoreSkin(r,r.cellMap.get(id),skin);
   for(const id of saved.detached){const c=r.cellMap.get(id);detachCellColliders(r,c);r.detached.add(id);r.handWorld.setCell(id,null,undefined,true);}
   for(const e of saved.entities)restoreDebris(r,e);
   for(const local of saved.collapsed)r.collapsed.add(indices[local]);
   for(const [id,delay]of saved.failures)r.pendingFailures.set(id,r.time+delay);
  }
  r.world.updateSceneQueries();r.event({type:'block-load',...this.meta(tile)});return tile;
 }
 capture(tile){
  const r=this.room,damage=[];
  for(const c of tile.cells){const s=initialSkin(c);if(c.skin.hp!==s.hp||c.skin.glass!==s.glass||c.skin.facade!==s.facade||c.skin.facadeHp.some((h,i)=>h!==s.facadeHp[i]))damage.push([c.id,{...c.skin,facadeHp:[...c.skin.facadeHp]}]);}
  return {x:tile.x,z:tile.z,key:tile.key,damage,detached:tile.cells.filter(c=>r.detached.has(c.id)).map(c=>c.id),entities:[...r.debris.values(),...r.settled.values()].filter(e=>tile.cellIds.has(e.cells[0])).map(e=>({...debrisMeta(e),velocity:Object.values(e.body.linvel()),angular:Object.values(e.body.angvel())})),collapsed:tile.indices.flatMap((i,n)=>r.collapsed.has(i)?[n]:[]),failures:[...r.pendingFailures].filter(([id])=>tile.cellIds.has(id)).map(([id,t])=>[id,Math.max(0,t-r.time)])};
 }
 meta(tile){const saved=this.capture(tile);return this.publicState(saved,tile.indices);}
 publicState(saved,indices){const inDebris=new Set(saved.entities.flatMap(e=>e.cells));return {key:saved.key,x:saved.x,z:saved.z,indices,skins:saved.damage.map(([id,s])=>[id,s.glass,s.facade]),clearedCells:saved.detached.filter(id=>!inDebris.has(id)),entities:saved.entities};}
 unload(key){
  const tile=this.active.get(key),r=this.room,saved=this.capture(tile);if(saved.damage.length||saved.detached.length)this.archive.set(key,saved);
  r.event({type:'block-unload',...this.publicState(saved,tile.indices)});
  for(const e of saved.entities){const entity=r.debris.get(e.id)||r.settled.get(e.id);removeBody(r,entity.body);r.debris.delete(e.id);r.settled.delete(e.id);}
  for(const i of tile.indices){removeBody(r,r.buildingBodies[i]);r.buildingBodies[i]=null;r.cellsByBuilding[i]=[];r.floors[i]=[];r.buildingBounds[i]=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];r.buildingColumns[i]=null;r.env.buildings[i]=null;r.dirtyBuildings.delete(i);r.lastCreak.delete(i);r.collapsed.delete(i);this.free.push(i);}
  for(const c of tile.cells){r.cellMap.delete(c.id);r.handWorld.setCell(c.id,null,undefined,true);r.handWorld.cells.delete(c.id);r.detached.delete(c.id);r.pendingFailures.delete(c.id);}
  r.cells=r.cells.filter(c=>!tile.cellIds.has(c.id));removeBody(r,tile.ground);r.handWorld.fixed=r.handWorld.fixed.filter(b=>b!==tile.groundBox);this.active.delete(key);
 }
 welcome(){return [...this.active.values()].map(t=>this.meta(t)).concat([...this.archive].filter(([key])=>!this.active.has(key)).map(([,s])=>this.publicState(s)));}
 // A long rifle ray may reach beyond the normal physics neighbourhood.
 ensureRay(from,to){const steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/35);for(let i=0;i<=steps;i++){const t=steps?i/steps:0,[x,z]=blockAt(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t);if(!homeBlock(x,z)&&!this.active.has(blockKey(x,z)))this.load(x,z);}}
}
