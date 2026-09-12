// Replay a real lethal server event through the normal app loop, then inspect
// actual imported robot pieces, delayed results, spectator pixels and XR views.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
await physicsReady;await mkdir('artifacts',{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=29000+Math.floor(Math.random()*700),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
const room=new Room('DEA123'),socket={send(){}},boss=room.attach(socket,'boss','robot'),raider=room.attach(socket,'raider','pilot');room.step();
const welcome=room.welcome(raider),bossWelcome=room.welcome(boss),alive=room.snapshot();room.hurtBoss(room.bossHP,{kind:'shot'});room.step();
const event=room.drainEvents().find(e=>e.type==='end'),snapshot=room.snapshot();let browser;
const watch=page=>{page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
async function install(page,welcome){
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(async({welcome,alive})=>{
  const c=window.__COLOSSUS,{state}=await import('/src/app/state.js');c.views.connect=()=>{};c.net.send=()=>true;c.net.id=welcome.id;c.net.role=welcome.role;c.net.onMessage(welcome);
  state.playing=true;state.paused=false;document.body.classList.add('playing');for(const id of ['lobby','scene-caption','overlay'])document.getElementById(id).classList.add('hidden');document.getElementById('hud').classList.remove('hidden');
  window.replaySnapshot=alive;c.net.latest=alive;c.net.sample=()=>window.replaySnapshot;c.camera.position.set(28,24,-44);window.deathSounds=[];c.audio.play=(kind)=>deathSounds.push(kind);
 },{welcome,alive});
}
async function kill(page,age=0){
 await page.evaluate(({event,snapshot,age})=>{
  const c=window.__COLOSSUS;window.replaySnapshot=snapshot;c.net.latest=snapshot;c.net.onMessage({type:'events',events:[event]});
  c.ending.startedNow=performance.now()-age*1000;c.net.sample=()=>({...snapshot,time:event.time+(performance.now()-c.ending.startedNow)/1000});
 },{event,snapshot,age});
}
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);await install(page,welcome);await kill(page);
 const shots=[];
 for(const age of [.7,1.85,2.5,4,6.7]){
  await page.waitForFunction(age=>window.__COLOSSUS.ending.elapsed>=age,age);
  const shot=await page.evaluate(()=>{const c=window.__COLOSSUS,d=c.ending.death;return {age:c.ending.elapsed,pieces:d.pieces.length,giantVisible:c.giant.root.visible,results:c.ending.revealed,overlay:!document.getElementById('overlay').classList.contains('hidden'),title:document.getElementById('round-transition-title').textContent,explosions:deathSounds.filter(s=>s==='explosion').length,particles:c.fx.smoke.items.length+c.fx.sparks.items.length,camera:c.camera.position.toArray()};});shots.push(shot);
  await page.screenshot({path:`artifacts/colossus-death-${age}.png`});
 }
 assert.equal(shots[0].giantVisible,true);assert.equal(shots[0].results,false);assert.equal(shots[0].overlay,false);assert.equal(shots[0].title,'CORE FAILURE');
 for(const s of shots.slice(1)){assert.equal(s.giantVisible,false);assert.ok(s.pieces>=25&&s.pieces<=80);}
 assert.equal(shots[3].results,false);assert.equal(shots[4].results,true);assert.equal(shots[4].overlay,true);assert.ok(shots[4].explosions>=12);
 const pieces=await page.evaluate(async()=>{
  const c=window.__COLOSSUS,T=await import('three'),{ColossusDeath}=await import('/src/colossus-death.js');c.renderer.setAnimationLoop(null);const d=c.ending.death;d.update(10);
  const original=new Set();c.giant.root.traverse(o=>{if(o.isMesh)original.add(o.geometry);});let reused=0,meshes=0;d.root.traverse(o=>{if(o.isMesh){meshes++;if(original.has(o.geometry))reused++;}});
  const poses=d.pieces.map(p=>p.group.position.toArray()),late=new ColossusDeath(c.scene,c.giant);late.start(c.ending.result.pose,c.ending.result.round);late.update(10);
  const error=Math.max(...late.pieces.map((p,i)=>p.group.position.distanceTo(new T.Vector3(...poses[i]))));
  const groundError=Math.max(...d.pieces.map(p=>Math.abs(new T.Box3().setFromObject(p.group).min.y-.08)));
  late.reset();late.root.removeFromParent();c.giant.root.visible=false;d.root.visible=true;c.views.getState=()=>c.state;c.views.getPlayerId=()=>c.net.id;c.views.getPaused=()=>false;c.views.context.drawImage(c.renderer.domElement,0,0,640,400);c.views.drawHUD();
  const finite=d.pieces.every(p=>[...p.group.position.toArray(),...p.group.quaternion.toArray()].every(Number.isFinite));
  c.ending.reset();return {meshes,reused,error,groundError,finite,cleared:c.ending.death.pieces.length===0&&c.ending.death.materials.size===0&&c.giant.root.visible};
 });
 assert.equal(pieces.meshes,pieces.reused);assert.equal(pieces.error,0);assert.ok(pieces.groundError<.1);assert.ok(pieces.finite&&pieces.cleared);
 // Real late-join welcome skips the explosion buildup and shows the current wreck.
 const late=await browser.newPage({viewport:{width:1000,height:700}});watch(late);await install(late,welcome);
 const lateState=await late.evaluate(({welcome,event,snapshot})=>{const c=window.__COLOSSUS;c.net.onMessage({...welcome,result:event,time:event.time+10});window.replaySnapshot={...snapshot,time:event.time+10};c.net.latest=window.replaySnapshot;return true;},{welcome,event,snapshot});
 await late.waitForFunction(()=>window.__COLOSSUS.ending.revealed);assert.ok(lateState);assert.equal(await late.evaluate(()=>deathSounds.filter(s=>s==='explosion').length),0);
 await late.evaluate(({welcome,alive})=>{const c=window.__COLOSSUS;c.net.onMessage({...welcome,round:2,result:null});window.replaySnapshot={...alive,round:2};c.net.latest=window.replaySnapshot;},{welcome,alive});
 await late.waitForFunction(()=>!window.__COLOSSUS.ending.result&&window.__COLOSSUS.giant.root.visible);await late.close();
 const context=await browser.newContext({viewport:{width:1100,height:750}});
 await context.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);`});
 const quest=await context.newPage();watch(quest);await install(quest,bossWelcome);await quest.evaluate(()=>window.__COLOSSUS.xr.enter());await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.getCamera().cameras.length===2);
 const before=await quest.evaluate(()=>window.__COLOSSUS.renderer.xr.getCamera().cameras[0].matrixWorld.elements.slice());await kill(quest);await quest.waitForFunction(()=>window.__COLOSSUS.ending.elapsed>2.5);
 const stereo=await quest.evaluate(before=>{const c=window.__COLOSSUS,eye=c.renderer.xr.getCamera().cameras[0];c.views.captureXR();const pixels=c.views.context.getImageData(0,0,640,400).data;return {eyes:c.renderer.xr.getCamera().cameras.length,parts:c.ending.death.pieces.length,poseError:Math.max(...eye.matrixWorld.elements.map((n,i)=>Math.abs(n-before[i]))),hud:c.xr.roundEnding.result.winner,glError:c.renderer.getContext().getError(),coloredPixels:pixels.filter((n,i)=>i%4!==3&&n>30).length,overlay:!document.getElementById('overlay').classList.contains('hidden')};},before);
 assert.equal(stereo.eyes,2);assert.ok(stereo.parts>=25);assert.ok(stereo.poseError<.01);assert.equal(stereo.hud,'raiders');assert.equal(stereo.glError,0);assert.ok(stereo.coloredPixels>1000);assert.equal(stereo.overlay,false);
 await quest.evaluate(()=>window.__COLOSSUS.xr.session.end());assert.deepEqual(errors,[]);
 const report={result:'PASS',shots,pieces,stereo,errors};await writeFile('artifacts/colossus-death-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();room.dispose();server.kill('SIGTERM');}
