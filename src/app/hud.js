// Desktop HUD: bars, telemetry, announcer feed, floating damage numbers, breach-charge ring,
// scoreboard and the pause overlay. Updated at 10 Hz except for the cheap per-frame bits.
import * as T from 'three';
import {C, F} from '../../shared/config.js';
import {state, me, $} from './state.js';
const escapeText = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const projected = new T.Vector3();
export class HUD {
 constructor(camera){
  this.camera = camera; this.toastUntil = 0; this.hitUntil = 0; this.flashUntil = 0; this.lastHP = 100; this.numbers = []; this.feedItems = []; this.comboUntil = 0; this.lastStagger = 0;
  this.feedEl = $('feed'); this.numbersEl = $('numbers');
 }
 toast(text, seconds = 2){ $('toast').textContent = text; this.toastUntil = performance.now() + seconds * 1000; }
 feed(text, kind = ''){
  const d = document.createElement('div'); d.className = `feed-item ${kind}`; d.textContent = text; this.feedEl.prepend(d);
  this.feedItems.unshift({el:d, until:performance.now() + (kind === 'big' ? 5000 : 3200)}); while(this.feedItems.length > 5) this.feedItems.pop().el.remove();
 }
 clearFeed(){ for(const f of this.feedItems) f.el.remove(); this.feedItems = []; }
 hit(weak){ this.hitUntil = performance.now() + (weak ? 160 : 100); $('hit-marker').classList.toggle('weak', !!weak); }
 flash(ms){ this.flashUntil = performance.now() + ms; }
 combo(n){ $('combo').textContent = `DEMOLITION ×${n}`; this.comboUntil = performance.now() + 1800; }
 damageNumber(p, amount, crit){
  if(this.numbers.length > 14) this.numbers.shift().el.remove();
  const el = document.createElement('b'); el.className = crit ? 'num crit' : 'num'; el.textContent = amount; this.numbersEl.append(el);
  this.numbers.push({el, p:[p[0], p[1] + 1, p[2]], born:performance.now()});
 }
 showOverlay(title = 'READY TO DROP?', text = 'Click to capture your mouse. Escape releases it.', {renderer, net} = {}){
  if(renderer?.xr.isPresenting) return; state.paused = true; $('overlay-title').textContent = title; $('overlay-text').textContent = text; $('overlay').classList.remove('hidden');
  $('camera-toggle').classList.toggle('hidden', state.role !== 'raider'); $('camera-toggle').textContent = state.firstPerson ? 'SWITCH TO THIRD PERSON · V' : 'SWITCH TO FIRST PERSON · V';
  $('resume').textContent = state.role === 'boss' ? 'DESKTOP CONTROLS ↗' : 'DEPLOY ↗'; $('restart').classList.toggle('hidden', !state.current?.phase || net?.id !== state.welcome?.host);
 }
 hideOverlay(){ state.paused = false; $('overlay').classList.add('hidden'); }
 scoreboard(players, winner){
  const rows = players.slice().sort((a, b) => b.score - a.score).map(p => `<tr><td>${p.bot ? '◇' : '›'} ${escapeText(p.name)}${p.id === state.localId ? ' / YOU' : ''}</td><td>${p.kills}</td><td>${p.damage}</td><td>${p.score}</td></tr>`).join('');
  $('scoreboard').innerHTML = `<caption>${winner === 'giant' ? 'THE COLOSSUS SURVIVES' : 'THE GIANT HAS FALLEN'} · RAIDER SQUAD</caption><tr><th>PILOT</th><th>DOWN</th><th>DMG</th><th>SCORE</th></tr>${rows}`;
  $('scoreboard').classList.remove('hidden');
 }
 setScoreboardVisible(visible){ if(!visible){ $('scoreboard').classList.add('hidden'); return; } const s = state.current; if(!s) return; this.scoreboard(s.players.map(p => ({id:p.id, name:state.welcome?.roster?.find(r => r.id === p.id)?.name || `PILOT ${p.id}`, bot:!!(p.flags & F.BOT), kills:0, damage:Math.round(p.score), score:Math.round(p.score)})), null); }
 // Ten times per second.
 refresh(s, now, {net, renderer, input}){
  $('boss-percent').textContent = `${Math.ceil(s.bossHP / C.BOSS_HP * 100)}%`; $('boss-fill').style.width = `${s.bossHP / C.BOSS_HP * 100}%`;
  const exposed = s.bossStagger > .35; $('boss-caption').classList.toggle('exposed', exposed); if(exposed && this.lastStagger <= .35 && state.role === 'raider') this.feed('CORE EXPOSED · BONUS DAMAGE', 'good'); this.lastStagger = s.bossStagger;
  const sec = Math.max(0, Math.ceil(s.remaining)); $('timer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  $('destruction').textContent = `${Math.round(s.damage)}%`; $('kills').textContent = s.kills; $('towers').textContent = s.towersDown || 0;
  const p = me(s);
  if(p){
   $('hp').textContent = Math.ceil(p.hp); $('fuel-fill').style.width = `${p.fuel * 100}%`; $('altitude').textContent = `${Math.max(0, p.p[1]).toFixed(0).padStart(2, '0')}m`;
   $('flight-mode').textContent = p.flags & F.DODGE ? 'DODGE' : p.flags & F.SOAR ? 'SOARING' : 'HOVER'; $('speed-readout').textContent = `${Math.round(Math.hypot(...p.v))} m/s`;
   $('dodge-readout').textContent = p.dodgeCooldown > 0 ? `DODGE ${p.dodgeCooldown.toFixed(1)}s` : p.fuel < C.DODGE_FUEL ? 'DODGE · RECHARGING' : 'DODGE READY · E';
   $('heavy-readout').textContent = p.heavyCooldown > 0 ? `BREACH ${p.heavyCooldown.toFixed(1)}s` : p.fuel < C.HEAVY_FUEL ? 'BREACH · LOW THRUST' : 'BREACH READY · HOLD RIGHT CLICK';
   $('score-readout').textContent = `SCORE ${Math.round(p.score)}`;
   if(p.hp < this.lastHP) this.flash(240); this.lastHP = p.hp;
  }
  const r = renderer.stats;
  $('performance').textContent = `${this.fps || 0} FPS · ${r.frameMs.toFixed(1)}ms · ${net.ping}ms · ${Math.round(net.kbps)} kb/s · ${r.calls} DC · ${Math.round(r.scale * 100)}% RES · ${renderer.cinematic ? 'CINEMATIC' : renderer.tier.name}`;
  if(s.phase && !state.previousPhase && !renderer.renderer.xr.isPresenting && state.role !== 'spectator'){ document.exitPointerLock?.(); this.showOverlay(s.phase === 1 ? 'THE GIANT HAS FALLEN.' : 'THE COLOSSUS SURVIVES.', `${s.kills} raiders down. ${Math.round(s.damage)}% structural damage, ${s.towersDown} towers down. A new round starts automatically after 20 seconds.`, {renderer:renderer.renderer, net}); }
  state.previousPhase = s.phase;
 }
 // Every frame: cheap fades and projected labels. DOM is only touched when a value changes.
 set(id, prop, value){ const key = id + prop; if(this.cache[key] === value) return; this.cache[key] = value; $(id).style[prop] = value; }
 frame(now, input){
  this.cache ??= {};
  this.set('hit-marker', 'opacity', now < this.hitUntil ? '1' : '0'); this.set('damage-flash', 'opacity', now < this.flashUntil ? '.65' : '0');
  if(now > this.toastUntil && this.toastShown){ $('toast').textContent = ''; this.toastShown = false; } else if(now <= this.toastUntil) this.toastShown = true;
  this.set('combo', 'opacity', now < this.comboUntil ? '1' : '0');
  const charge = state.role === 'raider' ? input.charge : 0; this.set('charge', 'opacity', charge > 0 ? '1' : '0'); if(charge > 0 || this.cache.charge){ $('charge').style.setProperty('--charge', charge); this.cache.charge = charge > 0; }
  for(let i = this.feedItems.length - 1; i >= 0; i--){ const f = this.feedItems[i]; if(now > f.until){ f.el.remove(); this.feedItems.splice(i, 1); } else f.el.style.opacity = Math.min(1, (f.until - now) / 500); }
  const w = innerWidth, h = innerHeight;
  for(let i = this.numbers.length - 1; i >= 0; i--){
   const n = this.numbers[i], age = (now - n.born) / 1000; if(age > 1){ n.el.remove(); this.numbers.splice(i, 1); continue; }
   projected.set(n.p[0], n.p[1] + age * 1.5, n.p[2]).project(this.camera);
   if(projected.z > 1){ n.el.style.opacity = '0'; continue; }
   n.el.style.transform = `translate(${(projected.x * .5 + .5) * w}px,${(-projected.y * .5 + .5) * h}px)`; n.el.style.opacity = String(1 - age);
  }
 }
}
