// Raider weapons, knockdowns and ragdolls. Server-authoritative; clients only draw the results.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C, group} from '../shared/config.js';
import {v, add, sub, mul, arr, vec, clamp, quatYaw, rotateYaw, raySphere, lookDir} from '../shared/math.js';
import {damageCell, damageSphere, facingSide, removeBody, resolveCell} from './destruction.js';
import {sideBit} from '../shared/city/materials.js';
const G = C.COLLISION;
function giantTargets(b){
 return [[b.head, C.HEAD_RADIUS, 1.8], [v(b.head.x, b.head.y - 7.2, b.head.z), 4.1, 1], [b.left, C.HAND_RADIUS, .55], [b.right, C.HAND_RADIUS, .55]];
}
export function shoot(room, p){
 if(!p.body || p.hp <= 0) return;
 const origin = add(p.body.translation(), v(0, .5, 0)), direction = lookDir(p.input.aimYaw ?? p.input.yaw, p.input.aimPitch ?? p.input.pitch), b = room.boss;
 let distance = C.SHOT_RANGE, damage = 0, weak = false;
 for(const [center, radius, mult] of giantTargets(b)){
  const t = raySphere(origin, direction, center, radius); if(t < distance){ distance = t; damage = C.SHOT_DAMAGE * mult; weak = mult > 1; }
 }
 const obstruction = room.world.castRay(new RAPIER.Ray(origin, direction), distance, true, undefined, group(G.PLAYER, G.WORLD | G.DEBRIS));
 if(obstruction){
  distance = obstruction.timeOfImpact ?? obstruction.toi; damage = 0;
  const at = add(origin, mul(direction, distance)), c = resolveCell(room, room.colliderTags.get(obstruction.collider.handle), at);
  if(c && !room.detached.has(c.id)) damageCell(room, c, 6, sideBit(facingSide(c, arr(at))), p.id); // bullets only pop windows
 }
 if(damage){
  // A staggered giant has its core exposed: teamwork (rockets or falling debris) opens a damage window.
  damage *= 1 + b.stagger * .6; if(p.bot) damage *= .26;
  room.hurtBoss(damage, {kind:'shot', p:arr(add(origin, mul(direction, distance))), power:.08, by:p.id}); p.damage += damage;
 }
 room.event({type:'shot', player:p.id, from:arr(origin), to:arr(add(origin, mul(direction, distance))), hit:damage > 0, weak});
}
export function knockdown(room, p, kick, damage, by = 0){
 if(!p.body || room.time < p.invulnerable) return;
 p.hp = Math.max(0, p.hp - damage);
 const at = p.body.translation(), velocity = add(p.body.linvel(), kick);
 removeBody(room, p.body); p.body = null;
 const rag = makeRag(room, p, at, velocity); p.rag = rag.id; p.recoverAt = room.time + 2.1;
 if(p.hp <= 0){ p.deadUntil = room.time + C.RESPAWN_SECONDS; room.kills++; room.event({type:'kill', player:p.id, by}); }
 room.event({type:'impact', p:arr(at), power:.45, material:'body'});
}
export function makeRag(room, p, at, velocity){
 if(room.rags.size >= C.MAX_RAGDOLLS){ const candidate = [...room.rags.values()].find(r => ![...room.players.values()].some(p => p.rag === r.id)); if(candidate) removeRag(room, candidate.id); }
 const defs = [
  {name:'hips', o:[0, 0, 0], s:[.52, .36, .32]}, {name:'chest', o:[0, .38, 0], s:[.62, .42, .34]}, {name:'head', o:[0, .82, 0], s:[.36, .38, .36]},
  {name:'upperL', o:[-.48, .35, 0], s:[.24, .44, .24]}, {name:'lowerL', o:[-.57, -.05, 0], s:[.22, .4, .22]},
  {name:'upperR', o:[.48, .35, 0], s:[.24, .44, .24]}, {name:'lowerR', o:[.57, -.05, 0], s:[.22, .4, .22]},
  {name:'thighL', o:[-.18, -.42, 0], s:[.27, .5, .29]}, {name:'shinL', o:[-.18, -.91, 0], s:[.24, .45, .26]},
  {name:'thighR', o:[.18, -.42, 0], s:[.27, .5, .29]}, {name:'shinR', o:[.18, -.91, 0], s:[.24, .45, .26]}
 ];
 const yaw = p.input.yaw || 0, parts = defs.map((d, i) => {
  const pos = add(at, rotateYaw(vec(d.o), yaw));
  const body = room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(quatYaw(yaw)).setLinearDamping(.12).setAngularDamping(.6).setCcdEnabled(true));
  room.world.createCollider(RAPIER.ColliderDesc.cuboid(d.s[0] / 2, d.s[1] / 2, d.s[2] / 2).setMass(i === 1 ? 22 : i === 0 ? 14 : 5).setFriction(.65).setRestitution(.04).setCollisionGroups(group(G.RAGDOLL, G.WORLD | G.DEBRIS | G.GIANT)), body);
  body.setLinvel(velocity, true); body.setAngvel(v(velocity.z * .14, 0, -velocity.x * .14), true);
  return {id:room.nextRag++, body, size:d.s, offset:d.o};
 });
 const links = [[0, 1, [0, .17, 0]], [1, 2, [0, .62, 0]], [1, 3, [-.35, .53, 0]], [3, 4, [-.55, .13, 0], true], [1, 5, [.35, .53, 0]], [5, 6, [.55, .13, 0], true], [0, 7, [-.18, -.2, 0]], [7, 8, [-.18, -.67, 0], true], [0, 9, [.18, -.2, 0]], [9, 10, [.18, -.67, 0], true]];
 for(const [a, b, anchor, hinge] of links){
  const aa = sub(vec(anchor), vec(defs[a].o)), ab = sub(vec(anchor), vec(defs[b].o));
  const params = hinge ? RAPIER.JointData.revolute(aa, ab, v(1, 0, 0)) : RAPIER.JointData.spherical(aa, ab);
  const joint = room.world.createImpulseJoint(params, parts[a].body, parts[b].body, true); if(hinge) joint.setLimits(-.15, 2.2);
 }
 const rag = {id:parts[0].id, player:p.id, parts, born:room.time}; room.rags.set(rag.id, rag); room.event(ragMeta(rag)); return rag;
}
export function ragMeta(r){ return {type:'rag', id:r.id, player:r.player, parts:r.parts.map(p => { const t = p.body.translation(), q = p.body.rotation(); return {id:p.id, size:p.size, p:[t.x, t.y, t.z], q:[q.x, q.y, q.z, q.w]}; })}; }
export function removeRag(room, id){
 const r = room.rags.get(id); if(!r) return;
 for(const part of r.parts){ removeBody(room, part.body); room.event({type:'remove', id:part.id}); }
 room.rags.delete(id);
}
export {damageSphere, clamp};
