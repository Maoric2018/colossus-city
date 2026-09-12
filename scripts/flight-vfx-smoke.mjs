// Pixel checks for downloaded flight effects: loading an atlas alone does not
// prove its animation is visible against the daytime sky.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=26000+Math.floor(Math.random()*800),url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
const errors=[],results=[];let browser;
await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:process.env.HEADED!=='1',channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Use production materials and both renderer paths without building a city or
 // starting a room, so this asset regression stays independent of physics work.
 await page.route(url+'/flight-vfx-test*',route=>route.fulfill({contentType:'text/html',body:`<style>body{margin:0}canvas{display:block}</style><canvas id="world"></canvas><canvas id="flight-effects"></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>`}));
 for(const [quality,width,height]of [['low',1200,800],['high',1200,800],['low',800,1000]]){
  await page.setViewportSize({width,height});await page.goto(`${url}/flight-vfx-test?quality=${quality}`);
  const result=await page.evaluate(async()=>{
   const T=await import('three'),{F}=await import('/shared/config.js'),{FlightFX}=await import('/src/flight-fx.js'),{GameRenderer}=await import('/src/render/renderer.js');
   const gr=new GameRenderer(document.getElementById('world')),renderer=gr.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(86,innerWidth/innerHeight,.1,100);
   const fx=new FlightFX(scene);await fx.ready;const player={flags:F.SOAR,v:[0,0,-32]},gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new T.Vector2());
   const read=()=>{gr.render(scene,camera,1/60);const pixels=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
   const compare=(a,b)=>{
    const changes=[];let center=0,changed=0;
    for(let y=0;y<size.y;y++)for(let x=0;x<size.x;x++){
     const radius=Math.hypot((x/size.x-.5)*2,(y/size.y-.5)*2),i=(y*size.x+x)*4;
     const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
     if(radius>.7)changes.push(d);if(radius<.25&&d>2)center++;if(d>2)changed++;
    }
    changes.sort((a,b)=>a-b);return {peripheralP90:changes[Math.floor(changes.length*.9)],visibleFraction:changes.filter(d=>d>20).length/changes.length,centerChanged:center,changed};
   };
   for(let i=0;i<120;i++)fx.update(1/60,player,true);
   const samples=[];let previous,animation;
   for(const background of ['#91adc2','#243340']){
    scene.background=new T.Color(background);fx.mesh.visible=false;const base=read();fx.mesh.visible=true;
    for(const time of [.1,.43,.83]){
     fx.uniforms.clock.value=time;const pixels=read();samples.push({background,time,...compare(base,pixels)});
     if(previous)animation=compare(previous,pixels);previous=pixels;
    }
   }
   scene.background=new T.Color('#91adc2');fx.mesh.visible=false;const base=read();fx.mesh.visible=true;
   fx.uniforms.strength.value=0;fx.uniforms.pulse.value=0;fx.boom=.75;const noScreenWave=compare(base,read());
   const gates=[];
   for(const [name,flags,enabled]of [['paused',F.SOAR,false],['dead',F.SOAR|F.DEAD,true],['ragdoll',F.SOAR|F.RAG,true],['hover',0,true]]){
    for(let i=0;i<120;i++)fx.update(1/60,{flags,v:[0,0,0]},enabled);
    gates.push({name,hidden:!fx.mesh.visible,changed:compare(base,read()).changed});
   }
   for(let i=0;i<120;i++)fx.update(1/60,player,true);read();
   window.vfxPreview={gr,scene,camera,fx,read,compare};
   return {quality:gr.tierName,width:innerWidth,height:innerHeight,samples,animation,noScreenWave,gates,atlasSizes:[fx.uniforms.speedMap.value.image.width],glError:gl.getError()};
  });
  await page.screenshot({path:`artifacts/flight-vfx-${quality}-${width}.png`});results.push(result);
  for(const sample of result.samples){
   assert.ok(sample.peripheralP90>=14,`Flight streaks must remain visible in ${quality}: ${JSON.stringify(sample)}`);
   assert.ok(sample.visibleFraction>.05,`Enough of the periphery must show streaks in ${quality}: ${JSON.stringify(sample)}`);
   assert.equal(sample.centerChanged,0,'Keep the aiming area clear');
  }
  assert.ok(result.animation.changed>5000,'The downloaded atlas must visibly animate');
  assert.equal(result.noScreenWave.changed,0,'Shockwaves must not draw a screen overlay');
  for(const gate of result.gates)assert.ok(gate.hidden&&gate.changed===0,JSON.stringify(gate));
  assert.deepEqual(result.atlasSizes,[3102]);assert.equal(result.glError,0);
  if(width===1200){
   result.world=await page.evaluate(async()=>{
    const T=await import('three'),{Effects}=await import('/src/effects.js'),{makeEventHandler}=await import('/src/app/events.js');
    const {gr,scene,camera,fx,read,compare}=window.vfxPreview;fx.update(1/60,null,false);scene.background=new T.Color('#243340');
    const loaded=new Promise(resolve=>{T.DefaultLoadingManager.onLoad=resolve;}),world=new Effects(scene,{tier:gr.tier});await Promise.all([loaded,world.ready]);
    world.sonicBoom([0,0,-16],[0,0,-1]);world.update(.16);world.smoke.mesh.visible=false;
    const wave=world.boomMesh;
    wave.visible=false;let base=read();wave.visible=true;const front=compare(base,read());
    camera.position.set(10,0,-18);camera.lookAt(0,0,-18);wave.visible=false;base=read();wave.visible=true;const side=compare(base,read());
    camera.position.set(0,0,0);camera.rotation.set(0,0,0);
    const wall=new T.Mesh(new T.BoxGeometry(40,40,.2),new T.MeshBasicMaterial({color:0x342d26}));wall.position.z=-8;scene.add(wall);
    wave.visible=false;base=read();wave.visible=true;const occluded=compare(base,read());scene.remove(wall);wall.geometry.dispose();wall.material.dispose();
    world.update(2);base=read();
    // Exercise the actual server-event presentation route, including a remote
    // pilot, so every viewer gets an impact at the damaged building.
    const handler=makeEventHandler({fx:world,audio:{play(){}},flightFX:fx,shake:{add(){}},xr:{},listenerPosition:()=>[0,0,0]});
    handler({type:'soar-breach',player:999,p:[0,0,-15],direction:[0,0,-1]});world.update(.08);
    const breach=compare(base,read()),dust=world.dust.items.length,sparks=world.sparks.items.length;
    const position=world.sonicBursts.items[0].p.toArray();
    world.update(2);const expired=world.booms.length===0&&world.dust.items.length===0&&world.sparks.items.length===0;
    for(let i=0;i<40;i++)world.soarBreach([0,0,-15],[0,1,0]);world.update(.01);
    const bounded=world.booms.length<=16&&world.dust.items.length<=world.dust.limit&&world.sparks.items.length<=world.sparks.limit;
    world.update(2);world.sonicBoom([0,0,-16],[0,0,-1]);world.update(.16);read();window.vfxPreview.world=world;
    return {front,side,occluded,breach,dust,sparks,position,expired,bounded,glError:gr.renderer.getContext().getError()};
   });
   await page.screenshot({path:`artifacts/flight-vfx-world-${quality}.png`});
   assert.ok(result.world.front.changed>100&&result.world.side.changed>20,'The 3D shockwave must be visible face-on and edge-on');
   assert.equal(result.world.occluded.changed,0,'Buildings must hide the world shockwave');
   assert.ok(result.world.breach.changed>200&&result.world.dust>0&&result.world.sparks>0,'A breach event must emit a world impact');
   assert.deepEqual(result.world.position,[0,0,-15]);assert.ok(result.world.expired&&result.world.bounded);assert.equal(result.world.glError,0);
  }
 }
 assert.deepEqual(errors,[]);
 const report={result:'PASS',views:results,browserErrors:errors};await writeFile('artifacts/flight-vfx-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
