// Real downloaded car art, Rapier poses, wreck meshes and current collision queries.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
import {strikeCars,carMeta} from '../server/cars.js';
import {v,add} from '../shared/math.js';
import {identity} from '../shared/giant-rig.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=19000+Math.floor(Math.random()*900),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1500,height:950}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);await page.waitForLoadState('networkidle');
 await physicsReady;const r=new Room('CARART');r.attach({send(){},readyState:1},'boss','still');let event,pose;
 try{const c=r.cars.values().next().value,at=c.body.translation();strikeCars(r,add(at,v(0,.5,6)),add(at,v(0,.5,-3)),identity,25);event=r.drainEvents().find(e=>e.type==='car-explode');assert.ok(event);for(let i=0;i<50;i++)r.step();pose=carMeta(r,c);}finally{r.dispose();}
 const checks=await page.evaluate(async({event,pose})=>{
  const T=await import('three'),{city,renderer,fx}=window.__COLOSSUS;renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);
  const e=city.cars.entries.get(event.id),intact=e.parts.find(p=>!p.wreck),wreck=e.parts.find(p=>p.wreck),matrix=new T.Matrix4(),initial=[...e.p],initialHeight=e.prop.size[1];
  city.cars.setState(event);fx.carExplosion(event.p);fx.update(.1);city.cars.setState(pose);
  intact.batch.getMatrixAt(intact.index,matrix);const hidden=matrix.determinant()===0;wreck.batch.getMatrixAt(wreck.index,matrix);const shown=matrix.determinant()>.9;
  const aligned=matrix.elements.slice(12,15).every((n,i)=>Math.abs(n-pose.p[i])<1e-4);wreck.batch.geometry.computeBoundingBox();const crushedHeight=wreck.batch.geometry.boundingBox.getSize(new T.Vector3()).y;
  const moved=Math.hypot(...pose.p.map((n,i)=>n-initial[i]))>.5;
  const oldQuery=city.rayDistance(new T.Vector3(initial[0],initial[1],initial[2]+3),new T.Vector3(0,0,-1),5);
  city.cars.setState({id:e.id,p:[0,20,0]});
  const b=e.box,origin=new T.Vector3(...b.center).add(new T.Vector3(0,0,1).applyQuaternion(new T.Quaternion(...e.q)).multiplyScalar(b.half[2]+3)),direction=new T.Vector3(0,0,-1).applyQuaternion(new T.Quaternion(...e.q));
  const distance=city.rayDistance(origin,direction,5);
  city.cars.setState({...pose,sleeping:true});const fixed=[...e.p];city.cars.pose(e.id,[80,80,80],[0,0,0,1]);const ignoresStale=JSON.stringify(fixed)===JSON.stringify(e.p);
  const resetState=()=>{city.reset();return city.cars.entries.get(e.id);};resetState();city.cars.setState({...pose,sleeping:true,burn:0});const lateJoin=JSON.stringify(e.p)===JSON.stringify(pose.p)&&e.wreck;
  const flashCount=fx.flashes.items.length;resetState();intact.batch.getMatrixAt(intact.index,matrix);const reset=!e.wreck&&matrix.determinant()>.9;
  return {hidden,shown,aligned,moved,crushedHeight,initialHeight,distance,oldQuery,ignoresStale,lateJoin,reset,flashCount,failedAssets:window.__COLOSSUS.assetStatus.failed};
 },{event,pose});
 console.log('Car geometry and physics:',JSON.stringify(checks));
 assert.ok(checks.hidden&&checks.shown&&checks.aligned&&checks.moved&&checks.ignoresStale&&checks.lateJoin&&checks.reset);assert.ok(checks.crushedHeight<checks.initialHeight*.8);assert.ok(Math.abs(checks.distance-3)<.03);assert.ok(checks.oldQuery>4.9);assert.ok(checks.flashCount>0);assert.deepEqual(checks.failedAssets,[]);
 await page.evaluate(async()=>{
  const T=await import('three'),{CarsView}=await import('/src/world/cars.js'),{TIERS}=await import('/src/render/quality.js'),{city}=await import('/shared/environment.js'),{Effects}=await import('/src/effects.js'),{renderer}=window.__COLOSSUS;
  const scene=new T.Scene();scene.background=new T.Color(0x253843);scene.add(new T.HemisphereLight(0xe3f3ff,0x66615c,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-8,15,10);scene.add(sun);
  const a=new CarsView(scene,city,TIERS.quest),b=new CarsView(scene,city,TIERS.quest);await Promise.all([a.ready,b.ready]);const chosen=[...new Set(a.placements.map(p=>p.asset))];
  for(const cars of [a,b])for(const e of cars.entries.values())cars.setState({id:e.id,removed:true});
  chosen.forEach((asset,i)=>{for(const [cars,wreck,z]of [[a,false,2],[b,true,-5]]){const e=[...cars.entries.values()].find(e=>e.prop.asset===asset);cars.setState({id:e.id,p:[(i-2.5)*5,e.prop.size[1]/2,z],q:[0,Math.sin(.23),0,Math.cos(.23)],wreck,removed:false,sleeping:true});}});
  const floor=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshLambertMaterial({color:0x627078}));floor.rotation.x=-Math.PI/2;scene.add(floor);const camera=new T.PerspectiveCamera(43,1500/950,.05,250);camera.position.set(22,24,37);camera.lookAt(0,0,-1);
  window.carPreview={scene,camera,a,b,fx:new Effects(scene,{tier:TIERS.quest})};renderer.render(scene,camera);
 });
 await page.screenshot({path:'artifacts/cars-intact-and-wrecks.png'});
 await page.evaluate(()=>{const {renderer}=window.__COLOSSUS,{scene,camera,b,fx}=window.carPreview;const e=[...b.entries.values()].find(e=>!e.removed);fx.carExplosion(e.p);fx.update(.08);camera.position.set(e.p[0]+6,5,8);camera.lookAt(e.p[0],.7,-5);renderer.render(scene,camera);});
 await page.screenshot({path:'artifacts/car-explosion.png'});assert.deepEqual(errors,[]);
 const report={result:'PASS',checks,artifacts:['cars-intact-and-wrecks.png','car-explosion.png']};await writeFile('artifacts/car-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
