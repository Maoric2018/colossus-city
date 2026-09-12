import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cutAppearance} from '../src/render/fracture-geometry.js';
import {crossSection} from '../src/render/fracture-caps.js';
function polygons(geometry,color=[.12,.3,.08]){
 const g=geometry.index?geometry.toNonIndexed():geometry,triangles=[],a=g.attributes;
 for(let i=0;i<a.position.count;i+=3)triangles.push([0,1,2].map(k=>{const j=i+k;return [a.position.getX(j),a.position.getY(j),a.position.getZ(j),a.normal.getX(j),a.normal.getY(j),a.normal.getZ(j),a.uv.getX(j),a.uv.getY(j),...color];}));
 return triangles;
}
function source(polys){const group={id:0,n:[2,1,1]},pieces=[0,1].map(id=>({id,group:0,grid:[id,0,0],p:[id-.5,0,0],size:[1,2,2]})),material=new T.MeshBasicMaterial({color:0xa34e29,vertexColors:true});return {records:[{key:'brick',group:0,polygons:polys,layer:'frame',side:-1}],recipe:{groups:[group],pieces},materials:new Map([['brick',{material,castShadow:true}]])};}
function triangleArea(polys){return polys.reduce((sum,[a,b,c])=>sum+new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a))).length()/2,0);}
test('the standing cut and loose piece both have solid, source-colored interior faces',()=>{
 const s=source(polygons(new T.BoxGeometry(2,2,2)));
 for(const keep of [true,false]){
  const [draw]=cutAppearance(s,[0],{},keep),mesh=new T.Mesh(draw.geometry,draw.material);mesh.updateMatrixWorld();
  const ray=new T.Raycaster(new T.Vector3(keep?-2:2,0,0),new T.Vector3(keep?1:-1,0,0)),hit=ray.intersectObject(mesh)[0];
  assert.ok(hit,'the exposed interior must be a surface, not an open shell');assert.ok(Math.abs(hit.point.x)<1e-6,'ray must meet the cut face, not the far outer wall');
  const {color,normal}=draw.geometry.attributes;for(const index of [hit.face.a,hit.face.b,hit.face.c]){assert.ok(Math.abs(color.getX(index)-.12)<1e-6);assert.ok(Math.abs(color.getY(index)-.3)<1e-6);assert.ok(Math.abs(color.getZ(index)-.08)<1e-6);assert.equal(normal.getX(index),keep?-1:1);}
  assert.equal(draw.material,s.materials.get('brick').material);assert.ok(hit.uv.toArray().every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  assert.ok(Math.abs(triangleArea(polygons(draw.geometry))-16)<1e-6,'each closed half has the expected surface area');draw.geometry.dispose();
 }
});
test('cut caps keep disconnected steel members separate instead of filling between them',()=>{
 const a=new T.BoxGeometry(2,.5,.5).translate(0,-1,0),b=new T.BoxGeometry(2,.5,.5).translate(0,1,0),caps=crossSection([...polygons(a),...polygons(b)],0,0);
 assert.ok(Math.abs(triangleArea(caps)-.5)<1e-6);assert.ok(caps.every(t=>t.every(v=>v[1]<-.7)||t.every(v=>v[1]>.7)));
});
test('a hollow member retains its bore through the cut surface',()=>{
 const shape=new T.Shape([new T.Vector2(-1,-1),new T.Vector2(1,-1),new T.Vector2(1,1),new T.Vector2(-1,1)]);shape.holes.push(new T.Path([new T.Vector2(-.5,-.5),new T.Vector2(-.5,.5),new T.Vector2(.5,.5),new T.Vector2(.5,-.5)]));
 const hollow=new T.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false}),caps=crossSection(polygons(hollow),2,1);assert.ok(Math.abs(triangleArea(caps)-3)<1e-6,'cap area excludes the central hole');hollow.dispose();
});
test('a single glass sheet does not gain an invented solid cap',()=>{assert.deepEqual(crossSection(polygons(new T.PlaneGeometry(2,2)),0,0),[]);});
test('incremental holes match fresh clipping through reordered hits and resets',()=>{
 const s=source(polygons(new T.BoxGeometry(2,2,2))),group={id:0,n:[5,5,1]},pieces=[];for(let y=0;y<5;y++)for(let x=0;x<5;x++)pieces.push({id:pieces.length,group:0,grid:[x,y,0],p:[-.8+x*.4,-.8+y*.4,0],size:[.4,.4,2]});s.recipe={groups:[group],pieces};
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),rays=[];for(let y=-1.1;y<1.2;y+=.137)for(let x=-1.1;x<1.2;x+=.137)rays.push(new T.Raycaster(new T.Vector3(x,y,3),new T.Vector3(0,0,-1)));
 for(const ids of [[12],[12,7,17],[7,11,12,13,17],[7,11,12,13,17,18,22],[],[1,2],[12]]){
  const fresh={...s,records:s.records.map(r=>({...r}))},a=cutAppearance(s,ids,{},true),b=cutAppearance(fresh,ids,{},true),ma=a.map(d=>new T.Mesh(d.geometry,material)),mb=b.map(d=>new T.Mesh(d.geometry,material));for(const m of [...ma,...mb])m.updateMatrixWorld();
  assert.ok(Math.abs(a.reduce((n,d)=>n+triangleArea(polygons(d.geometry)),0)-b.reduce((n,d)=>n+triangleArea(polygons(d.geometry)),0))<1e-5,'cached cuts preserve all exposed surface area');
  for(const ray of rays){const x=ray.intersectObjects(ma)[0]?.distance??0,y=ray.intersectObjects(mb)[0]?.distance??0;assert.ok(Math.abs(x-y)<1e-5,'incremental holes must match fresh holes');}
  for(const d of [...a,...b])d.geometry.dispose();
 }material.dispose();
});
