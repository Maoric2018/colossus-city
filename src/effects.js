import * as T from 'three';
import {markRange} from './render/instances.js';
import {SonicBursts} from './render/soar-vfx.js';
import {MissileExplosions} from './render/missile-explosion.js';
const MATERIAL_TINT = {glass:{dust:0xcfe9f2, spark:0xd8f6ff}, brick:{dust:0xa8705f, spark:0xffb27a}, stone:{dust:0xd6c8a6, spark:0xffd9a0}, concrete:{dust:0xb3b0a8, spark:0xffca76}, steel:{dust:0x8d9398, spark:0xffb040}, body:{dust:0x9aa3a6, spark:0xffe0b0}};
const dummy=new T.Object3D(),up=new T.Vector3(0,1,0);
class ParticlePool{
 constructor(scene,url,limit,additive=false){
  this.limit=limit;this.items=[];const geometry=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1));geometry.instanceCount=0;
  this.attributes={};for(const [name,size]of [['center',3],['tint',3],['lifeSize',2],['spin',1]]){const a=new T.InstancedBufferAttribute(new Float32Array(limit*size),size).setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a);this.attributes[name]=a;}
  const map=new T.TextureLoader().load(url);map.colorSpace=T.SRGBColorSpace;
  const material=new T.ShaderMaterial({uniforms:{spriteMap:{value:map}},transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending,
   vertexShader:`attribute vec3 center;attribute vec3 tint;attribute vec2 lifeSize;attribute float spin;varying vec2 vUV;varying vec3 vTint;varying float vAlpha;
    void main(){vUV=uv;vTint=tint;vAlpha=lifeSize.x;float c=cos(spin),s=sin(spin);vec2 corner=mat2(c,-s,s,c)*position.xy*lifeSize.y;vec4 view=modelViewMatrix*vec4(center,1.);view.xy+=corner*length(viewMatrix[0].xyz);gl_Position=projectionMatrix*view;}`,
   fragmentShader:`uniform sampler2D spriteMap;varying vec2 vUV;varying vec3 vTint;varying float vAlpha;void main(){vec4 tex=texture2D(spriteMap,vUV);float a=tex.a*vAlpha;if(a<.004)discard;gl_FragColor=vec4(tex.rgb*vTint,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  this.mesh=new T.Mesh(geometry,material);this.mesh.frustumCulled=false;this.mesh.renderOrder=additive?3:2;scene.add(this.mesh);
 }
 add(p){if(this.items.length>=this.limit)this.items.shift();this.items.push({...p,age:0,spin:Math.random()*Math.PI*2});}
 update(dt){
  if(!this.items.length){this.mesh.visible=false;return;}
  let n = 0; const a = this.attributes;
  for(let i = 0; i < this.items.length; i++){
   const p = this.items[i]; p.age += dt; if(p.age >= p.life) continue;
   p.v.y += p.gravity * dt; p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * p.drag)); if(p.p.y < .08){ p.p.y = .08; p.v.y = Math.abs(p.v.y) * .22; }
   const t = Math.min(1, p.age / p.life); a.center.setXYZ(n, p.p.x, p.p.y, p.p.z); a.tint.setXYZ(n, p.color.r, p.color.g, p.color.b); a.lifeSize.setXY(n, (1 - t) * Math.min(1, p.age / .055) * p.opacity, p.size * (1 + t * p.growth)); a.spin.setX(n, p.spin + t * .3);
   this.items[n++] = p;
  }
  this.items.length = n;this.mesh.visible=n>0;if(n)for(const attribute of Object.values(a)){markRange(attribute,0,n);attribute.needsUpdate=true;}this.mesh.geometry.instanceCount = n;
 }
}
export class Effects{
 constructor(scene,{quest=false,tier}={}){
  this.scene=scene;this.mobile=!!tier?.mobile;this.tracers=[];this.audio=null;const base='/assets/imported/effects/',k=tier?.particles??(quest?.45:1);this.flightParticleScale=k;
  this.smoke=new ParticlePool(scene,base+'smoke.png',Math.round(160*k));
  this.dust=new ParticlePool(scene,base+'dust.png',Math.round(120*k));
  this.sparks=new ParticlePool(scene,base+'spark.png',Math.round(160*k),true);
  this.flashes=new ParticlePool(scene,base+'muzzle.png',this.mobile?6:24,true);
  this.flares=new ParticlePool(scene,base+'flare.png',this.mobile?4:16,true);
  this.beams=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5),new T.MeshBasicMaterial({color:0xe9fbff,toneMapped:false}),48);this.beams.instanceMatrix.setUsage(T.DynamicDrawUsage);this.beams.count=0;this.beams.frustumCulled=false;scene.add(this.beams);
  const beamGeometry=this.beams.geometry;this.beamGlow=new T.InstancedMesh(beamGeometry,new T.MeshBasicMaterial({color:0x42bfff,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),48);this.bolts=new T.InstancedMesh(beamGeometry,new T.MeshBasicMaterial({color:0xb0f5ff,toneMapped:false}),48);
  this.sonicBursts=new SonicBursts(scene);this.booms=this.sonicBursts.items;this.boomMesh=this.sonicBursts.mesh;
  this.missileBlasts=new MissileExplosions(scene,{quest:quest||k<.7,mobile:this.mobile});this.missileParticleScale=k;this.ready=Promise.all([this.sonicBursts.ready,this.missileBlasts.ready]);
  this.rings=[];this.ringMesh=new T.InstancedMesh(new T.TorusGeometry(1,.045,4,24),new T.MeshBasicMaterial({color:0x7eeaff,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),24);
  for(const mesh of [this.beamGlow,this.bolts,this.ringMesh]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);}

 }
 unlockAudio(){if(this.audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC){this.audio=new AC();this.audio.resume();}}
 sound(freq,duration=.12,type='sine',volume=.06){
  if(!this.audio||this.audio.state!=='running')return;const c=this.audio,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(22,freq*.2),c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration);
 }
 particle(pool,p,options={}){pool.add({p:new T.Vector3(...p),v:new T.Vector3(),life:1,size:1,color:new T.Color(0xffffff),gravity:0,drag:.5,growth:0,opacity:1,...options});}
 impact(p, power = .5, material = 'concrete'){
  power = Math.min(2, Math.max(.1, power)); const n = Math.max(2,Math.floor((8 + power * 14)*(this.mobile?.12:1))), tint = MATERIAL_TINT[material] || MATERIAL_TINT.concrete;
  for(let i = 0; i < n; i++){
   const angle = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 8 * power;
   this.particle(i % 2 ? this.smoke : this.dust, p, {v:new T.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 5, Math.sin(angle) * speed), life:1.6 + Math.random() * 1.7, size:(1.3 + Math.random() * 2) * power, color:new T.Color(i % 2 ? 0x858985 : tint.dust), gravity:.7, drag:1.1, growth:2.4, opacity:.55});
   if(i % 2) this.particle(this.sparks, p, {v:new T.Vector3(Math.cos(angle) * speed * 1.7, Math.random() * 12, Math.sin(angle) * speed * 1.7), life:.35 + Math.random() * .7, size:.2 + Math.random() * .4, color:new T.Color(tint.spark), gravity:-13, drag:.1, opacity:1});
  }
  this.particle(this.flares, p, {life:.25, size:5 * power, color:new T.Color(material === 'glass' ? 0xbfe9ff : 0xffc989), growth:2});
 }
 sonicBoom(p,direction){
  this.sonicBursts.add(p,direction);this.flightBurst(p,direction,false);
 }
 soarBreach(p,direction){
  this.sonicBursts.add(p,direction,{breach:true});this.flightBurst(p,direction,true);
 }
 flightBurst(p,direction,breach){
  const forward=new T.Vector3(...direction);if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
  const side=new T.Vector3().crossVectors(forward,Math.abs(forward.y)>.95?new T.Vector3(1,0,0):up).normalize(),vertical=new T.Vector3().crossVectors(side,forward);
  const center=new T.Vector3(...p).addScaledVector(forward,breach?0:2),n=Math.max(this.mobile?2:6,Math.round((breach?16:12)*this.flightParticleScale));
  for(let i=0;i<n;i++){
   const angle=i/n*Math.PI*2,radial=side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(vertical,Math.sin(angle));
   const at=center.clone().addScaledVector(radial,(breach?2.1:1.1)+Math.random()*.3).toArray();
   // The clear center follows the breach opening; fragments and mist move
   // outward at its rim, so the pilot flies through rather than into a fog card.
   this.particle(breach?this.dust:this.smoke,at,{v:radial.clone().multiplyScalar(breach?9:7).addScaledVector(forward,breach?3:0),life:breach?.55+Math.random()*.4:.45+Math.random()*.25,size:breach?.55+Math.random()*.55:.35+Math.random()*.25,color:new T.Color(breach?(i%2?0xb9b0a0:0xc5d9e3):0xdaf3ff),gravity:breach?-1.8:.2,drag:1.8,growth:breach?1.5:1.2,opacity:breach?.46:.3});
   if(breach)this.particle(this.sparks,at,{v:radial.clone().multiplyScalar(12+Math.random()*7).addScaledVector(forward,4),life:.25+Math.random()*.3,size:.12+Math.random()*.16,color:new T.Color(i%3?0xc6eeff:0xffcf8e),gravity:-5,drag:.7,opacity:.9});
  }
 }
 missileExplosion(p){
  this.missileBlasts.add(p);
  this.particle(this.flares,p,{life:.2,size:19,color:new T.Color(0xffd49a),growth:.8});
  const n=Math.max(this.mobile?3:14,Math.round(32*this.missileParticleScale));
  for(let i=0;i<n;i++){
   const direction=new T.Vector3().randomDirection(),speed=13+Math.random()*18;
   this.particle(this.sparks,p,{v:direction.clone().multiplyScalar(speed),life:.5+Math.random()*.65,size:.22+Math.random()*.3,color:new T.Color(i%3?0xffb24a:0xffefd1),gravity:-12,drag:1.1});
   if(i%2===0)this.particle(this.smoke,p,{v:direction.multiplyScalar(3+Math.random()*5).add(new T.Vector3(0,3,0)),life:1.7+Math.random()*1.1,size:2.1+Math.random()*1.2,color:new T.Color(i%4?0x41454b:0x6b6560),gravity:.65,drag:1.2,growth:1.7,opacity:.6});
  }
  // Ground impacts kick out dust; airbursts keep their spherical silhouette.
  if(p[1]<5)for(let i=0;i<(this.mobile?2:8);i++){
   const angle=i/8*Math.PI*2;
   this.particle(this.dust,[p[0],.4,p[2]],{v:new T.Vector3(Math.cos(angle)*13,.8,Math.sin(angle)*13),life:1.2+Math.random()*.5,size:1.6,color:new T.Color(0x91867a),drag:1.7,growth:2.4,opacity:.4});
  }
 }
 carExplosion(p){
  this.impact(p,1.2,'steel');
  for(let i=0;i<(this.mobile?2:7);i++)this.particle(this.flashes,p,{v:new T.Vector3((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*5),life:.25+Math.random()*.25,size:2+Math.random()*2,color:new T.Color(i%2?0xff7424:0xffd470),growth:1.7});
  for(let i=0;i<(this.mobile?2:8);i++)this.particle(this.smoke,p,{v:new T.Vector3((Math.random()-.5)*4,2+Math.random()*4,(Math.random()-.5)*4),life:2+Math.random(),size:1.5,color:new T.Color(0x24292c),growth:3,opacity:.75});
 }
 reactorExplosion(p,power=1){
  // Downloaded muzzle/fire, smoke and spark sprites, shared with the existing
  // bounded pools so the finale adds no extra render passes or physics bodies.
  for(let i=0;i<(this.mobile?2:6);i++)this.particle(this.flashes,p,{reactor:true,v:new T.Vector3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.35+Math.random()*.35,size:(2+Math.random()*2)*power,color:new T.Color(i%2?0xff721f:0xffce79),growth:1.5});
  for(let i=0;i<(this.mobile?2:7);i++)this.particle(this.smoke,p,{reactor:true,v:new T.Vector3((Math.random()-.5)*6,2+Math.random()*5,(Math.random()-.5)*6),life:2.2+Math.random(),size:power*1.3,color:new T.Color(0x353a3e),growth:2,opacity:.55});
  for(let i=0;i<(this.mobile?3:14);i++){const angle=Math.random()*Math.PI*2;this.particle(this.sparks,p,{reactor:true,v:new T.Vector3(Math.cos(angle)*(5+power*7),3+Math.random()*13,Math.sin(angle)*(5+power*7)),life:.6+Math.random(),size:.22+Math.random()*.25,color:new T.Color(0xffb44e),gravity:-18,drag:.2});}
  this.particle(this.flares,p,{reactor:true,life:.3,size:6*power,color:new T.Color(0xffba69),growth:1.6});
 }
 clearReactor(){for(const pool of [this.smoke,this.dust,this.sparks,this.flashes,this.flares])pool.items=pool.items.filter(p=>!p.reactor);}
 // Low rolling dust ring for collapses and stomps. (this.dust is the pool; hence the name.)
 dustRing(p, power = .5){
  const n = Math.max(2,Math.floor((10 + power * 18)*(this.mobile?.12:1)));
  for(let i = 0; i < n; i++){ const angle = i / n * Math.PI * 2, speed = 4 + Math.random() * 10 * power; this.particle(this.dust, p, {v:new T.Vector3(Math.cos(angle) * speed, .5 + Math.random() * 2, Math.sin(angle) * speed), life:2 + Math.random() * 2, size:(2 + Math.random() * 3) * power, color:new T.Color(0xb9b4a6), gravity:.2, drag:1.4, growth:2.8, opacity:.45}); }
 }
 shot(e,color=0x68dfff){
  if(this.tracers.length>=(this.mobile?12:48))this.tracers.shift();const a=new T.Vector3(...e.from),b=new T.Vector3(...e.to);this.tracers.push({a,b,age:0});
  this.particle(this.flashes,e.from,{life:.12,size:.6,color:new T.Color(color),growth:1.5});
  this.particle(this.flares,e.from,{life:.08,size:.42,color:new T.Color(0xe1faff),growth:1});
  if(e.impact||e.hit){const normal=new T.Vector3(...(e.normal||[0,1,0])),at=b.clone().addScaledVector(normal,.08).toArray();
   this.particle(this.flares,at,{life:.22,size:e.weak?2:1.15,color:new T.Color(e.weak?0xffd183:color),growth:1.7});
   for(let i=0;i<(this.mobile?2:8);i++)this.particle(this.sparks,at,{v:normal.clone().multiplyScalar(2+Math.random()*4).add(new T.Vector3((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5)),life:.25+Math.random()*.3,size:.12+Math.random()*.16,color:new T.Color(i%2?color:0xffffff),gravity:-5});
   this.particle(this.smoke,at,{v:normal.clone().multiplyScalar(.8),life:.45,size:.3,color:new T.Color(0x789eae),growth:1.5,opacity:.35});
   if(this.rings.length>=24)this.rings.shift();this.rings.push({p:new T.Vector3(...at),q:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),normal),age:0});
  }
 }
 update(dt){
  this.sonicBursts.update(dt);
  this.missileBlasts.update(dt);
  for(const pool of [this.smoke,this.dust,this.sparks,this.flashes,this.flares])pool.update(dt);
  this.tracers=this.tracers.filter(t=>t.age<.2);this.tracers.forEach((t,i)=>{
   t.age+=dt;const distance=t.a.distanceTo(t.b),direction=t.b.clone().sub(t.a).normalize(),fade=Math.max(0,1-t.age/.2);
   dummy.position.copy(t.a).lerp(t.b,.5);dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(.026*fade,distance,.026*fade);dummy.updateMatrix();this.beams.setMatrixAt(i,dummy.matrix);
   dummy.scale.set(.115*fade,distance,.115*fade);dummy.updateMatrix();this.beamGlow.setMatrixAt(i,dummy.matrix);
   const front=Math.min(distance,t.age*330),length=Math.min(front,7);dummy.position.copy(t.a).addScaledVector(direction,front-length/2);dummy.scale.set(.065*fade,length,.065*fade);dummy.updateMatrix();this.bolts.setMatrixAt(i,dummy.matrix);
  });for(const mesh of [this.beams,this.beamGlow,this.bolts]){mesh.count=this.tracers.length;mesh.visible=mesh.count>0;if(mesh.count){markRange(mesh.instanceMatrix,0,mesh.count);mesh.instanceMatrix.needsUpdate=true;}}
  this.rings=this.rings.filter(r=>r.age<.28);this.rings.forEach((r,i)=>{r.age+=dt;const t=r.age/.28;dummy.position.copy(r.p);dummy.quaternion.copy(r.q);dummy.scale.setScalar((.12+t*.8)*Math.max(0,1-t));dummy.updateMatrix();this.ringMesh.setMatrixAt(i,dummy.matrix);});this.ringMesh.count=this.rings.length;this.ringMesh.visible=this.rings.length>0;if(this.rings.length){markRange(this.ringMesh.instanceMatrix,0,this.rings.length);this.ringMesh.instanceMatrix.needsUpdate=true;}
 }
}
