// REAL Rapier integration tests. Requires npm install. Not replaced by mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Room, physicsReady} from '../server/room.js';
import {v, len, vec} from '../shared/math.js';
import {C} from '../shared/config.js';
import {settleDebris,updateDebris} from '../server/destruction.js';
import {ALL_SIDES} from '../shared/city/materials.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
await physicsReady;
const socket = {send(){}, readyState:1};
const room = () => new Room('ABC123');
const ticks = (r, n) => { for(let i = 0; i < n; i++) r.step(); };
test('shared world can step for 300 frames without nonfinite state', () => {
 const r = room(); try{ r.attach(socket, 'raider', 'test'); ticks(r, 300); for(const p of r.snapshot().players){ assert.ok(p.p.every(Number.isFinite)); assert.ok(p.p[1] > -.5); } }finally{ r.dispose(); }
});
test('an intact city uses merged floor colliders and splits a floor only where it breaks', () => {
 const r = room(); try{
  const intact = r.world.colliders.len(), dressing = r.props.reduce((n,p)=>n+p.boxes.length,0) + r.cells.reduce((n,c)=>n+c.roofHandles.length,0); assert.ok(intact - dressing < 7000, `intact structure has ${intact - dressing} colliders, plus ${dressing} solid props`);
  const c = r.cells.find(c => c.building === 1 && c.floor === 3 && c.ix === 1 && c.iz === 1);
  r.breakCells([c.id], v(2, 0, 0)); const after = r.world.colliders.len();
  assert.ok(after > intact && after < intact + 600, 'only the damaged building splits its column runs and the damaged floor splits its slab');
  assert.equal(r.floors[1][3].structureMerged, false); assert.equal(r.floors[1][4].structureMerged, true);
 }finally{ r.dispose(); }
});
test('breaking every foundation releases the tower as one falling island and gravity moves it', () => {
 const r = room(); try{
  const tower = r.cells.filter(c => c.building === 0), ids = tower.filter(c => c.ground).map(c => c.id);
  r.breakCells(ids, v(0, 0, 0), {crush:true}); assert.equal(r.detached.size, tower.length);
  const events = r.drainEvents();
  assert.equal(events.filter(e => e.type === 'crumble').length,0);
  assert.ok(ids.every(id=>events.some(e=>e.type==='debris'&&e.cells.includes(id))),'every failed foundation keeps its modeled pieces');
  assert.ok(events.some(e => e.type === 'towerdown'));
  const island = [...r.debris.values()].find(e => e.cells.length > 12); assert.ok(island, 'severed storeys fall together');
  const before = island.body.translation().y; for(let i = 0; i < 45; i++) r.world.step(); assert.ok(island.body.translation().y < before - .15);
  for(const e of r.debris.values()) assert.ok(Number.isFinite(e.body.translation().y));
 }finally{ r.dispose(); }
});
test('layered skins: windows pop first, the facade shields the frame, then the bay fails', () => {
 const r = room(); try{
  const brick = r.cells.find(c => c.material === 'brick' && c.ground && c.walls[0]);
  assert.equal(r.damageCell(brick, 4, ALL_SIDES), false); assert.ok(brick.skin.glass & 1, 'a weak tap leaves windows intact');
  r.damageCell(brick, 20, 1); assert.equal(brick.skin.glass & 1, 0); assert.ok(brick.skin.facade & 1); assert.ok(brick.skin.hp > brick.skin.maxHp * .9, 'the facade absorbed most of the hit');
  // A ray through the north wall is blocked while the facade stands and passes once it breaks.
  const through = () => { r.world.updateSceneQueries(); const hit = r.world.castRay(new RAPIER.Ray(v(brick.p[0], brick.p[1], brick.p[2] - 4), v(0, 0, 1)), 3.5, true); return !!hit; };
  assert.equal(through(), true, 'intact wall blocks');
  r.damageCell(brick, 60, 1); assert.equal(brick.skin.facade & 1, 0); assert.equal(through(), false, 'a broken facade opens the wall');
  let failed = false; for(let i = 0; i < 6 && !failed; i++) failed = r.damageCell(brick, 60, 1); assert.ok(failed);
  r.step(); r.step(); assert.ok(r.drainEvents().some(e => e.type === 'skin'));
 }finally{ r.dispose(); }
});
test('overloaded columns fail after a short delay and cascade into a progressive collapse', () => {
 const r = room(); try{
  const tower = r.cells.filter(c => c.building === 1), ground = tower.filter(c => c.ground);
  r.breakCells(ground.slice(0,4).map(c=>c.id), v(0, 0, 0));
  r.step(); assert.ok(r.pendingFailures.size > 0, 'remaining base bays are scheduled to fail');
  assert.ok(r.drainEvents().some(e => e.type === 'creak'));
  ticks(r, Math.ceil((C.COLLAPSE_DELAY + C.COLLAPSE_JITTER) / C.TICK) + 2);
  assert.ok(r.detached.size > 4, 'the cascade detached more than the hit bays');
  ticks(r, 240); assert.ok(r.debris.size <= C.MAX_ACTIVE_CHUNKS);
 }finally{ r.dispose(); }
});
test('strong hand impact creates 11 jointed bodies, a kill, and respawn', () => {
 const r = room(); try{ const c = r.attach(socket, 'raider', 'pilot'), p = r.players.get(c.id); p.invulnerable = 0; r.knockdown(p, v(19, 8, 0), 120); assert.equal(p.hp, 0); assert.equal(r.kills, 1); const rag = r.rags.get(p.rag); assert.equal(rag.parts.length, 11); assert.ok(len(rag.parts[0].body.linvel()) > 10); ticks(r, 330); assert.ok(p.body); assert.equal(p.hp, 100); }finally{ r.dispose(); }
});
test('nonlethal impacts recover without adding a kill', () => {
 const r = room(); try{ const c = r.attach(socket, 'raider', 'pilot'), p = r.players.get(c.id); p.invulnerable = 0; r.knockdown(p, v(7, 3, 0), 30); assert.equal(r.kills, 0); ticks(r, 150); assert.ok(p.body); assert.equal(p.hp, 70); }finally{ r.dispose(); }
});
test('a second boss seat cannot be claimed', () => { const r = room(); try{ r.attach(socket, 'boss', 'one'); assert.throws(() => r.attach(socket, 'boss', 'two'), /already/); }finally{ r.dispose(); } });
test('new client receives complete destruction state including cleared cells and damaged skins', () => {
 const r = room(); try{ const c = r.attach(socket, 'boss', 'one'); r.breakCells([r.cells[0].id], v()); const e = r.debris.values().next().value; r.removeBody(e.body); r.debris.delete(e.id);
  const glass = r.cells.find(c => c.material === 'glass' && c.walls[0]); r.damageCell(glass, 12, 1);
  const w = r.welcome(c); assert.ok(w.clearedCells.includes(e.cells[0])); assert.ok(w.skins.some(s => s[0] === glass.id)); }finally{ r.dispose(); }
});
test('secondary fracture splits an island into bands, bands into bays, keeping membership and momentum', () => {
 const r = room(); try{
  r.breakCells(r.cells.filter(c => c.building === 5 && c.ground).map(c => c.id), v(1, 0, 0));
  const island = [...r.debris.values()].find(e => e.cells.length > 9), members = island.cells.slice(), old = island.id;
  r.splitDebris(old); assert.equal(r.debris.has(old), false);
  const pieces = new Set(members.map(id => r.cellMap.get(id).entity)); assert.ok(pieces.size >= 2);
  for(const id of members){ const b = r.debris.get(r.cellMap.get(id).entity); assert.ok(b.cells.length < members.length); assert.ok(Number.isFinite(b.body.linvel().x)); }
  const band = [...r.debris.values()].find(e => e.cells.length > 1 && e.cells.length <= 9); r.splitDebris(band.id);
  for(const id of band.cells) assert.equal(r.debris.get(r.cellMap.get(id).entity).cells.length, 1);
  const lone = [...r.debris.values()].find(e => e.cells.length === 1); r.crumble(lone.id); assert.equal(r.debris.has(lone.id),true); assert.ok(lone.fractured);assert.equal(r.drainEvents().some(e=>e.type==='crumble'),false);
 }finally{ r.dispose(); }
});
test('destruction budget cannot exceed the configured rigid-body count', () => {
 const r = room(); try{ r.breakCells(r.cells.filter(c => c.ground).map(c => c.id), v()); assert.ok(r.debris.size <= C.MAX_ACTIVE_CHUNKS); for(const e of [...r.debris.values()]) r.splitDebris(e.id); assert.ok(r.debris.size <= C.MAX_ACTIVE_CHUNKS); ticks(r, 120); assert.ok(r.debris.size <= C.MAX_ACTIVE_CHUNKS); }finally{ r.dispose(); }
});
test('falling structure crushes the giant when it lands on its head', () => {
 const r = room(); try{
  r.attach(socket, 'boss', 'still'); r.attach(socket, 'raider', 'pilot'); const hp = r.bossHP;
  const roof = r.cells.find(c => c.building === 1 && c.roof); r.breakCells([roof.id], v());
  const e = [...r.debris.values()][0]; e.body.setTranslation(v(r.boss.head.x, r.boss.head.y + 6, r.boss.head.z), true); e.body.setLinvel(v(0, -20, 0), true);
  ticks(r, 3); assert.ok(r.bossHP < hp); assert.ok(r.boss.stagger > 0); assert.ok(r.drainEvents().some(ev => ev.type === 'gianthit'));
 }finally{ r.dispose(); }
});
test('round reset never reuses freed WASM body wrappers', () => {
 const r = room(); try{ const c = r.attach(socket, 'raider', 'pilot'); r.step(); r.initWorld(); ticks(r, 5); assert.ok(r.players.get(c.id).body.isValid()); assert.equal(r.detached.size, 0); }finally{ r.dispose(); }
});
test('XR recenter crosses a building without dealing damage or launching debris', () => {
 const r = room(); try{
  const boss = r.attach(socket, 'boss', 'quest'), cell = r.cells.find(c => c.ground), hand = [...cell.p], hp = cell.skin.hp;
  const pose = {type:'pose', head:[hand[0], 23.8, hand[2]], left:hand, right:[hand[0] + 3, hand[1], hand[2]], yaw:0, reset:true};
  // Keep the headset within the server's allowed playspace offset.
  r.boss.x = hand[0]; r.boss.z = hand[2]; r.input(boss, pose); r.step();
  assert.equal(cell.skin.hp, hp); assert.equal(r.detached.size, 0); assert.equal(r.handBodies[0].collider(0).isEnabled(), false);
  assert.ok(Math.abs(r.handBodies[0].translation().x - hand[0]) < .001);
  for(let i = 0; i < 15; i++){ r.input(boss, {...pose, reset:false}); r.step(); }
  assert.equal(cell.skin.hp, hp); assert.equal(r.handBodies[0].collider(0).isEnabled(), true);
 }finally{ r.dispose(); }
});
test('lost XR tracking stops locomotion and collisions; fresh tracking safely resumes', () => {
 const r = room(); try{
  const boss = r.attach(socket, 'boss', 'quest'), pose = {type:'pose', head:[0, 23.8, 0], left:[-5, 16, -4], right:[5, 16, -4], yaw:0, moveZ:-1};
  r.input(boss, pose); r.step(); const z = r.boss.z;
  r.input(boss, {type:'pose', tracking:false}); ticks(r, 30);
  assert.equal(r.boss.z, z); assert.equal(r.handBodies[0].collider(0).isEnabled(), false);
  r.input(boss, pose); r.step(); assert.ok(r.boss.z < z); assert.equal(r.handBodies[0].collider(0).isEnabled(), false);
 }finally{ r.dispose(); }
});
test('walking stops at a building, chips it slightly and cannot demolish it', () => {
 const r = room(); try{
  const boss = r.attach(socket, 'boss', 'desktop'), b = r.env.buildings[5];
  r.boss.x = b.x; r.boss.z = b.z + 20; let cellsHit = 0;
  for(let i = 0; i < 240; i++){ r.input(boss, {type:'input', yaw:0, pitch:0, x:0, z:-1}); r.step(); cellsHit += r.drainEvents().filter(e => e.type === 'strike').length; }
  assert.ok(cellsHit > 0,'the torso gives contact feedback');assert.equal(r.detached.size,0);assert.ok(r.boss.pushing);assert.ok(r.cells.every(c=>c.skin.hp>=c.skin.maxHp*.95));const z=r.boss.z;
  for(let i=0;i<240;i++){r.input(boss,{type:'input',yaw:0,pitch:0,x:0,z:-1});r.step();}assert.ok(Math.abs(r.boss.z-z)<.01);assert.equal(r.detached.size,0);assert.equal(r.snapshot().bossBlocked,1);
 }finally{ r.dispose(); }
});

