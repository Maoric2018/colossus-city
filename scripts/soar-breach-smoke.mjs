// Render real authoritative breach events with delayed snapshots and local prediction.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
import {v} from '../shared/math.js';
import {encodeSnapshot,decodeSnapshot} from '../shared/protocol.js';
await physicsReady;await mkdir('artifacts',{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=24000+Math.floor(Math.random()*800),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
const room=new Room('ABC123'),ws={send(){},readyState:1};room.attach(ws,'boss','giant');const client=room.attach(ws,'raider','pilot'),player=room.players.get(client.id),bounds=room.buildingBounds[5],cell=room.cellsByBuilding[5].find(c=>c.floor===3&&c.walls[2]);
room.spawn(player,v(cell.p[0],cell.p[1],bounds[5]+5));player.body.setLinvel(v(0,0,-32),true);player.invulnerable=0;room.drainEvents();
const initial=room.snapshot().players.find(p=>p.id===client.id),timeline=[];
for(let i=0;i<45;i++){const input={type:'input',x:0,z:-1,up:0,yaw:0,pitch:.07,soar:true,dodge:0,seq:i+1};room.input(client,input);room.step();timeline.push({input,events:i%3===2?room.drainEvents():[],snapshot:i%3===2?decodeSnapshot(encodeSnapshot(room.snapshot())):null});}
let browser;
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?quality=low');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(async initial=>{
  const c=window.__COLOSSUS,{state}=await import('/src/app/state.js'),{RaiderView}=await import('/src/avatars.js'),{makeEventHandler}=await import('/src/app/events.js'),{CameraRig}=await import('/src/app/camera.js');
  c.renderer.setAnimationLoop(null);c.rig.position.set(0,0,0);c.rig.scale.setScalar(1);c.giant.root.visible=false;document.body.replaceChildren(c.renderer.domElement,document.getElementById('flight-effects'));
  state.role='raider';state.localId=initial.id;state.firstPerson=false;c.prediction.reset(initial);
  const pilot=new RaiderView(c.scene,initial.id);await pilot.ready;
  const handler=makeEventHandler({...c,hud:{},shake:{add(){}},city:c.city,addRag(){},rags:new Map(),listenerPosition:()=>Object.values(c.prediction.position())});
  const cameraRig=new CameraRig(c.camera,c.rig,c.city,{update:()=>({x:0,y:0,roll:0})},c.prediction);cameraRig.reset(initial.p);
  window.breachPreview={pilot,handler,cameraRig,initial,latest:initial,time:0,comparisons:[],bluePulse:false};
 },initial);
 for(let i=0;i<timeline.length+6;i++){
  await page.evaluate(({frame,delivered})=>{
   const c=window.__COLOSSUS,b=window.breachPreview;
   if(delivered){for(const e of delivered.events)b.handler(e);if(delivered.snapshot){b.latest=delivered.snapshot.players.find(p=>p.id===b.initial.id);b.time=delivered.snapshot.time;c.prediction.reconcile(b.latest,.1);for(const body of delivered.snapshot.bodies)c.city.poseDebris(body.id,body.p,body.q);}}
   if(frame)c.prediction.advance(frame.input,1/60,frame.input.seq,b.time);
   const pos=c.prediction.position(),vel=c.prediction.velocity(),p={...b.latest,p:[pos.x,pos.y,pos.z],v:[vel.x,vel.y,vel.z],flags:16,yaw:0,pitch:.07};
   b.pilot.update(p,true,false,1/60,b.time);c.city.update(1/60);c.fx.update(1/60);b.bluePulse||=c.flightFX.pulse>0;c.flightFX.update(1/60,p,true);
   b.cameraRig.update(1/60,{players:[p]},{input:{yaw:0,pitch:.07,charge:0,held:()=>({x:0,z:-1,up:0,soar:true})},net:{lead:.1}});c.renderer.render(c.scene,c.camera);
   b.comparisons.push({pos:p.p,speed:Math.hypot(...p.v)});
  },{frame:timeline[i]||null,delivered:timeline[i-6]||null});
  if([11,32,50].includes(i))await page.screenshot({path:`artifacts/soar-breach-${i}.png`});
 }
 const result=await page.evaluate(()=>{const c=window.__COLOSSUS,b=window.breachPreview;return {position:c.prediction.position(),server:b.latest.p,broken:[...c.city.fine.cells.keys()],fragments:c.city.fine.shards.size,pulse:b.bluePulse,minimumSpeed:Math.min(...b.comparisons.map(p=>p.speed)),backwardSteps:b.comparisons.slice(1).filter((p,i)=>p.pos[2]>b.comparisons[i].pos[2]+.2).length,failedAssets:c.assetStatus.failed};});
 assert.ok(result.position.z<bounds[2]-2);assert.ok(result.broken.length>=2&&result.fragments>0&&result.pulse);assert.ok(result.minimumSpeed>25);assert.equal(result.backwardSteps,0);assert.deepEqual(result.failedAssets,[]);assert.deepEqual(errors,[]);
 const report={result:'PASS',...result,browserErrors:errors};await writeFile('artifacts/soar-breach-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();room.dispose();server.kill('SIGTERM');}
