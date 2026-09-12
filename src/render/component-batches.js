import * as T from 'three';

const capacity=n=>2**Math.ceil(Math.log2(Math.max(64,n)));
// Exact component geometry, grouped by material and a small district. Keep the
// existing instanced renderer available on browsers without WEBGL_multi_draw.
export class ComponentBatches{
 constructor(root){this.root=root;this.pools=new Map();this.empty=new Map();}
 pool(part,source){
  const key=`${source.material.uuid}:${Math.floor(part.cell.p[0]/210)}:${Math.floor(part.cell.p[2]/210)}`;
  let pool=this.pools.get(key);
  if(!pool){const vertices=capacity(Math.max(4096,source.geometry.attributes.position.count)),mesh=new T.BatchedMesh(64,vertices,0,source.material);
   mesh.frustumCulled=false;mesh.perObjectFrustumCulled=true;mesh.sortObjects=source.material.transparent;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.component=true;
   this.root.add(mesh);pool={key,mesh,vertices,capacity:64,count:0,used:0,geometries:new Map()};this.pools.set(key,pool);
  }
  this.empty.delete(key);return pool;
 }
 write(part,source,matrix){
  if(!part.materialSlot){
   const pool=this.pool(part,source),g=source.geometry;let geometryId=pool.geometries.get(g);
   if(geometryId===undefined){const n=g.attributes.position.count;if(pool.used+n>pool.vertices){pool.vertices=capacity(pool.used+n);pool.mesh.setGeometrySize(pool.vertices,0);}geometryId=pool.mesh.addGeometry(g);pool.geometries.set(g,geometryId);pool.used+=n;}
   if(pool.count>=pool.capacity){pool.capacity*=2;pool.mesh.setInstanceCount(pool.capacity);}
   part.materialSlot={pool,index:pool.mesh.addInstance(geometryId)};pool.count++;pool.mesh.visible=true;
  }
  const {pool,index}=part.materialSlot;pool.mesh.setMatrixAt(index,matrix);
 }
 remove(part){
  const slot=part.materialSlot;if(!slot)return;const {pool,index}=slot;pool.mesh.deleteInstance(index);part.materialSlot=null;
  if(--pool.count===0){pool.mesh.visible=false;this.empty.set(pool.key,pool);}
 }
 trim(){
  let vertices=0;for(const pool of this.empty.values())vertices+=pool.vertices;
  for(const [key,pool]of this.empty){if(this.empty.size<=32&&vertices<=250000)break;vertices-=pool.vertices;pool.mesh.removeFromParent();pool.mesh.dispose();this.pools.delete(key);this.empty.delete(key);}
 }
 dispose(){for(const pool of this.pools.values()){pool.mesh.removeFromParent();pool.mesh.dispose();}this.pools.clear();this.empty.clear();}
}
