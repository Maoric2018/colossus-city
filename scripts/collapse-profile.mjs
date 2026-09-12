import {mkdir,writeFile} from 'node:fs/promises';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {packEvents} from '../shared/event-codec.js';
const output=process.argv[2]||'artifacts/optimization/collapse';
await mkdir(output,{recursive:true});await physicsReady;
const env={...midtown,infinite:false,props:[],buildings:[{...midtown.buildings.find(b=>b.architecture===(process.argv[3]||'wtc')),x:0,z:-25}]};
const room=new Room('COLLAPSE',{environment:env});room.attach({send(){}},'boss','profile');
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
try{
 for(const car of room.cars.values()){car.driving=false;car.body.sleep();}
 room.drainEvents();const frames=[],steps=[],bytes=[],collapses=[];
 const collect=()=>{const events=room.drainEvents();frames.push(events);bytes.push(Buffer.byteLength(JSON.stringify(packEvents(events))));};
 const at=performance.now();room.breakCells(room.cells.filter(c=>c.ground).map(c=>c.id),undefined,{granular:true});const triggerMS=performance.now()-at;collect();
 for(let i=0;i<600;i++){const at=performance.now();room.step();steps.push(performance.now()-at);collapses.push(room.fineCollapses.size);collect();if(i%120===119)console.log(JSON.stringify({tick:i+1,shards:room.shards.size,pending:room.fineCollapses.size,stepMS:stats(steps),heapMB:process.memoryUsage().heapUsed/1048576}));}
 const report={cells:room.cells.length,detached:room.detached.size,shards:room.shards.size,active:room.activeShards.size,ballistic:room.ballisticShards.size,resting:room.restingShards.size,triggerMS,steps:stats(steps),packets:stats(bytes),totalBytes:bytes.reduce((a,b)=>a+b,0),heapMB:process.memoryUsage().heapUsed/1048576};
 await writeFile(`${output}/events.json`,JSON.stringify({env,frames}));await writeFile(`${output}/server.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{room.dispose();}
