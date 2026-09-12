import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {fractureRecipe} from '../shared/city/fracture.js';
import {chipCell} from '../server/fracture.js';
import {FineBuildings} from '../src/world/fine-buildings.js';
import {ComponentBatches} from '../src/render/component-batches.js';
import {FractureDeltas} from '../shared/fracture-deltas.js';
import {packEvents,unpackEvents} from '../shared/event-codec.js';
import {snapshotForClient} from '../server/snapshot-interest.js';
import {C} from '../shared/config.js';
import {rayBlocks} from '../server/ray-streaming.js';
import {generateBlock} from '../shared/city/layout.js';
import {generateCells} from '../shared/city/cells.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {v} from '../shared/math.js';
await physicsReady;

test('a structural cut leaves other storeys compact while subsequent cuts remove every intersecting run',()=>{
 const environment={...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material:'concrete',tiers:[{nx:3,nz:3,floors:20,ix:0,iz:0}]}]},r=new Room('LOCALITY',{environment});
 try{
  const count=r.world.colliders.len(),floors=r.floors[0],untouched=floors[15].structure.slice();
  for(const floor of [10,3,16]){
   const c=floors[floor].cells[4],recipe=fractureRecipe(c),g=recipe.groups.find(g=>g.kind==='frame'&&g.n[1]>1),piece=recipe.pieces[g.start+2];
   chipCell(r,c,piece.p.map((n,k)=>n+c.p[k]),.12,Infinity);
   assert.equal(floors[floor].structureMerged,false);
   assert.ok([...r.buildingColumns[0].runs].every(run=>!run.floors.includes(floor)),'no continuous column may bridge a damaged floor');
  }
  assert.deepEqual(floors[15].structure,untouched);assert.ok(untouched.every(h=>r.world.getCollider(h)));
  assert.ok(r.world.colliders.len()-count<250,'three cuts must not expand twenty intact storeys');
  for(let i=0;i<60;i++)r.step();assert.equal(r.detached.size,0,'small localized cuts retain the remaining structural support');
 }finally{r.dispose();}
});

function polygons(g){const a=(g.index?g.toNonIndexed():g).attributes,out=[];for(let i=0;i<a.position.count;i+=3)out.push([0,1,2].map(k=>{const j=i+k;return [a.position.getX(j),a.position.getY(j),a.position.getZ(j),a.normal.getX(j),a.normal.getY(j),a.normal.getZ(j),a.uv.getX(j),a.uv.getY(j),.2,.4,.6];}));return out;}
test('successive cuts retain the opposite wall GPU allocation and spatial rubble selection survives travel',()=>{
 const material=new T.MeshBasicMaterial(),groups=[0,1].map(id=>({id,n:[2,1,1]})),pieces=groups.flatMap(g=>[0,1].map(x=>({id:g.id*2+x,group:g.id,grid:[x,0,0],p:[x-.5,0,0],size:[1,2,2]}))),source={recipe:{groups,pieces},materials:new Map([['wall',{material,castShadow:false}]]),records:groups.map(g=>({key:'wall',layer:'facade',side:g.id*2,group:g.id,polygons:polygons(new T.BoxGeometry(2,2,2))}))};
 const fine=new FineBuildings(new T.Group(),{}),c={id:1,p:[0,0,0]},pose={p:new T.Vector3(),q:new T.Quaternion()};fine.source=()=>source;
 fine.set(c,{parts:[0],facade:15,glass:15},pose,{});const opposite=fine.cells.get(1).parts.find(d=>d.section.endsWith(':2'));
 fine.set(c,{parts:[0,1],facade:15,glass:15},pose,{});assert.equal(fine.cells.get(1).parts.find(d=>d.section.endsWith(':2')),opposite);
 for(let i=0;i<100;i++)fine.addShards(c,{id:i,pieces:[2],origin:[0,0,0],p:[i*300,0,0],q:[0,0,0,1],settled:true},{});
 const camera=new T.PerspectiveCamera();camera.updateMatrixWorld(true);fine.select(camera);assert.equal(fine.visibleShards.size,1);assert.equal(fine.shards.size,100);assert.ok(fine.candidates.size<5);
 camera.position.x=3000;camera.updateMatrixWorld(true);fine.select(camera);assert.equal(fine.visibleShards.size,1);assert.ok(fine.visibleShards.has(fine.shards.get(10)));assert.equal(fine.shards.get(0).parts[0].pool.mesh.getVisibleAt(fine.shards.get(0).parts[0].index),false);
 pose.p.x=3000;pose.fine.update();fine.select(camera);assert.ok(fine.visibleCells.has(fine.cells.get(1)));fine.reset();assert.equal(fine.shardIndex.entries.size,0);
});

test('material batches preserve distinct geometries, transforms and slots when objects leave and return',()=>{
 const root=new T.Group(),batches=new ComponentBatches(root),material=new T.MeshBasicMaterial(),a={geometry:new T.BoxGeometry().toNonIndexed(),material},b={geometry:new T.SphereGeometry(1,8,4).toNonIndexed(),material},parts=Array.from({length:90},(_,i)=>({cell:{p:[i,0,0]}})),matrix=new T.Matrix4(),read=new T.Matrix4();
 for(let i=0;i<parts.length;i++)batches.write(parts[i],i%2?a:b,matrix.makeTranslation(i,4,-2));assert.equal(batches.pools.size,1);const pool=parts[0].materialSlot.pool;assert.equal(pool.geometries.size,2);assert.equal(pool.mesh.instanceCount,90);
 for(let i=0;i<parts.length;i+=2)batches.remove(parts[i]);for(let i=1;i<parts.length;i+=2){pool.mesh.getMatrixAt(parts[i].materialSlot.index,read);assert.equal(read.elements[12],i);assert.equal(read.elements[13],4);}
 for(let i=0;i<parts.length;i+=2)batches.write(parts[i],b,matrix.makeTranslation(-i,5,0));assert.equal(pool.mesh.instanceCount,90);
 for(const part of parts)batches.remove(part);assert.equal(pool.mesh.visible,false);batches.dispose();assert.equal(root.children.length,0);
});

