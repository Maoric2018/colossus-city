import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateCells,initialSkin} from '../shared/city/cells.js';
import {fractureRecipe} from '../shared/city/fracture.js';
import {FineBuildings,FRACTURE_PAGE_VERTICES} from '../src/world/fine-buildings.js';
import {FracturePreparation} from '../src/world/fracture-preparation.js';
import {RenderWarmup} from '../src/render/warmup.js';
import {cutAppearance,cachedFragments} from '../src/render/fracture-geometry.js';
function fixture(){
 const cells=generateCells({buildings:[{x:0,z:0,bay:4,story:4,material:'glass',tiers:[{nx:1,nz:1,floors:6,ix:0,iz:0}]}]}),poses=new Map(cells.map(c=>[c.id,{p:new T.Vector3(...c.p),q:new T.Quaternion(),tint:new T.Color(1,1,1),hidden:false}]));
 const material=new T.MeshBasicMaterial(),frame=new T.Mesh(new T.BoxGeometry(1,1,1),material),glass=new T.Mesh(new T.PlaneGeometry(1,1),material),resources={pose:id=>poses.get(id),frame,roof:frame,facade:{},glass:{glass},components:{entries:new Map(),batches:new Map()},attachments:new Map(),setCell(id,p,q,hidden){const e=poses.get(id);if(p)e.p.copy(p);if(q)e.q.copy(q);e.hidden=hidden;e.fine?.update();}};
 return {cells,poses,resources,fine:new FineBuildings(new T.Group(),{name:'QUEST'})};
}
const meta=(c,id,pieces)=>({id,cell:c.id,pieces,origin:[...c.p],p:[...c.p],q:[0,0,0,1],settled:false,born:0});
function queue(f,c){const recipe=fractureRecipe(c),skin={...initialSkin(c),parts:recipe.pieces.map(p=>p.id)};f.fine.queueCollapse(c,skin,f.poses.get(c.id),f.resources);for(const g of recipe.groups)f.fine.addShards(c,meta(c,c.id*100+g.id,recipe.pieces.filter(p=>p.group===g.id).map(p=>p.id)),f.resources);return recipe;}
test('identical floors share exact source and fragment geometry while tints and attachments remain distinct',()=>{
 const f=fixture(),[a,b,c]=f.cells.slice(1,4),fine=f.fine;
 assert.equal(fine.source(a,f.resources),fine.source(b,f.resources));
 const ids=[0,1,2];fine.addShards(a,meta(a,1,ids),f.resources);fine.addShards(b,meta(b,2,ids),f.resources);
 const first=fine.shards.get(1).parts[0],second=fine.shards.get(2).parts[0];assert.equal(first.shared,second.shared);assert.equal(first.shared.refs,2);
 f.poses.get(c.id).tint.setRGB(.4,.5,.6);assert.notEqual(fine.source(a,f.resources),fine.source(c,f.resources));
 const original=fine.source(b,f.resources);f.resources.attachments.set(b.id,[{batch:new T.Mesh(new T.BoxGeometry(.2,.3,.4),new T.MeshBasicMaterial()),local:new T.Matrix4().makeTranslation(1,2,3)}]);fine.refreshSource(b,f.resources);assert.notEqual(fine.source(b,f.resources),original);assert.equal(fine.source(a,f.resources),original);
 fine.unregister([b,c]);assert.equal(fine.templates.size,1);assert.equal(first.shared.refs,1);fine.reset();assert.equal(fine.templates.size,0);
});
test('collapse preparation hands off a visible falling bay atomically and keeps queued pose and settlement updates',()=>{
 const f=fixture(),c=f.cells[2],recipe=queue(f,c),fine=f.fine,first=c.id*100;
 assert.equal(fine.shards.size,0);assert.equal(fine.pendingShards.size,recipe.groups.length);fine.prepareCollapses(0);assert.equal(f.poses.get(c.id).hidden,false);
 assert.ok(fine.poseShard(first,[4,5,6],[0,0,0,1]));const settled={...fine.pendingShards.get(first+1).metas.get(first+1),settled:true,p:[7,1,9]};fine.addShards(c,settled,f.resources);
 fine.prepareCollapses(Infinity);assert.equal(fine.collapses.size,0);assert.equal(fine.pendingShards.size,0);assert.equal(fine.shards.size,recipe.groups.length);assert.equal(f.poses.get(c.id).hidden,true);
 assert.deepEqual(fine.shards.get(first).p.toArray(),[4,5,6]);assert.deepEqual(fine.shards.get(first+1).p.toArray(),[7,1,9]);assert.equal(fine.shards.get(first+1).settled,true);assert.ok([...fine.shards.values()].every(e=>!e.pending));assert.equal(fine.cells.get(c.id).parts.length,0);
 fine.reset();
});
test('a collapse in an older room starts falling at the authoritative release time',()=>{
 const f=fixture(),c=f.cells[3],fine=f.fine,skin={...initialSkin(c),parts:fractureRecipe(c).pieces.map(p=>p.id)};fine.queueCollapse(c,skin,f.poses.get(c.id),f.resources);fine.addShards(c,{...meta(c,1,[0]),born:120},f.resources);
 fine.prepareCollapses=()=>{};fine.update(1/60);assert.ok(f.poses.get(c.id).p.y>c.p[1]-.01,'server uptime must not teleport the pending bay to the ground');fine.reset();
});
test('unloading, resetting and an attachment refresh cancel stale collapse preparation',()=>{
 const f=fixture(),c=f.cells[2],fine=f.fine;queue(f,c);fine.prepareCollapses(0);
 f.resources.attachments.set(c.id,[{batch:new T.Mesh(new T.BoxGeometry(.2,.3,.4),new T.MeshBasicMaterial()),local:new T.Matrix4()}]);fine.refreshSource(c,f.resources);fine.prepareCollapses(Infinity);assert.ok(fine.shards.size);assert.ok(fine.source(c,f.resources).materials.size>1);
 fine.reset();queue(f,c);for(let i=0;i<3;i++)fine.prepareCollapses(0);fine.unregister([c]);fine.prepareCollapses(Infinity);assert.equal(fine.collapses.size,0);assert.equal(fine.shards.size,0);assert.equal(fine.pendingShards.size,0);assert.equal(fine.sources.size,0);assert.equal(fine.templates.size,0);
 queue(f,c);fine.prepareCollapses(0);fine.reset();assert.equal(fine.pendingShards.size,0);assert.equal(fine.root.children.length,0);
});
test('opaque rubble buffers stay in bounded pages, reuse fragments and retain glass sorting',()=>{
 const fine=new FineBuildings(new T.Group(),{}),opaque=new T.MeshBasicMaterial(),glass=new T.MeshBasicMaterial({transparent:true}),draws=[],geometry=n=>new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(n*3),3)).setIndex(Array.from({length:n},(_,i)=>i));
 for(let i=0;i<20;i++)draws.push(fine.add({key:'wall',geometry:geometry(9000),material:opaque}));
 assert.ok(fine.poolGroups.get('wall').length>=3);assert.ok([...fine.pools.values()].every(p=>p.vertices<=FRACTURE_PAGE_VERTICES));
 const first=draws[0],shared=fine.add({key:'wall',geometry:first.shared.source,material:opaque});assert.equal(shared.shared,first.shared);for(const draw of draws)fine.remove(draw);assert.ok(shared.pool.mesh.getVisibleAt(shared.index));
 for(let i=0;i<2;i++)fine.add({key:'glass',geometry:geometry(40000),material:glass});assert.equal(fine.poolGroups.get('glass').length,1,'transparent fragments retain a single depth-sorted batch');fine.reset();assert.equal(fine.root.children.length,0);
});
test('cached fragments reference shared buffer storage through growth and compaction and regenerate after release',()=>{
 const f=fixture(),c=f.cells[2],source=f.fine.source(c,f.resources),skin=initialSkin(c),ids=[0,1,2],draw=cutAppearance(source,ids,skin,false)[0],geometry=draw.geometry,expected=Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>[key,Array.from(a.array)])),indices=Array.from(geometry.index.array),first=f.fine.add({...draw}),copies=[];
 const count=Math.ceil(10000/geometry.attributes.position.count);
 for(let i=0;i<count;i++)copies.push(f.fine.add({...draw,geometry:geometry.clone()}));
 for(let i=0;i<copies.length;i+=2)f.fine.remove(copies[i]);
 for(let i=0;i<count;i++)f.fine.add({...draw,geometry:geometry.clone()});
 for(const [key,a]of Object.entries(geometry.attributes)){assert.deepEqual(Array.from(a.array),expected[key]);assert.equal(a.array.buffer,first.pool.mesh.geometry.attributes[key].array.buffer);}
 assert.deepEqual(Array.from(geometry.index.array),indices);f.fine.remove(first);assert.equal(cachedFragments(source,ids,skin),undefined);const replacement=cutAppearance(source,ids,skin,false)[0];assert.notEqual(replacement.geometry,geometry);for(const [key,a]of Object.entries(replacement.geometry.attributes))assert.deepEqual(Array.from(a.array),expected[key]);f.fine.reset();
});
test('worker requests wait for module readiness and failures permit the budgeted fallback',()=>{
 class WorkerStub{constructor(){WorkerStub.last=this;this.sent=[];}postMessage(data){this.sent.push(data);}terminate(){this.terminated=true;}}
 const previous=globalThis.Worker;globalThis.Worker=WorkerStub;
 try{
  const f=fixture(),c=f.cells[2],source=f.fine.source(c,f.resources),worker=new FracturePreparation(),stub=WorkerStub.last,request=worker.request(source,[[0]],initialSkin(c));
  assert.equal(stub.sent.length,0,'top-level module loading must not lose the first message');stub.onmessage({data:{ready:true}});assert.equal(stub.sent.length,1);assert.equal(stub.sent[0].id,request.id);
  stub.onmessage({data:{id:request.id,error:'worker unavailable'}});assert.equal(request.done,true);assert.equal(request.failed,true);assert.equal(worker.worker,null);assert.ok(stub.terminated);
  stub.onmessage({data:{id:request.id,results:[]}});assert.equal(worker.busy,null);worker.dispose();f.fine.reset();
 }finally{if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;}
});
test('unloading a district waits for shader compilation before releasing its program',async()=>{
 let finish;const warmup=new RenderWarmup({compileAsync:()=>new Promise(resolve=>{finish=resolve;})},{scene:new T.Scene()});warmup.camera=new T.PerspectiveCamera();warmup.queue.push(new T.MeshBasicMaterial());
 const pending=warmup.prepare(),mesh=warmup.retained[0];let disposed=0;mesh.material.addEventListener('dispose',()=>disposed++);warmup.dispose();assert.equal(disposed,0);finish();await pending;assert.equal(disposed,1);
});
