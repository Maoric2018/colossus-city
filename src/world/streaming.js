import {chryslerLODGeometry} from '../render/chrysler-lod.js';
import {CatalogLOD,catalogTint} from '../render/catalog-lod.js';
import {WORLD_STYLE_BY_ID} from '../../shared/city/world-landmarks.js';
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
  this.owner=owner;this.views=new Map();this.previews=new Map();this.records=new Map();this.entityOwners=new Map();this.lastKey='';this.needsLOD=true;this.lastBuild=-Infinity;this.pending=[];this.position=new T.Vector3();
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
  this.landmarkLOD=new T.InstancedMesh(chryslerLODGeometry(),surface(owner.tier,{vertexColors:true,roughness:.45}),256);this.landmarkLOD.count=0;this.landmarkLOD.frustumCulled=false;owner.root.add(this.landmarkLOD);
  this.catalogLOD=new CatalogLOD(owner.root,owner.tier);
 }
 record(key){let r=this.records.get(key);if(!r){r={key,skins:new Map(),cleared:new Set(),entities:new Map()};this.records.set(key,r);}return r;}
 state(meta){
  const r=this.record(meta.key);for(const id of r.entities.keys())this.entityOwners.delete(id);
  r.skins=new Map((meta.skins||[]).map(s=>[s[0],s.slice(1)]));r.cleared=new Set(meta.clearedCells||[]);r.entities=new Map((meta.entities||[]).map(e=>[e.id,e]));
  for(const e of r.entities.values())this.entityOwners.set(e.id,meta.key);
  const previous=this.previews.get(meta.key),changed=!!meta.landmark&&previous?.landmark!==meta.landmark;r.landmark=meta.landmark;
  if(changed){const view=this.views.get(meta.key);if(view){this.owner.handWorld.children.delete(view.handWorld);view.dispose();this.views.delete(meta.key);}this.previews.delete(meta.key);this.pending=this.pending.filter(e=>e.key!==meta.key);this.lastKey='';}
  const view=this.views.get(meta.key);if(view){this.owner.handWorld.children.delete(view.handWorld);view.reset();this.owner.handWorld.children.add(view.handWorld);this.apply(view,r);}
  if(!r.landmark&&!r.skins.size&&!r.cleared.size&&!r.entities.size)this.records.delete(meta.key);
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
 reset(){for(const view of this.views.values()){this.owner.handWorld.children.delete(view.handWorld);view.dispose();}this.views.clear();this.previews.clear();this.pending=[];this.records.clear();this.entityOwners.clear();this.lastKey='';this.needsLOD=true;}
 select(camera){
  const viewCamera=camera.cameras?.[0]||camera,p=this.position.setFromMatrixPosition(viewCamera.matrixWorld),[cx,cz]=blockAt(p.x,p.z),key=blockKey(cx,cz),now=performance.now();
  this.ground.update(p);this.owner.sky.position.copy(p);this.owner.sun.position.set(p.x-120,160,p.z-90);this.owner.sun.target.position.set(p.x,0,p.z);this.owner.sun.target.updateMatrixWorld();
  const far=this.owner.scene.fog.far||340,radius=Math.ceil(far/70)+1;
  if(key!==this.lastKey){
   this.lastKey=key;this.needsLOD=true;
   for(const [k,env]of this.previews)if(Math.abs(env.block[0]-cx)>radius+1||Math.abs(env.block[1]-cz)>radius+1)this.previews.delete(k);
   for(const [k,v]of this.views)if(Math.abs(v.env.block[0]-cx)>1||Math.abs(v.env.block[1]-cz)>1){this.owner.handWorld.children.delete(v.handWorld);v.dispose();this.views.delete(k);}
   for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)if(!homeBlock(x,z)&&Math.hypot(x*70-p.x,z*70-p.z)<far+100){const k=blockKey(x,z);if(!this.previews.has(k))this.previews.set(k,generateBlock(x,z,this.owner.env.seed,{landmark:this.records.get(k)?.landmark}));}
   this.pending=[...this.previews.values()].filter(e=>Math.abs(e.block[0]-cx)<=1&&Math.abs(e.block[1]-cz)<=1&&!this.views.has(e.key)).sort((a,b)=>Math.hypot(a.center[0]-p.x,a.center[1]-p.z)-Math.hypot(b.center[0]-p.x,b.center[1]-p.z));
  }
  // One nearby block per rendered frame avoids building a complete district in one frame.
  if(this.pending.length&&now-this.lastBuild>12){
   const env=this.pending.shift(),view=new CityView(this.owner.scene,env,{tier:this.owner.tier,quest:this.owner.quest,parent:this.owner});this.views.set(env.key,view);this.owner.handWorld.children.add(view.handWorld);const record=this.records.get(env.key);if(record)this.apply(view,record);installRoofDressing(view).catch(error=>console.error('Streamed roof assets failed',error));this.lastBuild=now;this.needsLOD=true;
  }
  if(this.needsLOD){this.rebuildLOD();this.needsLOD=false;}
  const homeVisible=Math.max(Math.abs(p.x)-175,Math.abs(p.z)-175)<far;
  for(const mesh of this.owner.batches)mesh.visible=homeVisible;
 }
 rebuildLOD(){
  let index=0,landmarks=0;
  this.catalogLOD.reset();
  for(const env of this.previews.values()){
   if(this.views.has(env.key))continue;const record=this.records.get(env.key),gone=new Set([...(record?.cleared||[]),...[...(record?.entities.values()||[])].flatMap(e=>e.cells)]),collapsed=new Set();
   const damaged=new Map(),surviving=new Map();if(gone.size){const cells=generateCells(env);for(let i=0;i<env.buildings.length;i++){const mine=cells.filter(c=>c.building===i),broken=mine.filter(c=>gone.has(c.id));damaged.set(i,broken);if(WORLD_STYLE_BY_ID.has(env.buildings[i].architecture))surviving.set(i,mine.filter(c=>!gone.has(c.id)));if(broken.length>mine.length*.45)collapsed.add(i);}}
   for(const [i,b]of env.buildings.entries()){
    if(collapsed.has(i))continue;
    if(!damaged.get(i)?.length&&this.catalogLOD.building(b))continue;
    this.catalogLOD.roofs(b,damaged.get(i)||[]);
    // Damaged landmarks keep their tapered bays and genuine portals in the
    // skyline; a rectangular tier would fill the openings and restore broken bays.
    if(WORLD_STYLE_BY_ID.has(b.architecture)&&surviving.has(i)){
     for(const c of surviving.get(i)){if(index>=this.lod.instanceMatrix.count)break;dummy.position.set(...c.p);dummy.rotation.set(0,0,0);dummy.scale.set(...c.size);if(c.openSkin){dummy.position.y+=c.size[1]/2-.08;dummy.scale.y=.16;}dummy.updateMatrix();this.lod.setMatrixAt(index,dummy.matrix);this.lod.setColorAt(index++,new T.Color(catalogTint(b.architecture)));}continue;
    }
    if(b.architecture==='chrysler'&&!collapsed.has(i)&&landmarks<this.landmarkLOD.instanceMatrix.count){
     const crown=gone.size?generateCells(env).find(c=>c.building===i&&c.chryslerCrown):null;
     if(!crown||!gone.has(crown.id)){dummy.position.set(b.x,.15+(b.tiers.reduce((n,t)=>n+t.floors,0)-.5)*b.story,b.z);dummy.rotation.set(0,0,0);dummy.scale.set(b.bay,b.story,b.bay);dummy.updateMatrix();this.landmarkLOD.setMatrixAt(landmarks++,dummy.matrix);}
    }
    const base=b.tiers[0];let floor=0;
    for(const t of b.tiers){const h=t.floors*b.story;dummy.position.set(b.x+(t.ix+(t.nx-base.nx)/2)*b.bay,.15+floor*b.story+h/2,b.z+(t.iz+(t.nz-base.nz)/2)*b.bay);dummy.rotation.set(0,0,0);dummy.scale.set(t.nx*b.bay,h,t.nz*b.bay);floor+=t.floors;
     if(collapsed.has(i))continue;if(index>=this.lod.instanceMatrix.count)break;dummy.updateMatrix();this.lod.setMatrixAt(index,dummy.matrix);this.lod.setColorAt(index++,new T.Color(catalogTint(b.architecture)??palette[b.material][b.variant%3]));
    }
   }
  }
  this.landmarkLOD.count=landmarks;this.landmarkLOD.instanceMatrix.needsUpdate=true;
  this.catalogLOD.commit();
  this.lod.count=index;this.lod.instanceMatrix.needsUpdate=true;if(this.lod.instanceColor)this.lod.instanceColor.needsUpdate=true;
 }
}
