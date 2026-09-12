// Indexed min-heap: rescheduling/unloading removes the old entry immediately.
// In particular, repeated support changes cannot accumulate stale timers.
export class DeadlineQueue{
 constructor(){this.heap=[];this.indices=new Map();this.serial=0;}
 get size(){return this.heap.length;}
 swap(a,b){const h=this.heap;[h[a],h[b]]=[h[b],h[a]];this.indices.set(h[a].id,a);this.indices.set(h[b].id,b);}
 less(a,b){return a.time<b.time||(a.time===b.time&&a.order<b.order);}
 up(i){while(i){const p=(i-1)>>1;if(!this.less(this.heap[i],this.heap[p]))break;this.swap(i,p);i=p;}return i;}
 down(i){const h=this.heap;for(;;){let n=i,l=i*2+1,r=l+1;if(l<h.length&&this.less(h[l],h[n]))n=l;if(r<h.length&&this.less(h[r],h[n]))n=r;if(n===i)return;this.swap(i,n);i=n;}}
 set(id,time){this.delete(id);const i=this.heap.length;this.heap.push({id,time,order:this.serial++});this.indices.set(id,i);this.up(i);}
 delete(id){const i=this.indices.get(id);if(i===undefined)return;this.indices.delete(id);const last=this.heap.pop();if(i<this.heap.length){this.heap[i]=last;this.indices.set(last.id,i);this.down(this.up(i));}}
 due(time){const out=[];while(this.heap.length&&this.heap[0].time<=time){const e=this.heap[0];out.push(e);this.delete(e.id);}out.sort((a,b)=>a.order-b.order);return out;}
}
