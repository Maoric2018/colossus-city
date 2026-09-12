// Raider flight (shared model) and giant missiles.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C, group} from '../shared/config.js';
import {lookDir,v, add, sub, mul, norm, dist, arr, vec, clamp} from '../shared/math.js';
import {blastCars} from './cars.js';
import {flightStep, flightRotation} from '../shared/flight.js';
import {damageSphere, breakCells} from './destruction.js';
import {breachBuildings} from './soar-breach.js';
const G = C.COLLISION;
export function fly(room, p, i){
 const at = p.body.translation(), lv = p.body.linvel();
 const {velocity, dodge, enteredSoar} = flightStep(p, at, lv, i, room.time);
 if(enteredSoar)room.event({type:'soar-start',player:p.id,p:arr(at),direction:arr(lookDir(i.yaw,i.pitch))});
 if(dodge) room.event({type:'dodge', player:p.id, p:arr(at), direction:arr(dodge.direction)});
 const moving=!!(i.x||i.z||i.up||i.boost||p.soaring||dodge);
 p.body.setLinvel(velocity,moving);
 // Rotate the capsule with the prone pilot, keeping visible and physical bodies aligned.
 const q=flightRotation(p,i),previous=p.colliderRotation;
 if(!previous||q.x!==previous.x||q.y!==previous.y||q.z!==previous.z||q.w!==previous.w){p.body.collider(0).setRotationWrtParent(q);p.colliderRotation=q;room.world.invalidateSceneQueries();}
 breachBuildings(room,p,i,velocity);
}
export function launchMissile(room, side, aim){
 const b = room.boss; if(room.phase || room.time < b.missileReady || room.missiles.size >= C.MAX_MISSILES) return false;
 const direction = norm(aim), origin = add(b[side], mul(direction, C.HAND_RADIUS + .5)), id = room.nextMissile++;
 const missile = {id, p:origin, origin:arr(origin), direction:arr(direction), born:room.time, time:room.time, life:C.MISSILE_LIFETIME};
 room.missiles.set(id, missile); b.missileReady = room.time + C.MISSILE_COOLDOWN; room.event({type:'missile', ...missile, p:arr(origin)}); return true;
}
export function updateMissiles(room){
 for(const [id, m] of room.missiles){
  const direction = steerMissile(room,m), travel = C.MISSILE_SPEED * C.TICK; let distance = travel, hit = room.time - m.born >= m.life;
  const obstruction = room.world.castRay(new RAPIER.Ray(m.p, direction), travel, true, undefined, group(G.WORLD, G.WORLD | G.DEBRIS | G.PLAYER));
  if(obstruction){ distance = obstruction.timeOfImpact ?? obstruction.toi; hit = true; }
  m.p = add(m.p, mul(direction, distance));
  if(m.p.y < 0 || (!room.env.infinite && Math.hypot(m.p.x, m.p.z) > room.env.half + 40)) hit = true;
  if(!hit){if(room.tick%3===0){m.time=room.time;room.event({type:'missile-pose',id,p:arr(m.p),direction:m.direction,time:room.time});}continue;}
  room.missiles.delete(id); room.event({type:'detonate', id, p:arr(m.p)});blastCars(room,m.p,C.MISSILE_RADIUS);
  for(const p of room.players.values()) if(p.body && room.time >= p.invulnerable){
   const at = p.body.translation(), d = dist(at, m.p); if(d > C.MISSILE_RADIUS) continue;
   const toward = norm(sub(at, m.p)), wall = room.world.castRay(new RAPIER.Ray(add(m.p, mul(toward, .08)), toward), Math.max(0, d - .45), true, undefined, group(G.GIANT, G.WORLD | G.DEBRIS));
   if(wall) continue;
   room.knockdown(p, add(mul(toward, 16 * (1 - d / C.MISSILE_RADIUS)), v(0, 5, 0)), 85 * (1 - d / (C.MISSILE_RADIUS * 1.25)), -1);
  }
  const broken = damageSphere(room, m.p, C.MISSILE_RADIUS, C.MISSILE_ENERGY, 0, 6);
  if(broken.length) breakCells(room, broken, mul(direction, 12), {at:m.p});
 }
}

export function steerMissile(room,m){
 const forward=vec(m.direction);let best=null,score=-Infinity;
 for(const p of room.players.values()){
  if(!p.body || p.hp<=0 || room.time<p.invulnerable)continue;
  const at=p.body.translation(),distance=dist(at,m.p);if(distance<1 || distance>C.MISSILE_HOMING_RANGE)continue;
  const toward=norm(sub(at,m.p)),dot=forward.x*toward.x+forward.y*toward.y+forward.z*toward.z;
  if(dot<Math.cos(C.MISSILE_HOMING_CONE))continue;
  const wall=room.world.castRay(new RAPIER.Ray(m.p,toward),Math.max(0,distance-.5),true,undefined,group(G.GIANT,G.WORLD|G.DEBRIS));if(wall)continue;
  const rank=dot-distance*.0008;if(rank>score){score=rank;best={p,at,distance};}
 }
 if(!best)return forward;
 const lead=Math.min(.45,best.distance/C.MISSILE_SPEED*.6),target=add(best.at,mul(best.p.body.linvel(),lead)),desired=norm(sub(target,m.p));
 const angle=Math.acos(clamp(forward.x*desired.x+forward.y*desired.y+forward.z*desired.z,-1,1)),step=C.MISSILE_TURN_RATE*C.TICK;
 if(angle<1e-5)return forward;
 const t=Math.min(1,step/angle),sin=Math.sin(angle),next=norm(add(mul(forward,Math.sin((1-t)*angle)/sin),mul(desired,Math.sin(t*angle)/sin)));
 m.direction=arr(next);return next;
}
