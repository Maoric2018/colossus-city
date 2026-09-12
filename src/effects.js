import * as T from 'three';
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
  this.items=this.items.filter(p=>p.age<p.life);const a=this.attributes;
  this.items.forEach((p,i)=>{p.age+=dt;p.v.y+=p.gravity*dt;p.p.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.exp(-dt*p.drag));if(p.p.y<.08){p.p.y=.08;p.v.y=Math.abs(p.v.y)*.22;}
   const t=Math.min(1,p.age/p.life);a.center.setXYZ(i,p.p.x,p.p.y,p.p.z);a.tint.setXYZ(i,p.color.r,p.color.g,p.color.b);a.lifeSize.setXY(i,(1-t)*Math.min(1,p.age/.055)*p.opacity,p.size*(1+t*p.growth));a.spin.setX(i,p.spin+t*.3);
  });for(const attribute of Object.values(a))attribute.needsUpdate=true;this.mesh.geometry.instanceCount=this.items.length;
 }
}
export class Effects{
 constructor(scene,{quest=false}={}){
  this.scene=scene;this.tracers=[];this.audio=null;const base='/assets/imported/effects/';
  this.smoke=new ParticlePool(scene,base+'smoke.png',quest?64:130);
  this.dust=new ParticlePool(scene,base+'dust.png',quest?44:90);
  this.sparks=new ParticlePool(scene,base+'spark.png',quest?70:140,true);
  this.flashes=new ParticlePool(scene,base+'muzzle.png',24,true);
  this.flares=new ParticlePool(scene,base+'flare.png',16,true);
  this.beams=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5),new T.MeshBasicMaterial({color:0xe9fbff,toneMapped:false}),48);this.beams.instanceMatrix.setUsage(T.DynamicDrawUsage);this.beams.count=0;this.beams.frustumCulled=false;scene.add(this.beams);
  const beamGeometry=this.beams.geometry;this.beamGlow=new T.InstancedMesh(beamGeometry,new T.MeshBasicMaterial({color:0x42bfff,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),48);this.bolts=new T.InstancedMesh(beamGeometry,new T.MeshBasicMaterial({color:0xb0f5ff,toneMapped:false}),48);
  this.rings=[];this.ringMesh=new T.InstancedMesh(new T.TorusGeometry(1,.045,4,24),new T.MeshBasicMaterial({color:0x7eeaff,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),24);
  for(const mesh of [this.beamGlow,this.bolts,this.ringMesh]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);}

 }
 unlockAudio(){if(this.audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC){this.audio=new AC();this.audio.resume();}}
 sound(freq,duration=.12,type='sine',volume=.06){
  if(!this.audio||this.audio.state!=='running')return;const c=this.audio,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(22,freq*.2),c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration);
 }
 particle(pool,p,options={}){pool.add({p:new T.Vector3(...p),v:new T.Vector3(),life:1,size:1,color:new T.Color(0xffffff),gravity:0,drag:.5,growth:0,opacity:1,...options});}
 impact(p,power=.5){
  power=Math.min(2,Math.max(.1,power));const n=Math.floor(12+power*16);
  for(let i=0;i<n;i++){
   const angle=Math.random()*Math.PI*2,speed=2+Math.random()*8*power;
   this.particle(i%2?this.smoke:this.dust,p,{v:new T.Vector3(Math.cos(angle)*speed,1+Math.random()*5,Math.sin(angle)*speed),life:1.6+Math.random()*1.7,size:(1.3+Math.random()*2)*power,color:new T.Color(i%2?0x858985:0xc3b6a0),gravity:.7,drag:1.1,growth:2.4,opacity:.55});
   this.particle(this.sparks,p,{v:new T.Vector3(Math.cos(angle)*speed*1.7,Math.random()*12,Math.sin(angle)*speed*1.7),life:.35+Math.random()*.7,size:.2+Math.random()*.4,color:new T.Color(0xffca76),gravity:-13,drag:.1,opacity:1});
  }
  this.particle(this.flares,p,{life:.25,size:5*power,color:new T.Color(0xffc989),growth:2});this.sound(75,.4,'triangle',power*.1);
 }
 shot(e,color=0x68dfff){
  if(this.tracers.length>=48)this.tracers.shift();const a=new T.Vector3(...e.from),b=new T.Vector3(...e.to);this.tracers.push({a,b,age:0});
  this.particle(this.flashes,e.from,{life:.12,size:.6,color:new T.Color(color),growth:1.5});
  this.particle(this.flares,e.from,{life:.08,size:.42,color:new T.Color(0xe1faff),growth:1});
  if(e.impact||e.hit){const normal=new T.Vector3(...(e.normal||[0,1,0])),at=b.clone().addScaledVector(normal,.08).toArray();
   this.particle(this.flares,at,{life:.22,size:e.weak?2:1.15,color:new T.Color(e.weak?0xffd183:color),growth:1.7});
   for(let i=0;i<8;i++)this.particle(this.sparks,at,{v:normal.clone().multiplyScalar(2+Math.random()*4).add(new T.Vector3((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5)),life:.25+Math.random()*.3,size:.12+Math.random()*.16,color:new T.Color(i%2?color:0xffffff),gravity:-5});
   this.particle(this.smoke,at,{v:normal.clone().multiplyScalar(.8),life:.45,size:.3,color:new T.Color(0x789eae),growth:1.5,opacity:.35});
   if(this.rings.length>=24)this.rings.shift();this.rings.push({p:new T.Vector3(...at),q:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),normal),age:0});
  }
 }
 update(dt){
  for(const pool of [this.smoke,this.dust,this.sparks,this.flashes,this.flares])pool.update(dt);
  this.tracers=this.tracers.filter(t=>t.age<.2);this.tracers.forEach((t,i)=>{
   t.age+=dt;const distance=t.a.distanceTo(t.b),direction=t.b.clone().sub(t.a).normalize(),fade=Math.max(0,1-t.age/.2);
   dummy.position.copy(t.a).lerp(t.b,.5);dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(.026*fade,distance,.026*fade);dummy.updateMatrix();this.beams.setMatrixAt(i,dummy.matrix);
   dummy.scale.set(.115*fade,distance,.115*fade);dummy.updateMatrix();this.beamGlow.setMatrixAt(i,dummy.matrix);
   const front=Math.min(distance,t.age*330),length=Math.min(front,7);dummy.position.copy(t.a).addScaledVector(direction,front-length/2);dummy.scale.set(.065*fade,length,.065*fade);dummy.updateMatrix();this.bolts.setMatrixAt(i,dummy.matrix);
  });for(const mesh of [this.beams,this.beamGlow,this.bolts]){mesh.count=this.tracers.length;mesh.instanceMatrix.needsUpdate=true;}
  this.rings=this.rings.filter(r=>r.age<.28);this.rings.forEach((r,i)=>{r.age+=dt;const t=r.age/.28;dummy.position.copy(r.p);dummy.quaternion.copy(r.q);dummy.scale.setScalar((.12+t*.8)*Math.max(0,1-t));dummy.updateMatrix();this.ringMesh.setMatrixAt(i,dummy.matrix);});this.ringMesh.count=this.rings.length;this.ringMesh.instanceMatrix.needsUpdate=true;
 }
}
