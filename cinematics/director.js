// Isolated cinematic stage: imports shipped assets/renderers, owns all cameras,
// staging, clock, edit decisions, graphics and capture. Not imported by the game.
import * as T from 'three';
import {midtown} from '/shared/city/layout.js';
import {CityView} from '/src/world/city.js';
import {GiantView,RaiderView} from '/src/avatars.js';
import {Effects} from '/src/effects.js';
import {MissileView} from '/src/missiles.js';
import {ColossusDeath} from '/src/colossus-death.js';
import {installDistrict} from '/src/district.js';
import {TIERS} from '/src/render/quality.js';
import {assetStatus} from '/src/assets.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const params=new URLSearchParams(location.search),W=+(params.get('width')||1920),H=Math.round(W*9/16),AH=Math.round(W/2.39/2)*2,BAR=(H-AH)/2;
const extendedMode=params.get('edit')==='extended',actionMode=extendedMode||params.get('edit')==='action',showText=!actionMode&&params.get('text')!=='0';
const actionTimeline=actionMode?await fetch(`/cinematics/${extendedMode?'extended':'action'}-timeline.json`).then(r=>r.json()):null;
const stage=document.getElementById('stage'),film=document.getElementById('film');film.width=W;film.height=H;
const ctx=film.getContext('2d',{alpha:false}),scene=new T.Scene();
const renderer=new T.WebGLRenderer({canvas:stage,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(W,AH,false);renderer.setPixelRatio(1.5);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.outputColorSpace=T.SRGBColorSpace;
const camera=new T.PerspectiveCamera(48,W/AH,.1,1000);
const env={...midtown,infinite:false},tier={...TIERS.high,pixelRatio:1,shadowSize:2048};
const city=new CityView(scene,env,{tier});
// Preload the fixed native Midtown set for editorial camera moves: no streaming pops.
city.buildings.components.radius=550;
const giant=new GiantView(scene),pilots=Array.from({length:4},(_,i)=>new RaiderView(scene,i+1)),fx=new Effects(scene,{tier}),missiles=new MissileView(scene,fx),death=new ColossusDeath(scene,giant,{fx});
const [breach,collapse]=await Promise.all([fetch('/replay/breach.json').then(r=>r.json()),fetch('/replay/collapse.json').then(r=>r.json())]);
// Use the game's infinite-city cloud sky while holding its native central blocks fixed.
city.env={...env,infinite:true};
await Promise.all([city.ready,giant.ready,fx.ready,missiles.ready,...pilots.map(p=>p.ready),installDistrict(city,renderer)]);
city.env=env;
// Tight shadow coverage and an editorial blue/gold balance; shipped PBR materials retained.
scene.fog=new T.Fog(actionMode?0xb8cede:0x8296a3,125,320);scene.environmentIntensity=.72;
city.sky.material.uniforms.horizon.value=scene.fog.color;
city.sun.position.set(-100,130,-100);city.sun.intensity=3.5;city.sun.color.set(0xffe4bf);
const fill=new T.DirectionalLight(0xa4d9ff,1.15);fill.position.set(90,45,-70);scene.add(fill);
Object.assign(city.sun.shadow.camera,{left:-130,right:130,top:130,bottom:-130});city.sun.shadow.camera.updateProjectionMatrix();
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(W,AH),.19,.45,1.05));composer.addPass(new OutputPass());

