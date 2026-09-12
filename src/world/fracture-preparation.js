import {BufferGeometry,BufferAttribute} from 'three';
import {cacheFragments} from '../render/fracture-geometry.js';
// One bounded worker job at a time. The scene keeps ownership of GPU resources;
// the worker returns the same clipped triangles, with transferable typed arrays.
export class FracturePreparation{
 constructor(){this.serial=0;this.sourceSerial=0;this.sourceIds=new WeakMap();this.resident=new Map();this.busy=null;this.stats={jobs:0,failed:0};
  if(typeof Worker==='function')try{this.worker=new Worker(new URL('./fracture-preparation-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>this.receive(data);this.worker.onmessageerror=()=>this.fail();this.worker.onerror=event=>{event.preventDefault();this.fail();};}catch{this.worker=null;}
 }
 request(source,pieces,skin){
  if(!this.worker||this.busy)return null;let sourceId=this.sourceIds.get(source);if(!sourceId){sourceId=++this.sourceSerial;this.sourceIds.set(source,sourceId);}
  const entry={id:++this.serial,source,pieces,skin,done:false,started:performance.now()};this.busy=entry;const known=this.resident.has(sourceId);this.resident.delete(sourceId);this.resident.set(sourceId,true);if(this.resident.size>8)this.resident.delete(this.resident.keys().next().value);
  const data={id:entry.id,sourceId,pieces,skin:{glass:skin.glass,facade:skin.facade}};
  if(!known)data.source={records:source.records,recipe:source.recipe,materials:[...source.materials].map(([key,value])=>[key,{castShadow:value.castShadow,material:{transparent:value.material.transparent}}])};
  entry.data=data;if(this.ready)this.post(entry);this.stats.jobs++;return entry;
 }
 post(entry){try{this.worker.postMessage(entry.data);entry.data=null;}catch{this.fail();}}
 receive(data){if(data.ready){this.ready=true;if(this.busy)this.post(this.busy);return;}const entry=this.busy;if(!entry||entry.id!==data.id)return;
  if(data.error){this.fail();return;}
  entry.results=data.results;entry.done=true;this.busy=null;
 }
 materialize(entry,index){const draws=entry.results[index].map(d=>{const geometry=new BufferGeometry();geometry.userData.fractureOwned=true;for(const [name,a]of Object.entries(d.attributes))geometry.setAttribute(name,new BufferAttribute(a.array,a.itemSize));if(d.index)geometry.setIndex(new BufferAttribute(d.index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return {key:d.key,section:d.section,geometry,...entry.source.materials.get(d.key)};});entry.results[index]=null;cacheFragments(entry.source,entry.pieces[index],entry.skin,draws);return draws;}
 poll(){if(this.busy&&performance.now()-this.busy.started>10000)this.fail();}
 fail(){this.stats.failed++;if(this.busy){this.busy.done=true;this.busy.failed=true;}this.worker?.terminate();this.worker=null;this.busy=null;this.resident.clear();}
 dispose(){this.worker?.terminate();this.worker=null;if(this.busy){this.busy.done=true;this.busy.failed=true;}this.busy=null;this.resident.clear();}
}
