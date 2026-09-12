import * as T from 'three';
import {CityView} from './city.js';
import {surface} from '../render/quality.js';
import {generateCells} from '../../shared/environment.js';
import {generateBlock,blockAt,blockKey,homeBlock,cellBlock} from '../../shared/city/layout.js';
import {installRoofDressing} from '../district.js';
import {streamGround} from './stream-ground.js';
const dummy=new T.Object3D(),palette={brick:[0x956350,0x795850,0xaf7e63],stone:[0xcac4b4,0xaaa99e,0xd2b995],concrete:[0x939c9c,0xb3b2a9,0x798d93],glass:[0x526f80,0x73959d,0x435968]};
const keyOf=id=>{const p=cellBlock(id);return p?blockKey(...p):null;};
export class StreamedBlocks{
 constructor(owner){
  this.owner=owner;this.views=new Map();this.previews=new Map();this.records=new Map();this.entityOwners=new Map();this.lastKey='';this.needsLOD=true;this.lastBuild=-Infinity;
  this.ground=streamGround(owner.root,owner.tier,owner.textures);
  const material=surface(owner.tier,{color:0xffffff,roughness:.85});
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 blockPosition;varying vec3 blockNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nblockPosition=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;blockNormal=normal;');
   shader.fragmentShader='varying vec3 blockPosition;varying vec3 blockNormal;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float u=abs(blockNormal.x)>.5?blockPosition.z:blockPosition.x;vec2 pane=fract(vec2(u/2.1,blockPosition.y/3.4));
    float window=(1.-step(.5,abs(blockNormal.y)))*step(.17,pane.x)*(1.-step(.82,pane.x))*step(.21,pane.y)*(1.-step(.78,pane.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.24,.29),window*.85);
   `);
  };material.customProgramCacheKey=()=> 'streamed-facades-v1';
  this.lod=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,8192);this.lod.count=0;this.lod.frustumCulled=false;this.lod.receiveShadow=true;owner.root.add(this.lod);
 }
 record(key){let r=this.records.get(key);if(!r){r={key,skins:new Map(),cleared:new Set(),entities:new Map()};this.records.set(key,r);}return r;}
 state(meta){
  const r=this.record(meta.key);for(const id of r.entities.keys())this.entityOwners.delete(id);
  r.skins=new Map((meta.skins||[]).map(s=>[s[0],s.slice(1)]));r.cleared=new Set(meta.clearedCells||[]);r.entities=new Map((meta.entities||[]).map(e=>[e.id,e]));
  for(const e of r.entities.values())this.entityOwners.set(e.id,meta.key);
  const view=this.views.get(meta.key);if(view){this.owner.handWorld.children.delete(view.handWorld);view.reset();this.owner.handWorld.children.add(view.handWorld);this.apply(view,r);}
  if(!r.skins.size&&!r.cleared.size&&!r.entities.size)this.records.delete(meta.key);
  this.needsLOD=true;
 }
 apply(view,r){view.hideCells([...r.cleared]);for(const [id,s]of r.skins)view.setSkin(id,...s,false);for(const e of r.entities.values())view.addDebris(e);view.commit();}
 setSkin(id,glass,facade,fx){const key=keyOf(id);if(!key)return;this.record(key).skins.set(id,[glass,facade]);this.views.get(key)?.setSkin(id,glass,facade,fx);this.needsLOD=true;}
 hideCells(ids){for(const id of ids){const key=keyOf(id);if(!key)continue;this.record(key).cleared.add(id);this.views.get(key)?.hideCells([id]);}this.needsLOD=true;}
 addDebris(e){const key=keyOf(e.cells[0]);if(!key)return;this.record(key).entities.set(e.id,{...e});this.entityOwners.set(e.id,key);this.views.get(key)?.addDebris(e);this.needsLOD=true;}
 poseDebris(id,p,q){const key=this.entityOwners.get(id),e=this.records.get(key)?.entities.get(id);if(!e||e.settled)return;e.p=p;e.q=q;this.views.get(key)?.poseDebris(id,p,q);}
 removeDebris(id){const key=this.entityOwners.get(id),r=this.records.get(key),e=r?.entities.get(id);if(e){for(const c of e.cells)r.cleared.add(c);r.entities.delete(id);}this.views.get(key)?.removeDebris(id);this.entityOwners.delete(id);this.needsLOD=true;}
 crumble(e){this.hideCells(e.cells);if(e.id)this.removeDebris(e.id);}
 getCell(id){return this.views.get(keyOf(id))?.byId.get(id);}
 reset(){for(const view of this.views.values()){this.owner.handWorld.children.delete(view.handWorld);view.dispose();}this.views.clear();this.records.clear();this.entityOwners.clear();this.lastKey='';this.needsLOD=true;}
 select(camera){
  const viewCamera=camera.cameras?.[0]||camera,p=new T.Vector3().setFromMatrixPosition(viewCamera.matrixWorld),[cx,cz]=blockAt(p.x,p.z),key=blockKey(cx,cz),now=performance.now();
  this.ground.update(p);this.owner.sky.position.copy(p);this.owner.sun.position.set(p.x-120,160,p.z-90);this.owner.sun.target.position.set(p.x,0,p.z);this.owner.sun.target.updateMatrixWorld();
  const far=this.owner.scene.fog.far||340,radius=Math.ceil(far/70)+1;
  if(key!==this.lastKey){
   this.lastKey=key;this.needsLOD=true;
   for(const [k,env]of this.previews)if(Math.abs(env.block[0]-cx)>radius+1||Math.abs(env.block[1]-cz)>radius+1)this.previews.delete(k);
   for(const [k,v]of this.views)if(Math.abs(v.env.block[0]-cx)>1||Math.abs(v.env.block[1]-cz)>1){this.owner.handWorld.children.delete(v.handWorld);v.dispose();this.views.delete(k);}
   for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)if(!homeBlock(x,z)&&Math.hypot(x*70-p.x,z*70-p.z)<far+100){const k=blockKey(x,z);if(!this.previews.has(k))this.previews.set(k,generateBlock(x,z,this.owner.env.seed));}
  }
  // One nearby block per rendered frame avoids building a complete district in one frame.
  if(now-this.lastBuild>12){
   const missing=[...this.previews.values()].filter(e=>Math.abs(e.block[0]-cx)<=1&&Math.abs(e.block[1]-cz)<=1&&!this.views.has(e.key)).sort((a,b)=>Math.hypot(a.center[0]-p.x,a.center[1]-p.z)-Math.hypot(b.center[0]-p.x,b.center[1]-p.z));
   if(missing.length){const env=missing[0],view=new CityView(this.owner.scene,env,{tier:this.owner.tier,quest:this.owner.quest,parent:this.owner});this.views.set(env.key,view);this.owner.handWorld.children.add(view.handWorld);const record=this.records.get(env.key);if(record)this.apply(view,record);installRoofDressing(view).catch(error=>console.error('Streamed roof assets failed',error));this.lastBuild=now;this.needsLOD=true;}
  }
  if(this.needsLOD){this.rebuildLOD();this.needsLOD=false;}
  const homeVisible=Math.max(Math.abs(p.x)-175,Math.abs(p.z)-175)<far;
  for(const mesh of [...this.owner.buildings.batches,...this.owner.batches])if(!mesh.userData.component)mesh.visible=homeVisible;
 }
 rebuildLOD(){
  let index=0;
  for(const env of this.previews.values()){
   if(this.views.has(env.key))continue;const record=this.records.get(env.key),gone=new Set([...(record?.cleared||[]),...[...(record?.entities.values()||[])].flatMap(e=>e.cells)]),collapsed=new Set();
   if(gone.size){const cells=generateCells(env);for(let i=0;i<env.buildings.length;i++){const mine=cells.filter(c=>c.building===i);if(mine.filter(c=>gone.has(c.id)).length>mine.length*.45)collapsed.add(i);}}
   for(const [i,b]of env.buildings.entries()){
    const base=b.tiers[0];let floor=0;
    for(const t of b.tiers){const h=t.floors*b.story;dummy.position.set(b.x+(t.ix+(t.nx-base.nx)/2)*b.bay,.15+floor*b.story+h/2,b.z+(t.iz+(t.nz-base.nz)/2)*b.bay);dummy.rotation.set(0,0,0);dummy.scale.set(t.nx*b.bay,h,t.nz*b.bay);floor+=t.floors;
     if(collapsed.has(i))continue;if(index>=this.lod.instanceMatrix.count)break;dummy.updateMatrix();this.lod.setMatrixAt(index,dummy.matrix);this.lod.setColorAt(index++,new T.Color(palette[b.material][b.variant%3]));
    }
   }
  }
  this.lod.count=index;this.lod.instanceMatrix.needsUpdate=true;if(this.lod.instanceColor)this.lod.instanceColor.needsUpdate=true;
 }
}
