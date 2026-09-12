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
 const props=await page.evaluate(async()=>{const T=await import('three'),{city}=window.__COLOSSUS,car=city.props.find(p=>p.kind==='car'),box=car.boxes[0],turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),car.yaw),origin=new T.Vector3(0,box[1],box[5]+3).applyQuaternion(turn).add(new T.Vector3(...car.position)),direction=new T.Vector3(0,0,-1).applyQuaternion(turn),distance=city.rayDistance(origin,direction,5,.25);return {distance};});assert.ok(Math.abs(props.distance-2.75)<.01,'Shoulder camera must stop at the padded car surface');
 const spire=await page.evaluate(async()=>{const T=await import('three'),{city}=window.__COLOSSUS,c=city.cells.find(c=>c.spire),center=new T.Vector3(c.p[0],c.p[1]+c.size[1]/2+c.spire/2,c.p[2]);return city.rayDistance(center.clone().add(new T.Vector3(3,0,0)),new T.Vector3(-1,0,0),5);});assert.ok(Math.abs(spire-2.1)<.001,'Aim/camera queries must include the spire above the structural roof');
 const raiders=await page.evaluate(async()=>{
  const T=await import('three'),{RaiderView}=await import('/src/avatars.js'),{Effects}=await import('/src/effects.js'),{renderer}=window.__COLOSSUS;
  const scene=new T.Scene();scene.background=new T.Color(0x162b37);scene.add(new T.HemisphereLight(0xd7f6ff,0x506878,3));const sun=new T.DirectionalLight(0xffffff,4);sun.position.set(-4,6,4);scene.add(sun);
  const camera=new T.PerspectiveCamera(45,1.6,.05,100);camera.position.set(4.2,2.6,6.5);camera.lookAt(0,.1,0);
  const front=new RaiderView(scene,1),back=new RaiderView(scene,2);await Promise.all([front.ready,back.ready]);const state={p:[-1.2,0,0],yaw:Math.PI,v:[0,0,0],flags:0,fuel:1,pitch:0};front.update(state);back.update({...state,p:[1.2,0,0],yaw:0});
  const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0x334550,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.15;scene.add(floor);
  window.artPreview={scene,camera,front,back,fx:new Effects(scene)};renderer.render(scene,camera);return {frontImported:front.imported,backImported:back.imported};
 });assert.ok(raiders.frontImported&&raiders.backImported);await page.screenshot({path:'artifacts/visual-raider-front-back.png'});
 const lasers=await page.evaluate(()=>{const {renderer}=window.__COLOSSUS,{scene,camera,front,back,fx}=window.artPreview;front.root.visible=false;camera.position.set(5,3.5,8);camera.lookAt(0,0,-3);fx.shot({from:[1.4,.6,-.8],to:[-.5,.3,-7],normal:[0,0,1],impact:true});fx.update(.06);renderer.render(scene,camera);return {cores:fx.beams.count,glows:fx.beamGlow.count,bolts:fx.bolts.count,rings:fx.ringMesh.count,sparks:fx.sparks.items.length};});assert.deepEqual(lasers,{cores:1,glows:1,bolts:1,rings:1,sparks:8});await page.screenshot({path:'artifacts/visual-raider-laser.png'});
 assert.deepEqual(errors,[]);const report={result:'PASS',checks:['Imported models, photographic textures and HDR sky load without errors','Downloaded roof equipment follows real Rapier collapse transforms','Rubble removal hides attached art; reset restores it','Downloaded smoke, sparks and impact sprites render successfully','Shoulder camera ray stops at the same car bounds as server physics','Armored raider front/back and layered laser glow, pulse, sparks and impact ring render'],props,lasers,artifacts:['visual-lobby.png','visual-city.png','visual-destruction.png','visual-street.png','visual-raider-front-back.png','visual-raider-laser.png']};await writeFile('artifacts/visual-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
