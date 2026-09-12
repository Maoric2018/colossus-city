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
  this.beams=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5),new T.MeshBasicMaterial({color:0xd8ffb5,toneMapped:false}),48);this.beams.instanceMatrix.setUsage(T.DynamicDrawUsage);this.beams.count=0;this.beams.frustumCulled=false;scene.add(this.beams);
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
 shot(e,color=0xcfffad){
  if(this.tracers.length>=48)this.tracers.shift();const a=new T.Vector3(...e.from),b=new T.Vector3(...e.to);this.tracers.push({a,b,age:0});
  this.particle(this.flashes,e.from,{life:.09,size:.75,color:new T.Color(color),growth:.8});
  if(e.hit){this.particle(this.flares,e.to,{life:.14,size:1.7,color:new T.Color(color)});for(let i=0;i<3;i++)this.particle(this.sparks,e.to,{v:new T.Vector3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.3,size:.22,color:new T.Color(0xffe2ab),gravity:-9});}
 }
 update(dt){
  for(const pool of [this.smoke,this.dust,this.sparks,this.flashes,this.flares])pool.update(dt);
  this.tracers=this.tracers.filter(t=>t.age<.115);this.tracers.forEach((t,i)=>{t.age+=dt;dummy.position.copy(t.a).lerp(t.b,.5);dummy.quaternion.setFromUnitVectors(up,t.b.clone().sub(t.a).normalize());const width=.035*Math.max(0,1-t.age/.12);dummy.scale.set(width,t.a.distanceTo(t.b),width);dummy.updateMatrix();this.beams.setMatrixAt(i,dummy.matrix);});this.beams.count=this.tracers.length;this.beams.instanceMatrix.needsUpdate=true;
 }
}
