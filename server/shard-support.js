// Resting fragments subscribe to their actual supporting collider. Changes wake
// only its dependents; the permanent ground plane needs no recurring checks.
export class ShardSupport{
 constructor(){this.byCollider=new Map();this.byShard=new Map();this.dirty=new Set();}
 watch(id,handle){this.remove(id);if(handle==null)return;let ids=this.byCollider.get(handle);if(!ids)this.byCollider.set(handle,ids=new Set());ids.add(id);this.byShard.set(id,handle);}
 remove(id){this.dirty.delete(id);const handle=this.byShard.get(id);if(handle===undefined)return;const ids=this.byCollider.get(handle);ids.delete(id);if(!ids.size)this.byCollider.delete(handle);this.byShard.delete(id);}
 invalidate(handle){const ids=this.byCollider.get(handle);if(!ids)return;for(const id of ids){this.byShard.delete(id);this.dirty.add(id);}this.byCollider.delete(handle);}
 take(limit=128){const out=[];for(const id of this.dirty){this.dirty.delete(id);out.push(id);if(out.length>=limit)break;}return out;}
}
