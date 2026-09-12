// Keyboard/mouse capture and input packets. Sequence counters (dodge, heavy) increase only on
// discrete presses so a held key or resent packet can never repeat an ability on the server.
import {C} from '../../shared/config.js';
import {clamp} from '../../shared/math.js';
import {state, $} from './state.js';
export class Input {
 constructor(canvas, hooks = {}){
  this.canvas = canvas; this.hooks = hooks; this.keys = new Set(); this.firing = false; this.missileFiring = false; this.yaw = 0; this.pitch = 0; this.seq = 0; this.dodgeSeq = 0; this.heavySeq = 0; this.soar = false; this.chargeStart = 0; this.heavyReadyAt = 0;
 }
 bind(){
  window.addEventListener('keydown', e => {
   if(!state.playing || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
   if(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
   if(!state.paused && state.role === 'raider' && ['ShiftLeft','ShiftRight'].includes(e.code) && !this.soar){ this.soar = true; this.hooks.onSoar?.(true); }
   if(!state.paused && state.role === 'raider' && e.code === 'KeyE' && !e.repeat) this.dodgeSeq++;
   if(e.code === 'KeyV' && !e.repeat) this.hooks.onCamera?.();
   if(e.code === 'KeyQ' && !e.repeat) this.hooks.onQuality?.();
   if(e.code === 'Tab'){ e.preventDefault(); this.hooks.onScoreboard?.(true); }
   if(!state.paused) this.keys.add(e.code);
  });
  window.addEventListener('keyup', e => { this.keys.delete(e.code); if(this.soar && !this.keys.has('ShiftLeft') && !this.keys.has('ShiftRight')){ this.soar = false; this.hooks.onSoar?.(false); } if(e.code === 'Tab') this.hooks.onScoreboard?.(false); });
  window.addEventListener('blur', () => this.reset()); document.addEventListener('visibilitychange', () => { if(document.hidden) this.reset(); });
  window.addEventListener('mousemove', e => { if(document.pointerLockElement === this.canvas && !state.paused){ this.yaw -= e.movementX * .0021; this.pitch = clamp(this.pitch - e.movementY * .0021, -1.25, 1.25); } });
  this.canvas.addEventListener('contextmenu', e => { if(state.playing) e.preventDefault(); });
  window.addEventListener('mousedown', e => {
   if(document.pointerLockElement !== this.canvas || state.paused) return;
   if(e.button === 0) this.firing = true;
   if(e.button === 2){ if(state.role === 'boss') this.missileFiring = true; else if(state.role === 'raider' && performance.now() >= this.heavyReadyAt){ this.chargeStart = performance.now(); this.hooks.onChargeStart?.(); } }
  });
  window.addEventListener('mouseup', e => {
   if(e.button === 0) this.firing = false;
   if(e.button === 2){ this.missileFiring = false; if(this.chargeStart){ const held = (performance.now() - this.chargeStart) / 1000; this.chargeStart = 0; if(held >= C.HEAVY_CHARGE_SECONDS){ this.heavySeq++; this.heavyReadyAt = performance.now() + C.HEAVY_COOLDOWN * 1000; this.hooks.onHeavyFire?.(); } else this.hooks.onChargeCancel?.(); } }
  });
 }
 // 0..1 while charging the breach shot.
 get charge(){ return this.chargeStart ? Math.min(1, (performance.now() - this.chargeStart) / 1000 / C.HEAVY_CHARGE_SECONDS) : 0; }
 reset(){ this.soar = false; this.keys.clear(); this.firing = false; this.missileFiring = false; this.chargeStart = 0; }
 // Current held state in the shared input shape (used by prediction every frame).
 held(){
  const k = this.keys;
  return {x:(k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), z:(k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0), up:(k.has('Space') ? 1 : 0) - (k.has('KeyC') ? 1 : 0),
   boost:state.role !== 'raider' && (k.has('ShiftLeft') || k.has('ShiftRight')), fire:this.firing, soar:state.role === 'raider' && (k.has('ShiftLeft') || k.has('ShiftRight')), dodge:this.dodgeSeq, heavy:this.heavySeq, missile:this.missileFiring || k.has('KeyR'), yaw:this.yaw, pitch:this.pitch};
 }
 // Network packet. `aim` converts the camera crosshair into a convergent aim for the server.
 packet(aim){
  const m = {type:'input', ...this.held(), seq:++this.seq};
  if(state.paused){ m.x = m.z = m.up = 0; m.fire = m.boost = m.soar = m.missile = false; }
  else if(state.role === 'raider' && (m.fire || this.heavySeq) && aim){ const a = aim(); if(a){ m.aimYaw = a.yaw; m.aimPitch = a.pitch; } }
  return m;
 }
 idle(){ return {x:0, z:0, up:0, boost:false, fire:false, soar:false, dodge:this.dodgeSeq, heavy:this.heavySeq, missile:false, yaw:this.yaw, pitch:this.pitch}; }
}
export function lockPointer(canvas, onFail){ try{ const p = canvas.requestPointerLock(); p?.catch?.(() => onFail?.()); }catch{ onFail?.(); } }
