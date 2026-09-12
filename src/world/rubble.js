// Client-side cosmetic rubble: bricks, stone blocks, concrete chunks, glass shards and steel
// splinters. Purely visual, never replicated, bounded per tier. One instanced draw call per kind.
import * as T from 'three';
import {markRange} from '../render/instances.js';
import {seeded} from '../../shared/math.js';
const KINDS = {
 brick:    {geometry:() => new T.BoxGeometry(.32, .14, .16), color:0x9a5a48, gravity:-14, bounce:.25, life:[3.5, 5.5], count:1},
 stone:    {geometry:() => new T.BoxGeometry(.7, .42, .5),  color:0xd3c5a4, gravity:-13, bounce:.18, life:[4, 6], count:.6},
 concrete: {geometry:() => new T.BoxGeometry(.55, .3, .45), color:0xb0aca2, gravity:-13, bounce:.2, life:[4, 6], count:.8},
 glass:    {geometry:() => new T.PlaneGeometry(.42, .42), color:0xbfe6f6, gravity:-11, bounce:.05, life:[1.6, 2.6], count:1.4, glass:true},
 steel:    {geometry:() => new T.BoxGeometry(.18, 1.4, .18), color:0x3b464e, gravity:-12, bounce:.15, life:[4, 6], count:.35}
};
const dummy = new T.Object3D(), zero = new T.Matrix4().makeScale(0, 0, 0), axis = new T.Vector3(), spinQ = new T.Quaternion();
class Pool {
 constructor(scene, kind, limit, spec, tier){
  this.spec = spec; this.limit = limit; this.items = []; this.cursor = 0;
  const material = spec.glass ? new T.MeshStandardMaterial({color:spec.color, metalness:.9, roughness:.12, transparent:true, opacity:.65, side:T.DoubleSide, depthWrite:false})
   : tier.lambert ? new T.MeshLambertMaterial({color:spec.color}) : new T.MeshStandardMaterial({color:spec.color, roughness:.85, metalness:kind === 'steel' ? .7 : .05});
  this.mesh = new T.InstancedMesh(spec.geometry(), material, limit); this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = !tier.lambert;
  for(let i = 0; i < limit; i++) this.mesh.setMatrixAt(i, zero);
  this.mesh.count = 0; scene.add(this.mesh);
 }
 // Live items are kept compact at the front of the array; the oldest piece is recycled when full.
 spawn(p, v, scale){
  const spec = this.spec; let item;
  if(this.items.length < this.limit){ item = {p:new T.Vector3(), v:new T.Vector3(), axis:new T.Vector3(), q:new T.Quaternion()}; this.items.push(item); }
  else item = this.items[this.cursor++ % this.limit];
  item.p.copy(p); item.v.copy(v); item.axis.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); item.spin = 2 + Math.random() * 9; item.q.random();
  item.age = 0; item.life = spec.life[0] + Math.random() * (spec.life[1] - spec.life[0]); item.scale = scale; item.rest = false; item.dead = false;
 }
 update(dt){
  const spec = this.spec, m = this.mesh; let live = 0, changed = false,drawCount=0;
  for(let i = 0; i < this.items.length; i++){
   const it = this.items[i];
   if(it.dead) continue;
   it.age += dt;
   if(it.age >= it.life){ it.dead = true; m.setMatrixAt(i, zero); changed = true; continue; }
   drawCount=i+1;
   if(!it.rest){
    it.v.y += spec.gravity * dt; it.p.addScaledVector(it.v, dt);
    const floor = .1 * it.scale;
    if(it.p.y < floor){ it.p.y = floor; it.v.y = -it.v.y * spec.bounce; it.v.x *= .6; it.v.z *= .6; it.spin *= .5; if(Math.abs(it.v.y) < .8 && it.v.lengthSq() < 1.2){ it.rest = true; it.v.set(0, 0, 0); } }
    axis.copy(it.axis); spinQ.setFromAxisAngle(axis, it.spin * dt); it.q.multiply(spinQ);
   }else if(it.life - it.age > .6) { live++; continue; } // resting and not fading: matrix already correct
   const fade = it.life - it.age < .6 ? (it.life - it.age) / .6 : 1;
   dummy.position.copy(it.p); dummy.quaternion.copy(it.q); dummy.scale.setScalar(it.scale * fade); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); live++; changed = true;
  }
  m.count=drawCount;m.visible=drawCount>0;if(changed&&drawCount){markRange(m.instanceMatrix,0,drawCount);m.instanceMatrix.needsUpdate=true;}
  if(!live && this.items.length){ this.items.length = 0; this.cursor = 0; }
  return live;
 }
}
export class Rubble {
 constructor(scene, tier){
  this.pools = {}; const budget = tier.rubble;
  for(const [kind, spec] of Object.entries(KINDS)) this.pools[kind] = new Pool(scene, kind, Math.max(24, Math.round(budget * spec.count / 4.2)), spec, tier);
  this.rand = seeded(4242);
 }
 // Burst `n` pieces of `kind` from a point with a base velocity and random spread.
 burst(kind, p, n, {velocity = [0, 0, 0], spread = 6, up = 4, scale = 1} = {}){
  const pool = this.pools[kind] || this.pools.concrete, rand = this.rand, pos = new T.Vector3(...p), vel = new T.Vector3();
  for(let i = 0; i < n; i++){
   vel.set((rand() - .5) * 2 * spread + velocity[0], rand() * up + velocity[1] + 1, (rand() - .5) * 2 * spread + velocity[2]);
   pos.set(p[0] + (rand() - .5) * 2.5, p[1] + (rand() - .5) * 2, p[2] + (rand() - .5) * 2.5);
   pool.spawn(pos, vel, scale * (.7 + rand() * .7));
  }
 }
 // Rubble for one destroyed bay (crumble). Material decides the mix.
 bay(material, p, velocity = [0, 0, 0], strength = 1){
  const n = Math.round(strength * 22);
  if(material === 'glass'){ this.burst('glass', p, n, {velocity, spread:5, up:3}); this.burst('steel', p, Math.round(n * .3), {velocity, spread:4, up:3}); }
  else { this.burst(material, p, n, {velocity, spread:5, up:4}); this.burst('glass', p, Math.round(n * .3), {velocity, spread:4}); this.burst('steel', p, Math.round(n * .15), {velocity, spread:3}); }
 }
 update(dt){ let live = 0; for(const pool of Object.values(this.pools)) live += pool.update(dt); this.live = live; }
}
