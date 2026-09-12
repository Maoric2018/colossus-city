// Desktop HUD: bars, telemetry, essential notices, breach-charge ring,
// scoreboard and the pause overlay. Updated at 10 Hz except for the cheap per-frame bits.
import {C, F} from '../../shared/config.js';
import {bossHealthFraction} from '../../shared/boss-health.js';
import {state, me, $} from './state.js';
const escapeText = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export class HUD {
 constructor(){
  this.toastUntil = 0; this.hitUntil = 0; this.flashUntil = 0; this.lastHP = 100;
 }
 toast(text, seconds = 2){ $('toast').textContent = text; this.toastUntil = performance.now() + seconds * 1000; }
 hit(weak){ this.hitUntil = performance.now() + (weak ? 160 : 100); $('hit-marker').classList.toggle('weak', !!weak); }
 flash(ms){ this.flashUntil = performance.now() + ms; }
 showOverlay(title = 'READY TO DROP?', text = 'Click to capture your mouse. Escape releases it.', {renderer, net} = {}){
  if(renderer?.xr.isPresenting) return; state.paused = true; $('overlay-title').textContent = title; $('overlay-text').textContent = text; $('overlay').classList.remove('hidden');
  $('camera-toggle').classList.toggle('hidden', state.role !== 'raider'); $('camera-toggle').textContent = state.firstPerson ? 'SWITCH TO THIRD PERSON · V' : 'SWITCH TO FIRST PERSON · V';
  for(const id of ['menu-spectator', 'open-spectator']) $(id).classList.toggle('hidden', state.role !== 'spectator');
  $('resume').textContent = state.role === 'boss' ? 'DESKTOP CONTROLS ↗' : 'DEPLOY ↗'; $('restart').classList.toggle('hidden', !state.current?.phase || net?.id !== state.welcome?.host);
 }
 hideOverlay(){ state.paused = false; $('overlay').classList.add('hidden'); }
 scoreboard(players, winner){
  const rows = players.slice().sort((a, b) => b.score - a.score).map(p => `<tr><td>${p.bot ? '◇' : '›'} ${escapeText(p.name)}${p.id === state.localId ? ' / YOU' : ''}</td><td>${p.kills}</td><td>${p.damage}</td><td>${p.score}</td></tr>`).join('');
  $('scoreboard').innerHTML = `<caption>${winner === 'giant' ? 'THE COLOSSUS SURVIVES' : 'THE COLOSSUS HAS FALLEN'} · DEFENDER SQUAD</caption><tr><th>PILOT</th><th>DOWN</th><th>DMG</th><th>SCORE</th></tr>${rows}`;
  $('scoreboard').classList.remove('hidden');
 }
 setScoreboardVisible(visible){ if(!visible){ $('scoreboard').classList.add('hidden'); return; } const s = state.current; if(!s) return; this.scoreboard(s.players.map(p => ({id:p.id, name:state.welcome?.roster?.find(r => r.id === p.id)?.name || `PILOT ${p.id}`, bot:!!(p.flags & F.BOT), kills:0, damage:Math.round(p.score), score:Math.round(p.score)})), null); }
 // Ten times per second.
 refresh(s, now, {net, renderer, input}){
  const core=bossHealthFraction(s);$('boss-percent').textContent = `${Math.ceil(core * 100)}%`; $('boss-fill').style.width = `${core * 100}%`;
  $('boss-caption').textContent=`COLOSSUS / ${Math.ceil(s.bossHP).toLocaleString()} OF ${(s.bossMaxHP||C.BOSS_HP).toLocaleString()} HP`;
  $('boss-caption').classList.toggle('exposed', s.bossStagger > .35);
  const sec = Math.max(0, Math.ceil(s.remaining)); $('timer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  $('destruction').textContent = `${Math.round(s.damage)}%`; $('kills').textContent = s.kills; $('towers').textContent = s.towersDown || 0;
  const p = me(s);
  if(p){
   $('hp').textContent = Math.ceil(p.hp); $('fuel-fill').style.width = `${p.fuel * 100}%`; $('altitude').textContent = `${Math.max(0, p.p[1]).toFixed(0).padStart(2, '0')}m`;
   $('flight-mode').textContent = p.flags & F.DODGE ? 'DODGE' : p.flags & F.SOAR ? 'SOARING ∞' : 'HOVER'; $('speed-readout').textContent = `${Math.round(Math.hypot(...p.v))} m/s`;
   $('dodge-readout').textContent = p.dodgeCooldown > 0 ? `DODGE ${p.dodgeCooldown.toFixed(1)}s` : p.fuel < C.DODGE_FUEL ? 'DODGE · RECHARGING' : 'DODGE READY · E';
   $('heavy-readout').textContent = p.heavyCooldown > 0 ? `BREACH ${p.heavyCooldown.toFixed(1)}s` : p.fuel < C.HEAVY_FUEL ? 'BREACH · LOW THRUST' : 'BREACH READY · HOLD RIGHT CLICK';
   $('score-readout').textContent = `SCORE ${Math.round(p.score)}`;
   if(p.hp < this.lastHP) this.flash(240); this.lastHP = p.hp;
  }
  const r = renderer.stats;
  $('performance').textContent = `${this.fps || 0} FPS · ${r.frameMs.toFixed(1)}ms · ${net.ping}ms · ${Math.round(net.kbps)} kb/s · ${r.calls} DC · ${Math.round(r.scale * 100)}% RES · ${renderer.cinematic ? 'CINEMATIC' : renderer.tier.name}`;
  // The round-end presenter reveals results after the visible death sequence.
  state.previousPhase = s.phase;
 }
 // Every frame: essential feedback fades. DOM is only touched when a value changes.
 set(id, prop, value){ const key = id + prop; if(this.cache[key] === value) return; this.cache[key] = value; $(id).style[prop] = value; }
 frame(now, input){
  this.cache ??= {};
  this.set('hit-marker', 'opacity', now < this.hitUntil ? '1' : '0'); this.set('damage-flash', 'opacity', now < this.flashUntil ? '.65' : '0');
  if(now > this.toastUntil && this.toastShown){ $('toast').textContent = ''; this.toastShown = false; } else if(now <= this.toastUntil) this.toastShown = true;
  const charge = state.role === 'raider' ? input.charge : 0; this.set('charge', 'opacity', charge > 0 ? '1' : '0'); if(charge > 0 || this.cache.charge){ $('charge').style.setProperty('--charge', charge); this.cache.charge = charge > 0; }
 }
}
