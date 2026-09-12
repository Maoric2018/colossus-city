import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=31000+Math.floor(Math.random()*700),url=`http://127.0.0.1:${port}`,errors=[],output='artifacts/optimization/locality-after';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir(output,{recursive:true});for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:960,height:640}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{renderer,scene,camera,city,rig,giant}=window.__COLOSSUS;
  renderer.setAnimationLoop(null);renderer.setPixelRatio(1);renderer.setSize(960,640);rig.scale.setScalar(1);rig.position.set(0,0,0);giant.root.visible=false;
  camera.aspect=1.5;camera.updateProjectionMatrix();const gl=renderer.getContext(),samples=[];
  const render=()=>{renderer.info.reset();renderer.render(scene,camera);const pixels=new Uint8Array(960*640*4);gl.readPixels(0,0,960,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
  for(const [p,target]of [[[720,32,570],[700,22,530]],[[595,13,480],[615,12,440]]]){
   camera.position.set(...p);camera.lookAt(...target);camera.updateMatrixWorld(true);
   for(let i=0;i<400;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));if(i>=12&&!city.stream.pending.length&&!city.stream.building)break;}
   await delayFrames(3);const components=city.buildings.components,batches=components.materialBatches;if(!batches)throw Error('The test browser must support WEBGL_multi_draw');
   const optimized=render();components.materialBatches=null;
   for(const pool of batches.pools.values())pool.mesh.visible=false;
   for(const mesh of components.batches.values()){mesh.userData.batchedSource=false;components.buildings.root.add(mesh);}
   const reference=render();
   components.materialBatches=batches;for(const pool of batches.pools.values())pool.mesh.visible=pool.count>0;for(const mesh of components.batches.values()){mesh.userData.batchedSource=true;mesh.removeFromParent();}
   const restored=render();let changed=0,totalError=0,restoreError=0;
   for(let i=0;i<reference.pixels.length;i+=4){let difference=0;for(let k=0;k<3;k++){difference+=Math.abs(reference.pixels[i+k]-optimized.pixels[i+k]);restoreError+=Math.abs(restored.pixels[i+k]-optimized.pixels[i+k]);}if(difference>9)changed++;totalError+=difference;}
   samples.push({position:p,referenceCalls:reference.calls,batchedCalls:optimized.calls,referenceTriangles:reference.triangles,batchedTriangles:optimized.triangles,changedPixels:changed,changedFraction:changed/(960*640),meanChannelError:totalError/(960*640*3),restoreError});
  }
  async function delayFrames(n){for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));}
  const {CityView}=await import('/src/world/city.js'),{generateBlock}=await import('/shared/city/layout.js'),{generateCells}=await import('/shared/environment.js'),env=generateBlock(20,20),staged=new CityView(scene,env,{parent:city,tier:city.tier,preparedCells:generateCells(env),deferred:true});
  staged.advance(performance.now());staged.dispose();const stagedLeak=[...city.buildings.components.cells.keys()].some(id=>staged.byId?.has(id));
  const {BlockPreparation}=await import('/src/world/block-preparation.js'),preparation=new BlockPreparation(false);
  const prepared=async()=>{preparation.prepare(env);const end=performance.now()+15000;while(!preparation.entries.get(env.key)?.cells){if(performance.now()>end)throw Error('Worker cache timed out');await delayFrames(1);}return preparation.take(env);};
  let workerCache;try{const first=await prepared(),expected=JSON.stringify(first);first[0].p[0]+=999;first[0].preparedComponents=[];workerCache=JSON.stringify(await prepared())===expected;}finally{preparation.dispose();}
  return {samples,streamingBuilds:city.stream.buildStats,stagedLeak,workerCache,warmPrograms:city.warmup.retained.length,warmupQueue:city.warmup.queue.length};
 });
 await writeFile(`${output}/batching.json`,JSON.stringify({...report,errors},null,2));await page.screenshot({path:`${output}/batching.png`});
 assert.deepEqual(errors,[]);assert.equal(report.stagedLeak,false);for(const s of report.samples){assert.ok(s.batchedCalls<s.referenceCalls,JSON.stringify(s));assert.ok(s.changedFraction<.002,JSON.stringify(s));assert.equal(s.restoreError,0);}
 assert.ok(report.warmPrograms>0);assert.equal(report.workerCache,true);console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
