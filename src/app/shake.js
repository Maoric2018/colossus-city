// Trauma-based camera shake for desktop views only. VR cameras are never shaken.
export class Shake {
 constructor(){ this.trauma = 0; this.time = 0; this.offset = {x:0, y:0, roll:0}; this.kick = 0; }
 add(amount){ this.trauma = Math.min(1, this.trauma + amount); }
 // Punchy directional recoil, decays quickly and is separate from the noisy trauma.
 recoil(amount){ this.kick = Math.min(.05, this.kick + amount); }
 update(dt){
  this.time += dt; this.trauma = Math.max(0, this.trauma - dt * 1.6); this.kick = Math.max(0, this.kick - dt * .35);
  const s = this.trauma * this.trauma, t = this.time * 31;
  this.offset.x = s * .05 * (Math.sin(t * 1.7) + Math.sin(t * .93 + 1.3) * .5);
  this.offset.y = s * .045 * (Math.sin(t * 1.3 + 2.1) + Math.sin(t * .77) * .5) + this.kick;
  this.offset.roll = s * .028 * Math.sin(t * 1.1 + .7);
  return this.offset;
 }
}
