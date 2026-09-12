import test from 'node:test';
import assert from 'node:assert/strict';
import {flightStep} from '../shared/flight.js';
import {C,F} from '../shared/config.js';
import {v} from '../shared/math.js';
import {Prediction} from '../src/app/prediction.js';
import {Room,physicsReady} from '../server/room.js';

const input={x:0,z:0,up:0,yaw:0,pitch:0,soar:true,boost:false,dodge:0};
const flightState=()=>({fuel:0,soaring:false,dodgeUntil:0,dodgeReady:0,lastDodgeSeq:0});

test('holding soar starts at ground level and does not re-enter when crossing two metres',()=>{
 for(const altitude of [0,.36,1.14,1.99,2,2.01,40,C.MAX_ALTITUDE]){
  const p=flightState(),result=flightStep(p,v(0,altitude,0),v(),input,0);
  assert.equal(p.soaring,true,`soar at ${altitude} metres`);
  assert.equal(result.enteredSoar,true);assert.ok(result.velocity.z<-2);assert.equal(p.fuel,0);
 }
 const p=flightState();let entries=0;
 for(const altitude of [3,2.1,2,1.9,.36,1.9,2,2.1])entries+=Number(flightStep(p,v(0,altitude,0),v(),input,0).enteredSoar);
 assert.equal(entries,1,'descending to the ground must not interrupt soaring or replay the sonic boom');
 flightStep(p,v(0,.36,0),v(),{...input,soar:false},1);assert.equal(p.soaring,false);
});

test('client prediction can skim the ground at soaring speed and return to standing',()=>{
 const p=new Prediction();p.reset({p:[0,1.14,0],v:[0,0,0],fuel:0});
 for(let i=0;i<120;i++){p.simulate(input);assert.equal(p.state.soaring,true);assert.ok(p.pos.y>=.36);}
 assert.ok(p.pos.y<.37);assert.ok(-p.vel.z>31);assert.ok(p.pos.z<-50);
 p.simulate({...input,soar:false});assert.equal(p.state.soaring,false);assert.ok(p.pos.y>=1.14);
});

test('a resting raider can start soaring from the street, stay fast and take off',async()=>{
 await physicsReady;
 const r=new Room('LOWFLY'),socket={send(){},readyState:1};
 try{
  r.attach(socket,'boss','giant');const c=r.attach(socket,'raider','pilot'),p=r.players.get(c.id);
  r.spawn(p,v(35,1.2,10));
  for(let i=0;i<240;i++)r.step();assert.ok(p.body.isSleeping());assert.ok(p.body.translation().y<2);
  p.fuel=0;r.drainEvents();const start=p.body.translation().z;
  for(let i=0;i<90;i++){
   r.input(c,{type:'input',...input});r.step();
   assert.equal(p.soaring,true);assert.ok(p.body.translation().y>.3,'ground remains solid');assert.ok(p.body.translation().y<2);
  }
  assert.ok(start-p.body.translation().z>35);assert.ok(-p.body.linvel().z>29);assert.equal(p.hp,C.PLAYER_HP);
  assert.ok(r.snapshot().players.find(player=>player.id===p.id).flags&F.SOAR);
  assert.equal(r.drainEvents().filter(e=>e.type==='soar-start').length,1);
  for(let i=0;i<60;i++){r.input(c,{type:'input',...input,pitch:.35});r.step();}
  assert.ok(p.body.translation().y>4,'looking upward allows takeoff without a separate jump');assert.equal(p.soaring,true);
  r.input(c,{type:'input',...input,soar:false});r.step();assert.equal(p.soaring,false);
 }finally{r.dispose();}
});
