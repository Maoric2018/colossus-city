import {cutAppearance} from '../render/fracture-geometry.js';
const sources=new Map();
self.onmessage=({data})=>{
 try{
  let source=sources.get(data.sourceId);sources.delete(data.sourceId);
  if(!source)source={...data.source,materials:new Map(data.source.materials)};
  sources.set(data.sourceId,source);if(sources.size>8)sources.delete(sources.keys().next().value);
  const transfers=[],results=data.pieces.map(ids=>cutAppearance(source,ids,data.skin,false).map(draw=>{
   const attributes=Object.fromEntries(Object.entries(draw.geometry.attributes).map(([name,a])=>{const array=a.array.slice();transfers.push(array.buffer);return [name,{array,itemSize:a.itemSize}];}));
   const index=draw.geometry.index?.array.slice();if(index)transfers.push(index.buffer);
   return {key:draw.key,section:draw.section,castShadow:draw.castShadow,attributes,index};
  }));
  self.postMessage({id:data.id,results},transfers);
 }catch(error){self.postMessage({id:data.id,error:error.message});}
};
self.postMessage({ready:true});
