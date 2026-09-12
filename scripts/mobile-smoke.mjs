// Real browser touch events, WebGL and authoritative server. This verifies phone/tablet
// input and layout; it does not measure physical iOS/Android GPU or Safari performance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright');
const port=27000+Math.floor(Math.random()*500), url=process.env.MOBILE_URL || `http://localhost:${port}`;
const server=process.env.MOBILE_URL ? null : spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:['ignore','pipe','pipe']});
let log='',browser; server?.stdout.on('data',d=>log+=d); server?.stderr.on('data',d=>log+=d);
const errors=[],checks=[],layouts=[];
await mkdir('artifacts/mobile',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(`${url}/healthz`).then(r=>r.ok).catch(()=>false))break;if(i===99)throw Error(log);await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const phone=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await phone.newPage(); page.setDefaultTimeout(25000); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 assert.equal(await page.evaluate(()=>window.__COLOSSUS.touch),true);
 assert.equal(await page.evaluate(()=>window.__COLOSSUS.gameRenderer.tier.name),'MOBILE');
 assert.ok(await page.evaluate(()=>window.__COLOSSUS.renderer.getPixelRatio()<=1));
 assert.ok(await page.locator('#vr-settings').isHidden());
 await page.screenshot({path:'artifacts/mobile/lobby-landscape.png'});
 await page.locator('#create').tap(); await page.waitForFunction(()=>window.__COLOSSUS.state);
 const room=await page.evaluate(()=>window.__COLOSSUS.net.room);
 assert.ok(await page.locator('#touch-layer').isHidden());
 assert.doesNotMatch(await page.locator('#overlay-text').textContent(),/WASD|RIGHT CLICK/);
 await page.locator('#resume').tap();await page.waitForFunction(()=>window.__COLOSSUS.touchControls.enabled);
 assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
 const cdp=await phone.newCDPSession(page),points=new Map();
 const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
 async function event(type){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...points.values()]});}
 async function down(id,x,y){points.set(id,point(id,x,y));await event('touchStart');}
 async function move(id,x,y){points.set(id,point(id,x,y));await event('touchMove');}
 async function up(id){const released=points.get(id);points.delete(id);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points.size ? [released] : []});}
 async function cancel(){points.clear();await event('touchCancel');}
 async function center(selector){const b=await page.locator(selector).boundingBox();assert.ok(b,selector);return [b.x+b.width/2,b.y+b.height/2];}
 const held=()=>page.evaluate(()=>window.__COLOSSUS.input.held());
 const waitActive=()=>page.waitForFunction(()=>window.__COLOSSUS.touchControls.enabled);
 await down(1,90,250);await move(1,93,249);assert.equal((await held()).x,0,'Stick dead zone ignores resting-thumb jitter');
 await move(1,112,217);assert.ok((await held()).x>.2);assert.ok((await held()).z<-.4);
 await down(2,190,220);await up(2);assert.ok((await held()).z<-.4,'A second left thumb cannot steal or release movement');
 const fire=await center('.tc-fire'),thrust=await center('.tc-thrust');
 await down(3,...fire);const yaw=(await held()).yaw;await move(3,fire[0]-24,fire[1]-10);
 await down(4,...thrust);let h=await held();assert.ok(h.fire&&h.up===1&&h.z<0);assert.ok(h.yaw>yaw+.05);
 const beforeY=await page.evaluate(()=>window.__COLOSSUS.net.latest.players.find(p=>p.id===window.__COLOSSUS.net.id).p[1]);
 await page.waitForFunction(y=>window.__COLOSSUS.net.latest.players.find(p=>p.id===window.__COLOSSUS.net.id).p[1]>y+.2,beforeY);
 await up(3);h=await held();assert.equal(h.fire,false);assert.equal(h.up,1);assert.ok(h.z<0);
 await up(1);assert.equal((await held()).z,0);assert.equal((await held()).up,1);await up(4);
 checks.push('Analog dead zone, movement ownership, simultaneous movement/fire/aim/thrust and independent release reach real server');
 await waitActive();await page.locator('.tc-soar').tap();assert.equal((await held()).soar,true);
 await page.waitForFunction(()=>window.__COLOSSUS.net.latest.players.find(p=>p.id===window.__COLOSSUS.net.id).flags&16);
 assert.equal(await page.locator('.tc-soar').getAttribute('aria-pressed'),'true');
 await page.locator('.tc-soar').tap();assert.equal((await held()).soar,false);
 await down(5,...await center('.tc-soar'));await cancel();assert.equal((await held()).soar,false,'Cancelled toggle must not start soaring');
 checks.push('Tap-to-toggle soar reaches server; cancelled taps cannot leave it latched');
 await page.waitForFunction(()=>window.__COLOSSUS.touchControls.ready('heavy'));
 let sequence=(await held()).heavy;
 await page.locator('.tc-heavy').tap();assert.equal((await held()).heavy,sequence,'Breach tap must not bypass charge');
 await down(6,...await center('.tc-heavy'));await page.waitForFunction(()=>window.__COLOSSUS.input.charge===1);
 assert.equal(await page.locator('.tc-heavy small').textContent(),'RELEASE');await up(6);
 assert.equal((await held()).heavy,sequence+1);
 await page.waitForFunction(()=>window.__COLOSSUS.net.latest.players.find(p=>p.id===window.__COLOSSUS.net.id).heavyCooldown>0);
 await down(16,...await center('.tc-heavy'));await up(16);assert.equal((await held()).heavy,sequence+1,'Cooldown suppresses repeated breach presses');
 await page.waitForFunction(()=>window.__COLOSSUS.touchControls.ready('dodge'));
 sequence=(await held()).dodge;const dodge=await center('.tc-dodge');await down(17,...dodge);await up(17);await down(18,...dodge);await up(18);assert.equal((await held()).dodge,sequence+1);
 await page.waitForFunction(()=>window.__COLOSSUS.net.latest.players.find(p=>p.id===window.__COLOSSUS.net.id).dodgeCooldown>0);
 checks.push('Breach hold/release, charge progress, authoritative cooldown and dodge repeat suppression');
 await down(7,...await center('.tc-fire'));await page.locator('#menu-button').tap();await cancel();
 assert.equal((await held()).fire,false);assert.ok(await page.locator('#touch-layer').isHidden());
 await page.locator('#camera-toggle').tap();assert.equal(await page.evaluate(()=>window.__COLOSSUS.firstPerson),false);
 assert.doesNotMatch(await page.locator('#camera-toggle').textContent(),/ · V/);
 await page.locator('#resume').tap();await waitActive();
 await page.locator('.tc-soar').tap();await down(8,...await center('.tc-thrust'));
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await cancel();h=await held();assert.equal(h.soar,false);assert.equal(h.up,0);
 checks.push('MENU remains tappable over the touch surface; pause, camera switch and focus loss release held controls');
 async function checkLayout(width,height,label){
  await page.setViewportSize({width,height});await waitActive();
  const boxes=await page.locator('.tc-btn,#menu-button').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {name:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e};}));
  for(const b of boxes){assert.ok(b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=width+.1&&b.y+b.h<=height+.1,`${label}: ${JSON.stringify(b)}`);assert.ok(b.hit,`${label}: ${b.name} must be tappable`);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${label}: ${a.name} overlaps ${b.name}`);}
  layouts.push({label,width,height,buttons:boxes.length});await page.screenshot({path:`artifacts/mobile/${label}.png`});
 }
 await checkLayout(844,390,'phone-landscape');await down(9,90,245);await move(9,90,200);
 await checkLayout(390,844,'phone-portrait');assert.equal((await held()).z,0,'Rotation releases movement');await cancel();
 await checkLayout(667,375,'small-landscape');await checkLayout(360,640,'small-portrait');await checkLayout(1024,768,'tablet');
 // Simulate a notched landscape safe area and verify stick coordinates relative to its layer.
 await page.setViewportSize({width:844,height:390});await waitActive();
 await page.locator('#touch-layer').evaluate(e=>e.style.inset='12px 34px 21px 44px');
 await down(10,110,245);const stick=await page.locator('#tc-stick').boundingBox();assert.ok(Math.abs(stick.x-110)<.1&&Math.abs(stick.y-245)<.1);await up(10);
 await page.locator('#touch-layer').evaluate(e=>e.style.inset='');
 checks.push('Portrait, landscape, small phones, tablet, safe-area coordinates and 44px+ nonoverlapping targets');
 // Mobile spectators still receive the mobile player video instead of a permanent Connecting tile.
 const observer=await phone.newPage();observer.on('pageerror',e=>errors.push(e.message));
 await observer.goto(`${url}/?spectator=1&room=${room}`);await observer.waitForFunction(()=>window.__COLOSSUS?.views.cards.size>0);
 await observer.waitForFunction(()=>[...window.__COLOSSUS.views.cards.values()].some(c=>c.frames>=2&&c.transport==='video'&&c.video.videoWidth===640),null,{timeout:45000});
 assert.ok(await observer.locator('#touch-layer').isHidden());
 await observer.locator('#spectator-free').tap();await observer.locator('#resume').tap();await observer.waitForFunction(()=>window.__COLOSSUS.touchControls.enabled);
 assert.equal(await observer.locator('.tc-btn').count(),2);
 const observerCDP=await phone.newCDPSession(observer),upBox=await observer.locator('.tc-thrust').boundingBox(),downBox=await observer.locator('.tc-soar').boundingBox();
 const upPoint=point(1,upBox.x+upBox.width/2,upBox.y+upBox.height/2),downPoint=point(2,downBox.x+downBox.width/2,downBox.y+downBox.height/2);
 await observerCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[upPoint,downPoint]});assert.equal(await observer.evaluate(()=>window.__COLOSSUS.input.held().up),0);
 await observerCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[downPoint]});assert.equal(await observer.evaluate(()=>window.__COLOSSUS.input.held().up),1);
 await observerCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await observer.locator('#open-spectator').tap();assert.ok(await observer.locator('#spectator-panel').isVisible());await observer.close();
 checks.push('Mobile live video, spectator free camera and independent UP/DOWN release');
 await page.bringToFront();await page.locator('#menu-button').tap();await page.locator('#leave').tap();
 assert.ok(await page.locator('#touch-layer').isHidden());assert.equal(await page.evaluate(()=>window.__COLOSSUS.touchControls.pointers.size),0);
 await page.setViewportSize({width:360,height:640});await page.screenshot({path:'artifacts/mobile/lobby-portrait.png'});
 assert.ok(await page.locator('#create').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
 await page.locator('[data-role="boss"]').tap();await page.locator('#create').tap();await page.waitForFunction(()=>window.__COLOSSUS.state);await page.locator('#resume').tap();await waitActive();
 assert.equal(await page.locator('.tc-btn').count(),3);assert.ok(await page.locator('#vr-button').isHidden());
 await down(11,...await center('.tc-soar'));await page.waitForFunction(()=>window.__COLOSSUS.missiles.active.size>0);await up(11);
 await down(12,...await center('.tc-fire'));assert.equal((await held()).fire,true);await up(12);
 await down(13,...await center('.tc-thrust'));assert.equal((await held()).up,1);await up(13);
 await page.screenshot({path:'artifacts/mobile/colossus-portrait.png'});
 checks.push('Leave/rejoin cleans up controls; mobile Colossus sweep, slam and replicated missile launch');
 // Phase transitions disable touch before the final camera/scoreboard takes over.
 await down(14,...await center('.tc-fire'));
 await page.evaluate(()=>{const a=window.__COLOSSUS,phase=a.state.phase;a.state.phase=1;a.touchControls.update();window.mobilePhaseCheck={enabled:a.touchControls.enabled,fire:a.input.held().fire};a.state.phase=phase;});
 assert.deepEqual(await page.evaluate(()=>window.mobilePhaseCheck),{enabled:false,fire:false});await cancel();
 checks.push('Round ending disables controls and clears held actions');
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/mobile/report.json',JSON.stringify({checks,layouts,errors},null,2));
 console.log(JSON.stringify({checks,layouts,errors},null,2));
}finally{await browser?.close();server?.kill('SIGTERM');}
