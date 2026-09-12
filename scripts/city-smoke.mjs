// Real rendered architectural kits, collapse attachments and persistent skin fragments.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=19000+Math.floor(Math.random()*900),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{const {renderer,rig}=window.__COLOSSUS;renderer.setAnimationLoop(null);rig.position.set(0,0,0);document.body.replaceChildren(renderer.domElement);});
 const views=[['dense-city',[230,195,220],[0,25,0]],['twin-towers',[100,100,-145],[0,55,-70]],['empire-state',[-130,95,-135],[-70,58,-70]],['building-components',[-54,15,95],[-70,11,70]]];
 const stats={};
 for(const [name,p,target] of views){
  stats[name]=await page.evaluate(({p,target})=>{const {renderer,camera,scene}=window.__COLOSSUS;camera.position.set(...p);camera.lookAt(...target);renderer.info.reset();renderer.render(scene,camera);return {...renderer.info.render};},{p,target});
  await page.screenshot({path:`artifacts/${name}.png`});
 }
 const checks=await page.evaluate(async()=>{
  const T=await import('three'),{city,renderer,camera,scene}=window.__COLOSSUS;
  city.buildings.components.lastPosition=null;city.buildings.components.radius=1000;city.buildings.components.select(camera);
  const c=city.cells.find(c=>c.building===5&&c.roof&&c.walls[2]),e=city.buildings.pose(c.id),kit=city.buildings.components,part=kit.entries.get(c.id).find(p=>p.type==='cornice'&&p.side===2),mesh=kit.batches.get(part.type),before=new T.Matrix4();mesh.getMatrixAt(part.index,before);
  const rotation=[0,0,Math.sin(.4),Math.cos(.4)];city.addDebris({id:9900,cells:[c.id],origin:c.p,p:[-58,4,72],q:rotation,material:c.material});city.commit();const after=new T.Matrix4();mesh.getMatrixAt(part.index,after);const expected=new T.Matrix4().compose(e.p,e.q,new T.Vector3(...c.size)).multiply(new T.Matrix4().makeRotationY(-Math.PI));
  const attached=after.elements.every((v,i)=>Math.abs(v-expected.elements[i])<.0001)&&!after.equals(before);
  city.setSkin(c.id,0,0,true);city.commit();for(let i=0;i<600;i++)city.update(1/60);
  const count=city.fragments.pieces.size,fragments=[...city.fragments.pieces.values()],settled=fragments.every(e=>e.age>=e.duration);
  const transforms=fragments.map(e=>{const m=new T.Matrix4();e.mesh.getMatrixAt(e.index,m);return m.toArray();});
  for(let i=0;i<1000;i++)city.update(1/60);const persists=city.fragments.pieces.size===count&&count>0;
  city.reset();const reset=city.fragments.pieces.size===0;city.setSkin(c.id,0,0,false);city.commit();
  const late=[...city.fragments.pieces.values()].map(e=>{const m=new T.Matrix4();e.mesh.getMatrixAt(e.index,m);return m.toArray();});
  const lateJoin=JSON.stringify(transforms)===JSON.stringify(late);
  // Restore the settled structural assembly too, as a newly joined spectator would.
  city.addDebris({id:9900,cells:[c.id],origin:c.p,p:[-58,4,72],q:rotation,settled:true,material:c.material});city.commit();
  const fixed=city.buildings.pose(c.id).p.clone();city.poseDebris(9900,[100,100,100],[0,0,0,1]);const finalPose=fixed.equals(city.buildings.pose(c.id).p);
  camera.position.set(-50,12,90);camera.lookAt(-66,3,70);renderer.render(scene,camera);
  return {buildings:city.env.buildings.length,bays:city.cells.length,componentTypes:kit.batches.size,attached,count,settled,persists,reset,lateJoin,finalPose,failedAssets:window.__COLOSSUS.assetStatus.failed};
 });
 assert.ok(checks.attached&&checks.settled&&checks.persists&&checks.reset&&checks.lateJoin&&checks.finalPose);assert.equal(checks.componentTypes,101);assert.deepEqual(checks.failedAssets,[]);
 await page.screenshot({path:'artifacts/persistent-rubble.png'});assert.deepEqual(errors,[]);
 const report={result:'PASS',checks,stats,artifacts:[...views.map(v=>v[0]+'.png'),'persistent-rubble.png']};await writeFile('artifacts/city-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
