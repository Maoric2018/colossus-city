// Staged input, actual game physics. No changes to gameplay modules or live rooms.
import {mkdir,writeFile} from 'node:fs/promises';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {v} from '../shared/math.js';
await physicsReady;
await mkdir('artifacts/cinematic-demo',{recursive:true});
const room=new Room('FILM',{environment:{...midtown,infinite:false}});
try{
 const ws={send(){},readyState:1};room.attach(ws,'boss','director');
 const client=room.attach(ws,'raider','stunt pilot'),p=room.players.get(client.id);
 for(const car of room.cars.values()){car.driving=false;car.body.sleep();}
 const bounds=room.buildingBounds[5],cell=room.cellsByBuilding[5].find(c=>c.floor===3&&c.walls[2]);
 room.spawn(p,v(cell.p[0],cell.p[1],bounds[5]+16));p.body.setLinvel(v(0,0,-32),true);p.invulnerable=100;
 const initial=room.snapshot(),frames=[];room.drainEvents();
 for(let i=0;i<150;i++){
  room.input(client,{type:'input',x:0,z:-1,up:0,yaw:0,pitch:.015,soar:true,dodge:0,seq:i+1});room.step();
  const s=room.snapshot();frames.push({time:s.time,players:s.players,bodies:s.bodies,events:room.drainEvents()});
 }
 const stats={frames:frames.length,fractures:frames.flatMap(f=>f.events).filter(e=>e.type==='fracture').length,shards:room.shards.size};
 await writeFile('artifacts/cinematic-demo/breach.json',JSON.stringify({initial,frames,cell:cell.p,bounds,stats}));
 console.log(JSON.stringify(stats));
}finally{room.dispose();}
const collapse=new Room('FALL',{environment:{...midtown,infinite:false}});
try{
 collapse.attach({send(){}},'boss','director');for(const car of collapse.cars.values()){car.driving=false;car.body.sleep();}
 const initial=collapse.snapshot(),frames=[];collapse.drainEvents();
 for(let i=0;i<240;i++){
  if(i===30){
   const pieces=collapse.breakCells(collapse.cellsByBuilding[7].filter(c=>c.ground).map(c=>c.id),v(9,0,-3),{shatter:true});
   // A choreographed swat gives the released tower angular momentum; Rapier owns the fall.
   for(const e of pieces)if(e.cells.length>9){e.body.setAngvel(v(.08,0,-.85),true);e.body.setLinvel(v(11,1,-1),true);}
  }
  if(i===42)for(const e of [...collapse.debris.values()])if(e.cells.length>9)collapse.splitDebris(e.id);
  collapse.step();const s=collapse.snapshot();frames.push({time:s.time,bodies:s.bodies,events:collapse.drainEvents()});
 }
 await writeFile('artifacts/cinematic-demo/collapse.json',JSON.stringify({initial,frames}));
 console.log(JSON.stringify({collapseFrames:frames.length,detached:collapse.detached.size}));
}finally{collapse.dispose();}
