import * as T from 'three';
import {F} from '../shared/config.js';
import {SPEED_SHEET,vfxTexture,atlasShader} from './render/soar-vfx.js';

export class FlightFX{
 constructor(scene){
  // Render in the game's existing context so spectator video includes the
  // effect without another canvas copy or a second WebGL context.
  this.canvas=document.getElementById('flight-effects');this.canvas.hidden=true;
  this.pulse=0;this.boom=0;this.strength=0;this.time=0;this.wasSoaring=false;
  const speed=vfxTexture(SPEED_SHEET);this.ready=speed.ready;
  this.uniforms={speedMap:{value:speed.map},clock:{value:0},strength:{value:0},pulse:{value:0}};
  const material=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D speedMap;uniform float clock;uniform float strength;uniform float pulse;varying vec2 vUV;
    ${atlasShader}
    void main(){
     vec2 p=(vUV-.5)*2.;float radius=length(p),angle=atan(p.y,p.x)/6.2831853+.5;
     // Wrap the downloaded horizontal light streaks around the view. Fade them
     // out well before the aiming area; no generated lines or full-screen tint.
     vec2 speedUV=vec2(clamp((radius-.48)/1.05,0.,1.),angle);
     float frame=mod(clock*30.,30.);vec4 streak=mix(texture2D(speedMap,atlasUV(speedUV,floor(frame),vec2(6.,5.),vec2(3102.,2575.))),texture2D(speedMap,atlasUV(speedUV,mod(floor(frame)+1.,30.),vec2(6.,5.),vec2(3102.,2575.))),fract(frame));
     // The source is cyan like the sky: keep enough white and opacity for its
     // motion to read in daylight, including without bloom on low/Quest tiers.
     float peripheral=smoothstep(.55,.95,radius),alpha=streak.a*peripheral*(strength*.48+pulse*.18);
     vec3 color=mix(streak.rgb,vec3(1.),.35);
     if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);this.mesh.frustumCulled=false;this.mesh.renderOrder=10000;this.mesh.visible=false;scene.add(this.mesh);
 }
 dodge(){this.pulse=1;}
 breach(){this.pulse=Math.max(this.pulse,.16);}
 // Entry boosts only the speed streaks here. The shockwave lives in the world.
 sonicBoom(){if(this.boom>.65)return;this.boom=1;this.pulse=Math.max(this.pulse,.45);}
 update(dt,player,enabled){
  const active=enabled&&player&&!(player.flags&(F.DEAD|F.RAG)),soaring=active&&!!(player.flags&F.SOAR),speed=player?Math.hypot(...player.v):0;
  this.pulse=Math.max(0,this.pulse-dt*3);this.boom=Math.max(0,this.boom-dt/.8);if(soaring&&!this.wasSoaring)this.sonicBoom();this.wasSoaring=soaring;
  const target=soaring?Math.min(1,.38+speed/65):active?Math.min(.5,Math.max(0,(speed-20)/40)):0;
  this.strength+=(target-this.strength)*(1-Math.exp(-dt*8));this.time+=dt*(.7+Math.min(1,speed/42)*.6);
  if(!active){this.strength=0;this.boom=0;this.pulse=0;}
  this.mesh.visible=!!active&&(this.strength>.01||this.pulse>0||this.boom>0);
  for(const [key,value]of Object.entries({clock:this.time,strength:this.strength,pulse:this.pulse}))this.uniforms[key].value=value;
 }
}
