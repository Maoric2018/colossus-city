// On-screen controls for phones and tablets. This module owns every touch widget and all
// pointer bookkeeping; it writes into `Input.touch` and mutates `input.yaw/pitch`, so the
// packet, prediction and camera paths downstream are identical to mouse and keyboard.
import {state, $} from './state.js';
import {clamp} from '../../shared/math.js';
const LOOK = .0045, STICK = 56, BOOST_AT = .86, PITCH = 1.25;
// [css id, label, kind, action]. hold = while pressed, tap = one press, toggle = latched,
// aim = held AND steers, so the firing thumb can keep aiming without a second finger.
const PADS = {
 raider:[['fire', 'FIRE', 'aim', 'fire'], ['thrust', 'THRUST', 'hold', 'up'], ['soar', 'SOAR', 'toggle', 'soar'], ['dodge', 'DODGE', 'tap', 'dodge'], ['heavy', 'BREACH', 'tap', 'heavy']],
 boss:[['fire', 'SWEEP', 'aim', 'fire'], ['thrust', 'SLAM', 'hold', 'up'], ['soar', 'MISSILE', 'hold', 'missile']],
 spectator:[['thrust', 'UP', 'hold', 'up'], ['soar', 'DOWN', 'hold', 'down']]
};
export class TouchControls {
 constructor(input, hooks = {}){
  this.input = input; this.hooks = hooks; this.pointers = new Map(); this.layer = $('touch-layer');
  this.stick = null; this.knob = null; this.bound = false;
  input.onRelease = () => this.release();
 }
 install(role){
  this.layer.replaceChildren();
  this.stick = document.createElement('div'); this.stick.id = 'tc-stick';
  this.knob = document.createElement('i'); this.stick.append(this.knob); this.layer.append(this.stick);
  for(const [id, label, kind, action] of PADS[role] || PADS.raider){
   const b = document.createElement('button');
   b.type = 'button'; b.className = `tc-btn tc-${id}`; b.textContent = label; b.dataset.action = action; b.dataset.kind = kind;
   this.layer.append(b);
  }
  this.layer.classList.remove('hidden');
  if(!this.bound){ this.bind(); this.bound = true; }
 }
 detach(){ this.release(); this.layer.classList.add('hidden'); }
 bind(){
  const layer = this.layer;
  layer.addEventListener('pointerdown', e => this.down(e));
  layer.addEventListener('pointermove', e => this.move(e));
  for(const type of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(type, e => this.up(e));
  layer.addEventListener('contextmenu', e => e.preventDefault());
 }
 down(e){
  if(e.pointerType === 'mouse' || state.paused || !state.playing) return;
  e.preventDefault(); try{ this.layer.setPointerCapture(e.pointerId); }catch{}
  const button = e.target.closest?.('.tc-btn');
  if(button) return this.press(button, e);
  // Left of the split drives the floating stick, everything else steers the view.
  if(e.clientX < innerWidth * .45){ this.pointers.set(e.pointerId, {kind:'stick', x:e.clientX, y:e.clientY}); this.showStick(e.clientX, e.clientY, 0, 0); }
  else this.pointers.set(e.pointerId, {kind:'look', x:e.clientX, y:e.clientY});
 }
 press(button, e){
  const {action, kind} = button.dataset; button.classList.add('down');
  if(kind === 'tap'){
   this.pointers.set(e.pointerId, {kind:'button', button});
   if(action === 'dodge') this.input.dodgeSeq++;
   else if(action === 'heavy' && !this.input.fireHeavy()) this.hooks.onBlocked?.(action);
   return;
  }
  if(kind === 'toggle'){
   this.pointers.set(e.pointerId, {kind:'button', button});
   const on = !this.input.touch.soar; this.input.touch.soar = on; button.classList.toggle('on', on); this.hooks.onSoar?.(on); return;
  }
  // hold / aim both latch their action; an aim pad keeps steering while it is held.
  this.pointers.set(e.pointerId, {kind:kind === 'aim' ? 'look' : 'button', button, x:e.clientX, y:e.clientY});
  this.set(action, true);
 }
 set(action, on){
  const t = this.input.touch;
  if(action === 'up') t.up = on ? 1 : 0;
  else if(action === 'down') t.up = on ? -1 : 0;
  else if(action === 'fire') t.fire = on;
  else if(action === 'missile') t.missile = on;
 }
 move(e){
  const p = this.pointers.get(e.pointerId); if(!p) return;
  e.preventDefault();
  if(p.kind === 'stick'){
   const dx = e.clientX - p.x, dy = e.clientY - p.y, length = Math.hypot(dx, dy) || 1, pull = Math.min(1, length / STICK);
   const t = this.input.touch; t.x = dx / length * pull; t.z = dy / length * pull; t.boost = pull > BOOST_AT;
   this.showStick(p.x, p.y, t.x * STICK, t.z * STICK);
   this.stick.classList.toggle('boost', t.boost);
  }else if(p.kind === 'look'){
   this.input.yaw -= (e.clientX - p.x) * LOOK;
   this.input.pitch = clamp(this.input.pitch - (e.clientY - p.y) * LOOK, -PITCH, PITCH);
   p.x = e.clientX; p.y = e.clientY;
  }
 }
 up(e){
  const p = this.pointers.get(e.pointerId); if(!p) return;
  this.pointers.delete(e.pointerId);
  if(p.kind === 'stick'){ const t = this.input.touch; t.x = 0; t.z = 0; t.boost = false; this.stick.classList.remove('on', 'boost'); }
  if(p.button){ p.button.classList.remove('down'); const {action, kind} = p.button.dataset; if(kind === 'hold' || kind === 'aim') this.set(action, false); }
 }
 // Called on blur, tab hide and Input.reset(): drop every finger and un-latch every widget.
 release(){
  for(const p of this.pointers.values()) p.button?.classList.remove('down');
  this.pointers.clear();
  const t = this.input?.touch; if(t){ t.x = 0; t.z = 0; t.up = 0; t.fire = false; t.boost = false; t.missile = false; t.soar = false; }
  this.stick?.classList.remove('on', 'boost');
  for(const b of this.layer?.querySelectorAll('.tc-btn.on') || []) b.classList.remove('on');
 }
 showStick(x, y, kx, ky){
  this.stick.classList.add('on'); this.stick.style.transform = `translate(${x}px,${y}px)`; this.knob.style.transform = `translate(${kx}px,${ky}px)`;
 }
}
