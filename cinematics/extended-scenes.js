import * as T from 'three';
import {RagView} from '/src/avatars.js';
import {MovieRobot,moviePilot,ease,keys,lerp,trajectory} from './movie-rig.js';
const V=a=>new T.Vector3(...a),up=V([0,1,0]),clamp=T.MathUtils.clamp;
const bump=(t,a,b,c)=>ease((t-a)/(b-a))*(1-ease((t-b)/(c-b)));
export async function createAction(c){
 const {scene,city,giant,pilots,fx,missiles,death,camera,shotCamera,replay,collapse,once}=c;
 const [miss,shear,warehouse,hit]=await Promise.all(['miss','shear','warehouse','hit'].map(n=>fetch(`/replay/extended/${n}.json`).then(r=>r.json())));
 const robot=new MovieRobot(giant),rag=new RagView(scene,hit.initial);await rag.ready;for(const b of rag.bones.values())b.scale.setScalar(hit.scale);
 const trails=Array.from({length:8},()=>{const m=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:0xc0cdd4,transparent:true,opacity:.32,depthWrite:false}));scene.add(m);m.frustumCulled=false;return m;});
 let recoil=0,active='',turnStats=[];const bullets=new Map();
 const cam=(eye,aim,fov=55,roll=0)=>shotCamera(eye,eye,aim,aim,0,{fov,roll});
 const fly=(i,path,t,opts={})=>moviePilot(pilots[i],path,t,opts);
 const draw=(p,dt)=>robot.draw(p,dt);
 function fire(i,to,t,rate=7){const k=Math.floor(t*rate);if(bullets.get(i)===k)return;bullets.set(i,k);fx.shot({from:pilots[i].root.position.toArray(),to,hit:true,normal:[0,0,-1]},0x80def6);}
 function impact(key,when,at,power=1,material='steel'){once(key,when,()=>{fx.impact(at,power,material);recoil=Math.max(recoil,.35*power);});}
 function smallHit(at){fx.particle(fx.flares,at,{life:.09,size:1.4,color:new T.Color(0xffe8c7)});for(let i=0;i<20;i++)fx.particle(fx.sparks,at,{life:.2+Math.random()*.25,size:.09,color:new T.Color(0xffc98d),v:V([(Math.random()-.5)*10,Math.random()*8,(Math.random()-.5)*10]),gravity:-9});recoil=.5;}
 const play=(data,time)=>{if(time>=0)replay(data,time,{quietPast:true});};
 function ragFrame(age){
  const f=clamp(age*60,0,hit.frames.length-1),i=Math.floor(f),a=i===0?hit.initial:hit.frames[i-1],b=hit.frames[i],k=f-i;
  for(let j=0;j<a.parts.length;j++){const x=a.parts[j],y=b.parts[j];rag.update(x.id,lerp(x.p,y.p,k),new T.Quaternion().fromArray(x.q).slerp(new T.Quaternion().fromArray(y.q),k).toArray());}
  rag.root.visible=true;return V(a.parts.find(p=>p.name==='chest').p);
 }
 function rocket(i,p,dir,t){if(!missiles.active.has(i))missiles.add({id:i,p:p.toArray(),direction:dir.toArray(),born:t,time:t,life:30});missiles.pose({id:i,p:p.toArray(),direction:dir.toArray(),time:t});missiles.active.get(i).rendered=p.clone();}
 const near=[2.8,3.6,4.5,5.4,6.3,7.2,8.1,9];
 const chasePath=t=>V([105+Math.sin(t*1.5)*3.1,22+Math.sin(t*.9)*2.6,72-t*19]);
 const hitPoints=near.map((n,i)=>{const p=chasePath(n+.9),dir=V([i%2?1:-1,0,0]),d=city.rayDistance(p,dir,28);return p.addScaledVector(dir,Math.min(28,Math.max(7,d)));});
 function missilePoint(i,t){const n=near[i],catchup=ease((t-n+.85)/1.05),p=chasePath(t-.9+1.06*catchup),r=5.5-(5.5-1.7)*ease((t-n+1)/1),a=i*1.4+t*.55;p.x+=Math.cos(a)*r;p.y+=Math.sin(a)*r*.55;if(t>n+.2)p.lerp(hitPoints[i],ease((t-n-.2)/.7));return p;}
 function chase(t,mode,clock){
  const bank=-Math.cos(t*1.5)*.48,duck=Math.max(...near.map(n=>bump(t,n-.5,n-.08,n+.55)));
  const p=fly(0,chasePath,t,{bank,tuck:duck*.85,brace:duck*.15});
  giant.root.visible=false;
  for(let i=0;i<8;i++){
   const end=near[i]+.9;
   if(t>=end){missiles.remove(i);trails[i].visible=false;once('impact'+i,true,()=>{if(t-end<.2){fx.carExplosion(hitPoints[i].toArray());fx.impact(hitPoints[i].toArray(),1.25,'glass');recoil=.18;}const cell=[...city.cells].sort((a,b)=>V(a.p).distanceToSquared(hitPoints[i])-V(b.p).distanceToSquared(hitPoints[i]))[0];if(V(cell.p).distanceTo(hitPoints[i])<8)city.setSkin(cell.id,0,0);});continue;}
   const pos=missilePoint(i,t),dir=missilePoint(i,t+.02).sub(missilePoint(i,t-.02)).normalize();rocket(i,pos,dir,clock);
   const pts=Array.from({length:20},(_,j)=>missilePoint(i,Math.max(0,t-.8+j*.8/19)));trails[i].geometry.dispose();trails[i].geometry=new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.095,5,false);trails[i].visible=t>.2;
  }
  if(mode==='wide')cam([110,p.y+4,p.z-10],[p.x-1,p.y,p.z+6],62,-.025);
  else if(mode==='close')cam([p.x+3.2,p.y+1.4,p.z-7.5],[p.x,p.y+.1,p.z+1],58,bank*.12);
  else if(mode==='slalom')cam([p.x+2.4,p.y+2,p.z+8],[p.x,p.y,p.z-9],67,bank*.1);
  else cam([105,27,-117],[p.x,23,p.z+10],64,-.035);
 }
 function missSequence(t,mode,dt){
  const punch=keys(t,[[0,0],[1.65,0],[2.1,1],[2.38,1],[3.35,0],[7,0]]),yaw=keys(t,[[0,Math.PI/2-.16],[1.6,Math.PI/2-.25],[2.2,Math.PI/2+.1],[3.7,Math.PI/2],[7,Math.PI/2]]);
  draw({at:[-44,0,70],yaw,lean:punch*.08,left:[-5.5,16,-5],right:lerp([6,17,-4],[4,16,-13.5],punch),headYaw:-.1},dt);
  const path=a=>trajectory(a,[[0,[-48,18,64]],[1.5,[-56,16,66]],[1.83,[-57,16.8,66]],[2.25,[-55,23,78]],[3.4,[-41,23,90]],[7,[-35,18,148]]]);
  const dodge=bump(t,1.45,2.05,2.75),p=fly(0,path,t,{bank:-dodge*.85,tuck:dodge*.9,brace:dodge*.3});
  if(t<1.55)fire(0,[-44,18,69],t);play(miss,t-2.1);impact('wall',t>=2.1,[-58,16,66],1.45,'brick');
  if(mode==='punch')cam([-28,17,88],[-53,17,69],54,-.02);
  else if(mode==='blast')cam([-35,19,52],[-57,17,69],61,.015);
  else cam([p.x+3,p.y+2,p.z+8],[p.x-1,p.y,p.z-10],65,-.03);
 }
 function skySequence(t,mode,dt){
  const extension=keys(t,[[0,0],[2.27,0],[2.5,1],[2.7,1],[3.25,.1],[6,0]]),yaw=keys(t,[[0,-.17],[2.22,-.24],[2.68,.08],[3.5,.02],[6,0]]);
  draw({at:[-35,0,0],yaw,lean:extension*.055,left:[-5.6,17,-5],right:lerp([5.6,17,-4.5],[4,16,-12],extension),headYaw:.05},dt);
  let p;
  if(t<2.5){
   // The path clock is shared with the contact pose at t=2.5.
   p=fly(0,a=>V([-31,16,-13.4+(a-1)*14]),t-1.5,{brace:.25});if(t<2.2)fire(0,[-35,18,-2],t);
  }else{p=ragFrame(t-2.5);once('fist',true,()=>smallHit(hit.contact));}
  if(mode==='windup')cam([-13,22,-31],[-35,19,-5],49,.015);
  else if(mode==='hit')cam([-17,19,-30],[-32,17,-8],43,-.01);
  else{cam([p.x+5,p.y+3,p.z+8],p.toArray(),53,.025);impact('landing',p.y<1.3,[p.x,.2,p.z],.7,'concrete');}
 }
 function tower(t,mode,dt){
  const k=keys(t,[[0,0],[2.3,0],[2.65,1],[3.05,1],[4.3,0],[9.5,0]]);
  draw({at:[49,0,70],yaw:keys(t,[[0,-1.35],[2.25,-1.42],[2.8,-1.66],[4,-1.55],[10,-1.55]]),right:lerp([6,16,-4],[3,6,-13],k),left:[-5.6,17,-5],lean:k*.16,crouch:k*1.6},dt);
  play(collapse,(t-2.15)*1.2);impact('tower-hit',t>2.65,[61,6,70],1.3,'brick');
  if(mode==='flank'){const p=fly(0,a=>V([41,19,102-a*9]),t,{bank:.18});fire(0,[49,18,70],t);cam([35,14,108],[60,18,70],57,.015);}
  else if(mode==='swat')cam([35,13,100],[67,16,70],59,-.015);
  else if(mode==='fall')cam([105,17+t,90],[76+t,17,70],62,-.025);
  else{const p=fly(0,a=>V([75+(a-7)*19,9+Math.sin(a)*2,105]),t,{bank:.35,tuck:.3});cam([p.x-6,p.y+2,109],[p.x+7,p.y-1,101],65,.025);}
 }
 const finalAt=[-105,0,105];
 function finalPose(){return {head:[-105,24,105],left:[-111,15,100],right:[-99,15,100],bossYaw:0};}
 return {
  enter(s){
   if(active)turnStats.push({shot:active,maxRadiansPerSecond:robot.maxTurn});active=s.id;robot.maxTurn=0;robot.reset();bullets.clear();recoil=0;rag.root.visible=false;city.reset();for(const m of trails)m.visible=false;
   if(['reactor','breakup','exit'].includes(s.id)){death.start(finalPose(),90210);const age=s.id==='reactor'?0:s.id==='breakup'?1.5:4.5;for(let t=0;t<age;t+=1/24){death.update(t);fx.update(1/24);}death.update(age);}
  },
  render(clock,dt,s){
   const t=clock-s.start;rag.root.visible=false;for(const m of trails)m.visible=false;giant.root.visible=false;let rate=1;
   if(s.id==='street_threat'){
    const at=[-44,0,74-t*2],yaw=keys(t,[[0,1.3],[2,1.55]]);draw({at,yaw,left:[-5.8,13,-4.5],right:[5.8,16,-5.5],step:t*3,headYaw:.15},dt);
    fly(0,a=>V([-57+a*9,26,83-a*7]),t,{bank:-.2});cam([-35,5+t*2,99],[-52,17,71],53,-.02);impact('step',t>.3,[-44,.1,74],.4,'concrete');
   }else if(s.id==='roof_dive'){
    draw({at:[-44,0,70],yaw:1.55,left:[-5.7,16,-5],right:[5.8,17,-5],headYaw:-.15},dt);
    const p=fly(0,a=>V([-70+a*8,32-a*4,100-a*15]),t,{bank:-.3,tuck:ease(t/2)*.4});cam([p.x+3,p.y+2,p.z+7],[p.x,p.y-1,p.z-10],65,-.03);
   }else if(['missed_punch','wall_blast','debris_escape'].includes(s.id))missSequence(clock-4,s.id==='missed_punch'?'punch':s.id==='wall_blast'?'blast':'escape',dt);
   else if(s.id==='avenue_turn'){
    draw({at:[-35,0,5-t*2.5],yaw:keys(t,[[0,1.1],[2,-.12]]),left:[-5.8,16,-5.5],right:[5.8,16,-5.5],step:t*3,headYaw:-.18},dt);
    const p=fly(0,a=>V([-20-a*6,22,-15-a*8]),t,{bank:.2});fire(0,[-35,18,0],t);cam([-17,15,-28],[-30,18,0],55,.01);
   }else if(s.id==='crossfire'){
    const block=bump(t,.35,.75,1.25);draw({at:[-35,0,0],yaw:keys(t,[[0,-.12],[1.1,-.48],[2.5,-.15]]),left:lerp([-5.8,16,-5.5],[-4.5,21,-5],block),right:[5.7,16,-6],headYaw:-.1},dt);
    for(let i=0;i<3;i++){fly(i,a=>V([-35+Math.sin(i*1.8+a*.45)*16,20+i*2,-Math.cos(i*1.8+a*.45)*18]),t,{bank:(i-1)*.2});fire(i,[-35+(i-1)*2,18+i, -3],t);}
    cam([-13,22,-23],[-33,18,-1],53,-.012);impact('guard',t>.75,[-40,21,-5],.55,'steel');
   }else if(['punch_windup','sky_hit','tumble'].includes(s.id))skySequence(clock-15.5,s.id==='punch_windup'?'windup':s.id==='sky_hit'?'hit':'fall',dt);
   else if(s.id==='east_pursuit'){
    draw({at:[105,0,98],yaw:keys(t,[[0,.35],[1.5,0]]),left:[-5.8,16,-5],right:[5.7,17,-6],headYaw:-.15},dt);fly(0,a=>V([105,22,85-a*18]),t,{bank:-.2});cam([105,9,128],[106,19,92],48,.015);
   }else if(s.id==='volley'){
    draw({at:[105,0,98],yaw:0,left:[-5.8,16,-5.5],right:lerp([5.7,17,-6],[4.5,18,-11],ease(t/.5)),lean:.035},dt);cam([112,21,119],[107,19,91],49,-.012);
    for(let i=0;i<8;i++){const age=t-.55-i*.13;if(age>=0)rocket(i,V([109+(i%2)*.35,18.5,85-age*25]),V([0,0,-1]),clock);}
   }else if(s.id.startsWith('missile_'))chase(clock-25,s.id.split('_')[1],clock);
   else if(s.id.startsWith('tower_'))tower(clock-36,s.id.split('_')[1],dt);
   else if(['double_strike','facade_shear'].includes(s.id)){
    const a=clock-45.5,k=keys(a,[[0,0],[1.35,0],[1.8,1],[2.15,1],[3.4,0],[5,0]]);draw({at:[116,0,-70],yaw:-Math.PI/2,left:lerp([-5.5,17,-5],[-3.2,17,-13.3],k),right:lerp([5.5,17,-5],[3.2,17,-13.3],k),lean:k*.16,crouch:k*.7},dt);
    play(shear,a-1.8);impact('shear',a>=1.8,[130,17,-70],1.5,'stone');
    const p=fly(0,b=>V([105,24,-93+b*8]),a,{bank:.3,tuck:bump(a,.9,1.8,2.5)*.5});
    if(s.id==='double_strike')cam([105,24,-95],[124,19,-70],58,-.02);else cam([105,20,-42],[133,19,-70],65,.02);
   }else if(['warehouse_smash','rubble_run'].includes(s.id)){
    const a=clock-50.5,k=keys(a,[[0,0],[.95,0],[1.4,1],[1.7,1],[2.7,0],[5,0]]);draw({at:[-109,0,136],yaw:Math.PI/2,right:lerp([5.5,19,-4],[4,5,-13.5],k),left:[-5.5,16,-5.5],lean:k*.18,crouch:k*2},dt);
    play(warehouse,a-1.4);impact('warehouse',a>=1.4,[-124,5,136],1.6,'brick');
    if(s.id==='warehouse_smash')cam([-105,12,109],[-129,13,136],58,.02);
    else{const p=fly(0,b=>V([-112,8+(b-2.5)*2,152-(b-2.5)*20]),a,{bank:-.25,tuck:.3});cam([-105,p.y+2,p.z+7],[-119,p.y,p.z-8],65,-.025);}
   }else if(s.id==='squad_counter'){
    const sweep=bump(t,.5,1.1,1.9);draw({at:finalAt,yaw:keys(t,[[0,-.4],[1.3,.22],[2.5,0]]),left:lerp([-5.5,16,-5.5],[-3,18,-11],sweep),right:[5.8,16,-5.5],headYaw:.1},dt);
    for(let i=0;i<3;i++){fly(i,a=>V([-105+Math.sin(i*2+a*.5)*15,17+i*3,105-Math.cos(i*2+a*.5)*17]),t,{bank:(i-1)*.2,tuck:i===0?sweep*.6:0});fire(i,[-105,18,103],t);}
    cam([-105,23,75],[-106,18,105],54,-.02);
   }else if(s.id==='core_strike'){
    const recoilPose=ease((t-1.05)/.5);draw({at:finalAt,yaw:-recoilPose*.12,left:[-5.8,16-recoilPose*2,-5.5],right:[5.8,17-recoilPose*4,-6],lean:-recoilPose*.12,crouch:recoilPose},dt);
    const p=fly(0,a=>V([-97-a*3,19,84-a*2]),t,{bank:.08,aim:1,brace:bump(t,.7,1.05,1.5)*.4});cam([-88,22,80],[-103,19,104],50,.01);
    once('core',t>=1.05,()=>{fx.shot({from:p.toArray(),to:[-105,18,102],hit:true,weak:true},0xffc369);fx.reactorExplosion([-105,18,102],1.4);recoil=.5;});
   }else if(s.id==='reactor'){death.update(t);cam([-92,21,79],[-105,17,105],49,0);}
   else if(s.id==='breakup'){death.update(1.5+t);cam([-105,24+t*3,76],[-105,14-t*2,105],60,-.01);}
   else if(s.id==='exit'){death.update(4.5+t);const p=fly(0,a=>V([-105+a*12,12-a,100-a*12]),t,{bank:-.15});cam([p.x+3,p.y+3,p.z-9],[-105,9,105],64,-.02);}
   recoil*=Math.exp(-dt*15);camera.rotateZ(Math.sin(clock*71)*recoil*.017);camera.position.y+=Math.sin(clock*99)*recoil*.07;
   return rate;
  },
  diagnostics(){return {shot:active,locations:7,customPilotBones:rag.bones.size,maximumWristReach:robot.maxReach,turnRates:[...turnStats,{shot:active,maxRadiansPerSecond:robot.maxTurn}],missiles:8};}
 };
}