test('reliable fracture deltas round-trip repeated cuts, late joins, reset and missing-state recovery',()=>{
 const server=new FractureDeltas(),client=new FractureDeltas(),first=Array.from({length:100},(_,i)=>i),welcome={fractures:[[7,first]]};server.seed(welcome);client.seed(welcome);
 const events=[{type:'fracture',cell:7,parts:[...first,105,108]},{type:'strike',cell:7},{type:'fracture',cell:7,parts:[...first,105,108,110]}],packed=server.pack(events);
 assert.ok(packed.filter(e=>e.type==='fracture-delta').length===2);assert.deepEqual(client.unpack(unpackEvents(JSON.parse(JSON.stringify(packEvents(packed))))),events);
 assert.ok(JSON.stringify(packed).length<JSON.stringify(events).length*.5);
 client.cells.clear();const missing=[];assert.deepEqual(client.unpack([packed[0]],id=>missing.push(id)),[]);assert.deepEqual(missing,[7]);
 const full={type:'fracture',cell:7,parts:[...first,105,108,110]};client.unpack([full]);server.set(7,full.parts);const next=[{type:'fracture',cell:7,parts:[...full.parts,111]}];assert.deepEqual(client.unpack(server.pack(next)),next);
 const reset=[{type:'reset'},{type:'fracture',cell:7,parts:[3]}];assert.deepEqual(client.unpack(server.pack(reset)),reset);
});

test('per-player snapshots preserve every nearby pose and refresh every distant pose within one second',()=>{
 const bodies=Array.from({length:100},(_,id)=>({id,p:[id*100,0,0],q:[0,0,0,1]})),base={tick:0,players:[{id:9,p:[0,0,0],v:[0,0,0]}],head:[5000,0,0],bodies},client={id:9,role:'raider',snapshotInterest:true},seen=new Set();let sent=0;
 for(let i=0;i<20;i++){const s=snapshotForClient({...base,tick:i*C.SNAPSHOT_EVERY},client);for(const id of [0,1,2])assert.ok(s.bodies.some(b=>b.id===id));for(const b of s.bodies){assert.equal(b,bodies[b.id]);seen.add(b.id);}sent+=s.bodies.length;}
 assert.equal(seen.size,100);assert.ok(sent<300);assert.equal(snapshotForClient(base,{...client,role:'spectator'}),base);assert.equal(snapshotForClient(base,{id:9,role:'raider'}),base);
 const boss=snapshotForClient(base,{role:'boss',snapshotInterest:true});assert.ok(boss.bodies.some(b=>b.id===50));
});

test('long shots skip empty air and stop streaming at a real wall, including short diagonal crossings',()=>{
 const visited=[...rayBlocks(v(34,10,34),v(40,10,36))].map(({x,z})=>[x,z]);assert.deepEqual(visited,[[0,0],[1,0],[1,1]]);
 const r=new Room('RAYLOCAL');try{
  const before=r.stream.active.size;r.stream.ensureRay(v(280,1000,280),v(900,1000,500));assert.equal(r.stream.active.size,before,'sky rays create no offscreen physics blocks');
  const env=generateBlock(9,7),c=generateCells(env).find(c=>c.floor===2&&c.walls[2]),from=v(c.p[0],c.p[1],c.p[2]+c.size[2]/2+3),to=v(from.x,from.y,from.z-300);
  r.stream.ensureRay(from,to);assert.ok(r.stream.active.has(env.key));assert.ok(r.stream.active.size-before<=2,'a blocking facade must stop construction of blocks behind it');
  const hit=r.world.castRay(new RAPIER.Ray(from,v(0,0,-1)),300,true);assert.ok(hit&&hit.timeOfImpact<4);
  const loaded=r.stream.active.size;r.stream.ensureRay(from,to);assert.equal(r.stream.active.size,loaded);
 }finally{r.dispose();}
});

test('a long shot restores archived rubble in a road outside the original building footprint',()=>{
 const r=new Room('RAYRUBBLE');try{
  const tile=r.stream.load(9,7),c=tile.cells.find(c=>c.floor===2),e=r.breakCells([c.id],v())[0],at=v(9*70+32,2,7*70+25);e.body.setTranslation(at,true);
  r.stream.unload(tile.key);assert.ok(r.stream.archive.get(tile.key).entities.some(x=>x.id===e.id));
  const from=v(at.x,at.y,at.z+10),to=v(at.x,at.y,at.z-30);r.stream.ensureRay(from,to);
  assert.ok(r.stream.active.has(tile.key));const hit=r.world.castRay(new RAPIER.Ray(from,v(0,0,-1)),40,true);assert.ok(hit&&hit.timeOfImpact<10,'the restored moving/resting body must still intercept the shot');
 }finally{r.dispose();}
});
