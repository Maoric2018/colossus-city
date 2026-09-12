import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const models=new Map(),baked=new Map(),loader=new GLTFLoader();
export const assetStatus={loaded:[],failed:[]};
T.DefaultLoadingManager.onError=url=>{if(!assetStatus.failed.includes(url))assetStatus.failed.push(url);};
export function loadModel(url){
 if(!models.has(url))models.set(url,loader.loadAsync(url).then(g=>{assetStatus.loaded.push(url);return g.scene;}).catch(error=>{assetStatus.failed.push(url);throw error;}));
 return models.get(url);
}
// Collapse each material into one geometry before repeating props with instancing.
// Ground-centering also removes the source packs' scene-layout offsets.
export function bakedModel(url){
 if(!baked.has(url))baked.set(url,loadModel(url).then(model=>{
  model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3());center.y=bounds.min.y;
  const groups=new Map();model.traverse(node=>{if(!node.isMesh)return;
   const source=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();source.applyMatrix4(node.matrixWorld);source.translate(-center.x,-center.y,-center.z);
   const materials=Array.isArray(node.material)?node.material:[node.material];
   const ranges=source.groups.length?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}];
   for(const range of ranges){
    const mat=materials[range.materialIndex||0],key=mat.map?mat.map.uuid:'solid';
    if(!groups.has(key))groups.set(key,{geometries:[],material:new T.MeshStandardMaterial({map:mat.map,vertexColors:true,roughness:mat.map?.7:.56,metalness:mat.map?.12:.25})});
    const g=new T.BufferGeometry();for(const name of ['position','normal','uv']){const a=source.attributes[name];if(a)g.setAttribute(name,new T.Float32BufferAttribute(Array.from(a.array.slice(range.start*a.itemSize,(range.start+range.count)*a.itemSize)),a.itemSize));}
    const colors=new Float32Array(range.count*3);for(let i=0;i<range.count;i++)mat.color.toArray(colors,i*3);g.setAttribute('color',new T.BufferAttribute(colors,3));groups.get(key).geometries.push(g);
   }source.dispose();
  });
  return {size:bounds.getSize(new T.Vector3()),parts:[...groups.values()].map(({geometries,material})=>{const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();return {geometry,material};})};
 }));return baked.get(url);
}
export function instances(parent,model,placements,{castShadow=true}={}){
 const dummy=new T.Object3D(),result=[];
 for(const part of model.parts){const batch=new T.InstancedMesh(part.geometry,part.material,placements.length);batch.castShadow=castShadow;batch.receiveShadow=true;
  placements.forEach((p,i)=>{dummy.position.set(...p.position);dummy.rotation.set(0,p.yaw||0,0);if(Array.isArray(p.scale))dummy.scale.set(...p.scale);else dummy.scale.setScalar(p.scale||1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();parent.add(batch);result.push(batch);
 }return result;
}
