// Prepare immutable city data ahead of travel; scene/GPU ownership stays local.
// If workers are unavailable or a teleport outruns preparation, construction
// uses the existing synchronous path so collision and landmarks are never omitted.
export class BlockPreparation{
 constructor(interiors){this.interiors=interiors;this.entries=new Map();this.queue=[];this.serial=0;this.busy=null;
  if(typeof Worker==='function')try{this.worker=new Worker(new URL('./block-preparation-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const e=this.busy;if(e?.id===data.id){if(this.entries.get(e.env.key)===e)e.cells=data.cells;this.busy=null;this.next();}};this.worker.onerror=event=>{event.preventDefault();this.worker.terminate();this.worker=null;this.clear();};}catch{this.worker=null;}
 }
 prepare(env){if(!this.worker||this.entries.get(env.key)?.env===env)return;const e={env,id:++this.serial,cells:null};this.entries.set(env.key,e);this.queue.push(e);this.next();}
 next(){if(this.busy||!this.worker)return;while(this.queue.length){const e=this.queue.shift();if(this.entries.get(e.env.key)!==e)continue;this.busy=e;this.worker.postMessage({id:e.id,env:e.env,interiors:this.interiors});break;}}
 take(env){const e=this.entries.get(env.key);this.entries.delete(env.key);return e?.env===env?e.cells:null;}
 retain(keys){for(const key of this.entries.keys())if(!keys.has(key))this.entries.delete(key);this.queue=this.queue.filter(e=>this.entries.get(e.env.key)===e);}
 clear(){this.entries.clear();this.queue=[];}
 dispose(){this.worker?.terminate();this.worker=null;this.busy=null;this.clear();}
}