test('resting rubble remains collidable, frees active slots and survives late join until reset',()=>{
 const r=room();try{
  r.breakCells([r.cells.find(c=>c.building===5&&c.roof).id],v());const e=[...r.debris.values()][0];
  e.body.setTranslation(v(0,2,20),true);e.body.setLinvel(v(),true);e.body.sleep();const count=r.world.colliders.len();
  assert.ok(settleDebris(r,e.id));assert.equal(r.debris.has(e.id),false);assert.ok(r.settled.has(e.id));assert.equal(r.world.colliders.len(),count);
  r.time+=C.CHUNK_LIFETIME+100;updateDebris(r,new Set(),new Set(),new Set());
  const w=r.welcome({id:99,role:'spectator'});assert.ok(w.entities.some(x=>x.id===e.id&&x.settled));assert.ok(!w.clearedCells.includes(e.cells[0]));assert.ok(e.body.isValid());
  r.world.updateSceneQueries();const hit=r.world.castRay(new RAPIER.Ray(v(0,8,20),v(0,-1,0)),8,true);assert.equal(r.colliderTags.get(hit.collider.handle).cell,e.cells[0]);assert.ok(r.handWorld.cells.get(e.cells[0]).boxes.length>0);
  r.initWorld();assert.equal(r.settled.size,0);
 }finally{r.dispose();}
});
