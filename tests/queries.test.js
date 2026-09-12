import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {lazySceneQueries} from '../server/queries.js';
import {Room,physicsReady} from '../server/room.js';
import {fly} from '../server/abilities.js';
import {noInput} from '../server/players.js';
import {v} from '../shared/math.js';
await physicsReady;

test('deferred scene queries see moving, created and removed colliders, refreshing once per change',()=>{
 const world=lazySceneQueries(new RAPIER.World(v())),ray=new RAPIER.Ray(v(),v(0,0,-1));let refreshes=0;
 const update=world.queryPipeline.update.bind(world.queryPipeline);world.queryPipeline.update=(...args)=>{refreshes++;return update(...args);};
 try{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,0,-5));world.createCollider(RAPIER.ColliderDesc.ball(1),body);
  for(let i=0;i<30;i++)world.step();assert.equal(refreshes,0,'solver ticks do not rebuild an unused ray tree');
  assert.ok(Math.abs(world.castRay(ray,20,true).timeOfImpact-4)<1e-5);assert.equal(refreshes,1);
  world.projectPoint(v(0,0,-3),true);world.castRayAndGetNormal(ray,20,true);assert.equal(refreshes,1);
  body.setLinvel(v(0,0,-6),true);world.step();assert.ok(world.castRay(ray,20,true).timeOfImpact>4.05);assert.equal(refreshes,2);
  world.removeRigidBody(body);assert.equal(world.castRay(ray,20,true),null);assert.equal(refreshes,3);
  const wall=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,0,-3));world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1),wall);
  assert.ok(Math.abs(world.castRay(ray,20,true).timeOfImpact-2)<1e-5);assert.equal(refreshes,4);
  wall.setTranslation(v(0,0,-8),true);world.invalidateSceneQueries();assert.ok(Math.abs(world.castRay(ray,20,true).timeOfImpact-7)<1e-5);
 }finally{world.free();}
});
test('a wall opened by damage is passable to a second shot in the same tick',()=>{
 const r=new Room('ABC123');try{
  const c=r.cells.find(c=>c.material==='brick'&&c.ground&&c.walls[0]),ray=new RAPIER.Ray(v(c.p[0],c.p[1],c.p[2]-4),v(0,0,1));
  assert.ok(r.world.castRay(ray,3.5,true));r.damageCell(c,24,1);r.damageCell(c,60,1);
  assert.equal(c.skin.facade&1,0);assert.equal(r.world.castRay(ray,3.5,true),null);
 }finally{r.dispose();}
});
test('idle grounded raiders sleep but movement and dodge wake them immediately',()=>{
 const r=new Room('ABC123');try{
  const client=r.attach({send(){},readyState:1},'raider','pilot'),p=r.players.get(client.id);r.spawn(p,v(0,1.2,65));
  const idle=noInput();for(let i=0;i<240;i++){r.time+=1/60;fly(r,p,idle);r.world.step();}
  assert.ok(p.body.isSleeping());fly(r,p,{...idle,x:1});assert.equal(p.body.isSleeping(),false);assert.ok(p.body.linvel().x>0);
  p.body.sleep();fly(r,p,{...idle,dodge:1});assert.equal(p.body.isSleeping(),false);assert.ok(Math.hypot(...Object.values(p.body.linvel()))>40);
 }finally{r.dispose();}
});
