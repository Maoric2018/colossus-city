import test from 'node:test';
import assert from 'node:assert/strict';
import {ShardDeltas} from '../shared/shard-deltas.js';
import {packEvents,unpackEvents} from '../shared/event-codec.js';
import {EventPackets} from '../server/event-packets.js';
import {DeadlineQueue} from '../server/deadline-queue.js';
import {ShardSupport} from '../server/shard-support.js';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {chipCell,shardMeta,updateShards,removeShards} from '../server/fracture.js';
import {shardBallistic} from '../shared/city/fracture.js';
await physicsReady;
const shard=(id=1)=>({type:'shards',id,cell:12,pieces:[0,1,2,3],origin:[1,9,2],half:[.1,.2,.3],material:'glass',p:[1,9,2],q:[0,0,0,1],velocity:[1,2,3],born:0,ballistic:true,settled:false,start:[1,9,2],duration:1,ground:.2});
test('lossless shard deltas recover every field through eviction, reset and changing baselines',()=>{
 const send=new ShardDeltas(3),receive=new ShardDeltas(3);let missing=[];
 const roundtrip=events=>receive.unpack(unpackEvents(JSON.parse(JSON.stringify(packEvents(send.pack(events))))),id=>missing.push(id));
 let e=shard();assert.deepEqual(roundtrip([e]),[e]);
 for(let i=0;i<20;i++){e={...e,p:[Math.sin(i),i/7,-i||0],q:[0,0,0,1],settled:i%2===0,ballistic:i%2!==0};assert.deepEqual(roundtrip([e]),[e]);}
 assert.deepEqual(roundtrip([shard(2),shard(3),shard(4),e]),[shard(2),shard(3),shard(4),e]);
 receive.shards.clear();assert.deepEqual(roundtrip([{...e,p:[4,5,6]}]),[]);assert.deepEqual(missing,[1]);
 const full={...e,p:[4,5,6]};send.set(full);receive.unpack([full]);assert.deepEqual(roundtrip([{...full,settled:true}]),[{...full,settled:true}]);
 assert.deepEqual(roundtrip([{type:'reset'},shard()]),[{type:'reset'},shard()]);
 assert.ok(send.shards.size<=3&&receive.shards.size<=3);
});
test('received rendering pose changes cannot corrupt the reliable shard baseline',()=>{
 const send=new ShardDeltas(),receive=new ShardDeltas(),e=shard();send.seed({shards:[e]});receive.seed({shards:[e]});
 const next={...e,settled:true},out=receive.unpack(send.pack([next]))[0];out.p=[999,999,999];
 const last={...next,q:[0,1,0,0]};assert.deepEqual(receive.unpack(send.pack([last])),[last]);
});
test('clients on the same baseline share delta objects and serialization without merging different baselines',()=>{
 const a=new ShardDeltas(),b=new ShardDeltas(),c=new ShardDeltas(),first=shard(),next={...first,settled:true};a.pack([first]);b.pack([first]);c.seed({shards:[{...first,p:[8,8,8]}]});
 const aa=a.pack([next]),bb=b.pack([next]),cc=c.pack([next]);assert.equal(aa[0],bb[0]);assert.notDeepEqual(aa,cc);
 const packets=new EventPackets();assert.equal(packets.get(aa,1),packets.get(bb,1));assert.notEqual(packets.get(aa,1),packets.get(cc,1));
});
test('landing queue removes cancelled work and orders due events by original insertion',()=>{
 const q=new DeadlineQueue();for(let i=0;i<1000;i++)q.set(i,(i*13)%97);
 for(let i=0;i<1000;i+=2)q.delete(i);for(let i=1;i<1000;i+=4)q.set(i,101);
 assert.equal(q.size,500);assert.equal(q.due(-1).length,0);const a=q.due(100);assert.ok(a.every(e=>e.time<=100));const b=q.due(101);assert.equal(a.length+b.length,500);assert.equal(q.size,0);assert.equal(q.indices.size,0);
});
test('support subscriptions wake only affected rubble and cancel stale collider dependencies',()=>{
 const support=new ShardSupport();for(let i=0;i<10000;i++)support.watch(i,i%100);support.watch(1,200);support.remove(101);
 support.invalidate(1);assert.equal(support.dirty.size,98);assert.ok(!support.dirty.has(1));assert.equal(support.take(20).length,20);assert.equal(support.dirty.size,78);support.invalidate(200);assert.ok(support.dirty.has(1));
});
test('ballistic positions remain exact in welcomes and archives without ticking airborne fragments',()=>{
 const room=new Room('DEADLINES',{environment:{...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material:'brick',tiers:[{nx:1,nz:1,floors:8,ix:0,iz:0}]}]}});
 try{
  chipCell(room,room.cells[6],room.cells[6].p,Infinity,Infinity,0,[2,1,3],true);const id=[...room.ballisticShards][0],e=room.shards.get(id);assert.ok(e);
  const original=[...e.p];room.time=e.born+Math.min(.2,e.duration/2);updateShards(room);assert.deepEqual(e.p,original,'no unused pose calculation before landing');
  const expected=shardBallistic(e,room.time);assert.deepEqual(shardMeta(e,room.time).p,expected.p);assert.deepEqual(room.welcome({id:99}).shards.find(s=>s.id===id).q,expected.q);
  const size=room.shardLandings.size;removeShards(room,id);assert.equal(room.shardLandings.size,size-1);assert.ok(!room.ballisticShards.has(id));
 }finally{room.dispose();}
});
