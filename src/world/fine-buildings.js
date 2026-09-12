import * as T from 'three';
import {shardBallistic} from '../../shared/city/fracture.js';
import {appearanceDescription,appearanceSources,appearanceSourceSteps,cutAppearance,cachedFragments,releaseAppearanceWork} from '../render/fracture-geometry.js';
import {FracturePreparation} from './fracture-preparation.js';
import {CellIndex} from '../render/cell-index.js';
import {fractureMaterial} from '../render/fracture-material.js';
import {SpatialBatch} from '../render/spatial-batch.js';
const matrix=new T.Matrix4(),offset=new T.Matrix4(),one=new T.Vector3(1,1,1),eye=new T.Vector3();
const makeBatch=(material,capacity,vertices,indices,castShadow)=>{const mesh=new SpatialBatch(capacity,vertices,indices,material);mesh.frustumCulled=false;mesh.perObjectFrustumCulled=true;mesh.sortObjects=material.transparent;mesh.castShadow=castShadow;mesh.receiveShadow=true;return mesh;};
const capacityFor=n=>2**Math.ceil(Math.log2(Math.max(1,n)));
export const FRACTURE_PAGE_VERTICES=65536;
const bindings=new WeakMap();
function bindGeometry(shared,pool){
 const geometry=shared.source;if(!geometry.userData.fractureOwned)return;
 let owners=bindings.get(geometry);if(!owners)bindings.set(geometry,owners=new Set());owners.add(pool);
 const range=pool.mesh.getGeometryRangeAt(shared.id);
 for(const [name,a]of Object.entries(pool.mesh.geometry.attributes))geometry.setAttribute(name,new T.BufferAttribute(a.array.subarray(range.vertexStart*a.itemSize,(range.vertexStart+shared.vertices)*a.itemSize),a.itemSize));
}
function unbindGeometry(shared,pool){
 const geometry=shared.source,owners=bindings.get(geometry);if(!owners)return;owners.delete(pool);
 if(owners.size){const other=owners.values().next().value;bindGeometry(other.geometries.get(geometry),other);return;}
 bindings.delete(geometry);geometry.userData.fractureReleased=true;
 for(const name of Object.keys(geometry.attributes))geometry.deleteAttribute(name);geometry.setIndex(null);
}
// Material batches contain actual clipped building triangles, for both the
// standing remainder and loose pieces. No replacement palette or proxy meshes.
export class FineBuildings{
 constructor(root,tier){this.root=root;this.tier=tier;this.cells=new Map();this.shards=new Map();this.sources=new Map();this.templates=new Map();this.sourceKeys=new Map();this.collapses=new Map();this.pendingShards=new Map();this.active=new Set();this.batches=new Map();this.pools=new Map();this.poolGroups=new Map();this.nextPool=0;this.geometryPools=new WeakMap();this.time=0;this.nextSelect=0;this.cellIndex=new CellIndex();this.shardIndex=new CellIndex();this.visibleCells=new Set();this.visibleShards=new Set();this.candidates=new Set();this.preparationStats={frames:0,maxMS:0};}
 source(c,resources){let s=this.sources.get(c.id);if(!s){const description=appearanceDescription(c,resources);let shared=this.templates.get(description.key);if(!shared){shared={source:appearanceSources(c,resources,description),refs:0};this.templates.set(description.key,shared);}shared.refs++;s=shared.source;this.sourceKeys.set(c.id,description.key);this.sources.set(c.id,s);}if(!s.records)s.records=appearanceSources(c,resources).records;return s;}
 releaseSource(id){const key=this.sourceKeys.get(id),shared=this.templates.get(key);if(shared&&!--shared.refs)this.templates.delete(key);this.sourceKeys.delete(id);this.sources.delete(id);}
 *prepareSource(c,resources){
  if(this.sources.has(c.id))return this.sources.get(c.id);
  const description=appearanceDescription(c,resources);let shared=this.templates.get(description.key);
  if(!shared){const source=yield* appearanceSourceSteps(description);shared=this.templates.get(description.key);if(!shared){shared={source,refs:0};this.templates.set(description.key,shared);}}
  // A direct hit or an asset refresh can prepare the same cell between yields.
  if(this.sources.has(c.id))return this.sources.get(c.id);
  shared.refs++;this.sources.set(c.id,shared.source);this.sourceKeys.set(c.id,description.key);return shared.source;
 }
 queueCollapse(c,skin,pose,resources){
  let job=this.collapses.get(c.id);if(!job){job={c,pose,resources,skin:{...skin},metas:new Map(),pieces:[],hidden:true,born:null,p:new T.Vector3(...c.p)};this.collapses.set(c.id,job);job.steps=this.prepareCollapse(job);}else job.skin={...skin};
 }
 deferHide(id){const job=this.collapses.get(id);if(!job)return false;job.hidden=true;return true;}
 *prepareCollapse(job){
  const preparation=this.preparation??=new FracturePreparation();
  while(preparation.busy){job.waiting=true;yield;}job.waiting=false;
  const source=yield* this.prepareSource(job.c,job.resources),missing=[...job.metas.values()].filter(meta=>!cachedFragments(source,meta.pieces,job.skin)),prepared=new Map();
  if(missing.length&&!source.records)source.records=(yield* appearanceSourceSteps(appearanceDescription(job.c,job.resources))).records;
  if(missing.length&&preparation.worker){
   const request=preparation.request(source,missing.map(meta=>meta.pieces),job.skin);
   if(request){while(!request.done){job.waiting=true;yield;}job.waiting=false;if(request.results)for(let i=0;i<missing.length;i++){prepared.set(missing[i].id,preparation.materialize(request,i));yield;}}
  }
  for(const meta of job.metas.values()){
   this.pendingShards.delete(meta.id);this.addShards(job.c,meta,job.resources,true,prepared.get(meta.id));const e=this.shards.get(meta.id);e.pending=true;job.pieces.push(e);yield;
  }
  this.set(job.c,job.skin,job.pose,job.resources,true);
  if(job.hidden)job.resources.setCell(job.c.id,null,null,true);
  for(const e of job.pieces)e.pending=false;
  releaseAppearanceWork(source);
  this.collapses.delete(job.c.id);
 }
 prepareCollapses(budget=this.tier.name==='QUEST'?2:3){
  if(!this.collapses.size)return;this.preparation?.poll();const start=performance.now(),deadline=start+budget;
  work:for(const job of this.collapses.values()){
   if(!job.hidden)continue;
   do{if(job.steps.next().done)break;if(job.waiting)break work;}while(performance.now()<deadline);
   if(performance.now()>=deadline)break;
  }
  const stats=this.preparationStats;stats.frames++;stats.maxMS=Math.max(stats.maxMS,performance.now()-start);
 }
 add(draw,visible=true){
  const n=draw.geometry.attributes.position.count,ni=draw.geometry.index?.count||0,limit=draw.material.transparent?Infinity:Math.max(FRACTURE_PAGE_VERTICES,n);
  let pages=this.poolGroups.get(draw.key);if(!pages)this.poolGroups.set(draw.key,pages=[]);
  let pool=this.geometryPools.get(draw.geometry);if(pool?.materialKey!==draw.key)pool=null;
  pool??=pages.find(p=>p.geometries.has(draw.geometry))||pages.find(p=>p.live+n<=limit);
  // Opaque storage grows in small pages, so adding a floor never copies and
  // uploads an entire tower's buffers. Glass keeps one globally sorted batch.
  if(!pool){const mat=fractureMaterial(draw.material);
   const key=pages.length?`${draw.key}:page${++this.nextPool}`:draw.key,vertices=Math.max(4096,capacityFor(n)),indices=ni?Math.max(4096,capacityFor(ni)):0,mesh=makeBatch(mat,64,vertices,indices,!!draw.castShadow);this.root.add(mesh);pool={key,materialKey:draw.key,mesh,capacity:64,vertices,indices,allocated:0,allocatedIndices:0,live:0,count:0,geometries:new Map()};pages.push(pool);this.pools.set(key,pool);this.batches.set(key,mesh);}
  this.geometryPools.set(draw.geometry,pool);
  let shared=pool.geometries.get(draw.geometry);
  if(!shared){if(pool.allocated+n>pool.vertices||pool.allocatedIndices+ni>pool.indices){
    // Three's optimize() leaves its allocation cursor unchanged when every
    // geometry was deleted. Recycle that empty batch through the public API.
    if(pool.live===0){const old=pool.mesh;pool.vertices=Math.max(pool.vertices,capacityFor(n));pool.indices=Math.max(pool.indices,ni?capacityFor(ni):0);pool.mesh=makeBatch(old.material,pool.capacity,pool.vertices,pool.indices,old.castShadow);old.removeFromParent();old.dispose();this.root.add(pool.mesh);this.batches.set(pool.key,pool.mesh);}
    else if(pool.live<pool.allocated)pool.mesh.optimize();
    pool.allocated=pool.vertices-pool.mesh.unusedVertexCount;pool.allocatedIndices=pool.indices-pool.mesh.unusedIndexCount;
    if(pool.allocated+n>pool.vertices||pool.allocatedIndices+ni>pool.indices){pool.vertices=Math.max(pool.vertices,capacityFor(pool.allocated+n));pool.indices=Math.max(pool.indices,ni?capacityFor(pool.allocatedIndices+ni):0);pool.mesh.setGeometrySize(pool.vertices,pool.indices);}
    for(const geometry of pool.geometries.values())bindGeometry(geometry,pool);}
   shared={id:pool.mesh.addGeometry(draw.geometry),refs:0,vertices:n,source:draw.geometry};pool.geometries.set(draw.geometry,shared);pool.live+=n;pool.allocated+=n;pool.allocatedIndices+=ni;bindGeometry(shared,pool);}
  if(pool.count>=pool.capacity){pool.capacity*=2;pool.mesh.setInstanceCount(pool.capacity);}draw.geometryId=shared.id;draw.index=pool.mesh.addInstance(shared.id);pool.mesh.setVisibleAt(draw.index,visible);draw.visible=visible;draw.pool=pool;draw.shared=shared;shared.refs++;pool.count++;draw.geometry.dispose();delete draw.geometry;return draw;
 }
 remove(draw){const p=draw.pool;if(!p)return;p.mesh.deleteInstance(draw.index);if(--draw.shared.refs===0){unbindGeometry(draw.shared,p);p.mesh.deleteGeometry(draw.geometryId);p.live-=draw.shared.vertices;p.geometries.delete(draw.shared.source);this.geometryPools.delete(draw.shared.source);}p.count--;draw.pool=null;}
 set(c,skin,pose,resources,empty=false){
  let e=this.cells.get(c.id);if(!e){e={c,pose,parts:[],skin};this.cells.set(c.id,e);}e.skin={...skin};
  const previous=new Map(e.parts.map(d=>[d.section,d]));
  pose.fine={update:()=>this.write(e)};e.parts=(empty?[]:cutAppearance(this.source(c,resources),skin.parts||[],skin,true)).map(d=>{
   const old=previous.get(d.section);previous.delete(d.section);
   if(old?.shared.source===d.geometry)return old;
   if(old)this.remove(old);return this.add(d,false);
  });for(const d of previous.values())this.remove(d);this.write(e);this.nextSelect=0;
 }
 addShards(c,meta,resources,prepared=false,draws=null){
  const job=this.collapses.get(c.id);
  if(!prepared&&job&&!this.shards.has(meta.id)){job.metas.set(meta.id,meta);this.pendingShards.set(meta.id,job);job.born=job.born==null?(meta.born??this.time):Math.min(job.born,meta.born??job.born);this.time=Math.max(this.time,meta.born||0);return;}
  let e=this.shards.get(meta.id);if(!e){const skin=job?.skin||this.cells.get(c.id)?.skin||{glass:15,facade:15},source=this.sources.get(c.id);draws??=source&&cachedFragments(source,meta.pieces,skin);draws??=cutAppearance(this.source(c,resources),meta.pieces,skin,false);e={c,parts:draws.map(d=>this.add({...d},false)),p:new T.Vector3(),q:new T.Quaternion(),offset:new T.Vector3(...meta.origin).sub(new T.Vector3(...c.p))};this.shards.set(meta.id,e);}
  e.meta=meta;e.settled=meta.settled;e.ballistic=meta.ballistic;e.p.fromArray(meta.p);e.q.fromArray(meta.q);this.time=Math.max(this.time,meta.born||0);if(e.ballistic&&!e.settled)this.active.add(e);else this.active.delete(e);for(const d of e.parts)d.pool.mesh.setInstanceMoving(d.index,!e.settled);this.write(e);this.nextSelect=0;
 }
 refreshSource(c,resources){
  const job=this.collapses.get(c.id);if(job){
   job.steps.return();for(const e of job.pieces){job.metas.set(e.meta.id,{...e.meta,p:e.p.toArray(),q:e.q.toArray()});for(const d of e.parts)this.remove(d);this.shards.delete(e.meta.id);this.shardIndex.delete(e);this.visibleShards.delete(e);this.active.delete(e);}
   for(const id of job.metas.keys())this.pendingShards.set(id,job);job.pieces=[];job.waiting=false;job.resources=resources;this.releaseSource(c.id);job.steps=this.prepareCollapse(job);return;
  }
  if(!this.sources.has(c.id))return;this.releaseSource(c.id);const standing=this.cells.get(c.id);if(standing)this.set(c,standing.skin,standing.pose,resources);
  for(const [id,e]of [...this.shards])if(e.c.id===c.id){const meta={...e.meta,p:e.p.toArray(),q:e.q.toArray()};for(const d of e.parts)this.remove(d);this.shards.delete(id);this.shardIndex.delete(e);this.visibleShards.delete(e);this.active.delete(e);this.addShards(c,meta,resources);}
 }
 poseShard(id,position,rotation){const e=this.shards.get(id);if(!e){const meta=this.pendingShards.get(id)?.metas.get(id);if(!meta)return false;if(!meta.settled){meta.p=[...position];meta.q=[...rotation];}return true;}if(e.settled)return true;e.p.fromArray(position);e.q.fromArray(rotation);this.write(e);return true;}
 write(e){const pose=e.pose||e;(e.pose?this.cellIndex:this.shardIndex).set(e,pose.p.x,pose.p.z);matrix.compose(pose.p,pose.q,one);if(e.offset)matrix.multiply(offset.makeTranslation(-e.offset.x,-e.offset.y,-e.offset.z));for(const d of e.parts)d.pool.mesh.setMatrixAt(d.index,matrix);}
 select(camera,far=0){
  const view=camera.cameras?.[0]||camera;eye.setFromMatrixPosition(view.matrixWorld);
  const visibleRange=Number.isFinite(far)?far+12:0;
  this.selectIndex(this.cellIndex,this.visibleCells,Math.max(230,visibleRange));this.selectIndex(this.shardIndex,this.visibleShards,Math.max(170,visibleRange));
 }
 selectIndex(index,visible,radius){
  this.candidates.clear();for(const e of visible)this.candidates.add(e);index.addNear(this.candidates,eye.x,eye.z,radius);
  for(const e of this.candidates){const pose=e.pose||e,show=!e.pending&&!pose.hidden&&pose.p.distanceToSquared(eye)<radius*radius;
   for(const d of e.parts)if(d.visible!==show){d.pool.mesh.setVisibleAt(d.index,show);d.visible=show;}
   if(show)visible.add(e);else visible.delete(e);
  }
 }
 update(dt){this.time+=dt;this.prepareCollapses();for(const job of this.collapses.values())if(job.hidden&&!job.pose.hidden){const t=Math.max(0,this.time-(job.born??this.time));job.p.y=Math.max(job.c.size[1]/2,job.c.p[1]-12*t*t);job.resources.setCell(job.c.id,job.p,null,false);}for(const e of this.active){const pose=shardBallistic(e.meta,this.time);e.p.fromArray(pose.p);e.q.fromArray(pose.q);this.write(e);}this.commit();}
 commit(){for(const p of this.pools.values())p.mesh.visible=p.count>0;}
 trimPools(){for(const [key,pages]of this.poolGroups){const live=[];for(const p of pages)if(p.count)live.push(p);else{p.mesh.removeFromParent();p.mesh.dispose();p.mesh.material.dispose();this.pools.delete(p.key);this.batches.delete(p.key);}if(live.length)this.poolGroups.set(key,live);else this.poolGroups.delete(key);}}
 cancelCollapse(id){const job=this.collapses.get(id);if(!job)return;job.steps.return();for(const sid of job.metas.keys())this.pendingShards.delete(sid);this.collapses.delete(id);}
 unregister(cells){const ids=new Set(cells.map(c=>c.id));for(const id of ids){this.cancelCollapse(id);const e=this.cells.get(id);if(e){for(const d of e.parts)this.remove(d);delete e.pose.fine;this.cellIndex.delete(e);this.visibleCells.delete(e);this.cells.delete(id);}this.releaseSource(id);}for(const [id,e]of this.shards)if(ids.has(e.c.id)){for(const d of e.parts)this.remove(d);this.active.delete(e);this.shardIndex.delete(e);this.visibleShards.delete(e);this.shards.delete(id);}this.trimPools();if(!this.collapses.size){this.preparation?.dispose();this.preparation=null;}}
 reset(){this.preparation?.dispose();this.preparation=null;for(const id of this.collapses.keys())this.cancelCollapse(id);for(const e of this.cells.values())delete e.pose.fine;for(const p of this.pools.values()){for(const shared of p.geometries.values())unbindGeometry(shared,p);p.mesh.removeFromParent();p.mesh.dispose();p.mesh.material.dispose();}this.cells.clear();this.sources.clear();this.sourceKeys.clear();this.templates.clear();this.shards.clear();this.active.clear();this.batches.clear();this.pools.clear();this.poolGroups.clear();this.geometryPools=new WeakMap();this.cellIndex=new CellIndex();this.shardIndex=new CellIndex();this.visibleCells.clear();this.visibleShards.clear();this.candidates.clear();this.time=0;}
}
