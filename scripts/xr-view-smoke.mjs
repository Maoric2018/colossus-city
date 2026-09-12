// Real Quest-profile rendering: verify the visible armor, not just pose packets.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright');
const port=20000+Math.floor(Math.random()*1000),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1200,height:800}});
 await context.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(.25,1.7,.12);questDevice.controllers.left.position.set(-.35,1.1,-.45);questDevice.controllers.right.position.set(.6,1.2,-.55);`});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(20000);
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY===true);await page.locator('#create').click();await page.locator('#resume').click();await page.locator('#vr-button').click();await page.waitForFunction(()=>window.__COLOSSUS.renderer.xr.getCamera().cameras.length===2);
 await page.evaluate(async()=>{
  const T=await import('three');const head=new T.Quaternion().setFromEuler(new T.Euler(-.7,.23,.12,'YXZ'));questDevice.quaternion.set(...head.toArray());
  for(const side of ['left','right']){const q=new T.Quaternion().setFromEuler(new T.Euler(.3,side==='left'?-.2:.4,side==='left'?-.25:.2,'YXZ'));questDevice.controllers[side].quaternion.set(...q.toArray());}
  window.sampleArmor=()=>{const {giant,renderer,xr}=window.__COLOSSUS,eye=renderer.xr.getCamera().cameras[0];return {turn:xr.turn,glow:giant.coreGlow.visible,parts:giant.arms.flatMap((arm,i)=>[arm.upper.armor,arm.lower.armor,arm.fist.children[0]].map((o,j)=>{const m=new T.Matrix4().multiplyMatrices(eye.matrixWorldInverse,o.matrixWorld),position=new T.Vector3(),orientation=new T.Quaternion(),scale=new T.Vector3();m.decompose(position,orientation,scale);return {name:`${i?'right':'left'}-${['upper','forearm','fist'][j]}`,position:position.toArray(),orientation:orientation.toArray(),scale:scale.toArray()};}))};};
 });
 await page.waitForTimeout(250);const before=await page.evaluate(()=>sampleArmor()),samples=[];await page.screenshot({path:'artifacts/xr-hands-before-turn.png'});
 // Keep tilted head and differently oriented wrists stationary while yaw crosses
 // both quarter-turns and the +/- PI wraparound.
 await page.evaluate(()=>questDevice.controllers.right.updateAxes('thumbstick',1,0));
 for(let i=0;i<10;i++){await page.waitForTimeout(450);samples.push(await page.evaluate(()=>sampleArmor()));}
 await page.evaluate(()=>questDevice.controllers.right.updateAxes('thumbstick',0,0));await page.waitForTimeout(100);await page.screenshot({path:'artifacts/xr-hands-after-turn.png'});
 const metrics=await page.evaluate(async({before,samples})=>{const T=await import('three');return before.parts.map((part,i)=>({name:part.name,maxRotation:Math.max(...samples.map(s=>new T.Quaternion(...part.orientation).angleTo(new T.Quaternion(...s.parts[i].orientation)))),maxPosition:Math.max(...samples.map(s=>new T.Vector3(...part.position).distanceTo(new T.Vector3(...s.parts[i].position))))}));},{before,samples});
 const glow=await page.evaluate(()=>{const {giant,views}=window.__COLOSSUS;views.captureXR();const normal=views.context.getImageData(0,0,640,400).data.slice(),visible=giant.coreGlow.visible;giant.coreGlow.visible=false;views.captureXR();const without=views.context.getImageData(0,0,640,400).data;let changed=0;for(let i=0;i<normal.length;i+=4)if(Math.abs(normal[i]-without[i])+Math.abs(normal[i+1]-without[i+1])+Math.abs(normal[i+2]-without[i+2])>12)changed++;giant.coreGlow.visible=visible;return {visible,affectedFraction:changed/(640*400)};});
 let sweptYaw=0,lastTurn=before.turn;for(const s of samples){sweptYaw+=Math.abs(Math.atan2(Math.sin(s.turn-lastTurn),Math.cos(s.turn-lastTurn)));lastTurn=s.turn;}
 const reachSamples=[];for(const reach of [[.08,1.5,-.05],[.4,1.2,-.6],[1.2,1.4,-.3],[.4,2.25,-.2],[.25,.6,.3]]){await page.evaluate(reach=>{questDevice.controllers.right.position.set(...reach);questDevice.controllers.left.position.set(-reach[0],reach[1],reach[2]);},reach);await page.waitForTimeout(140);reachSamples.push(await page.evaluate(()=>{const {giant,xr}=window.__COLOSSUS;return {...sampleArmor(),fistErrors:giant.arms.map((a,i)=>a.fist.position.distanceTo({x:xr.local[i?'right':'left'][0],y:xr.local[i?'right':'left'][1],z:xr.local[i?'right':'left'][2]})),pistons:giant.arms.map(a=>a.piston.visible)};}));}
 const maxScaleChange=Math.max(...reachSamples.flatMap(s=>s.parts.flatMap((p,i)=>p.scale.map((v,j)=>Math.abs(v-before.parts[i].scale[j]))))),maxFistError=Math.max(...reachSamples.flatMap(s=>s.fistErrors));
 assert.ok(maxScaleChange<.00001,'Rigid armor must keep its rendered dimensions through short, long, overhead and backward reaches');assert.ok(maxFistError<.00001,'Fists must stay on tracked controller positions');assert.ok(reachSamples.some(s=>s.pistons.some(Boolean)),'Extreme reach must extend the piston');
 await page.screenshot({path:'artifacts/xr-hands-reach.png'});
 const report={sweptYaw,metrics,glow,reach:{maxScaleChange,maxFistError,poses:reachSamples.length},browserErrors:errors};console.log(JSON.stringify(report,null,2));await writeFile('artifacts/xr-view-report.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.ok(sweptYaw>Math.PI*2,'Exercise more than a full turn');for(const part of metrics){assert.ok(part.maxRotation<.01,`${part.name} twists by ${part.maxRotation} radians during joystick yaw`);assert.ok(part.maxPosition<.01,`${part.name} moves in headset space during joystick yaw`);}assert.equal(glow.visible,false,'The pilot must not see their own decorative reactor halo');assert.equal(glow.affectedFraction,0);
 assert.equal(await page.evaluate(()=>{const {giant,xr}=window.__COLOSSUS;giant.update(xr.local,{local:false});const visible=giant.coreGlow.visible;giant.update(xr.local,{local:true});return visible;}),true,'Other players still see the reactor halo');
 await page.evaluate(()=>window.__COLOSSUS.renderer.xr.getSession().end());
 console.log('PASS: rigid armor dimensions and tracked fists survive reach sweeps and full joystick yaw; no self-reactor halo');
}finally{await browser?.close();server.kill('SIGTERM');}
