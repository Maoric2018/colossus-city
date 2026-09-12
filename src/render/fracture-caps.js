// Close only real cross-sections of the authored mesh. Never fill a proxy box:
// separate members and holes remain separate, and every cap keeps source UV/color.
import {ShapeUtils,Vector2} from './fracture-types.js';
const EPS=1e-6;
const sectionCache=new WeakMap();
const key=v=>v.slice(0,3).map(n=>Math.round(n/EPS)).join(',');
const mix=(a,b,t)=>a.map((n,k)=>n+(b[k]-n)*t);
const area=p=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0)/2;
function contains(poly,p){
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
export function crossSection(polygons,axis,value){
 const nodes=new Map(),edges=new Map();
 for(const poly of polygons){
  const points=[];let positive=false,negative=false;
  for(const p of poly){positive||=p[axis]>value+EPS;negative||=p[axis]<value-EPS;}
  if(!positive||!negative)continue;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],da=a[axis]-value,db=b[axis]-value;
   if(Math.abs(da)<=EPS)points.push(a);
   if(da*db<0&&Math.abs(da)>EPS&&Math.abs(db)>EPS)points.push(mix(a,b,da/(da-db)));
  }
  const unique=[...new Map(points.map(p=>[key(p),p])).values()];if(unique.length!==2)continue;
  const ids=unique.map(key),edge=ids.slice().sort().join('|');if(edges.has(edge))continue;
  edges.set(edge,ids);for(let i=0;i<2;i++){if(!nodes.has(ids[i]))nodes.set(ids[i],{v:unique[i],edges:[]});nodes.get(ids[i]).edges.push(edge);}
 }
 const unused=new Set(edges.keys()),loops=[];
 while(unused.size){
  const first=unused.values().next().value,start=edges.get(first)[0],loop=[];let current=start,edge=first,closed=false;
  while(edge){unused.delete(edge);loop.push(nodes.get(current).v);const pair=edges.get(edge);current=pair[0]===current?pair[1]:pair[0];if(current===start){closed=true;break;}edge=nodes.get(current).edges.find(e=>unused.has(e));}
  // An open source plane has no solid cross-section. Its reverse side uses the
  // same textured material; inventing a cap here would bridge unrelated members.
  if(closed&&loop.length>=3)loops.push(loop);
 }
 const axes=[0,1,2].filter(k=>k!==axis),contours=loops.map(vertices=>({vertices,points:vertices.map(v=>new Vector2(v[axes[0]],v[axes[1]]))}));
 for(const c of contours){c.area=Math.abs(area(c.points));c.depth=contours.filter(other=>other!==c&&Math.abs(area(other.points))>c.area&&contains(other.points,c.points[0])).length;}
 const triangles=[];
 for(const outer of contours){if(outer.depth%2)continue;
  const holes=contours.filter(c=>c.depth===outer.depth+1&&contains(outer.points,c.points[0])),vertices=[...outer.vertices,...holes.flatMap(c=>c.vertices)];
  for(const face of ShapeUtils.triangulateShape(outer.points,holes.map(c=>c.points)))triangles.push(face.map(i=>vertices[i]));
 }
 return triangles;
}
export function capFaces(record,cuts,keep,clip){
 let sections=sectionCache.get(record);if(!sections){sections=new Map();sectionCache.set(record,sections);}
 const output=[],selected=new Set(cuts.map(b=>b.piece.id));
 for(const b of cuts)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const value=(sign<0?b.lo:b.hi)[axis];if(!Number.isFinite(value))continue;
  const stride=axis===0?1:axis===1?b.group.n[0]:b.group.n[0]*b.group.n[1];
  if(selected.has(b.piece.id+sign*stride))continue;
  const id=axis+':'+value.toFixed(7);if(!sections.has(id)){if(sections.size>=512)sections.delete(sections.keys().next().value);sections.set(id,crossSection(record.polygons,axis,value));}
  for(const triangle of sections.get(id)){
   const polygon=clip(triangle,b);if(polygon.length<3)continue;
   const normal=[0,0,0];normal[axis]=keep?-sign:sign;
   const points=polygon.map(v=>[...v.slice(0,3),...normal,...v.slice(6)]),a=points[0],u=points[1].map((n,k)=>n-a[k]),v=points[2].map((n,k)=>n-a[k]);
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   if(cross[axis]*normal[axis]<0)points.reverse();output.push(points);
  }
 }return output;
}
