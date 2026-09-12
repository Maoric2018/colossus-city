import {cellColliders} from './environment.js';
import {roofColliders,staticProps} from './props.js';
import {quatEuler} from './math.js';
import {box,identity,plus,rotate} from './giant-rig.js';
// The server and local Quest preview use the same solid map geometry. This is a
// contact query cache, not a second client physics simulation.
export class HandWorld{
 constructor(env,cells){
  this.cells=new Map(cells.map(c=>[c.id,{cell:c,local:cellColliders(c,c.skin),boxes:[]}]));this.fixed=[box([0,-.3,0],[220,.3,220])];
  for(const prop of staticProps(env)){const q=[0,Math.sin(prop.yaw/2),0,Math.cos(prop.yaw/2)];for(const a of prop.boxes)this.fixed.push(box(plus(prop.position,rotate(a.slice(0,3),q)),a.slice(3),q));}
  for(const prop of env.props)if(prop.collider){const rotation=quatEuler(...(prop.rotation||[0,0,0])),q=[rotation.x,rotation.y,rotation.z,rotation.w],scale=prop.scale||1;this.fixed.push(box(plus(prop.position||[0,0,0],rotate((prop.collider.offset||[0,0,0]).map(v=>v*scale),q)),prop.collider.half.map(v=>v*scale),q));}
  for(const c of cells)this.setCell(c.id,c.p,identity);
 }
 setSkin(id,skin){const entry=this.cells.get(id);if(!entry||entry.debris)return;entry.local=cellColliders(entry.cell,skin);const pose=entry.pose;if(pose){entry.pose=null;this.setCell(id,pose.slice(0,3),pose.slice(3));}}
 setDebris(id,position,rotation){
  const entry=this.cells.get(id);if(!entry)return;entry.debris=true;entry.local=[[0,0,0,...entry.cell.size.map(v=>v*.48)],...roofColliders(entry.cell)];entry.pose=null;this.setCell(id,position,rotation);
 }
 setCell(id,position,rotation=identity,hidden=false){
  const entry=this.cells.get(id);if(!entry)return;if(hidden){entry.boxes=[];entry.pose=null;return;}
  const pose=[...position,...rotation];if(entry.pose?.every((v,i)=>v===pose[i]))return;entry.pose=pose;
  entry.bounds=box(position,entry.cell.size.map(v=>v/2+(entry.cell.spire||4)),rotation);
  entry.boxes=entry.local.map(a=>box(plus(position,rotate(a.slice(0,3),rotation)),a.slice(3),rotation,id));
 }
 *near(from,to){
  const min=from.map((v,i)=>Math.min(v,to[i])-2.5),max=from.map((v,i)=>Math.max(v,to[i])+2.5);
  const overlaps=b=>b.center.every((v,i)=>v+b.extent[i]>=min[i]&&v-b.extent[i]<=max[i]);
  for(const b of this.fixed)if(overlaps(b))yield b;
  for(const entry of this.cells.values())if(entry.pose&&overlaps(entry.bounds))for(const b of entry.boxes)if(overlaps(b))yield b;
 }
}
