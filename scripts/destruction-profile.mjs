// Reproducible fine-destruction workload. Traffic is parked to isolate this pass.
import {mkdir,writeFile} from 'node:fs/promises';
import {Room,physicsReady} from '../server/room.js';
import {activeEnvironment} from '../shared/environment.js';
import {chipCell} from '../server/fracture.js';
import {encodeSnapshot} from '../shared/protocol.js';
const output=process.argv[2]||'artifacts/optimization/destruction';
let packEvents=e=>e;try{({packEvents}=await import('../shared/event-codec.js'));}catch{}
await physicsReady;const runs=[];
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
for(let run=0;run<4;run++){
 const room=new Room('PROFILE',{environment:{...activeEnvironment,infinite:false}});room.attach({send(){}},'boss','profile');
 try{
  for(const car of room.cars.values()){car.driving=false;car.body.sleep();}
  for(let i=0;i<60;i++){room.step();room.drainEvents();}
  const cells=room.cells.filter(c=>c.material==='brick'&&c.floor===2&&c.walls[2]).slice(0,30),impacts=[];let pieces=0;
  const began=performance.now();for(const c of cells){const t=performance.now();pieces+=chipCell(room,c,[c.p[0],c.p[1],c.p[2]+c.size[2]/2],.65,Infinity).length;impacts.push(performance.now()-t);}const impactMS=performance.now()-began;
  const events=room.drainEvents(),groups=room.shards.size,steps=[];let queries=0,maxQueries=0;
  const refresh=room.world.updateSceneQueries;room.world.updateSceneQueries=()=>{queries++;refresh();};
  for(let i=0;i<600;i++){queries=0;const at=performance.now();room.step();room.drainEvents();steps.push(performance.now()-at);maxQueries=Math.max(maxQueries,queries);}
  runs.push({pieces,groups,impactMS,impact:stats(impacts),step:stats(steps),maxQueriesPerTick:maxQueries,rawEventBytes:Buffer.byteLength(JSON.stringify(events)),wireEventBytes:Buffer.byteLength(JSON.stringify(packEvents(events))),snapshotBytes:encodeSnapshot(room.snapshot()).byteLength,retainedGroups:room.shards.size});
 }finally{room.dispose();}
}
await mkdir(output,{recursive:true});const report={created:new Date().toISOString(),description:'30 fine wall impacts, then 600 actual physics ticks; first of four runs is warmup. No renderer/network/headset timing.',runs};await writeFile(`${output}/physics.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
