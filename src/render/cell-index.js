// Horizontal broad phase only; callers retain their exact distance/frustum tests.
export class CellIndex{
 constructor(size=70){this.size=size;this.buckets=new Map();this.entries=new Map();}
 set(id,x,z){const key=`${Math.floor(x/this.size)},${Math.floor(z/this.size)}`;if(this.entries.get(id)===key)return;this.delete(id);let bucket=this.buckets.get(key);if(!bucket)this.buckets.set(key,bucket=new Set());bucket.add(id);this.entries.set(id,key);}
 delete(id){const key=this.entries.get(id),bucket=this.buckets.get(key);bucket?.delete(id);if(bucket&&!bucket.size)this.buckets.delete(key);this.entries.delete(id);}
 addNear(out,x,z,radius){for(let iz=Math.floor((z-radius)/this.size);iz<=Math.floor((z+radius)/this.size);iz++)for(let ix=Math.floor((x-radius)/this.size);ix<=Math.floor((x+radius)/this.size);ix++)for(const id of this.buckets.get(`${ix},${iz}`)||[])out.add(id);return out;}
}
