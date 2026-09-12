import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {partialInstanceUpdates,commitInstances} from '../src/render/instances.js';
import {Fragments} from '../src/world/fragments.js';
import {FineBuildings} from '../src/world/fine-buildings.js';
import {attachRoofProps} from '../src/district.js';
import {appearanceSources} from '../src/render/fracture-geometry.js';
import {TIERS} from '../src/render/quality.js';
import {generateBlock} from '../shared/city/layout.js';
import {generateCells} from '../shared/environment.js';
// Geometry/slot tests need no pixels. Actual Canvas/WebGL textures are checked by
// the browser city/streaming smoke tests; only the shared glow sprite needs a stub.
globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const {Buildings}=await import('../src/world/buildings.js');
delete globalThis.document;

test('multiple render passes retain all pending instance writes until the GPU consumes them',()=>{
 const dirty=new Set(),mesh=partialInstanceUpdates(new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),128),dirty),m=new T.Matrix4();
 mesh.setMatrixAt(8,m.makeTranslation(1,2,3));commitInstances(dirty);
 mesh.setMatrixAt(2,m.makeTranslation(4,5,6));mesh.setColorAt(7,new T.Color('red'));commitInstances(dirty);
 assert.deepEqual(mesh.instanceMatrix.updateRanges,[{start:32,count:112}]);assert.deepEqual(mesh.instanceColor.updateRanges,[{start:21,count:3}]);
 mesh.instanceMatrix.clearUpdateRanges();mesh.instanceColor.clearUpdateRanges();const version=mesh.instanceMatrix.version;commitInstances(dirty);assert.equal(mesh.instanceMatrix.version,version);
 mesh.setMatrixAt(125,m);commitInstances(dirty);assert.deepEqual(mesh.instanceMatrix.updateRanges,[{start:2000,count:16}]);
});
const read=new T.Matrix4();
function matrixAt(mesh,index,expected){mesh.getMatrixAt(index,read);assert.ok(read.elements.every((n,k)=>Math.abs(n-expected.elements[k])<.0002),`wrong matrix at ${mesh.id}:${index}`);}
function resources(){const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial(),part={geometry,material};return {frame:part,empireFrame:part,roof:part,facade:Object.fromEntries(['brick','stone','glass','concrete','empire'].map(k=>[k,part])),glass:Object.fromEntries(['brick','stone','glass','concrete','empire'].map(k=>[k,part]))};}
test('turning, hiding and moving building bays keeps compact instance slots attached to the right parts',()=>{
 const env=generateBlock(9,7),cells=generateCells(env),root=new T.Group(),b=new Buildings(root,cells,TIERS.quest,{resources:resources(),concrete:null}),camera=new T.PerspectiveCamera(75,1.6,.1,300);
 for(const c of cells)b.setSkin(c.id,15,15);
 const expected=new T.Matrix4(),wall=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0),scale=new T.Vector3();
 for(let step=0;step<30;step++){
  const angle=step*.43;camera.position.set(env.center[0]+Math.sin(angle)*40,25,env.center[1]+Math.cos(angle)*40);camera.lookAt(env.center[0],20,env.center[1]);camera.updateMatrixWorld(true);
  const change=cells[step*7%cells.length],e=b.pose(change.id);b.setCell(change.id,e.p.clone().add(new T.Vector3(.25,.1,.3)),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),step%3===0);b.setSkin(change.id,step%16,step*3%16);
  b.select(camera,230,false);b.components.selectionDirty=true;b.components.select(camera);b.commit();
  assert.equal(b.frame.count,b.slots.frame.length);assert.equal(new Set(b.slots.frame).size,b.frame.count);
  for(const [index,entry]of b.slots.frame.entries()){
   assert.equal(entry.frameIndex,index);assert.equal(cells[entry.index],entry.cell);expected.compose(entry.p,entry.q,entry.size);matrixAt(b.frame,index,expected);
   if(entry.roofIndex>=0)matrixAt(b.roof,entry.roofIndex,expected);
   const key=entry.cell.architecture==='empire'?'empire':entry.cell.material;
   for(const w of entry.walls){const angle=w.side*Math.PI/2;wall.compose(new T.Vector3(Math.sin(angle)*.5,0,-Math.cos(angle)*.5),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-angle),new T.Vector3(1,1,1));
    if(b.facade[key])matrixAt(b.facade[key],w.index,entry.facadeMask&(1<<w.side)?expected.clone().multiply(wall):zero);
   }
  }
  for(const [type,parts]of b.components.active){assert.equal(b.components.batches.get(type).count,parts.length);for(const [index,part]of parts.entries()){
   assert.equal(part.index,index);expected.compose(part.pose.p,part.pose.q,scale.set(...part.cell.size));if(part.side>=0)expected.multiply(new T.Matrix4().makeRotationY(-part.side*Math.PI/2));matrixAt(b.components.batches.get(type),index,expected);
  }}
 }
 for(const mesh of b.batches){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceColor?.clearUpdateRanges();}
 b.select(camera,230,false);b.components.select(camera);b.commit();assert.ok(b.batches.every(mesh=>!mesh.instanceMatrix.updateRanges.length),'a stationary city writes no instance matrices');
 b.components.unregister(cells);assert.ok([...b.components.active.values()].every(parts=>parts.length===0));
});
test('persistent facade fragments grow on demand without losing old pieces or their transforms',()=>{
 const root=new T.Group(),fragments=new Fragments(root,[],TIERS.quest),pose={p:new T.Vector3(0,15,0),q:new T.Quaternion()};assert.equal(root.children.length,0);
 for(let i=0;i<40;i++)fragments.add({id:i,material:'brick',size:[4,3,4],p:[i,15,0],floor:5},0,'glass',pose,false);
 assert.equal(root.children.length,1);assert.equal(fragments.pieces.size,80);const mesh=fragments.batches.get('glass');assert.equal(mesh.count,80);assert.equal(mesh.instanceMatrix.count,128);
 for(const piece of fragments.pieces.values()){assert.equal(piece.mesh,mesh);matrixAt(mesh,piece.index,new T.Matrix4().compose(piece.end,piece.rotation,piece.scale));}
 mesh.instanceMatrix.clearUpdateRanges();fragments.update(1);assert.equal(mesh.instanceMatrix.updateRanges.length,0);
 fragments.reset();assert.equal(mesh.count,0);fragments.add({id:2,material:'brick',size:[4,3,4],p:[0,15,0],floor:5},0,'glass',pose,true);fragments.update(.1);assert.equal(mesh.count,2);assert.equal(fragments.active.size,2);
});
test('shadow casters retain exact hidden and moving geometry without entering the main camera draw',()=>{
 const env=generateBlock(9,7),cells=generateCells(env),b=new Buildings(new T.Group(),cells,TIERS.quest,{resources:resources(),concrete:null}),camera=new T.PerspectiveCamera(60,1.6,.1,300);
 for(const c of cells)b.setSkin(c.id,15,15);camera.position.set(...[env.center[0],20,env.center[1]]);camera.lookAt(env.center[0],20,env.center[1]-100);camera.updateMatrixWorld(true);b.select(camera,230,true);b.commit();
 const shadow=b.shadowView,offscreen=[...b.entries.values()].find(e=>e.shadowNear&&!e.inView);assert.ok(offscreen);assert.equal(offscreen.frameIndex,-1);assert.ok(b.frame.count<cells.length);assert.equal(b.frame.castShadow,false);assert.equal(shadow.frame.count,0);
 assert.ok([...appearanceSources(offscreen.cell,b).materials.values()].some(m=>m.castShadow),'clipped structure keeps casting shadows after intact casters are separated');
 matrixAt(shadow.frame,offscreen.index,new T.Matrix4().compose(offscreen.p,offscreen.q,offscreen.size));shadow.frame.onBeforeShadow();assert.equal(shadow.frame.count,cells.length);shadow.frame.onAfterShadow();assert.equal(shadow.frame.count,0);
 b.setCell(offscreen.cell.id,offscreen.p.clone().add(new T.Vector3(5,3,0)),new T.Quaternion(),false);matrixAt(shadow.frame,offscreen.index,new T.Matrix4().compose(offscreen.p,offscreen.q,offscreen.size));
 b.setCell(offscreen.cell.id,null,null,true);matrixAt(shadow.frame,offscreen.index,new T.Matrix4().makeScale(0,0,0));b.select(camera,230,false);b.commit();assert.ok(shadow.meshes.every(m=>!m.visible));b.setCell(offscreen.cell.id,null,null,false);b.select(camera,230,true);b.commit();matrixAt(shadow.frame,offscreen.index,new T.Matrix4().compose(offscreen.p,offscreen.q,offscreen.size));
});
test('roof props follow stereo visibility, fog distance, moving bays and returning cameras',()=>{
 const cells=generateCells(generateBlock(9,7)),b=new Buildings(new T.Group(),cells,TIERS.quest,{resources:resources(),concrete:null}),c=cells.find(c=>c.roof),e=b.pose(c.id),batch=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),1),local=new T.Matrix4().makeTranslation(0,4,0),attachments=new Map([[c.id,[{batch,index:0,local}]]]);attachRoofProps({buildings:b,attachments},[c]);
 const camera=new T.PerspectiveCamera(60,1,.1,200);camera.position.copy(e.p).add(new T.Vector3(0,0,20));camera.lookAt(e.p);camera.updateMatrixWorld(true);b.select(camera,65,false);matrixAt(batch,0,new T.Matrix4().compose(e.p,e.q,new T.Vector3(1,1,1)).multiply(local));
 const reverse=camera.clone();reverse.rotateY(Math.PI);reverse.updateMatrixWorld(true);b.select(reverse,65,false);matrixAt(batch,0,new T.Matrix4().makeScale(0,0,0));b.select(new T.ArrayCamera([reverse,camera]),65,false);assert.ok(e.attachmentVisible);
 b.select(reverse,65,true);assert.ok(e.attachmentVisible,'nearby roof casters remain available for shadows');camera.position.x+=1000;camera.updateMatrixWorld(true);b.select(camera,65,true);assert.equal(e.attachmentVisible,false);matrixAt(batch,0,new T.Matrix4().makeScale(0,0,0));
 b.setCell(c.id,e.p.clone().add(new T.Vector3(1000,1,0)),new T.Quaternion(),false);camera.lookAt(e.p);camera.updateMatrixWorld(true);b.select(camera,65,false);matrixAt(batch,0,new T.Matrix4().compose(e.p,e.q,new T.Vector3(1,1,1)).multiply(local));
 b.setCell(c.id,null,null,true);matrixAt(batch,0,new T.Matrix4().makeScale(0,0,0));b.setCell(c.id,null,null,false);b.select(camera,65,false);assert.ok(e.attachmentVisible);const version=batch.instanceMatrix.version;b.select(camera,65,false);assert.equal(batch.instanceMatrix.version,version);
});
test('repeated fine geometry replacement recycles empty buffers and shares live fragment geometry',()=>{
 const root=new T.Group(),fine=new FineBuildings(root,TIERS.quest),material=new T.MeshBasicMaterial(),geometry=()=>new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(3000*3),3));
 for(let i=0;i<80;i++){const draw=fine.add({key:'wall',geometry:geometry(),material,castShadow:true});assert.equal(draw.pool.mesh.instanceCount,1);fine.remove(draw);}
 const g=geometry(),a=fine.add({key:'wall',geometry:g,material,castShadow:true}),b=fine.add({key:'wall',geometry:g,material,castShadow:true});assert.equal(a.geometryId,b.geometryId);assert.equal(a.pool.live,3000);assert.equal(a.pool.count,2);fine.remove(a);assert.equal(b.pool.live,3000);assert.ok(b.pool.mesh.getVisibleAt(b.index));fine.remove(b);assert.equal(fine.pools.get('wall').live,0);assert.equal(root.children.length,1);fine.reset();assert.equal(root.children.length,0);
});
