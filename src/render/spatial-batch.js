import * as T from 'three';

const matrix=new T.Matrix4(),inverse=new T.Matrix4(),position=new T.Vector3(),forward=new T.Vector3();
const textureWrites=new WeakMap();
function markMatrix(texture,index){
 let writes=textureWrites.get(texture);
 if(!writes){writes=new Set();textureWrites.set(texture,writes);const uploaded=texture.onUpdate;texture.onUpdate=function(){writes.clear();texture.clearUpdateRanges();uploaded?.call(this,texture);};}
 writes.add(Math.floor(index*16/(texture.image.width*4)));
}
function flushMatrices(texture){
 const rows=textureWrites.get(texture);if(!rows?.size)return;texture.clearUpdateRanges();
 // Many moving instances already justify one contiguous upload. Sparse writes
 // use whole texture rows to keep driver calls bounded and retain pending data.
 if(rows.size<texture.image.height/3)for(const row of rows)texture.addUpdateRange(row*texture.image.width*4,texture.image.width*4);
}

// Adapter for the pinned Three r180 BatchedMesh draw buffers. Geometry remains
// shared between moving and resting fragments. Static spatial groups and cached
// bounds avoid rebuilding matrices/frusta per object, including both XR eyes.
export class SpatialBatch extends T.BatchedMesh{
 constructor(...args){super(...args);this.entries=new Map();this.groups=new Map();this.moving=new Set();this.byGeometry=new Map();this.spatialVersion=0;this.viewKey=new Float64Array(192);this.viewLength=0;this.frusta=[];this.drawList=[];this.selectionStats={groups:0,instances:0,reused:0};}
 changed(){this.spatialVersion++;}
 ungroup(e){if(e.group){const group=e.group;group.entries.delete(e);group.dirty=true;if(!group.entries.size)this.groups.delete(group.key);e.group=null;}this.moving.delete(e);}
 place(e){
  if(e.moving){this.moving.add(e);return;}
  const p=e.sphere.center,key=`${Math.floor(p.x/16)},${Math.floor(p.y/16)},${Math.floor(p.z/16)}`;
  if(e.group?.key!==key){this.ungroup(e);let group=this.groups.get(key);if(!group)this.groups.set(key,group={key,entries:new Set(),sphere:new T.Sphere(),dirty:true});group.entries.add(e);e.group=group;}
  e.group.dirty=true;
 }
 bounds(e){this.getMatrixAt(e.index,matrix);this.getBoundingSphereAt(e.geometryId,e.sphere).applyMatrix4(matrix);this.place(e);}
 addInstance(geometryId){const id=super.addInstance(geometryId),e={index:id,geometryId,sphere:new T.Sphere(),moving:false,group:null,start:0,count:0,z:0};this.entries.set(id,e);let entries=this.byGeometry.get(geometryId);if(!entries)this.byGeometry.set(geometryId,entries=new Set());entries.add(e);this.bounds(e);markMatrix(this._matricesTexture,id);this.changed();return id;}
 deleteInstance(id){const e=this.entries.get(id);if(e){this.ungroup(e);this.byGeometry.get(e.geometryId)?.delete(e);this.entries.delete(id);}super.deleteInstance(id);this.changed();return this;}
 setMatrixAt(id,value){super.setMatrixAt(id,value);const e=this.entries.get(id);if(e)this.bounds(e);markMatrix(this._matricesTexture,id);this.changed();return this;}
 setVisibleAt(id,visible){const before=this.getVisibleAt(id);super.setVisibleAt(id,visible);if(before!==visible)this.changed();return this;}
 setInstanceMoving(id,moving){const e=this.entries.get(id);if(e&&e.moving!==moving){this.ungroup(e);e.moving=moving;this.place(e);this.changed();}return this;}
 setGeometryAt(id,geometry){const result=super.setGeometryAt(id,geometry);for(const e of this.byGeometry?.get(id)||[])this.bounds(e);this.changed();return result;}
 setGeometryIdAt(id,geometryId){const e=this.entries.get(id);super.setGeometryIdAt(id,geometryId);if(e){this.byGeometry.get(e.geometryId)?.delete(e);let entries=this.byGeometry.get(geometryId);if(!entries)this.byGeometry.set(geometryId,entries=new Set());entries.add(e);e.geometryId=geometryId;this.bounds(e);}this.changed();return this;}
 setInstanceCount(count){super.setInstanceCount(count);this.changed();return this;}
 optimize(){super.optimize();this.changed();return this;}
 sameView(camera,material){
  const cameras=camera.isArrayCamera?camera.cameras:[camera],needed=20+cameras.length*34;if(this.viewKey.length<needed)this.viewKey=new Float64Array(needed);
  let i=0,changed=this.lastSort!==this.customSort;const put=value=>{if(this.viewKey[i]!==value)changed=true;this.viewKey[i++]=value;};
  put(this.spatialVersion);put(+this.perObjectFrustumCulled);put(+this.sortObjects);put(+material.transparent);
  for(const n of this.matrixWorld.elements)put(n);
  for(const c of cameras){for(const n of c.projectionMatrix.elements)put(n);for(const n of c.matrixWorldInverse.elements)put(n);put(c.coordinateSystem);put(+!!c.reversedDepth);}
  changed||=this.viewLength!==i;this.viewLength=i;this.lastSort=this.customSort;return !changed;
 }
 intersects(sphere){for(const f of this.frusta)if(f.intersectsSphere(sphere))return true;return false;}
 onBeforeRender(renderer,scene,camera,geometry,material){
  flushMatrices(this._matricesTexture);
  if(this.sameView(camera,material)&&!this._visibilityChanged){this.selectionStats.reused++;return;}
  const cameras=camera.isArrayCamera?camera.cameras:[camera];this.frusta.length=cameras.length;
  for(let i=0;i<cameras.length;i++){const c=cameras[i],f=this.frusta[i]??=new T.Frustum();matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).multiply(this.matrixWorld);f.setFromProjectionMatrix(matrix,c.coordinateSystem,c.reversedDepth);}
  const list=this.drawList;list.length=0;const stats=this.selectionStats;stats.groups=0;stats.instances=0;
  const append=e=>{if(!this._instanceInfo[e.index].visible)return;stats.instances++;if(!this.perObjectFrustumCulled||this.intersects(e.sphere))list.push(e);};
  for(const group of this.groups.values()){
   stats.groups++;if(group.dirty){group.sphere.makeEmpty();for(const e of group.entries)group.sphere.union(e.sphere);group.dirty=false;}
   if(!this.perObjectFrustumCulled||this.intersects(group.sphere))for(const e of group.entries)append(e);
  }
  for(const e of this.moving)append(e);
  inverse.copy(this.matrixWorld).invert();position.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);forward.set(0,0,-1).transformDirection(camera.matrixWorld).transformDirection(inverse);
  for(const e of list){const range=this._geometryInfo[e.geometryId];e.start=range.start;e.count=range.count;e.z=(e.sphere.center.x-position.x)*forward.x+(e.sphere.center.y-position.y)*forward.y+(e.sphere.center.z-position.z)*forward.z;}
  if(this.sortObjects){if(this.customSort)this.customSort.call(this,list,camera);else list.sort(material.transparent?(a,b)=>b.z-a.z||a.index-b.index:(a,b)=>a.z-b.z||a.index-b.index);}
  else list.sort((a,b)=>a.index-b.index);
  const bytes=geometry.index?.array.BYTES_PER_ELEMENT||1,indirect=this._indirectTexture.image.data;let changed=this._multiDrawCount!==list.length;
  for(let i=0;i<list.length;i++){const e=list[i];this._multiDrawStarts[i]=e.start*bytes;this._multiDrawCounts[i]=e.count;if(indirect[i]!==e.index)changed=true;indirect[i]=e.index;}
  if(changed)this._indirectTexture.needsUpdate=true;this._multiDrawCount=list.length;this._visibilityChanged=false;
 }
 dispose(){this.entries.clear();this.groups.clear();this.moving.clear();this.byGeometry.clear();this.drawList.length=0;super.dispose();}
}
