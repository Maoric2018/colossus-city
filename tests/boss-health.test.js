import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {activeEnvironment as city} from '../shared/environment.js';
import {C} from '../shared/config.js';
import {bossMaxHealth,bossHealthFraction} from '../shared/boss-health.js';
import {encodeSnapshot,decodeSnapshot,HEADER} from '../shared/protocol.js';
import {Connection} from '../src/network.js';
import {XRControl} from '../src/xr.js';
import {SpectatorViews} from '../src/spectator.js';
await physicsReady;
const socket={send(){}},environment={...city,id:'health-test',infinite:false,buildings:[city.buildings[5]],props:[]};
const create=options=>new Room('HEALTH',{environment,...options});
test('colossus health scales linearly from the solo baseline through all eight raider slots',()=>{
 assert.equal(bossMaxHealth(0),2600);
 const r=create();try{
  r.attach(socket,'boss','Giant');r.attach(socket,'spectator','Observer');assert.equal(r.bossMaxHP,2600);
  for(let n=1;n<=8;n++){r.attach(socket,'raider',`Raider ${n}`);assert.equal(r.bossMaxHP,2600*n);assert.equal(r.bossHP,r.bossMaxHP);}
  assert.throws(()=>r.attach(socket,'raider','Extra'),/full/);assert.equal(r.bossMaxHP,20800);
 }finally{r.dispose();}
});
test('joins, departures and reconnects preserve damage percentage without healing or instant death',()=>{
 const r=create();try{
  const a=r.attach(socket,'raider','A');r.hurtBoss(650,{kind:'shot'});
  const b=r.attach(socket,'raider','B');assert.equal(r.bossHP,3900);assert.equal(r.bossMaxHP,5200);
  r.detach(a.id);assert.equal(r.bossHP,1950);assert.equal(r.bossMaxHP,2600);
  for(let i=0;i<8;i++){const p=r.attach(socket,'raider','Rejoin');r.detach(p.id);assert.equal(bossHealthFraction(r),.75);}
  r.bossHP=1;const c=r.attach(socket,'raider','C');r.detach(c.id);assert.equal(r.bossHP,1);
  r.detach(b.id);assert.equal(r.bossHP,1);assert.equal(r.bossMaxHP,C.BOSS_HP);
 }finally{r.dispose();}
});
test('practice drones count, replacing a drone keeps health stable, and deaths do not rescale it',()=>{
 const r=create({practice:true});try{
  r.attach(socket,'boss','Giant');assert.equal(r.players.size,3);assert.equal(r.bossMaxHP,7800);
  r.hurtBoss(3900,{kind:'shot'});const human=r.attach(socket,'raider','Pilot');assert.equal(r.bossMaxHP,7800);assert.equal(r.bossHP,3900);
  const p=r.players.get(human.id);p.invulnerable=0;r.knockdown(p,{x:0,y:1,z:0},200);assert.ok(p.rag);r.updatePlayer(p);assert.equal(r.bossMaxHP,7800);assert.equal(r.bossHP,3900);
  r.time=p.deadUntil+.1;r.updatePlayer(p);assert.equal(p.hp,100);assert.equal(r.bossHP,3900);r.removePlayer(p.id);assert.equal(r.bossMaxHP,5200);assert.equal(r.bossHP,2600);
  r.addBots(2);assert.equal(r.bossMaxHP,10400);assert.equal(r.bossHP,5200);
 }finally{r.dispose();}
});
test('joining cannot revive a defeated giant and a fresh round restores the scaled maximum',()=>{
 const r=create();try{
  r.attach(socket,'raider','A');r.hurtBoss(r.bossHP,{kind:'shot'});r.step();assert.equal(r.phase,1);
  r.attach(socket,'raider','B');assert.equal(r.bossHP,0);assert.equal(r.bossMaxHP,5200);assert.equal(r.phase,1);
  r.initWorld();assert.equal(r.phase,0);assert.equal(r.bossHP,5200);assert.equal(r.bossMaxHP,5200);
 }finally{r.dispose();}
});
test('current and maximum HP remain paired through snapshots and client interpolation',()=>{
 const r=create(),net=new Connection(()=>{},()=>{});try{
  r.attach(socket,'raider','A');r.hurtBoss(1300,{kind:'shot'});const a=decodeSnapshot(encodeSnapshot(r.snapshot()));
  r.attach(socket,'raider','B');r.time=.2;const encoded=encodeSnapshot(r.snapshot()),b=decodeSnapshot(encoded);
  assert.equal(HEADER,140);assert.equal(b.bossHP,2600);assert.equal(b.bossMaxHP,5200);
  net.snapshots=[a,b];net.receivedAt=performance.now();const state=net.sample();assert.equal(state.bossHP,2600);assert.equal(state.bossMaxHP,5200);assert.equal(bossHealthFraction(state),.5);
  new DataView(encoded).setUint32(0,0x434f4c35,true);assert.throws(()=>decodeSnapshot(encoded),/Bad snapshot/);
 }finally{net.dispose();r.dispose();}
});
test('Quest and spectator HUDs use the scaled maximum and clamp bar widths',()=>{
 const texts=[],rects=[],ctx={clearRect(){},fillRect(...a){rects.push(a);},fillText(t){texts.push(t);}},s={bossHP:10400,bossMaxHP:20800,players:[],remaining:120};
 XRControl.prototype.paintHUD.call({hudCanvas:{getContext:()=>ctx},hudTexture:{},net:{},scale:14,reachGain:1},s,true,0);
 assert.ok(texts.some(t=>t.startsWith('CORE 50%')));assert.deepEqual(rects.filter(a=>a[1]===80).map(a=>a[2]),[955,477.5]);
 SpectatorViews.prototype.drawHUD.call({getState:()=>s,getPlayerId:()=>1,getPaused:()=>false,context:ctx});assert.ok(texts.includes('COLOSSUS · 50% CORE'));
 assert.equal(bossHealthFraction({...s,bossHP:30000}),1);assert.equal(bossHealthFraction({...s,bossHP:-10}),0);
});
