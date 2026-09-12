import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {C} from '../../shared/config.js';
import {markRange} from './instances.js';

// The downloaded muzzle sprite is already a feathered flame. Crossed cards give
// the plume volume from either eye, with a small hot core seated in the nozzle.
export class MissileExhaust {
 constructor(scene){
  const a=new T.PlaneGeometry(1,1).translate(0,-.5,0),b=a.clone().rotateY(Math.PI/2),c=new T.PlaneGeometry(1,1).rotateX(Math.PI/2).translate(0,-.02,0);
  for(const [i,g]of [a,b,c].entries())g.setAttribute('nozzle',new T.Float32BufferAttribute(new Array(g.attributes.position.count).fill(i===2?1:0),1));
  const geometry=mergeGeometries([a,b,c]);a.dispose();b.dispose();c.dispose();
  const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{flameMap:{value:null},glowMap:{value:null},time:{value:0}}]);
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.NormalBlending,toneMapped:false,fog:true,
   vertexShader:`uniform float time;attribute float nozzle;varying float vNozzle;varying vec2 flameUV;varying vec3 flameViewPosition;
    void main(){vNozzle=nozzle;flameUV=vec2(uv.x,1.-uv.y);vec3 p=position;
     float seed=instanceMatrix[3].x*.31+instanceMatrix[3].z*.17;
     p.xz*=.94+.07*sin(time*43.+seed+flameUV.y*16.);
     p.y*=1.+.06*sin(time*57.+seed);
     vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
     flameViewPosition=mvPosition.xyz/length(viewMatrix[0].xyz);
    }`,
   fragmentShader:`uniform sampler2D flameMap;uniform sampler2D glowMap;varying float vNozzle;varying vec2 flameUV;varying vec3 flameViewPosition;
    #ifdef USE_FOG
     #ifdef FOG_EXP2
      uniform float fogDensity;
     #else
      uniform float fogNear;uniform float fogFar;
     #endif
    #endif
    void main(){vec4 tex=vNozzle>.5?texture2D(glowMap,flameUV):texture2D(flameMap,vec2(flameUV.x,.12+flameUV.y*.88));float alpha=tex.a*tex.r;
     #ifdef USE_FOG
      #ifdef FOG_EXP2
       alpha*=exp(-fogDensity*fogDensity*dot(flameViewPosition,flameViewPosition));
      #else
       alpha*=1.-smoothstep(fogNear,fogFar,length(flameViewPosition));
      #endif
     #endif
     if(alpha<.008)discard;vec3 color=vNozzle>.5?vec3(1.,.72,.24):mix(vec3(1.,.045,.002),vec3(1.,.35,.035),pow(1.-flameUV.y,2.));
     gl_FragColor=vec4(color*1.25,alpha*.96);
     #include <colorspace_fragment>
    }`});
  this.flame=new T.InstancedMesh(geometry,material,C.MAX_MISSILES);
  this.core=new T.InstancedMesh(new T.CylinderGeometry(.19,0,1,8,1,true).translate(0,-.5,0),new T.MeshBasicMaterial({color:0xffefd0,toneMapped:false}),C.MAX_MISSILES);
  for(const mesh of [this.flame,this.core]){mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);}
  const loader=new T.TextureLoader();this.ready=Promise.all([['flameMap','muzzle.png'],['glowMap','flare.png']].map(async([key,file])=>{const map=await loader.loadAsync('/assets/imported/effects/'+file);map.colorSpace=T.SRGBColorSpace;uniforms[key].value=map;}));
  this.dummy=new T.Object3D();
 }
 set(index,position,rotation){
  const d=this.dummy;d.position.copy(position);d.quaternion.copy(rotation);d.scale.set(1.45,4,1.45);d.updateMatrix();this.flame.setMatrixAt(index,d.matrix);
  d.scale.set(.8,.48,.8);d.updateMatrix();this.core.setMatrixAt(index,d.matrix);
 }
 commit(count,time){
  this.flame.material.uniforms.time.value=time;
  for(const mesh of [this.flame,this.core]){mesh.count=count;mesh.visible=count>0;if(count){markRange(mesh.instanceMatrix,0,count);mesh.instanceMatrix.needsUpdate=true;}}
 }
 reset(){this.commit(0,0);}
}
