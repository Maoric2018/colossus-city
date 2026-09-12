import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {fractureRecipe,pieceDistance} from '../shared/city/fracture.js';
import {chipCell,MAX_ACTIVE_SHARDS,MAX_RESTING_SHARD_COLLIDERS,updateShards,settleShard} from '../server/fracture.js';
import {breakHandPath} from '../server/hand-destruction.js';
import {processFailures,scheduleFailures,processFineCollapses} from '../server/destruction.js';
import {C,group} from '../shared/config.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
import {v} from '../shared/math.js';
import {identity} from '../shared/giant-rig.js';
await physicsReady;
function fixture(material='brick',floors=5){const r=new Room('FINE',{environment:{...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material,tiers:[{nx:1,nz:1,floors,ix:0,iz:0}]}]}});r.attach({send(){}},'boss','test');return r;}
const ray=(r,x,y,z)=>r.world.castRay(new RAPIER.Ray(v(x,y,z),v(0,0,-1)),12,true,undefined,group(C.COLLISION.PLAYER,C.COLLISION.WORLD))?.timeOfImpact??12;
test('glass panes, masonry and steel have small separate piece IDs and local hits preserve neighboring structure',()=>{
 for(const material of ['brick','glass','stone','concrete']){const r=fixture(material);try{
  const c=r.cells[2],recipe=fractureRecipe(c),point=[0,c.p[1],-18],before=ray(r,0,c.p[1],-15),lost=chipCell(r,c,point,.65,Infinity);
  assert.ok(lost.length>0&&lost.length<recipe.pieces.length/4);assert.ok(lost.every(p=>pieceDistance(p,[0,0,2])<=.65));
  assert.ok(recipe.pieces.every(p=>Math.max(...p.size)<=.83));assert.ok(recipe.pieces.filter(p=>p.material==='steel').every(p=>p.size[1]<=.62));
  assert.equal(c.skin.hp,c.skin.maxHp);assert.equal(r.detached.size,0);assert.ok(ray(r,0,c.p[1],-15)>before+3);
  assert.ok(ray(r,1.55,c.p[1],-15)<4,'untouched neighboring facade remains solid');
  assert.ok(r.welcome({id:99}).fractures.some(([id,parts])=>id===c.id&&parts.length===lost.length));assert.ok(r.shards.size);
 }finally{r.dispose();}}
});
test('repeated laser hits accumulate on the exact short steel segment instead of another bar or the whole frame',()=>{
 const r=fixture();try{const c=r.cells[2],p=fractureRecipe(c).pieces.find(p=>p.material==='steel'),at=p.p.map((n,k)=>n+c.p[k]);
  chipCell(r,c,at,.01,6);assert.equal(c.skin.parts?.length||0,0);assert.equal(c.skin.partHP[p.id],6);
  chipCell(r,c,at,.01,6);assert.deepEqual(c.skin.parts,[p.id]);assert.ok(c.skin.hp>c.skin.maxHp*.85);assert.equal(r.detached.size,0);
 }finally{r.dispose();}
});
test('authoritative hand sweeps cut small openings through both walls without removing their whole bay',()=>{
 const r=fixture('glass');try{const c=r.cells[2],result=breakHandPath(r,[0,c.p[1],-14],[0,c.p[1],-26],identity,[0,0,-8]);assert.deepEqual(result.position,[0,c.p[1],-26]);assert.ok(c.skin.parts.length>10);assert.equal(r.detached.size,0);assert.equal(c.skin.hp,c.skin.maxHp);assert.ok(ray(r,0,c.p[1],-15)>10);assert.ok(ray(r,0,c.p[1]+4,-15)<4,'the next story stays intact');
 }finally{r.dispose();}
});
test('severing all four supports releases fine rubble rather than a room-shaped rigid body',()=>{
 const r=fixture('concrete',3);try{const c=r.cells[1],columns=fractureRecipe(c).groups.filter(g=>g.kind==='frame'&&g.n[1]>1);
  for(const g of columns){const p=fractureRecipe(c).pieces[g.start+2];chipCell(r,c,p.p.map((n,k)=>n+c.p[k]),.2,Infinity);}
  assert.equal(c.skin.hp,0);scheduleFailures(r);processFailures(r);assert.ok(r.detached.has(c.id));assert.equal(r.debris.size,0);assert.ok(r.shards.size>10);assert.ok([...r.shards.values()].every(e=>Math.max(...e.half)<1.15));
  const message=r.welcome({id:99});assert.ok(message.clearedCells.includes(c.id));assert.ok(message.shards.every(s=>s.pieces.length>0&&s.cell));
 }finally{r.dispose();}
});
test('fine debris retains all pieces at the physics budget, settles, and never hurts the giant',()=>{
 const r=fixture('brick',9);try{const hp=r.bossHP;for(const c of r.cells)chipCell(r,c,c.p,Infinity,Infinity,0,[2,1,3],true);
  assert.equal(r.activeShards.size,MAX_ACTIVE_SHARDS);assert.ok(r.ballisticShards.size>0);const count=r.shards.size;
  for(let i=0;i<720;i++){r.time+=C.TICK;r.world.step();updateShards(r);}
  assert.equal(r.shards.size,count);assert.ok(r.activeShards.size<=MAX_ACTIVE_SHARDS);assert.ok(r.shardSolids.size<=MAX_RESTING_SHARD_COLLIDERS);assert.ok([...r.shards.values()].every(e=>e.settled));assert.equal(r.bossHP,hp);assert.ok(decodeSnapshot(encodeSnapshot(r.snapshot())));
 }finally{r.dispose();}
});
test('streaming restores individual holes, partial segment HP and settled fine debris with stable identities',()=>{
 const r=new Room('STREAM FINE');try{const tile=r.stream.load(7,4),c=tile.cells.find(c=>c.floor===2&&c.walls[2]),point=[c.p[0],c.p[1],c.p[2]+c.size[2]/2];chipCell(r,c,point,.65,Infinity);
  const bar=fractureRecipe(c).pieces.find(p=>p.material==='steel');chipCell(r,c,bar.p.map((n,k)=>n+c.p[k]),.01,3);for(const e of r.shards.values())if(e.cell===c.id)settleShard(r,e);const skin=structuredClone(c.skin),pieces=[...r.shards.values()].filter(e=>e.cell===c.id).map(e=>[e.id,e.pieces]);
  r.stream.unload(tile.key);const packet=r.stream.welcome().find(t=>t.key===tile.key);assert.ok(packet.fractures.some(([id])=>id===c.id));assert.ok(packet.shards.length);
  r.stream.load(7,4);assert.deepEqual(r.cellMap.get(c.id).skin,skin);for(const [id,ids]of pieces){assert.deepEqual(r.shards.get(id).pieces,ids);assert.ok(r.shardSolids.has(id),'Resting debris regains a collision proxy on reload');}assert.ok(ray(r,point[0],point[1],point[2]+3)>3.2);
 }finally{r.dispose();}
});

test('a large unsupported building releases fine rubble gradually without hiding unprocessed pieces',()=>{
 const r=fixture('brick',18);try{
  const ground=r.cells[0];chipCell(r,ground,ground.p,Infinity,Infinity,0,[0,0,0],true);r.drainEvents();r.breakCells([ground.id]);
  assert.equal(r.detached.size,1);assert.equal(r.fineCollapses.size,17);assert.ok(r.cells.slice(1).every(c=>r.handWorld.cells.get(c.id).boxes.length>0));
  let largestPacket=0,steps=0;while(r.fineCollapses.size){const before=r.detached.size;processFineCollapses(r);assert.ok(r.detached.size-before<=2);largestPacket=Math.max(largestPacket,Buffer.byteLength(JSON.stringify(r.drainEvents())));steps++;}
  assert.equal(r.detached.size,r.cells.length);assert.equal(steps,9);assert.ok(largestPacket<150000,largestPacket);assert.equal(r.debris.size,0);assert.ok(r.shards.size>100);assert.ok(r.activeShards.size<=MAX_ACTIVE_SHARDS);
 }finally{r.dispose();}
});
