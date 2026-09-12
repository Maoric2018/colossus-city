import * as T from 'three';
import {atmosphereSkyGLSL} from './atmosphere-sky.js';

// Show the original cloudy HDRI on the existing sky dome, retaining its detail
// instead of displaying the blurred reflection map. Haze matches the city fog.
export function cloudSkyMaterial(panorama,horizon,rotation=.4){
 panorama.wrapS=T.RepeatWrapping;
 const material=new T.ShaderMaterial({name:'Cloud panorama',side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{panorama:{value:panorama},horizon:{value:horizon},rotation:{value:rotation},intensity:{value:.8}},
  vertexShader:`varying vec3 vDirection;
   void main(){
    vDirection=mat3(modelMatrix)*position;
    // Sky directions ignore camera translation, including the two headset eyes.
    vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*vDirection,1.);
    gl_Position=clip.xyww;
   }`,
  fragmentShader:`uniform sampler2D panorama;uniform vec3 horizon;uniform float rotation;uniform float intensity;varying vec3 vDirection;
   #include <common>
   ${atmosphereSkyGLSL}
   void main(){
    gl_FragColor=vec4(citySkyRadiance(panorama,normalize(vDirection),horizon,rotation,intensity),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 material.addEventListener('dispose',()=>panorama.dispose());
 return material;
}
