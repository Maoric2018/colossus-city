// Cut the actual authored triangles, interpolating their original UVs, normals
// and vertex colors. The physics recipe selects cuts; it never supplies artwork.
import * as T from './fracture-types.js';
import {fractureRecipe} from '../../shared/city/fracture.js';
import {capFaces} from './fracture-caps.js';
import {skinKey} from './building-skin.js';
const white=new T.Color(0xffffff),wtc=new T.Color(0x718087);
const remainders=new WeakMap(),fragmentCache=new WeakMap(),standingCache=new WeakMap();
const fragmentKey=(ids,skin)=>skin.glass+':'+skin.facade+':'+ids.join(',');
export const cachedFragments=(source,ids,skin)=>{const draws=fragmentCache.get(source)?.get(fragmentKey(ids,skin));return draws&&!draws.some(d=>d.geometry.userData.fractureReleased)?draws.map(d=>({...d})):undefined;};
export function cacheFragments(source,ids,skin,draws){let cache=fragmentCache.get(source);if(!cache){cache=new Map();fragmentCache.set(source,cache);}if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(fragmentKey(ids,skin),draws.map(d=>({...d})));}
export function releaseAppearanceWork(source){source.records=null;standingCache.delete(source);}
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
 const arrays={position:new Float32Array(count*3),normal:new Float32Array(count*3),uv:new Float32Array(count*2),color:new Float32Array(count*3)},indices=new Uint32Array(count),unique=new Map(),known=new Map();let index=0,corner=0;
 // Reuse only exactly equal complete vertices. UV seams, hard normals and
 // source colors remain separate; every triangle and its winding is unchanged.
 for(const p of polygons)for(let i=1;i<p.length-1;i++)for(const j of [0,i,i+1]){
  const v=p[j];let id=known.get(v);
  if(id===undefined){const hash=Math.imul(v[0]*100003|0,73856093)^Math.imul(v[1]*100003|0,19349663)^Math.imul(v[2]*100003|0,83492791),bucket=unique.get(hash)||[];
   id=bucket.find(e=>e.vertex.every((n,k)=>n===v[k]))?.id;
   if(id===undefined){id=index++;bucket.push({vertex:v,id});unique.set(hash,bucket);const a=id*3,b=id*2;for(let k=0;k<3;k++){arrays.position[a+k]=v[k];arrays.normal[a+k]=v[k+3];arrays.color[a+k]=v[k+8];}arrays.uv[b]=v[6];arrays.uv[b+1]=v[7];}known.set(v,id);
  }indices[corner++]=id;
 }
 const g=new T.BufferGeometry();g.userData.fractureOwned=true;for(const [name,a]of Object.entries(arrays)){const size=name==='uv'?2:3;g.setAttribute(name,new T.BufferAttribute(a.slice(0,index*size),size));}g.setIndex(new T.BufferAttribute(indices,1));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function appearanceDescription(c,resources){
 const pose=resources.pose(c.id),recipe=fractureRecipe(c),scale=new T.Matrix4().makeScale(...c.size),draws=[];
 const add=(mesh,transform,tint,groups,layer='frame',side=-1)=>{
  if(mesh&&groups.length)draws.push({mesh,transform,tint,groups,layer,side,castShadow:mesh.userData?.fractureCastShadow??mesh.castShadow});
 };
 const frames=recipe.groups.filter(g=>g.kind==='frame'),attachments=recipe.groups.filter(g=>g.kind==='attachment'),wall=side=>recipe.groups.filter(g=>g.kind==='wall'&&g.side===side);
 add(c.architecture==='empire'?resources.empireFrame:resources.frame,scale, c.architecture==='empire'?white:pose.tint,frames);
 const skin=skinKey(c),facade=resources.facade[skin],glass=resources.glass[skin];
 for(let side=0;side<4;side++)if(c.walls[side]&&!c.openSkin){const angle=-side*Math.PI/2,rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),wallTransform=offset=>scale.clone().multiply(new T.Matrix4().compose(new T.Vector3(Math.sin(-angle)*offset,0,-Math.cos(-angle)*offset),rotation,new T.Vector3(1,1,1)));
  add(facade,wallTransform(.5),pose.tint,wall(side),'facade',side);add(glass,wallTransform(facade?.514:.5),pose.glassTint||(c.architecture==='wtc'?wtc:white),wall(side),'glass',side);
 }
 if(c.roof)add(resources.roof,scale,white,attachments.length?attachments:frames);
 for(const part of resources.components.entries.get(c.id)||[]){const transform=scale.clone();if(part.side>=0)transform.multiply(new T.Matrix4().makeRotationY(-part.side*Math.PI/2));const mesh=resources.components.batches.get(part.type);let groups=part.side>=0?wall(part.side):frames;
  if(part.side<0&&attachments.length){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();if(mesh.geometry.boundingBox.max.y>.5)groups=attachments;}
  add(mesh,transform,white,groups,part.layer,part.side);
 }
 for(const part of resources.attachments?.get(c.id)||[])add(part.batch,part.local,white,attachments.length?attachments:frames);
 // Compare all authored inputs, not a building/style name: setbacks, tint,
 // mechanical floors, roof equipment and loaded attachments must stay distinct.
 const key=JSON.stringify([recipe.groups,draws.map(d=>[d.mesh.geometry.uuid,d.mesh.material.uuid,!!d.castShadow,d.transform.elements,d.tint.toArray(),d.groups.map(g=>g.id),d.layer,d.side])]);
 return {recipe,draws,key};
}
export function appearanceSources(c,resources,description=appearanceDescription(c,resources)){
 const steps=appearanceSourceSteps(description);let next;do{next=steps.next();}while(!next.done);return next.value;
}
export function* appearanceSourceSteps(description){
 const {recipe,draws}=description,records=[],materials=new Map();
 for(const {mesh,transform,tint,groups,layer,side,castShadow}of draws){
  const g=mesh.geometry.clone().applyMatrix4(transform),key=mesh.material.uuid+':'+!!castShadow;materials.set(key,{material:mesh.material,castShadow});if(!mesh.material.vertexColors)g.deleteAttribute('color');
  const targets=new Map();for(let i=0,n=g.index?.count||g.attributes.position.count;i<n;i+=3){const tri=[0,1,2].map(k=>vertex(g,g.index?g.index.getX(i+k):i+k,tint)),center=[0,1,2].map(k=>tri.reduce((n,v)=>n+v[k],0)/3);
   let best=groups[0],distance=Infinity;for(const group of groups){const d=Math.hypot(...center.map((n,k)=>Math.max(0,Math.abs(n-group.center[k])-group.size[k]/2)));if(d<distance){distance=d;best=group;}}
   if(!targets.has(best.id))targets.set(best.id,[]);targets.get(best.id).push(tri);
  }g.dispose();for(const [group,polygons]of targets)records.push({key,group,polygons,layer,side});yield;
 }
 return {records,materials,recipe};
}
function bounds(piece,group){return {piece,group,lo:piece.p.map((v,k)=>piece.grid[k]===0?-Infinity:v-piece.size[k]/2),hi:piece.p.map((v,k)=>piece.grid[k]===group.n[k]-1?Infinity:v+piece.size[k]/2)};}
export function cutAppearance(source,ids,skin,keep){
 if(!keep){const cached=cachedFragments(source,ids,skin);if(cached)return cached;}
 const byGroup=new Map();for(const id of ids){const p=source.recipe.pieces[id];if(!p)continue;if(!byGroup.has(p.group))byGroup.set(p.group,[]);byGroup.get(p.group).push(bounds(p,source.recipe.groups[p.group]));}
 const output=new Map();for(const record of source.records){if(record.side>=0&&record.layer!=='frame'&&!(skin[record.layer]&(1<<record.side)))continue;const cuts=byGroup.get(record.group)||[];if(!keep&&!cuts.length)continue;let polys=[];
  // A fully released group has no standing surface or exposed boundary. Avoid
  // subtracting hundreds of tiles just to arrive at an empty mesh.
  if(keep&&cuts.length===source.recipe.groups[record.group].n.reduce((a,b)=>a*b,1))continue;
  if(keep){
   const selected=new Set(cuts.map(b=>b.piece.id)),old=remainders.get(record),extendsOld=old&&old.ids.size<=selected.size&&[...old.ids].every(id=>selected.has(id));
   if(extendsOld&&old.ids.size===selected.size)polys=old.surface;
   else{
    polys=extendsOld?old.polygons:record.polygons;for(const b of cuts)if(!extendsOld||!old.ids.has(b.piece.id))polys=polys.flatMap(p=>subtract(p,b));
    const surface=cuts.length?[...polys,...capFaces(record,cuts,true,intersect)]:polys;
    remainders.set(record,{ids:selected,polygons:polys,surface});polys=surface;
   }
  }
  else for(const b of cuts)for(const p of record.polygons){const fragment=intersect(p,b);if(fragment.length>=3)polys.push(fragment);}
  if(!keep&&cuts.length)polys.push(...capFaces(record,cuts,false,intersect));
  // Separate standing wall sides so a cut never repacks the opposite wall or
  // frame. All sections still use the same material batch and authored vertices.
  // Transparent walls retain their original joint draw order; independently
  // sorting their sides changes how overlapping glass blends after a hit.
  const section=keep&&!source.materials.get(record.key).material.transparent?`${record.key}:${record.layer}:${record.side}`:record.key;
  let out=output.get(section);if(!out)output.set(section,out={key:record.key,parts:[]});out.parts.push(polys);
 }
 let previous;if(keep){previous=standingCache.get(source);if(!previous)standingCache.set(source,previous=new Map());}
 const result=[];for(const [section,{key,parts}]of output){
  const old=previous?.get(section),same=old&&!old.geometry?.userData.fractureReleased&&old.parts.length===parts.length&&parts.every((p,i)=>p===old.parts[i]);
  const g=same?old.geometry:geometry(parts.flat());if(previous)previous.set(section,{parts,geometry:g});
  if(g)result.push({key,section,geometry:g,...source.materials.get(key)});
 }
 if(!keep)cacheFragments(source,ids,skin,result);return result.map(draw=>({...draw}));
}
