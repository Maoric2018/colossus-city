// Rapier 0.17.3's package main points at CommonJS inside a type:module package.
// Node needs the explicit ESM entry; browser bundlers previously hid this issue.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C,group} from '../shared/config.js';
import {activeEnvironment as city,generateCells,unsupportedCells,cellColliders} from '../shared/environment.js';
import {v,add,sub,mul,len,norm,dist,arr,vec,clamp,quatYaw,quatEuler,rotateYaw,segmentDistance,segmentAABB,raySphere,lookDir,finiteVector,sanitizeInput} from '../shared/math.js';
export const physicsReady=RAPIER.init();
const G=C.COLLISION;
const noInput=()=>({x:0,z:0,up:0,boost:false,fire:false,yaw:0,pitch:0,seq:0});
// Explicit quaternion ordering: never depend on WASM property enumeration.
const bodyPose=b=>{const p=b.translation(),q=b.rotation();return {p:[p.x,p.y,p.z],q:[q.x,q.y,q.z,q.w]};};

export class Room {
 constructor(code,{practice=false,environment=city}={}){
  this.code=code;this.env=environment;this.practice=practice;this.clients=new Map();this.players=new Map();
  this.nextPlayer=1;this.nextRag=10000;this.tick=0;this.time=0;this.round=1;this.emptySince=Date.now();this.bossClient=null;
  this.initWorld();
 }
 initWorld(){
  // Old body wrappers refer to the old WASM sets, not to the next world.
  for(const p of this.players.values()){p.body=null;p.rag=null;}
  this.world?.free();this.queue?.free();
  this.world=new RAPIER.World(v(0,C.GRAVITY,0));this.world.timestep=C.TICK;
  this.world.integrationParameters.numSolverIterations=6;
  this.queue=new RAPIER.EventQueue(true);this.colliderTags=new Map();this.cells=generateCells(this.env);
  this.cellMap=new Map();this.detached=new Set();this.debris=new Map();this.nextDebris=1000;this.rags=new Map();this.events=[];
  this.phase=0;this.remaining=C.MATCH_SECONDS;this.bossHP=C.BOSS_HP;this.kills=0;this.startTime=this.time;
  this.boss={x:0,z:0,yaw:0,head:v(0,23.8,0),left:v(-5.6,16,-4),right:v(5.6,16,-4),lastPose:-100,input:noInput(),lastInput:-100};
  this.ground=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.3,0));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(220,.3,220).setFriction(.82).setCollisionGroups(group(G.WORLD)),this.ground);
  for(const c of this.cells){
   c.hp=90;c.lastHit=-100;c.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...c.p));
   c.colliders=this.addCellColliders(c,c.body,v(),G.WORLD);this.cellMap.set(c.id,c);
  }
  for(const prop of this.env.props){if(!prop.collider)continue;
   const p=prop.position||[0,0,0],scale=prop.scale||1,half=prop.collider.half,rotation=quatEuler(...(prop.rotation||[0,0,0]));
   if(!finiteVector(half)||half.some(x=>x<=0)||!Number.isFinite(scale)||scale<=0)throw Error('Invalid prop collider');
   const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...p).setRotation(rotation));
   const off=prop.collider.offset||[0,0,0];
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(...half.map(x=>x*scale)).setTranslation(...off.map(x=>x*scale)).setCollisionGroups(group(G.WORLD)),b);
  }
  this.handBodies=['left','right'].map(side=>{
   const p=this.boss[side],body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y,p.z));
   this.world.createCollider(RAPIER.ColliderDesc.ball(C.HAND_RADIUS).setFriction(.4).setCollisionGroups(group(G.GIANT,G.DEBRIS|G.RAGDOLL)),body);return body;
  });
  for(const p of this.players.values()){p.kills=0;p.damage=0;this.spawn(p);}
 }
 addCellColliders(c,body,offset,membership){
  return cellColliders(c).map(a=>{
   const co=this.world.createCollider(RAPIER.ColliderDesc.cuboid(a[3],a[4],a[5])
    .setTranslation(a[0]+offset.x,a[1]+offset.y,a[2]+offset.z).setDensity(22).setFriction(.65).setRestitution(.06)
    .setCollisionGroups(group(membership)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
   this.colliderTags.set(co.handle,{cell:c.id});return co.handle;
  });
 }
 event(e){this.events.push(e);}
 attach(ws,role,name){
  if(role==='boss'&&this.bossClient)throw Error('This room already has a giant. Join as a raider.');
  if(role==='raider'&&[...this.players.values()].filter(p=>!p.bot).length>=C.MAX_RAIDERS)throw Error('The eight raider slots are full.');
  const id=this.nextPlayer++,client={id,ws,role,name};this.clients.set(id,client);
  if(role==='boss'){this.bossClient=id;this.boss.lastPose=-100;this.boss.input=noInput();}
  if(role==='raider'){
   // Human players replace practice bots before consuming extra physics budget.
   const bot=[...this.players.values()].find(p=>p.bot);if(bot)this.removePlayer(bot.id);
   const p={id,name,bot:false,input:noInput(),lastInput:-100,kills:0,damage:0};this.players.set(id,p);this.spawn(p);
  }
  if(this.practice&&!this.players.size)this.addBots(3);
  this.emptySince=null;return client;
 }
 addBots(n=3){for(let i=0;i<n&&this.players.size<C.MAX_RAIDERS;i++){
  const id=this.nextPlayer++,p={id,name:`DRONE ${i+1}`,bot:true,input:noInput(),lastInput:this.time,kills:0,damage:0};this.players.set(id,p);this.spawn(p);
 }}
 removePlayer(id){const p=this.players.get(id);if(p?.body)this.removeBody(p.body);if(p?.rag)this.removeRag(p.rag);this.players.delete(id);}
 detach(id){const c=this.clients.get(id);if(!c)return;this.clients.delete(id);if(this.bossClient===id){this.bossClient=null;this.boss.input=noInput();}this.removePlayer(id);if(!this.clients.size)this.emptySince=Date.now();}
 spawn(p,at){
  if(p.body)this.removeBody(p.body);
  const spawn=at||vec(this.env.spawns[(p.id-1)%this.env.spawns.length]);
  p.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x,Math.max(1.2,spawn.y),spawn.z).lockRotations().setLinearDamping(.12).setCcdEnabled(true));
  const co=this.world.createCollider(RAPIER.ColliderDesc.capsule(.8,.34).setMass(70).setFriction(.05).setRestitution(0).setCollisionGroups(group(G.PLAYER,G.WORLD|G.DEBRIS)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),p.body);
  this.colliderTags.set(co.handle,{player:p.id});p.hp=C.PLAYER_HP;p.fuel=1;p.rag=null;p.deadUntil=0;p.recoverAt=0;p.invulnerable=this.time+C.INVULNERABLE_SECONDS;p.lastShot=-1;
 }
 removeBody(body){if(!body||!body.isValid())return;for(let i=0;i<body.numColliders();i++)this.colliderTags.delete(body.collider(i).handle);this.world.removeRigidBody(body);}
 input(client,m){
  if(m.type==='input'){
   const data=sanitizeInput(m);if(!data)return;
   if(client.role==='raider'){const p=this.players.get(client.id);if(p){p.input=data;p.lastInput=this.time;}}
   else if(client.role==='boss'){this.boss.input=data;this.boss.lastInput=this.time;this.boss.desktop=true;}
  }
  if(m.type==='pose'&&client.role==='boss'){
   if(m.tracking===false){this.boss.desktop=false;this.boss.lastPose=-100;this.boss.moveX=0;this.boss.moveZ=0;return;}
   if(!finiteVector(m.head)||!finiteVector(m.left)||!finiteVector(m.right)||!Number.isFinite(m.yaw))return;
   const b=this.boss,head=vec(m.head),l=vec(m.left),r=vec(m.right);
   if(head.y<5||head.y>38||Math.hypot(head.x-b.x,head.z-b.z)>18||dist(head,l)>23||dist(head,r)>23)return;
   // Session entry, snap turns, recentering and recovered tracking are teleports,
   // not swings. Rebase collision bodies and suppress contact briefly.
   if(m.reset===true||b.desktop||this.time-b.lastPose>=.4){b.resetPose=true;b.noContactUntil=this.time+.2;}
   b.target={head,left:l,right:r};b.yaw=clamp(m.yaw,-1e5,1e5);b.lastPose=this.time;b.desktop=false;
   b.moveX=clamp(Number(m.moveX)||0,-1,1);b.moveZ=clamp(Number(m.moveZ)||0,-1,1);
  }
  if(m.type==='restart'&&client.id===this.hostId()&&this.phase!==0){this.round++;this.initWorld();this.event({type:'reset'});}
 }
 hostId(){return this.clients.keys().next().value;}
 welcome(client){return {type:'welcome',id:client.id,role:client.role,room:this.code,practice:this.practice,environment:this.env.id,round:this.round,host:this.hostId(),
  clearedCells:this.cells.filter(c=>this.detached.has(c.id)&&!this.debris.has(c.entity)).map(c=>c.id),entities:[...this.debris.values()].map(e=>this.debrisMeta(e)),rags:[...this.rags.values()].map(r=>this.ragMeta(r)),roster:this.roster()};}
 roster(){return [...this.clients.values()].map(c=>({id:c.id,name:c.name,role:c.role})).concat([...this.players.values()].filter(p=>p.bot).map(p=>({id:p.id,name:p.name,role:'bot'})));}
 debrisMeta(e){return {type:'debris',id:e.id,cells:e.cells,origin:e.origin,...bodyPose(e.body)};}
 ragMeta(r){return {type:'rag',id:r.id,player:r.player,parts:r.parts.map(p=>({id:p.id,size:p.size,...bodyPose(p.body)}))};}

 step(){
  this.tick++;this.time+=C.TICK;
  if(this.phase){this.world.step(this.queue);this.queue.drainCollisionEvents(()=>{});if(this.time-this.endedAt>20){this.round++;this.initWorld();this.event({type:'reset'});}return;}
  // Wait for at least one raider. An AI giant fills an empty boss seat; it is not a second authority.
  if(this.players.size)this.remaining=Math.max(0,C.MATCH_SECONDS-(this.time-this.startTime));else this.startTime=this.time;
  this.updateBoss();
  for(const p of this.players.values())this.updatePlayer(p);
  for(const e of this.debris.values())e.preImpactSpeed=len(e.body.linvel());
  this.world.step(this.queue);
  const hits=[],fractures=new Set();
  this.queue.drainCollisionEvents((a,b,started)=>{
   if(!started)return;const ta=this.colliderTags.get(a),tb=this.colliderTags.get(b);
   const pt=ta?.player?ta:tb?.player?tb:null,ct=ta?.cell?ta:tb?.cell?tb:null;
   for(const tag of [ta,tb])if(tag?.cell){const c=this.cellMap.get(tag.cell),e=this.debris.get(c?.entity);if(e&&e.cells.length>1&&e.preImpactSpeed>7&&this.time-e.born>.5)fractures.add(e.id);}
   if(pt&&ct){const c=this.cellMap.get(ct.cell),p=this.players.get(pt.player);if(c?.entity&&p?.body){
    const e=this.debris.get(c.entity),speed=e?len(e.body.linvel()):0;if(speed>4)hits.push([p,mul(norm(sub(p.body.translation(),e.body.translation())),Math.min(23,speed)),speed*6]);
   }}
  });
  for(const [p,kick,damage] of hits)if(p.body)this.knockdown(p,kick,damage);
  for(const id of [...fractures].slice(0,3))this.splitDebris(id);
  for(const [id,e] of this.debris){
   const pos=e.body.translation();
   if(pos.y<-30||(this.time-e.born>C.CHUNK_LIFETIME&&e.body.isSleeping())){
    this.removeBody(e.body);this.debris.delete(id);this.event({type:'remove',id});
   }
  }
  for(const [id,r] of this.rags)if(this.time-r.born>9)this.removeRag(id);
  if(this.bossHP<=0||this.remaining<=0){this.phase=this.bossHP<=0?1:2;this.endedAt=this.time;this.event({type:'end',winner:this.phase===1?'raiders':'giant'});}
 }
 updatePlayer(p){
  if(p.rag){
   const r=this.rags.get(p.rag),at=r?.parts[0].body.translation()||v(0,2,60);
   if(p.hp<=0&&this.time>=p.deadUntil){this.spawn(p);return;}
   if(p.hp>0&&this.time>=p.recoverAt){const hp=p.hp;this.removeRag(p.rag);this.spawn(p,v(clamp(at.x,-68,68),clamp(at.y,1.2,38),clamp(at.z,-68,68)));p.hp=hp;return;}
   return;
  }
  if(!p.body)return;
  if(p.bot){
   const at=p.body.translation(),target=this.boss.head,angle=this.time*.18+p.id*2;
   const goal=v(this.boss.x+Math.sin(angle)*19,12+Math.sin(this.time*.45+p.id)*6,this.boss.z+Math.cos(angle)*19);
   const dir=norm(sub(goal,at)),aim=sub(target,at);p.input={x:dir.x,z:dir.z,world:true,up:clamp((goal.y-at.y)/4,-1,1),boost:false,fire:true,
    yaw:Math.atan2(-aim.x,-aim.z),pitch:Math.atan2(aim.y,Math.hypot(aim.x,aim.z)),seq:0};p.lastInput=this.time;
  }
  const i=this.time-p.lastInput>.45?noInput():p.input;
  const at=p.body.translation(),lv=p.body.linvel();
  if(at.y<-8||Math.hypot(at.x,at.z)>108){this.knockdown(p,v(0,4,0),200);return;}
  let movement=i.world?v(i.x,0,i.z):rotateYaw(v(i.x,0,i.z),i.yaw);
  if(len(movement)>1)movement=norm(movement);
  const boosted=i.boost&&p.fuel>.02,sp=boosted?C.BOOST_SPEED:C.PLAYER_SPEED;
  const air=i.up>0&&p.fuel>0;
  const desiredY=air?C.ASCEND_SPEED*i.up:(i.up<0?-10:at.y>2?-2.3:lv.y);
  p.fuel=clamp(p.fuel+((air||boosted)?-.14:(at.y<2?.48:.16))*C.TICK,0,1);
  const a=Math.min(1,C.TICK*6),av=air||at.y>2?.12:0;
  let vx=lv.x+(movement.x*sp-lv.x)*a,vz=lv.z+(movement.z*sp-lv.z)*a;
  if(Math.hypot(at.x,at.z)>C.ARENA_RADIUS){vx-=at.x*.04;vz-=at.z*.04;}
  let vy=lv.y+(desiredY-lv.y)*av;if(at.y>C.MAX_ALTITUDE)vy=Math.min(vy,-4);
  p.body.setLinvel(v(vx,vy,vz),true);
  if(i.fire&&this.time-p.lastShot>C.FIRE_INTERVAL)this.shoot(p);
 }
 shoot(p){
  if(!p.body||p.hp<=0)return;p.lastShot=this.time;
  const origin=add(p.body.translation(),v(0,.5,0)),direction=lookDir(p.input.aimYaw??p.input.yaw,p.input.aimPitch??p.input.pitch),b=this.boss;
  let distance=C.SHOT_RANGE,damage=0,weak=false;
  for(const [center,radius,mult] of [[b.head,C.HEAD_RADIUS,1.8],[v(b.head.x,b.head.y-7.2,b.head.z),4.1,1],[b.left,C.HAND_RADIUS,.55],[b.right,C.HAND_RADIUS,.55]]){
   const t=raySphere(origin,direction,center,radius);if(t<distance){distance=t;damage=C.SHOT_DAMAGE*mult;weak=mult>1;}
  }
  const ray=new RAPIER.Ray(origin,direction);
  const obstruction=this.world.castRay(ray,distance,true,undefined,group(G.PLAYER,G.WORLD|G.DEBRIS));
  if(obstruction){distance=obstruction.timeOfImpact??obstruction.toi;damage=0;}
  if(damage){if(p.bot)damage*=.26;this.bossHP=Math.max(0,this.bossHP-damage);p.damage+=damage;}
  this.event({type:'shot',player:p.id,from:arr(origin),to:arr(add(origin,mul(direction,distance))),hit:damage>0,weak});
 }
 updateBoss(){
  const b=this.boss,prevL={...b.left},prevR={...b.right};
  if(this.bossClient&&this.time-b.lastPose<.4&&!b.desktop){
   const d=rotateYaw(v(b.moveX||0,0,b.moveZ||0),b.yaw),step=mul(len(d)>1?norm(d):d,C.GIANT_SPEED*C.TICK);
   b.x=clamp(b.x+step.x,-48,48);b.z=clamp(b.z+step.z,-48,48);
   for(const key of ['head','left','right']){const delta=sub(b.target[key],b[key]);b[key]=b.resetPose?{...b.target[key]}:add(b[key],mul(delta,Math.min(1,(key==='head'?30:C.MAX_HAND_SPEED)*C.TICK/(len(delta)||1))));}
  }else if(this.bossClient&&b.desktop){
   const i=this.time-b.lastInput<.45?b.input:noInput();b.yaw=i.yaw;
   const dir=rotateYaw(v(i.x,0,i.z),b.yaw);b.x=clamp(b.x+dir.x*C.GIANT_SPEED*C.TICK,-48,48);b.z=clamp(b.z+dir.z*C.GIANT_SPEED*C.TICK,-48,48);
   b.head=v(b.x,23.8,b.z);let l=v(-5.6,15.5,-4),r=v(5.6,15.5,-4);
   if(i.fire){const phase=this.time*7;const sweep=Math.sin(phase);r=v(6*sweep,10+Math.cos(phase)*5,-9-Math.max(0,-Math.cos(phase))*5);}
   if(i.up>0){const t=Math.sin(this.time*6);l=v(-5,9+t*8,-9);r=v(5,9+t*8,-9);}
   b.left=add(v(b.x,0,b.z),rotateYaw(l,b.yaw));b.right=add(v(b.x,0,b.z),rotateYaw(r,b.yaw));
  }else if(!this.bossClient){
   // Clearly labelled practice/stand-in AI. It yields immediately when a headset joins.
   const theta=this.time*.12;b.x=Math.sin(theta)*6;b.z=Math.cos(theta)*6;
   const target=[...this.players.values()].find(p=>p.body)?.body.translation();
   if(target)b.yaw=Math.atan2(b.x-target.x,b.z-target.z);
   b.head=v(b.x,23.8+Math.sin(this.time*.8)*.3,b.z);
   b.left=add(v(b.x,0,b.z),rotateYaw(v(-5+Math.sin(this.time*.7)*7,13+Math.sin(this.time*1.1)*7,-7),b.yaw));
   b.right=add(v(b.x,0,b.z),rotateYaw(v(5+Math.sin(this.time*1.25)*9,12+Math.cos(this.time*1.6)*9,-8),b.yaw));
  }
  const canAttack=(!this.bossClient||(b.desktop?this.time-b.lastInput<.45:this.time-b.lastPose<.4))&&!(this.time<b.noContactUntil);
  // Raiders cannot fly through the giant's torso/head as if they were non-solid visuals.
  for(const p of this.players.values())if(canAttack&&p.body){
   const at=p.body.translation();for(const [center,radius] of [[b.head,2.55],[v(b.head.x,b.head.y-7.2,b.head.z),4.5]]){
    if(dist(at,center)<radius){this.knockdown(p,add(mul(norm(sub(at,center)),13),v(0,5,0)),55);break;}
   }
  }
  // Stale tracking holds hands still. Never extrapolate a disconnected punch.
  for(const [idx,key,prev] of [[0,'left',prevL],[1,'right',prevR]]){
   const hand=this.handBodies[idx];
   for(let i=0;i<hand.numColliders();i++)hand.collider(i).setEnabled(canAttack);
   if(b.resetPose){hand.setTranslation(b[key],true);hand.setNextKinematicTranslation(b[key]);continue;}
   let displacement=sub(b[key],prev);const speed=Math.min(C.MAX_HAND_SPEED,len(displacement)/C.TICK);
   if(len(displacement)>C.MAX_HAND_SPEED*C.TICK)b[key]=add(prev,mul(norm(displacement),C.MAX_HAND_SPEED*C.TICK));
   displacement=sub(b[key],prev);hand.setNextKinematicTranslation(b[key]);
   if(!canAttack)continue;
   for(const p of this.players.values())if(p.body&&len(sub(mul(displacement,1/C.TICK),p.body.linvel()))>4&&segmentDistance(p.body.translation(),prev,b[key])<C.HAND_RADIUS+.65){
    const direction=speed>3?norm(displacement):norm(sub(p.body.translation(),b[key]));const kick=add(mul(direction,clamp(speed*.65,8,35)),v(0,6,0));this.knockdown(p,kick,25+speed*1.15);
   }
   // Swept volume avoids tunnelling through storeys between network pose samples.
   if(speed>=3){const hit=[];
    for(const c of this.cells)if(!this.detached.has(c.id)&&this.time-c.lastHit>.28&&segmentAABB(prev,b[key],vec(c.p),mul(vec(c.size),.5),C.HAND_RADIUS*.8)){
     c.lastHit=this.time;c.hp-=speed*1.6+18;if(c.hp<=0)hit.push(c.id);if(hit.length>=5)break;
    }
    if(hit.length)this.breakCells(hit,mul(norm(displacement),Math.min(16,speed*.28)));
   }
  }
  b.resetPose=false;
 }
 breakCells(requested,kick=v(0,0,0)){
  const hits=[...new Set(requested)].filter(id=>this.cellMap.has(id)&&!this.detached.has(id));if(!hits.length)return;
  const prospective=new Set([...this.detached,...hits]),unsupported=unsupportedCells(this.cells,prospective);
  let batches=hits.map(id=>[id]);const grouped=new Map();
  for(const id of unsupported){const c=this.cellMap.get(id),key=`${c.building}:${c.floor}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(id);}
  batches.push(...grouped.values());
  if(this.debris.size+batches.length>C.MAX_ACTIVE_CHUNKS){
   // Coarse fracture LOD: unsupported floors stay a single rigid structural island.
   // Never delete falling pieces or freeze them in midair to meet a budget.
   const coarse=new Map();for(const id of [...hits,...unsupported]){const c=this.cellMap.get(id);if(!coarse.has(c.building))coarse.set(c.building,[]);coarse.get(c.building).push(id);}batches=[...coarse.values()];
   if(this.debris.size+batches.length>C.MAX_ACTIVE_CHUNKS)return; // intact until capacity returns
  }
  for(const ids of batches){
   let origin=v();for(const id of ids)origin=add(origin,vec(this.cellMap.get(id).p));origin=mul(origin,1/ids.length);
   for(const id of ids){const c=this.cellMap.get(id);this.removeBody(c.body);this.detached.add(id);}
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x,origin.y,origin.z).setLinearDamping(.1).setAngularDamping(.45).setCcdEnabled(true));
   const id=this.nextDebris++,entity={id,body,cells:ids,origin:arr(origin),born:this.time};
   for(const cid of ids){const c=this.cellMap.get(cid);c.entity=id;c.colliders=this.addCellColliders(c,body,sub(vec(c.p),origin),G.DEBRIS);}
   body.setLinvel(add(mul(kick,ids.length>1?.34:1),v(0,1,0)),true);
   body.setAngvel(v(kick.z*.035,0,-kick.x*.035),true);this.debris.set(id,entity);this.event(this.debrisMeta(entity));
  }
  this.event({type:'impact',p:this.cellMap.get(hits[0]).p,power:Math.min(1,batches.length/10+.3)});
 }

 splitDebris(id){
  const e=this.debris.get(id);if(!e||e.cells.length<2||this.debris.size+e.cells.length-1>C.MAX_ACTIVE_CHUNKS)return;
  const state=bodyPose(e.body),velocity=e.body.linvel(),omega=e.body.angvel(),q=e.body.rotation();
  // Rotate offsets by the body's quaternion without depending on a client renderer.
  const rotate=p=>{const u=v(q.x,q.y,q.z),uv=v(u.y*p.z-u.z*p.y,u.z*p.x-u.x*p.z,u.x*p.y-u.y*p.x),uuv=v(u.y*uv.z-u.z*uv.y,u.z*uv.x-u.x*uv.z,u.x*uv.y-u.y*uv.x);return add(p,add(mul(uv,2*q.w),mul(uuv,2)));};
  this.removeBody(e.body);this.debris.delete(id);this.event({type:'remove',id});
  for(const cid of e.cells){
   const c=this.cellMap.get(cid),off=rotate(sub(vec(c.p),vec(e.origin))),pos=add(vec(state.p),off);
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(q).setLinearDamping(.12).setAngularDamping(.6).setCcdEnabled(true));
   const newId=this.nextDebris++;c.entity=newId;c.colliders=this.addCellColliders(c,body,v(),G.DEBRIS);
   const tangent=v(omega.y*off.z-omega.z*off.y,omega.z*off.x-omega.x*off.z,omega.x*off.y-omega.y*off.x);
   // Preserve linear + rotational velocity, with a small fracture-separation impulse.
   body.setLinvel(add(add(velocity,tangent),mul(norm(off),.7)),true);body.setAngvel(omega,true);
   const part={id:newId,body,cells:[cid],origin:c.p,born:this.time};this.debris.set(newId,part);this.event(this.debrisMeta(part));
  }
  this.event({type:'impact',p:state.p,power:.4});
 }
 knockdown(p,kick,damage){
  if(!p.body||this.time<p.invulnerable)return;
  p.hp=Math.max(0,p.hp-damage);const at=p.body.translation(),velocity=add(p.body.linvel(),kick);
  this.removeBody(p.body);p.body=null;const rag=this.makeRag(p,at,velocity);p.rag=rag.id;p.recoverAt=this.time+2.1;
  if(p.hp<=0){p.deadUntil=this.time+C.RESPAWN_SECONDS;this.kills++;this.event({type:'kill',player:p.id});}
  this.event({type:'impact',p:arr(at),power:.45});
 }
 makeRag(p,at,velocity){
  if(this.rags.size>=C.MAX_RAGDOLLS){const candidate=[...this.rags.values()].find(r=>![...this.players.values()].some(p=>p.rag===r.id));if(candidate)this.removeRag(candidate.id);}
  const defs=[
   {name:'hips',o:[0,0,0],s:[.52,.36,.32]}, {name:'chest',o:[0,.38,0],s:[.62,.42,.34]}, {name:'head',o:[0,.82,0],s:[.36,.38,.36]},
   {name:'upperL',o:[-.48,.35,0],s:[.24,.44,.24]},{name:'lowerL',o:[-.57,-.05,0],s:[.22,.4,.22]},
   {name:'upperR',o:[.48,.35,0],s:[.24,.44,.24]},{name:'lowerR',o:[.57,-.05,0],s:[.22,.4,.22]},
   {name:'thighL',o:[-.18,-.42,0],s:[.27,.5,.29]},{name:'shinL',o:[-.18,-.91,0],s:[.24,.45,.26]},
   {name:'thighR',o:[.18,-.42,0],s:[.27,.5,.29]},{name:'shinR',o:[.18,-.91,0],s:[.24,.45,.26]}
  ];
  const yaw=p.input.yaw||0,parts=defs.map((d,i)=>{
   const pos=add(at,rotateYaw(vec(d.o),yaw));
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(quatYaw(yaw)).setLinearDamping(.12).setAngularDamping(.6).setCcdEnabled(true));
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.s[0]/2,d.s[1]/2,d.s[2]/2).setMass(i===1?22:i===0?14:5).setFriction(.65).setRestitution(.04).setCollisionGroups(group(G.RAGDOLL,G.WORLD|G.DEBRIS|G.GIANT)),body);
   body.setLinvel(velocity,true);body.setAngvel(v(velocity.z*.14,0,-velocity.x*.14),true);
   return {id:this.nextRag++,body,size:d.s,offset:d.o};
  });
  const links=[[0,1,[0,.17,0]],[1,2,[0,.62,0]],[1,3,[-.35,.53,0]],[3,4,[-.55,.13,0],true],[1,5,[.35,.53,0]],[5,6,[.55,.13,0],true],[0,7,[-.18,-.2,0]],[7,8,[-.18,-.67,0],true],[0,9,[.18,-.2,0]],[9,10,[.18,-.67,0],true]];
  for(const [a,b,anchor,hinge] of links){
   const aa=sub(vec(anchor),vec(defs[a].o)),ab=sub(vec(anchor),vec(defs[b].o));
   const params=hinge?RAPIER.JointData.revolute(aa,ab,v(1,0,0)):RAPIER.JointData.spherical(aa,ab);
   const joint=this.world.createImpulseJoint(params,parts[a].body,parts[b].body,true);if(hinge)joint.setLimits(-.15,2.2);
  }
  const rag={id:parts[0].id,player:p.id,parts,born:this.time};this.rags.set(rag.id,rag);this.event(this.ragMeta(rag));return rag;
 }
 removeRag(id){const r=this.rags.get(id);if(!r)return;for(const part of r.parts){this.removeBody(part.body);this.event({type:'remove',id:part.id});}this.rags.delete(id);}
 snapshot(){
  const b=this.boss;
  return {tick:this.tick,time:this.time,bossHP:this.bossHP,remaining:this.remaining,kills:this.kills,head:arr(b.head),left:arr(b.left),right:arr(b.right),bossYaw:b.yaw,bossX:b.x,bossZ:b.z,
   damage:this.detached.size/this.cells.length*100,phase:this.phase,round:this.round,
   players:[...this.players.values()].map(p=>{const rb=p.body||this.rags.get(p.rag)?.parts[0].body;return {id:p.id,flags:(p.rag?2:0)|(p.hp<=0?1:0)|(this.time<p.invulnerable?4:0)|(p.bot?8:0),p:rb?arr(rb.translation()):[0,-20,0],v:rb?arr(rb.linvel()):[0,0,0],yaw:p.input.yaw,hp:p.hp,fuel:p.fuel,seq:p.input.seq};}),
   bodies:[...[...this.debris.values()].map(e=>({id:e.id,...bodyPose(e.body)})),...[...this.rags.values()].flatMap(r=>r.parts.map(p=>({id:p.id,...bodyPose(p.body)})))]
  };
 }
 drainEvents(){const e=this.events;this.events=[];return e;}
 dispose(){this.world.free();this.queue.free();}
}
