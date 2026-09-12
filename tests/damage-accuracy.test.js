import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {city,generateCells,initialSkin} from '../shared/environment.js';
import {C,group} from '../shared/config.js';
import {identity,resolveHand} from '../shared/giant-rig.js';
import {v} from '../shared/math.js';
import {damageSphere,resolveCell,contactFromTag,collisionContact,debrisImpactSpeed,scheduleFailures,processFailures,connectedIslands} from '../server/destruction.js';
await physicsReady;
const socket={readyState:1,send(){}},building=(overrides={})=>({x:0,z:-20,tiers:[{nx:1,nz:1,floors:4,ix:0,iz:0}],bay:4,story:4,material:'brick',...overrides});
function room(buildings=[building()]){return new Room('DAMAGE',{environment:{...city,infinite:false,buildings,props:[]}});}
function tracked(){
 const r=room([building({bay:8,story:5,material:'concrete',tiers:[{nx:1,nz:1,floors:3,ix:0,iz:0}]})]),client=r.attach(socket,'boss','Quest'),pose={type:'pose',head:[0,23.8,0],left:[0,7.5,-14],right:[0,7.5,-14],leftQuaternion:identity,rightQuaternion:identity,yaw:0};
 r.input(client,{...pose,reset:true});r.step();for(let i=0;i<15;i++){r.input(client,pose);r.step();}r.drainEvents();
 return {r,client,pose,c:r.cells.find(c=>c.floor===1)};
}
test('repeated light hits open the touched glass and masonry before damaging its frame',()=>{
 const r=room();try{
  const c=r.cells.find(c=>c.floor===1),hp=c.skin.hp;
  r.damageCell(c,2,4);r.damageCell(c,2,4);assert.equal(c.skin.glassHp[2],1);assert.equal(c.skin.glass,15);assert.equal(c.skin.hp,hp);
  r.damageCell(c,2,4);assert.equal(c.skin.glass,11);assert.equal(c.skin.facadeHp[2],39);assert.equal(c.skin.hp,hp);
  for(let i=0;i<13;i++)r.damageCell(c,3,4);
  assert.equal(c.skin.facade,11);assert.equal(c.skin.hp,hp);assert.deepEqual(c.skin.glassHp,[5,5,0,5]);assert.deepEqual(c.skin.facadeHp,[40,40,0,40]);
  r.damageCell(c,7,4);assert.equal(c.skin.hp,hp-7);
 }finally{r.dispose();}
});
test('slab and column hits damage the actual frame without pretending to strike an unrelated facade',()=>{
 const r=room();try{const c=r.cells[0],hp=c.skin.hp;r.damageCell(c,25,0,0,{kind:'frame'});assert.equal(c.skin.hp,hp-25);assert.equal(c.skin.glass,15);assert.equal(c.skin.facade,15);}finally{r.dispose();}
});
test('a fist across a seam contacts both bays and every reported point lies on its struck shape',()=>{
 const r=room([building({tiers:[{nx:2,nz:1,floors:3,ix:0,iz:0}]})]);try{
  const result=resolveHand([0,6.15,-14],[0,6.15,-25],identity,r.handWorld),ids=r.cells.filter(c=>c.floor===1).map(c=>c.id);
  for(const id of ids)assert.ok(result.contacts.some(p=>p.cell===id),'Both directly touched bays must register');
  for(const hit of result.contacts){const entry=r.handWorld.cells.get(hit.cell);assert.ok(entry.boxes.some(b=>hit.kind===b.kind&&hit.side===b.side&&hit.point.every((p,k)=>Math.abs(p-b.center[k])<=b.half[k]+1e-6)));}
 }finally{r.dispose();}
});
test('merged wall rays resolve only to an actual bay on the hit side, before and after a hole opens',()=>{
 const r=room([building({tiers:[{nx:3,nz:3,floors:2,ix:0,iz:0}]})]);try{
  const point=v(0,2.15,-14),c=resolveCell(r,{building:0,floor:0,side:2},point);assert.equal(c.ix,1);assert.equal(c.iz,2);
  r.world.updateSceneQueries();const hit=r.world.castRayAndGetNormal(new RAPIER.Ray(v(-4,2.15,-10),v(0,0,-1)),8,true,undefined,group(C.COLLISION.PLAYER,C.COLLISION.WORLD));
  const tag=r.colliderTags.get(hit.collider.handle),at=v(-4,2.15,-10-hit.timeOfImpact),left=resolveCell(r,tag,at);assert.equal(left.ix,0);assert.equal(left.iz,2);assert.deepEqual(contactFromTag(tag),{kind:'wall',side:2});
  r.damageCell(c,45,4);r.world.updateSceneQueries();
  const second=r.world.castRayAndGetNormal(new RAPIER.Ray(v(-4,2.15,-10),v(0,0,-1)),8,true,undefined,group(C.COLLISION.PLAYER,C.COLLISION.WORLD));
  assert.deepEqual(contactFromTag(r.colliderTags.get(second.collider.handle)),{kind:'wall',side:2});assert.equal(resolveCell(r,r.colliderTags.get(second.collider.handle),at).id,left.id);
 }finally{r.dispose();}
});
test('blast limits select the nearest struck surface, independent of cell iteration order',()=>{
 for(const reversed of [false,true]){
  const r=room([building({tiers:[{nx:3,nz:1,floors:1,ix:0,iz:0}]})]);try{
   const near=r.cells.find(c=>c.ix===2),far=r.cells.find(c=>c.ix===0);if(reversed)r.cellsByBuilding[0].reverse();
   damageSphere(r,v(near.p[0],near.p[1],-17.9),12,12,0,1);
   assert.ok(near.skin.parts?.length);assert.equal(near.skin.hp,near.skin.maxHp);assert.ok(r.shards.size);assert.deepEqual(far.skin,initialSkin(far));
  }finally{r.dispose();}
 }
});
test('small low-rise bays require fewer direct blows than broad high-rise bays of the same material',()=>{
 const low=generateCells({buildings:[building()]}),high=generateCells({buildings:[building({bay:7,tiers:[{nx:1,nz:1,floors:24,ix:0,iz:0}]})]});
 const punches=c=>Math.ceil(initialSkin(c).hp/70);assert.ok(punches(low[0])<=3);assert.ok(punches(high[0])>=punches(low[0])+2);assert.ok(initialSkin(low[0]).hp<initialSkin(high[0]).hp*.55);
});
test('30 Hz and 60 Hz tracked poses give the same impact energy for the same hand speed',()=>{
 const damage=[];
 for(const interval of [1,2]){const {r,client,pose,c}=tracked();try{
  for(let i=0;i<40;i++){
   if(i%interval===0){pose.right[2]-=3*C.TICK*interval;r.input(client,pose);}r.step();
   if(r.drainEvents().some(e=>e.type==='strike'&&e.cell===c.id)){damage.push(6+55-c.skin.glassHp[2]-c.skin.facadeHp[2]);break;}
  }
 }finally{r.dispose();}}
 assert.equal(damage.length,2);assert.ok(Math.abs(damage[0]-damage[1])<1e-6,JSON.stringify(damage));
});
test('both hands can open opposite faces of one bay in the same tick',()=>{
 const {r,client,pose,c}=tracked();try{
  pose.left[2]=-14.5;pose.right[2]=-25.5;r.input(client,{...pose,reset:true});r.step();for(let i=0;i<15;i++){r.input(client,pose);r.step();}r.drainEvents();
  pose.left[2]-=.1;pose.right[2]+=.1;r.input(client,pose);r.step();
  const strikes=r.drainEvents().filter(e=>e.type==='strike'&&e.cell===c.id);assert.equal(strikes.length,2);assert.equal(c.skin.hp,c.skin.maxHp);assert.ok(c.skin.parts?.length);assert.ok(r.handWorld.cells.get(c.id).boxes.some(b=>b.kind==='wall'));assert.equal(r.boss.left.z,pose.left[2]);assert.equal(r.boss.right.z,pose.right[2]);
 }finally{r.dispose();}
});
test('moving sideways along a wall does not turn tangential speed into a punch',()=>{
 const {r,client,pose,c}=tracked();try{
  pose.right[2]=-14.7;r.input(client,{...pose,reset:true});r.step();for(let i=0;i<15;i++){r.input(client,pose);r.step();}
  const skin=structuredClone(c.skin);for(let i=0;i<8;i++){pose.right[0]+=.12;r.input(client,pose);r.step();}assert.deepEqual(c.skin,skin);
 }finally{r.dispose();}
});
test('disconnected upper wings fall separately and passive collapse adds no lift or sideways spin',()=>{
 const r=room([building({tiers:[{nx:3,nz:1,floors:15,ix:0,iz:0}]})]);try{
  r.breakCells(r.cells.filter(c=>c.ix===1).map(c=>c.id));
  const pieces=r.breakCells(r.cells.filter(c=>c.ground&&c.ix!==1).map(c=>c.id));
  const wings=pieces.filter(p=>p.cells.length>12);assert.equal(wings.length,2);
  for(const e of pieces){assert.equal(connectedIslands(r,e.cells).length,1);assert.deepEqual({...e.body.linvel()},{x:0,y:0,z:0});assert.deepEqual({...e.body.angvel()},{x:0,y:0,z:0});}
  assert.notEqual(r.cellMap.get(wings[0].cells[0]).ix,r.cellMap.get(wings[1].cells[0]).ix);
 }finally{r.dispose();}
});
test('secondary fracture preserves velocity without adding an unexplained outward kick',()=>{
 const r=room([building({tiers:[{nx:2,nz:2,floors:6,ix:0,iz:0}]})]);try{
  r.breakCells(r.cells.filter(c=>c.ground).map(c=>c.id));const e=[...r.debris.values()].find(e=>e.cells.length>12);e.body.setLinvel(v(3,-8,2),true);e.body.setAngvel(v(),true);r.splitDebris(e.id);
  for(const id of e.cells){const part=r.debris.get(r.cellMap.get(id).entity);assert.deepEqual({...part.body.linvel()},{x:3,y:-8,z:2});}
 }finally{r.dispose();}
});
test('destroyed frames retry after the body budget frees up',()=>{
 const r=room();try{
  for(let i=0;i<C.MAX_ACTIVE_CHUNKS;i++)r.debris.set(-1-i,{body:r.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())});
  const c=r.cells[0];r.damageCell(c,9999,0,0,{kind:'frame'});scheduleFailures(r);processFailures(r);assert.equal(r.detached.has(c.id),false);assert.ok(r.pendingFailures.has(c.id));
  r.removeBody(r.debris.get(-1).body);r.debris.delete(-1);processFailures(r);assert.ok(r.detached.has(c.id));assert.equal(r.pendingFailures.has(c.id),false);assert.equal(r.debris.size,C.MAX_ACTIVE_CHUNKS);
 }finally{r.dispose();}
});
test('a bay no longer collapses from an obsolete overload after its upper load falls away',()=>{
 const r=room();try{
  const c=r.cells[0];c.skin.hp=c.skin.maxHp*.06;r.dirtyBuildings.add(0);scheduleFailures(r);assert.ok(r.pendingFailures.has(c.id));
  r.breakCells(r.cells.filter(c=>!c.ground).map(c=>c.id));scheduleFailures(r);assert.equal(r.pendingFailures.has(c.id),false);r.time=2;processFailures(r);assert.equal(r.detached.has(c.id),false);
 }finally{r.dispose();}
});
test('real Rapier contacts locate the collision surface and ignore sideways sliding speed',()=>{
 const world=new RAPIER.World(v(0,-9.81,0)),queue=new RAPIER.EventQueue(true);try{
  world.createCollider(RAPIER.ColliderDesc.cuboid(50,.3,50),world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.3,0)));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1.9,0)),co=world.createCollider(RAPIER.ColliderDesc.cuboid(5,2,2).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  let contact;world.step(queue);queue.drainCollisionEvents((a,b,started)=>{if(started&&(a===co.handle||b===co.handle))contact=collisionContact({world},a,b);});
  assert.ok(contact);assert.ok(Math.abs(contact.point.y)<.2);assert.ok(Math.abs(contact.point.x)>1,'Actual corner contact differs from the chunk centre');
  const e={body,preImpactVelocity:v(40,0,0),preImpactAngular:v()};assert.ok(debrisImpactSpeed(e,contact)<.001);e.preImpactVelocity=v(40,-12,0);assert.ok(Math.abs(debrisImpactSpeed(e,contact)-12)<.001);
 }finally{world.free();queue.free();}
});
test('falling chunks damage bays at real contact points instead of the bay nearest their centre',()=>{
 const r=room([building({x:1000,z:1000,tiers:[{nx:3,nz:1,floors:4,ix:0,iz:0}]}),building({x:1000,z:1040,bay:10,story:16,tiers:[{nx:1,nz:1,floors:1,ix:0,iz:0}]})]);try{
  const source=r.cells.find(c=>c.building===1),[e]=r.breakCells([source.id]);e.body.setTranslation(v(1000,8.15,1008),true);e.body.setLinvel(v(0,0,-18),true);e.born=-1;r.drainEvents();const impacts=[];
  for(let i=0;i<24;i++){r.step();impacts.push(...r.drainEvents().filter(e=>e.type==='strike'&&r.cellMap.get(e.cell)?.building===0));}
  assert.ok(impacts.length,'The incoming chunk must hit the target building');
  for(const impact of impacts){const c=r.cellMap.get(impact.cell);assert.ok(Math.abs(impact.p[0]-c.p[0])<=c.size[0]/2+.1,'Damage belongs to the contacted bay');assert.ok(Math.abs(impact.p[1]-c.p[1])<=c.size[1]/2+.15);}
  assert.ok(impacts.every(e=>r.cellMap.get(e.cell).skin.parts?.length),'Each real contact removes pieces from that bay');
 }finally{r.dispose();}
});
