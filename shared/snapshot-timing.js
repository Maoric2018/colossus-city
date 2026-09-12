// Arrival jitter, not round-trip ping, determines the interpolation cushion.
// The first samples retain 100 ms. Stable arrivals gradually shorten it; spikes
// restore headroom quickly. A monotonic target prevents backward animation time.
export class SnapshotTiming{
 constructor(){this.delay=100;this.jitter=0;this.samples=0;this.lastArrival=null;this.lastTime=null;this.target=-Infinity;}
 receive(time,arrival){
  if(this.lastArrival!==null&&time>this.lastTime){const error=Math.abs(arrival-this.lastArrival-(time-this.lastTime)*1000);this.jitter=Math.max(error,this.jitter*.9);this.samples++;
   if(this.samples>=20){const desired=Math.min(150,Math.max(60,60+this.jitter*2));this.delay+=Math.max(-.75,Math.min(10,desired-this.delay));}
  }this.lastArrival=arrival;this.lastTime=time;
 }
 renderTime(latest,elapsed){this.target=Math.max(this.target,latest+Math.min(elapsed,.15)-this.delay/1000);return this.target;}
}
