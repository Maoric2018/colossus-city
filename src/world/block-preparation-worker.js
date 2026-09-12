import {generateCells} from '../../shared/city/cells.js';
import {componentPlacements} from '../../shared/city/components.js';
const cache=new Map();let bytes=0;
self.onmessage=({data:{id,env,interiors}})=>{
 try{
  const key=JSON.stringify([env.key,env.cellBase,env.seed,env.buildings,interiors]);let entry=cache.get(key),cells;
  if(entry){cache.delete(key);cache.set(key,entry);cells=JSON.parse(entry.json);}
  else{cells=generateCells(env);for(const c of cells)c.preparedComponents=componentPlacements(c,{interiors});const json=JSON.stringify(cells);entry={json,bytes:json.length*2};
   if(entry.bytes<=12*1024*1024){cache.set(key,entry);bytes+=entry.bytes;while(cache.size>12||bytes>12*1024*1024){const [old,e]=cache.entries().next().value;cache.delete(old);bytes-=e.bytes;}}
  }
  // Store bounded serialized templates rather than retaining a second object
  // graph. Main-thread construction cannot contaminate a later visit.
  self.postMessage({id,cells});
 }
 catch{self.postMessage({id,cells:null});}
};
