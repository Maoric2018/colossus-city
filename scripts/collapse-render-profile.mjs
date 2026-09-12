import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
const input=process.argv[2]||'artifacts/optimization/collapse-before',output=process.argv[3]||input;
const {env,frames}=JSON.parse(await readFile(`${input}/events.json`,'utf8'));
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=31000+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir(output,{recursive:true});for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows','--enable-precise-memory-info']});
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(async env=>{
  const T=await import('three'),{CityView}=await import('/src/world/city.js'),{TIERS}=await import('/src/render/quality.js'),g=window.__COLOSSUS;
  g.renderer.setAnimationLoop(null);g.city?.dispose();g.renderer.setPixelRatio(1);g.renderer.setSize(1000,800);g.renderer.shadowMap.enabled=false;document.body.replaceChildren(g.renderer.domElement);
  const scene=new T.Scene(),city=new CityView(scene,env,{tier:TIERS.quest,quest:true}),camera=new T.PerspectiveCamera(65,1.25,.1,600);await city.ready;camera.position.set(45,45,70);camera.lookAt(0,40,-25);camera.updateMatrixWorld(true);g.renderer.render(scene,camera);
  window.collapse={city,scene,camera};g.renderer.domElement.addEventListener('webglcontextlost',()=>{window.collapse.lost=true;});
 },env);
 const samples=[],cdp=await page.context().newCDPSession(page);
 for(let i=0;i<frames.length;i++){
  const sample=await page.evaluate(async({events,tick})=>{
   await new Promise(requestAnimationFrame);
   const {city,scene,camera}=window.collapse,renderer=window.__COLOSSUS.renderer,types={},start=performance.now();
   for(const e of events){const at=performance.now();if(e.type==='fracture')city.setFracture(e.cell,e.parts);else if(e.type==='shards')city.addShards(e);else if(e.type==='fine-collapse')city.hideCells(e.cells);types[e.type]=(types[e.type]||0)+performance.now()-at;}
   const eventMS=performance.now()-start,updateStart=performance.now();city.update(1/60);const updateMS=performance.now()-updateStart,renderStart=performance.now();renderer.info.reset();renderer.render(scene,camera);const renderMS=performance.now()-renderStart;
   return {tick,eventMS,updateMS,renderMS,types,shards:city.fine.shards.size,pending:city.fine.collapses?.size||0,templates:city.fine.templates?.size,preparation:city.fine.preparationStats,worker:city.fine.preparation?.stats,vertices:[...city.fine.pools.values()].reduce((n,p)=>n+p.live,0),capacity:[...city.fine.pools.values()].reduce((n,p)=>n+p.vertices,0),geometryBytes:[...city.fine.pools.values()].reduce((n,p)=>n+Object.values(p.mesh.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(p.mesh.geometry.index?.array.byteLength||0),0),heapMB:performance.memory?.usedJSHeapSize/1048576,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,lost:!!window.collapse.lost};
  },{events:frames[i],tick:i});samples.push(sample);
  if(i%20===0)console.log(JSON.stringify(sample));
  // Stop the baseline before exhausting the host. This still records a failure
  // to complete the tower, rather than calling a partial collapse a passing test.
  if(sample.heapMB>650){await cdp.send('HeapProfiler.collectGarbage');sample.retainedHeapMB=await page.evaluate(()=>performance.memory.usedJSHeapSize/1048576);if(sample.retainedHeapMB>650)break;}if(sample.lost)break;
 }
 await cdp.send('HeapProfiler.collectGarbage');const retainedHeapMB=await page.evaluate(()=>performance.memory.usedJSHeapSize/1048576);
 await page.screenshot({path:`${output}/collapse.png`});
 const verification=await page.evaluate(async()=>{
  const {city}=window.collapse,{appearanceSources,cutAppearance}=await import('/src/render/fracture-geometry.js'),{fractureRecipe}=await import('/shared/city/fracture.js'),all=[...city.fine.shards.values()];let checked=0;
  for(const index of [0,Math.floor(all.length/2),all.length-1]){const e=all[index];if(!e)continue;const source=appearanceSources(e.c,city.buildings),expected=cutAppearance(source,e.meta.pieces,city.skins.get(e.c.id),false);if(expected.length!==e.parts.length)throw Error('Fragment draw count changed');for(let i=0;i<expected.length;i++){const a=expected[i].geometry,b=e.parts[i].shared.source;for(const [key,value]of Object.entries(a.attributes)){const actual=b.attributes[key].array;if(value.array.length!==actual.length||!value.array.every((n,i)=>n===actual[i]))throw Error('Worker fragment vertices differ from synchronous cutting');}if(a.index.count!==b.index.count||!a.index.array.every((n,i)=>n===b.index.array[i]))throw Error('Worker triangle order changed');}checked++;}
  const retained=city.fine.shards.size;city.reset();const c=all[0].c;city.setFracture(c.id,fractureRecipe(c).pieces.map(p=>p.id));city.hideCells([c.id]);city.addShards(all[0].meta);city.fine.prepareCollapses(Infinity);const cancelledBusyWorker=!!city.fine.preparation?.busy;city.reset();await new Promise(requestAnimationFrame);
  const clean=!city.fine.collapses.size&&!city.fine.pendingShards.size&&!city.fine.shards.size&&!city.fine.pools.size&&!city.fine.templates.size&&!city.fine.preparation;city.dispose();return {checked,retained,clean,cancelledBusyWorker};
 });
 const report={complete:samples.length===frames.length&&!samples.at(-1).pending,samples,retainedHeapMB,verification,errors};await writeFile(`${output}/client.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({complete:report.complete,last:samples.at(-1),retainedHeapMB,maxEventMS:Math.max(...samples.map(s=>s.eventMS)),maxUpdateMS:Math.max(...samples.map(s=>s.updateMS)),maxRenderMS:Math.max(...samples.map(s=>s.renderMS)),errors},null,2));
 if(!process.argv.includes('--baseline')){assert.ok(report.complete,'every tower fragment must finish preparing');const expected=new Set(frames.flat().filter(e=>e.type==='shards').map(e=>e.id));assert.equal(samples.at(-1).shards,expected.size,'no rubble may be discarded');assert.equal(verification.checked,3);assert.ok(verification.clean&&verification.cancelledBusyWorker);assert.equal(samples.at(-1).worker?.failed,0);}
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');}
