// Check the real Quest rendering path and the new landmarks' moving attachments.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=24500+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const context=await browser.newContext({viewport:{width:1400,height:900}});
 await context.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+'\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);'});
 const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);await page.locator('[data-role="boss"]').click();await page.locator('#create').click();await page.locator('#resume').click();await page.locator('#vr-button').click();await page.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);
 await page.evaluate(()=>{const g=window.__COLOSSUS;g.renderer.setAnimationLoop(null);g.rig.position.set(0,0,0);g.rig.quaternion.identity();g.rig.scale.setScalar(1);});
 const frames=[];
 for(const [name,p,target,type] of [['vanderbilt',[108,100,40],[67,94,2],'vanderbiltCrownShell'],['hudson',[110,100,-38],[72,100,-70],'hudsonEdgePlate']]){
  await page.evaluate(async({p,target})=>{const T=await import('three'),g=window.__COLOSSUS,head=new T.Object3D();head.position.set(...p);head.lookAt(...target);head.rotateY(Math.PI);questDevice.position.set(...p);questDevice.quaternion.set(...head.quaternion.toArray());g.renderer.setAnimationLoop(()=>{g.renderer.info.reset();g.renderer.render(g.scene,g.camera);});},{p,target});
  await page.waitForFunction(type=>window.__COLOSSUS.city.buildings.components.batches.get(type).count>0,type);
  await page.waitForTimeout(200);frames.push(await page.evaluate(type=>{const g=window.__COLOSSUS;return {eyes:g.renderer.xr.getCamera().cameras.length,type,instances:g.city.buildings.components.batches.get(type).count,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls,tier:g.city.tier.name};},type));
  await page.screenshot({path:`artifacts/${name}-quest-stereo.png`});
 }
 for(const f of frames){assert.equal(f.eyes,2);assert.equal(f.tier,'QUEST');assert.ok(f.instances>0);}
 await page.evaluate(async()=>{await window.__COLOSSUS.renderer.xr.getSession().end();});await page.waitForFunction(()=>!window.__COLOSSUS.renderer.xr.isPresenting);
 const attachments=await page.evaluate(async()=>{
  const T=await import('three'),{renderer,scene,camera,rig,city}=window.__COLOSSUS;renderer.setAnimationLoop(null);rig.position.set(0,0,0);rig.scale.setScalar(1);rig.quaternion.identity();const result=[];
  for(const [flag,type] of [['hudsonEdge','hudsonEdgePlate'],['vanderbiltCrown','vanderbiltCrownShell']]){
   const c=city.cells.find(c=>c[flag]),p=[c.p[0]+20,18,c.p[2]+20],q=[0,0,Math.sin(.28),Math.cos(.28)];city.addDebris({id:99000+c.id,cells:[c.id],origin:c.p,p,q,material:c.material,settled:true});
   camera.position.set(p[0]+18,p[1]+10,p[2]+22);camera.lookAt(...p);renderer.render(scene,camera);
   const kit=city.buildings.components,part=kit.entries.get(c.id).find(p=>p.type===type),actual=new T.Matrix4(),expected=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion(...q),new T.Vector3(...c.size));assertIndex(part);kit.batches.get(type).getMatrixAt(part.index,actual);
   result.push({type,attached:actual.elements.every((n,i)=>Math.abs(n-expected.elements[i])<.0001)});
  }
  function assertIndex(p){if(p.index<0)throw new Error('Attachment not visible');}
  const materials=['hudson30','vanderbilt'].map(k=>{const m=city.buildings.glass[k].material;return {name:k,opaque:!m.transparent&&m.opacity===1&&m.depthWrite,visibleBothSides:m.side===T.DoubleSide};});
  return {parts:result,materials,failedAssets:window.__COLOSSUS.assetStatus.failed};
 });
 assert.ok(attachments.parts.every(p=>p.attached));assert.ok(attachments.materials.every(m=>m.opaque&&m.visibleBothSides));assert.deepEqual(attachments.failedAssets,[]);assert.deepEqual(errors,[]);
 const report={result:'PASS',frames,attachments,errors};await writeFile('artifacts/landmark-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
