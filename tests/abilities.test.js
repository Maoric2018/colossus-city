import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {launchMissile,updateMissiles,steerMissile} from '../server/abilities.js';
import {C} from '../shared/config.js';
import {v,arr,add,sub,rotateYaw,len} from '../shared/math.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
await physicsReady;
const ws={send(){},readyState:1};
function raider(){const r=new Room('ABC123'),c=r.attach(ws,'raider','pilot'),p=r.players.get(c.id);r.attach(ws,'boss','giant');r.spawn(p,v(0,15,55));return {r,c,p};}
function ticks(r,n){for(let i=0;i<n;i++)r.step();}
test('server preserves seven-metre hand travel; artificial yaw alone cannot hit a raider',()=>{
 const r=new Room('ABC123');try{const c=r.attach(ws,'boss','vr'),pose={type:'pose',head:[0,23.8,0],left:[-5.6,16,-4],right:[5.6,16,-4],yaw:0,reset:true};r.input(c,pose);r.step();pose.reset=false;for(let i=0;i<15;i++){r.input(c,pose);r.step();}pose.right=[12.6,16,-4];r.input(c,pose);r.step();assert.ok(Math.abs(r.boss.right.x-12.6)<1e-6);
 const pilot=r.attach(ws,'raider','target'),p=r.players.get(pilot.id),before={...r.boss.right};r.spawn(p,add(before,v(.4,0,0)));p.invulnerable=0;
 const turn=.12,head=r.boss.head;pose.left=arr(add(head,rotateYaw(sub(r.boss.left,head),turn)));pose.right=arr(add(head,rotateYaw(sub(before,head),turn)));pose.yaw=turn;pose.turnDelta=turn;r.input(c,pose);r.step();assert.equal(p.hp,100);
 // Two queued pose messages can arrive before a physics tick after Wi-Fi jitter.
 const left=r.boss.left,right=r.boss.right;for(let n=1;n<=2;n++){pose.left=arr(add(head,rotateYaw(sub(left,head),turn*n)));pose.right=arr(add(head,rotateYaw(sub(right,head),turn*n)));pose.turnDelta=turn;r.input(c,pose);}r.spawn(p,{x:pose.right[0],y:pose.right[1],z:pose.right[2]});p.invulnerable=0;r.step();assert.equal(p.hp,100);
 }finally{r.dispose();}
});
test('soaring exceeds hover speed, follows pitch and replicates its mode',()=>{
 const {r,c,p}=raider();try{r.spawn(p,v(0,34,65));for(let i=0;i<80;i++){r.input(c,{type:'input',yaw:0,pitch:.2,soar:true,z:-1});r.step();}assert.ok(len(p.body.linvel())>C.PLAYER_SPEED*2);assert.ok(p.body.linvel().y>2);assert.equal(p.soaring,true);const state=decodeSnapshot(encodeSnapshot(r.snapshot())).players.find(x=>x.id===p.id);assert.ok(state.flags&16);assert.ok(Math.abs(state.pitch-.2)<.001);
 r.input(c,{type:'input',yaw:0,pitch:0,soar:false});r.step();assert.equal(p.soaring,false);
 }finally{r.dispose();}
});
test('directional dodge costs fuel, has a cooldown and cannot repeat a held sequence',()=>{
 const {r,c,p}=raider();try{r.input(c,{type:'input',yaw:0,pitch:0,x:1,dodge:1});r.step();assert.ok(p.body.linvel().x>40);assert.ok(p.fuel<.9);assert.ok(r.snapshot().players[0].flags&32);assert.ok(p.dodgeReady>r.time);
 for(let i=0;i<90;i++){r.input(c,{type:'input',yaw:0,pitch:0,dodge:1});r.step();}assert.equal(r.drainEvents().filter(e=>e.type==='dodge').length,1);
 p.fuel=0;r.input(c,{type:'input',yaw:0,pitch:0,dodge:2});r.step();assert.equal(r.drainEvents().filter(e=>e.type==='dodge').length,0);
 }finally{r.dispose();}
});
test('missiles collide with buildings, explode and damage the stronger structure',()=>{
 const r=new Room('ABC123');try{r.attach(ws,'boss','giant');r.boss.right=v(-12,10,-40);r.world.step();assert.equal(launchMissile(r,'right',v(0,0,-1)),true);assert.equal(launchMissile(r,'right',v(0,0,-1)),false);
 for(let i=0;i<90&&r.missiles.size;i++){r.time+=C.TICK;updateMissiles(r);r.world.step();}assert.equal(r.missiles.size,0);assert.ok(r.cells.some(c=>c.skin.hp<c.skin.maxHp));assert.ok(r.drainEvents().some(e=>e.type==='detonate'));
 }finally{r.dispose();}
});
test('a charged breach shot cracks structure, hurts the giant more and respects its cooldown',()=>{
 const {r,c,p}=raider();try{
  r.spawn(p,v(0,6,-40));p.invulnerable=0;const hp=r.bossHP;
  // Aim straight at the south twin tower's south face.
  r.input(c,{type:'input',yaw:0,pitch:0,heavy:1});r.step();
  const heavy=r.drainEvents().find(e=>e.type==='heavy');assert.ok(heavy&&heavy.structure,'the bolt hit a bay');assert.ok(p.fuel<1);assert.ok(p.heavyReady>r.time);
  r.input(c,{type:'input',yaw:0,pitch:0,heavy:2});r.step();assert.equal(r.drainEvents().filter(e=>e.type==='heavy').length,0,'cooldown blocks a second bolt');
  r.spawn(p,v(0,20,30));p.invulnerable=0;p.heavyReady=0;p.fuel=1;const aim=sub(r.boss.head,v(0,19.5,30));
  r.input(c,{type:'input',yaw:Math.atan2(-aim.x,-aim.z),pitch:Math.atan2(aim.y,Math.hypot(aim.x,aim.z)),heavy:3});r.step();
  assert.ok(hp-r.bossHP>=C.HEAVY_DAMAGE-1,'a headshot bolt deals heavy damage');assert.ok(r.boss.stagger>0);
 }finally{r.dispose();}
});
test('missiles hit a raider, respect spawn protection and reset with the round',()=>{
 const {r,c,p}=raider();try{r.spawn(p,v(0,12,-9));p.invulnerable=0;r.boss.right=v(0,12,0);r.world.step();launchMissile(r,'right',v(0,0,-1));for(let i=0;i<20&&r.missiles.size;i++){r.time+=C.TICK;updateMissiles(r);r.world.step();}assert.ok(p.hp<100);
 r.spawn(p,v(0,12,-9));r.time+=1;r.boss.right=v(0,12,0);r.world.step();launchMissile(r,'right',v(0,0,-1));for(let i=0;i<20&&r.missiles.size;i++){r.time+=C.TICK;updateMissiles(r);r.world.step();}assert.equal(p.hp,100);
 r.time+=1;launchMissile(r,'right',v(0,1,0));assert.ok(r.welcome(c).missiles.length);r.initWorld();assert.equal(r.missiles.size,0);
 }finally{r.dispose();}
});
test('raider input cannot fire giant missiles; stale tracking cannot keep firing',()=>{
 const {r,c}=raider();try{r.input(c,{type:'input',yaw:0,pitch:0,missile:true});r.step();assert.equal(r.missiles.size,0);
 const boss=r.clients.get(r.bossClient);r.input(boss,{type:'pose',head:[0,23.8,0],left:[-5,16,-4],right:[5,16,-4],yaw:0,fireRight:true,rightAim:[0,1,0],reset:true});r.step();r.input(boss,{type:'pose',head:[0,23.8,0],left:[-5,16,-4],right:[5,16,-4],yaw:0,fireRight:true,rightAim:[0,1,0]});r.step();r.input(boss,{type:'pose',tracking:false});ticks(r,70);assert.equal(r.drainEvents().filter(e=>e.type==='missile').length,1);
 }finally{r.dispose();}
});

