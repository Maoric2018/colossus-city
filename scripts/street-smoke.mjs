import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=27000+Math.floor(Math.random()*500),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir('artifacts',{recursive:true});for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1300,height:850}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);await page.evaluate(()=>{const g=window.__COLOSSUS;g.renderer.setAnimationLoop(null);g.giant.root.visible=false;g.rig.position.set(0,0,0);g.rig.scale.setScalar(1);document.body.replaceChildren(g.renderer.domElement);});
 const views=[];
 for(const [name,p,target]of [['street-sidewalk',[35,2.2,18],[25,1,-10]],['street-colossus',[34,23,24],[5,0,-6]],['street-streamed',[595,3,480],[582,1,440]]]){
  const result=await page.evaluate(async({p,target})=>{const g=window.__COLOSSUS;g.camera.position.set(...p);g.camera.lookAt(...target);g.camera.updateMatrixWorld(true);for(let i=0;i<18;i++){g.renderer.render(g.scene,g.camera);await new Promise(r=>requestAnimationFrame(r));}return {slabs:g.city.stream.ground.sidewalks.count,triangles:g.city.stream.ground.sidewalks.geometry.index.count/3,blocks:g.city.stream.views.size};},{p,target});views.push({name,...result});assert.equal(result.slabs,25);assert.equal(result.triangles,12);await page.screenshot({path:`artifacts/${name}.png`});
 }
 const stability=await page.evaluate(async()=>{
  const T=await import('three'),{streamGround}=await import('/src/world/stream-ground.js'),g=window.__COLOSSUS,scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0xffffff,2));
  const ground=streamGround(scene,g.city.tier,g.city.textures),camera=new T.PerspectiveCamera(72,1.6,.05,900);camera.position.set(34.9,8,10);camera.lookAt(27,0,0);
  const target=new T.WebGLRenderTarget(320,200),previous=g.renderer.getRenderTarget(),capture=()=>{const pixels=new Uint8Array(320*200*4);g.renderer.setRenderTarget(target);g.renderer.render(scene,camera);g.renderer.readRenderTargetPixels(target,0,0,320,200,pixels);return pixels;};
  const before=capture();ground.update({x:35.1,z:0});const after=capture();camera.scale.setScalar(14);const scaled=capture();g.renderer.setRenderTarget(previous);
  const difference=pixels=>{let total=0,large=0;for(let i=0;i<pixels.length;i++){const d=Math.abs(pixels[i]-before[i]);total+=d;if(d>8)large++;}return {mean:total/pixels.length,large:large/pixels.length};};
  const ray=new T.Raycaster(new T.Vector3(35,4,0),new T.Vector3(0,-1,0));g.scene.updateMatrixWorld(true);const roadHits=ray.intersectObject(g.city.root,true).filter(h=>h.point.y>=0&&h.point.y<.1).map(h=>({name:h.object.name,y:h.point.y}));
  const report={recenter:difference(after),giantScale:difference(scaled),roadHits};target.dispose();for(const o of [ground.mesh,ground.sidewalks]){o.geometry.dispose();o.material.dispose();o.dispose?.();}return report;
 });assert.ok(stability.recenter.mean<.5&&stability.recenter.large<.01,JSON.stringify(stability));assert.ok(stability.giantScale.mean<.5,JSON.stringify(stability));assert.equal(stability.roadHits.length,1);assert.equal(stability.roadHits[0].name,'city-road-surface');
 const headset=await browser.newContext({viewport:{width:1200,height:800}});await headset.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+'\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);'});
 const quest=await headset.newPage();quest.setDefaultTimeout(60000);quest.on('pageerror',e=>errors.push(e.message));quest.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await quest.goto(url+'/?quality=quest');await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('[data-role="boss"]').click();await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);await quest.waitForTimeout(300);
 const xr=await quest.evaluate(()=>{const g=window.__COLOSSUS;return {eyes:g.renderer.xr.getCamera().cameras.length,slabs:g.city.stream.ground.sidewalks.count};});assert.equal(xr.eyes,2);assert.equal(xr.slabs,25);await quest.screenshot({path:'artifacts/street-quest-stereo.png'});
 assert.deepEqual(errors,[]);const report={result:'PASS',views,stability,xr,errors};await writeFile('artifacts/street-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
