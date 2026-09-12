// Keyboard/mouse capture and input packets. Sequence counters (dodge, rocket) increase only on
// discrete presses so a held key or resent packet can never repeat an ability on the server.
import {clamp} from '../../shared/math.js';
import {state, $} from './state.js';
export class Input {
 constructor(canvas, hooks = {}){
  this.canvas = canvas; this.hooks = hooks; this.keys = new Set(); this.firing = false; this.missileFiring = false; this.yaw = 0; this.pitch = 0; this.seq = 0; this.dodgeSeq = 0; this.rocketSeq = 0; this.soar = false;
 }
 bind(){
  window.addEventListener('keydown', e => {
   if(!state.playing || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
   if(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
   if(!state.paused && state.role === 'raider' && e.code === 'KeyF' && !e.repeat){ this.soar = !this.soar; this.hooks.onSoar?.(this.soar); }
   if(!state.paused && state.role === 'raider' && e.code === 'KeyE' && !e.repeat) this.dodgeSeq++;
   if(e.code === 'KeyV' && !e.repeat) this.hooks.onCamera?.();
   if(e.code === 'KeyQ' && !e.repeat) this.hooks.onQuality?.();
   if(e.code === 'Tab'){ e.preventDefault(); this.hooks.onScoreboard?.(true); }
   if(!state.paused) this.keys.add(e.code);
  });
  window.addEventListener('keyup', e => { this.keys.delete(e.code); if(e.code === 'Tab') this.hooks.onScoreboard?.(false); });
  window.addEventListener('blur', () => this.reset()); document.addEventListener('visibilitychange', () => { if(document.hidden) this.reset(); });
  window.addEventListener('mousemove', e => { if(document.pointerLockElement === this.canvas && !state.paused){ this.yaw -= e.movementX * .0021; this.pitch = clamp(this.pitch - e.movementY * .0021, -1.25, 1.25); } });
  this.canvas.addEventListener('contextmenu', e => { if(state.playing) e.preventDefault(); });
  window.addEventListener('mousedown', e => {
   if(document.pointerLockElement !== this.canvas || state.paused) return;
   if(e.button === 0) this.firing = true;
   // Right click: the giant holds for missiles, a raider fires one rocket per press.
   if(e.button === 2){ if(state.role === 'boss') this.missileFiring = true; else if(state.role === 'raider'){ this.rocketSeq++; this.hooks.onRocket?.(); } }
  });
  window.addEventListener('mouseup', e => { if(e.button === 0) this.firing = false; if(e.button === 2) this.missileFiring = false; });
 }
 reset(){ this.keys.clear(); this.firing = false; this.missileFiring = false; }
 // Current held state in the shared input shape (used by prediction every frame).
 held(){
  const k = this.keys;
  return {x:(k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), z:(k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0), up:(k.has('Space') ? 1 : 0) - (k.has('KeyC') ? 1 : 0),
   boost:k.has('ShiftLeft') || k.has('ShiftRight'), fire:this.firing, soar:this.soar, dodge:this.dodgeSeq, rocket:this.rocketSeq, missile:this.missileFiring || k.has('KeyR'), yaw:this.yaw, pitch:this.pitch};
 }
 // Network packet. `aim` converts the camera crosshair into a convergent aim for the server.
 packet(aim){
  const m = {type:'input', ...this.held(), seq:++this.seq};
  if(state.paused){ m.x = m.z = m.up = 0; m.fire = m.boost = m.soar = m.missile = false; }
  else if(state.role === 'raider' && (m.fire || this.rocketSeq) && aim){ const a = aim(); if(a){ m.aimYaw = a.yaw; m.aimPitch = a.pitch; } }
  return m;
 }
 idle(){ return {x:0, z:0, up:0, boost:false, fire:false, soar:this.soar, dodge:this.dodgeSeq, rocket:this.rocketSeq, missile:false, yaw:this.yaw, pitch:this.pitch}; }
}
export function lockPointer(canvas, onFail){ try{ const p = canvas.requestPointerLock(); p?.catch?.(() => onFail?.()); }catch{ onFail?.(); } }
