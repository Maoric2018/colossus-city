import test from 'node:test';
import assert from 'node:assert/strict';
import {packEvents,unpackEvents,packIds,unpackIds} from '../shared/event-codec.js';
import {fractureRecipe,fractureColliders} from '../shared/city/fracture.js';
import {initialSkin} from '../shared/city/cells.js';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {chipCell,updateShards} from '../server/fracture.js';
import {CellIndex} from '../src/render/cell-index.js';
import {BlockPreparation} from '../src/world/block-preparation.js';
import {SnapshotTiming} from '../shared/snapshot-timing.js';
import {CaptureBudget} from '../src/render/capture-budget.js';
await physicsReady;
const env={...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material:'brick',tiers:[{nx:1,nz:1,floors:5,ix:0,iz:0}]}]};
test('lossless event packing preserves piece order, absent fields, full precision and interleaved events',()=>{
 const events=[{type:'fracture',cell:1,parts:Array.from({length:250},(_,i)=>i)},{type:'strike',cell:1},...Array.from({length:80},(_,i)=>({type:'shards',id:1000+i,cell:1,pieces:[20,21,22,8,9,10,11],p:[Math.PI,i/3,-1e5],q:[0,0,0,1],half:[.1,.2,.3],material:'brick',settled:i%2===0,...(i%2?{ballistic:true,start:[1,2,3],duration:1.25,ground:.15}:{}),born:42})),{type:'fine-collapse',cells:[1]},{type:'shards',id:2000,customFutureField:'retain'}];
 const packed=JSON.stringify(packEvents(events));assert.deepEqual(unpackEvents(JSON.parse(packed)),events);assert.ok(packed.length<JSON.stringify(events).length*.7);
 for(const ids of [[],[0],[4,4,5,9,8,7],[5000000000,5000000001],Array.from({length:100},(_,i)=>(i*179)%200)])assert.deepEqual(unpackIds(JSON.parse(JSON.stringify(packIds(ids)))),ids);
});
test('fine collider caches preserve holes and invalidate changed masks and in-place piece edits',()=>{
 const room=new Room('CACHE',{environment:env});try{const c=room.cells[2],recipe=fractureRecipe(c),wall=recipe.pieces.filter(p=>p.kind==='wall'&&p.side===2),skin={...initialSkin(c),parts:[wall[15].id]};
  const first=fractureColliders(c,skin);assert.equal(fractureColliders(c,{...skin,parts:[...skin.parts]}),first);
  const frame=first.filter(a=>a.kind==='frame');skin.parts.push(wall[16].id);const second=fractureColliders(c,skin);assert.notEqual(second,first);assert.deepEqual(second.filter(a=>a.kind==='frame'),frame);assert.ok(second.filter(a=>a.kind==='frame').every((a,i)=>a===frame[i]));
  skin.parts[1]=wall[17].id;assert.notEqual(fractureColliders(c,skin),second);skin.glass=0;skin.facade=0;assert.ok(fractureColliders(c,skin).every(a=>a.kind!=='wall'));
 }finally{room.dispose();}
});
test('a new wall hit preserves colliders on previously damaged walls and untouched structure',()=>{
 const room=new Room('LOCAL',{environment:env});try{const c=room.cells[2];chipCell(room,c,[0,c.p[1],-18],.5,Infinity);const walls=[...c.wallHandles[2]],structure=[...c.structureHandles];
  chipCell(room,c,[0,c.p[1],-22],.5,Infinity);assert.deepEqual(c.wallHandles[2],walls);assert.deepEqual(c.structureHandles,structure);assert.ok(room.world.getCollider(walls[0]));assert.equal(room.dirtyBuildings.size,0,'wall holes do not require recalculating unchanged structural loads');
 }finally{room.dispose();}
});
test('simultaneous fragment settlement refreshes scene queries once, retaining every piece',()=>{
 const room=new Room('SETTLE',{environment:env});try{const c=room.cells[2];chipCell(room,c,[0,c.p[1],-18],1.2,Infinity);const count=room.shards.size;assert.ok(count>10);
  for(const e of room.shards.values())if(e.body){e.body.setRotation({x:0,y:0,z:0,w:1},true);e.body.setTranslation({x:80+e.id%10*2,y:e.half[1],z:80},true);e.body.sleep();}
  let refreshes=0;const original=room.world.updateSceneQueries;room.world.updateSceneQueries=()=>{refreshes++;original();};room.world.invalidateSceneQueries();updateShards(room);
  assert.equal(room.shards.size,count);assert.equal(room.activeShards.size,0);assert.equal(room.restingShards.size,count);assert.equal(refreshes,1);
 }finally{room.dispose();}
});
test('spatial selection follows moved pieces and removes old bucket entries',()=>{
 const index=new CellIndex();index.set(1,-.1,0);index.set(2,500,500);let near=index.addNear(new Set(),0,0,2);assert.ok(near.has(1)&&!near.has(2));index.set(1,500,500);near=index.addNear(new Set(),0,0,2);assert.ok(!near.has(1));index.delete(1);index.delete(2);assert.equal(index.buckets.size,0);
});
test('block preparation ignores stale results after resets and never reuses a different landmark',()=>{
 class WorkerStub{postMessage(m){this.sent??=[];this.sent.push(m);}terminate(){this.stopped=true;}}
 const original=globalThis.Worker;globalThis.Worker=WorkerStub;
 try{const p=new BlockPreparation(false),worker=p.worker,a={key:'1,1'},b={key:'1,1',landmark:'chrysler'};p.prepare(a);const id=worker.sent[0].id;p.clear();p.prepare(b);worker.onmessage({data:{id,cells:['old']}});assert.equal(p.entries.get(b.key).cells,null);worker.onmessage({data:{id:worker.sent[1].id,cells:['new']}});assert.deepEqual(p.take(b),['new']);assert.equal(p.take(a),null);p.dispose();assert.equal(worker.stopped,true);
 }finally{if(original===undefined)delete globalThis.Worker;else globalThis.Worker=original;}
});
test('interpolation reduces stable delay, absorbs jitter and never reverses the rendered clock',()=>{
 const timing=new SnapshotTiming();for(let i=0;i<120;i++)timing.receive(i*.05,i*50);assert.ok(timing.delay<=61);
 let last=timing.renderTime(6,0);for(let i=1;i<15;i++){timing.receive(6+i*.05,6000+i*50+(i%2?60:0));const next=timing.renderTime(6+i*.05,0);assert.ok(next>=last);last=next;}assert.ok(timing.delay>100&&timing.delay<=150);
 assert.equal(new SnapshotTiming().delay,100);
});
test('spectator capture preserves normal cadence and yields before it delays gameplay',()=>{
 const budget=new CaptureBudget();assert.equal(budget.interval(24),1000/24);assert.ok(budget.allow(4,1000/72));budget.record(2,4,1000/72);assert.equal(budget.scale,1);assert.ok(!budget.allow(13,1000/72));
 for(let i=0;i<20;i++)budget.record(8,10,1000/72);assert.ok(budget.interval(24)>60);assert.ok(budget.scale<.8&&budget.scale>=.7);
 for(let i=0;i<100;i++)budget.record(1,3,1000/72);assert.equal(budget.interval(24),1000/24);assert.ok(budget.scale>.99);
});
