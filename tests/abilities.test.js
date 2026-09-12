import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {launchMissile,updateMissiles} from '../server/abilities.js';
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
test('missiles collide with buildings, explode and detach supported structure',()=>{
 const r=new Room('ABC123');try{r.attach(ws,'boss','giant');r.boss.right=v(0,10,-20);r.world.step();assert.equal(launchMissile(r,'right',v(-1,0,0)),true);assert.equal(launchMissile(r,'right',v(-1,0,0)),false);
 for(let i=0;i<60&&r.missiles.size;i++){r.time+=C.TICK;updateMissiles(r);r.world.step();}assert.equal(r.missiles.size,0);assert.ok(r.detached.size>0);assert.ok(r.drainEvents().some(e=>e.type==='detonate'));
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
