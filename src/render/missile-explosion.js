import * as T from 'three';
import {markRange} from './instances.js';

const LIMIT=10;
// Fade the effect in world metres, including under the giant's scaled XR rig.
// Keep this independent of the city's patched built-in fog shader varyings.
const fogUniforms=`
 #ifdef USE_FOG
  #ifdef FOG_EXP2
   uniform float fogDensity;
  #else
   uniform float fogNear;uniform float fogFar;
  #endif
 #endif
 float visibility(vec3 p){
  #ifdef USE_FOG
   #ifdef FOG_EXP2
    return exp(-fogDensity*fogDensity*dot(p,p));
   #else
    return 1.-smoothstep(fogNear,fogFar,length(p));
   #endif
  #else
   return 1.;
  #endif
 }
`;

// Downloaded smoke supplies the fire's billowing detail. A heat ramp makes it
// burn white/yellow, then orange, before the shared smoke particles take over.
// Two instanced draws cover all overlapping explosions; no lights or post pass.
export class MissileExplosions{
 constructor(scene,{quest=false,mobile=false}={}){
  this.items=[];this.lobes=mobile?3:quest?6:9;this.dummy=new T.Object3D();
  const geometry=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1));geometry.instanceCount=0;
  this.attributes={};
  for(const [name,size]of [['center',3],['shape',3],['heat',1]]){
   const a=new T.InstancedBufferAttribute(new Float32Array(LIMIT*this.lobes*size),size).setUsage(T.DynamicDrawUsage);
   geometry.setAttribute(name,a);this.attributes[name]=a;
  }
  const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{smokeMap:{value:null}}]);
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,fog:true,
   vertexShader:`attribute vec3 center;attribute vec3 shape;attribute float heat;varying vec2 vUV;varying vec2 vLife;varying vec3 vView;
    void main(){vUV=uv;vLife=vec2(heat,shape.y);float c=cos(shape.z),s=sin(shape.z);
     vec4 view=modelViewMatrix*vec4(center,1.);view.xy+=mat2(c,-s,s,c)*position.xy*shape.x*length(viewMatrix[0].xyz);
     vView=view.xyz/length(viewMatrix[0].xyz);gl_Position=projectionMatrix*view;
    }`,
   fragmentShader:`uniform sampler2D smokeMap;varying vec2 vUV;varying vec2 vLife;varying vec3 vView;
    ${fogUniforms}
    void main(){vec4 tex=texture2D(smokeMap,vUV);float density=tex.r;
     float alpha=smoothstep(.025,.32,tex.a)*smoothstep(.005,.08,density)*vLife.y*visibility(vView);if(alpha<.008)discard;
     float hot=clamp(vLife.x+(.5-density)*-.65,0.,1.);
     vec3 color=mix(vec3(.095,.018,.006),vec3(1.,.075,.002),smoothstep(.12,.45,hot));
     color=mix(color,vec3(1.,.5,.025),smoothstep(.4,.75,hot));
     color=mix(color,vec3(1.,.94,.64),smoothstep(.72,1.,hot));
     gl_FragColor=vec4(color,alpha);
     #include <colorspace_fragment>
    }`});
  this.fire=new T.Mesh(geometry,material);this.fire.frustumCulled=false;this.fire.visible=false;this.fire.renderOrder=3;scene.add(this.fire);
  const shellGeometry=new T.SphereGeometry(1,mobile?12:24,mobile?8:16);
  this.shellLife=new T.InstancedBufferAttribute(new Float32Array(LIMIT),1).setUsage(T.DynamicDrawUsage);shellGeometry.setAttribute('blastLife',this.shellLife);
  const shellMaterial=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,fog:true,
   vertexShader:`attribute float blastLife;varying float vLife;varying vec3 vNormal;varying vec3 vView;varying vec2 vUV;
    void main(){vLife=blastLife;vUV=uv;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
     vec4 view=modelViewMatrix*instanceMatrix*vec4(position,1.);vView=view.xyz/length(viewMatrix[0].xyz);gl_Position=projectionMatrix*view;
    }`,
   fragmentShader:`uniform sampler2D smokeMap;varying float vLife;varying vec3 vNormal;varying vec3 vView;varying vec2 vUV;
    ${fogUniforms}
    void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vView))),3.);
     float detail=.55+.45*texture2D(smokeMap,fract(vUV*vec2(3.,2.)+vLife*.13)).r;
     float alpha=rim*detail*.65*pow(1.-vLife,1.5)*visibility(vView);if(alpha<.004)discard;
     gl_FragColor=vec4(mix(vec3(1.,.67,.23),vec3(.78,.84,.88),min(1.,vLife*2.)),alpha);
     #include <colorspace_fragment>
    }`});
  this.shockwaves=new T.InstancedMesh(shellGeometry,shellMaterial,LIMIT);this.shockwaves.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.shockwaves.count=0;this.shockwaves.visible=false;this.shockwaves.frustumCulled=false;this.shockwaves.renderOrder=4;scene.add(this.shockwaves);
  this.ready=new T.TextureLoader().loadAsync('/assets/imported/effects/smoke.png').then(map=>{map.colorSpace=T.SRGBColorSpace;uniforms.smokeMap.value=map;});
 }
 add(p){
  if(this.items.length>=LIMIT)this.items.shift();
  const lobes=[];
  for(let i=0;i<this.lobes;i++){
   const y=1-2*(i+.5)/this.lobes,a=i*2.3999632297+Math.random()*.35,r=Math.sqrt(1-y*y);
   lobes.push({direction:new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),spin:Math.random()*Math.PI*2,life:.8+Math.random()*.35,size:i===0?9:5.5+Math.random()*1.6});
  }
  this.items.push({p:new T.Vector3(...p),age:0,lobes});
 }
 update(dt){
  const a=this.attributes,d=this.dummy;let n=0,shells=0,alive=0;
  for(const blast of this.items){
   blast.age+=dt;if(blast.age>=1.2)continue;this.items[alive++]=blast;
   for(let i=0;i<blast.lobes.length;i++){
    const lobe=blast.lobes[i],t=blast.age/lobe.life;if(t>=1)continue;
    const spread=i===0?0:2.8*(1-Math.exp(-blast.age*6)),p=blast.p,v=lobe.direction;
    a.center.setXYZ(n,p.x+v.x*spread,Math.max(.4,p.y+v.y*spread+blast.age*1.8),p.z+v.z*spread);
    a.shape.setXYZ(n,lobe.size*(.45+.85*(1-Math.exp(-t*7))),Math.min(1,blast.age/.025)*(1-T.MathUtils.smoothstep(t,.45,1)),lobe.spin+t*.4);
    a.heat.setX(n,1.05-t*.85);n++;
   }
   if(blast.age<.65){const t=blast.age/.65;d.position.copy(blast.p);d.scale.setScalar(1+12*Math.pow(t,.65));d.updateMatrix();this.shockwaves.setMatrixAt(shells,d.matrix);this.shellLife.setX(shells,t);shells++;}
  }
  this.items.length=alive;this.fire.geometry.instanceCount=n;this.fire.visible=n>0;
  if(n)for(const attribute of Object.values(a)){markRange(attribute,0,n);attribute.needsUpdate=true;}
  this.shockwaves.count=shells;this.shockwaves.visible=shells>0;
  if(shells)for(const attribute of [this.shockwaves.instanceMatrix,this.shellLife]){markRange(attribute,0,shells);attribute.needsUpdate=true;}
 }
}
