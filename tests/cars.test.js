import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {strikeCars,damageCar,updateCars,carSnapshots,carMeta,blastCars} from '../server/cars.js';
import {carPlacements,staticProps} from '../shared/props.js';
import {city} from '../shared/environment.js';
import {C} from '../shared/config.js';
import {CAR_ID_START,carShape} from '../shared/cars.js';
import {v,add,arr,dist} from '../shared/math.js';
import {identity} from '../shared/giant-rig.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
await physicsReady;
const ws={readyState:1,send(){}},ticks=(r,n)=>{for(let i=0;i<n;i++)r.step();},first=r=>r.cars.values().next().value;
function giantFixture(environment=city){
 const r=new Room('CARS01',{environment}),car=first(r),client=r.attach(ws,'boss','Quest'),at=car.body.translation();r.boss.x=at.x;r.boss.z=-125;
 const pose={type:'pose',head:[at.x,23.8,-125],left:[at.x+9,12,-121],right:[at.x,2,at.z+10],leftQuaternion:identity,rightQuaternion:identity,yaw:0};
 r.input(client,{...pose,reset:true});r.step();for(let i=0;i<15;i++){r.input(client,pose);r.step();}return {r,car,client,pose,at};
}
test('cars have independent movable bodies, no ghost static colliders and no parked pose traffic',()=>{
 const r=new Room('CARS01');try{assert.equal(r.cars.size,carPlacements(r.env).length);assert.equal(staticProps(r.env).some(p=>p.kind==='car'),false);assert.equal(carSnapshots(r).length,0);
  for(const c of r.cars.values()){assert.ok(c.body.isDynamic());assert.ok(c.body.isSleeping());assert.equal(c.body.numColliders(),1);assert.ok(c.id>=CAR_ID_START);assert.equal(r.colliderTags.get(c.collider.handle).car,c.id);}
 }finally{r.dispose();}
});
test('a gentle hand push moves an intact car; a hard hit explodes it once and leaves a movable wreck',()=>{
 const r=new Room('CARS01');try{r.attach(ws,'boss','giant');const c=first(r),start={...c.body.translation()},from=add(start,v(0,.5,6)),to=add(start,v(0,.5,-3));
  strikeCars(r,from,to,identity,2);assert.equal(c.wreck,false);assert.equal(c.hp,C.CAR_HP);ticks(r,30);assert.ok(dist(c.body.translation(),start)>.4);assert.ok(carSnapshots(r).some(p=>p.id===c.id));
  const at=c.body.translation();strikeCars(r,add(at,v(0,0,6)),add(at,v(0,0,-3)),identity,25);assert.ok(c.wreck);assert.equal(c.hp,0);assert.equal(r.drainEvents().filter(e=>e.type==='car-explode').length,1);
  const shape=carShape(c.size,true);assert.ok(Math.abs(c.collider.halfExtents().y-shape.half[1])<1e-5);assert.equal(damageCar(r,c,999),false);assert.equal(r.drainEvents().filter(e=>e.type==='car-explode').length,0);
  ticks(r,20);assert.ok(c.body.isValid());assert.equal(r.bossHP,C.BOSS_HP);assert.equal(r.boss.stagger,0);
 }finally{r.dispose();}
});
test('real tracked giant swing strikes a car and standing inside one after recenter does not explode it',()=>{
 const {r,car,client,pose,at}=giantFixture();try{
  pose.right=[at.x,2,at.z-5];r.input(client,pose);r.step();assert.ok(car.wreck);assert.equal(r.drainEvents().filter(e=>e.type==='car-explode').length,1);
  const state=decodeSnapshot(encodeSnapshot(r.snapshot())).bodies.find(b=>b.id===car.id);assert.ok(state);assert.ok(state.p.every(Number.isFinite));
 }finally{r.dispose();}
 const f=giantFixture();try{f.pose.right=arr(f.car.body.translation());f.r.input(f.client,{...f.pose,reset:true});f.r.step();for(let i=0;i<35;i++){f.r.input(f.client,f.pose);f.r.step();}assert.equal(f.car.wreck,false);assert.equal(f.car.hp,C.CAR_HP);}finally{f.r.dispose();}
});
test('a hand crushes a building wall and continues into the car behind it',()=>{
 const prop=carPlacements(city)[0],environment={...city,buildings:[{name:'SHIELD',x:prop.position[0],z:prop.position[2]+5,material:'concrete',bay:3,story:4,tiers:[{nx:1,nz:1,floors:2,ix:0,iz:0}]}]};
 const {r,car,client,pose,at}=giantFixture(environment);try{pose.right=[at.x,2,at.z-5];r.input(client,pose);r.step();assert.equal(r.boss.right.z,pose.right[2]);assert.ok(r.detached.size>0);assert.equal(car.wreck,true);}finally{r.dispose();}
});
test('solid scenery still stops a punch before it can hit a car behind it',()=>{
 const prop=carPlacements(city)[0],environment={...city,buildings:[],props:[{position:[prop.position[0],2,prop.position[2]+5],collider:{half:[4,2,.25]}}]};
 const {r,car,client,pose,at}=giantFixture(environment);try{pose.right=[at.x,2,at.z-5];r.input(client,pose);r.step();assert.ok(r.boss.right.z>at.z+6);assert.equal(car.wreck,false);assert.equal(car.hp,C.CAR_HP);}finally{r.dispose();}
});
test('giant walking shoves and destroys cars underfoot; missiles can also destroy them',()=>{
 const {r,car,client,at}=giantFixture();try{
  car.body.setTranslation(v(r.boss.x,at.y,-123),true);r.world.updateSceneQueries();r.input(client,{type:'input',x:0,z:1,yaw:0,pitch:0});r.boss.noContactUntil=0;r.step();assert.ok(car.wreck);
  const next=[...r.cars.values()][1];blastCars(r,next.body.translation(),6);assert.ok(next.wreck);assert.equal(r.bossHP,C.BOSS_HP);
 }finally{r.dispose();}
});
test('wrecks retain their final pose for late spectators, stop sending poses while asleep, and reset',()=>{
 const r=new Room('CARS01');try{r.attach(ws,'boss','giant');const c=first(r);damageCar(r,c,999);c.body.setTranslation(v(15,1,20),true);c.body.setLinvel(v(),true);c.body.setAngvel(v(),true);updateCars(r);r.drainEvents();c.body.sleep();r.phase=1;r.endedAt=r.time;r.step();
  assert.equal(carSnapshots(r).some(p=>p.id===c.id),false);const end=r.drainEvents().find(e=>e.type==='car-state'&&e.id===c.id);assert.ok(end.sleeping&&end.wreck);
  r.time+=100;assert.deepEqual(r.welcome({id:99,role:'spectator'}).cars.find(e=>e.id===c.id),carMeta(r,c));assert.equal(carMeta(r,c).burn,0);assert.ok(c.body.isValid());
  r.initWorld();const reset=r.cars.get(c.id);assert.equal(reset.wreck,false);assert.equal(reset.hp,C.CAR_HP);assert.ok(reset.body.isValid());assert.notDeepEqual(arr(reset.body.translation()),[15,1,20]);
 }finally{r.dispose();}
});
