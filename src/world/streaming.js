import * as T from 'three';
import {CityView} from './city.js';
import {generateBlock,blockAt,blockKey,homeBlock,cellBlock,BLOCK_SIZE} from '../../shared/city/layout.js';
import {installRoofDressing} from '../district.js';
import {streamGround} from './stream-ground.js';
import {BlockPreparation} from './block-preparation.js';
const keyOf=id=>{const p=cellBlock(id);return p?blockKey(...p):null;};
export class StreamedBlocks{
 constructor(owner){
  this.owner=owner;this.views=new Map();this.previews=new Map();this.records=new Map();this.entityOwners=new Map();this.lastKey='';this.pending=[];this.position=new T.Vector3();this.previous=new T.Vector3();this.velocity=new T.Vector3();this.lastTime=0;this.building=null;this.buildStats={frames:0,maxMS:0};
  this.ground=streamGround(owner.root,owner.tier,owner.textures,owner.scene.fog.far);
  this.preparation=new BlockPreparation(!owner.tier.lambert,!owner.tier.mobile);
 }
 record(key){let r=this.records.get(key);if(!r){r={key,skins:new Map(),fractures:new Map(),shards:new Map(),cleared:new Set(),entities:new Map()};this.records.set(key,r);}return r;}
 state(meta){
  const r=this.record(meta.key);for(const id of [...r.entities.keys(),...r.shards.keys()])this.entityOwners.delete(id);
  r.skins=new Map((meta.skins||[]).map(s=>[s[0],s.slice(1)]));r.fractures=new Map(meta.fractures||[]);r.shards=new Map((meta.shards||[]).map(e=>[e.id,e]));r.cleared=new Set(meta.clearedCells||[]);r.entities=new Map((meta.entities||[]).map(e=>[e.id,e]));for(const e of r.shards.values())this.entityOwners.set(e.id,meta.key);
  for(const e of r.entities.values())this.entityOwners.set(e.id,meta.key);
  const previous=this.previews.get(meta.key),changed=!!meta.landmark&&previous?.landmark!==meta.landmark;r.landmark=meta.landmark;
  if(changed){if(this.building?.env.key===meta.key){this.building.dispose();this.building=null;}const view=this.views.get(meta.key);if(view){this.owner.handWorld.children.delete(view.handWorld);view.dispose();this.views.delete(meta.key);}this.previews.delete(meta.key);this.pending=this.pending.filter(e=>e.key!==meta.key);this.lastKey='';}
  const view=this.views.get(meta.key);if(view){this.owner.handWorld.children.delete(view.handWorld);view.reset();this.owner.handWorld.children.add(view.handWorld);this.apply(view,r);}
  if(!r.landmark&&!r.skins.size&&!r.fractures.size&&!r.shards.size&&!r.cleared.size&&!r.entities.size)this.records.delete(meta.key);
 }
 apply(view,r){view.hideCells([...r.cleared]);for(const [id,s]of r.skins)view.setSkin(id,...s,false);for(const [id,parts]of r.fractures)view.setFracture(id,parts);for(const e of r.shards.values())view.addShards(e);for(const e of r.entities.values())view.addDebris(e);view.commit();}
 setFracture(id,parts){const key=keyOf(id);if(!key)return;this.record(key).fractures.set(id,[...parts]);this.views.get(key)?.setFracture(id,parts);}
 addShards(e){const key=keyOf(e.cell);if(!key)return;this.record(key).shards.set(e.id,{...e});this.entityOwners.set(e.id,key);this.views.get(key)?.addShards(e);}
 setSkin(id,glass,facade,fx){const key=keyOf(id);if(!key)return;this.record(key).skins.set(id,[glass,facade]);this.views.get(key)?.setSkin(id,glass,facade,fx);}
 hideCells(ids){for(const id of ids){const key=keyOf(id);if(!key)continue;this.record(key).cleared.add(id);this.views.get(key)?.hideCells([id]);}}
 addDebris(e){const key=keyOf(e.cells[0]);if(!key)return;this.record(key).entities.set(e.id,{...e});this.entityOwners.set(e.id,key);this.views.get(key)?.addDebris(e);}
 poseDebris(id,p,q){const key=this.entityOwners.get(id),record=this.records.get(key),e=record?.shards.get(id)||record?.entities.get(id);if(!e||e.settled)return;e.p=p;e.q=q;this.views.get(key)?.poseDebris(id,p,q);}
 removeDebris(id){const key=this.entityOwners.get(id),r=this.records.get(key),e=r?.entities.get(id);if(e){for(const c of e.cells)r.cleared.add(c);r.entities.delete(id);}this.views.get(key)?.removeDebris(id);this.entityOwners.delete(id);}
 crumble(e){this.hideCells(e.cells);if(e.id)this.removeDebris(e.id);}
 getCell(id){return this.views.get(keyOf(id))?.byId.get(id);}
 reset(){this.preparation.clear();this.building?.dispose();this.building=null;for(const view of this.views.values()){this.owner.handWorld.children.delete(view.handWorld);view.dispose();}this.views.clear();this.previews.clear();this.pending=[];this.records.clear();this.entityOwners.clear();this.lastKey='';this.lastTime=0;this.velocity.set(0,0,0);}
 select(camera){
  const viewCamera=camera.cameras?.[0]||camera,p=this.position.setFromMatrixPosition(viewCamera.matrixWorld),[cx,cz]=blockAt(p.x,p.z),key=blockKey(cx,cz),now=performance.now();
  if(this.lastTime&&now>this.lastTime){const dt=(now-this.lastTime)/1000;if(dt<.5&&p.distanceTo(this.previous)<50)this.velocity.lerp(new T.Vector3().subVectors(p,this.previous).divideScalar(dt),.25);else this.velocity.set(0,0,0);}this.previous.copy(p);this.lastTime=now;
  this.ground.update(p);this.owner.sky.position.copy(p);this.owner.sun.position.set(p.x-120,160,p.z-90);this.owner.sun.target.position.set(p.x,0,p.z);this.owner.sun.target.updateMatrixWorld();
  const far=this.owner.scene.fog.far,radius=Math.ceil(far/BLOCK_SIZE);
  if(key!==this.lastKey){
   this.lastKey=key;
   for(const [k,env]of this.previews)if(Math.abs(env.block[0]-cx)>radius||Math.abs(env.block[1]-cz)>radius)this.previews.delete(k);
   for(const [k,v]of this.views)if(Math.abs(v.env.block[0]-cx)>radius||Math.abs(v.env.block[1]-cz)>radius){this.owner.handWorld.children.delete(v.handWorld);v.dispose();this.views.delete(k);}
   if(this.building&&(Math.abs(this.building.env.block[0]-cx)>radius||Math.abs(this.building.env.block[1]-cz)>radius)){this.building.dispose();this.building=null;}
   // Only detailed blocks enter the scene. No temporary low-detail stand-ins
   // are shown while streaming, and no distant silhouette ring is generated.
   for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)if(!homeBlock(x,z)){const k=blockKey(x,z);if(!this.previews.has(k))this.previews.set(k,generateBlock(x,z,this.owner.env.seed,{landmark:this.records.get(k)?.landmark}));}
   this.pending=[...this.previews.values()].filter(e=>Math.abs(e.block[0]-cx)<=radius&&Math.abs(e.block[1]-cz)<=radius&&!this.views.has(e.key)&&e.key!==this.building?.env.key);
   const lead=.65,speed=Math.hypot(this.velocity.x,this.velocity.z),scale=Math.min(1,100/(speed||1)),x=p.x+this.velocity.x*lead*scale,z=p.z+this.velocity.z*lead*scale;
   this.pending.sort((a,b)=>Math.hypot(a.center[0]-x,a.center[1]-z)-Math.hypot(b.center[0]-x,b.center[1]-z));
   this.preparation.retain(new Set(this.pending.map(e=>e.key)));for(const env of this.pending)this.preparation.prepare(env);
  }
  // Cooperative construction uses an elapsed-time deadline, including contact
  // caches and component preparation. Staged bays never enter visibility lists.
  const began=performance.now(),deadline=began+(this.owner.quest||this.owner.tier.name==='QUEST'?2:3);
  if(!this.building&&this.pending.length){const env=this.pending.shift();this.building=new CityView(this.owner.scene,env,{tier:this.owner.tier,quest:this.owner.quest,parent:this.owner,preparedCells:this.preparation.take(env),deferred:true});}
  if(this.building){
   const view=this.building;if(view.advance(deadline)){const record=this.records.get(view.env.key);if(record)this.apply(view,record);view.activate();this.views.set(view.env.key,view);this.owner.handWorld.children.add(view.handWorld);this.building=null;installRoofDressing(view).catch(error=>console.error('Streamed roof assets failed',error));}
   this.buildStats.frames++;this.buildStats.maxMS=Math.max(this.buildStats.maxMS,performance.now()-began);
  }
  const homeVisible=Math.max(Math.abs(p.x)-175,Math.abs(p.z)-175)<far;
  for(const mesh of this.owner.batches)mesh.visible=homeVisible;
 }
}
