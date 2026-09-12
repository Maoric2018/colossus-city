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
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1500,height:950}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(60000);
 await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(()=>{const {renderer,giant}=window.__COLOSSUS;renderer.setAnimationLoop(null);giant.root.visible=false;for(const id of ['lobby','brand','status','scene-caption','vignette'])document.getElementById(id).style.display='none';});
 const tours=[['infinite-city',[720,32,570],[700,22,530]],['infinite-street',[595,13,480],[615,12,440]],['infinite-distant',[-1240,24,-670],[-1260,24,-700]]],stats=[];
 for(const [name,position,target]of tours){
  const sample=await page.evaluate(async({position,target})=>{
   const {renderer,scene,camera,city,rig}=window.__COLOSSUS;rig.position.set(0,0,0);rig.scale.setScalar(1);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld(true);
   for(let i=0;i<13;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}
   const a=performance.now();for(let i=0;i<20;i++){renderer.info.reset();renderer.render(scene,camera);renderer.getContext().finish();}const renderMS=(performance.now()-a)/20;
   const simplifiedMeshes=!!(city.stream.lod||city.stream.catalogLOD||city.stream.landmarkLOD);
   return {views:city.stream.views.size,previews:city.stream.previews.size,detailBatches:city.buildings.components.batches.size,simplifiedMeshes,fogNear:scene.fog.near,fogFar:scene.fog.far,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,renderMS,geometries:renderer.info.memory.geometries};
  },{position,target});stats.push({name,...sample});assert.ok(sample.views<=9&&sample.views>0);assert.ok(sample.previews<=9);assert.equal(sample.simplifiedMeshes,false);assert.equal(sample.fogFar,65);await page.screenshot({path:`artifacts/${name}.png`});
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
 const worldDamage=await page.evaluate(async()=>{
  const T=await import('three'),{generateBlock}=await import('/shared/city/layout.js'),{generateCells}=await import('/shared/city/cells.js'),g=window.__COLOSSUS;let env,b;
  for(let x=8;x<2000;x++){env=generateBlock(x,3,g.city.env.seed);b=env.buildings.find(b=>b.architecture==='swfc');if(b)break;}
  const cells=generateCells(env).filter(c=>c.architecture==='swfc'),hit=cells.find(c=>c.floor===8&&c.ix===1&&c.iz===0);g.city.hideCells([hit.id]);g.camera.position.set(b.x,55,b.z+150);g.camera.lookAt(b.x,55,b.z);g.camera.updateMatrixWorld(true);for(let i=0;i<12;i++){g.renderer.render(g.scene,g.camera);await new Promise(r=>requestAnimationFrame(r));}
  const distant=!g.city.stream.views.has(env.key)&&!g.city.stream.previews.has(env.key);
  g.camera.position.set(b.x,55,b.z+30);g.camera.lookAt(b.x,55,b.z);g.camera.updateMatrixWorld(true);for(let i=0;i<12;i++){g.renderer.render(g.scene,g.camera);await new Promise(r=>requestAnimationFrame(r));}
  const view=g.city.stream.views.get(env.key),aperture=[b.x,.15+26.5*b.story,b.z-b.bay*.5*(1-.24*26/30)];
  return {distant,restored:!!view,missingBay:view.buildings.pose(hit.id).hidden,openPortal:!view.overlapBox(new T.Vector3(...aperture),new T.Vector3(.01,.01,.01)),sharedGlass:[...g.city.stream.views.values()].every(v=>!v.buildings.glass.worldGlass||v.buildings.glass.worldGlass.material===g.city.buildings.glass.worldGlass.material)};
 });assert.ok(worldDamage.distant&&worldDamage.restored&&worldDamage.missingBay&&worldDamage.openPortal&&worldDamage.sharedGlass,JSON.stringify(worldDamage));
 // A large plane must stay clear nearby but fade at the corners according to
 // true distance. This catches both depth-only fog and interpolated vertex lengths.
 const fogPixels=await page.evaluate(async()=>{
  const T=await import('three'),{renderer}=window.__COLOSSUS,scene=new T.Scene();scene.fog=new T.Fog(0x000000,40,65);
  const plane=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}));plane.position.z=-40;scene.add(plane);
  const camera=new T.PerspectiveCamera(90,1,.1,200),target=new T.WebGLRenderTarget(64,64),pixels=new Uint8Array(64*64*4),previous=renderer.getRenderTarget();
  renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);
  const sample=(x,y)=>pixels[(y*64+x)*4],result={center:sample(32,32),edge:sample(62,32),corner:sample(62,62)},normal=pixels.slice();
  camera.scale.setScalar(14);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);renderer.setRenderTarget(previous);
  result.scaledCameraError=Math.max(...pixels.map((v,i)=>Math.abs(v-normal[i])));
  target.dispose();plane.geometry.dispose();plane.material.dispose();return result;
 });assert.ok(fogPixels.center>250&&fogPixels.corner<5&&fogPixels.edge>fogPixels.corner&&fogPixels.edge<fogPixels.center&&fogPixels.scaledCameraError<=1,JSON.stringify(fogPixels));

 await page.close();
 const headset=await browser.newContext({viewport:{width:1200,height:800}});
 await headset.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);questDevice.controllers.left.position.set(-.4,1.2,-.3);questDevice.controllers.right.position.set(.4,1.2,-.3);`});
 const quest=await headset.newPage();quest.setDefaultTimeout(60000);quest.on('pageerror',e=>errors.push(e.message));quest.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await quest.goto(url+'/?quality=quest');await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('[data-role="boss"]').click();await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',1,0));await quest.waitForFunction(()=>window.__COLOSSUS.state.bossX>34);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',0,-1));await quest.waitForFunction(()=>window.__COLOSSUS.state.bossZ < -190);
 await quest.evaluate(()=>questDevice.controllers.left.updateAxes('thumbstick',0,0));await quest.waitForTimeout(400);await quest.screenshot({path:'artifacts/infinite-quest-stereo.png'});
 const xr=await quest.evaluate(()=>{const g=window.__COLOSSUS;return {x:g.state.bossX,z:g.state.bossZ,eyes:g.renderer.xr.getCamera().cameras.length,blocks:g.city.stream.views.size,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls,fogNear:g.scene.fog.near,fogFar:g.scene.fog.far};});assert.equal(xr.eyes,2);assert.ok(xr.blocks>0);assert.ok(xr.z < -190);assert.equal(xr.fogNear,32);assert.equal(xr.fogFar,60);
 // Visit naturally generated world landmarks through the actual stereo streaming
 // path. Physics traversal above uses game controls; this section isolates rendering.
 const worldTours=await quest.evaluate(async()=>{
  const {generateBlock}=await import('/shared/city/layout.js'),g=window.__COLOSSUS,found=[];
  for(const [id,type]of [['swfc','swfcAperture'],['marina-bay','marinaSkyGarden']]){
   for(let x=5;x<2000;x++){const env=generateBlock(x,3,g.city.env.seed),b=env.buildings.find(b=>b.architecture===id);if(b){found.push({id,type,p:[b.x+10,b.story*b.tiers.reduce((n,t)=>n+t.floors,0)*.7,b.z+30],target:[b.x,b.story*b.tiers.reduce((n,t)=>n+t.floors,0)*.58,b.z]});break;}}
  }
  g.renderer.setAnimationLoop(null);g.rig.position.set(0,0,0);g.rig.quaternion.identity();g.rig.scale.setScalar(1);g.giant.root.visible=false;return found;
 });assert.equal(worldTours.length,2);const worldXR=[];
 for(const tour of worldTours){
  await quest.evaluate(async({p,target})=>{const T=await import('three'),g=window.__COLOSSUS,head=new T.Object3D();head.position.set(...p);head.lookAt(...target);head.rotateY(Math.PI);questDevice.position.set(...p);questDevice.quaternion.set(...head.quaternion.toArray());g.renderer.setAnimationLoop(()=>{g.renderer.info.reset();g.renderer.render(g.scene,g.camera);});},tour);
  await quest.waitForFunction(type=>window.__COLOSSUS.city.buildings.components.batches.get(type)?.count>0,tour.type);
  worldXR.push(await quest.evaluate(({id,type})=>{const g=window.__COLOSSUS;return {id,eyes:g.renderer.xr.getCamera().cameras.length,tier:g.city.tier.name,instances:g.city.buildings.components.batches.get(type).count,blocks:g.city.stream.views.size,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls};},tour));
  await quest.screenshot({path:`artifacts/${tour.id}-quest-stereo.png`});
 }
 for(const f of worldXR){assert.equal(f.eyes,2);assert.equal(f.tier,'QUEST');assert.ok(f.instances>0&&f.blocks<=9);}
 assert.deepEqual(errors,[]);const report={result:'PASS',stats,culling,persistence,worldDamage,fogPixels,xr,worldXR,browserErrors:errors};console.log(JSON.stringify(report,null,2));await writeFile('artifacts/streaming-report.json',JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
