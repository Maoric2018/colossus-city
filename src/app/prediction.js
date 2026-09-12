// Client-side prediction for the local raider. The shared flight model runs locally against
// the current input at 60 Hz, with simple box collision against the city; authoritative
// snapshots re-base the state and unacknowledged inputs are replayed. Visual error is smoothed.
import {C, F} from '../../shared/config.js';
import {flightStep} from '../../shared/flight.js';
import {soarBreachCells,flightHalf} from '../../shared/soar-breach.js';
import {v, add, mul, vec, clamp} from '../../shared/math.js';
const HALF = {x:.36, y:1.14, z:.36};
export class Prediction {
 constructor(cityView){ this.city = cityView; this.reset(null); }
 reset(player){
  this.state = {fuel:player?.fuel ?? 1, soaring:false, dodgeUntil:0, dodgeReady:0, dodgeDirection:v(0, 0, -1), lastDodgeSeq:0};
  this.pos = player ? vec(player.p) : v(0, 2, 0); this.vel = player ? vec(player.v) : v(); this.time = 0; this.accumulator = 0;
  this.history = []; this.error = v(); this.active = !!player; this.lastSeq = player?.seq || 0; this.grounded = false;
 }
 // Advance by a frame with the input currently held. `seq` identifies the packet that carries it.
 advance(input, dt, seq, serverTime){
  if(!this.active) return;
  this.accumulator += Math.min(dt, .1);
  while(this.accumulator >= C.TICK){
   this.accumulator -= C.TICK; this.time = serverTime;
   this.simulate(input); this.history.push({seq, input, snapshot:null});
   if(this.history.length > 90) this.history.shift();
  }
  // Visual error correction decays exponentially so corrections read as a nudge, not a snap.
  const k = 1 - Math.exp(-dt * 9); this.error = mul(this.error, 1 - k);
 }
 simulate(input){
  const {velocity} = flightStep(this.state, this.pos, this.vel, input, this.time + this.accumulator);
  const breached=this.state.soaring?new Set(soarBreachCells(this.state,this.pos,velocity,input,this.city?.handWorld)):undefined;
  this.vel = velocity; this.vel.y += C.GRAVITY * C.TICK;
  this.pos = add(this.pos, mul(this.vel, C.TICK));
  this.collide(this.state.soaring?flightHalf(this.state,input):HALF,breached);
 }
 collide(half=HALF,ignoredCells){
  const p = this.pos;
  if(p.y < half.y){ p.y = half.y; if(this.vel.y < 0) this.vel.y = 0; this.grounded = true; } else this.grounded = false;
  // Push out of nearby structural boxes along the least-penetration axis.
  for(let iteration = 0; iteration < 3; iteration++){
   const box = this.city?.overlapBox?.(p, half,ignoredCells); if(!box) break;
   const dx = box.half.x + half.x - Math.abs(p.x - box.center.x), dy = box.half.y + half.y - Math.abs(p.y - box.center.y), dz = box.half.z + half.z - Math.abs(p.z - box.center.z);
   if(dx <= 0 || dy <= 0 || dz <= 0) break;
   if(dx < dy && dx < dz){ p.x += Math.sign(p.x - box.center.x) * dx; this.vel.x *= .05; }
   else if(dy < dz){ p.y += Math.sign(p.y - box.center.y) * dy; this.vel.y = 0; if(p.y > box.center.y) this.grounded = true; }
   else { p.z += Math.sign(p.z - box.center.z) * dz; this.vel.z *= .05; }
  }
 }
 // Authoritative state for the local player; replay inputs the server has not consumed yet.
 reconcile(server, latency){
  if(!server) return;
  if(server.flags & (F.RAG | F.DEAD)){ this.active = false; return; }
  if(!this.active){ this.reset(server); return; }
  const predictedBefore = {...this.pos};
  this.pos = vec(server.p); this.vel = vec(server.v); this.state.fuel = server.fuel; this.state.soaring = !!(server.flags & F.SOAR);
  const pending = this.history.filter(h => h.seq > server.seq); this.history = pending;
  for(const h of pending) this.simulate(h.input);
  // Whatever the replay could not explain becomes a smoothed visual offset.
  const errorX = predictedBefore.x - this.pos.x, errorY = predictedBefore.y - this.pos.y, errorZ = predictedBefore.z - this.pos.z;
  const size = Math.hypot(errorX, errorY, errorZ);
  this.error = size > 6 ? v() : v(clamp(this.error.x + errorX, -3, 3), clamp(this.error.y + errorY, -3, 3), clamp(this.error.z + errorZ, -3, 3));
 }
 // Rendered position: predicted state plus the decaying correction offset.
 position(){ return add(this.pos, this.error); }
 velocity(){ return this.vel; }
}
