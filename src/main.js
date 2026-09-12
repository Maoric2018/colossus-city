// Client bootstrap: builds the renderer, world and app modules, then runs the frame loop.
// Gameplay rules live on the server; presentation modules live in src/app, src/world, src/render.
import * as T from 'three';
import {C, F} from '../shared/config.js';
import {activeEnvironment as city} from '../shared/environment.js';
import {raySphere, vec, lookDir} from '../shared/math.js';
import {installDistrict} from './district.js';
import {assetStatus, bakedModel} from './assets.js';
import {CityView} from './world/city.js';
import {GiantView, RaiderView, RagView} from './avatars.js';
import {Effects} from './effects.js';
import {Connection} from './network.js';
import {SpectatorViews} from './spectator.js';
import {MissileView} from './missiles.js';
import {FlightFX} from './flight-fx.js';
import {XRControl} from './xr.js';
import {GameAudio} from './audio.js';
import {GameRenderer} from './render/renderer.js';
import {gpuLabel} from './render/quality.js';
import {state, quest, me, $} from './app/state.js';
import {Input, lockPointer} from './app/input.js';
import {CameraRig} from './app/camera.js';
import {Shake} from './app/shake.js';
import {Prediction} from './app/prediction.js';
import {HUD} from './app/hud.js';
import {makeEventHandler} from './app/events.js';
import {bindLobby, notice} from './app/lobby.js';
const canvas = $('world');
let gr; try{ gr = new GameRenderer(canvas, {quest}); }catch(e){ notice(e.message); throw e; }
const renderer = gr.renderer, tier = gr.tier;
const scene = new T.Scene(); scene.background = new T.Color(city.sky.horizon);
const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, .05, tier.far), rig = new T.Group(); rig.add(camera); scene.add(rig);
const cityView = new CityView(scene, city, {tier, quest});
const giant = new GiantView(scene), fx = new Effects(scene, {tier, quest}), missiles = new MissileView(scene, fx), flightFX = new FlightFX(), audio = new GameAudio(), shake = new Shake(), prediction = new Prediction(cityView);
const net = new Connection(onMessage, onDisconnect), hud = new HUD(camera), cameraRig = new CameraRig(camera, rig, cityView, shake, prediction);
const players = new Map(), rags = new Map();
let lastNow = performance.now(), lastHUD = 0, lastInput = 0, frameCount = 0, frameStart = performance.now(), lastReconciled = -1;
const input = new Input(canvas, {
 onSoar(on){ const pilot = me(state.current); hud.toast(on ? (pilot?.p[1] > 2 ? 'SOARING · MOUSE STEERS · S BRAKES' : 'SOAR ARMED · SPACE TO LIFT OFF') : 'HOVER · PRECISION FLIGHT'); audio.play('ui'); },
 onCamera(){ state.firstPerson = !state.firstPerson; },
 onQuality(){ if(renderer.xr.isPresenting) return; const name = gr.toggleCinematic(); cityView.sun.castShadow = gr.shadows; hud.toast(`QUALITY / ${name}`); },
 onRocket(){ audio.unlock(); },
 onScoreboard(show){ if(state.playing && !state.current?.phase) hud.setScoreboardVisible(show); }
});
const xr = new XRControl(renderer, camera, rig, net, {onEnter(){ document.exitPointerLock?.(); document.body.classList.add('xr-active'); hud.hideOverlay(); input.reset(); }, onExit(){ document.body.classList.remove('xr-active'); if(state.playing) hud.showOverlay('VR SESSION ENDED', 'Re-enter VR or use desktop giant controls.', {renderer, net}); }});
xr.localImpact = (a, b, speed, side) => { const cells = cityView.cellsAlongSegment(a, b, C.HAND_RADIUS * .8); if(!cells.length) return false; const c = cells[0]; fx.impact([b[0], b[1], b[2]], Math.min(1, speed / 30) * .5, c.material); xr.hapticMaterial(c.material, .2); return true; };
const views = new SpectatorViews(renderer, scene, camera, {getState:() => state.current, getRole:() => state.role, getPlayerId:() => net.id, getMode:() => state.role === 'boss' ? 'Desktop giant' : state.firstPerson ? 'Desktop first person' : 'Desktop third person', getPaused:() => state.paused, getTracking:() => !xr.trackingStopped, players, giant, xr});
const listenerPosition = () => [camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]];
const handleEvent = makeEventHandler({city:cityView, fx, audio, hud, shake, xr, missiles, flightFX, giant, addRag, rags, listenerPosition});
const lobby = bindLobby({
 start, leave, resume(){ if(state.role === 'boss' && quest) hud.hideOverlay(); else pointer(); }, menu(){ hud.showOverlay(undefined, undefined, {renderer, net}); },
 openSpectator(){ if(state.role === 'spectator'){ document.exitPointerLock?.(); hud.hideOverlay(); input.reset(); views.setVisible(true); } else { const url = new URL(location.href); url.searchParams.set('spectator', '1'); window.open(url.toString(), '_blank', 'noopener'); } },
 freeCamera(){ views.setVisible(false); hud.showOverlay('FREE CAMERA', 'WASD moves; Space and C change height; Shift is fast. Use LIVE VIEWS to return to the panel.', {renderer, net}); },
 restart(){ net.send({type:'restart'}); },
 async enterVR(){ hud.hideOverlay(); audio.unlock(); try{ await xr.enter(); }catch(e){ hud.showOverlay('VR COULD NOT START', e.message, {renderer, net}); } },
 async copyLink(){ const u = new URL(location.href); u.searchParams.set('room', net.room); try{ await navigator.clipboard.writeText(u.toString()); hud.toast('INVITE LINK COPIED'); }catch{ hud.toast(`ROOM CODE / ${net.room}`, 5); } },
 settings(s){ xr.setSettings(s); }
});
function pointer(){ hud.hideOverlay(); audio.unlock(); lockPointer(canvas, () => hud.showOverlay('CLICK THE CITY TO PLAY', 'Your browser needs a fresh click to lock the pointer.', {renderer, net})); }
async function start(create = false, practice = false, spectator = false){
 $('create').disabled = $('join').disabled = true; notice('CONNECTING TO THE CITY…');
 try{
  const m = await net.connect({create, practice, role:spectator ? 'spectator' : state.selectedRole, room:$('room-input').value.trim().toUpperCase(), name:$('name').value.trim() || 'RAIDER'});
  state.playing = true; document.body.classList.add('playing'); $('lobby').classList.add('hidden'); $('scene-caption').classList.add('hidden'); $('hud').classList.remove('hidden');
  const role = state.role;
  $('controls').textContent = role === 'boss' ? 'WASD MOVE · MOUSE LOOK · HOLD CLICK SWEEP · SPACE SLAM · RIGHT CLICK / R MISSILE · Q QUALITY' : role === 'spectator' ? 'WASD FLY · SPACE UP · C DOWN · SHIFT FAST · MOUSE LOOK' : 'WASD MOVE · SPACE FLY · F SOAR · SHIFT BOOST · E DODGE · CLICK FIRE · RIGHT CLICK ROCKET · V CAMERA · TAB SCORES';
  $('flight-status').classList.toggle('hidden', role !== 'raider'); $('telemetry').classList.toggle('hidden', role !== 'raider'); $('aim').classList.toggle('hidden', role !== 'raider'); $('vr-button').classList.toggle('hidden', role !== 'boss');
  if(role === 'boss'){ $('vr-button').textContent = quest ? 'ENTER VR ↗' : 'ENTER VR / QUEST ↗'; hud.showOverlay('YOU ARE THE COLOSSUS.', 'Quest: close this panel, then select ENTER VR. Desktop: mouse + WASD, hold click to sweep, Space to slam, right click to fire missiles. Smash the base of a tower and it comes down.', {renderer, net}); $('resume').textContent = 'CONTINUE ↗'; }
  else if(role === 'spectator'){ hud.hideOverlay(); views.setVisible(true); }
  else hud.showOverlay('SMALL SQUAD. BIG PROBLEM.', 'Space lifts you. F switches to fast soaring; mouse steers. E dodges. RIGHT CLICK fires a rocket: it explodes on impact and blows the structure out of a building. Topple a tower onto the colossus for massive damage.', {renderer, net});
  const u = new URL(location.href); u.searchParams.set('room', net.room); history.replaceState({}, '', u); localStorage.setItem('colossus-name', $('name').value);
  setTimeout(() => hud.feed(role === 'boss' ? 'OBJECTIVE · LEVEL THE CITY · SMASH TOWER BASES' : role === 'raider' ? 'OBJECTIVE · ROCKET THE COLUMNS · DROP TOWERS ON THE COLOSSUS' : 'OBSERVING MIDTOWN', 'big'), 400);
 }catch(e){ notice(e.message); $('connection-label').textContent = 'CONNECTION FAILED'; }
 finally{ $('create').disabled = $('join').disabled = false; }
}
function onMessage(m){
 if(m.type === 'welcome'){
  state.welcome = m; state.role = m.role; state.localId = m.id; views.connect(m); missiles.reset(); for(const missile of m.missiles || []) missiles.add(missile);
  state.current = null; state.previousPhase = 0; xr.resetPose(); cityView.reset(); for(const r of rags.values()) r.dispose(); rags.clear(); for(const p of players.values()) p.dispose(); players.clear();
  cityView.hideCells(m.clearedCells || []); for(const s of m.skins || []) cityView.setSkin(s[0], s[1], s[2], false); for(const e of m.entities) cityView.addDebris(e); for(const r of m.rags) addRag(r); cityView.commit();
  $('room-label').textContent = `ROOM / ${m.room}`; $('connection-label').textContent = m.practice ? 'PRACTICE / SERVER ONLINE' : 'SERVER CONNECTED';
  const spawn = city.spawns[(m.id - 1) % city.spawns.length]; input.yaw = state.role === 'raider' ? (spawn[3] ?? Math.atan2(spawn[0], spawn[2])) : 0; input.pitch = 0; cameraRig.reset(spawn); prediction.reset(null); lastReconciled = -1; hud.lastHP = 100; hud.clearFeed(); $('scoreboard').classList.add('hidden'); return;
 }
 if(m.type === 'roster'){
  views.updateRoster(m.players); if(state.welcome){ state.welcome.host = m.host; state.welcome.roster = m.players; }
  $('roster').replaceChildren(...m.players.map(p => { const d = document.createElement('div'); d.textContent = `${p.role === 'boss' ? '◆' : p.role === 'bot' ? '◇' : '›'} ${p.name}${p.id === net.id ? ' / YOU' : ''}`; return d; }));
  $('boss-caption').textContent = m.bossPresent ? 'COLOSSUS / HUMAN PILOT' : 'COLOSSUS / AI STAND-IN'; return;
 }
 if(m.type === 'events') for(const e of m.events) handleEvent(e);
 if(m.type === 'error') hud.toast(m.message, 4);
}
function addRag(r){ for(const p of r.parts){ if(rags.has(p.id)) rags.get(p.id).dispose(); rags.set(p.id, new RagView(scene, p, r.player)); } }
function onDisconnect(){
 if(!state.playing) return;
 views.disconnect(); views.setVisible(false); input.reset(); $('connection-label').textContent = 'DISCONNECTED'; hud.toast('CONNECTION LOST', 999);
 if(xr.session) xr.session.end().catch(() => {});
 hud.showOverlay('CONNECTION LOST', 'The shared simulation is no longer connected. Leave and rejoin the room; do not trust frozen positions.', {renderer, net}); $('resume').classList.add('hidden');
}
function leave(){
 views.setVisible(false); views.disconnect(); missiles.reset(); input.soar = false; net.close(); state.playing = false; state.current = null; input.reset(); document.exitPointerLock?.(); if(xr.session) xr.session.end().catch(() => {});
 document.body.classList.remove('playing', 'xr-active'); $('lobby').classList.remove('hidden'); $('scene-caption').classList.remove('hidden'); $('hud').classList.add('hidden'); $('overlay').classList.add('hidden'); $('resume').classList.remove('hidden'); $('scoreboard').classList.add('hidden');
 cityView.reset(); for(const p of players.values()) p.dispose(); players.clear(); for(const r of rags.values()) r.dispose(); rags.clear(); hud.clearFeed(); notice('READY FOR THE NEXT DROP.');
}
// Camera-to-target convergence: the third-person crosshair must not fire a parallel, vertically
// displaced ray. The server still resolves and validates the hit.
function aim(){
 const s = state.current, player = me(net.latest || s); if(!s || !player) return null;
 const dir = lookDir(input.yaw, input.pitch), origin = camera.position; let distance = C.SHOT_RANGE;
 for(const [p, r] of [[s.head, C.HEAD_RADIUS], [[s.head[0], s.head[1] - 7.2, s.head[2]], 4.1], [s.left, C.HAND_RADIUS], [s.right, C.HAND_RADIUS]]) distance = Math.min(distance, raySphere(origin, dir, vec(p), r));
 distance = cityView.rayDistance(origin, new T.Vector3(dir.x, dir.y, dir.z), distance);
 const from = prediction.active ? prediction.position() : {x:player.p[0], y:player.p[1], z:player.p[2]};
 const target = new T.Vector3(dir.x, dir.y, dir.z).multiplyScalar(Math.max(1, distance + .04)).add(origin), a = target.sub(new T.Vector3(from.x, from.y + .5, from.z));
 return {yaw:Math.atan2(-a.x, -a.z), pitch:Math.atan2(a.y, Math.hypot(a.x, a.z))};
}
const localOverride = {p:[0, 0, 0], v:[0, 0, 0]};
function frame(now, xrFrame){
 const dt = Math.min((now - lastNow) / 1000, .05); lastNow = now; frameCount++;
 if(now - frameStart > 1000){ hud.fps = Math.round(frameCount * 1000 / (now - frameStart)); frameCount = 0; frameStart = now; }
 gr.adapt(dt, now);
 const s = net.sample();
 if(state.playing && s){
  state.current = s;
  const local = xr.update(xrFrame, s, now), presenting = renderer.xr.isPresenting;
  giant.update(local || s, {local:presenting || state.role === 'boss', stagger:s.bossStagger || 0});
  if(!presenting){
   if(state.role === 'raider'){
    const latest = net.latest, pilot = me(latest);
    if(latest && latest.tick !== lastReconciled){ lastReconciled = latest.tick; prediction.reconcile(pilot, net.lead); }
    prediction.advance(state.paused ? input.idle() : input.held(), dt, input.seq, latest?.time || 0);
   }
   cameraRig.update(dt, s, {input, net});
   if(now - lastInput > 1000 / C.INPUT_HZ){ net.send(input.packet(aim)); lastInput = now; }
  }
  const ids = new Set();
  for(const p of s.players){
   ids.add(p.id); if(!players.has(p.id)) players.set(p.id, new RaiderView(scene, p.id));
   const isLocal = p.id === net.id;
   if(isLocal && prediction.active && !presenting){ const pp = prediction.position(), pv = prediction.velocity(); Object.assign(localOverride, p); localOverride.p = [pp.x, pp.y, pp.z]; localOverride.v = [pv.x, pv.y, pv.z]; players.get(p.id).update(localOverride, true, state.firstPerson); }
   else players.get(p.id).update(p, isLocal, state.firstPerson);
  }
  for(const [id, p] of players) if(!ids.has(id)){ p.dispose(); players.delete(id); }
  for(const body of s.bodies){ if(rags.has(body.id)) rags.get(body.id).update(body.p, body.q); else cityView.poseDebris(body.id, body.p, body.q); }
  cityView.commit();
  if(now - lastHUD > 100){ hud.refresh(s, now, {net, renderer:gr}); lastHUD = now; }
  const pilot = me(s), held = input.held();
  if(state.role === 'raider' && pilot){ const speed = Math.hypot(...pilot.v), thrust = (pilot.fuel > .01 && ((held.up > 0) || held.boost || (pilot.flags & F.SOAR))) ? 1 : speed > 3 ? .35 : 0; audio.ambient(state.paused ? 0 : thrust, Math.min(1, speed / 40)); }
  else audio.ambient(0, 0);
 }else if(!state.playing){
  const t = now * .0001;
  giant.update({head:[0, 24, 0], left:[-6, 13 + Math.sin(t * 5), -3], right:[6, 12 + Math.cos(t * 5), -4], bossYaw:-.35});
  cameraRig.intro(now, city);
 }
 missiles.update((net.latest?.time || 0) + Math.min(.15, (now - net.receivedAt) / 1000)); flightFX.update(dt, me(state.current), state.playing && state.role === 'raider' && !state.paused && !renderer.xr.isPresenting);
 cityView.update(dt); fx.update(dt); hud.frame(now); audio.setListener(listenerPosition());
 gr.render(scene, camera, dt);
 if(state.playing){ views.update(now); $('capture-status').classList.toggle('hidden', !views.active); }
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize', () => gr.resize(camera));
input.bind();
canvas.addEventListener('click', () => { if(state.playing && !renderer.xr.isPresenting && !document.pointerLockElement) pointer(); });
document.addEventListener('pointerlockchange', () => { if(state.playing && !views.visible && !renderer.xr.isPresenting && !document.pointerLockElement){ input.reset(); hud.showOverlay('TAKE A BREATHER.', 'The room keeps running. Resume to control your character.', {renderer, net}); } });
const artReady = Promise.all([cityView.ready, giant.ready, missiles.ready, installDistrict(cityView, renderer), bakedModel('/assets/imported/space-kit/astronautA.glb')]).then(() => { window.COLOSSUS_ART_READY = true; if(!state.playing) notice(`CITY READY · ${gr.tier.name} MODE ON ${gpuLabel(gr.gpu)} · CREATE A ROOM OR JOIN YOUR FRIENDS`); });
if(lobby.params.get('spectator') === '1' && lobby.params.get('room')) artReady.then(() => start(false, false, true));
window.COLOSSUS_READY = true; notice('LOADING CITY ASSETS…');
// Read-only diagnostics for the included Playwright smoke test and profiling tools.
window.__COLOSSUS = {renderer, gameRenderer:gr, scene, net, city:cityView, camera, rig, xr, giant, fx, missiles, views, flightFX, audio, prediction, input, artReady, assetStatus, get state(){ return state.current; }, get role(){ return state.role; }};
