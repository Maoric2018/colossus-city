// REAL Rapier integration tests. Requires npm install. Not replaced by mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {v,len} from '../shared/math.js';
import {C} from '../shared/config.js';
await physicsReady;
const socket={send(){},readyState:1};
const room=()=>new Room('ABC123');
test('shared world can step for 300 frames without nonfinite state',()=>{
 const r=room();try{r.attach(socket,'raider','test');for(let i=0;i<300;i++)r.step();for(const p of r.snapshot().players){assert.ok(p.p.every(Number.isFinite));assert.ok(p.p[1]>-.5);}}finally{r.dispose();}
});
test('breaking foundations releases unsupported floors and gravity moves them',()=>{
 const r=room();try{const ids=r.cells.filter(c=>c.building===0&&c.ground).map(c=>c.id);r.breakCells(ids,v(3,0,0));assert.equal(r.detached.size,24);assert.ok(r.debris.size>=6);const e=[...r.debris.values()].find(e=>e.origin[1]>10),before=e.body.translation().y;for(let i=0;i<45;i++)r.world.step();assert.ok(e.body.translation().y<before-.15);for(const e of r.debris.values())assert.ok(Number.isFinite(e.body.translation().y));}finally{r.dispose();}
});
test('strong hand impact creates 11 jointed bodies, a kill, and respawn',()=>{
 const r=room();try{const c=r.attach(socket,'raider','pilot'),p=r.players.get(c.id);p.invulnerable=0;r.knockdown(p,v(19,8,0),120);assert.equal(p.hp,0);assert.equal(r.kills,1);const rag=r.rags.get(p.rag);assert.equal(rag.parts.length,11);assert.ok(len(rag.parts[0].body.linvel())>10);for(let i=0;i<330;i++)r.step();assert.ok(p.body);assert.equal(p.hp,100);}finally{r.dispose();}
});
test('nonlethal impacts recover without adding a kill',()=>{
 const r=room();try{const c=r.attach(socket,'raider','pilot'),p=r.players.get(c.id);p.invulnerable=0;r.knockdown(p,v(7,3,0),30);assert.equal(r.kills,0);for(let i=0;i<150;i++)r.step();assert.ok(p.body);assert.equal(p.hp,70);}finally{r.dispose();}
});
test('a second boss seat cannot be claimed',()=>{const r=room();try{r.attach(socket,'boss','one');assert.throws(()=>r.attach(socket,'boss','two'),/already/);}finally{r.dispose();}});
test('new client receives complete destruction state including cleared cells',()=>{
 const r=room();try{const c=r.attach(socket,'boss','one');r.breakCells([r.cells[0].id],v());const e=r.debris.values().next().value;r.removeBody(e.body);r.debris.delete(e.id);const w=r.welcome(c);assert.ok(w.clearedCells.includes(e.cells[0]));}finally{r.dispose();}
});
test('secondary fracture preserves membership and finite momentum',()=>{
 const r=room();try{r.breakCells(r.cells.filter(c=>c.building===0&&c.ground).map(c=>c.id),v(1,0,0));const e=[...r.debris.values()].find(e=>e.cells.length>1),ids=e.cells.slice(),old=e.id;r.splitDebris(old);assert.equal(r.debris.has(old),false);for(const id of ids){const b=r.debris.get(r.cellMap.get(id).entity);assert.equal(b.cells.length,1);assert.ok(Number.isFinite(b.body.linvel().x));}}finally{r.dispose();}
});
test('destruction budget cannot exceed the configured rigid-body count',()=>{
 const r=room();try{r.breakCells(r.cells.filter(c=>c.ground).map(c=>c.id),v());assert.ok(r.debris.size<=C.MAX_ACTIVE_CHUNKS);for(const e of [...r.debris.values()])r.splitDebris(e.id);assert.ok(r.debris.size<=C.MAX_ACTIVE_CHUNKS);}finally{r.dispose();}
});

test('round reset never reuses freed WASM body wrappers',()=>{
 const r=room();try{const c=r.attach(socket,'raider','pilot');r.step();r.initWorld();for(let i=0;i<5;i++)r.step();assert.ok(r.players.get(c.id).body.isValid());assert.equal(r.detached.size,0);}finally{r.dispose();}
});

test('XR recenter crosses a building without dealing damage or launching debris',()=>{
 const r=room();try{
  const boss=r.attach(socket,'boss','quest'),cell=r.cells.find(c=>c.ground),hand=[...cell.p];
  const pose={type:'pose',head:[hand[0],23.8,hand[2]],left:hand,right:[hand[0]+3,hand[1],hand[2]],yaw:0,reset:true};
  // Keep the headset within the server's allowed playspace offset.
  r.boss.x=hand[0];r.boss.z=hand[2];r.input(boss,pose);r.step();
  assert.equal(cell.hp,90);assert.equal(r.detached.size,0);assert.equal(r.handBodies[0].collider(0).isEnabled(),false);
  assert.ok(Math.abs(r.handBodies[0].translation().x-hand[0])<.001);
  for(let i=0;i<15;i++){r.input(boss,{...pose,reset:false});r.step();}
  assert.equal(cell.hp,90);assert.equal(r.handBodies[0].collider(0).isEnabled(),true);
 }finally{r.dispose();}
});

test('lost XR tracking stops locomotion and collisions; fresh tracking safely resumes',()=>{
 const r=room();try{
  const boss=r.attach(socket,'boss','quest'),pose={type:'pose',head:[0,23.8,0],left:[-5,16,-4],right:[5,16,-4],yaw:0,moveZ:-1};
  r.input(boss,pose);r.step();const z=r.boss.z;
  r.input(boss,{type:'pose',tracking:false});for(let i=0;i<30;i++)r.step();
  assert.equal(r.boss.z,z);assert.equal(r.handBodies[0].collider(0).isEnabled(),false);
  r.input(boss,pose);r.step();assert.ok(r.boss.z<z);assert.equal(r.handBodies[0].collider(0).isEnabled(),false);
 }finally{r.dispose();}
});
