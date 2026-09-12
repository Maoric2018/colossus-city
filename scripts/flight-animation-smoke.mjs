// Real GPU skinning of the downloaded pilot, timed transitions and animated attachments.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=22000+Math.floor(Math.random()*900),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1400,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);await page.waitForLoadState('networkidle');
 const checks=await page.evaluate(async()=>{
  const T=await import('three'),{RaiderView}=await import('/src/avatars.js'),{renderer}=window.__COLOSSUS;
  renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0x314c63);scene.add(new T.HemisphereLight(0xcceeff,0x4a4341,2.5));const sun=new T.DirectionalLight(0xffe4c7,3);sun.position.set(-3,8,-5);scene.add(sun);
  const camera=new T.PerspectiveCamera(38,1400/900,.03,100);camera.position.set(4,3.6,-6);camera.lookAt(0,1.4,0);
  const floor=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:0x344653,roughness:.9}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const pilots=[new RaiderView(scene,1),new RaiderView(scene,1),new RaiderView(scene,2)];await Promise.all(pilots.map(p=>p.ready));
  const state={p:[0,1.6,0],v:[0,0,-26],yaw:0,pitch:0,flags:16,fuel:1};
  for(const [i,fps]of [30,144].entries())for(let n=0;n<fps*.5;n++)pilots[i].update(state,false,false,1/fps,(n+1)/fps);
  const frameRateError=Math.abs(pilots[0].flight.blend-pilots[1].flight.blend),independent=pilots[0].skin.skeleton!==pilots[1].skin.skeleton;
  const live=pilots[0];pilots[1].root.visible=false;pilots[2].root.visible=false;
  for(let n=0;n<100;n++)live.update(state,false,false,1/60,1);
  const snapshot=()=>{scene.updateMatrixWorld(true);live.skin.skeleton.update();const vertex=new T.Vector3(),vertices=[];for(let i=0;i<live.skin.geometry.attributes.position.count;i+=13){live.skin.getVertexPosition(i,vertex);vertices.push(vertex.toArray());}return {vertices,wrist:live.bones.get('lowerR').getWorldPosition(new T.Vector3()).toArray(),jet:live.jets[0].getWorldPosition(new T.Vector3()).toArray()};};
  const before=snapshot();live.update(state,false,false,1/60,1.6);const after=snapshot();const movement=Math.max(...before.vertices.map((p,i)=>new T.Vector3(...p).distanceTo(new T.Vector3(...after.vertices[i])))),jetMotion=new T.Vector3(...before.jet).distanceTo(new T.Vector3(...after.jet));
  const fuelState={...state,fuel:0};live.update(fuelState,true,true,1/60,1.6);const hidden=!live.root.visible,jetsOff=live.jets.every(j=>!j.visible);
  for(let n=0;n<80;n++)live.update({...state,flags:0,v:[0,0,0]},false,false,1/60,2+n/60);
  const returned=live.flight.blend<.001&&Math.abs(live.mesh.rotation.x)<.002;
  const sample=(label,flags,time,velocity,frames=100)=>{for(let n=0;n<frames;n++)live.update({...state,flags,v:velocity},false,false,1/60,time);scene.updateMatrixWorld(true);renderer.render(scene,camera);document.title=label;};
  window.flightPreview={scene,camera,live,pilots,state,sample};sample('Hover',0,0,[0,0,0]);
  return {frameRateError,independent,movement,jetMotion,hidden,jetsOff,returned,bones:live.skin.skeleton.bones.length,failedAssets:window.__COLOSSUS.assetStatus.failed};
 });
 await page.screenshot({path:'artifacts/raider-flight-hover.png'});
 await page.evaluate(()=>window.flightPreview.sample('Soaring',16,1,[0,0,-26]));await page.screenshot({path:'artifacts/raider-flight-soar.png'});
 await page.evaluate(()=>window.flightPreview.sample('Bank and dodge',48,1.7,[14,2,-24]));await page.screenshot({path:'artifacts/raider-flight-bank.png'});
 await page.evaluate(()=>window.flightPreview.sample('Braking',0,2.1,[0,0,-15],5));await page.screenshot({path:'artifacts/raider-flight-brake.png'});
 // Capture actual frames to make the continuous limb motion reviewable, not just a static pose.
 const video=await page.evaluate(async()=>{
  const {renderer}=window.__COLOSSUS,{scene,camera,live,state}=window.flightPreview,stream=renderer.domElement.captureStream(30),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
  live.flight.blend=0;const start=performance.now();await new Promise(resolve=>{let last=start;function frame(now){const t=(now-start)/1000,dt=(now-last)/1000;last=now;live.update({...state,flags:t>.5&&t<3.8?16:0,v:t>1.8&&t<3?[10,0,-26]:[0,0,-26]},false,false,dt,t);renderer.render(scene,camera);if(t<4.6)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
 });await writeFile('artifacts/raider-soaring.webm',Buffer.from(video));
 assert.ok(checks.frameRateError<1e-6);assert.ok(checks.independent&&checks.hidden&&checks.jetsOff&&checks.returned);assert.ok(checks.movement>.04&&checks.jetMotion>.001,JSON.stringify(checks));assert.equal(checks.bones,11);assert.deepEqual(checks.failedAssets,[]);assert.deepEqual(errors,[]);
 const report={result:'PASS',checks,errors};await writeFile('artifacts/flight-animation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
