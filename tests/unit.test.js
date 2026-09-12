import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCells,unsupportedCells,cellColliders,city} from '../shared/environment.js';
import {v,segmentDistance,segmentAABB,raySphere,rotateYaw,lookDir,len,sanitizeInput,finiteVector,seeded} from '../shared/math.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
import {Connection} from '../src/network.js';
import {C,group} from '../shared/config.js';
const cells=generateCells(),byId=new Map(cells.map(c=>[c.id,c]));
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const base=()=>({tick:19,time:1.25,bossHP:2200,remaining:123,kills:2,head:[0,23.8,0],left:[-5,15,0],right:[5,15,0],bossYaw:.5,bossX:0,bossZ:0,damage:12,phase:0,round:1,players:[],bodies:[]});
test('map generation is deterministic and all cell IDs are unique',()=>{assert.deepEqual(generateCells(),cells);assert.equal(byId.size,cells.length);assert.equal(cells.length,316);});
test('every support edge is reciprocal and inside one building',()=>{for(const c of cells)for(const n of c.neighbors){assert.ok(byId.get(n).neighbors.includes(c.id));assert.equal(c.building,byId.get(n).building);}});
test('intact map has no unsupported nodes',()=>assert.deepEqual(unsupportedCells(cells,new Set()),[]));
test('destroying every foundation releases that building, not its neighbours',()=>{
 const foundation=cells.filter(c=>c.building===0&&c.ground),removed=new Set(foundation.map(c=>c.id));
 const result=unsupportedCells(cells,removed);assert.equal(result.length,20);for(const id of result)assert.equal(byId.get(id).building,0);
});
test('one intact foundation retains a path through connected bays',()=>{const foundations=cells.filter(c=>c.building===0&&c.ground);assert.equal(unsupportedCells(cells,new Set(foundations.slice(1).map(c=>c.id))).length,0);});
test('severing a complete floor releases precisely the upper storeys',()=>{
 const removed=new Set(cells.filter(c=>c.building===0&&c.floor===2).map(c=>c.id));const result=unsupportedCells(cells,removed);assert.equal(result.length,12);assert.ok(result.every(id=>byId.get(id).floor>2));
});
test('empty support graph has no remaining nodes to detach',()=>assert.deepEqual(unsupportedCells(cells,new Set(cells.map(c=>c.id))),[]));
test('structural bays remain hollow beneath their rooftop equipment',()=>{
 for(const c of cells){const shapes=cellColliders({...c,hasRoofProps:false}),volume=shapes.reduce((s,x)=>s+8*x[3]*x[4]*x[5],0),envelope=c.size.reduce((a,b)=>a*b,1);assert.ok(volume<envelope*.35);assert.ok(shapes.length>=5);}
});
test('structural collision shapes are finite and stay inside each bay',()=>{for(const c of cells)for(const a of cellColliders({...c,hasRoofProps:false})){assert.ok(a.every(Number.isFinite));for(let k=0;k<3;k++){assert.ok(a[k+3]>0);assert.ok(Math.abs(a[k])+a[k+3]<=c.size[k]/2+1e-6);}}});
test('segment sweep catches a fast hand passing entirely through a target',()=>{assert.ok(segmentAABB(v(-20,4,0),v(20,4,0),v(0,4,0),v(2,2,2),1));near(segmentDistance(v(0,4,0),v(-20,4,0),v(20,4,0)),0);});
test('sweep handles parallel misses and stationary hands',()=>{assert.equal(segmentAABB(v(-20,10,0),v(20,10,0),v(),v(1,1,1)),false);assert.equal(segmentAABB(v(),v(),v(),v(1,1,1)),true);near(segmentDistance(v(3,4,0),v(),v()),5);});
test('ray-sphere intersection chooses the nearest forward hit',()=>{near(raySphere(v(0,0,10),v(0,0,-1),v(),2),8);assert.equal(raySphere(v(0,0,10),v(0,0,1),v(),2),Infinity);near(raySphere(v(),v(1,0,0),v(),2),2);});
test('movement and aim share the same yaw convention',()=>{const move=rotateYaw(v(0,0,-1),Math.PI/2),aim=lookDir(Math.PI/2);near(move.x,-1);near(move.x,aim.x);near(move.z,aim.z);near(len(lookDir(.5,.8)),1);});
test('hostile input cannot introduce nonfinite axes or unbounded speeds',()=>{const i=sanitizeInput({yaw:0,pitch:0,x:Infinity,z:-Infinity,up:500,seq:Infinity});assert.equal(i.x,1);assert.equal(i.z,-1);assert.equal(i.up,1);assert.ok(Number.isFinite(i.seq));assert.equal(sanitizeInput({yaw:NaN,pitch:0}),null);});
test('tracked poses must be finite, bounded triples',()=>{assert.ok(finiteVector([1,2,3]));assert.equal(finiteVector([0,0,Infinity]),false);assert.equal(finiteVector([0,0,0,1]),false);assert.equal(finiteVector([0,1e9,0]),false);});
test('collision masks allow giant/debris but not giant/player rigid contact',()=>{const interacts=(a,b)=>!!((a>>>16)&(b&65535))&&!!((b>>>16)&(a&65535));const g=C.COLLISION;assert.ok(interacts(group(g.GIANT,g.DEBRIS|g.RAGDOLL),group(g.DEBRIS)));assert.equal(interacts(group(g.GIANT,g.DEBRIS|g.RAGDOLL),group(g.PLAYER,g.DEBRIS|g.WORLD)),false);});
test('binary protocol round-trips empty state',()=>{const input=base(),buffer=encodeSnapshot(input),output=decodeSnapshot(buffer);assert.equal(buffer.byteLength,124);assert.equal(output.tick,19);near(output.head[1],23.8);});
test('binary packet size matches documented bandwidth budget',()=>{const s=base();s.players=Array.from({length:8},(_,i)=>({id:i+1,flags:0,p:[0,1,0],v:[0,0,0],yaw:0,hp:100,fuel:1,seq:3}));s.bodies=Array.from({length:232},(_,i)=>({id:1000+i,p:[0,2,0],q:[0,0,0,1]}));const b=encodeSnapshot(s),d=decodeSnapshot(b);assert.equal(b.byteLength,7996);assert.equal(d.bodies.length,232);assert.equal(d.players.length,8);});
test('truncated, forged and oversized binary packets are rejected',()=>{
 assert.throws(()=>decodeSnapshot(new ArrayBuffer(20)));const b=encodeSnapshot(base());new DataView(b).setUint32(24,9999,true);assert.throws(()=>decodeSnapshot(b));const c=encodeSnapshot(base());new DataView(c).setUint32(0,0,true);assert.throws(()=>decodeSnapshot(c));
});
test('seeded visual randomness is reproducible',()=>{const a=seeded(77),b=seeded(77);for(let i=0;i<100;i++)assert.equal(a(),b());});
test('500 randomized transform packets survive the codec within float32 tolerance',()=>{
 const rand=seeded(58);for(let k=0;k<500;k++){const s=base();s.bodies=Array.from({length:10},(_,i)=>({id:i+1000,p:Array.from({length:3},()=>rand()*160-80),q:[0,0,0,1]}));const d=decodeSnapshot(encodeSnapshot(s));d.bodies.forEach((p,i)=>p.p.forEach((x,j)=>near(x,s.bodies[i].p[j],1e-4)));}
});
test('interpolation preserves flags and normalizes quaternion interpolation',()=>{
 const n=new Connection(()=>{},()=>{});try{const a=base(),b=base();a.time=0;b.time=.2;a.bodies=[{id:1,p:[0,0,0],q:[0,0,0,1]}];b.bodies=[{id:1,p:[2,0,0],q:[0,0,0,-1]}];n.snapshots=[a,b];n.receivedAt=performance.now();const s=n.sample();near(s.bodies[0].p[0],1,.02);near(Math.hypot(...s.bodies[0].q),1);}finally{n.dispose();}
});

test('camera collision ray handles inside, parallel, forward and limited-distance cases',async()=>{
 const {rayAABB,quatEuler}=await import('../shared/math.js');
 near(rayAABB(v(0,0,10),v(0,0,-1),v(),v(2,2,2)),8);
 assert.equal(rayAABB(v(0,0,10),v(0,0,-1),v(),v(2,2,2),7),Infinity);
 assert.equal(rayAABB(v(5,0,10),v(0,0,-1),v(),v(2,2,2)),Infinity);
 near(rayAABB(v(),v(1,0,0),v(),v(2,2,2)),0);
 const q=quatEuler(.6,1.2,-.4);near(Math.hypot(q.x,q.y,q.z,q.w),1);
});
test('weapon convergence is separate from movement yaw and rejects invalid aim',()=>{
 const i=sanitizeInput({yaw:.2,pitch:.3,aimYaw:1.2,aimPitch:.4});near(i.yaw,.2);near(i.aimYaw,1.2);
 const fallback=sanitizeInput({yaw:.2,pitch:.3,aimYaw:NaN,aimPitch:Infinity});near(fallback.aimYaw,.2);near(fallback.aimPitch,.3);
});
