// Pure raider flight model shared by the authoritative server and client-side prediction.
// `p` is a mutable flight state {fuel, soaring, dodgeUntil, dodgeReady, dodgeDirection,
// lastDodgeSeq}; `pos`/`vel` are the current body position and velocity. Returns the
// velocity to apply this tick and any dodge event that fired.
import {C} from './config.js';
import {v, add, mul, len, norm, clamp, rotateYaw, lookDir} from './math.js';
export function flightStep(p, pos, vel, i, time){
 let movement = i.world ? v(i.x, 0, i.z) : rotateYaw(v(i.x, 0, i.z), i.yaw);
 if(len(movement) > 1) movement = norm(movement);
 const wasSoaring=!!p.soaring;
 p.soaring = !!i.soar && pos.y > 2;
 let dodge = null;
 if(i.dodge > p.lastDodgeSeq){
  p.lastDodgeSeq = i.dodge;
  if(time >= p.dodgeReady && p.fuel >= C.DODGE_FUEL){
   let dir = rotateYaw(v(i.x, i.up, i.z), i.yaw);
   if(len(dir) < .1) dir = lookDir(i.yaw, p.soaring ? i.pitch : 0);
   p.dodgeDirection = norm(dir); p.dodgeUntil = time + C.DODGE_SECONDS; p.dodgeReady = time + C.DODGE_COOLDOWN; p.fuel -= C.DODGE_FUEL;
   dodge = {direction:p.dodgeDirection};
  }
 }
 const boosted = i.boost && (p.soaring || p.fuel > .02), air = i.up > 0 && p.fuel > 0;
 let desired = mul(movement, boosted ? C.BOOST_SPEED : C.PLAYER_SPEED);
 desired.y = air ? C.ASCEND_SPEED * i.up : i.up < 0 ? -10 : pos.y > 2 ? -2.3 : vel.y;
 if(p.soaring){
  const aim = lookDir(i.yaw, clamp(i.pitch, -1, 1)), strafe = rotateYaw(v(i.x * .4, i.up * .3, 0), i.yaw);
  const speed = (boosted ? C.SOAR_BOOST_SPEED : C.SOAR_SPEED) * (i.z > 0 ? .55 : 1);
  desired = mul(norm(add(aim, strafe)), speed);
 }
 const dodging = time < p.dodgeUntil;
 const a = 1 - Math.exp(-C.TICK * (p.soaring ? 4.5 : 6)), av = air || pos.y > 2 ? .12 : 0;
 const velocity = dodging ? mul(p.dodgeDirection, C.DODGE_SPEED)
  : v(vel.x + (desired.x - vel.x) * a, vel.y + (desired.y - vel.y) * (p.soaring ? a : av), vel.z + (desired.z - vel.z) * a);
 if(pos.y > C.MAX_ALTITUDE) velocity.y = Math.min(velocity.y, -4);
 // Midtown towers reach 120 m: a full tank of hover thrust must climb most of one.
 const burn = p.soaring ? 0 : boosted ? -.14 : air ? -C.ASCEND_BURN : (pos.y < 2 ? .48 : .16);
 p.fuel = clamp(p.fuel + burn * C.TICK, 0, 1);
 return {velocity, dodge, enteredSoar:p.soaring&&!wasSoaring};
}
// Capsule orientation for the prone soaring pose; shared so the render and the collider agree.
export function flightRotation(p, i){
 const halfPitch = p.soaring ? (-Math.PI / 2 + clamp(i.pitch, -1, 1)) / 2 : 0;
 const sy = Math.sin(i.yaw / 2), cy = Math.cos(i.yaw / 2), sx = Math.sin(halfPitch), cx = Math.cos(halfPitch);
 return {x:cy * sx, y:sy * cx, z:-sy * sx, w:cy * cx};
}
