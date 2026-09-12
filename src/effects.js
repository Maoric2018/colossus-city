import * as T from 'three';
import {glowMap} from './art.js';
export class Effects{
 constructor(scene,{quest=false}={}){
  this.scene=scene;this.limit=quest?180:400;this.particles=[];this.tracers=[];
  const g=new T.BufferGeometry();this.pos=new Float32Array(this.limit*3);this.colors=new Float32Array(this.limit*3);this.sizes=new Float32Array(this.limit);this.opacity=new Float32Array(this.limit);
  g.setAttribute('position',new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(this.colors,3).setUsage(T.DynamicDrawUsage));g.setAttribute('size',new T.BufferAttribute(this.sizes,1).setUsage(T.DynamicDrawUsage));g.setAttribute('alpha',new T.BufferAttribute(this.opacity,1).setUsage(T.DynamicDrawUsage));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:T.NormalBlending,
   vertexShader:`attribute float size;attribute float alpha;varying vec3 c;varying float a;void main(){c=color;a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*400./max(1.,-p.z),1.,90.);gl_Position=projectionMatrix*p;}`,
   fragmentShader:`varying vec3 c;varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float f=pow(1.-d,1.3);gl_FragColor=vec4(c,a*f);}`});
  this.points=new T.Points(g,material);this.points.frustumCulled=false;scene.add(this.points);
  this.audio=null;
 }
 unlockAudio(){if(this.audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC){this.audio=new AC();this.audio.resume();}}
 sound(freq,duration=.12,type='sine',volume=.06){
  if(!this.audio||this.audio.state!=='running')return;const c=this.audio,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(22,freq*.2),c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration);
 }
 impact(p,power=.5){
  const n=Math.floor(18+power*35);for(let i=0;i<n;i++){
   if(this.particles.length>=this.limit)this.particles.shift();
   const smoke=i%3!==0;this.particles.push({p:new T.Vector3(...p),v:new T.Vector3((Math.random()-.5)*10,Math.random()*7+1,(Math.random()-.5)*10),age:0,life:smoke?2.5:1.1,size:smoke?2+Math.random()*3:.14,color:new T.Color(smoke?0x85999d:0xffd394),smoke});
  }this.sound(75,.4,'triangle',power*.1);
 }
 shot(e,color=0xcfffad){
  if(this.tracers.length>70){const old=this.tracers.shift();old.mesh.removeFromParent();old.mesh.geometry.dispose();old.mesh.material.dispose();}
  const a=new T.Vector3(...e.from),b=new T.Vector3(...e.to),length=a.distanceTo(b),m=new T.Mesh(new T.CylinderGeometry(.025,.025,length,4),new T.MeshBasicMaterial({color,toneMapped:false,transparent:true,opacity:.85}));m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());this.scene.add(m);this.tracers.push({mesh:m,age:0});
  if(e.hit){this.particles.push({p:b,v:new T.Vector3(0,2,0),age:0,life:.25,size:1.4,color:new T.Color(0xeeffad),smoke:false});if(this.particles.length>this.limit)this.particles.shift();}
 }
 update(dt){
  for(let i=this.tracers.length-1;i>=0;i--){const t=this.tracers[i];t.age+=dt;t.mesh.material.opacity=Math.max(0,1-t.age/.11);if(t.age>.12){t.mesh.removeFromParent();t.mesh.geometry.dispose();t.mesh.material.dispose();this.tracers.splice(i,1);}}
  this.particles=this.particles.filter(p=>p.age<p.life);
  for(let i=0;i<this.limit;i++){
   const p=this.particles[i];if(!p){this.opacity[i]=0;this.sizes[i]=0;continue;}
   p.age+=dt;p.v.y+=(p.smoke?.8:-9.81)*dt;p.p.addScaledVector(p.v,dt);if(p.p.y<.08){p.p.y=.08;p.v.y*=-.2;}
   p.v.multiplyScalar(Math.max(0,1-dt*(p.smoke?.6:.1)));p.p.toArray(this.pos,i*3);p.color.toArray(this.colors,i*3);this.sizes[i]=p.size*(p.smoke?1+p.age*.5:1);this.opacity[i]=(1-p.age/p.life)*(p.smoke?.45:1);
  }
  for(const a of Object.values(this.points.geometry.attributes))a.needsUpdate=true;
 }
}
