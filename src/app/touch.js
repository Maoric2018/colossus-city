// Adapted from ui/attack-on-titan. Touch writes into the same input packet and prediction
// path as desktop controls. Each finger owns its action until it releases or is cancelled.
import {C, F} from '../../shared/config.js';
import {clamp} from '../../shared/math.js';
import {state, me, $} from './state.js';
const LOOK = .0045, STICK = 56, DEAD_ZONE = .12;
const PADS = {
 raider:[['fire','FIRE','aim','fire'], ['thrust','THRUST','hold','up'], ['descend','DOWN','hold','down'], ['soar','SOAR','toggle','soar'], ['dodge','DODGE','tap','dodge'], ['heavy','BREACH','charge','heavy']],
 boss:[['fire','SWEEP','aim','fire'], ['thrust','SLAM','hold','up'], ['soar','MISSILE','hold','missile']],
 spectator:[['thrust','UP','hold','up'], ['soar','DOWN','hold','down']]
};
export class TouchControls {
 constructor(input){
  this.input = input; this.layer = $('touch-layer'); this.pointers = new Map(); this.buttons = new Map();
  this.enabled = false; this.installed = false; this.lookId = null; this.stickId = null; this.dodgeReadyAt = 0;
  input.onRelease = () => this.release();
  this.layer.addEventListener('pointerdown', e => this.down(e));
  this.layer.addEventListener('pointermove', e => this.move(e));
  for(const type of ['pointerup','pointercancel','lostpointercapture']) this.layer.addEventListener(type, e => this.up(e));
  this.layer.addEventListener('contextmenu', e => e.preventDefault());
  // Resizing changes the coordinate system under held fingers (rotation, browser chrome).
  window.addEventListener('resize', () => this.release());
 }
 install(role){
  this.release(); this.buttons.clear(); this.layer.replaceChildren(); this.installed = true; this.dodgeReadyAt = 0;
  this.stick = document.createElement('div'); this.stick.id = 'tc-stick'; this.stick.setAttribute('aria-hidden','true');
  this.knob = document.createElement('i'); this.stick.append(this.knob); this.layer.append(this.stick);
  for(const [id,label,kind,action] of PADS[role] || PADS.raider){
   const button = document.createElement('button'), status = document.createElement('small');
   button.type = 'button'; button.className = `tc-btn tc-${id}`; button.dataset.action = action; button.dataset.kind = kind;
   button.append(document.createTextNode(label), status); button.setAttribute('aria-label', `${label}${kind === 'charge' ? ': hold to charge, release to fire' : kind === 'aim' ? ': hold and drag to aim' : kind === 'toggle' ? ': toggle flight' : ''}`);
   if(kind === 'toggle') button.setAttribute('aria-pressed','false');
   // These are spatial, continuous controls; keyboard users use the existing key bindings.
   button.tabIndex = -1; this.buttons.set(action, {button,status}); this.layer.append(button);
  }
  this.update();
 }
 detach(){ this.installed = false; this.enabled = false; this.release(); this.layer.classList.add('hidden'); }
 available(){
  const pilot = me(state.current);
  return this.installed && state.playing && !!state.current && !state.paused && !state.current.phase &&
   !document.body.classList.contains('spectator-open') && !(state.role === 'raider' && (!pilot || (pilot.flags & (F.DEAD | F.RAG))));
 }
 ready(action, now = performance.now()){
  const pilot = me(state.current);
  if(action === 'heavy') return !!pilot && pilot.fuel >= C.HEAVY_FUEL && !(pilot.heavyCooldown > 0) && now >= this.input.heavyReadyAt;
  if(action === 'dodge') return !!pilot && pilot.fuel >= C.DODGE_FUEL && !(pilot.dodgeCooldown > 0) && now >= this.dodgeReadyAt;
  return true;
 }
 update(now = performance.now()){
  const enabled = this.available();
  if(enabled !== this.enabled){
   if(!enabled) this.input.reset();
   this.enabled = enabled; this.layer.classList.toggle('hidden', !enabled);
  }
  if(!enabled) return;
  const pilot = me(state.current);
  for(const [action,entry] of this.buttons){
   const {button,status} = entry;
   const charging = action === 'heavy' && !!this.input.chargeStart;
   const cooldown = action === 'heavy' ? Math.max(pilot?.heavyCooldown || 0,(this.input.heavyReadyAt-now)/1000) : action === 'dodge' ? Math.max(pilot?.dodgeCooldown || 0,(this.dodgeReadyAt-now)/1000) : 0;
   const blocked = !charging && !this.ready(action, now);
   if(entry.blocked !== blocked){ entry.blocked=blocked; button.setAttribute('aria-disabled',String(blocked)); button.classList.toggle('unavailable',blocked); }
   const text = charging ? this.input.charge >= 1 ? 'RELEASE' : `${Math.floor(this.input.charge*100)}%` : cooldown > 0 ? `${cooldown.toFixed(1)}s` : blocked ? 'LOW FUEL' : action === 'heavy' ? 'HOLD' : action === 'soar' ? this.input.touch.soar ? 'ON' : 'OFF' : '';
   if(status.textContent !== text) status.textContent = text;
   if(action === 'heavy'){
    const charge=this.input.charge.toFixed(2);
    if(entry.charge !== charge){ entry.charge=charge; button.style.setProperty('--charge',charge); }
   }
  }
 }
 down(e){
  if(e.pointerType === 'mouse' || !this.available()) return;
  e.preventDefault(); const button = e.target.closest?.('.tc-btn'), point = {x:e.clientX,y:e.clientY};
  let pointer;
  if(button){
   if([...this.pointers.values()].some(p => p.button === button) || !this.ready(button.dataset.action)) return;
   const {kind,action} = button.dataset;
   if(kind === 'charge' && !this.input.beginHeavy()) return;
   pointer = {...point,kind,action,button}; button.classList.add('down');
   if(action === 'dodge'){ this.input.dodgeSeq++; this.dodgeReadyAt = performance.now()+C.DODGE_COOLDOWN*1000; }
  }else if(e.clientX < innerWidth*.45){
   if(this.stickId !== null) return;
   pointer = {...point,kind:'stick'}; this.stickId = e.pointerId; this.showStick(point.x,point.y,0,0);
  }else pointer = {...point,kind:'look'};
  if((pointer.kind === 'aim' || pointer.kind === 'look') && this.lookId === null) this.lookId = e.pointerId;
  this.pointers.set(e.pointerId,pointer); this.layer.setPointerCapture(e.pointerId); this.syncHeld();
 }
 move(e){
  const pointer = this.pointers.get(e.pointerId); if(!pointer) return;
  e.preventDefault();
  if(pointer.kind === 'stick'){
   const dx=e.clientX-pointer.x, dy=e.clientY-pointer.y, length=Math.hypot(dx,dy), pull=Math.min(1,length/STICK);
   const value=Math.max(0,(pull-DEAD_ZONE)/(1-DEAD_ZONE)), scale=value/(length || 1);
   this.input.touch.x=dx*scale; this.input.touch.z=dy*scale; this.input.touch.boost=pull>.86;
   const visual=Math.min(1,STICK/(length || 1)); this.showStick(pointer.x,pointer.y,dx*visual,dy*visual);
  }else{
   if(this.lookId === e.pointerId){ this.input.yaw -= (e.clientX-pointer.x)*LOOK; this.input.pitch=clamp(this.input.pitch-(e.clientY-pointer.y)*LOOK,-1.25,1.25); }
   pointer.x=e.clientX; pointer.y=e.clientY;
  }
 }
 up(e){
  const pointer=this.pointers.get(e.pointerId); if(!pointer) return;
  const cancelled=e.type !== 'pointerup' || !this.available();
  this.pointers.delete(e.pointerId); pointer.button?.classList.remove('down');
  if(pointer.kind === 'charge') this.input.releaseHeavy(cancelled || !this.ready('heavy'));
  if(pointer.kind === 'toggle' && !cancelled){
   const rect=pointer.button.getBoundingClientRect();
   if(e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom){
    this.input.touch.soar=!this.input.touch.soar; this.input.hooks.onSoar?.(this.input.touch.soar);
   }
  }
  if(this.stickId === e.pointerId){ this.stickId=null; this.input.touch.x=this.input.touch.z=0; this.input.touch.boost=false; this.stick.classList.remove('on'); this.stick.style.transform=''; this.knob.style.transform=''; }
  if(this.lookId === e.pointerId) this.lookId=[...this.pointers].find(([,p]) => p.kind === 'aim' || p.kind === 'look')?.[0] ?? null;
  if(this.layer.hasPointerCapture(e.pointerId)) this.layer.releasePointerCapture(e.pointerId);
  if(cancelled){ this.input.touch.soar=false; }
  this.syncHeld();
 }
 syncHeld(){
  const held=new Set([...this.pointers.values()].filter(p => p.kind === 'hold' || p.kind === 'aim').map(p => p.action));
  Object.assign(this.input.touch,{fire:held.has('fire'),missile:held.has('missile'),up:Number(held.has('up'))-Number(held.has('down'))});
  const button=this.buttons.get('soar')?.button;
  button?.classList.toggle('on',this.input.touch.soar); button?.setAttribute('aria-pressed',String(this.input.touch.soar));
 }
 showStick(x,y,dx,dy){
  const rect=this.layer.getBoundingClientRect(); this.stick.classList.add('on');
  // Client coordinates must be relative to the safe-area inset layer on notched devices.
  this.stick.style.transform=`translate(${x-rect.left}px,${y-rect.top}px)`; this.knob.style.transform=`translate(${dx}px,${dy}px)`;
 }
 release(){
  const ids=[...this.pointers.keys()]; this.pointers.clear(); this.lookId=this.stickId=null;
  for(const id of ids) if(this.layer.hasPointerCapture(id)) this.layer.releasePointerCapture(id);
  Object.assign(this.input.touch,{x:0,z:0,up:0,boost:false,fire:false,soar:false,missile:false}); this.input.chargeStart=0;
  for(const {button} of this.buttons.values()){ button.classList.remove('down','on'); if(button.dataset.kind === 'toggle') button.setAttribute('aria-pressed','false'); }
  if(this.stick){ this.stick.classList.remove('on'); this.stick.style.transform=''; this.knob.style.transform=''; }
 }
}
