// Cut the actual authored triangles, interpolating their original UVs, normals
// and vertex colors. The physics recipe selects cuts; it never supplies artwork.
import * as T from 'three';
import {fractureRecipe} from '../../shared/city/fracture.js';
import {capFaces} from './fracture-caps.js';
import {skinKey} from './building-skin.js';
const white=new T.Color(0xffffff),wtc=new T.Color(0x718087);
const remainders=new WeakMap(),fragmentCache=new WeakMap();
const vertex=(g,i,tint)=>{const a=g.attributes,p=a.position,n=a.normal,u=a.uv,c=a.color;return [p.getX(i),p.getY(i),p.getZ(i),n?.getX(i)||0,n?.getY(i)||0,n?.getZ(i)||0,u?.getX(i)||0,u?.getY(i)||0,(c?c.getX(i):1)*tint.r,(c?c.getY(i):1)*tint.g,(c?c.getZ(i):1)*tint.b];};
const interpolate=(a,b,t)=>a.map((n,k)=>n+(b[k]-n)*t);
function split(poly,axis,value,sign){
 if(poly.every(p=>Math.abs(p[axis]-value)<1e-8))return [poly,[]];
 const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da<=1e-8)inside.push(a);if(da>=-1e-8)outside.push(a);if((da<-1e-8&&db>1e-8)||(da>1e-8&&db<-1e-8)){const p=interpolate(a,b,da/(da-db));inside.push(p);outside.push(p);}}return [inside,outside];
}
const planes=b=>[...b.lo.map((v,k)=>[k,v,-1]),...b.hi.map((v,k)=>[k,v,1])].filter(([,v])=>Number.isFinite(v));
function subtract(poly,b){
 for(let k=0;k<3;k++)if(poly.every(p=>p[k]<b.lo[k]-1e-8)||poly.every(p=>p[k]>b.hi[k]+1e-8))return [poly];
 const result=[];for(const [k,v,s]of planes(b)){const [inside,outside]=split(poly,k,v,s);if(outside.length>=3)result.push(outside);poly=inside;if(poly.length<3)break;}return result;
}
function intersect(poly,b){for(let k=0;k<3;k++)if(poly.every(p=>p[k]<b.lo[k]-1e-8)||poly.every(p=>p[k]>b.hi[k]+1e-8))return [];for(const [k,v,s]of planes(b)){poly=split(poly,k,v,s)[0];if(poly.length<3)return [];}return poly;}
function geometry(polygons){
 const count=polygons.reduce((n,p)=>n+Math.max(0,p.length-2)*3,0);if(!count)return null;
 const arrays={position:new Float32Array(count*3),normal:new Float32Array(count*3),uv:new Float32Array(count*2),color:new Float32Array(count*3)};let index=0;
 for(const p of polygons)for(let i=1;i<p.length-1;i++)for(const j of [0,i,i+1]){const v=p[j],a=index*3,b=index*2;for(let k=0;k<3;k++){arrays.position[a+k]=v[k];arrays.normal[a+k]=v[k+3];arrays.color[a+k]=v[k+8];}arrays.uv[b]=v[6];arrays.uv[b+1]=v[7];index++;}
 const g=new T.BufferGeometry();for(const [name,a]of Object.entries(arrays))g.setAttribute(name,new T.BufferAttribute(a,name==='uv'?2:3));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function appearanceSources(c,resources){
 const pose=resources.pose(c.id),recipe=fractureRecipe(c),scale=new T.Matrix4().makeScale(...c.size),records=[],materials=new Map();
 const add=(mesh,transform,tint,groups,layer='frame',side=-1)=>{
  if(!mesh||!groups.length)return;const castShadow=mesh.userData?.fractureCastShadow??mesh.castShadow,g=mesh.geometry.clone().applyMatrix4(transform),key=mesh.material.uuid+':'+!!castShadow;materials.set(key,{material:mesh.material,castShadow});if(!mesh.material.vertexColors)g.deleteAttribute('color');
  const targets=new Map();for(let i=0,n=g.index?.count||g.attributes.position.count;i<n;i+=3){const tri=[0,1,2].map(k=>vertex(g,g.index?g.index.getX(i+k):i+k,tint)),center=[0,1,2].map(k=>tri.reduce((n,v)=>n+v[k],0)/3);
   let best=groups[0],distance=Infinity;for(const group of groups){const d=Math.hypot(...center.map((n,k)=>Math.max(0,Math.abs(n-group.center[k])-group.size[k]/2)));if(d<distance){distance=d;best=group;}}
   if(!targets.has(best.id))targets.set(best.id,[]);targets.get(best.id).push(tri);
  }g.dispose();for(const [group,polygons]of targets)records.push({key,group,polygons,layer,side});
 };
 const frames=recipe.groups.filter(g=>g.kind==='frame'),attachments=recipe.groups.filter(g=>g.kind==='attachment'),wall=side=>recipe.groups.filter(g=>g.kind==='wall'&&g.side===side);
 add(c.architecture==='empire'?resources.empireFrame:resources.frame,scale, c.architecture==='empire'?white:pose.tint,frames);
 const key=skinKey(c),facade=resources.facade[key],glass=resources.glass[key];
 for(let side=0;side<4;side++)if(c.walls[side]&&!c.openSkin){const angle=-side*Math.PI/2,rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),wallTransform=offset=>scale.clone().multiply(new T.Matrix4().compose(new T.Vector3(Math.sin(-angle)*offset,0,-Math.cos(-angle)*offset),rotation,new T.Vector3(1,1,1)));
  add(facade,wallTransform(.5),pose.tint,wall(side),'facade',side);add(glass,wallTransform(facade?.514:.5),pose.glassTint||(c.architecture==='wtc'?wtc:white),wall(side),'glass',side);
 }
 if(c.roof)add(resources.roof,scale,white,attachments.length?attachments:frames);
 for(const part of resources.components.entries.get(c.id)||[]){const transform=scale.clone();if(part.side>=0)transform.multiply(new T.Matrix4().makeRotationY(-part.side*Math.PI/2));const mesh=resources.components.batches.get(part.type);let groups=part.side>=0?wall(part.side):frames;
  if(part.side<0&&attachments.length){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();if(mesh.geometry.boundingBox.max.y>.5)groups=attachments;}
  add(mesh,transform,white,groups,part.layer,part.side);
 }
 for(const part of resources.attachments?.get(c.id)||[])add(part.batch,part.local,white,attachments.length?attachments:frames);
 return {records,materials,recipe};
}
function bounds(piece,group){return {piece,group,lo:piece.p.map((v,k)=>piece.grid[k]===0?-Infinity:v-piece.size[k]/2),hi:piece.p.map((v,k)=>piece.grid[k]===group.n[k]-1?Infinity:v+piece.size[k]/2)};}
export function cutAppearance(source,ids,skin,keep){
 let cache,key;if(!keep){cache=fragmentCache.get(source);if(!cache){cache=new Map();fragmentCache.set(source,cache);}key=skin.glass+':'+skin.facade+':'+ids.join(',');if(cache.has(key))return cache.get(key).map(draw=>({...draw}));}
 const byGroup=new Map();for(const id of ids){const p=source.recipe.pieces[id];if(!p)continue;if(!byGroup.has(p.group))byGroup.set(p.group,[]);byGroup.get(p.group).push(bounds(p,source.recipe.groups[p.group]));}
 const output=new Map();for(const record of source.records){if(record.side>=0&&record.layer!=='frame'&&!(skin[record.layer]&(1<<record.side)))continue;const cuts=byGroup.get(record.group)||[];if(!keep&&!cuts.length)continue;let polys=[];
  if(keep){
   const selected=new Set(cuts.map(b=>b.piece.id)),old=remainders.get(record),extendsOld=old&&old.ids.size<=selected.size&&[...old.ids].every(id=>selected.has(id));
   polys=extendsOld?old.polygons:record.polygons;for(const b of cuts)if(!extendsOld||!old.ids.has(b.piece.id))polys=polys.flatMap(p=>subtract(p,b));
   remainders.set(record,{ids:selected,polygons:polys});polys=[...polys];
  }
  else for(const b of cuts)for(const p of record.polygons){const fragment=intersect(p,b);if(fragment.length>=3)polys.push(fragment);}
  if(cuts.length)polys.push(...capFaces(record,cuts,keep,intersect));
  if(!output.has(record.key))output.set(record.key,[]);output.get(record.key).push(...polys);
 }
 const result=[...output].flatMap(([key,polys])=>{const g=geometry(polys);return g?[{key,geometry:g,...source.materials.get(key)}]:[];});
 if(cache){if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,result);}return result.map(draw=>({...draw}));
}
