import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),output=process.argv[2]||'artifacts/optimization/destruction-render',port=29000+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir(output,{recursive:true});for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=medium');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{CityView}=await import('/src/world/city.js'),{TIERS}=await import('/src/render/quality.js'),{midtown}=await import('/shared/city/layout.js'),{fractureRecipe}=await import('/shared/city/fracture.js'),g=window.__COLOSSUS;
  const {renderer}=g;renderer.setAnimationLoop(null);renderer.setPixelRatio(1);renderer.setSize(1000,800);document.body.replaceChildren(renderer.domElement);
  const buildings=[[0,-20],[12,20],[-18,-35]].map(([x,z])=>({x,z,bay:6,story:4,material:'brick',tiers:[{nx:1,nz:1,floors:8,ix:0,iz:0}]}));
  const scene=new T.Scene(),city=new CityView(scene,{...midtown,infinite:false,props:[],buildings},{tier:TIERS.medium}),camera=new T.PerspectiveCamera(60,1.25,.1,300);await city.ready;scene.fog=new T.Fog(0x8fa6ad,10000,20000);city.sun.position.set(30,60,60);city.sun.target.position.set(0,0,-15);scene.add(city.sun.target);
  const textures=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const v of Object.values(m))if(v?.isTexture)textures.add(v);});
  await new Promise(resolve=>{const ready=()=>[...textures].every(t=>t.image&&t.image.complete!==false)?resolve():requestAnimationFrame(ready);ready();});
  camera.position.set(0,10,5);camera.lookAt(0,8,-20);camera.updateMatrixWorld(true);renderer.shadowMap.enabled=true;
  const gl=renderer.getContext(),pixels=()=>{const a=new Uint8Array(1000*800*4);gl.readPixels(0,0,1000,800,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const render=()=>{renderer.info.reset();renderer.render(scene,camera);return {pixels:pixels(),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};};
  const optimized=render();let shadows=null;const b=city.buildings;
  if(b.shadowView){
   const select=b.select;b.select=function(camera,far){select.call(this,camera,far,false);for(const e of this.entries.values())if(!e.hidden&&!e.rendered){e.rendered=true;this.show(e);}};
   for(const mesh of [b.frame,b.empireFrame,b.roof,...Object.values(b.facade)])mesh.castShadow=true;
   const reference=render();let changed=0;for(let i=0;i<reference.pixels.length;i+=4)if(Math.abs(reference.pixels[i]-optimized.pixels[i])+Math.abs(reference.pixels[i+1]-optimized.pixels[i+1])+Math.abs(reference.pixels[i+2]-optimized.pixels[i+2])>9)changed++;
   shadows={changedFraction:changed/800000,optimizedTriangles:optimized.triangles,referenceTriangles:reference.triangles,optimizedCalls:optimized.calls,referenceCalls:reference.calls};
   b.select=select;b.selectionDirty=true;for(const mesh of [b.frame,b.empireFrame,b.roof,...Object.values(b.facade)])mesh.castShadow=false;
  }
  let worker=null;if(shadows){
   const {BlockPreparation}=await import('/src/world/block-preparation.js'),{generateBlock}=await import('/shared/city/layout.js'),{generateCells}=await import('/shared/city/cells.js'),{componentPlacements}=await import('/shared/city/components.js'),env=generateBlock(9,7),preparation=new BlockPreparation(false);
   try{preparation.prepare(env);const deadline=performance.now()+15000;await new Promise((resolve,reject)=>{const poll=()=>preparation.entries.get(env.key)?.cells?resolve():performance.now()>deadline?reject(Error('Block worker did not prepare cells')):requestAnimationFrame(poll);poll();});const prepared=preparation.take(env),expected=generateCells(env);for(const cell of expected)cell.preparedComponents=componentPlacements(cell,{interiors:false});worker={cells:prepared.length,matchesSynchronous:JSON.stringify(prepared)===JSON.stringify(expected)};}finally{preparation.dispose();}
  }
  renderer.shadowMap.enabled=false;const c=city.cells.find(c=>c.building===0&&c.floor===2),pieces=fractureRecipe(c).pieces.filter(p=>p.kind==='wall'&&p.side===2).sort((a,b)=>Math.hypot(a.p[0],a.p[1])-Math.hypot(b.p[0],b.p[1]));
  const {cutAppearance}=await import('/src/render/fracture-geometry.js'),source=city.fine.source(c,b),geometryRuns=[];
  for(let run=0;run<4;run++){const times=[];for(let i=1;i<=20;i++){const ids=pieces.slice(0,i*5).map(p=>p.id).sort((a,b)=>a-b),start=performance.now(),draws=cutAppearance(source,ids,city.skins.get(c.id),true);times.push(performance.now()-start);for(const d of draws)d.geometry.dispose();}geometryRuns.push(times);}
  const runs=[];let replacementError=null;for(let run=0;run<4;run++){city.reset();const times=[];try{for(let i=1;i<=20;i++){const ids=pieces.slice(0,i*5).map(p=>p.id).sort((a,b)=>a-b),start=performance.now();city.setFracture(c.id,ids);city.commit();times.push(performance.now()-start);}}catch(error){replacementError=error.message;}runs.push(times);}
  city.reset();
  const p=pieces[0],origin=p.p.map((n,k)=>n+c.p[k]),start=performance.now();for(let i=0;i<480;i++)city.addShards({id:1000000+i,cell:c.id,pieces:[p.id],origin,p:[i%20*2,1,Math.floor(i/20)*2-40],q:[0,0,0,1],settled:true,born:0});
  const fragmentMS=performance.now()-start,storedVertices=[...city.fine.pools.values()].reduce((n,p)=>n+p.live,0);render();window.optimizationFixture={scene,city,camera};return {shadows,worker,geometryRuns,runs,replacementError,fragmentMS,storedVertices,retainedFragments:city.fine.shards.size};
 });
 await writeFile(`${output}/client.json`,JSON.stringify({...report,errors},null,2));
 assert.equal(report.retainedFragments,480);if(!process.argv.includes('--baseline')){assert.equal(report.replacementError,null);assert.equal(report.worker?.matchesSynchronous,true);}if(report.shadows){assert.ok(report.shadows.changedFraction<.0001,JSON.stringify(report.shadows));assert.ok(report.shadows.optimizedTriangles<report.shadows.referenceTriangles,JSON.stringify(report.shadows));}
 assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/destruction.png`});await writeFile(`${output}/client.json`,JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
