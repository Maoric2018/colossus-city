import {cellBlock,blockKey} from './city/layout.js';

const same=(a,b)=>a===b||(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]));
const changes=new WeakMap();
// Histories advance only with reliable messages, never interpolated poses. Peers
// at the same baseline share the delta object and its eventual wire encoding.
export class ShardDeltas{
 constructor(limit=65536){this.limit=limit;this.shards=new Map();}
 set(meta,revision=0){this.shards.delete(meta.id);this.shards.set(meta.id,{meta,revision});if(this.shards.size>this.limit)this.shards.delete(this.shards.keys().next().value);}
 seed(welcome){this.shards.clear();for(const e of welcome.shards||[])this.set({...e});for(const block of welcome.blocks||[])for(const e of block.shards||[])this.set({...e});}
 observe(event){
  if(event.type==='reset')this.shards.clear();
  if(event.type==='remove')this.shards.delete(event.id);
  if(event.type==='block-load'||event.type==='block-unload'){
   for(const [id,{meta}]of this.shards){const block=cellBlock(meta.cell);if(block&&blockKey(...block)===event.key)this.shards.delete(id);}
   for(const e of event.shards||[])this.set({...e});
  }
 }
 pack(events){return events.map(event=>{
  this.observe(event);if(event.type!=='shards')return event;
  const old=this.shards.get(event.id);
  if(!old||Object.keys(old.meta).some(k=>!(k in event))){this.set(event);return event;}
  let bases=changes.get(event);if(!bases)changes.set(event,bases=new WeakMap());
  let delta=bases.get(old.meta);
  if(!delta||delta.base!==old.revision){delta={type:'shard-delta',id:event.id,base:old.revision};for(const key of Object.keys(event))if(key!=='type'&&key!=='id'&&!same(event[key],old.meta[key]))delta[key]=event[key];bases.set(old.meta,delta);}
  this.set(event,old.revision+1);return delta;
 });}
 unpack(events,onMissing){const out=[];for(const event of events){
  this.observe(event);
  if(event.type==='shard-delta'){
   const old=this.shards.get(event.id);if(!old||old.revision!==event.base){onMissing?.(event.id);continue;}
   const {base,type,...fields}=event,meta={...old.meta,...fields,type:'shards'};this.set({...meta},base+1);out.push(meta);
  }else{if(event.type==='shards')this.set({...event});out.push(event);}
 }return out;}
}
