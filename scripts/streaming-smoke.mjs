import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=21000+Math.floor(Math.random()*900),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1500,height:950}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(60000);
 await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(()=>{const {renderer,giant}=window.__COLOSSUS;renderer.setAnimationLoop(null);giant.root.visible=false;for(const id of ['lobby','brand','status','scene-caption','vignette'])document.getElementById(id).style.display='none';});
 const tours=[['infinite-city',[720,100,570],[700,30,490]],['infinite-street',[595,13,480],[615,12,440]],['infinite-distant',[-1240,110,-670],[-1260,25,-700]]],stats=[];
 for(const [name,position,target]of tours){
  const sample=await page.evaluate(async({position,target})=>{
   const {renderer,scene,camera,city,rig}=window.__COLOSSUS;rig.position.set(0,0,0);rig.scale.setScalar(1);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld(true);
   for(let i=0;i<13;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}
   const a=performance.now();for(let i=0;i<20;i++){renderer.info.reset();renderer.render(scene,camera);renderer.getContext().finish();}const renderMS=(performance.now()-a)/20;
   return {views:city.stream.views.size,previews:city.stream.previews.size,detailBatches:city.buildings.components.batches.size,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,renderMS,geometries:renderer.info.memory.geometries};
  },{position,target});stats.push({name,...sample});assert.ok(sample.views<=9&&sample.views>0);assert.ok(sample.previews<220);await page.screenshot({path:`artifacts/${name}.png`});
 }
 const culling=await page.evaluate(async()=>{
  const T=await import('three'),{camera,city,renderer,scene}=window.__COLOSSUS,original=camera.clone(),far=scene.fog.far;
  const owners=[city,...city.stream.views.values()],visible=()=>new Set(owners.flatMap(v=>[...v.buildings.entries].filter(([,e])=>e.rendered).map(([id])=>id)));
  for(const v of owners)v.buildings.select(camera,far);const forward=visible();
  const opposite=camera.clone();opposite.rotateOnWorldAxis(new T.Vector3(0,1,0),Math.PI);opposite.updateMatrixWorld(true);
  for(const v of owners)v.buildings.select(opposite,far);const backward=visible();
  const stereo=new T.ArrayCamera([camera,opposite]);for(const v of owners)v.buildings.select(stereo,far);const both=visible();
  const union=[...forward,...backward].every(id=>both.has(id)),different=[...backward].some(id=>!forward.has(id));
  for(const v of owners)v.buildings.select(original,far);const restored=visible();renderer.render(scene,camera);
  return {forward:forward.size,backward:backward.size,both:both.size,union,different,restored:forward.size===restored.size&&[...forward].every(id=>restored.has(id))};
 });assert.ok(culling.forward>0&&culling.backward>0&&culling.union&&culling.different&&culling.restored,JSON.stringify(culling));
 const persistence=await page.evaluate(async()=>{
  const T=await import('three'),{renderer,scene,camera,city}=window.__COLOSSUS;camera.position.set(280,30,35);camera.lookAt(280,12,0);camera.updateMatrixWorld(true);
  for(let i=0;i<12;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}
  const tile=city.stream.views.get('4,0'),c=tile.cells.find(c=>c.roof&&c.walls[0]),position=[c.p[0],2,c.p[2]],event={id:991200,cells:[c.id],origin:c.p,p:position,q:[0,0,0,1],material:c.material,settled:true};
  city.setSkin(c.id,0,0,false);city.addDebris(event);city.commit();const original=tile.buildings.pose(c.id).p.toArray(),fragments=tile.fragments.pieces.size;
  camera.position.set(-1400,40,0);camera.updateMatrixWorld(true);renderer.render(scene,camera);const unloaded=!city.stream.views.has('4,0');
  camera.position.set(280,30,35);camera.lookAt(280,12,0);camera.updateMatrixWorld(true);for(let i=0;i<12;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}
  const restored=city.stream.views.get('4,0');city.poseDebris(event.id,[0,100,0],[0,0,0,1]);
  const a=restored.buildings.pose(c.id).p;return {unloaded,pose:a.toArray(),original,glass:restored.skins.get(c.id).glass,facade:restored.skins.get(c.id).facade,fragments:restored.fragments.pieces.size,originalFragments:fragments,handBoxes:[...city.handWorld.near([a.x-5,a.y,a.z],[a.x+5,a.y,a.z])].filter(b=>b.cell===c.id).length};
 });assert.ok(persistence.unloaded);assert.deepEqual(persistence.pose,persistence.original);assert.equal(persistence.glass,0);assert.equal(persistence.facade,0);assert.equal(persistence.fragments,persistence.originalFragments);assert.ok(persistence.handBoxes>0);
 await page.close();
 const headset=await browser.newContext({viewport:{width:1200,height:800}});
 await headset.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);questDevice.controllers.left.position.set(-.4,1.2,-.3);questDevice.controllers.right.position.set(.4,1.2,-.3);`});
 const quest=await headset.newPage();quest.setDefaultTimeout(60000);quest.on('pageerror',e=>errors.push(e.message));quest.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await quest.goto(url+'/?quality=quest');await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('[data-role="boss"]').click();await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',1,0));await quest.waitForFunction(()=>window.__COLOSSUS.state.bossX>34);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',0,-1));await quest.waitForFunction(()=>window.__COLOSSUS.state.bossZ < -190);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',0,0));await quest.waitForTimeout(400);await quest.screenshot({path:'artifacts/infinite-quest-stereo.png'});
 const xr=await quest.evaluate(()=>{const g=window.__COLOSSUS;return {x:g.state.bossX,z:g.state.bossZ,eyes:g.renderer.xr.getCamera().cameras.length,blocks:g.city.stream.views.size,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls,fogNear:g.scene.fog.near,fogFar:g.scene.fog.far};});assert.equal(xr.eyes,2);assert.ok(xr.blocks>0);assert.ok(xr.z < -190);assert.equal(xr.fogFar,230);
 assert.deepEqual(errors,[]);const report={result:'PASS',stats,culling,persistence,xr,browserErrors:errors};console.log(JSON.stringify(report,null,2));await writeFile('artifacts/streaming-report.json',JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
