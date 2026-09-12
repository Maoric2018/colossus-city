import * as T from 'three';
import {fractureRecipe,pieceAlive,shardBallistic} from '../../shared/city/fracture.js';
import {surface} from '../render/quality.js';
import {partialInstanceUpdates,commitInstances} from '../render/instances.js';
import {mergeParts} from '../art.js';
import {skinKey} from './buildings.js';
const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),local=new T.Vector3(),eye=new T.Vector3();
const colors={glass:0x7eacbd,brick:0xa3664c,stone:0xc8beab,concrete:0xaaa9a1,steel:0x485760};
// One global batch per material, with stable piece identities and compact visible
// slots. Only damaged bays allocate fine geometry; unloaded blocks release it.
export class FineBuildings{
 constructor(root,tier){this.root=root;this.tier=tier;this.cells=new Map();this.shards=new Map();this.active=new Set();this.batches=new Map();this.slots=new Map();this.prototypes=new Map();this.dirty=new Set();this.time=0;this.nextSelect=0;}
 reserve(material,count){
  const old=this.batches.get(material);if(old&&old.instanceMatrix.count>=count)return old;
  const face=material.startsWith('face:'),geometry=old?old.geometry.clone():(face?new T.PlaneGeometry(1,1):material==='steel'?mergeParts([[new T.BoxGeometry(1,1,.12),[0,0,.44]],[new T.BoxGeometry(1,1,.12),[0,0,-.44]],[new T.BoxGeometry(.16,1,.76)]]):new T.BoxGeometry(1,1,1)),capacity=2**Math.ceil(Math.log2(Math.max(64,count)));
  let mat=old?.material;if(!mat&&face){mat=this.prototypes.get(material).clone();mat.side=T.DoubleSide;mat.onBeforeCompile=shader=>{shader.vertexShader='attribute vec4 tileUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=tileUV.xy+vMapUv*tileUV.zw;\n#endif\n#ifdef USE_EMISSIVEMAP\n vEmissiveMapUv=tileUV.xy+vEmissiveMapUv*tileUV.zw;\n#endif');};mat.customProgramCacheKey=()=> 'fine-surface-uv-v1';}
  const mesh=partialInstanceUpdates(new T.InstancedMesh(geometry,mat||surface(this.tier,{color:colors[material],roughness:material==='glass'?.25:.86}),capacity),this.dirty);mesh.count=old?.count||0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=false;mesh.receiveShadow=true;this.root.add(mesh);this.batches.set(material,mesh);
  if(face){const uv=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);if(old)uv.array.set(old.geometry.getAttribute('tileUV').array);geometry.setAttribute('tileUV',uv);}
  if(old){mesh.instanceMatrix.array.set(old.instanceMatrix.array);if(old.instanceColor){mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.array.set(old.instanceColor.array);}this.dirty.delete(old);old.removeFromParent();old.dispose();old.geometry.dispose();}return mesh;
 }
 add(piece){let slots=this.slots.get(piece.material);if(!slots){slots=[];this.slots.set(piece.material,slots);}const mesh=this.reserve(piece.material,slots.length+1);piece.index=slots.length;slots.push(piece);mesh.count=slots.length;this.write(piece);}
 remove(piece){if(piece.index<0)return;const slots=this.slots.get(piece.material),index=piece.index,last=slots.pop();if(last!==piece){slots[index]=last;last.index=index;this.write(last);}piece.index=-1;this.batches.get(piece.material).count=slots.length;}
 entry(c,part,pose,offset=null,resources=null){
  let material=part.material,color=new T.Color(1,1,1);if(resources&&part.kind==='wall'){const key=skinKey(c);material='face:'+key;this.prototypes.set(material,(resources.facade[key]||resources.glass[key]).material);color.copy(resources.facade[key]?pose.tint:pose.glassTint||new T.Color(1,1,1));}
  else color.multiplyScalar(.9+((c.id*13+part.id*7)%17)/100);return {c,part,pose,offset,material,color,index:-1};
 }
 set(c,skin,pose,resources){
  let entry=this.cells.get(c.id);if(!entry){entry={c,pose,parts:[],skin};this.cells.set(c.id,entry);}for(const part of entry.parts)this.remove(part);
  const recipe=fractureRecipe(c),gone=new Set(skin.parts||[]),lost=[...gone].map(i=>recipe.pieces[i]).filter(Boolean);
  pose.fine={wallSides:new Set(lost.filter(p=>p.kind==='wall').map(p=>p.side)),frame:lost.some(p=>p.kind==='frame'),attachments:lost.some(p=>p.kind==='attachment'),lost,cutComponents:new Map()};
  entry.skin=skin;entry.parts=recipe.pieces.filter(part=>pieceAlive(part,skin,gone)&&(part.kind!=='attachment'||pose.fine.attachments)).map(part=>this.entry(c,part,pose,null,resources));this.nextSelect=0;
 }
 addShards(c,meta){
  let e=this.shards.get(meta.id);if(!e){const recipe=fractureRecipe(c);e={c,parts:[],p:new T.Vector3(),q:new T.Quaternion(),hidden:false};e.parts=meta.pieces.map(i=>this.entry(c,recipe.pieces[i],e,new T.Vector3(...meta.origin).sub(new T.Vector3(...c.p))));this.shards.set(meta.id,e);}
  Object.assign(e,{meta,settled:meta.settled,ballistic:meta.ballistic});e.p.fromArray(meta.p);e.q.fromArray(meta.q);this.time=Math.max(this.time,meta.born||0);if(e.ballistic&&!e.settled)this.active.add(e);else this.active.delete(e);
  for(const part of e.parts)if(part.index>=0)this.write(part);this.nextSelect=0;
 }
 poseShard(id,position,rotation){const e=this.shards.get(id);if(!e)return false;if(e.settled)return true;e.p.fromArray(position);e.q.fromArray(rotation);for(const part of e.parts)if(part.index>=0)this.write(part);return true;}
 write(e){
  const part=e.part;local.fromArray(part.p);if(e.offset)local.sub(e.offset);local.applyQuaternion(e.pose.q);p.copy(e.pose.p).add(local);q.copy(e.pose.q);scale.fromArray(part.size);
  // Small mortar joints and torn edges keep rubble from reading as whole rooms.
  const mesh=this.batches.get(e.material);
  if(e.material.startsWith('face:')){
   const side=part.side,width=e.c.size[side%2?2:0],u=(side%2?part.p[2]:part.p[0])*(side===1||side===2?-1:1)/width+.5,ww=part.size[side%2?2:0]/width,hh=part.size[1]/(e.c.size[1]*.925),vv=part.p[1]/(e.c.size[1]*.925)+.5;
   mesh.geometry.getAttribute('tileUV').setXYZW(e.index,u-ww/2,vv-hh/2,ww,hh);mesh.geometry.getAttribute('tileUV').needsUpdate=true;q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-side*Math.PI/2));scale.set(part.size[side%2?2:0]*.998,part.size[1]*.998,1);
  }else{scale.multiplyScalar(part.material==='glass'?.97:.96);if(part.material==='glass')scale.setComponent(part.side%2?0:2,.035);}
  matrix.compose(p,q,scale);mesh.setMatrixAt(e.index,matrix);mesh.setColorAt(e.index,e.color);
 }
 select(camera){
  const view=camera.cameras?.[0]||camera;eye.setFromMatrixPosition(view.matrixWorld);const now=performance.now();if(now<this.nextSelect&&this.lastEye?.distanceToSquared(eye)<1)return;this.nextSelect=now+80;(this.lastEye??=new T.Vector3()).copy(eye);
  for(const e of this.cells.values()){const visible=!e.pose.hidden&&e.pose.inView!==false&&e.pose.p.distanceToSquared(eye)<230**2;for(const part of e.parts){if(visible){if(part.index<0)this.add(part);}else this.remove(part);}}
  for(const e of this.shards.values()){const visible=e.p.distanceToSquared(eye)<170**2;for(const part of e.parts){if(visible){if(part.index<0)this.add(part);}else this.remove(part);}}
 }
 update(dt){this.time+=dt;for(const e of this.active){const pose=shardBallistic(e.meta,this.time);e.p.fromArray(pose.p);e.q.fromArray(pose.q);for(const part of e.parts)if(part.index>=0)this.write(part);}this.commit();}
 commit(){for(const mesh of this.batches.values())mesh.visible=mesh.count>0;commitInstances(this.dirty);}
 unregister(cells){const ids=new Set(cells.map(c=>c.id));for(const id of ids){const e=this.cells.get(id);if(e){for(const p of e.parts)this.remove(p);delete e.pose.fine;this.cells.delete(id);}}for(const [id,e]of this.shards)if(ids.has(e.c.id)){for(const p of e.parts)this.remove(p);this.active.delete(e);this.shards.delete(id);}}
 reset(){for(const e of this.cells.values())delete e.pose.fine;this.cells.clear();this.shards.clear();this.active.clear();for(const mesh of this.batches.values())mesh.count=0;for(const list of this.slots.values())list.length=0;this.nextSelect=0;this.time=0;}
}
