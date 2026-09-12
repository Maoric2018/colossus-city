import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {ROUND_END} from '../shared/round-end.js';
import {C} from '../shared/config.js';
import {packEvents,unpackEvents} from '../shared/event-codec.js';
await physicsReady;
const environment={...midtown,infinite:false,buildings:[],props:[]},socket={send(){}};
test('death is emitted once with a stable shared pose and is resumed by late viewers',()=>{
 const room=new Room('DEATH1',{environment});try{
  const boss=room.attach(socket,'boss','robot');room.attach(socket,'raider','pilot');room.hurtBoss(room.bossHP,{kind:'shot'});room.step();
  const end=room.drainEvents().find(e=>e.type==='end');assert.equal(end.winner,'raiders');assert.equal(end.round,room.round);assert.equal(end.time,room.endedAt);assert.equal(room.phase,1);
  assert.deepEqual(unpackEvents(packEvents([end])),[end]);
  const pose=structuredClone(end.pose);room.input(boss,{type:'pose',head:[40,25,20],left:[35,20,20],right:[45,20,20],yaw:1});
  for(let i=0;i<200;i++)room.step();
  assert.deepEqual(end.pose,pose);assert.equal(room.snapshot().bossYaw,pose.bossYaw);assert.equal(room.drainEvents().filter(e=>e.type==='end').length,0);
  const late=room.welcome(room.attach(socket,'spectator','late'));assert.deepEqual(late.result,end);assert.ok(late.time-end.time>3);assert.ok(late.time-end.time<ROUND_END.results);
  const round=room.round;while(room.round===round)room.step();assert.equal(room.round,round+1);assert.equal(room.phase,0);assert.equal(room.result,null);assert.equal(room.bossHP,room.bossMaxHP);assert.ok(room.time-end.time>=ROUND_END.restart);
 }finally{room.dispose();}
});
test('surviving the timer ends the round without a Colossus death, and host restart clears the result',()=>{
 const room=new Room('END002',{environment});try{
  const host=room.attach(socket,'boss','robot');room.attach(socket,'raider','pilot');room.startTime=room.time-C.MATCH_SECONDS;room.step();
  assert.equal(room.phase,2);assert.equal(room.result.winner,'giant');assert.ok(room.bossHP>0);
  room.input(host,{type:'restart'});assert.equal(room.result,null);assert.equal(room.phase,0);assert.equal(room.round,2);
 }finally{room.dispose();}
});
