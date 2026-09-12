import * as T from 'three';
import {shardBallistic} from '../../shared/city/fracture.js';
import {appearanceSources,cutAppearance} from '../render/fracture-geometry.js';
const matrix=new T.Matrix4(),offset=new T.Matrix4(),one=new T.Vector3(1,1,1),eye=new T.Vector3();
const makeBatch=(material,capacity,vertices,castShadow)=>{const mesh=new T.BatchedMesh(capacity,vertices,0,material);mesh.frustumCulled=false;mesh.perObjectFrustumCulled=true;mesh.sortObjects=material.transparent;mesh.castShadow=castShadow;mesh.receiveShadow=true;return mesh;};
// Material batches contain actual clipped building triangles, for both the
// standing remainder and loose pieces. No replacement palette or proxy meshes.
export class FineBuildings{
 constructor(root,tier){this.root=root;this.tier=tier;this.cells=new Map();this.shards=new Map();this.sources=new Map();this.active=new Set();this.batches=new Map();this.pools=new Map();this.time=0;this.nextSelect=0;}
 source(c,resources){let s=this.sources.get(c.id);if(!s){s=appearanceSources(c,resources);this.sources.set(c.id,s);}return s;}
 add(draw){
  let pool=this.pools.get(draw.key);const n=draw.geometry.attributes.position.count;
  if(!pool){const mat=draw.material.clone();mat.vertexColors=true;mat.side=T.DoubleSide;mat.forceSinglePass=true;
   // Exposed reverse faces retain the base texture/color rather than reflecting
   // the bright sky like the polished outer skin of a metal/glass facade.
   mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nif (!gl_FrontFacing) { metalnessFactor = 0.0; roughnessFactor = max(roughnessFactor, 0.8); }');};mat.customProgramCacheKey=()=> 'fracture-interior-v1';
   const vertices=Math.max(4096,2**Math.ceil(Math.log2(n))),mesh=makeBatch(mat,64,vertices,!!draw.castShadow);this.root.add(mesh);pool={mesh,capacity:64,vertices,allocated:0,live:0,count:0,geometries:new Map()};this.pools.set(draw.key,pool);this.batches.set(draw.key,mesh);}
  let shared=pool.geometries.get(draw.geometry);
  if(!shared){if(pool.allocated+n>pool.vertices){
    // Three's optimize() leaves its allocation cursor unchanged when every
    // geometry was deleted. Recycle that empty batch through the public API.
    if(pool.live===0){const old=pool.mesh;pool.vertices=Math.max(pool.vertices,2**Math.ceil(Math.log2(n)));pool.mesh=makeBatch(old.material,pool.capacity,pool.vertices,old.castShadow);old.removeFromParent();old.dispose();this.root.add(pool.mesh);this.batches.set(draw.key,pool.mesh);}
    else pool.mesh.optimize();
    pool.allocated=pool.vertices-pool.mesh.unusedVertexCount;if(pool.allocated+n>pool.vertices){pool.vertices=2**Math.ceil(Math.log2(pool.allocated+n));pool.mesh.setGeometrySize(pool.vertices,0);}}
   shared={id:pool.mesh.addGeometry(draw.geometry),refs:0,vertices:n,source:draw.geometry};pool.geometries.set(draw.geometry,shared);pool.live+=n;pool.allocated+=n;}
  if(pool.count>=pool.capacity){pool.capacity*=2;pool.mesh.setInstanceCount(pool.capacity);}draw.geometryId=shared.id;draw.index=pool.mesh.addInstance(shared.id);draw.pool=pool;draw.shared=shared;shared.refs++;pool.count++;draw.geometry.dispose();delete draw.geometry;return draw;
 }
 remove(draw){const p=draw.pool;if(!p)return;p.mesh.deleteInstance(draw.index);if(--draw.shared.refs===0){p.mesh.deleteGeometry(draw.geometryId);p.live-=draw.shared.vertices;p.geometries.delete(draw.shared.source);}p.count--;draw.pool=null;}
 set(c,skin,pose,resources){
  let e=this.cells.get(c.id);if(!e){e={c,pose,parts:[],skin};this.cells.set(c.id,e);}for(const d of e.parts)this.remove(d);e.skin={...skin};
  pose.fine={};e.parts=cutAppearance(this.source(c,resources),skin.parts||[],skin,true).map(d=>this.add(d));this.write(e);this.nextSelect=0;
 }
 addShards(c,meta,resources){
  let e=this.shards.get(meta.id);if(!e){const source=this.source(c,resources),skin=this.cells.get(c.id)?.skin||{glass:15,facade:15};e={c,parts:cutAppearance(source,meta.pieces,skin,false).map(d=>this.add(d)),p:new T.Vector3(),q:new T.Quaternion(),offset:new T.Vector3(...meta.origin).sub(new T.Vector3(...c.p))};this.shards.set(meta.id,e);}
  e.meta=meta;e.settled=meta.settled;e.ballistic=meta.ballistic;e.p.fromArray(meta.p);e.q.fromArray(meta.q);this.time=Math.max(this.time,meta.born||0);if(e.ballistic&&!e.settled)this.active.add(e);else this.active.delete(e);this.write(e);this.nextSelect=0;
 }
 refreshSource(c,resources){
  if(!this.sources.has(c.id))return;this.sources.delete(c.id);const standing=this.cells.get(c.id);if(standing)this.set(c,standing.skin,standing.pose,resources);
  for(const [id,e]of [...this.shards])if(e.c.id===c.id){const meta={...e.meta,p:e.p.toArray(),q:e.q.toArray()};for(const d of e.parts)this.remove(d);this.shards.delete(id);this.active.delete(e);this.addShards(c,meta,resources);}
 }
 poseShard(id,position,rotation){const e=this.shards.get(id);if(!e)return false;if(e.settled)return true;e.p.fromArray(position);e.q.fromArray(rotation);this.write(e);return true;}
 write(e){const pose=e.pose||e;matrix.compose(pose.p,pose.q,one);if(e.offset)matrix.multiply(offset.makeTranslation(-e.offset.x,-e.offset.y,-e.offset.z));for(const d of e.parts)d.pool.mesh.setMatrixAt(d.index,matrix);}
 select(camera,far=0){
  const view=camera.cameras?.[0]||camera;eye.setFromMatrixPosition(view.matrixWorld);
  const visibleRange=Number.isFinite(far)?far+12:0;
  for(const e of this.cells.values()){const visible=!e.pose.hidden&&e.pose.p.distanceToSquared(eye)<Math.max(230,visibleRange)**2;for(const d of e.parts)d.pool.mesh.setVisibleAt(d.index,visible);}
  for(const e of this.shards.values()){const visible=e.p.distanceToSquared(eye)<Math.max(170,visibleRange)**2;for(const d of e.parts)d.pool.mesh.setVisibleAt(d.index,visible);}
 }
 update(dt){this.time+=dt;for(const e of this.active){const pose=shardBallistic(e.meta,this.time);e.p.fromArray(pose.p);e.q.fromArray(pose.q);this.write(e);}this.commit();}
 commit(){for(const p of this.pools.values())p.mesh.visible=p.count>0;}
 unregister(cells){const ids=new Set(cells.map(c=>c.id));for(const id of ids){const e=this.cells.get(id);if(e){for(const d of e.parts)this.remove(d);delete e.pose.fine;this.cells.delete(id);}this.sources.delete(id);}for(const [id,e]of this.shards)if(ids.has(e.c.id)){for(const d of e.parts)this.remove(d);this.active.delete(e);this.shards.delete(id);}}
 reset(){for(const e of this.cells.values())delete e.pose.fine;for(const p of this.pools.values()){p.mesh.removeFromParent();p.mesh.dispose();p.mesh.material.dispose();}this.cells.clear();this.sources.clear();this.shards.clear();this.active.clear();this.batches.clear();this.pools.clear();this.time=0;}
}
