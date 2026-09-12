import {generateCells} from '../shared/city/cells.js';
import {blockAt,BLOCK_SIZE} from '../shared/city/layout.js';
import {roofColliders} from '../shared/props.js';
import {rayAABB,v} from '../shared/math.js';

// Visit every grid cell, including short diagonal crossings a fixed-distance
// sampling loop can miss. t is the fraction of the full ray at block entry.
export function* rayBlocks(from,to){
 let [x,z]=blockAt(from.x,from.z);const [endX,endZ]=blockAt(to.x,to.z),dx=to.x-from.x,dz=to.z-from.z,sx=Math.sign(dx),sz=Math.sign(dz);
 const stepX=dx?BLOCK_SIZE/Math.abs(dx):Infinity,stepZ=dz?BLOCK_SIZE/Math.abs(dz):Infinity;
 let tx=dx?((x+(sx>0?.5:-.5))*BLOCK_SIZE-from.x)/dx:Infinity,tz=dz?((z+(sz>0?.5:-.5))*BLOCK_SIZE-from.z)/dz:Infinity,t=0;
 for(let n=Math.abs(endX-x)+Math.abs(endZ-z)+3;n-->0;){
  yield {x,z,t};if(x===endX&&z===endZ)return;
  if(tx<tz){t=tx;tx+=stepX;x+=sx;}else{t=tz;tz+=stepZ;z+=sz;}if(t>1)return;
 }
}
export function rayBounds(env){
 const bounds=env.buildings.map(()=>[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
 for(const c of generateCells(env)){
  const b=bounds[c.building],half=c.size.map(n=>n/2+.3);
  for(const a of roofColliders(c))for(let k=0;k<3;k++)half[k]=Math.max(half[k],Math.abs(a[k])+a[k+3]);
  for(let k=0;k<3;k++){b[k]=Math.min(b[k],c.p[k]-half[k]);b[k+3]=Math.max(b[k+3],c.p[k]+half[k]);}
 }
 // The continuous sidewalk slab reaches .16 m above the ground.
 bounds.push([env.center[0]-35,-.6,env.center[1]-35,env.center[0]+35,.16,env.center[1]+35]);
 return bounds;
}
export function intersectsRayBounds(bounds,from,direction,distance){
 return bounds.some(b=>rayAABB(from,direction,v((b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2),v((b[3]-b[0])/2,(b[4]-b[1])/2,(b[5]-b[2])/2),distance)<Infinity);
}
export function archivedRayBounds(saved,bounds){
 if(!saved)return [];
 const lo=[0,1,2].map(k=>Math.min(...bounds.map(b=>b[k]))),hi=[0,1,2].map(k=>Math.max(...bounds.map(b=>b[k+3]))),span=Math.hypot(...hi.map((n,k)=>n-lo[k]));
 // A bay may have fallen into an otherwise empty road. Its body pose is the
 // archive's authority; the whole owner-block diagonal safely bounds any group.
 return [...(saved.entities||[]).map(e=>({p:e.p,radius:span})),...(saved.shards||[]).map(e=>({p:e.p,radius:Math.hypot(...e.half)*1.1}))].map(({p,radius})=>[...p.map(n=>n-radius),...p.map(n=>n+radius)]);
}
