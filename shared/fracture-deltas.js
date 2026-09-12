import {cellBlock,blockKey} from './city/layout.js';
const hash=ids=>{let h=2166136261;for(const id of ids)h=Math.imul(h^id,16777619);return h>>>0;};
const changes=new WeakMap();
// Optional reliable-stream encoding. Full events remain the recovery path and
// public game API. A bounded history prevents long sessions growing per-peer RAM.
export class FractureDeltas{
 constructor(){this.cells=new Map();}
 set(id,parts){this.cells.delete(id);this.cells.set(id,parts);if(this.cells.size>2048)this.cells.delete(this.cells.keys().next().value);}
 seed(welcome){this.cells.clear();for(const [id,parts]of welcome.fractures||[])this.set(id,parts);for(const block of welcome.blocks||[])for(const [id,parts]of block.fractures||[])this.set(id,parts);}
 observe(event){
  if(event.type==='reset')this.cells.clear();
  if(event.type==='block-load'||event.type==='block-unload'){
   for(const id of this.cells.keys()){const block=cellBlock(id);if(block&&blockKey(...block)===event.key)this.cells.delete(id);}
   for(const [id,parts]of event.fractures||[])this.set(id,parts);
  }
 }
 pack(events){return events.map(event=>{
  this.observe(event);if(event.type!=='fracture')return event;
  const old=this.cells.get(event.cell);this.set(event.cell,event.parts);
  if(!old?.length)return event;
  let bases=changes.get(event);if(!bases)changes.set(event,bases=new WeakMap());if(bases.has(old))return bases.get(old);
  const next=new Set(event.parts);if(old.some(id=>!next.has(id)))return event;
  const before=new Set(old),parts=event.parts.filter(id=>!before.has(id));
  if(parts.length+4>=event.parts.length)return event;
  const delta={type:'fracture-delta',cell:event.cell,base:old.length,hash:hash(old),parts};bases.set(old,delta);return delta;
 });}
 unpack(events,onMissing){const out=[];for(const event of events){
  this.observe(event);
  if(event.type==='fracture-delta'){
   const old=this.cells.get(event.cell);if(!old||old.length!==event.base||hash(old)!==event.hash){onMissing?.(event.cell);continue;}
   const parts=[...new Set([...old,...event.parts])].sort((a,b)=>a-b);this.set(event.cell,parts);out.push({type:'fracture',cell:event.cell,parts});
  }else{if(event.type==='fracture')this.set(event.cell,event.parts);out.push(event);}
 }return out;}
}
