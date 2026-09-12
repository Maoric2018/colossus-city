// Render the real pilot and its physics-driven skin; compare every surface vertex.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
import {v} from '../shared/math.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright');await physicsReady;await mkdir('artifacts',{recursive:true});
const port=21000+Math.floor(Math.random()*1000),url=`http://localhost:${port}`,errors=[],report=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY,{timeout:60000});await page.evaluate(()=>{const {renderer}=window.__COLOSSUS;renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);});
 for(const soaring of [false,true]){
  const room=new Room('RAG123');try{
   const c=room.attach({send(){},readyState:1},'raider','pilot'),p=room.players.get(c.id);room.spawn(p,v(0,4,60));p.invulnerable=0;p.soaring=soaring;p.input.yaw=.6;p.input.pitch=.2;p.body.setLinvel(soaring?v(-Math.sin(.6)*26,3,-Math.cos(.6)*26):v(),true);
   const liveState=room.snapshot().players[0];room.knockdown(p,v(4,3,0),120);const rag=room.rags.get(p.rag),initial=room.ragMeta(rag);
   const congruence=await page.evaluate(async({liveState,initial})=>{
    const T=await import('three'),{RaiderView,RagView}=await import('/src/avatars.js'),{renderer}=window.__COLOSSUS;
    window.ragPreview?.live.dispose();window.ragPreview?.rag.dispose();window.ragPreview?.late?.dispose();
    const scene=new T.Scene();scene.background=new T.Color(0x162b37);scene.add(new T.HemisphereLight(0xd7f6ff,0x506878,3));const light=new T.DirectionalLight(0xffffff,4);light.position.set(-3,8,65);scene.add(light);
    const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x435762}));floor.rotation.x=-Math.PI/2;scene.add(floor);
    const camera=new T.PerspectiveCamera(43,1200/900,.05,200);camera.position.set(3,6,66);camera.lookAt(0,4,60);
    const live=new RaiderView(scene,1),rag=new RagView(scene,initial);await Promise.all([live.ready,rag.ready]);for(let i=0;i<100;i++)live.update(liveState);
    scene.updateMatrixWorld(true);rag.skin.skeleton.update();const body=live.mesh.children.find(o=>o.isMesh),vertex=new T.Vector3(),actual=new T.Vector3();let error=0,colorError=0;
    for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,vertex).applyMatrix4(body.matrixWorld);rag.skin.getVertexPosition(i,actual).applyMatrix4(rag.skin.matrixWorld);error=Math.max(error,vertex.distanceTo(actual));for(let j=0;j<3;j++)colorError=Math.max(colorError,Math.abs(body.geometry.attributes.color.getComponent(i,j)-rag.skin.geometry.attributes.color.getComponent(i,j)));}
    live.root.visible=false;renderer.render(scene,camera);window.ragPreview={scene,camera,live,rag,initial};return {maxVertexError:error,maxColorError:colorError,vertices:body.geometry.attributes.position.count,bones:rag.skin.skeleton.bones.length,gear:!!rag.pack&&rag.weaponMaterials.length>0};
   },{liveState,initial});assert.ok(congruence.maxVertexError<.0001,JSON.stringify(congruence));assert.equal(congruence.maxColorError,0);assert.equal(congruence.bones,11);assert.ok(congruence.gear);
   await page.screenshot({path:`artifacts/ragdoll-${soaring?'soaring':'hover'}-start.png`});
   for(let n=0;n<90;n++)room.world.step();const fallen=room.ragMeta(rag);
   const falling=await page.evaluate(async fallen=>{const T=await import('three'),{renderer}=window.__COLOSSUS,{scene,camera,rag}=window.ragPreview;for(const p of fallen.parts)rag.update(p.id,p.p,p.q);const center=new T.Vector3(...fallen.parts[0].p);camera.position.copy(center).add(new T.Vector3(2.8,2.6,4));camera.lookAt(center);renderer.render(scene,camera);rag.skin.skeleton.update();let radius=0;const point=new T.Vector3();for(let i=0;i<rag.skin.geometry.attributes.position.count;i++){rag.skin.getVertexPosition(i,point);radius=Math.max(radius,point.distanceTo(center));}return {radius};},fallen);assert.ok(falling.radius<4,`Skin stretched away from its body: ${falling.radius}`);
   await page.screenshot({path:`artifacts/ragdoll-${soaring?'soaring':'hover'}-fallen.png`});
   const late=await page.evaluate(async meta=>{const T=await import('three'),{RagView}=await import('/src/avatars.js'),{scene,rag}=window.ragPreview;const late=new RagView(scene,meta);await late.ready;window.ragPreview.late=late;scene.updateMatrixWorld(true);rag.skin.skeleton.update();late.skin.skeleton.update();let error=0;const a=new T.Vector3(),b=new T.Vector3();for(let i=0;i<rag.skin.geometry.attributes.position.count;i++){rag.skin.getVertexPosition(i,a);late.skin.getVertexPosition(i,b);error=Math.max(error,a.distanceTo(b));}for(const p of meta.parts)rag.remove(p.id);late.skin.skeleton.update();return {error,removed:rag.root.parent===null,independentSkeleton:rag.skin.skeleton!==late.skin.skeleton};},room.welcome(c).rags[0]);assert.equal(late.error,0);assert.ok(late.removed&&late.independentSkeleton);
   // Exercise the application's actual add/remove event handlers with real server metadata.
   const handlers=await page.evaluate(async initial=>{const {net,scene}=window.__COLOSSUS;net.onMessage({type:'events',events:[initial]});await new Promise(resolve=>setTimeout(resolve,50));let count=0;scene.traverse(o=>{if(o.isSkinnedMesh)count++;});net.onMessage({type:'events',events:initial.parts.map(p=>({type:'remove',id:p.id}))});let after=0;scene.traverse(o=>{if(o.isSkinnedMesh)after++;});return {count,after};},initial);assert.deepEqual(handlers,{count:1,after:0});
   report.push({soaring,...congruence,...falling,late,handlers});
  }finally{room.dispose();}
 }
 const headset=await browser.newContext({viewport:{width:1200,height:800}});await headset.addInitScript({content:await readFile('node_modules/iwer/build/iwer.js','utf8')+`\nwindow.questDevice=new IWER.XRDevice(IWER.metaQuest2,{stereoEnabled:true});questDevice.installRuntime({forceInstall:true});questDevice.position.set(0,1.7,0);questDevice.controllers.left.position.set(-.4,1.2,-.3);questDevice.controllers.right.position.set(.4,1.2,-.3);`});
 const quest=await headset.newPage();quest.on('pageerror',e=>errors.push(e.message));quest.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await quest.goto(url);await quest.waitForFunction(()=>window.COLOSSUS_ART_READY);await quest.locator('[data-role="boss"]').click();await quest.locator('#create').click();await quest.locator('#resume').click();await quest.locator('#vr-button').click();await quest.waitForFunction(()=>window.__COLOSSUS.renderer.xr.getCamera().cameras.length===2);
 await quest.evaluate(async()=>{const {raiderParts}=await import('/shared/raider-rig.js'),{net}=window.__COLOSSUS;net.onMessage({type:'events',events:[{type:'rag',id:60000,player:999,parts:raiderParts.map((p,i)=>({id:60000+i,name:p.name,size:p.s,p:[-p.o[0],p.o[1]+22,-p.o[2]-7],q:[0,1,0,0]}))}]});});
 await quest.waitForFunction(()=>{let count=0;window.__COLOSSUS.scene.traverse(o=>{if(o.isSkinnedMesh)count++;});return count===1;});await quest.waitForTimeout(150);await quest.screenshot({path:'artifacts/ragdoll-quest-stereo.png'});await quest.evaluate(()=>window.__COLOSSUS.renderer.xr.getSession().end());
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',report,errors},null,2));await writeFile('artifacts/ragdoll-report.json',JSON.stringify({result:'PASS',report,errors},null,2)+'\n');
}finally{await browser?.close();server.kill('SIGTERM');}
