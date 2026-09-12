// Two real clients consume the same moving-car snapshots; no visual-only traffic.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=29000+Math.floor(Math.random()*500),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir('artifacts',{recursive:true});for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 async function open(suffix=''){const page=await browser.newPage({viewport:{width:1200,height:800}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.goto(url+suffix);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);return page;}
 const player=await open('/?quality=quest');await player.locator('[data-role="boss"]').click();await player.locator('#create').click();await player.waitForFunction(()=>window.__COLOSSUS.net.latest?.time>4);
 const room=await player.evaluate(()=>window.__COLOSSUS.net.room),start=await player.evaluate(()=>[...window.__COLOSSUS.city.cars.entries.values()].map(e=>({id:e.id,p:[...e.p],q:[...e.q]})));
 const observer=await open(`/?quality=quest&room=${room}&spectator=1`);await observer.waitForFunction(()=>window.__COLOSSUS.net.latest?.bodies.length>0);await observer.evaluate(()=>window.__COLOSSUS.views.setVisible(false));
 await player.waitForFunction(start=>{const cars=window.__COLOSSUS.city.cars.entries;return start.filter(s=>Math.hypot(...cars.get(s.id).p.map((n,i)=>n-s.p[i]))>12).length>=30;},start);
 const motion=await player.evaluate(start=>{const c=window.__COLOSSUS,report=start.map(s=>{const e=c.city.cars.entries.get(s.id),latest=c.net.latest.bodies.find(b=>b.id===e.id);return {id:e.id,distance:Math.hypot(...e.p.map((n,i)=>n-s.p[i])),renderError:latest?Math.hypot(...e.p.map((n,i)=>n-latest.p[i])):Infinity,sleeping:e.sleeping,driving:e.driving,turn:2*Math.acos(Math.min(1,Math.abs(e.q.reduce((sum,n,i)=>sum+n*s.q[i],0))))};});return report;},start);
 const packet=await player.evaluate(()=>{const s=window.__COLOSSUS.net.snapshots.at(-4);return {tick:s.tick,bodies:s.bodies.filter(b=>b.id>=0x40000000)};});
 const sync=await observer.evaluate(packet=>{const c=window.__COLOSSUS,s=c.net.snapshots.find(s=>s.tick===packet.tick);if(!s)return {missing:true};return {cars:packet.bodies.length,error:Math.max(...packet.bodies.map(a=>{const b=s.bodies.find(b=>b.id===a.id);return b?Math.hypot(...a.p.map((n,i)=>n-b.p[i])):Infinity;})),rendered:c.city.cars.entries.size};},packet);
 assert.ok(motion.filter(c=>c.distance>12).length>=30);assert.ok(motion.some(c=>c.turn>.5),'cars must turn as well as translate');assert.ok(motion.every(c=>c.renderError<2&&!c.sleeping&&c.driving));assert.equal(sync.error,0);assert.equal(sync.cars,36);assert.equal(sync.rendered,36);
 await player.evaluate(async()=>{const T=await import('three'),g=window.__COLOSSUS;g.renderer.setAnimationLoop(null);g.rig.scale.setScalar(1);g.rig.position.set(0,0,0);g.giant.root.visible=false;document.body.replaceChildren(g.renderer.domElement);const camera=new T.PerspectiveCamera(53,1.5,.1,400);camera.position.set(-18,32,-12);camera.lookAt(-35,0,-35);g.renderer.render(g.scene,camera);});await player.screenshot({path:'artifacts/driving-traffic.png'});
 assert.deepEqual(errors,[]);const report={result:'PASS',cars:motion.length,minTravel:Math.min(...motion.map(c=>c.distance)),turned:motion.filter(c=>c.turn>.5).length,maxRenderError:Math.max(...motion.map(c=>c.renderError)),sync,errors};await writeFile('artifacts/traffic-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
