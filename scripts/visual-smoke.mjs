// Checks imported art against real Rapier destruction, including rooftop movement.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright');
const port=19000+Math.floor(Math.random()*1000),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY,{timeout:60000});await page.waitForLoadState('networkidle');
 assert.deepEqual(await page.evaluate(()=>window.__COLOSSUS.assetStatus.failed),[]);
 const attached=await page.evaluate(()=>[...window.__COLOSSUS.city.attachments.keys()]);assert.ok(attached.length>20,'Imported roof models must be installed');
 await page.screenshot({path:'artifacts/visual-lobby.png'});
 await page.evaluate(()=>{const {renderer,rig,camera,scene}=window.__COLOSSUS;renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);rig.position.set(0,0,0);camera.position.set(43,30,56);camera.lookAt(0,10,0);renderer.info.reset();renderer.render(scene,camera);});
 await page.screenshot({path:'artifacts/visual-city.png'});
 await physicsReady;const room=new Room('VISUAL');
 let events,poses;
 try{
  room.breakCells(room.cells.filter(c=>c.building===3&&c.ground).map(c=>c.id),{x:-12,y:0,z:16});events=room.drainEvents().filter(e=>e.type==='debris');assert.ok(events.length>0);
  for(let i=0;i<140;i++)room.world.step();poses=[...room.debris.values()].map(e=>({id:e.id,p:Object.values(e.body.translation()),q:Object.values(e.body.rotation())}));
 }finally{room.dispose();}
 const checks=await page.evaluate(async({events,poses})=>{
  const T=await import('three'),{city,renderer,camera,scene,fx,giant}=window.__COLOSSUS;
  const affected=events.flatMap(e=>e.cells),roofId=affected.find(id=>city.attachments.has(id));if(!roofId)throw Error('No downloaded rooftop in this collapse');
  const part=city.attachments.get(roofId)[0],before=new T.Matrix4();part.batch.getMatrixAt(part.index,before);
  for(const event of events)city.addDebris(event);for(const pose of poses)city.poseDebris(pose.id,pose.p,pose.q);city.commit();
  const after=new T.Matrix4();part.batch.getMatrixAt(part.index,after);const moved=!after.equals(before);
  const state=city.transforms.get(roofId),expected=new T.Matrix4().compose(state.p,state.q,new T.Vector3(1,1,1)).multiply(part.local);
  const aligned=after.elements.every((v,i)=>Math.abs(v-expected.elements[i])<.0001);
  fx.impact([24,7,22],1.7);for(let i=0;i<18;i++)fx.update(1/60);renderer.render(scene,camera);
  return {moved,aligned,roofId,particles:fx.smoke.items.length+fx.dust.items.length};
 },{events,poses});
 assert.ok(checks.moved&&checks.aligned,'Roof props must follow actual fallen-cell transforms');assert.ok(checks.particles>0);
 await page.screenshot({path:'artifacts/visual-destruction.png'});
 const removal=await page.evaluate(async({events,roofId})=>{const T=await import('three'),{city}=window.__COLOSSUS,part=city.attachments.get(roofId)[0],m=new T.Matrix4();for(const e of events)city.removeDebris(e.id);part.batch.getMatrixAt(part.index,m);const hidden=m.elements[0]===0&&m.elements[5]===0&&m.elements[10]===0;city.reset();part.batch.getMatrixAt(part.index,m);return {hidden,restored:m.determinant()>0};},{events,roofId:checks.roofId});assert.ok(removal.hidden&&removal.restored);
 await page.evaluate(()=>{const {renderer,camera,scene,giant,fx}=window.__COLOSSUS;camera.position.set(13,10,-40);camera.lookAt(0,15,0);giant.update({head:[0,24,0],left:[-8,12,-3],right:[9,17,-6],bossYaw:0});fx.impact([6,3,-12],1.2);fx.update(.16);renderer.render(scene,camera);});
 await page.screenshot({path:'artifacts/visual-street.png'});
 assert.deepEqual(errors,[]);const report={result:'PASS',checks:['Imported models, photographic textures and HDR sky load without errors','Downloaded roof equipment follows real Rapier collapse transforms','Rubble removal hides attached art; reset restores it','Downloaded smoke, sparks and impact sprites render successfully'],artifacts:['visual-lobby.png','visual-city.png','visual-destruction.png','visual-street.png']};await writeFile('artifacts/visual-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
