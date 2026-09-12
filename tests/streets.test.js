import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {generateBlock,midtown} from '../shared/city/layout.js';
import {sidewalkSlabs,STREET} from '../shared/streets.js';
import {HandWorld} from '../shared/hand-world.js';
await physicsReady;

test('continuous home sidewalks replace overlapping building pads and leave streets open',()=>{
 const room=new Room('WALK01');try{
  assert.equal(sidewalkSlabs(midtown).length,25);
  assert.equal(room.props.filter(p=>p.kind==='pavement').length,25);
  room.world.step();
  const heightAt=(x,z)=>{const h=room.world.castRay(new RAPIER.Ray({x,y:3,z},{x:0,y:-1,z:0}),4,true);return 3-h.timeOfImpact;};
  assert.ok(Math.abs(heightAt(26.8,0)-STREET.curb)<.001);
  assert.ok(Math.abs(heightAt(35,0))<.001);
  const hand=new HandWorld(midtown,[]),slab=hand.fixed.find(b=>b.center[0]===0&&b.center[2]===0&&b.center[1]>0);
  assert.equal(slab.center[1]+slab.half[1],STREET.curb);
 }finally{room.dispose();}
});

test('generated sidewalk collision agrees with client geometry and unloads cleanly',()=>{
 const room=new Room('WALK02');try{
  const count=room.handWorld.fixed.length,tile=room.stream.load(8,6),env=generateBlock(8,6),slab=sidewalkSlabs(env)[0],client=new HandWorld(env,[]);
  room.world.step();const hit=room.world.castRay(new RAPIER.Ray({x:slab.position[0]+26.8,y:3,z:slab.position[2]},{x:0,y:-1,z:0}),4,true,undefined,undefined,undefined,undefined,co=>co.parent()?.handle===tile.ground.handle);
  assert.ok(Math.abs(3-hit.timeOfImpact-STREET.curb)<.001);
  assert.ok(client.fixed.some(b=>b.center.every((v,i)=>v===slab.position[i])));
  assert.equal(tile.ground.numColliders(),2);
  assert.equal(room.handWorld.fixed.length,count+2);
  room.stream.unload(tile.key);assert.equal(room.handWorld.fixed.length,count);
 }finally{room.dispose();}
});
