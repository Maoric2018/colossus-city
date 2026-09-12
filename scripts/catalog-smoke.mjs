import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {NEW_BUILDING_STYLES} from '../shared/city/catalog.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=25400+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
await mkdir('artifacts/catalog',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:900,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(()=>{const {renderer}=window.__COLOSSUS;renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);});
 const models=[];
 for(const style of NEW_BUILDING_STYLES){
  const result=await page.evaluate(async id=>{
   const T=await import('three'),{Buildings}=await import('/src/world/buildings.js'),{TIERS}=await import('/src/render/quality.js'),{STYLE_BY_ID,catalogBuilding}=await import('/shared/city/catalog.js'),{generateCells,initialSkin}=await import('/shared/city/cells.js'),{CatalogLOD}=await import('/src/render/catalog-lod.js');
   const {renderer}=window.__COLOSSUS;renderer.shadowMap.enabled=false;const scene=new T.Scene();scene.background=new T.Color(0xb3c4cc);scene.add(new T.HemisphereLight(0xe7f2ff,0x807365,2));const sun=new T.DirectionalLight(0xffefd9,3);sun.position.set(-30,80,30);scene.add(sun);
   const b=catalogBuilding(STYLE_BY_ID.get(id),0,0),cells=generateCells({buildings:[b]}),root=new T.Group();scene.add(root);const buildings=new Buildings(root,cells,TIERS.quest,{concrete:null});for(const c of cells){const s=initialSkin(c);buildings.setSkin(c.id,s.glass,s.facade);}
   const height=Math.max(...cells.map(c=>c.p[1]+c.size[1]/2))+10,d=Math.max(height*1.3,27),camera=new T.PerspectiveCamera(43,1,.1,1000);camera.position.set(d*.76,height*.55+5,d);camera.lookAt(0,height*.46,0);camera.updateMatrixWorld(true);
   const floor=new T.Mesh(new T.PlaneGeometry(500,500),new T.MeshLambertMaterial({color:0x999b96}));floor.rotation.x=-Math.PI/2;floor.position.y=-.1;scene.add(floor);
   buildings.components.radius=300;buildings.select(camera,300,false);buildings.components.select(camera);buildings.commit();renderer.info.reset();renderer.render(scene,camera);
   const types=buildings.components.entries,registered=new Set([...types.values()].flatMap(a=>a.map(p=>p.type))).size,stats={...renderer.info.render};
   // The highest new roof part must follow a rotated, settled debris pose exactly.
   const c=cells.find(c=>c.topFloor&&types.get(c.id).some(p=>p.type.startsWith('roof_')||p.type.startsWith('citiRoof')));let attached=true;
   if(c){const part=types.get(c.id).find(p=>p.type.startsWith('roof_')||p.type.startsWith('citiRoof')),e=buildings.pose(c.id),p=e.p.clone().add(new T.Vector3(7,-3,4)),q=new T.Quaternion().setFromEuler(new T.Euler(.2,.3,.4));buildings.setCell(c.id,p,q,false);const actual=new T.Matrix4();if(part.index<0)buildings.components.add(part);buildings.components.batches.get(part.type).getMatrixAt(part.index,actual);const expected=new T.Matrix4().compose(p,q,new T.Vector3(...c.size));attached=actual.elements.every((n,i)=>Math.abs(n-expected.elements[i])<.0001);buildings.setCell(c.id,new T.Vector3(...c.p),new T.Quaternion(),false);buildings.commit();}
   // Render the shared skyline recipe too; all its positions must be finite.
   const lodRoot=new T.Group(),lod=new CatalogLOD(lodRoot,TIERS.quest);if(!lod.building(b))lod.roofs(b);lod.commit();let lodFinite=true;for(const mesh of lod.batches.values())lodFinite&&=[...mesh.geometry.attributes.position.array].every(Number.isFinite);
   renderer.render(scene,camera);window.catalogShot={scene,camera,root,buildings,lodRoot};return {id,registered,attached,lodFinite,...stats};
  },style.id);
  assert.ok(result.registered>=30&&result.attached&&result.lodFinite,JSON.stringify(result));models.push(result);await page.screenshot({path:`artifacts/catalog/${style.id}.png`});
  await page.evaluate(()=>{const {scene,lodRoot}=window.catalogShot;for(const root of [scene,lodRoot])root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();if(o.isInstancedMesh)o.dispose();}});window.catalogShot=null;});
 }
 // A review sheet is a test artifact, not a label added inside the game.
 const cards=await Promise.all(NEW_BUILDING_STYLES.map(async s=>`<figure><img src="data:image/png;base64,${(await readFile(`artifacts/catalog/${s.id}.png`)).toString('base64')}"><figcaption>${s.name}</figcaption></figure>`));
 await page.setViewportSize({width:1600,height:900});await page.setContent(`<style>body{margin:0;background:#17232b;color:#fff;font:16px Arial;display:grid;grid-template-columns:repeat(8,1fr)}figure{margin:0;padding:5px}img{width:100%;display:block}figcaption{height:30px;padding:5px}</style>${cards.join('')}`);await page.screenshot({path:'artifacts/catalog-contact-sheet.png',fullPage:true});
 assert.deepEqual(errors,[]);const report={result:'PASS',models,errors};await writeFile('artifacts/catalog-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,models:models.length,minTypes:Math.min(...models.map(m=>m.registered)),maxTypes:Math.max(...models.map(m=>m.registered)),errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
