import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {city} from '../shared/environment.js';
import {C} from '../shared/config.js';
import {v} from '../shared/math.js';
import {identity,box,resolveHand} from '../shared/giant-rig.js';
import {resolveBreakableHand} from '../shared/hand-break.js';
await physicsReady;
const socket={readyState:1,send(){}};
function fixture(material='stone',strength=1,nx=3,nz=3){
 const r=new Room('STICKY',{environment:{...city,infinite:false,props:[],buildings:[{x:0,z:-20,material,strength,bay:4,story:4,tiers:[{nx,nz,floors:8,ix:0,iz:0}]}]}}),client=r.attach(socket,'boss','Quest');
 const pose={type:'pose',head:[0,23.8,0],left:[-10,12,0],right:[0,10.15,-20+nz*2+3],leftQuaternion:identity,rightQuaternion:identity,yaw:0};
 r.input(client,{...pose,reset:true});r.step();for(let i=0;i<16;i++){r.input(client,pose);r.step();}r.drainEvents();return {r,client,pose};
}
test('a continuous hand sweep opens its path while the connected tower remains standing',()=>{
 const {r,client,pose}=fixture('concrete',1,4,4);try{
  pose.right=[0,10.15,-23];r.input(client,pose);r.step();
  assert.equal(r.boss.right.z,pose.right[2]);assert.ok(r.cells.some(c=>c.skin.parts?.length),'Pieces in the actual hand path break on contact');assert.ok(r.detached.size<r.cells.length*.12);
  const pierced=r.detached.size;
  for(let i=0;i<240;i++){r.input(client,pose);r.step();}
  assert.ok(r.detached.size<r.cells.length*.15,`${pierced} hit bays should not bring down ${r.cells.length} bays`);assert.equal(r.collapsed.size,0);
  const late=r.welcome({id:100,role:'spectator'});assert.ok(late.shards.length);assert.ok(late.fractures.length);assert.ok(late.shards.every(e=>Math.max(...e.half)<1.15));
 }finally{r.dispose();}
});
test('local holes hold for several seconds; removing every support still releases the upper tower',()=>{
 const {r,client,pose}=fixture();try{
  const ground=r.cells.filter(c=>c.ground),holes=ground.slice(0,4).map(c=>c.id);r.breakCells(holes);
  for(let i=0;i<240;i++){r.input(client,pose);r.step();}
  assert.equal(r.detached.size,4);assert.equal(r.pendingFailures.size,0);
  r.breakCells(ground.slice(4).map(c=>c.id));assert.equal(r.detached.size,r.cells.length);assert.ok([...r.debris.values()].some(e=>e.cells.length>12));
 }finally{r.dispose();}
});
test('reinforcement cannot make a directly struck column resist a moving giant hand',()=>{
 const {r,client,pose}=fixture('stone',20);try{
  const target=r.cells.find(c=>c.floor===2&&c.ix===1&&c.iz===2);pose.right=[1.85,10.15,-15];r.input(client,pose);r.step();
  assert.ok(target.skin.parts?.length);assert.ok(target.skin.hp<target.skin.maxHp);assert.equal(r.boss.right.z,-15);assert.ok(r.detached.size<r.cells.length*.15);assert.equal(r.collapsed.size,0);
 }finally{r.dispose();}
});
test('wall-only strikes remove that facade without weakening neighbouring frames',()=>{
 for(const material of ['glass','brick','concrete','stone']){
  const {r,client,pose}=fixture(material);try{
   const c=r.cells.find(c=>c.floor===2&&c.ix===1&&c.iz===2);pose.right=[0,10.15,-13];r.input(client,pose);r.step();
   assert.ok(c.skin.parts?.length,material);const above=r.cells.find(cell=>cell.floor===3&&cell.ix===c.ix&&cell.iz===c.iz);assert.ok(r.handWorld.cells.get(above.id).boxes.some(b=>b.kind==='wall'),'unhit story remains solid');assert.equal(c.skin.hp,c.skin.maxHp);assert.equal(r.detached.size,0);assert.equal(r.boss.right.z,-13);
   assert.ok(r.cells.every(cell=>cell.skin.hp===cell.skin.maxHp));
  }finally{r.dispose();}
 }
});
test('prediction opens only the swept surfaces and still stops at solid terrain or refused damage',()=>{
 const wall={...box([0,0,-5],[4,4,.1],identity,1),kind:'wall',side:2},rear={...box([0,0,-9],[4,4,.1],identity,1),kind:'wall',side:0},ground=box([0,0,-13],[4,4,.1]),world={*near(){yield wall;yield rear;yield ground;}};
 const open=resolveBreakableHand([0,0,0],[0,0,-20],identity,world,[0,0,-3]);assert.equal(open.broken.length,2);assert.ok(open.position[2]>-12);assert.ok(open.position[2]<-10);
 const refused=resolveBreakableHand([0,0,0],[0,0,-20],identity,world,[0,0,-3],()=>false);assert.deepEqual(refused.position,resolveHand([0,0,0],[0,0,-20],identity,world).position);assert.equal(refused.broken.length,0);
 const held=resolveBreakableHand([0,0,0],[0,0,-20],identity,world,[0,0,0]);assert.equal(held.broken.length,0);
});
test('a single pose has a bounded fracture workload and cannot phase through unprocessed structure',()=>{
 const boxes=Array.from({length:C.HAND_BREAK_LIMIT+5},(_,i)=>({...box([0,0,-5-i*4],[4,4,.1],identity,i+1),kind:'frame'})),world={*near(){yield*boxes;}};
 const result=resolveBreakableHand([0,0,0],[0,0,-200],identity,world,[0,0,-30]);assert.equal(result.broken.length,C.HAND_BREAK_LIMIT);assert.ok(result.position[2]>-5-C.HAND_BREAK_LIMIT*4);
});
test('fresh fragments briefly clear the crushing hand, then regain ordinary debris contact',()=>{
 const {r,client,pose}=fixture();try{
  pose.right=[1.85,10.15,-15];r.input(client,pose);r.step();const id=[...r.boss.breakGrace.keys()][0],shard=[...r.shards.values()].find(e=>e.cell===id&&e.body),a=r.handBodies[1].collider(0).handle,b=shard.body.collider(0).handle;assert.ok(id);
  assert.equal(r.physicsHooks.filterContactPair(a,b),null);r.time+=C.HAND_DEBRIS_GRACE+.01;assert.notEqual(r.physicsHooks.filterContactPair(a,b),null);assert.ok(r.world.getCollider(b));
 }finally{r.dispose();}
});
