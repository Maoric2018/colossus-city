// Raider lifecycle: spawning, per-tick input application, practice drones.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C, group} from '../shared/config.js';
import {v, sub, norm, vec, clamp} from '../shared/math.js';
import {fly} from './abilities.js';
import {shoot, knockdown, removeRag} from './combat.js';
import {removeBody} from './destruction.js';
const G = C.COLLISION;
export const noInput = () => ({x:0, z:0, up:0, boost:false, fire:false, soar:false, missile:false, dodge:0, heavy:0, yaw:0, pitch:0, seq:0});
export function newPlayer(room, id, name, bot){
 return {id, name, bot, input:noInput(), lastInput:bot ? room.time : -100, kills:0, damage:0, score:0, heavyReady:0, lastHeavySeq:0, closeCallAt:-10};
}
export function spawn(room, p, at){
 if(p.body) removeBody(room, p.body);
 const spawnPoint = at || vec(room.env.spawns[(p.id - 1) % room.env.spawns.length]);
 if(!at&&room.env.infinite&&Math.hypot(room.boss.x,room.boss.z)>160){
  // Keep distant respawns near the fight, on an intersection rather than inside
  // whichever procedural building happens to occupy the old relative offset.
  spawnPoint.x=Math.round((room.boss.x+spawnPoint.x*.35-35)/70)*70+35;
  spawnPoint.z=Math.round((room.boss.z+spawnPoint.z*.35-35)/70)*70+35;
 }
 room.stream?.ensureAround(spawnPoint.x,spawnPoint.z);
 p.body = room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawnPoint.x, Math.max(1.2, spawnPoint.y), spawnPoint.z).lockRotations().setLinearDamping(.12).setCcdEnabled(true));
 const co = room.world.createCollider(RAPIER.ColliderDesc.capsule(.8, .34).setMass(70).setFriction(.05).setRestitution(0).setCollisionGroups(group(G.PLAYER, G.WORLD | G.DEBRIS)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), p.body);
 room.colliderTags.set(co.handle, {player:p.id});
 p.colliderRotation=null;p.hp = C.PLAYER_HP; p.fuel = 1; p.rag = null; p.deadUntil = 0; p.recoverAt = 0; p.invulnerable = room.time + C.INVULNERABLE_SECONDS; p.lastShot = -1; p.soaring = false; p.dodgeUntil = 0; p.dodgeReady = 0; p.lastDodgeSeq = p.input.dodge || 0; p.lastHeavySeq = p.input.heavy || 0;
}
export function removePlayer(room, id){
 const p = room.players.get(id); if(!p) return;
 if(p.body) removeBody(room, p.body); if(p.rag) removeRag(room, p.rag); room.players.delete(id);
}
export function addBots(room, n = 3){
 for(let i = 0; i < n && room.players.size < C.MAX_RAIDERS; i++){
  const id = room.nextPlayer++, p = newPlayer(room, id, `DRONE ${i + 1}`, true); room.players.set(id, p); spawn(room, p);
 }
}
export function updatePlayer(room, p){
 if(p.rag){
  const r = room.rags.get(p.rag), at = r?.parts[0].body.translation() || v(0, 2, 60);
  if(p.hp <= 0 && room.time >= p.deadUntil){ spawn(room, p); return; }
  if(p.hp > 0 && room.time >= p.recoverAt){ const hp = p.hp, bound = room.env.infinite ? Infinity : room.env.half - 8; removeRag(room, p.rag); spawn(room, p, v(clamp(at.x, -bound, bound), clamp(at.y, 1.2, C.MAX_ALTITUDE - 5), clamp(at.z, -bound, bound))); p.hp = hp; return; }
  return;
 }
 if(!p.body) return;
 if(p.bot) driveBot(room, p);
 const i = room.time - p.lastInput > .45 ? noInput() : p.input;
 const at = p.body.translation();
 if(at.y < -8 || (!room.env.infinite && (Math.abs(at.x) > C.KILL_HALF || Math.abs(at.z) > C.KILL_HALF))){ knockdown(room, p, v(0, 4, 0), 200); return; }
 fly(room, p, i);
 if(i.fire && room.time - p.lastShot > C.FIRE_INTERVAL){ p.lastShot = room.time; shoot(room, p); }
 if(i.heavy > p.lastHeavySeq){
  p.lastHeavySeq = i.heavy;
  if(room.time >= p.heavyReady && p.fuel >= C.HEAVY_FUEL){ p.heavyReady = room.time + C.HEAVY_COOLDOWN; p.fuel -= C.HEAVY_FUEL; shoot(room, p, true); }
 }
}
function driveBot(room, p){
 const at = p.body.translation(), target = room.boss.head, angle = room.time * .18 + p.id * 2;
 const goal = v(room.boss.x + Math.sin(angle) * 22, 14 + Math.sin(room.time * .45 + p.id) * 7, room.boss.z + Math.cos(angle) * 22);
 const dir = norm(sub(goal, at)), aim = sub(target, at);
 p.input = {x:dir.x, z:dir.z, world:true, up:clamp((goal.y - at.y) / 4, -1, 1), boost:false, fire:true, heavy:0, dodge:0,
  yaw:Math.atan2(-aim.x, -aim.z), pitch:Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), seq:0};
 p.lastInput = room.time;
}
