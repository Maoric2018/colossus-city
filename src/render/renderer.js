// WebGL renderer with quality tiers, optional bloom composer and adaptive resolution.
// Adaptive scaling watches the measured frame time and lowers the pixel ratio before the game
// starts to stutter; it never touches XR, whose scale is fixed by the session.
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {TIERS, detectTier, gpuName} from './quality.js';
export class GameRenderer {
 constructor(canvas, {quest = false} = {}){
  let renderer;
  try{ renderer = new T.WebGLRenderer({canvas, antialias:!quest, alpha:false, powerPreference:'high-performance', stencil:false}); }
  catch(e){ throw Error('WebGL 2 is unavailable. Enable hardware acceleration in your browser.'); }
  this.renderer = renderer; this.quest = quest; this.tierName = detectTier(renderer, quest); this.tier = TIERS[this.tierName]; this.gpu = gpuName(renderer);
  this.cinematic = false; this.scale = 1; this.frameEMA = 16; this.lastAdjust = performance.now(); this.composer = null; this.adaptive = true;
  renderer.setSize(innerWidth, innerHeight); renderer.info.autoReset = false;
  renderer.shadowMap.enabled = this.tier.shadows; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .96; renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.xr.enabled = true; renderer.xr.setFramebufferScaleFactor(this.tier.xrScale); renderer.xr.setFoveation(1);
  this.applyScale(this.targetRatio());
 }
 targetRatio(){ return this.cinematic ? Math.min(devicePixelRatio, TIERS.high.pixelRatio) : Math.min(devicePixelRatio, this.tier.pixelRatio); }
 applyScale(ratio){ this.scale = ratio; this.renderer.setPixelRatio(ratio); this.composer?.setPixelRatio(ratio); this.composer?.setSize(innerWidth, innerHeight); }
 resize(camera){ camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); this.composer?.setSize(innerWidth, innerHeight); }
 ensureComposer(scene, camera){
  if(!this.composer){ this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(scene, camera)); this.composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), .22, .3, 1.15)); this.composer.addPass(new OutputPass()); this.composer.setPixelRatio(this.scale); }
  return this.composer;
 }
 toggleCinematic(){
  this.cinematic = !this.cinematic;
  this.renderer.shadowMap.enabled = this.cinematic ? true : this.tier.shadows;
  this.applyScale(this.targetRatio()); this.frameEMA = 16;
  return this.cinematic ? 'CINEMATIC' : this.tier.name;
 }
 get bloom(){ return this.cinematic || this.tier.bloom; }
 get shadows(){ return this.renderer.shadowMap.enabled; }
 // Call once per frame with the measured frame interval. Lowers resolution under sustained load.
 adapt(dt, now){
  if(this.renderer.xr.isPresenting || !this.adaptive) return;
  // Hidden tabs are throttled by the browser; their frame times say nothing about the GPU.
  if(document.hidden || dt >= .049){ this.lastAdjust = now; return; }
  this.frameEMA += (dt * 1000 - this.frameEMA) * .06;
  if(now - this.lastAdjust < 1200) return;
  const target = this.targetRatio();
  if(this.frameEMA > 20 && this.scale > .6){ this.applyScale(Math.max(.6, this.scale - .1)); this.lastAdjust = now; }
  else if(this.frameEMA < 12.5 && this.scale < target){ this.applyScale(Math.min(target, this.scale + .05)); this.lastAdjust = now; }
 }
 render(scene, camera, dt){
  this.renderer.info.reset();
  if(this.renderer.xr.isPresenting || !this.bloom) this.renderer.render(scene, camera); else this.ensureComposer(scene, camera).render(dt);
 }
 get stats(){ const r = this.renderer.info.render; return {calls:r.calls, triangles:r.triangles, scale:this.scale, frameMs:this.frameEMA}; }
}
