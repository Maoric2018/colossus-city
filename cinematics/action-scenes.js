// Authored action, entirely outside the playable game. Camera and missile paths
// share an editorial clock; hit reactions use the native jointed pilot ragdoll.
import * as T from 'three';
import {RagView} from '/src/avatars.js';

export async function createAction(c){
 const {scene,city,giant,pilots,fx,missiles,death,camera,pose,pilot,shotCamera,replay,breach,collapse,once,clamp,smooth,mix,vec}=c;
 const punch=await fetch('/replay/action/punch.json').then(r=>r.json());
 const rag=new RagView(scene,punch.initial);await rag.ready;rag.root.visible=false;
 const up=new T.Vector3(0,1,0),contact=vec(punch.contact),identity=new T.Quaternion();
 const trails=Array.from({length:8},()=>{const m=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:0xc2d5df,transparent:true,opacity:.42,depthWrite:false}));m.frustumCulled=false;scene.add(m);return m;});
 const chaseCurve=new T.CatmullRomCurve3([[35,23,64],[34,21,40],[38,29,12],[32,17,-17],[38,31,-43],[35,21,-67],[35,22,-83]].map(vec),false,'catmullrom',.4);
 const chasePoint=t=>chaseCurve.getPoint(clamp(t/7));
 const nearTimes=[2.15,2.65,3.15,3.6,4.15,4.65,5.15,5.6];
 const hitPoints=nearTimes.map((n,i)=>{
  const p=chasePoint(n+.8),dir=vec([i%2?1:-1,.04,-.1]).normalize(),distance=city.rayDistance(p,dir,23);
  return p.addScaledVector(dir,Math.min(23,Math.max(7,distance)));
 });
 const bulletClock=new Map();let recoil=0,activeShot='',lastTrailClock=-1;
 const pulse=(t,a,b,d)=>smooth((t-a)/(b-a))*(1-smooth((t-b)/(d-b)));
 function cam(eye,aim,fov=54,roll=0){shotCamera(eye,eye,aim,aim,0,{fov,roll});}
 function local(p,xyz){return vec(xyz).applyAxisAngle(up,p.bossYaw||0).add(vec([p.head[0],0,p.head[2]])).toArray();}
 function fight(t,target=[0,16,-20],power=1,center=[0,24,0]){
  const yaw=Math.atan2(-(target[0]-center[0]),-(target[2]-center[2]))*.55,p=pose(t,center,yaw);
  const cycle=t%1.8,jab=pulse(cycle,.2,.62,1.08)*power;
  p.left=local(p,[-6,18,-5]);p.right=mix(local(p,[7.5,17,-3]),[clamp(target[0]*.55,-12,12),clamp(target[1],12,23),clamp(target[2],-13,3)],jab);
  p.head[1]-=jab*.5;p.bossYaw+=Math.sin(t*1.5)*.07;giant.update(p);
  return p;
 }
 function fly(i,path,t,{roll=0,soar=true}={}){
  const p=path(t),a=path(t-.012),b=path(t+.012),v=b.clone().sub(a).multiplyScalar(1/.024);
  const yaw=Math.atan2(-v.x,-v.z),pitch=Math.atan2(v.y,Math.hypot(v.x,v.z));
  const s=pilot(i,p.toArray(),v.toArray(),yaw,soar,t,pitch);
  if(roll)pilots[i].mesh.rotateZ(roll);return p;
 }
 function fire(i,to,t,rate=10,heavy=false){
  const key=Math.floor(t*rate);if(bulletClock.get(i)===key)return;bulletClock.set(i,key);
  const from=pilots[i].root.position.clone();from.y+=.25;
  fx.shot({from:from.toArray(),to,hit:true,normal:[0,0,-1],weak:heavy},heavy?0xffb84d:0x70e9ff);
 }
 function rocket(id,position,direction,time){
  if(!missiles.active.has(id))missiles.add({id,p:position.toArray(),direction:direction.toArray(),born:time,time,life:20});
  missiles.pose({id,p:position.toArray(),direction:direction.toArray(),time});
  // Remove network interpolation from authored trajectories; the spline is the authority here.
  missiles.active.get(id).rendered=position.clone();
 }
 function ragAt(age,{at=contact,q=identity}={}){
  const f=Math.min(punch.frames.length-1,Math.max(0,age*60)),i=Math.floor(f),a=i===0?punch.initial:punch.frames[i-1],b=punch.frames[i],k=f-i;
  for(let j=0;j<a.parts.length;j++){
   const x=a.parts[j],y=b.parts[j],position=vec(mix(x.p,y.p,k)),rotation=new T.Quaternion().fromArray(x.q).slerp(new T.Quaternion().fromArray(y.q),k);
   rag.update(x.id,position.toArray(),rotation.toArray());
  }
  const chest=a.parts.find(p=>p.name==='chest'),origin=vec(chest.p).applyQuaternion(q);
  // Enlarge the body about its moving chest, preserving the recorded world path
  // and the street height. Scaling about the original impact put it underground.
  rag.root.scale.setScalar(1.25);rag.root.quaternion.copy(q);
  rag.root.position.copy(at).sub(contact.clone().applyQuaternion(q)).addScaledVector(origin,-.25);rag.root.visible=true;
  const lowest=Math.min(...a.parts.map(part=>vec(part.p).applyQuaternion(q).multiplyScalar(1.25).add(rag.root.position).y));
  if(lowest<.16)rag.root.position.y+=.16-lowest;
  const p=origin.multiplyScalar(1.25).add(rag.root.position);
  return p;
 }
 function skyPunch(lt,second=false){
  const impact=second?.85:1,at=second?vec([-4,14,-8]):contact;
  const p=pose(lt,[0,24,0],second?.16:-.14),extension=smooth((lt-(impact-.19))/.19),follow=smooth((lt-impact)/.4);
  if(second){p.left=mix([-8,6,-4],[-4,15,-6.7],extension);p.left[1]+=follow*3;p.right=[7,20,-5];}
  else {p.right=mix([9.5,17,-.8],[0,17,-10.6],extension);p.right[0]-=follow*3;p.right[2]-=follow*.8;p.left=[-6,19,-5];}
  p.bossYaw+=(second?-1:1)*extension*.18;p.head[1]-=extension*.4;giant.update(p);
  if(lt<impact){
   const f=second?t=>vec([-4,14+(t-impact)*4,-8+(t-impact)*12]):t=>vec([(t-impact)*14,17,-12]);
   fly(0,f,lt);if(lt<impact-.2)fire(0,[0,18,-2],lt);
  }else{
   const q=second?new T.Quaternion().setFromEuler(new T.Euler(0,.35,-.95)):identity;
   const age=second?(lt-impact)*.85:(lt-impact)*.62;
   ragAt(age,{at,q});once('punch',true,()=>{
    fx.particle(fx.flares,at.toArray(),{life:.11,size:2.6,color:new T.Color(0xffe5ae),growth:.5});
    for(let i=0;i<22;i++)fx.particle(fx.sparks,at.toArray(),{life:.22+Math.random()*.25,size:.12,color:new T.Color(0xffd38c),v:vec([(Math.random()-.7)*15,Math.random()*8-2,(Math.random()-.5)*10]),gravity:-12});
    recoil=.85;
   });
  }
 }
 function missilePoint(i,t){
  const n=nearTimes[i],catchup=smooth((t-(n-.7))/.95),base=chasePoint(t-.7+.94*catchup);
  const radius=T.MathUtils.lerp(7.5,1.7,smooth((t-n+1.05)/1.05)),angle=i*.91+t*(i%2?1.1:-1.2);
  const p=base.add(vec([Math.cos(angle)*radius,Math.sin(angle)*radius*.6,0]));
  if(t>n+.15)p.lerp(hitPoints[i],smooth((t-n-.15)/.7));
  return p;
 }
 function chase(t,mode,globalTime){
  const roll=-Math.sin(clamp((t-2.75)/1.7)*Math.PI)*1.18+Math.sin(clamp((t-4.8)/.9)*Math.PI)*.65;
  const p=fly(0,chasePoint,t,{roll});
  fight(globalTime,chasePoint(t).toArray(),1.1);
  // Every missile catches up on a different beat, skims the pilot, overshoots, then strikes scenery.
  for(let i=0;i<8;i++){
   const end=nearTimes[i]+.85;
   if(t>=end){
    missiles.remove(i);trails[i].visible=false;
    once('missile-impact-'+i,true,()=>{
     const at=hitPoints[i];fx.carExplosion(at.toArray());fx.impact(at.toArray(),1.1,'glass');city.rubble.bay('glass',at.toArray(),[0,-1,0],.4);
     const cells=[...city.cells].sort((a,b)=>vec(a.p).distanceToSquared(at)-vec(b.p).distanceToSquared(at));
     if(vec(cells[0].p).distanceTo(at)<7)city.setSkin(cells[0].id,0,0);recoil=Math.max(recoil,.22);
    });continue;
   }
   const pos=missilePoint(i,t),dir=missilePoint(i,t+.02).sub(missilePoint(i,t-.02)).normalize();rocket(i,pos,dir,globalTime);
   const points=Array.from({length:24},(_,j)=>missilePoint(i,Math.max(0,t-1.05+j*1.05/23)));
   const curve=new T.CatmullRomCurve3(points);trails[i].geometry.dispose();trails[i].geometry=new T.TubeGeometry(curve,28,.14,5,false);trails[i].visible=t>.12;
  }
  if(mode==='wide')cam([Math.min(43,p.x+7),p.y+5,p.z-9],p.clone().add(vec([0,0,6])).toArray(),61,-.06);
  else if(mode==='roll'){
   const velocity=chasePoint(t+.025).sub(chasePoint(t-.025)).normalize();
   const eye=p.clone().addScaledVector(velocity,8).add(vec([1.8,1.4,0]));cam(eye.toArray(),p.clone().add(vec([0,.1,2])).toArray(),65,roll*.19);
  }else cam(p.clone().add(vec([7,4,-10])).toArray(),p.clone().add(vec([-2,1,8])).toArray(),64,-.08);
 }
 return {
  enter(s){
   activeShot=s.id;bulletClock.clear();rag.root.visible=false;recoil=0;for(const m of trails)m.visible=false;
   for(const p of pilots){p.root.scale.setScalar(1.25);p.flight.blend=['charge','heavy'].includes(s.id)?0:1;}
   if(['reactor','breakup','exit'].includes(s.id)){
    death.start(pose(33.5),90210);
    const age=s.id==='reactor'?0:s.id==='breakup'?1.5:4.7;
    for(let t=0;t<age;t+=1/24){death.update(t);fx.update(1/24);}death.update(age);
   }
  },
  render(t,dt,s){
   const lt=t-s.start,u=lt/(s.end-s.start);rag.root.visible=false;for(const m of trails)m.visible=false;
   let rate=1;fight(t);
   if(s.id==='cold_open'){
    const path=a=>vec([-13+a*18,18+Math.sin(a*2)*2,-13]);const p=fly(0,path,lt);fly(1,a=>vec([13-a*14,22,-17]),lt);
    const g=fight(t,p.toArray(),1.4);g.left=mix([-7,17,-5],[5,19,-11],smooth(lt/.45));giant.update(g);fire(0,[0,18,-2],lt);fire(1,[-2,21,-1],lt);
    cam([18-lt*2,14,-26],[0,18,-3],53,-.035);once('open-hit',lt>.15,()=>fx.impact([5,19,-11],.75,'steel'));
   }else if(s.id==='crossfire'){
    for(let i=0;i<3;i++){const p=fly(i,a=>vec([Math.sin(a+i*2)*17,14+i*3,-18+Math.cos(a+i)*4]),lt);fire(i,[0,18,-2],lt);}
    const g=fight(t,[-9,20,-18],1.2);g.left=[-3,21,-6];g.right=[4,17,-8];g.bossYaw=-.18+lt*.2;giant.update(g);
    cam([-11+lt*3,21,-23],[0,19,-3],48,.025);once('block',lt>.55,()=>{fx.impact([-3,21,-6],1,'steel');recoil=.2;});
   }else if(s.id==='launch'){
    const p=fly(0,a=>vec([-6+a*8,6+a*8,-6-a*12]),lt);const g=fight(t,p.toArray(),1.3);g.right=mix([8,18,-3],[-2,8,-10],smooth(lt/.6));giant.update(g);
    cam(p.clone().add(vec([3,2,-6])).toArray(),p.toArray(),61,-.1+lt*.06);once('launch',lt>.05,()=>fx.sonicBoom(p.toArray(),[0,.5,-1]));
   }else if(s.id==='canyon'){
    const p=fly(0,a=>vec([35+Math.sin(a*2)*2,19+a*2,70-a*36]),lt);fly(1,a=>vec([38,24,60-a*36]),lt);
    cam(p.clone().add(vec([1,1.3,6])).toArray(),p.clone().add(vec([0,0,-8])).toArray(),70,Math.sin(lt*3)*.06);
   }else if(s.id==='breach_run'){
    const rt=lt*.85,p=replay(breach,rt);pilot(0,p.p,p.v,p.yaw,true,rt,p.pitch);rate=.85;
    cam([p.p[0]+1,p.p[1]+1.1,p.p[2]+5.5],[p.p[0],p.p[1],p.p[2]-5],70,.025*Math.sin(lt*6));
   }else if(s.id==='intercept'){
    const p=fly(0,a=>vec([-32+a*12,17,-12]),lt);fire(0,[0,18,-2],lt);
    const g=pose(t,[0,24,0],-.35+lt*.2);g.right=[8.5,18,-1.5];g.left=[-6,19,-6];giant.update(g);giant.head.rotation.y+=lt*.12;
    cam([-16,21,-26],[-9,19,-6],47,.04);once('return-fire',lt>.6,()=>fx.impact([-5,17,-13],.5,'steel'));
   }else if(s.id==='sky_punch'){
    skyPunch(lt);const target=lt<1?[0,17,-10]:mix([0,17,-10],[-7,14,-15],smooth((lt-1)/1.5));cam([13-lt*1.5,19,-26],target,43,-.025);
   }else if(s.id==='fall'){
    const age=.92+lt*.9,p=ragAt(age);fight(t,p.toArray(),1.2);cam(p.clone().add(vec([5,3,-7])).toArray(),p.toArray(),48,Math.sin(lt*2)*.09);
    once('ground',age>1.75,()=>{fx.dustRing([p.x,.15,p.z],.35);fx.impact([p.x,.25,p.z],.6,'concrete');recoil=.3;});
   }else if(s.id==='revenge'){
    for(let i=0;i<4;i++){fly(i,a=>vec([Math.sin(i*1.3+a*.9)*21,15+i*1.7,-Math.cos(i*1.3+a*.9)*21]),lt);fire(i,[0,18,-1],lt);}
    const g=fight(t,pilots[2].root.position.toArray(),1.4);g.left=mix([-8,19,-5],[6,15,-11],pulse(lt,.15,.75,1.55));giant.update(g);
    cam([25-lt*5,24,-26],[0,17,0],57,-.04);once('counter',lt>1.1,()=>fx.impact([6,15,-11],.8,'steel'));
   }else if(s.id==='sweep_dodge'){
    const dodge=pulse(lt,.35,.85,1.5),p=fly(0,a=>vec([-12+a*12,16-pulse(a,.35,.85,1.5)*5,-12]),lt,{roll:dodge*1.4});
    const g=pose(t);g.left=mix([-11,17,-5],[8,17,-11],smooth(lt/1.15));g.right=[7,20,-4];g.bossYaw=lt*.19;giant.update(g);
    if(lt>1.1)fire(0,[0,18,-2],lt);cam(p.clone().add(vec([3,2,-9])).toArray(),p.clone().add(vec([0,2,2])).toArray(),60,-dodge*.15);
    once('dodge',lt>.65,()=>fx.sonicBoom(p.toArray(),[1,-.2,0]));
   }else if(s.id==='volley'){
    const g=pose(t);g.right=mix([7,15,-4],[5,19,-10],smooth(lt/.25));g.left=[-6,20,-6];g.bossYaw=-.15;giant.update(g);
    cam([13,21,-21],[4,19,-6],47,-.03);
    for(let i=0;i<8;i++){const age=lt-.12-i*.11;if(age<0)continue;const p=vec([5+(i%2)*.3,19,-12-age*26]),dir=vec([.1,Math.sin(i)*.08,-1]).normalize();rocket(i,p,dir,t);}
   }else if(s.id==='chase_wide'||s.id==='chase_roll'||s.id==='missile_trap'){
    chase(t-18.5,s.id==='chase_wide'?'wide':s.id==='chase_roll'?'roll':'trap',t);
   }else if(s.id==='tower_swat'){
    replay(collapse,lt*1.8);rate=1.8;
    const g=pose(t,[49,24,70],-Math.PI/2);g.right=mix([52,18,72],[62,6,70],smooth(lt/.3));g.left=[47,18,62];g.bossYaw-=smooth(lt/.6)*.25;giant.update(g);
    cam([36+lt*2,10+lt*3,109],[69+lt*5,15,70],59,-.025);once('swat',lt>.3,()=>{fx.impact([62,6,70],1.4,'brick');recoil=.5;});
   }else if(s.id==='pincer'){
    for(let i=0;i<3;i++){fly(i,a=>vec([Math.sin(i*2.1+a)*17,18+i*2,-Math.cos(i*2.1+a)*17]),lt);fire(i,[0,18,-1],lt);}
    const g=fight(t,pilots[1].root.position.toArray(),1.4);g.left=[-5,21,-5];g.right=[7,17,-8];giant.update(g);
    cam([-17+lt*3,27,-18],[0,18,0],55,.06);
   }else if(s.id==='uppercut'){
    skyPunch(lt,true);cam([10-lt*2,17+lt*2,-24],[-3,17+smooth((lt-.85)/1.15)*4,-7],45,.03);
   }else if(s.id==='charge'){
    const p=fly(0,a=>vec([7-a*2,18,-17-a*2]),lt,{soar:false});const g=fight(t,p.toArray(),1.4);g.right=mix([8,18,-4],[5,18,-12],smooth(lt));giant.update(g);
    cam(p.clone().add(vec([3.5,1.7,-5])).toArray(),p.clone().add(vec([-2,0,4])).toArray(),45,-.08);
    fx.particle(fx.flares,p.clone().add(vec([-.3,.5,-.7])).toArray(),{life:.1,size:.35+lt*.9,color:new T.Color(0x96edff)});
   }else if(s.id==='heavy'){
    const p=fly(0,a=>vec([5-a*5,18+a,-19]),lt,{soar:false});const hit=lt>.4,g=pose(t);g.right=mix([5,18,-12],[8,12,-5],smooth((lt-.4)/.7));g.left=[-7,16,-5];g.head[1]-=smooth((lt-.4)/.6)*2;g.bossYaw=.12+Math.sin(lt*20)*.03*hit;giant.update(g);
    cam([14-lt*4,21,-25],[0,18,-1],49,-.04);once('heavy',hit,()=>{fx.shot({from:p.toArray(),to:[0,18,-2.8],hit:true,weak:true},0xffbc54);fx.reactorExplosion([0,18,-3],1.4);recoil=.7;});
   }else if(s.id==='reactor'){
    death.update(lt);const g=death.failingPose(lt);g.left=[-6,15-lt*3,-5];g.right=[5,18-lt*4,-10];giant.update(g);giant.body.rotateX(-lt*.09);
    cam([12-lt*5,21,-28],[0,17,0],46,Math.sin(lt*19)*.01);
   }else if(s.id==='breakup'){
    death.update(1.5+lt*1.3);cam([15-lt*4,20+lt*5,-33],[0,13-lt*3,0],55,-.025);rate=1.3;
   }else if(s.id==='exit'){
    death.update(4.7+lt);const p=fly(0,a=>vec([5-a*16,11-a*2,-7-a*22]),lt);cam(p.clone().add(vec([3,2,-8])).toArray(),[0,9,-1],60,-.06);once('exit',lt>.02,()=>fx.sonicBoom(p.toArray(),[-.4,0,-1]));
   }
   recoil*=Math.exp(-dt*14);camera.rotateZ(Math.sin(t*79)*recoil*.035);camera.position.y+=Math.sin(t*103)*recoil*.12;
   return rate;
  },
  diagnostics(){return {ragdollParts:punch.initial.parts.length,chaseMissiles:8,authoredNearMissTimes:nearTimes,shot:activeShot};}
 };
}
