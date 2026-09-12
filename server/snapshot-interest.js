import {C} from '../shared/config.js';
// Keep every nearby pose at the normal snapshot cadence. Refresh distant poses
// evenly over one second; reliable spawn/damage/settlement events remain complete.
export function snapshotForClient(snapshot,client,room){
 if(!client.snapshotInterest||client.role==='spectator')return snapshot;
 const player=snapshot.players.find(p=>p.id===client.id),focus=client.role==='boss'?snapshot.head:player?.p;
 if(!focus)return snapshot;
 const velocity=player?.v||[0,0,0],radius=230+Math.min(100,Math.hypot(...velocity)),phase=Math.floor(snapshot.tick/C.SNAPSHOT_EVERY),cadence=Math.max(1,Math.round(1/(C.TICK*C.SNAPSHOT_EVERY)));
 const bodies=snapshot.bodies.filter(body=>{
  const p=body.p,dx=p[0]-focus[0],dy=p[1]-focus[1],dz=p[2]-focus[2];
  const reach=radius+(room?.debris.get(body.id)?.radius||0);
  return dx*dx+dy*dy+dz*dz<=reach*reach||(body.id+phase)%cadence===0;
 });
 return bodies.length===snapshot.bodies.length?snapshot:{...snapshot,bodies};
}
