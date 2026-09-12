// Desktop cameras: predicted third/first-person raider, dead-reckoned desktop giant, free
// spectator flight and the lobby orbit. Shake is applied here and never in XR.
import * as T from 'three';
import {C, F} from '../../shared/config.js';
import {clamp, rotateYaw} from '../../shared/math.js';
import {state, me} from './state.js';
const up = new T.Vector3(0, 1, 0), back = new T.Vector3(), desired = new T.Vector3();
export class CameraRig {
 constructor(camera, rig, city, shake, prediction){
  this.camera = camera; this.rig = rig; this.city = city; this.shake = shake; this.prediction = prediction; this.pos = new T.Vector3(0, 4, 63); this.giant = new T.Vector3(); this.giantVel = new T.Vector3();
 }
 reset(spawn){ this.pos.set(spawn[0], spawn[1] + 3, spawn[2] + 6); this.giant.set(0, 0, 0); }
 update(dt, s, {input, net}){
  const rig = this.rig, camera = this.camera; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1);
  const yaw = input.yaw, pitch = input.pitch, held = input.held(), pilot = me(s);
  if(state.role === 'spectator'){
   const dir = new T.Vector3(held.x, held.up, held.z).applyAxisAngle(up, yaw); this.pos.addScaledVector(dir, dt * (held.boost ? 60 : 26)); desired.copy(this.pos);
  }else if(state.role === 'boss'){
   // Dead reckoning: the server head lags by interpolation + RTT; lead it by the held input.
   const lead = net.lead + C.INTERPOLATION_MS / 1000, dir = rotateYaw({x:held.x, y:0, z:held.z}, yaw), len = Math.hypot(dir.x, dir.z) || 1;
   const speed = (s.bossBlocked ? 0 : C.GIANT_SPEED) * (1 - (s.bossStagger || 0) * .6);
   desired.set(s.head[0] + dir.x / len * speed * lead * (len > .1 ? 1 : 0), s.head[1] + 1.8, s.head[2] + dir.z / len * speed * lead * (len > .1 ? 1 : 0) + .3);
   this.pos.lerp(desired, 1 - Math.exp(-dt * 10));
  }else{
   if(!pilot) return;
   const ragged = !!(pilot.flags & (F.RAG | F.DEAD));
   let px, py, pz;
   if(this.prediction.active && !ragged){ const p = this.prediction.position(); px = p.x; py = p.y; pz = p.z; }
   else { const latest = net.latest?.players.find(p => p.id === state.localId) || pilot, lead = ragged ? 0 : Math.min(net.lead, .075); px = latest.p[0] + latest.v[0] * lead; py = latest.p[1] + latest.v[1] * lead; pz = latest.p[2] + latest.v[2] * lead; }
   desired.set(px, py + .5, pz);
   if(!state.firstPerson){ back.set(1.15, 1.15, (pilot.flags & F.SOAR) ? 8.2 : 6.8).applyEuler(new T.Euler(pitch, yaw, 0, 'YXZ')); const distance = back.length(); back.normalize(); const safe = this.city.rayDistance(desired, back, distance, .25); desired.addScaledVector(back, Math.max(0, safe - .18)); }
   this.pos.lerp(desired, 1 - Math.exp(-dt * (ragged ? 5 : 30))); if(this.pos.y < .35) this.pos.y = .35;
  }
  camera.position.copy(this.pos); camera.rotation.order = 'YXZ';
  const fast = state.role === 'raider' && !!(pilot?.flags & F.SOAR), dodging = state.role === 'raider' && !!(pilot?.flags & F.DODGE), charge = state.role === 'raider' ? input.charge : 0;
  const flightFov = fast ? 100 : 72, targetFov = dodging ? Math.max(94, flightFov + 8) : flightFov;
  camera.fov += (targetFov - charge * 8 - camera.fov) * (1 - Math.exp(-dt * 6)); camera.updateProjectionMatrix();
  const bank = fast && pilot ? clamp((pilot.v[0] * Math.cos(yaw) - pilot.v[2] * Math.sin(yaw)) * .006, -.11, .11) : 0;
  const shake = this.shake.update(dt);
  camera.rotation.set(pitch + shake.y, yaw + shake.x, -bank + shake.roll, 'YXZ');
 }
 intro(now, env){
  const t = now * .0001, r = env.half * .95;
  this.camera.position.set(Math.sin(t) * r * .55 + 40, 62 + Math.cos(t * .5) * 8, Math.cos(t) * r * .55 + 90); this.camera.lookAt(-10, 34, -20);
 }
 finale(dt,result){
  const camera=this.camera,head=new T.Vector3(...result.pose.head),target=head.clone().add(new T.Vector3(0,-9,0));
  this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);this.rig.scale.setScalar(1);
  if(this.endShot?.round!==result.round){
   const from=camera.position.clone().sub(target);if(Math.hypot(from.x,from.z)<10)from.set(Math.sin(result.pose.bossYaw||0)*45,0,Math.cos(result.pose.bossYaw||0)*45);
   const yaw=Math.atan2(from.x,from.z);let best=null;
   // Find a clear sightline through the nearby streets before pulling back.
   for(const offset of [0,.55,-.55,1.1,-1.1,Math.PI]){
    const dir=new T.Vector3(Math.sin(yaw+offset)*48,22,Math.cos(yaw+offset)*48),distance=dir.length();dir.normalize();
    const safe=this.city.rayDistance(target,dir,distance,.5),score=safe-Math.abs(offset)*3;
    if(!best||score>best.score)best={score,position:target.clone().addScaledVector(dir,Math.max(8,safe-.8))};
   }
   this.endShot={round:result.round,position:best.position};
  }
  camera.position.lerp(this.endShot.position,1-Math.exp(-dt*3.5));this.pos.copy(camera.position);
  const previous=camera.quaternion.clone();camera.lookAt(target);camera.quaternion.copy(previous.slerp(camera.quaternion,1-Math.exp(-dt*5)));
  camera.fov+=(67-camera.fov)*(1-Math.exp(-dt*5));camera.updateProjectionMatrix();
  const shake=this.shake.update(dt);camera.rotateX(shake.y);camera.rotateY(shake.x);
 }
}
