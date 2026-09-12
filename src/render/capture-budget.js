// Spend at most roughly an eighth of frame time on optional spectator capture.
// Normal load retains the existing feed rate and resolution; pressure drops
// capture frames before it can delay tracked gameplay.
export class CaptureBudget{
 constructor(){this.cost=0;this.scale=1;}
 interval(maxFPS){return Math.max(1000/maxFPS,this.cost*8);}
 allow(workMS,frameMS){return !Number.isFinite(workMS)||workMS+this.cost<frameMS*.92;}
 record(cost,workMS,frameMS){this.cost=this.cost?this.cost*.8+cost*.2:cost;const target=Number.isFinite(workMS)&&workMS+this.cost>frameMS*.8?.7:1;this.scale+=(target-this.scale)*.1;}
}
