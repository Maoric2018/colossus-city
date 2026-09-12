// Raider flight (shared model), giant missiles and raider rockets.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C, group} from '../shared/config.js';
import {v, add, sub, mul, norm, dist, arr, vec, clamp, raySphere, lookDir} from '../shared/math.js';
import {flightStep, flightRotation} from '../shared/flight.js';
import {damageSphere, breakCells} from './destruction.js';
const G = C.COLLISION;
export function fly(room, p, i){
 const at = p.body.translation(), lv = p.body.linvel();
 const {velocity, dodge} = flightStep(p, at, lv, i, room.time);
 if(dodge) room.event({type:'dodge', player:p.id, p:arr(at), direction:arr(dodge.direction)});
 p.body.setLinvel(velocity, true);
 // Rotate the capsule with the prone pilot, keeping visible and physical bodies aligned.
 p.body.collider(0).setRotation(flightRotation(p, i));
}
// owner 0 is the giant; any other value is the raider who fired.
function spawnMissile(room, origin, direction, owner){
 const id = room.nextMissile++;
 const missile = {id, p:origin, origin:arr(origin), direction:arr(direction), born:room.time, life:C.MISSILE_LIFETIME, owner};
 room.missiles.set(id, missile); room.event({type:'missile', ...missile, p:arr(origin)}); return true;
}
export function launchMissile(room, side, aim){
 const b = room.boss; if(room.phase || room.time < b.missileReady || room.missiles.size >= C.MAX_MISSILES) return false;
 const direction = norm(aim); b.missileReady = room.time + C.MISSILE_COOLDOWN;
 return spawnMissile(room, add(b[side], mul(direction, C.HAND_RADIUS + .5)), direction, 0);
}
// Raider shoulder rocket. The server owns the cooldown and the thrust debit.
export function launchRocket(room, p){
 if(room.phase || !p.body || p.hp <= 0 || room.time < p.rocketReady || p.fuel < C.ROCKET_FUEL || room.missiles.size >= C.MAX_MISSILES) return false;
 const direction = lookDir(p.input.aimYaw ?? p.input.yaw, p.input.aimPitch ?? p.input.pitch);
 p.rocketReady = room.time + C.ROCKET_COOLDOWN; p.fuel -= C.ROCKET_FUEL;
 return spawnMissile(room, add(add(p.body.translation(), v(0, .5, 0)), mul(direction, 1.4)), direction, p.id);
}
export function updateMissiles(room){
 const b = room.boss;
 for(const [id, m] of room.missiles){
  const direction = vec(m.direction), travel = C.MISSILE_SPEED * C.TICK;
  let distance = travel, hit = room.time - m.born >= m.life;
  const obstruction = room.world.castRay(new RAPIER.Ray(m.p, direction), travel, true, undefined, group(G.WORLD, G.WORLD | G.DEBRIS | G.PLAYER));
  // A rocket never detonates on the pilot who fired it.
  if(obstruction && room.colliderTags.get(obstruction.collider.handle)?.player !== m.owner){ distance = obstruction.timeOfImpact ?? obstruction.toi; hit = true; }
  // The giant's head and core are server-side spheres, not physics bodies.
  if(m.owner) for(const [center, radius] of [[b.head, C.HEAD_RADIUS], [v(b.head.x, b.head.y - 7.2, b.head.z), 4.1]]){
   const t = raySphere(m.p, direction, center, radius); if(t < distance){ distance = t; hit = true; }
  }
  m.p = add(m.p, mul(direction, distance));
  if(m.p.y < 0 || Math.hypot(m.p.x, m.p.z) > room.env.half + 40) hit = true;
  if(!hit) continue;
  room.missiles.delete(id); room.event({type:'detonate', id, p:arr(m.p), owner:m.owner});
  const radius = m.owner ? C.ROCKET_RADIUS : C.MISSILE_RADIUS;
  if(m.owner){
   // Raider rockets never hurt the squad; a near miss still batters the giant.
   const core = v(b.head.x, b.head.y - 7.2, b.head.z), gap = Math.min(dist(m.p, b.head) - C.HEAD_RADIUS, dist(m.p, core) - 4.1);
   if(gap < radius) room.hurtBoss(C.ROCKET_GIANT_DAMAGE * clamp(1 - gap / radius, .3, 1), {kind:'rocket', p:arr(m.p), power:.7, by:m.owner});
  }else for(const p of room.players.values()) if(p.body && room.time >= p.invulnerable){
   const at = p.body.translation(), d = dist(at, m.p); if(d > radius) continue;
   const toward = norm(sub(at, m.p)), wall = room.world.castRay(new RAPIER.Ray(add(m.p, mul(toward, .08)), toward), Math.max(0, d - .45), true, undefined, group(G.GIANT, G.WORLD | G.DEBRIS));
   if(wall) continue;
   room.knockdown(p, add(mul(toward, 16 * (1 - d / radius)), v(0, 5, 0)), 85 * (1 - d / (radius * 1.25)), -1);
  }
  const broken = damageSphere(room, m.p, radius, m.owner ? C.ROCKET_ENERGY : C.MISSILE_ENERGY, m.owner || 0, 6);
  if(broken.length) breakCells(room, broken, mul(direction, 12), {at:m.p});
 }
}
