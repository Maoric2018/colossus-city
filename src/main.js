import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {C} from '../shared/config.js';
import {activeEnvironment as city} from '../shared/environment.js';
import {clamp,raySphere,vec,lookDir} from '../shared/math.js';
import {CityView} from './city.js';
import {GiantView,RaiderView,RagView} from './avatars.js';
import {Effects} from './effects.js';
import {Connection} from './network.js';
import {XRControl} from './xr.js';
const $=id=>document.getElementById(id),quest=/OculusBrowser|Quest|Mobile VR/i.test(navigator.userAgent),canvas=$('world');
let selectedRole='raider',playing=false,paused=false,role='',welcome=null,seq=0,lastInput=0,yaw=0,pitch=0,firstPerson=false,quality=quest?0:1;
let keys=new Set(),firing=false,mouseX=0,mouseY=0,lastNow=performance.now(),lastHUD=0,frameCount=0,frameStart=performance.now(),fps=0,lastHP=100,toastUntil=0,hitUntil=0,flashUntil=0;
let current=null,previousPhase=0,noticeTimer=null;
const players=new Map(),rags=new Map();
const scene=new T.Scene();scene.background=new T.Color(city.sky.horizon);
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:!quest,alpha:false,powerPreference:'high-performance'});}catch(e){$('notice').textContent='WebGL 2 is unavailable. Enable hardware acceleration in your browser.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,quest?1:1.5));renderer.setSize(innerWidth,innerHeight);renderer.info.autoReset=false;renderer.shadowMap.enabled=!quest;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=T.SRGBColorSpace;
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.05,650),rig=new T.Group();rig.add(camera);scene.add(rig);camera.position.set(63,39,70);
const cityView=new CityView(scene,city,{quest});
const pmrem=new T.PMREMGenerator(renderer);try{const env=pmrem.fromScene(cityView.envScene,.05,.1,700);scene.environment=env.texture;}catch(e){console.warn('Environment reflection generation skipped',e);}pmrem.dispose();
const giant=new GiantView(scene),fx=new Effects(scene,{quest});
let composer=null;function ensureComposer(){if(!composer){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.25,.35,1.1));composer.addPass(new OutputPass());}return composer;}if(!quest)ensureComposer();
const net=new Connection(onMessage,onDisconnect);
const xr=new XRControl(renderer,camera,rig,net,{onEnter(){document.exitPointerLock?.();document.body.classList.add('xr-active');hideOverlay();resetInput();},onExit(){document.body.classList.remove('xr-active');if(playing)showOverlay('VR SESSION ENDED','Re-enter VR or use desktop giant controls.');}});
const cameraPos=new T.Vector3(),desired=new T.Vector3(),forward=new T.Vector3(),qCamera=new T.Quaternion(),up=new T.Vector3(0,1,0);
function notice(text){$('notice').textContent=text;}
function toast(text,seconds=2){$('toast').textContent=text;toastUntil=performance.now()+seconds*1000;}
function resetInput(){keys.clear();firing=false;}
function showOverlay(title='READY TO DROP?',text='Click to capture your mouse. Escape releases it.'){
 if(renderer.xr.isPresenting)return;paused=true;resetInput();$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('overlay').classList.remove('hidden');$('resume').textContent=role==='boss'?'DESKTOP CONTROLS ↗':'DEPLOY ↗';$('restart').classList.toggle('hidden',!current?.phase||net.id!==welcome?.host);
}
function hideOverlay(){paused=false;$('overlay').classList.add('hidden');}
function pointer(){hideOverlay();fx.unlockAudio();try{const p=canvas.requestPointerLock();p?.catch?.(()=>showOverlay('CLICK THE CITY TO PLAY','Your browser needs a fresh click to lock the pointer.'));}catch{}}
function setRole(r){selectedRole=r;document.querySelectorAll('[data-role]').forEach(e=>e.classList.toggle('active',e.dataset.role===r));}
async function start(create=false,practice=false,spectator=false){
 $('create').disabled=$('join').disabled=true;notice('CONNECTING TO THE CITY…');
 try{
  await net.connect({create,practice,role:spectator?'spectator':selectedRole,room:$('room-input').value.trim().toUpperCase(),name:$('name').value.trim()||'RAIDER'});
  playing=true;document.body.classList.add('playing');$('lobby').classList.add('hidden');$('scene-caption').classList.add('hidden');$('hud').classList.remove('hidden');
  $('controls').textContent=role==='boss'?'WASD MOVE · MOUSE LOOK · HOLD CLICK SWEEP · SPACE SLAM · Q QUALITY':role==='spectator'?'WASD FLY · SPACE UP · C DOWN · MOUSE LOOK':'WASD MOVE · SPACE FLY · SHIFT BOOST · C DESCEND · CLICK FIRE · V CAMERA';
  $('telemetry').classList.toggle('hidden',role!=='raider');$('aim').classList.toggle('hidden',role!=='raider');
  $('vr-button').classList.toggle('hidden',role!=='boss');
  if(role==='boss'){
   $('vr-button').textContent=quest?'ENTER VR ↗':'ENTER VR / QUEST ↗';
   showOverlay('YOU ARE THE COLOSSUS.','Quest: close this panel, then select ENTER VR. Desktop: use mouse + WASD, hold click to sweep, Space to slam.');$('resume').textContent='CONTINUE ↗';
  }else showOverlay(role==='spectator'?'WATCH THE CITY FALL.':'SMALL SQUAD. BIG PROBLEM.',role==='spectator'?'Fly freely with WASD, Space and C.':'Hold Space to fly. Fire at the glowing head or core. A giant hand can knock you into a ragdoll.');
  const u=new URL(location.href);u.searchParams.set('room',net.room);history.replaceState({},'',u);localStorage.setItem('colossus-name',$('name').value);
 }catch(e){notice(e.message);$('connection-label').textContent='CONNECTION FAILED';}
 finally{$('create').disabled=$('join').disabled=false;}
}
function onMessage(m){
 if(m.type==='welcome'){
  welcome=m;role=m.role;current=null;previousPhase=0;xr.resetPose();cityView.reset();for(const r of rags.values())r.dispose();rags.clear();for(const p of players.values())p.dispose();players.clear();
  cityView.hideCells(m.clearedCells||[]);for(const e of m.entities)cityView.addDebris(e);for(const r of m.rags)addRag(r);cityView.commit();
  $('room-label').textContent=`ROOM / ${m.room}`;$('connection-label').textContent=m.practice?'PRACTICE / SERVER ONLINE':'SERVER CONNECTED';
  {const spawn=city.spawns[(m.id-1)%city.spawns.length];yaw=role==='raider'?Math.atan2(spawn[0],spawn[2]):0;}pitch=0;cameraPos.set(0,4,63);lastHP=100;return;
 }
 if(m.type==='roster'){
  if(welcome)welcome.host=m.host;
  $('roster').replaceChildren(...m.players.map(p=>{const d=document.createElement('div');d.textContent=`${p.role==='boss'?'◆':p.role==='bot'?'◇':'›'} ${p.name}${p.id===net.id?' / YOU':''}`;return d;}));
  $('boss-caption').textContent=m.bossPresent?'COLOSSUS / HUMAN PILOT':'COLOSSUS / AI STAND-IN';return;
 }
 if(m.type==='events')for(const e of m.events)event(e);
 if(m.type==='error')toast(m.message,4);
}
function addRag(r){for(const p of r.parts){if(rags.has(p.id))rags.get(p.id).dispose();rags.set(p.id,new RagView(scene,p,r.player));}}
function event(e){
 if(e.type==='debris'){cityView.addDebris(e);return;}
 if(e.type==='rag'){addRag(e);if(e.player===net.id){toast('IMPACT / STABILIZING',2);flashUntil=performance.now()+280;}return;}
 if(e.type==='remove'){if(rags.has(e.id)){rags.get(e.id).dispose();rags.delete(e.id);}else cityView.removeDebris(e.id);return;}
 if(e.type==='shot'){fx.shot(e);if(e.player===net.id){fx.sound(400,.065,'triangle',.028);if(e.hit)hitUntil=performance.now()+100;}return;}
 if(e.type==='impact'){fx.impact(e.p,e.power);if(role==='boss')xr.haptic(e.power*.35);return;}
 if(e.type==='kill'){if(e.player===net.id)toast('PILOT DOWN / REDEPLOYING',C.RESPAWN_SECONDS);else if(role==='boss')toast('RAIDER NEUTRALIZED',1.5);return;}
 if(e.type==='end'){toast(e.winner==='giant'?'COLOSSUS SURVIVES':'COLOSSUS DEFEATED',8);return;}
 // Reset has already arrived as a fresh welcome packet, with complete entity state.
 if(e.type==='reset'){hideOverlay();toast('NEW ROUND / CITY RESTORED',3);}
}
function onDisconnect(){
 if(!playing)return;resetInput();$('connection-label').textContent='DISCONNECTED';toast('CONNECTION LOST',999);
 if(xr.session)xr.session.end().catch(()=>{});
 showOverlay('CONNECTION LOST','The shared simulation is no longer connected. Leave and rejoin the room; do not trust frozen positions.');$('resume').classList.add('hidden');
}
function leave(){net.close();playing=false;current=null;resetInput();document.exitPointerLock?.();if(xr.session)xr.session.end().catch(()=>{});document.body.classList.remove('playing','xr-active');$('lobby').classList.remove('hidden');$('scene-caption').classList.remove('hidden');$('hud').classList.add('hidden');$('overlay').classList.add('hidden');$('resume').classList.remove('hidden');cityView.reset();for(const p of players.values())p.dispose();players.clear();for(const r of rags.values())r.dispose();rags.clear();notice('READY FOR THE NEXT DROP.');}
function input(){
 const m={type:'input',x:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z:(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),up:(keys.has('Space')?1:0)-(keys.has('KeyC')?1:0),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),fire:firing,yaw,pitch,seq:++seq};
 // Camera-to-target convergence: third-person crosshair must not fire a parallel,
 // vertically displaced ray. The server still resolves and validates the hit.
 if(role==='raider'&&firing&&current){
  const player=(net.latest||current).players.find(p=>p.id===net.id);
  if(player){
   const dir=lookDir(yaw,pitch),origin=camera.position;let distance=C.SHOT_RANGE;
   for(const [p,r] of [[current.head,C.HEAD_RADIUS],[[current.head[0],current.head[1]-7.2,current.head[2]],4.1],[current.left,C.HAND_RADIUS],[current.right,C.HAND_RADIUS]])distance=Math.min(distance,raySphere(origin,dir,vec(p),r));
   distance=cityView.rayDistance(origin,new T.Vector3(dir.x,dir.y,dir.z),distance);
   const target=new T.Vector3(dir.x,dir.y,dir.z).multiplyScalar(Math.max(1,distance+.04)).add(origin),aim=target.sub(new T.Vector3(player.p[0],player.p[1]+.5,player.p[2]));
   m.aimYaw=Math.atan2(-aim.x,-aim.z);m.aimPitch=Math.atan2(aim.y,Math.hypot(aim.x,aim.z));
  }
 }
 return m;
}
function desktopCamera(dt,s){
 rig.position.set(0,0,0);rig.rotation.set(0,0,0);rig.scale.setScalar(1);
 if(role==='spectator'){
  const i=input(),dir=new T.Vector3(i.x,i.up,i.z).applyAxisAngle(up,yaw);cameraPos.addScaledVector(dir,dt*22);desired.copy(cameraPos);
 }else if(role==='boss'){
  desired.set(s.head[0],s.head[1]+1.8,s.head[2]+.3);cameraPos.lerp(desired,1-Math.exp(-dt*12));
 }else{
  const latest=net.latest?.players.find(p=>p.id===net.id),p=s.players.find(p=>p.id===net.id);if(!p)return;
  // Bounded local extrapolation reduces display delay. The server remains authoritative;
  // this is not a second collision solver or unbounded dead reckoning.
  const source=latest||p,lead=source.flags&3?0:Math.min((performance.now()-net.receivedAt)/1000,.075);
  desired.set(source.p[0]+source.v[0]*lead,source.p[1]+.67+source.v[1]*lead,source.p[2]+source.v[2]*lead);
  if(!firstPerson){const back=new T.Vector3(0,1.1,4.4).applyAxisAngle(up,yaw),distance=back.length();back.normalize();const safe=cityView.rayDistance(desired,back,distance,.25);desired.addScaledVector(back,Math.max(0,safe-.18));}
  cameraPos.lerp(desired,1-Math.exp(-dt*(p.flags&2?5:22)));if(cameraPos.y<.35)cameraPos.y=.35;
 }
 camera.position.copy(cameraPos);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0,'YXZ');
 // Three.js looks along -Z. Positive pitch looks upward.
}
function hud(s,now){
 $('boss-percent').textContent=`${Math.ceil(s.bossHP/C.BOSS_HP*100)}%`;$('boss-fill').style.width=`${s.bossHP/C.BOSS_HP*100}%`;
 const sec=Math.max(0,Math.ceil(s.remaining));$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 $('destruction').textContent=`${Math.round(s.damage)}%`;$('kills').textContent=s.kills;
 const p=s.players.find(p=>p.id===net.id);if(p){$('hp').textContent=Math.ceil(p.hp);$('fuel-fill').style.width=`${p.fuel*100}%`;$('altitude').textContent=`${Math.max(0,p.p[1]).toFixed(0).padStart(2,'0')}m`;
  if(p.hp<lastHP)flashUntil=now+240;lastHP=p.hp;
 }
 $('performance').textContent=`${fps} FPS · ${net.ping}ms · ${Math.round(net.kbps)} kb/s · ${renderer.info.render.calls} DC`;
 if(s.phase&&!previousPhase&&!renderer.xr.isPresenting){document.exitPointerLock?.();showOverlay(s.phase===1?'THE GIANT HAS FALLEN.':'THE COLOSSUS SURVIVES.',`${s.kills} raiders down. ${Math.round(s.damage)}% structural damage. A new round starts automatically after 20 seconds.`);}
 previousPhase=s.phase;
}
function frame(now,xrFrame){
 const dt=Math.min((now-lastNow)/1000,.05);lastNow=now;frameCount++;
 if(now-frameStart>1000){fps=Math.round(frameCount*1000/(now-frameStart));frameCount=0;frameStart=now;}
 let s=net.sample();
 if(playing&&s){
  current=s;
  const local=xr.update(xrFrame,s,now);
  giant.update(local||s,{local:renderer.xr.isPresenting||role==='boss'});
  if(!renderer.xr.isPresenting){desktopCamera(dt,s);if(now-lastInput>1000/C.INPUT_HZ){net.send(paused?{...input(),x:0,z:0,up:0,fire:false}:input());lastInput=now;}}
  const ids=new Set();for(const p of s.players){ids.add(p.id);if(!players.has(p.id))players.set(p.id,new RaiderView(scene,p.id));players.get(p.id).update(p,p.id===net.id,firstPerson);}
  for(const [id,p] of players)if(!ids.has(id)){p.dispose();players.delete(id);}
  for(const body of s.bodies){if(rags.has(body.id))rags.get(body.id).update(body.p,body.q);else cityView.poseDebris(body.id,body.p,body.q);}cityView.commit();
  if(now-lastHUD>100){hud(s,now);lastHUD=now;}
 }else if(!playing){
  const t=now*.0001;
  const intro={head:[0,24,0],left:[-6,13+Math.sin(t*5),-3],right:[6,12+Math.cos(t*5),-4],bossYaw:-.35};giant.update(intro);
  camera.position.set(64+Math.sin(t)*6,35+Math.cos(t*.5)*3,63);camera.lookAt(-3,11,-5);
 }
 fx.update(dt);$('hit-marker').style.opacity=now<hitUntil?'1':'0';$('damage-flash').style.opacity=!renderer.xr.isPresenting&&now<flashUntil?'.65':'0';if(now>toastUntil)$('toast').textContent='';
 renderer.info.reset();if(renderer.xr.isPresenting||quality===0)renderer.render(scene,camera);else ensureComposer().render(dt);
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight);});
window.addEventListener('keydown',e=>{
 if(!playing||/INPUT|TEXTAREA/.test(e.target.tagName))return;
 if(['Space','KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
 if(e.code==='KeyV'&&!e.repeat)firstPerson=!firstPerson;
 if(e.code==='KeyQ'&&!e.repeat&&!renderer.xr.isPresenting){quality=quality?0:1;renderer.shadowMap.enabled=!!quality;toast(quality?'QUALITY / CINEMATIC':'QUALITY / PERFORMANCE');}
 if(!paused)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!paused){yaw-=e.movementX*.0021;pitch=clamp(pitch-e.movementY*.0021,-1.25,1.25);}});
window.addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas&&!paused)firing=true;});window.addEventListener('mouseup',()=>firing=false);
canvas.addEventListener('click',()=>{if(playing&&!renderer.xr.isPresenting&&!document.pointerLockElement)pointer();});
document.addEventListener('pointerlockchange',()=>{if(playing&&!renderer.xr.isPresenting&&!document.pointerLockElement)showOverlay('TAKE A BREATHER.','The room keeps running. Resume to control your character.');});
$('resume').onclick=()=>{if(role==='boss'&&quest){hideOverlay();}else pointer();};$('menu-button').onclick=()=>showOverlay();$('leave').onclick=leave;
$('create').onclick=()=>start(true);$('join').onclick=()=>start(false);$('practice').onclick=()=>start(true,true);$('spectate').onclick=()=>start(false,false,true);
$('restart').onclick=()=>net.send({type:'restart'});
$('vr-button').onclick=async()=>{hideOverlay();fx.unlockAudio();try{await xr.enter();}catch(e){showOverlay('VR COULD NOT START',e.message);}};
$('copy-link').onclick=async()=>{const u=new URL(location.href);u.searchParams.set('room',net.room);try{await navigator.clipboard.writeText(u.toString());toast('INVITE LINK COPIED');}catch{toast(`ROOM CODE / ${net.room}`,5);}};
document.querySelectorAll('[data-role]').forEach(e=>e.onclick=()=>setRole(e.dataset.role));
const params=new URLSearchParams(location.search);$('room-input').value=params.get('room')||'';$('name').value=localStorage.getItem('colossus-name')||'';if(params.get('role')==='boss'||quest)setRole('boss');
window.COLOSSUS_READY=true;notice('SERVER-DRIVEN PHYSICS · NO ACCOUNT REQUIRED');
// Read-only diagnostics for the included Playwright smoke test.
window.__COLOSSUS={renderer,scene,net,city:cityView,camera,rig,xr,get state(){return current;},get role(){return role;}};
