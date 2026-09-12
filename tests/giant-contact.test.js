import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {city} from '../shared/environment.js';
import {GIANT,identity,box,resolveHand,handQuaternion,handRay,sweepBox,axes,rotate,plus,minus} from '../shared/giant-rig.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
import {Connection} from '../src/network.js';
await physicsReady;
const ws={readyState:1,send(){}},environment={...city,buildings:[{x:0,z:-20,nx:1,nz:1,floors:3,bay:8,story:5,style:0,name:'CONTACT TEST'}],props:[]};
function fixture(){const room=new Room('HAND01',{environment}),client=room.attach(ws,'boss','Quest'),pose={type:'pose',head:[0,23.8,0],left:[-10,12,0],right:[0,7.5,-14],leftQuaternion:identity,rightQuaternion:identity,yaw:0};room.input(client,{...pose,reset:true});room.step();for(let i=0;i<15;i++){room.input(client,pose);room.step();}return {room,client,pose,cell:room.cells.find(c=>c.floor===1)};}
const wall=box([0,0,-5],[20,20,.1],identity,1),world={*near(){yield wall;}};
test('visible knuckles and rotated corners stop at the surface and slide without deeper extension',()=>{
 for(const yaw of [0,.4,Math.PI/2]){const q=handQuaternion(null,yaw),result=resolveHand([0,0,0],[3,0,-20],q,world),radius=GIANT.handHalf[0]*Math.abs(Math.sin(yaw))+GIANT.handHalf[2]*Math.abs(Math.cos(yaw));assert.ok(Math.abs(result.position[2]-(-4.9+radius+.017))<.002);assert.ok(Math.abs(result.position[0]-3)<.001);assert.ok(result.contacts.length);}
 const corner=box([1.42,1.2,-5],[.04,.04,.04],identity,2),result=resolveHand([0,0,0],[0,0,-10],identity,{*near(){yield corner;}});assert.ok(result.position[2]>-4,'The far knuckle corner must hit even where the old small sphere missed');
});
test('gentle contact damages at the visible front face; sustained pushing breaks it',()=>{
 const {room,client,pose,cell}=fixture();try{
  for(let i=0;i<30;i++){pose.right[2]-=.025;room.input(client,pose);room.step();if(cell.hp<90)break;}
  assert.ok(cell.hp<90&&cell.hp>0,'First slow touch must register without requiring a fast swing');assert.ok(Math.abs(room.boss.right.z-(-16+GIANT.handHalf[2]+.017))<.005);
  assert.ok(room.drainEvents().some(e=>e.type==='impact'),'Contact must provide immediate feedback before collapse');
  for(let i=0;i<100&&!room.detached.has(cell.id);i++){room.input(client,pose);room.step();}
  assert.ok(room.detached.has(cell.id),'Keeping pressure on a wall should eventually break it');
 }finally{room.dispose();}
});
test('a fast punch cannot tunnel through a building between pose packets',()=>{
 const {room,client,pose,cell}=fixture();try{pose.right[2]=-30;room.input(client,pose);room.step();assert.ok(room.boss.right.z>-15,'The physical fist stops at the first wall in this tick');assert.ok(room.detached.has(cell.id),'The same contact registers a strong impact');}finally{room.dispose();}
});
test('recenter and artificial turn still cannot become building attacks',()=>{
 const {room,client,pose,cell}=fixture();try{pose.right=[0,7.5,-20];room.input(client,{...pose,reset:true});room.step();for(let i=0;i<30;i++){room.input(client,pose);room.step();}assert.equal(cell.hp,90);assert.equal(room.detached.size,0);
  pose.right=[8,7.5,-18];room.input(client,{...pose,reset:true});room.step();for(let i=0;i<15;i++){room.input(client,pose);room.step();}
  pose.yaw=.4;pose.turnDelta=.4;pose.right=plus(pose.head,rotate(minus(pose.right,pose.head),handQuaternion(null,.4)));pose.rightQuaternion=handQuaternion(null,.4);room.input(client,pose);room.step();assert.equal(cell.hp,90,'Turning into a wall must block without attack damage');}finally{room.dispose();}
});
test('hollow openings stay open and falling pieces remain physics driven',()=>{
 const empty={*near(){yield box([0,5,0],[2,.1,2]);}};assert.deepEqual(resolveHand([-5,0,0],[5,0,0],identity,empty).position,[5,0,0]);
 const {room,cell}=fixture();try{room.breakCells([cell.id]);assert.equal(room.handWorld.cells.get(cell.id).boxes.length,0,'Detached bays must be pushed by Rapier, not treated as immovable walls');}finally{room.dispose();}
});
test('wrist orientation reaches the server collider, snapshot, interpolator and laser hitbox',()=>{
 const {room,client,pose}=fixture();try{const q=handQuaternion([.2,.4,.1,.87]);pose.right=[8,12,8];pose.rightQuaternion=q;room.input(client,pose);room.step();const actual=room.handBodies[1].rotation();for(const [i,key]of ['x','y','z','w'].entries())assert.ok(Math.abs(actual[key]-q[i])<1e-5);
  const state=decodeSnapshot(encodeSnapshot(room.snapshot()));for(let i=0;i<4;i++)assert.ok(Math.abs(state.rightQuaternion[i]-q[i])<1e-6);
  const n=new Connection(()=>{},()=>{});try{n.snapshots=[{...state,time:0,rightQuaternion:identity},{...state,time:.2,rightQuaternion:q}];n.receivedAt=performance.now();const mid=n.sample().rightQuaternion;assert.ok(Math.abs(Math.hypot(...mid)-1)<1e-6);assert.ok(mid[1]>0&&mid[1]<q[1]);}finally{n.dispose();}
  const yaw=handQuaternion(null,Math.PI/2);assert.ok(Math.abs(handRay([0,0,10],[0,0,-1],[0,0,0],yaw)-(10-GIANT.handHalf[0]))<1e-6);
 }finally{room.dispose();}
});
test('sweep agrees with real Rapier cuboids for separated, touching and overlapping poses',()=>{
 const hand=new RAPIER.Cuboid(...GIANT.handHalf),small=new RAPIER.Cuboid(.5,.5,.5),origin={x:0,y:0,z:0},identityQ={x:0,y:0,z:0,w:1};
 for(const yaw of [0,.3,1.2])for(const x of [0,1,2,3,4]){const q=handQuaternion(null,yaw),rotation={x:q[0],y:q[1],z:q[2],w:q[3]},other=box([x,0,0],[.5,.5,.5]),result=sweepBox([0,0,0],[0,0,0],axes(q),GIANT.handHalf,other,0),rapier=hand.intersectsShape(origin,rotation,small,{x,y:0,z:0},identityQ);assert.equal(!!result,rapier);}
});
