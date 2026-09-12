// Render the actual imported armor at wrist poses, and compare visible vertices
// to the shared solid hand used by the real server and local Quest preview.
import assert from 'node:assert/strict';
import {activeEnvironment,generateCells} from '../shared/environment.js';
import {GIANT} from '../shared/giant-rig.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=21000+Math.floor(Math.random()*1000),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY,{timeout:60000});
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{GiantView}=await import('/src/avatars.js'),{GIANT,box}=await import('/shared/giant-rig.js'),{renderer}=window.__COLOSSUS;
  renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color(0x152832);scene.add(new T.HemisphereLight(0xe0f7ff,0x4d5b64,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-12,28,-20);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshStandardMaterial({color:0x334c59}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const giant=new GiantView(scene);await giant.ready;const camera=new T.PerspectiveCamera(45,1.6,.05,250),pose={head:[0,23.8,0],left:[-7,13,-5],right:[7,13,-5],bossYaw:0,leftQuaternion:[0,0,0,1],rightQuaternion:[0,0,0,1]};giant.update(pose);scene.updateMatrixWorld(true);
  const parts=giant.arms.map(arm=>({upper:new T.Box3().setFromBufferAttribute(arm.upper.armor.geometry.attributes.position).getSize(new T.Vector3()).toArray(),lower:new T.Box3().setFromBufferAttribute(arm.lower.armor.geometry.attributes.position).getSize(new T.Vector3()).toArray(),hand:new T.Box3().setFromBufferAttribute(arm.fist.children[0].geometry.attributes.position).getSize(new T.Vector3()).multiply(arm.fist.children[0].scale).toArray()}));
  let maxWristError=0,maxHandOverlap=0;
  for(const pitch of [-.7,0,.7])for(const roll of [-.6,0,.6]){
   pose.rightQuaternion=new T.Quaternion().setFromEuler(new T.Euler(pitch,0,roll)).toArray();giant.update(pose);scene.updateMatrixWorld(true);const arm=giant.arms[1],wrist=new T.Vector3(...GIANT.wrist).applyQuaternion(arm.fist.quaternion).add(arm.fist.position);maxWristError=Math.max(maxWristError,wrist.distanceTo(arm.wrist.position));
   // Count shell vertices that intrude into the palm's OBB at ordinary wrist angles.
   const transform=new T.Matrix4().copy(arm.fist.matrixWorld).invert().multiply(arm.lower.armor.matrixWorld),vertices=arm.lower.armor.geometry.attributes.position;let overlapping=0;
   for(let i=0;i<vertices.count;i++){const p=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(transform);if(Math.abs(p.x)<GIANT.handHalf[0]&&Math.abs(p.y)<GIANT.handHalf[1]&&Math.abs(p.z)<GIANT.handHalf[2])overlapping++;}
   maxHandOverlap=Math.max(maxHandOverlap,overlapping/vertices.count);
  }
  pose.rightQuaternion=[0,0,0,1];giant.update(pose);camera.position.set(30,23,-44);camera.lookAt(0,13,0);renderer.render(scene,camera);window.giantPreview={T,giant,scene,camera,pose,box};return {parts,maxWristError,maxHandOverlap};
 });
 await page.screenshot({path:'artifacts/giant-anatomy.png'});
 await page.evaluate(()=>{const {renderer}=window.__COLOSSUS,{camera,scene}=window.giantPreview;camera.position.set(15,17,-16);camera.lookAt(7,14,-2);renderer.render(scene,camera);});await page.screenshot({path:'artifacts/giant-wrist.png'});
 const contact=await page.evaluate(()=>{
  const {renderer}=window.__COLOSSUS,{T,giant,pose,box,scene,camera}=window.giantPreview,wall=new T.Mesh(new T.BoxGeometry(7,18,.3),new T.MeshStandardMaterial({color:0x8d9c9e}));wall.position.set(7,9,-9);scene.add(wall);const obstacle=box([7,9,-9],[3.5,9,.15]),world={*near(){yield obstacle;}};
  pose.right=[7,13,-5];giant.update(pose);pose.right=[7,13,-12];giant.update(pose,{collisionWorld:world});scene.updateMatrixWorld(true);
  const arm=giant.arms[1],mesh=arm.fist.children[0],vertices=mesh.geometry.attributes.position;let deepest=0;for(let i=0;i<vertices.count;i++){const p=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);deepest=Math.max(deepest,-8.85-p.z);}
  camera.position.set(21,19,-15);camera.lookAt(6,13,-7);renderer.render(scene,camera);return {deepest,raw:pose.right,visible:arm.fist.position.toArray(),contacts:arm.contacts.length};
 });
 await page.screenshot({path:'artifacts/giant-wall-contact.png'});Object.assign(report,{contact,errors});console.log(JSON.stringify(report,null,2));await writeFile('artifacts/giant-contact-report.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.equal(report.maxWristError,0);assert.equal(report.maxHandOverlap,0,'Forearm armor must stay outside the palm throughout ordinary wrist poses');assert.ok(contact.contacts>0);assert.equal(contact.deepest,0,'No visible fist vertex may pass through the wall');for(const part of report.parts){assert.ok(Math.abs(part.lower[1]-.88)<.0001);assert.deepEqual(part.hand,[2.9,2.5,2.8]);}
 // Exercise local hand blocking against the real city and authoritative server
 // with Quest controller input, without replacing the live game frame loop.
 const wallCell=generateCells(activeEnvironment).find(c=>c.architecture==='chrysler'&&c.floor===4&&c.iz===2&&c.walls[1]);
 const handStart=wallCell.p[0]+wallCell.size[0]/2+GIANT.handHalf[0]+1;
 const context=await browser.newContext({viewport:{width:1200,height:800}});
 await context.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(-12/14,1.7,0);questDevice.controllers.left.position.set(-12/14-.4,1.2,-.3);questDevice.controllers.right.position.set(${handStart}/14,${wallCell.p[1]}/14,${wallCell.p[2]}/14);`});
 const quest=await context.newPage();quest.on('pageerror',e=>errors.push(e.message));quest.setDefaultTimeout(20000);await quest.goto(url);await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.isPresenting);await quest.waitForTimeout(300);
 await quest.evaluate(()=>{window.contactEvents=[];const net=window.__COLOSSUS.net,receive=net.onMessage;net.onMessage=m=>{if(m.type==='events')contactEvents.push(...m.events.filter(e=>e.type==='strike'||e.type==='skin'));receive(m);};});
 for(let i=0;i<24;i++){await quest.evaluate(()=>questDevice.controllers.right.position.x-=.005);await quest.waitForTimeout(45);if(await quest.evaluate(()=>window.__COLOSSUS.giant.arms[1].contacts.length>0))break;}
 await quest.waitForFunction(()=>{const {giant,xr,net}=window.__COLOSSUS;return giant.arms[1].contacts.length&&net.latest.right[0]-xr.local.right[0]>.005;}).catch(async error=>{console.log('Contact diagnostic',await quest.evaluate(()=>{const {giant,xr,net}=window.__COLOSSUS;return {contacts:giant.arms[1].contacts,raw:xr.local.right,visible:giant.arms[1].fist.position.toArray(),server:net.latest.right};}));await quest.screenshot({path:'artifacts/quest-contact-diagnostic.png'});throw error;});
 const contactTick=await quest.evaluate(()=>window.__COLOSSUS.net.latest.tick);await quest.waitForFunction(tick=>window.__COLOSSUS.net.latest.tick>=tick+6,contactTick);
 const tracked=await quest.evaluate(()=>{const {giant,xr,net}=window.__COLOSSUS;return {raw:xr.local.right,visible:giant.arms[1].fist.position.toArray(),server:net.latest.right,eyes:window.__COLOSSUS.renderer.xr.getCamera().cameras.length,contactEvents};});
 console.log('Quest wall contact:',tracked);assert.equal(tracked.eyes,2);assert.ok(tracked.contactEvents.some(e=>e.type==='strike'&&e.cell),'A visible Quest contact must receive an authoritative strike');assert.ok(tracked.contactEvents.some(e=>e.type==='skin'),'The contacted window must open immediately');assert.ok(tracked.visible[0]-tracked.raw[0]>.005);assert.ok(Math.abs(tracked.visible[0]-tracked.server[0])<.03,'Local Quest contact must match authoritative wall contact without waiting for interpolation');
 await quest.screenshot({path:'artifacts/quest-hand-contact.png'});report.tracked=tracked;await writeFile('artifacts/giant-contact-report.json',JSON.stringify(report,null,2));await quest.evaluate(()=>window.__COLOSSUS.renderer.xr.getSession().end());
}finally{await browser?.close();server.kill('SIGTERM');}
