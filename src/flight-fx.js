import * as T from 'three';
import {F} from '../shared/config.js';
import {SPEED_SHEET,BOOM_SHEET,vfxTexture,atlasShader} from './render/soar-vfx.js';

export class FlightFX{
 constructor(scene){
  // Render in the game's existing context so spectator video includes the
  // effect without another canvas copy or a second WebGL context.
  this.canvas=document.getElementById('flight-effects');this.canvas.hidden=true;
  this.pulse=0;this.boom=0;this.strength=0;this.time=0;this.wasSoaring=false;
  const speed=vfxTexture(SPEED_SHEET),boom=vfxTexture(BOOM_SHEET);this.ready=Promise.all([speed.ready,boom.ready]);
  this.uniforms={speedMap:{value:speed.map},boomMap:{value:boom.map},clock:{value:0},strength:{value:0},pulse:{value:0},boom:{value:0}};
  const material=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D speedMap;uniform sampler2D boomMap;uniform float clock;uniform float strength;uniform float pulse;uniform float boom;varying vec2 vUV;
    ${atlasShader}
    void main(){
     vec2 p=(vUV-.5)*2.;float radius=length(p),angle=atan(p.y,p.x)/6.2831853+.5;
     // Wrap the downloaded horizontal light streaks around the view. Fade them
     // out well before the aiming area; no generated lines or full-screen tint.
     vec2 speedUV=vec2(clamp((radius-.48)/1.05,0.,1.),angle);
     float frame=mod(clock*30.,30.);vec4 streak=mix(texture2D(speedMap,atlasUV(speedUV,floor(frame),vec2(6.,5.),vec2(3102.,2575.))),texture2D(speedMap,atlasUV(speedUV,mod(floor(frame)+1.,30.),vec2(6.,5.),vec2(3102.,2575.))),fract(frame));
     float peripheral=smoothstep(.62,1.05,radius),alpha=streak.a*peripheral*(strength*.21+pulse*.14);
     vec3 color=mix(streak.rgb,vec3(1.),.15);
     if(boom>0.){
      float t=1.-boom,scale=.6+t*2.2;vec2 uv=(vUV-.5)/scale+.5;
      vec4 wave=texture2D(boomMap,atlasUV(uv,8.+min(67.,floor(t*68.)),vec2(9.),vec2(2556.)));
      float a=wave.a*.22*boom*smoothstep(.3,.6,radius);float combined=alpha+a*(1.-alpha);
      color=(color*alpha+wave.rgb*a*(1.-alpha))/max(combined,.0001);alpha=combined;
     }
     if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);this.mesh.frustumCulled=false;this.mesh.renderOrder=10000;this.mesh.visible=false;scene.add(this.mesh);
 }
 dodge(){this.pulse=1;}
 breach(){this.pulse=Math.max(this.pulse,.16);}
 sonicBoom(){if(this.boom>.65)return;this.boom=1;this.pulse=Math.max(this.pulse,.45);}
 update(dt,player,enabled){
  const active=enabled&&player&&!(player.flags&(F.DEAD|F.RAG)),soaring=active&&!!(player.flags&F.SOAR),speed=player?Math.hypot(...player.v):0;
  this.pulse=Math.max(0,this.pulse-dt*3);this.boom=Math.max(0,this.boom-dt/.8);if(soaring&&!this.wasSoaring)this.sonicBoom();this.wasSoaring=soaring;
  const target=soaring?Math.min(1,.38+speed/65):active?Math.min(.5,Math.max(0,(speed-20)/40)):0;
  this.strength+=(target-this.strength)*(1-Math.exp(-dt*8));this.time+=dt*(.7+Math.min(1,speed/42)*.6);
  if(!active){this.strength=0;this.boom=0;this.pulse=0;}
  this.mesh.visible=!!active&&(this.strength>.01||this.pulse>0||this.boom>0);
  for(const [key,value]of Object.entries({clock:this.time,strength:this.strength,pulse:this.pulse,boom:this.boom}))this.uniforms[key].value=value;
 }
}