test('missile homing is gentle, forward-only and ignores protected or occluded players',()=>{
 const {r,p}=raider();try{
  r.spawn(p,v(4,20,-22));p.invulnerable=0;p.body.setLinvel(v(),true);r.world.updateSceneQueries();
  const missile=()=>({p:v(0,20,0),direction:[0,0,-1]});let m=missile(),d=steerMissile(r,m);
  assert.ok(d.x>0);assert.ok(Math.acos(-d.z)<=C.MISSILE_TURN_RATE*C.TICK+1e-7);assert.ok(Math.abs(len(d)-1)<1e-6);
  p.invulnerable=r.time+10;m=missile();assert.deepEqual(steerMissile(r,m),v(0,0,-1));p.invulnerable=0;
  r.spawn(p,v(0,20,20));p.invulnerable=0;r.world.updateSceneQueries();assert.deepEqual(steerMissile(r,missile()),v(0,0,-1));
  r.spawn(p,v(-8,20,-100));p.invulnerable=0;r.world.updateSceneQueries();m={p:v(-12,20,-44),direction:[0,0,-1]};assert.deepEqual(steerMissile(r,m),v(0,0,-1),'The north tower blocks homing line of sight');
 }finally{r.dispose();}
});
test('guided missile corrections and late-join state use the current position and direction',()=>{
 const {r,c,p}=raider();try{
  r.spawn(p,v(5,30,-24));p.invulnerable=0;r.boss.right=v(0,30,0);r.world.updateSceneQueries();launchMissile(r,'right',v(0,0,-1));r.drainEvents();
  for(let i=0;i<3;i++){r.tick++;r.time+=C.TICK;updateMissiles(r);}const updates=r.drainEvents().filter(e=>e.type==='missile-pose');assert.equal(updates.length,1);assert.ok(updates[0].direction[0]>0);
  const w=r.welcome(c).missiles[0];assert.deepEqual(w.p,updates[0].p);assert.deepEqual(w.direction,updates[0].direction);assert.equal(w.time,r.time);
 }finally{r.dispose();}
});
