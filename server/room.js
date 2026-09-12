// One authoritative match: a Rapier world, its players, the giant and the destructible city.
// Room orchestrates; the mechanics live in boss.js, players.js, combat.js, destruction.js
// and abilities.js so they can be changed and tested independently.
import {GIANT, handQuaternion, identity} from '../shared/giant-rig.js';
import {HandWorld} from '../shared/hand-world.js';
import {staticProps} from '../shared/props.js';
import {randomBytes} from 'node:crypto';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C, F, group} from '../shared/config.js';
import {activeEnvironment as city, generateCells} from '../shared/environment.js';
import {v, len, arr, vec, clamp, norm, sub, mul, finiteVector, sanitizeInput, quatEuler, dist} from '../shared/math.js';
import {updateMissiles} from './abilities.js';
import {initialBoss, updateBoss} from './boss.js';
import {shoot, knockdown, makeRag, ragMeta, removeRag} from './combat.js';
import {buildCity, breakCells, splitDebris, crumble, damageCell, removeBody, debrisMeta, bodyPose, scheduleFailures, processFailures, flushSkinEvents, damagedSkins, updateDebris, resolveCell} from './destruction.js';
import {noInput, newPlayer, spawn, removePlayer, addBots, updatePlayer} from './players.js';
import {sideBit, ALL_SIDES} from '../shared/city/materials.js';
export const physicsReady = RAPIER.init();
const G = C.COLLISION;