export const SHOTS=actionTimeline?.shots||[
 {id:'city',start:0,end:6,label:'A city worth fighting for',lens:48},
 {id:'giant',start:6,end:12,label:'One colossus',lens:44},
 {id:'pilot',start:12,end:16,label:'Small squad. Big problem.',lens:42},
 {id:'flight',start:16,end:22,label:'Own the air',lens:62},
 {id:'breach',start:22,end:28,label:'Make your own way',lens:68},
 {id:'missile',start:28,end:32,label:'Stay one move ahead',lens:53},
 {id:'collapse',start:32,end:37,label:'Nothing is built to last',lens:57},
 {id:'attack',start:37,end:40,label:'Break the core',lens:45},
 {id:'death',start:40,end:47,label:'Reactor failure',lens:47},
 {id:'title',start:47,end:54,label:'Colossus City',lens:48}
];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);},lerp=T.MathUtils.lerp;
const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const vec=a=>new T.Vector3(...a);
// Reusable eased dolly/orbit camera with aim and roll controls.
function shotCamera(from,to,targetFrom,targetTo,u,{fov=48,roll=0,ease=true}={}){
 const k=ease?smooth(u):u;camera.position.fromArray(mix(from,to,k));camera.lookAt(vec(mix(targetFrom,targetTo,k)));camera.rotateZ(roll);camera.fov=fov;camera.updateProjectionMatrix();
}
function pose(t,center=[0,24,0],yaw=0){
 const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),hand=(x,y,z)=>vec([x,y,z]).applyQuaternion(q).add(vec([center[0],0,center[2]])).toArray();
 return {head:[center[0],center[1]+Math.sin(t*.8)*.16,center[2]],left:hand(-7,13+Math.sin(t)*.7,-3.4),right:hand(7,12+Math.cos(t*.8)*.7,-4.5),bossYaw:yaw};
}
function pilot(i,p,v,yaw=0,soar=true,t=0,pitch=0){const s={id:i+1,p,v,yaw,pitch,fuel:1,flags:soar?16:0};pilots[i].update(s,false,false,1/24,t);return s;}
function applyEvent(e,quiet=false){
 if(quiet&&['soar-start','soar-breach','impact','strike','towerdown'].includes(e.type))return;
 switch(e.type){
  case 'fracture':city.setFracture(e.cell,e.parts);break;
  case 'shards':city.addShards(e);break;
  case 'fine-collapse':city.hideCells(e.cells);break;
  case 'skin':for(const [id,g,f]of e.cells)city.setSkin(id,g,f);break;
  case 'debris':case 'settled':city.addDebris(e);break;
  case 'remove':city.removeDebris(e.id);break;
  case 'crumble':city.crumble(e);fx.impact(e.p,.6,e.material);break;
  case 'soar-start':fx.sonicBoom(e.p,e.direction);break;
  case 'soar-breach':fx.soarBreach(e.p,e.direction);break;
  case 'impact':case 'strike':fx.impact(e.p,e.power||.6,e.material);break;
  case 'towerdown':fx.dustRing([e.p[0],.3,e.p[2]],1.3);break;
 }
}
let replayIndex=-1,currentShot=null,lastTime=-1,shotTime=0,lastBullet=-1,action=null;
const marks=new Set();
function once(key,condition,fn){if(condition&&!marks.has(key)){marks.add(key);fn();}}
function clearFX(){for(const p of [fx.smoke,fx.dust,fx.sparks,fx.flashes,fx.flares])p.items.length=0;fx.tracers.length=0;fx.rings.length=0;fx.booms.length=0;fx.update(0);missiles.reset();}
function enter(s){
 if(currentShot?.id==='breach'||currentShot?.id==='collapse'||currentShot?.damage)city.reset();
 death.reset();clearFX();replayIndex=-1;marks.clear();lastBullet=-1;currentShot=s;
 let seed=90210+SHOTS.indexOf(s)*7919;
 Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 for(const p of pilots){p.root.visible=false;p.flight.blend=0;}
 if(s.id==='death')death.start(pose(40),90210);
 action?.enter(s);
}
function replay(data,t,{quietPast=false}={}){
 const index=Math.min(data.frames.length-1,Math.floor(t*60));
 for(let i=replayIndex+1;i<=index;i++)for(const e of data.frames[i].events)applyEvent(e,quietPast&&i/60<t-.3);replayIndex=index;
 const a=data.frames[index],b=data.frames[Math.min(index+1,data.frames.length-1)],alpha=clamp(t*60-index),next=new Map(b.bodies.map(p=>[p.id,p]));
 city.fine.time=t;
 for(const body of a.bodies){const n=next.get(body.id);city.poseDebris(body.id,n?mix(body.p,n.p,alpha):body.p,body.q);}
 if(a.players){const p=a.players[0],n=b.players.find(v=>v.id===p.id)||p;return {...p,p:mix(p.p,n.p,alpha),v:mix(p.v,n.v,alpha)};}
}
function renderScene(t,dt){
 const s=SHOTS.find(s=>t>=s.start&&t<s.end)||SHOTS.at(-1);if(s!==currentShot)enter(s);
 const u=clamp((t-s.start)/(s.end-s.start)),lt=t-s.start;shotTime=lt;
 giant.root.visible=true;for(const p of pilots)p.root.visible=false;
 giant.update(pose(t));
 if(action){
  const rate=action.render(t,dt,s);city.update(dt*rate);city.cars.update(dt*rate,fx);fx.update(dt*rate);missiles.update(t);city.commit();composer.render(1/24);return s;
 }
 if(s.id==='city'){
  giant.root.visible=false;
  shotCamera([111,90,126],[91,78,108],[-15,43,-40],[-15,40,-40],u,{fov:48});
 }else if(s.id==='giant'){
  shotCamera([15,4,-37],[-10,7,-33],[0,18,0],[0,18,0],u,{fov:44});
  const p=pose(t);p.right=[8,lerp(12,19,smooth((lt-1)/3)),-5];giant.update(p);
  once('stomp',lt>.6,()=>fx.dustRing([2,.2,0],.7));
 }else if(s.id==='pilot'){
  const p=[2+lt*.5,11+lt*.65,-10-lt*1.8];
  pilot(0,p,[1,2,-12],-.15,lt>1.7,t,.08);
  shotCamera(vec(p).add(vec([3,1.5,-5.8])).toArray(),vec(p).add(vec([3,1.5,-5.8])).toArray(),p,p,u,{fov:42});
  once('launch',lt>1.7,()=>fx.sonicBoom(p,[0,.08,-1]));
 }else if(s.id==='flight'){
  const z=105-lt*27,x=35+Math.sin(lt*.8)*1.3,p=[x,18+Math.sin(lt*.7)*3,z];
  pilot(0,p,[Math.cos(lt*.8),0,-32],0,true,t);
  pilot(1,[x+3,20,z-7],[0,0,-32],0,true,t);
  const eye=[x+1,p[1]+1.3,p[2]+5.5],aim=[x,p[1],p[2]-8];
  shotCamera(eye,eye,aim,aim,u,{fov:62,roll:Math.sin(lt*.8)*.023});
 }else if(s.id==='breach'){
  giant.root.visible=false;const rt=Math.min(1.2,lt*.2),p=replay(breach,rt);pilot(0,p.p,p.v,p.yaw,true,rt,p.pitch);
  // Follow through the real cleared pressure corridor with the pilot and broken wall in frame.
  const eye=[p.p[0]+1.2,p.p[1]+1.2,p.p[2]+6],aim=[p.p[0],p.p[1],p.p[2]-5];
  shotCamera(eye,eye,aim,aim,u,{fov:68});
 }else if(s.id==='missile'){
  const a=-.8+lt*.5,p=[Math.sin(a)*20,16+Math.sin(lt*1.6)*3,-Math.cos(a)*20];
  pilot(0,p,[Math.cos(a)*32,2,Math.sin(a)*32],-Math.PI/2-a,true,t);
  const eye=vec(p).add(vec([5,3,-9])).toArray();shotCamera(eye,eye,[p[0]-3,p[1],p[2]+6],[p[0]-3,p[1],p[2]+6],u,{fov:53,roll:Math.sin(lt)*.05});
  for(let i=0;i<3;i++){
   const age=lt-.35-i*.48;if(age<0)continue;
   const from=[i%2?7:-7,14,-5],dest=vec(p).add(vec([i-1,-1,5])).toArray();
   const m=mix(from,dest,clamp(age/1.4)),dir=vec(dest).sub(vec(from)).normalize().toArray();
   if(age<1.45){if(!missiles.active.has(i))missiles.add({id:i,p:m,direction:dir,born:t-age,time:t,life:6});missiles.pose({id:i,p:m,direction:dir,time:t});}
   else {missiles.remove(i);once('boom'+i,true,()=>fx.impact(dest,1,'steel'));}
  }
 }else if(s.id==='collapse'){
  replay(collapse,lt*.79);
  const p=pose(t,[49,24,70],-Math.PI/2);p.right=[lerp(51,62,smooth(lt/.7)),lerp(17,5,smooth(lt/.7)),70];giant.update(p);
  shotCamera([35,7,111],[36,14,125],[66,18,70],[76,12,70],u,{fov:57});
 }else if(s.id==='attack'){
  for(let i=0;i<4;i++){
   const a=-1.1+i*.65+lt*.11,p=[Math.sin(a)*22,14+i*2,-Math.cos(a)*22];
   pilot(i,p,[2,1,-3],Math.atan2(p[0],p[2]),false,t);
   if(Math.floor(lt*8)!==lastBullet)fx.shot({from:p,to:[(i-1.5)*.5,18,.2],hit:true,normal:[0,0,-1]});
  }
  lastBullet=Math.floor(lt*8);shotCamera([13,22,-25],[9,22,-20],[0,19,0],[0,19,0],u,{fov:45});
  once('heavy',lt>2.2,()=>{fx.reactorExplosion([0,18,-3],1.1);fx.shot({from:[-17,16,-19],to:[0,18,-3],hit:true},0xffc06a);});
 }else if(s.id==='death'){
  death.update(lt*.78);
  const a=-.65+u*.68,r=lerp(42,64,u),height=lerp(17,39,smooth(u)),aim=lerp(16,2,smooth(u));
  shotCamera([Math.sin(a)*r,height,-Math.cos(a)*r],[Math.sin(a)*r,height,-Math.cos(a)*r],[0,aim,0],[0,aim,0],u,{fov:47});
 }else if(s.id==='title'){
  giant.root.visible=false;shotCamera([130,105,148],[121,101,143],[-8,40,-42],[-8,40,-42],u,{fov:48});
 }
 const simdt=dt*(s.id==='breach'?.2:s.id==='collapse'?.79:s.id==='death'?.78:1);
 city.update(simdt);city.cars.update(simdt,fx);fx.update(simdt);missiles.update(t);city.commit();
 // Subtle operator vibration only at impacts, sampled from editorial time.
 let shake=0;if(s.id==='collapse')shake=Math.exp(-Math.max(0,lt-.65)*2)*.055*(lt>.65);if(s.id==='death')shake=.035*Math.exp(-Math.abs(lt-2.05)*2);
 camera.rotateZ(Math.sin(t*67)*shake);camera.position.y+=Math.sin(t*83)*shake;
 composer.render(1/24);
 return s;
}
function spaced(text,x,y,size,tracking,color='#f3f5ee',align='left',weight=600){
 ctx.font=`${weight} ${size}px Arial`;const widths=[...text].map(c=>ctx.measureText(c).width),total=widths.reduce((a,b)=>a+b,0)+tracking*(text.length-1);
 if(align==='center')x-=total/2;else if(align==='right')x-=total;
 ctx.fillStyle=color;for(let i=0;i<text.length;i++){ctx.fillText(text[i],x,y);x+=widths[i]+tracking;}
}
function caption(t,start,end,kicker,text){
 const a=smooth((t-start)/.4)*smooth((end-t)/.4);if(a<=0)return;ctx.save();ctx.globalAlpha=a;
 ctx.fillStyle='#c6ff7b';ctx.fillRect(108,775,48,3);spaced(kicker,108,755,16,4,'#c6ff7b');
 spaced(text,104,843+(1-a)*9,53,.5,'#f4f5ec','left',700);ctx.restore();
}
function graphics(t,s){
 ctx.fillStyle='#05090c';ctx.fillRect(0,0,W,H);ctx.drawImage(stage,0,BAR,W,AH);
 ctx.save();ctx.scale(W/1920,H/1080);
 // A restrained optical finish, with captions kept inside the cinema aperture.
 let g=ctx.createRadialGradient(960,525,180,960,525,1080);g.addColorStop(0,'rgba(2,9,16,0)');g.addColorStop(1,'rgba(2,9,16,.38)');ctx.fillStyle=g;ctx.fillRect(0,138,1920,804);
 g=ctx.createLinearGradient(0,600,0,945);g.addColorStop(0,'rgba(2,9,16,0)');g.addColorStop(1,'rgba(2,9,16,.46)');ctx.fillStyle=g;ctx.fillRect(0,600,1920,345);
 if(showText&&t<47){
  spaced('COLOSSUS / CITY UNDER SIEGE',106,91,15,3,'#aab7bb');
  spaced('IN-ENGINE CINEMATIC DEMO',1814,91,14,2.5,'#72838c','right');
  caption(t,1.2,5.4,'MIDTOWN / 01','A CITY WORTH FIGHTING FOR.');
  caption(t,7.0,11.4,'QUEST / COLOSSUS','ONE COLOSSAL THREAT.');
  caption(t,12.3,15.6,'LAPTOP / RAIDERS','SMALL SQUAD. BIG PROBLEM.');
  caption(t,17.0,20.5,'SOAR / DODGE / STRIKE','OWN THE AIR.');
  caption(t,23.5,27.5,'DESTRUCTIBLE CITY','MAKE YOUR OWN WAY.');
  caption(t,33.0,36.4,'GLASS. BRICK. STEEL.','NOTHING IS BUILT TO LAST.');
 }
 if(showText&&s.id==='title'){
  const a=smooth((t-47)/.65);ctx.fillStyle=`rgba(3,12,19,${.8*a})`;ctx.fillRect(0,138,1920,804);ctx.globalAlpha=a;
  spaced('ONE GIANT. UP TO EIGHT RAIDERS.',960,330,19,6,'#c6ff7b','center');
  spaced('COLOSSUS',960,551,156,7,'#f3f4eb','center',800);
  spaced('C I T Y   U N D E R   S I E G E',960,628,32,3,'#c6ff7b','center',500);
  ctx.fillStyle='#7c9699';ctx.fillRect(877,685,166,1);
  spaced('ASYMMETRIC MULTIPLAYER',960,740,17,5,'#d2dbdc','center');
  spaced('META QUEST 2  +  LAPTOP',960,785,17,4,'#91a7af','center');
  spaced('PROTOTYPE / CINEMATIC DEMO',960,883,13,3,'#85969e','center');ctx.globalAlpha=1;
 }
 const duration=SHOTS.at(-1).end;
 let black=t<(actionMode?.12:.8)?1-smooth(t/(actionMode?.12:.8)):0;if(t>duration-(actionMode?.45:1))black=smooth((t-duration+(actionMode?.45:1))/(actionMode?.45:1));
 if(black){ctx.fillStyle=`rgba(0,0,0,${black})`;ctx.fillRect(0,0,1920,1080);}
 ctx.restore();
}
if(actionMode){const {createAction}=await import(`/cinematics/${extendedMode?'extended':'action'}-scenes.js`);action=await createAction({scene,city,giant,pilots,fx,missiles,death,camera,pose,pilot,shotCamera,replay,breach,collapse,once,clamp,smooth,mix,vec});}
window.director={
 shots:SHOTS,duration:SHOTS.at(-1).end,width:W,height:H,scene,city,giant,pilots,camera,renderer,
 async frame(t){
  // Seek by replaying fixed steps within the destination shot. Sequential capture is O(1).
  const s=SHOTS.find(s=>t>=s.start&&t<s.end)||SHOTS.at(-1);
  if(t<lastTime||s!==currentShot){enter(s);lastTime=s.start-1/24;}
  while(lastTime+1/24<t-.001){lastTime+=1/24;renderScene(lastTime,1/24);}
  const shot=renderScene(t,Math.max(0,t-lastTime));lastTime=t;graphics(t,shot);return {shot:shot.id,time:t,calls:renderer.info.render.calls};
 },
 jpeg(){return film.toDataURL('image/jpeg',.97).split(',')[1];},
 png(){return film.toDataURL('image/png').split(',')[1];},
 diagnostics(){return {failedAssets:assetStatus.failed,glError:renderer.getContext().getError(),triangles:renderer.info.render.triangles,buildings:city.cellsByBuilding.length,breach:breach.stats,action:action?.diagnostics()};}
};
await window.director.frame(0);window.DIRECTOR_READY=true;
if(params.get('play')==='1'){const start=performance.now();async function play(){const t=(performance.now()-start)/1000;if(t<SHOTS.at(-1).end){await window.director.frame(t);requestAnimationFrame(play);}}requestAnimationFrame(play);}
