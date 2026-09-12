import * as T from 'three';
// Sprite particle pools (smoke, dust, sparks, flashes, flares) and instanced tracer beams.
// Pool sizes follow the quality tier; the pools are purely cosmetic.
const dummy = new T.Object3D(), up = new T.Vector3(0, 1, 0);
const MATERIAL_TINT = {glass:{dust:0xcfe9f2, spark:0xd8f6ff}, brick:{dust:0xa8705f, spark:0xffb27a}, stone:{dust:0xd6c8a6, spark:0xffd9a0}, concrete:{dust:0xb3b0a8, spark:0xffca76}, steel:{dust:0x8d9398, spark:0xffb040}, body:{dust:0x9aa3a6, spark:0xffe0b0}};
class ParticlePool {
 constructor(scene, url, limit, additive = false){
  this.limit = limit; this.items = []; const geometry = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1)); geometry.instanceCount = 0;
  this.attributes = {}; for(const [name, size] of [['center', 3], ['tint', 3], ['lifeSize', 2], ['spin', 1]]){ const a = new T.InstancedBufferAttribute(new Float32Array(limit * size), size).setUsage(T.DynamicDrawUsage); geometry.setAttribute(name, a); this.attributes[name] = a; }
  const map = new T.TextureLoader().load(url); map.colorSpace = T.SRGBColorSpace;
  const material = new T.ShaderMaterial({uniforms:{spriteMap:{value:map}}, transparent:true, depthWrite:false, blending:additive ? T.AdditiveBlending : T.NormalBlending,
   vertexShader:`attribute vec3 center;attribute vec3 tint;attribute vec2 lifeSize;attribute float spin;varying vec2 vUV;varying vec3 vTint;varying float vAlpha;
    void main(){vUV=uv;vTint=tint;vAlpha=lifeSize.x;float c=cos(spin),s=sin(spin);vec2 corner=mat2(c,-s,s,c)*position.xy*lifeSize.y;vec4 view=modelViewMatrix*vec4(center,1.);view.xy+=corner*length(viewMatrix[0].xyz);gl_Position=projectionMatrix*view;}`,
   fragmentShader:`uniform sampler2D spriteMap;varying vec2 vUV;varying vec3 vTint;varying float vAlpha;void main(){vec4 tex=texture2D(spriteMap,vUV);float a=tex.a*vAlpha;if(a<.004)discard;gl_FragColor=vec4(tex.rgb*vTint,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include', ';\n#include')});
  this.mesh = new T.Mesh(geometry, material); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2; scene.add(this.mesh);
 }
 add(p){ if(this.items.length >= this.limit) this.items.shift(); this.items.push({...p, age:0, spin:Math.random() * Math.PI * 2}); }
 update(dt){
  let n = 0; const a = this.attributes;
  for(let i = 0; i < this.items.length; i++){
   const p = this.items[i]; p.age += dt; if(p.age >= p.life) continue;
   p.v.y += p.gravity * dt; p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * p.drag)); if(p.p.y < .08){ p.p.y = .08; p.v.y = Math.abs(p.v.y) * .22; }
   const t = Math.min(1, p.age / p.life); a.center.setXYZ(n, p.p.x, p.p.y, p.p.z); a.tint.setXYZ(n, p.color.r, p.color.g, p.color.b); a.lifeSize.setXY(n, (1 - t) * Math.min(1, p.age / .055) * p.opacity, p.size * (1 + t * p.growth)); a.spin.setX(n, p.spin + t * .3);
   this.items[n++] = p;
  }
  this.items.length = n; for(const attribute of Object.values(a)) attribute.needsUpdate = true; this.mesh.geometry.instanceCount = n;
 }
}
export class Effects {
 constructor(scene, {tier, quest = false} = {}){
  this.scene = scene; this.tracers = []; const base = '/assets/imported/effects/', k = tier?.particles ?? (quest ? .45 : 1);
  this.smoke = new ParticlePool(scene, base + 'smoke.png', Math.round(160 * k));
  this.dust = new ParticlePool(scene, base + 'dust.png', Math.round(120 * k));
  this.sparks = new ParticlePool(scene, base + 'spark.png', Math.round(160 * k), true);
  this.flashes = new ParticlePool(scene, base + 'muzzle.png', 24, true);
  this.flares = new ParticlePool(scene, base + 'flare.png', 20, true);
  this.beams = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 5), new T.MeshBasicMaterial({color:0xd8ffb5, toneMapped:false}), 48); this.beams.instanceMatrix.setUsage(T.DynamicDrawUsage); this.beams.count = 0; this.beams.frustumCulled = false; scene.add(this.beams);
 }
 particle(pool, p, options = {}){ pool.add({p:new T.Vector3(...p), v:new T.Vector3(), life:1, size:1, color:new T.Color(0xffffff), gravity:0, drag:.5, growth:0, opacity:1, ...options}); }
 impact(p, power = .5, material = 'concrete'){
  power = Math.min(2, Math.max(.1, power)); const n = Math.floor(8 + power * 14), tint = MATERIAL_TINT[material] || MATERIAL_TINT.concrete;
  for(let i = 0; i < n; i++){
   const angle = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 8 * power;
   this.particle(i % 2 ? this.smoke : this.dust, p, {v:new T.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 5, Math.sin(angle) * speed), life:1.6 + Math.random() * 1.7, size:(1.3 + Math.random() * 2) * power, color:new T.Color(i % 2 ? 0x858985 : tint.dust), gravity:.7, drag:1.1, growth:2.4, opacity:.55});
   if(i % 2) this.particle(this.sparks, p, {v:new T.Vector3(Math.cos(angle) * speed * 1.7, Math.random() * 12, Math.sin(angle) * speed * 1.7), life:.35 + Math.random() * .7, size:.2 + Math.random() * .4, color:new T.Color(tint.spark), gravity:-13, drag:.1, opacity:1});
  }
  this.particle(this.flares, p, {life:.25, size:5 * power, color:new T.Color(material === 'glass' ? 0xbfe9ff : 0xffc989), growth:2});
 }
 // Low rolling dust ring for collapses and stomps. (this.dust is the pool; hence the name.)
 dustRing(p, power = .5){
  const n = Math.floor(10 + power * 18);
  for(let i = 0; i < n; i++){ const angle = i / n * Math.PI * 2, speed = 4 + Math.random() * 10 * power; this.particle(this.dust, p, {v:new T.Vector3(Math.cos(angle) * speed, .5 + Math.random() * 2, Math.sin(angle) * speed), life:2 + Math.random() * 2, size:(2 + Math.random() * 3) * power, color:new T.Color(0xb9b4a6), gravity:.2, drag:1.4, growth:2.8, opacity:.45}); }
 }
 shot(e, color = 0xcfffad){
  if(this.tracers.length >= 48) this.tracers.shift(); const a = new T.Vector3(...e.from), b = new T.Vector3(...e.to); this.tracers.push({a, b, age:0, width:color === 0xcfffad ? .035 : .11});
  this.particle(this.flashes, e.from, {life:.09, size:.75, color:new T.Color(color), growth:.8});
  if(e.hit){ this.particle(this.flares, e.to, {life:.14, size:1.7, color:new T.Color(color)}); for(let i = 0; i < 3; i++) this.particle(this.sparks, e.to, {v:new T.Vector3((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5), life:.3, size:.22, color:new T.Color(0xffe2ab), gravity:-9}); }
 }
 update(dt){
  for(const pool of [this.smoke, this.dust, this.sparks, this.flashes, this.flares]) pool.update(dt);
  let n = 0;
  for(const t of this.tracers){ t.age += dt; if(t.age >= .115) continue; dummy.position.copy(t.a).lerp(t.b, .5); dummy.quaternion.setFromUnitVectors(up, t.b.clone().sub(t.a).normalize()); const width = t.width * Math.max(0, 1 - t.age / .12); dummy.scale.set(width, t.a.distanceTo(t.b), width); dummy.updateMatrix(); this.beams.setMatrixAt(n, dummy.matrix); this.tracers[n++] = t; }
  this.tracers.length = n; this.beams.count = n; this.beams.instanceMatrix.needsUpdate = true;
 }
}
