// The colossus: tracked-hand embodiment, desktop stand-in, practice AI, swept strikes and the
// body shoving through buildings. The server never extrapolates a disconnected punch.
import {C} from '../shared/config.js';
import {v, add, sub, mul, len, norm, dist, arr, vec, clamp, rotateYaw, segmentDistance, segmentAABB, lookDir} from '../shared/math.js';
import {launchMissile} from './abilities.js';
import {knockdown} from './combat.js';
import {damageCell, breakCells, buildingsAlong, cellsNear} from './destruction.js';
import {sideBit, ALL_SIDES} from '../shared/city/materials.js';
import {facingSide} from '../shared/city/cells.js';
import {noInput} from './players.js';
export function initialBoss(){
 return {x:0, z:0, yaw:0, head:v(0, 23.8, 0), left:v(-5.6, 16, -4), right:v(5.6, 16, -4), lastPose:-100, input:noInput(), lastInput:-100, missileReady:0, stagger:0, combo:0, comboAt:-10, stepDistance:0};
}
export function updateBoss(room){
 const b = room.boss, prevL = {...b.left}, prevR = {...b.right}, before = v(b.x, 0, b.z);
 b.stagger = Math.max(0, b.stagger - C.TICK * .55);
 const slow = (1 - b.stagger * .6) * (b.pushing ? .5 : 1), bound = C.GIANT_BOUND;
 if(room.bossClient && room.time - b.lastPose < .4 && !b.desktop){
  const d = rotateYaw(v(b.moveX || 0, 0, b.moveZ || 0), b.yaw), step = mul(len(d) > 1 ? norm(d) : d, C.GIANT_SPEED * C.TICK * slow);
  b.x = clamp(b.x + step.x, -bound, bound); b.z = clamp(b.z + step.z, -bound, bound);
  for(const key of ['head', 'left', 'right']) b[key] = {...b.target[key]};
  // Locomotion moves the rig on the client; the tracked pose already includes it after the round trip.
  // Apply this tick's movement to the pose so the body sweep sees the current position.
  if(step.x || step.z) for(const key of ['head', 'left', 'right']) b[key] = add(b[key], step);
 }else if(room.bossClient && b.desktop){
  const i = room.time - b.lastInput < .45 ? b.input : noInput(); b.yaw = i.yaw;
  const dir = rotateYaw(v(i.x, 0, i.z), b.yaw); b.x = clamp(b.x + dir.x * C.GIANT_SPEED * C.TICK * slow, -bound, bound); b.z = clamp(b.z + dir.z * C.GIANT_SPEED * C.TICK * slow, -bound, bound);
  b.head = v(b.x, 23.8, b.z); let l = v(-5.6, 15.5, -4), r = v(5.6, 15.5, -4);
  if(i.fire){ const phase = room.time * 7, sweep = Math.sin(phase); r = v(6 * sweep, 10 + Math.cos(phase) * 5, -9 - Math.max(0, -Math.cos(phase)) * 5); }
  if(i.up > 0){ const t = Math.sin(room.time * 6); l = v(-5, 9 + t * 8, -9); r = v(5, 9 + t * 8, -9); }
  b.left = add(v(b.x, 0, b.z), rotateYaw(l, b.yaw)); b.right = add(v(b.x, 0, b.z), rotateYaw(r, b.yaw));
 }else if(!room.bossClient){
  // Clearly labelled practice/stand-in AI. It yields immediately when a headset joins.
  const theta = room.time * .12; b.x = Math.sin(theta) * 6; b.z = Math.cos(theta) * 6;
  const target = [...room.players.values()].find(p => p.body)?.body.translation();
  if(target) b.yaw = Math.atan2(b.x - target.x, b.z - target.z);
  b.head = v(b.x, 23.8 + Math.sin(room.time * .8) * .3, b.z);
  b.left = add(v(b.x, 0, b.z), rotateYaw(v(-5 + Math.sin(room.time * .7) * 7, 13 + Math.sin(room.time * 1.1) * 7, -7), b.yaw));
  b.right = add(v(b.x, 0, b.z), rotateYaw(v(5 + Math.sin(room.time * 1.25) * 9, 12 + Math.cos(room.time * 1.6) * 9, -8), b.yaw));
 }
 if(room.bossClient && !b.desktop && room.time - b.lastPose < .4 && !b.resetPose){ for(const side of ['left', 'right']) if(b.triggers?.[side] && b.aims?.[side]) launchMissile(room, side, b.aims[side]); }
 if(room.bossClient && b.desktop && room.time - b.lastInput < .45 && b.input.missile) launchMissile(room, 'right', lookDir(b.yaw, b.input.pitch));
 const canAttack = (!room.bossClient || (b.desktop ? room.time - b.lastInput < .45 : room.time - b.lastPose < .4)) && !(room.time < b.noContactUntil);
 // Raiders cannot fly through the giant's torso/head as if they were non-solid visuals.
 for(const p of room.players.values()) if(canAttack && p.body){
  const at = p.body.translation();
  for(const [center, radius] of [[b.head, 2.55], [v(b.head.x, b.head.y - 7.2, b.head.z), 4.5]]){
   if(dist(at, center) < radius){ knockdown(room, p, add(mul(norm(sub(at, center)), 13), v(0, 5, 0)), 55, -1); break; }
  }
 }
 // Stale tracking holds hands still. Never extrapolate a disconnected punch.
 for(const [idx, key, prev] of [[0, 'left', prevL], [1, 'right', prevR]]){
  const hand = room.handBodies[idx];
  for(let i = 0; i < hand.numColliders(); i++) hand.collider(i).setEnabled(canAttack);
  if(b.resetPose){ hand.setTranslation(b[key], true); hand.setNextKinematicTranslation(b[key]); continue; }
  const collisionPrev = !b.desktop && b.turnDelta ? add(b.head, rotateYaw(sub(prev, b.head), b.turnDelta)) : prev;
  const displacement = sub(b[key], collisionPrev), speed = Math.min(C.MAX_HAND_SPEED, len(displacement) / C.TICK);
  if(!b.desktop && Math.abs(b.turnDelta || 0) > .001) hand.setTranslation(collisionPrev, true);
  hand.setNextKinematicTranslation(b[key]);
  if(!canAttack) continue;
  for(const p of room.players.values()) if(p.body){
   const at = p.body.translation(), relative = len(sub(mul(displacement, 1 / C.TICK), p.body.linvel())), gap = segmentDistance(at, collisionPrev, b[key]);
   if(relative > 4 && gap < C.HAND_RADIUS + .65){
    const direction = speed > 3 ? norm(displacement) : norm(sub(at, b[key])); const kick = add(mul(direction, clamp(speed * .65, 8, 35)), v(0, 6, 0)); knockdown(room, p, kick, 25 + speed * 1.15, -1);
   }else if(speed > 9 && gap < C.HAND_RADIUS + 3.4 && room.time - p.closeCallAt > 2.5 && !p.bot){
    p.closeCallAt = room.time; p.fuel = Math.min(1, p.fuel + .18); room.event({type:'closecall', player:p.id, p:arr(at)});
   }
  }
  // Swept volume avoids tunnelling through storeys between network pose samples.
  if(speed >= 3){
   const hit = [], pad = C.HAND_RADIUS * .8;
   for(const bi of buildingsAlong(room, collisionPrev, b[key], C.HAND_RADIUS)){
    for(const c of room.cellsByBuilding[bi]){
     if(room.detached.has(c.id) || room.time - c.lastHit <= .28 || !segmentAABB(collisionPrev, b[key], vec(c.p), mul(vec(c.size), .5), pad)) continue;
     c.lastHit = room.time;
     const sides = sideBit(facingSide(c, arr(collisionPrev))) | sideBit(facingSide(c, arr(b[key])));
     if(damageCell(room, c, speed * 1.6 + 18, sides, 0)) hit.push(c.id);
     room.event({type:'strike', p:arr(add(vec(c.p), mul(norm(sub(collisionPrev, vec(c.p))), c.size[0] * .5))), material:c.material, power:Math.min(1, speed / 30), broke:c.skin.hp <= 0});
     if(hit.length >= 5) break;
    }
    if(hit.length >= 5) break;
   }
   if(hit.length){ breakCells(room, hit, mul(norm(displacement), Math.min(16, speed * .28)), {at:b[key]}); registerCombo(room, hit.length); }
  }
 }
 // The torso shoves through anything in its path; it is slow, heavy work by design.
 const moved = dist(v(b.x, 0, b.z), before) / C.TICK;
 b.pushing = false;
 if(canAttack && moved > .5){
  const hit = [];
  for(const c of cellsNear(room, v(b.x, 12, b.z), C.GIANT_BODY_RADIUS + 4)){
   if(c.p[1] > b.head.y - 1 || c.p[1] < 0) continue;
   const dx = Math.abs(c.p[0] - b.x) - c.size[0] / 2, dz = Math.abs(c.p[2] - b.z) - c.size[2] / 2;
   if(Math.max(dx, 0) ** 2 + Math.max(dz, 0) ** 2 > C.GIANT_BODY_RADIUS ** 2) continue;
   b.pushing = true;
   if(room.time - c.lastHit <= .28) continue;
   c.lastHit = room.time;
   if(damageCell(room, c, 14 + moved * 3, ALL_SIDES, 0)) hit.push(c.id);
   room.event({type:'strike', p:c.p, material:c.material, power:.5, broke:c.skin.hp <= 0});
   if(hit.length >= 6) break;
  }
  if(hit.length){ breakCells(room, hit, mul(norm(sub(v(b.x, 0, b.z), before)), 6), {at:v(b.x, 6, b.z)}); registerCombo(room, hit.length); }
 }
 b.stepDistance += moved * C.TICK;
 if(b.stepDistance > 7){ b.stepDistance = 0; room.event({type:'stomp', p:[b.x, 0, b.z]}); }
 b.resetPose = false; b.turnDelta = 0;
}
export function registerCombo(room, n){
 const b = room.boss;
 b.combo = room.time - b.comboAt < 2.6 ? b.combo + n : n; b.comboAt = room.time;
 if(b.combo >= 3) room.event({type:'combo', n:b.combo});
}
