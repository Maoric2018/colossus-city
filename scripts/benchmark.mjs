/** Real Rapier CPU profile, not a renderer/headset benchmark. Requires npm install.
 * Deliberately invokes the same Room and codec as the running server, without mocks.
 */
import {Room,physicsReady} from '../server/room.js';
import {encodeSnapshot} from '../shared/protocol.js';
import {v} from '../shared/math.js';
import {C} from '../shared/config.js';
import {cpus,platform,arch} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
await physicsReady;
const report={created:new Date().toISOString(),node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,description:'Server step+snapshot only; no transport, renderer or headset benchmark',scenarios:[]};
const percentile=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))];
for(const mode of [0,1,2]){
 const stress=mode===1,contact=mode===2;
 const room=new Room('BENCH1'),ws={send(){},readyState:1};
 try{
  const boss=room.attach(ws,'boss','benchmark'); // Keep the giant still unless inputs are sent.
  for(let i=0;i<8;i++)room.attach(ws,'raider',`P${i}`);
  // Warm the actual solver and event loop before measuring the collapse workload.
  for(let i=0;i<120;i++){room.step();room.drainEvents();}
  let maxBytes=0,maxChunks=0,maxBodies=0,contacts=0;const times=[];
  for(let i=0;i<900;i++){
   const started=performance.now();
   if(stress&&i%150===0){const building=i/150;room.breakCells(room.cells.filter(c=>c.building===building&&c.ground).map(c=>c.id),v(4,1,2));}
   if(stress&&i%180===0)for(const p of room.players.values())if(p.body){p.invulnerable=0;room.knockdown(p,v(12,9,3),110);}
   if(contact){const t=i/60;room.input(boss,{type:'pose',head:[0,23.8,-12],left:[-18,14,-67-Math.sin(t*2)*7],right:[12,15,-48-Math.sin(t*3)*7],yaw:0,reset:i===0});}
   room.step();
   if(i%3===0){const s=room.snapshot();maxBytes=Math.max(maxBytes,encodeSnapshot(s).byteLength);maxBodies=Math.max(maxBodies,s.bodies.length);}
   contacts+=room.drainEvents().filter(e=>e.type==='strike').length;maxChunks=Math.max(maxChunks,room.debris.size);times.push(performance.now()-started);
  }
  if(contact&&!contacts)throw Error('Active-hand benchmark did not touch the city');
  times.sort((a,b)=>a-b);report.scenarios.push({scenario:contact?'8 raiders, active giant hand contact':stress?'8 raiders, 6 staged building collapses, repeated ragdolls':'8 raiders, intact city',steps:times.length,handContacts:contacts,meanMS:times.reduce((s,x)=>s+x,0)/times.length,p50MS:percentile(times,.5),p95MS:percentile(times,.95),p99MS:percentile(times,.99),maxMS:times.at(-1),physicsTickBudgetMS:C.TICK*1000,maxSnapshotBytes:maxBytes,maxDebrisBodies:maxChunks,maxReplicatedBodies:maxBodies});
 }finally{room.dispose();}
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/physics-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
console.log('Saved artifacts/physics-benchmark.json. This does not measure real-time network or Quest frame rate.');
