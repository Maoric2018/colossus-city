// A stunt hit on the native articulated ragdoll. Only this private Room is affected.
import {mkdir,writeFile} from 'node:fs/promises';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {v} from '../shared/math.js';
await physicsReady;await mkdir('artifacts/cinematic-demo/action',{recursive:true});
const room=new Room('PUNCH',{environment:{...midtown,infinite:false}});
try{
 const ws={send(){},readyState:1};room.attach(ws,'boss','stunt robot');const client=room.attach(ws,'raider','defender'),p=room.players.get(client.id);
 for(const car of room.cars.values()){car.driving=false;car.body.sleep();}
 room.spawn(p,v(0,17,-12));p.invulnerable=0;p.soaring=true;p.input={...p.input,yaw:-Math.PI/2,pitch:0};p.body.setLinvel(v(14,0,0),true);
 room.drainEvents();room.knockdown(p,v(-30,-2,-7),110,-1);
 const rag=[...room.rags.values()][0],initial=room.ragMeta(rag),frames=[];
 for(let i=0;i<180;i++){room.step();frames.push({time:room.time,parts:room.ragMeta(rag).parts});}
 const chest=frames.at(-1).parts.find(p=>p.name==='chest');
 await writeFile('artifacts/cinematic-demo/action/punch.json',JSON.stringify({initial,frames,contact:[0,17,-12],outgoing:[-16,-2,-7],source:'Native knockdown and jointed Rapier ragdoll'}));
 console.log(JSON.stringify({parts:initial.parts.length,frames:frames.length,lastChest:chest.p}));
}finally{room.dispose();}
