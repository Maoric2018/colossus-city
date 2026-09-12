import test from 'node:test';
import assert from 'node:assert/strict';
import {GameRenderer} from '../src/render/renderer.js';
import {TIERS} from '../src/render/quality.js';

function renderer(tier=TIERS.mobile){
 const gr=Object.create(GameRenderer.prototype);
 Object.assign(gr,{tier,renderer:{xr:{isPresenting:false}},nextFrame:null,scale:.55,minScale:.3,adaptive:true,frameEMA:33,lastAdjust:0});
 gr.targetRatio=()=>.55;gr.applyScale=ratio=>{gr.scale=ratio;};
 return gr;
}
test('phone loop runs 30 times per second across common display refresh rates',()=>{
 for(const hz of [60,90,120,144]){
  const gr=renderer(),frames=[];
  for(let i=0;i<hz*10;i++)if(gr.shouldFrame(i*1000/hz))frames.push(i*1000/hz);
  assert.equal(frames.length,300,`${hz} Hz display`);
  for(let i=1;i<frames.length;i++)assert.ok(frames[i]-frames[i-1]>=1000/30-1000/hz-1);
 }
});
test('stalls resume immediately without a catch-up burst; desktop and XR remain uncapped',()=>{
 const gr=renderer();assert.ok(gr.shouldFrame(0));assert.ok(gr.shouldFrame(2000));assert.equal(gr.shouldFrame(2001),false);
 gr.renderer.xr.isPresenting=true;assert.ok(gr.shouldFrame(2002));assert.ok(gr.shouldFrame(2003));
 const desktop=renderer(TIERS.medium);assert.ok(desktop.shouldFrame(0));assert.ok(desktop.shouldFrame(1));
});
test('slow phone frames lower resolution while a healthy 30 FPS loop and hidden tabs do not',()=>{
 globalThis.document={hidden:false};
 try{
  const gr=renderer();for(let i=0;i<120;i++)gr.adapt(1/30,i*1000/30);assert.equal(gr.scale,.55);
  for(let i=1;i<=80;i++)gr.adapt(.1,4000+i*100);assert.equal(gr.scale,.3);
  gr.scale=.55;document.hidden=true;for(let i=1;i<=50;i++)gr.adapt(.1,12000+i*100);assert.equal(gr.scale,.55);
  document.hidden=false;gr.adapt(8,30000);assert.equal(gr.scale,.55);
 }finally{delete globalThis.document;}
});

test('large destruction bursts respect the small mobile rubble budget',async()=>{
 const T=await import('three'),{Rubble}=await import('../src/world/rubble.js'),scene=new T.Scene(),rubble=new Rubble(scene,TIERS.mobile);
 for(const kind of Object.keys(rubble.pools))rubble.burst(kind,[0,5,0],1000);
 assert.ok(Object.values(rubble.pools).reduce((sum,p)=>sum+p.items.length,0)<=44);
 rubble.update(10);assert.equal(rubble.live,0);
 for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}
});
