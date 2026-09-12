// Actual menu/network spawn, late spectator, streamed blueprint rebuild and crown geometry.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=23000+Math.floor(Math.random()*900),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const watch=page=>{page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const page=await browser.newPage({viewport:{width:1600,height:1000}});watch(page);await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.locator('#create').click();await page.waitForFunction(()=>window.__COLOSSUS.net.room);await page.evaluate(async()=>{const {renderer,scene,camera,rig,city}=window.__COLOSSUS;renderer.setAnimationLoop(null);rig.position.set(0,0,0);rig.scale.setScalar(1);camera.position.set(105,50,175);camera.lookAt(70,40,210);camera.updateMatrixWorld(true);for(let i=0;i<14;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}window.chryslerBefore=city.stream.views.get('1,3');});await page.locator('#spawn-chrysler').click();await page.waitForFunction(()=>!document.getElementById('spawn-status').classList.contains('hidden'));
 const spawned=await page.evaluate(()=>{const g=window.__COLOSSUS,status=document.getElementById('spawn-status').textContent,p=/East (-?\d+), South (-?\d+)/.exec(status);return {room:g.net.room,key:p?`${Number(p[1])/70},${Number(p[2])/70}`:null,status};});assert.ok(spawned.key);await page.waitForFunction(key=>window.__COLOSSUS.city.stream.records.get(key)?.landmark==='chrysler',spawned.key);
 // Freeze only the local renderer while inspecting the authoritative event's blueprint.
 const inspect=async(page,key)=>page.evaluate(async key=>{
  const g=window.__COLOSSUS,{renderer,scene,camera,city,rig}=g,[x,z]=key.split(',').map(Number);renderer.setAnimationLoop(null);rig.position.set(0,0,0);rig.scale.setScalar(1);camera.position.set(x*70-76,70,z*70+84);camera.lookAt(x*70,52,z*70);camera.updateMatrixWorld(true);
  for(let i=0;i<120;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));if(i>=12&&city.stream.views.has(key))break;}
  const view=city.stream.views.get(key),crown=view.cells.find(c=>c.chryslerCrown),types=new Set(view.cells.filter(c=>c.architecture==='chrysler').flatMap(c=>city.buildings.components.entries.get(c.id).map(p=>p.type)));
  return {id:crown.id,p:crown.p,bays:view.cells.filter(c=>c.architecture==='chrysler').length,types:[...types].filter(t=>t.startsWith('chrysler')).length};
 },key);
 const host=await inspect(page,spawned.key);assert.equal(host.types,35);assert.ok(await page.evaluate(key=>window.chryslerBefore!==window.__COLOSSUS.city.stream.views.get(key),spawned.key),'an existing preview rebuilds for the spawned landmark');
 await page.evaluate(()=>{for(const id of ['lobby','brand','status','scene-caption','vignette','overlay','hud'])document.getElementById(id).style.display='none';});await page.screenshot({path:'artifacts/chrysler-spawned.png'});
 const spectator=await browser.newPage({viewport:{width:1000,height:700}});watch(spectator);await spectator.goto(url+`/?quality=quest&room=${spawned.room}`);await spectator.waitForFunction(()=>window.COLOSSUS_ART_READY);await spectator.locator('#spectate').click();await spectator.waitForFunction(()=>window.__COLOSSUS.role==='spectator');await spectator.waitForFunction(key=>window.__COLOSSUS.city.stream.records.get(key)?.landmark==='chrysler',spawned.key);
 assert.ok(await spectator.locator('#spawn-chrysler').isHidden());const late=await inspect(spectator,spawned.key);assert.deepEqual(late,host);
 const persistence=await page.evaluate(async key=>{
  const T=await import('three'),g=window.__COLOSSUS,{city,renderer,scene,camera}=g,tile=city.stream.views.get(key),c=tile.cells.find(c=>c.chryslerCrown),event={id:991999,cells:[c.id],origin:c.p,p:[c.p[0],6,c.p[2]],q:[0,0,Math.sin(.3),Math.cos(.3)],material:c.material,settled:true};
  city.addDebris(event);city.commit();renderer.render(scene,camera);const kit=city.buildings.components,part=kit.entries.get(c.id).find(p=>p.type==='chryslerCrownShell'&&p.side===0);kit.radius=1000;kit.lastPosition=null;kit.select(camera);const matrix=new T.Matrix4();kit.batches.get(part.type).getMatrixAt(part.index,matrix);const expected=new T.Matrix4().compose(new T.Vector3(...event.p),new T.Quaternion(...event.q),new T.Vector3(...c.size));const attached=matrix.elements.every((n,i)=>Math.abs(n-expected.elements[i])<.0001);
  const original=camera.position.clone();camera.position.set(-1400,60,-700);camera.updateMatrixWorld(true);renderer.render(scene,camera);const unloaded=!city.stream.views.has(key);camera.position.copy(original);camera.lookAt(c.p[0],40,c.p[2]);camera.updateMatrixWorld(true);for(let i=0;i<120;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));if(i>=12&&city.stream.views.has(key))break;}
  const restored=city.stream.views.get(key),pose=restored.buildings.pose(c.id);const retained=pose.p.distanceTo(new T.Vector3(...event.p))<.0001&&restored.cells.some(c=>c.chryslerCrown);
  const boxes=[...city.handWorld.near([event.p[0]-10,10,event.p[2]],[event.p[0]+10,30,event.p[2]],40)].filter(b=>b.cell===c.id).length;
  city.reset();return {attached,unloaded,retained,boxes,reset:city.stream.previews.size===0&&city.stream.records.size===0};
 },spawned.key);assert.ok(persistence.attached&&persistence.unloaded&&persistence.retained&&persistence.boxes>0&&persistence.reset,JSON.stringify(persistence));
 await spectator.close();await page.close();
 // Verify the crown, spire and both eyes on the actual Quest rendering path.
 const context=await browser.newContext({viewport:{width:1200,height:800}});await context.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+'\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);'});
 const quest=await context.newPage();watch(quest);await quest.goto(url+'/?quality=quest');await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('[data-role="boss"]').click();await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);
 await quest.evaluate(()=>{const g=window.__COLOSSUS;g.renderer.setAnimationLoop(null);questDevice.position.set(-4.5,7,3);});
 // XR pose updates are supplied through the emulated headset; retain real stereo submission.
 await quest.evaluate(()=>{const g=window.__COLOSSUS;g.renderer.setAnimationLoop(()=>{g.renderer.info.reset();g.renderer.render(g.scene,g.camera);});});await quest.waitForTimeout(400);
 const xr=await quest.evaluate(()=>{const g=window.__COLOSSUS,kit=g.city.buildings.components;return {eyes:g.renderer.xr.getCamera().cameras.length,crownCount:kit.batches.get('chryslerCrownShell').count,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls};});assert.equal(xr.eyes,2);assert.ok(xr.crownCount>0);await quest.screenshot({path:'artifacts/chrysler-quest-stereo.png'});
 assert.deepEqual(errors,[]);const report={result:'PASS',spawned,host,late,persistence,xr,errors};console.log(JSON.stringify(report,null,2));await writeFile('artifacts/chrysler-report.json',JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