export class Room {
 constructor(code, {practice = false, environment = city} = {}){
  this.code = code; this.env = environment; this.practice = practice; this.clients = new Map(); this.players = new Map();
  this.nextPlayer = 1; this.nextRag = 10000; this.tick = 0; this.time = 0; this.round = 1; this.emptySince = Date.now(); this.bossClient = null;
  this.initWorld();
 }
 initWorld(){
  // Old body wrappers refer to the old WASM sets, not to the next world.
  for(const p of this.players.values()){ p.body = null; p.rag = null; }
  this.world?.free(); this.queue?.free();
  this.world = new RAPIER.World(v(0, C.GRAVITY, 0)); this.world.timestep = C.TICK;
  this.world.integrationParameters.numSolverIterations = 5;
  this.queue = new RAPIER.EventQueue(true); this.colliderTags = new Map(); this.cells = generateCells(this.env);
  this.cellMap = new Map(); this.detached = new Set(); this.debris = new Map(); this.settled = new Map(); this.nextDebris = 1000; this.missiles = new Map(); this.nextMissile = 20000; this.rags = new Map(); this.events = [];
  this.phase = 0; this.remaining = C.MATCH_SECONDS; this.bossHP = C.BOSS_HP; this.kills = 0; this.startTime = this.time; this.towersDown = 0; this.destroyedThisRound = 0;
  this.boss = initialBoss();
  this.ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -.3, 0));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(this.env.half + 60, .3, this.env.half + 60).setFriction(.82).setCollisionGroups(group(G.WORLD)), this.ground);
  buildCity(this); this.handWorld = new HandWorld(this.env, this.cells);
  this.props = staticProps(this.env);
  for(const prop of this.props){ const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...prop.position).setRotation({x:0, y:Math.sin(prop.yaw / 2), z:0, w:Math.cos(prop.yaw / 2)})); for(const a of prop.boxes){const co=this.world.createCollider(RAPIER.ColliderDesc.cuboid(...a.slice(3)).setTranslation(...a.slice(0, 3)).setCollisionGroups(group(G.WORLD)), body);this.colliderTags.set(co.handle,{prop:prop.id});} }
  for(const prop of this.env.props){ if(!prop.collider) continue;
   const p = prop.position || [0, 0, 0], scale = prop.scale || 1, half = prop.collider.half, rotation = quatEuler(...(prop.rotation || [0, 0, 0]));
   if(!finiteVector(half) || half.some(x => x <= 0) || !Number.isFinite(scale) || scale <= 0) throw Error('Invalid prop collider');
   const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...p).setRotation(rotation));
   const off = prop.collider.offset || [0, 0, 0];
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(...half.map(x => x * scale)).setTranslation(...off.map(x => x * scale)).setCollisionGroups(group(G.WORLD)), b);
  }
  this.handBodies = ['left', 'right'].map(side => {
   const p = this.boss[side], body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(...GIANT.handHalf).setFriction(.4).setCollisionGroups(group(G.GIANT, G.DEBRIS | G.RAGDOLL)), body); return body;
  });
  for(const p of this.players.values()){ p.kills = 0; p.damage = 0; p.score = 0; spawn(this, p); }
  // Rays cast before the first step must already see the city.
  this.world.updateSceneQueries();
 }
 // ---- membership ----
 attach(ws, role, name){
  if(role === 'boss' && this.bossClient) throw Error('This room already has a giant. Join as a raider.');
  if(role === 'raider' && [...this.players.values()].filter(p => !p.bot).length >= C.MAX_RAIDERS) throw Error('The eight raider slots are full.');
  const id = this.nextPlayer++, client = {id, ws, role, name, viewKey:randomBytes(24).toString('hex')}; this.clients.set(id, client);
  if(role === 'boss'){ this.bossClient = id; this.boss.lastPose = -100; this.boss.input = noInput(); }
  if(role === 'raider'){
   // Human players replace practice bots before consuming extra physics budget.
   const bot = [...this.players.values()].find(p => p.bot); if(bot) removePlayer(this, bot.id);
   const p = newPlayer(this, id, name, false); this.players.set(id, p); spawn(this, p);
  }
  if(this.practice && !this.players.size) addBots(this, 3);
  this.emptySince = null; return client;
 }
 detach(id){
  const c = this.clients.get(id); if(!c) return;
  c.viewSocket?.close(1000, 'Player left'); this.clients.delete(id);
  if(this.bossClient === id){ this.bossClient = null; this.boss.input = noInput(); }
  removePlayer(this, id); if(!this.clients.size) this.emptySince = Date.now();
 }
 hostId(){ return this.clients.keys().next().value; }
 roster(){ return [...this.clients.values()].map(c => ({id:c.id, name:c.name, role:c.role})).concat([...this.players.values()].filter(p => p.bot).map(p => ({id:p.id, name:p.name, role:'bot'}))); }
 welcome(client){
  return {type:'welcome', id:client.id, viewKey:client.viewKey, role:client.role, room:this.code, practice:this.practice, environment:this.env.id, round:this.round, host:this.hostId(),
   missiles:[...this.missiles.values()].map(m => ({...m, time:this.time, p:arr(m.p)})),
   clearedCells:this.cells.filter(c => this.detached.has(c.id) && !this.debris.has(c.entity) && !this.settled.has(c.entity)).map(c => c.id),
   skins:damagedSkins(this), collapsed:[...this.collapsed],
   entities:[...this.debris.values(), ...this.settled.values()].map(e => debrisMeta(e)), rags:[...this.rags.values()].map(r => ragMeta(r)), roster:this.roster()};
 }
 // ---- input ----
 input(client, m){
  if(m.type === 'input'){
   const data = sanitizeInput(m); if(!data) return;
   if(client.role === 'raider'){ const p = this.players.get(client.id); if(p){ p.input = data; p.lastInput = this.time; } }
   else if(client.role === 'boss'){ this.boss.input = data; this.boss.lastInput = this.time; this.boss.desktop = true; }
  }
  if(m.type === 'pose' && client.role === 'boss'){
   if(m.tracking === false){ this.boss.desktop = false; this.boss.lastPose = -100; this.boss.moveX = 0; this.boss.moveZ = 0; return; }
   if(!finiteVector(m.head) || !finiteVector(m.left) || !finiteVector(m.right) || !Number.isFinite(m.yaw)) return;
   const b = this.boss, head = vec(m.head), l = vec(m.left), r = vec(m.right);
   if(head.y < 5 || head.y > 38 || Math.hypot(head.x - b.x, head.z - b.z) > 18 || dist(head, l) > 64 || dist(head, r) > 64) return;
   // Session entry, recentering and recovered tracking are teleports, not swings.
   if(m.reset === true || b.desktop || this.time - b.lastPose >= .4){ b.resetPose = true; b.noContactUntil = this.time + .2; }
   b.turnDelta = clamp((b.turnDelta || 0) + clamp(Number(m.turnDelta) || 0, -.8, .8), -Math.PI, Math.PI);
   b.triggers = {left:!!m.fireLeft, right:!!m.fireRight};
   b.aims = {}; for(const side of ['left', 'right']) if(finiteVector(m[side + 'Aim'], 3, 1.1) && len(vec(m[side + 'Aim'])) > .8) b.aims[side] = norm(vec(m[side + 'Aim']));
   b.target = {head, left:l, right:r, leftQuaternion:handQuaternion(m.leftQuaternion, m.yaw), rightQuaternion:handQuaternion(m.rightQuaternion, m.yaw)}; b.yaw = clamp(m.yaw, -1e5, 1e5); b.lastPose = this.time; b.desktop = false;
   b.moveX = clamp(Number(m.moveX) || 0, -1, 1); b.moveZ = clamp(Number(m.moveZ) || 0, -1, 1);
  }
  if(m.type === 'restart' && client.id === this.hostId() && this.phase !== 0){ this.round++; this.initWorld(); this.event({type:'reset'}); }
 }
 event(e){ this.events.push(e); }
 drainEvents(){ const e = this.events; this.events = []; return e; }
 hurtBoss(damage, info = {}){
  if(this.phase || damage <= 0 || info.kind === 'debris') return;
  this.bossHP = Math.max(0, this.bossHP - damage);
  if(info.kind === 'heavy') this.boss.stagger = Math.min(1, this.boss.stagger + damage / 260);
  if(info.kind !== 'shot') this.event({type:'gianthit', kind:info.kind, p:info.p, power:info.power || .3, damage:Math.round(damage)});
 }
 // ---- simulation ----
 step(){
  this.tick++; this.time += C.TICK;
  if(this.phase){ this.world.step(this.queue); this.queue.drainCollisionEvents(() => {}); if(this.time - this.endedAt > 20){ this.round++; this.initWorld(); this.event({type:'reset'}); } return; }
  // Wait for at least one raider. An AI giant fills an empty boss seat; it is not a second authority.
  if(this.players.size) this.remaining = Math.max(0, C.MATCH_SECONDS - (this.time - this.startTime)); else this.startTime = this.time;
  updateBoss(this);
  for(const p of this.players.values()) updatePlayer(this, p);
  for(const e of this.debris.values()) e.preImpactSpeed = len(e.body.linvel());
  updateMissiles(this);
  this.world.step(this.queue);
  const hits = [], fractures = new Set(), crumbles = new Set();
  this.queue.drainCollisionEvents((a, b, started) => {
   if(!started) return;
   const ta = this.colliderTags.get(a), tb = this.colliderTags.get(b);
   const pt = ta?.player ? ta : tb?.player ? tb : null;
   for(const [tag, other] of [[ta, tb], [tb, ta]]){
    if(!tag?.cell) continue;
    const c = this.cellMap.get(tag.cell), e = this.debris.get(c?.entity);
    if(!e) continue;
    if(e.cells.length > 1 && e.preImpactSpeed > C.SPLIT_SPEED && this.time - e.born > .5) fractures.add(e.id);
    else if(e.cells.length === 1 && e.preImpactSpeed > C.CRUMBLE_SPEED && this.time - e.born > .3) crumbles.add(e.id);
    // Falling structure batters whatever it lands on: domino collapses are intended.
    const oc = other && !other.player ? resolveCell(this, other, e.body.translation()) : null;
    if(oc && !oc.entity && !this.detached.has(oc.id) && e.preImpactSpeed > 6 && this.time - oc.lastHit > .28){
     oc.lastHit = this.time; damageCell(this, oc, e.preImpactSpeed * Math.sqrt(e.cells.length) * 1.3, ALL_SIDES, this.cellMap.get(e.cells[0]).lastHitBy);
     this.event({type:'strike', p:oc.p, material:oc.material, power:Math.min(1, e.preImpactSpeed / 25), broke:oc.skin.hp <= 0});
    }
   }
   const ct = ta?.cell ? ta : tb?.cell ? tb : null;
   if(pt && ct){
    const c = this.cellMap.get(ct.cell), p = this.players.get(pt.player), e = c?.entity ? this.debris.get(c.entity) : null;
    if(e && p?.body){ const speed = len(e.body.linvel()); if(speed > 4) hits.push([p, mul(norm(sub(p.body.translation(), e.body.translation())), Math.min(23, speed)), speed * 6]); }
   }
  });
  for(const [p, kick, damage] of hits) if(p.body) knockdown(this, p, kick, damage, -1);
  updateDebris(this, hits, fractures, crumbles);
  processFailures(this); scheduleFailures(this); flushSkinEvents(this);
  for(const [id, r] of this.rags) if(this.time - r.born > 9) removeRag(this, id);
  if(this.bossHP <= 0 || this.remaining <= 0){ this.missiles.clear(); this.phase = this.bossHP <= 0 ? 1 : 2; this.endedAt = this.time; this.event({type:'end', winner:this.phase === 1 ? 'raiders' : 'giant', players:this.scoreboard()}); }
 }
 scoreboard(){ return [...this.players.values()].map(p => ({id:p.id, name:p.name, bot:p.bot, kills:p.kills, damage:Math.round(p.damage), score:Math.round(p.score)})); }
 snapshot(){
  const b = this.boss;
  return {tick:this.tick, time:this.time, bossHP:this.bossHP, remaining:this.remaining, kills:this.kills, head:arr(b.head), left:arr(b.left), right:arr(b.right), bossYaw:b.yaw, bossX:b.x, bossZ:b.z, leftQuaternion:b.leftQuaternion, rightQuaternion:b.rightQuaternion,
   damage:this.detached.size / this.cells.length * 100, phase:this.phase, round:this.round, bossStagger:b.stagger, towersDown:this.towersDown, bossBlocked:b.pushing ? 1 : 0,
   players:[...this.players.values()].map(p => { const rb = p.body || this.rags.get(p.rag)?.parts[0].body; return {id:p.id, flags:(p.rag ? F.RAG : 0) | (p.hp <= 0 ? F.DEAD : 0) | (this.time < p.invulnerable ? F.SHIELD : 0) | (p.bot ? F.BOT : 0) | (p.soaring ? F.SOAR : 0) | (this.time < p.dodgeUntil ? F.DODGE : 0), p:rb ? arr(rb.translation()) : [0, -20, 0], v:rb ? arr(rb.linvel()) : [0, 0, 0], yaw:p.input.yaw, hp:p.hp, fuel:p.fuel, seq:p.input.seq, pitch:p.input.pitch, dodgeCooldown:Math.max(0, p.dodgeReady - this.time), heavyCooldown:Math.max(0, p.heavyReady - this.time), score:p.score}; }),
   bodies:[...[...this.debris.values()].map(e => ({id:e.id, ...bodyPose(e.body)})), ...[...this.rags.values()].flatMap(r => r.parts.map(p => ({id:p.id, ...bodyPose(p.body)})))]
  };
 }
 dispose(){ this.world.free(); this.queue.free(); }
 // ---- thin method facades kept for tests, tools and older call sites ----
 updateBoss(){ return updateBoss(this); }
 updatePlayer(p){ return updatePlayer(this, p); }
 spawn(p, at){ return spawn(this, p, at); }
 removePlayer(id){ return removePlayer(this, id); }
 addBots(n){ return addBots(this, n); }
 breakCells(ids, kick, hint){ return breakCells(this, ids, kick, hint); }
 splitDebris(id){ return splitDebris(this, id); }
 crumble(id){ return crumble(this, id); }
 damageCell(c, energy, sides, by){ return damageCell(this, c, energy, sides, by); }
 knockdown(p, kick, damage, by){ return knockdown(this, p, kick, damage, by); }
 makeRag(p, at, velocity, flightVelocity){ return makeRag(this, p, at, velocity, flightVelocity); }
 removeRag(id){ return removeRag(this, id); }
 removeBody(body){ return removeBody(this, body); }
 shoot(p, heavy){ return shoot(this, p, heavy); }
 debrisMeta(e){ return debrisMeta(e); }
 ragMeta(r){ return ragMeta(r); }
}
