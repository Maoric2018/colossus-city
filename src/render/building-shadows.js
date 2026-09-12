import * as T from 'three';
import {partialInstanceUpdates,commitInstances} from './instances.js';
import {skinKey} from './building-skin.js';
const matrix=new T.Matrix4(),world=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0);
const sides=Array.from({length:4},(_,side)=>new T.Matrix4().compose(new T.Vector3(Math.sin(side*Math.PI/2)*.5,0,-Math.cos(side*Math.PI/2)*.5),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-side*Math.PI/2),new T.Vector3(1,1,1)));
// Exact authored frame/roof/facade geometry, independently instanced for shadows.
// A zero main-pass count avoids drawing off-camera shadow casters in the color pass.
export class BuildingShadows{
 constructor(buildings){
  this.owner=buildings;this.dirty=new Set();this.meshes=[];this.walls=new Map();this.roofs=new Map();this.enabled=true;
  const create=(geometry,count)=>{
   const material=new T.MeshBasicMaterial(),mesh=partialInstanceUpdates(new T.InstancedMesh(geometry,material,Math.max(1,count)),this.dirty);
   mesh.count=0;mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.shadowOnly=true;
   mesh.onBeforeShadow=()=>{mesh.count=count;};mesh.onAfterShadow=()=>{mesh.count=0;};
   mesh.addEventListener('dispose',()=>material.dispose());buildings.root.add(mesh);this.meshes.push(mesh);return mesh;
  };
  this.frame=create(buildings.frame.geometry,buildings.cells.length);for(const e of buildings.entries.values())if(e.cell.roof)this.roofs.set(e,this.roofs.size);this.roof=create(buildings.roof.geometry,this.roofs.size);
  for(const [name,facade]of Object.entries(buildings.facade)){let index=0;const mesh=create(facade.geometry,facade.instanceMatrix.count);
   for(const e of buildings.entries.values())if(skinKey(e.cell)===name)for(const wall of e.walls)this.walls.set(wall,{mesh,index:index++});
  }
  for(const mesh of [buildings.frame,buildings.empireFrame,buildings.roof,...Object.values(buildings.facade)]){mesh.userData.fractureCastShadow=mesh.castShadow;mesh.castShadow=false;}
 }
 write(e){
  const visible=this.enabled&&e.shadowNear&&!e.hidden&&!e.fine;world.compose(e.p,e.q,e.size);const transform=visible?world:zero;
  this.frame.setMatrixAt(e.index,transform);const roof=this.roofs.get(e);if(roof!==undefined)this.roof.setMatrixAt(roof,transform);
  for(const wall of e.walls){const slot=this.walls.get(wall);if(slot)slot.mesh.setMatrixAt(slot.index,visible&&(e.facadeMask&(1<<wall.side))?matrix.multiplyMatrices(world,sides[wall.side]):zero);}
 }
 commit(){for(const mesh of this.meshes)mesh.visible=this.enabled;commitInstances(this.dirty);}
}
