import * as T from 'three';
import {shardBallistic} from '../../shared/city/fracture.js';
import {appearanceSources,cutAppearance} from '../render/fracture-geometry.js';
const matrix=new T.Matrix4(),offset=new T.Matrix4(),one=new T.Vector3(1,1,1),eye=new T.Vector3();
// Material batches contain actual clipped building triangles, for both the
// standing remainder and loose pieces. No replacement palette or proxy meshes.
export class FineBuildings{
 constructor(root,tier){this.root=root;this.tier=tier;this.cells=new Map();this.shards=new Map();this.sources=new Map();this.active=new Set();this.batches=new Map();this.pools=new Map();this.time=0;this.nextSelect=0;}
 source(c,resources){let s=this.sources.get(c.id);if(!s){s=appearanceSources(c,resources);this.sources.set(c.id,s);}return s;}
 add(draw){
  let pool=this.pools.get(draw.key);const n=draw.geometry.attributes.position.count;
  if(!pool){const mat=draw.material.clone();mat.vertexColors=true;const mesh=new T.BatchedMesh(64,Math.max(4096,2**Math.ceil(Math.log2(n))),0,mat);mesh.frustumCulled=false;mesh.perObjectFrustumCulled=false;mesh.sortObjects=mat.transparent;mesh.castShadow=!!draw.castShadow;mesh.receiveShadow=true;this.root.add(mesh);pool={mesh,capacity:64,vertices:mesh.geometry.attributes.position?.count||Math.max(4096,2**Math.ceil(Math.log2(n))),allocated:0,live:0,count:0};this.pools.set(draw.key,pool);this.batches.set(draw.key,mesh);}
  if(pool.allocated+n>pool.vertices){pool.mesh.optimize();pool.allocated=pool.live;if(pool.allocated+n>pool.vertices){pool.vertices=2**Math.ceil(Math.log2(pool.allocated+n));pool.mesh.setGeometrySize(pool.vertices,0);}}
  if(pool.count>=pool.capacity){pool.capacity*=2;pool.mesh.setInstanceCount(pool.capacity);}draw.geometryId=pool.mesh.addGeometry(draw.geometry);draw.index=pool.mesh.addInstance(draw.geometryId);draw.pool=pool;draw.vertices=n;pool.live+=n;pool.allocated+=n;pool.count++;draw.geometry.dispose();delete draw.geometry;return draw;
 }
 remove(draw){const p=draw.pool;if(!p)return;p.mesh.deleteInstance(draw.index);p.mesh.deleteGeometry(draw.geometryId);p.live-=draw.vertices;p.count--;draw.pool=null;}
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
 select(camera){
  const view=camera.cameras?.[0]||camera;eye.setFromMatrixPosition(view.matrixWorld);
  for(const e of this.cells.values()){const visible=!e.pose.hidden&&e.pose.inView!==false&&e.pose.p.distanceToSquared(eye)<230**2;for(const d of e.parts)d.pool.mesh.setVisibleAt(d.index,visible);}
  for(const e of this.shards.values()){const visible=e.p.distanceToSquared(eye)<170**2;for(const d of e.parts)d.pool.mesh.setVisibleAt(d.index,visible);}
 }
 update(dt){this.time+=dt;for(const e of this.active){const pose=shardBallistic(e.meta,this.time);e.p.fromArray(pose.p);e.q.fromArray(pose.q);this.write(e);}this.commit();}
 commit(){for(const p of this.pools.values())p.mesh.visible=p.count>0;}
 unregister(cells){const ids=new Set(cells.map(c=>c.id));for(const id of ids){const e=this.cells.get(id);if(e){for(const d of e.parts)this.remove(d);delete e.pose.fine;this.cells.delete(id);}this.sources.delete(id);}for(const [id,e]of this.shards)if(ids.has(e.c.id)){for(const d of e.parts)this.remove(d);this.active.delete(e);this.shards.delete(id);}}
 reset(){for(const e of this.cells.values())delete e.pose.fine;for(const p of this.pools.values()){p.mesh.removeFromParent();p.mesh.dispose();p.mesh.material.dispose();}this.cells.clear();this.sources.clear();this.shards.clear();this.active.clear();this.batches.clear();this.pools.clear();this.time=0;}
}
