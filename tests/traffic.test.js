import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {driveCars,strikeCars,carMeta} from '../server/cars.js';
import {closestRoute,routePose} from '../shared/traffic.js';
import {staticProps} from '../shared/props.js';
import {C,group} from '../shared/config.js';
import {v,add,arr} from '../shared/math.js';
import {identity} from '../shared/giant-rig.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
await physicsReady;
const fixture=()=>{const r=new Room('TRAFFIC');r.attach({send(){}},'boss','still');return r;},ticks=(r,n)=>{for(let i=0;i<n;i++)r.step();};
test('city traffic continuously drives and turns within its lanes without wrecking the city',()=>{
 const r=fixture();try{
  const track=new Map([...r.cars.values()].map(c=>[c.id,{last:c.body.translation(),q:c.body.rotation(),distance:0,turned:false}]));let maxError=0;
  for(let i=0;i<3600;i++){r.step();for(const c of r.cars.values()){const t=track.get(c.id),p=c.body.translation(),q=c.body.rotation();t.distance+=Math.hypot(p.x-t.last.x,p.z-t.last.z);t.last=p;t.turned||=Math.abs(q.x*t.q.x+q.y*t.q.y+q.z*t.q.z+q.w*t.q.w)<.85;maxError=Math.max(maxError,closestRoute(c.traffic.route,p.x,p.z).error);}}
  assert.equal(r.cars.size,36);assert.ok([...track.values()].every(t=>t.distance>180&&t.turned));assert.ok(maxError<.5,maxError);assert.ok([...r.cars.values()].every(c=>c.driving&&!c.wreck));assert.equal(r.detached.size,0);
  const snapshot=decodeSnapshot(encodeSnapshot(r.snapshot())),welcome=r.welcome({id:99,role:'spectator'});for(const c of r.cars.values()){assert.ok(snapshot.bodies.some(b=>b.id===c.id));assert.deepEqual(welcome.cars.find(e=>e.id===c.id),carMeta(r,c));}
 }finally{r.dispose();}
});
test('a driver brakes before a road obstacle and resumes when it is removed',()=>{
 const r=fixture();try{
  const c=[...r.cars.values()][0],route=c.traffic.route,start=routePose(route,8),barrier=routePose(route,24);
  for(const other of r.cars.values())if(other!==c){other.driving=false;other.body.setTranslation(v(500,2,other.id%100*8),false);other.body.sleep();}
  c.body.setTranslation(v(start.x,c.size[1]/2+.13,start.z),true);c.body.setRotation({x:0,y:Math.sin(Math.atan2(start.dx,start.dz)/2),z:0,w:Math.cos(Math.atan2(start.dx,start.dz)/2)},true);c.traffic.startAt=0;
  const block=r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(barrier.x,2,barrier.z));r.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,2,3).setCollisionGroups(group(C.COLLISION.WORLD)),block);
  ticks(r,600);const before=c.body.translation();assert.ok(before.x<barrier.x-c.size[2]/2-.5);assert.ok(Math.hypot(c.body.linvel().x,c.body.linvel().z)<.15);assert.ok(c.driving&&!c.wreck);
  r.world.removeRigidBody(block);ticks(r,240);assert.ok(c.body.translation().x>before.x+6,'traffic must resume after the obstruction clears');
 }finally{r.dispose();}
});
test('hitting a moving car releases the driver instead of pulling the chassis back to its route',()=>{
 const r=fixture();try{ticks(r,240);const c=[...r.cars.values()][0],p=c.body.translation();assert.ok(Math.hypot(c.body.linvel().x,c.body.linvel().z)>1);
  strikeCars(r,add(p,v(0,.2,5)),add(p,v(0,.2,-4)),identity,3);assert.equal(c.driving,false);assert.equal(c.wreck,false);const velocity=arr(c.body.linvel());driveCars(r);assert.deepEqual(arr(c.body.linvel()),velocity);ticks(r,240);assert.equal(c.driving,false);assert.ok(c.body.isValid());
 }finally{r.dispose();}
});
test('street lamps leave driving lanes and junctions clear',()=>{
 const r=fixture();try{for(const p of staticProps(r.env).filter(p=>p.id.startsWith('lamp-')))assert.ok(r.env.roads.streets.every(z=>Math.abs(z-p.position[2])>=r.env.roads.streetWidth/2+2));}finally{r.dispose();}
});
