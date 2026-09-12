// Offline cinematic destruction and a matched-pose, localized-impulse stunt.
import {mkdir,writeFile} from 'node:fs/promises';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {raiderParts,raiderLinks} from '../shared/raider-rig.js';
import {stuntPose,rotation} from './stunt-pose.js';
import {composeRotation} from '../shared/raider-pose.js';
import {rotate,plus,minus} from '../shared/giant-rig.js';
import {C,group} from '../shared/config.js';
import {v} from '../shared/math.js';
await physicsReady;const out='artifacts/cinematic-demo/extended';await mkdir(out,{recursive:true});
for(const spec of [
 {id:'miss',building:5,at:[-58,16,66],dir:[-18,3,0],mode:'hole',frames:300},
 {id:'shear',building:19,at:[130,17,-70],dir:[16,2,0],mode:'shear',frames:270},
 {id:'warehouse',building:13,at:[-124,5,136],dir:[-16,2,0],mode:'base',frames:270}
]){
 const room=new Room('STUNT',{environment:{...midtown,infinite:false}});
 try{
  room.attach({send(){},readyState:1},'boss','director');for(const car of room.cars.values()){car.driving=false;car.body.sleep();}
  const initial=room.snapshot(),frames=[];room.drainEvents();
  for(let i=0;i<spec.frames;i++){
   if(i===0){
    const cells=room.cellsByBuilding[spec.building].filter(c=>spec.mode==='base'?c.ground:spec.mode==='shear'?c.floor===4:Math.hypot(c.p[0]-spec.at[0],(c.p[1]-spec.at[1])*1.05,c.p[2]-spec.at[2])<9);
    const pieces=room.breakCells(cells.map(c=>c.id),v(...spec.dir),{shatter:true});
    for(const e of pieces)if(e.cells.length>5){e.body.setLinvel(v(...spec.dir),true);e.body.setAngvel(v(0,0,spec.dir[0]>0?-.65:.65),true);}
   }
   if(i===30&&spec.mode!=='hole')for(const e of [...room.debris.values()])if(e.cells.length>8)room.splitDebris(e.id);
   room.step();const s=room.snapshot();frames.push({time:s.time,bodies:s.bodies,events:room.drainEvents()});
  }
  await writeFile(`${out}/${spec.id}.json`,JSON.stringify({initial,frames,spec}));console.log(spec.id,frames.flatMap(f=>f.events).length,'events');
 }finally{room.dispose();}
}
const room=new Room('HIT',{environment:{...midtown,infinite:false}});
try{
 const scale=1.2,at=[-31,16,-13.4],root=composeRotation(rotation(0,Math.PI,0),rotation(-Math.PI/2,0,0)),pose=stuntPose({time:1,brace:.25});
 const vec=a=>v(...a),qobj=q=>({x:q[0],y:q[1],z:q[2],w:q[3]}),G=C.COLLISION;
 const parts=raiderParts.map((d,i)=>{
  const q=composeRotation(root,pose[i].q),p=plus(at,rotate(pose[i].p.map(x=>x*scale),root));
  const body=room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...p).setRotation(qobj(q)).setLinearDamping(.09).setAngularDamping(.5).setCcdEnabled(true));
  room.world.createCollider(RAPIER.ColliderDesc.cuboid(...d.s.map(x=>x*scale/2)).setMass(i===1?22:i===0?14:5).setFriction(.72).setRestitution(.06).setCollisionGroups(group(G.RAGDOLL,G.WORLD|G.DEBRIS)),body);
  // Torso receives the punch first. Limbs lag and the articulated body folds.
  body.setLinvel(v(2.5,4,-17),true);body.setAngvel(v(2.1,.15,-.7),true);
  if(i===1)body.applyImpulseAtPoint(v(18,34,-95),vec(plus(p,[-.16,-.1,.12])),true);
  return {id:30000+i,name:d.name,size:d.s,body};
 });
 for(const {a,b,anchor}of raiderLinks){
  const aa=minus(anchor,raiderParts[a].o).map(x=>x*scale),ab=minus(anchor,raiderParts[b].o).map(x=>x*scale);
  room.world.createImpulseJoint(RAPIER.JointData.spherical(vec(aa),vec(ab)),parts[a].body,parts[b].body,true);
 }
 const snap=()=>({parts:parts.map(p=>({id:p.id,name:p.name,size:p.size,p:Object.values(p.body.translation()),q:Object.values(p.body.rotation())}))});
 const initial=snap(),frames=[];for(let i=0;i<240;i++){room.world.step();frames.push(snap());}
 await writeFile(`${out}/hit.json`,JSON.stringify({initial,frames,contact:at,scale,source:'Matched custom skeleton pose; chest impulse and articulated secondary motion'}));console.log('hit',frames.length,'frames');
}finally{room.dispose();}
