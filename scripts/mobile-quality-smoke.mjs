import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),baseline=process.argv.includes('--baseline');
const port=28200+Math.floor(Math.random()*500),url=`http://localhost:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
let browser;await mkdir('artifacts/mobile-quality',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(60000);
 await page.goto(url);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 await page.evaluate(()=>{const a=window.__COLOSSUS;a.renderer.setAnimationLoop(null);a.rig.position.set(0,0,0);a.rig.quaternion.identity();a.rig.scale.setScalar(1);a.rig.updateMatrixWorld(true);document.body.replaceChildren(a.renderer.domElement);});
 const samples=[];
 for(const [name,position,target] of [['street',[0,8,40],[0,15,-30]],['roofs',[10,55,30],[-30,30,-35]],['streamed',[700,12,730],[700,15,650]]]){
  const result=await page.evaluate(async({position,target})=>{
   const a=window.__COLOSSUS,{camera,renderer,gameRenderer:gr,city}=a;
   gr.adaptive=false;camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld(true);
   for(let i=0;i<1800;i++){gr.render(a.scene,camera,1/30);if(!city.stream.pending.length&&!city.stream.building)break;await new Promise(r=>setTimeout(r,0));}
   await new Promise(r=>setTimeout(r,100));gr.render(a.scene,camera,1/30);
   const times=[];for(let i=0;i<30;i++){const t=performance.now();gr.render(a.scene,camera,1/30);renderer.getContext().finish();times.push(performance.now()-t);}
   const median=times.sort((a,b)=>a-b)[Math.floor(times.length/2)];
   let components=0;for(const parts of city.buildings.components.entries.values())components+=parts.length;
   return {tier:gr.tier.name,ratio:renderer.getPixelRatio(),width:renderer.domElement.width,height:renderer.domElement.height,fog:[a.scene.fog.near,a.scene.fog.far],blocks:city.stream.previews.size,components,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,medianRenderMS:median,environment:!!a.scene.environment,glError:renderer.getContext().getError(),failed:a.assetStatus.failed};
  },{position,target});
  samples.push({name,...result});await page.screenshot({scale:'css',path:`artifacts/mobile-quality/${baseline?'before':'after'}-${name}.png`});
 }
 if(!baseline){
  for(const s of samples){assert.equal(s.tier,'MOBILE');assert.ok(s.ratio<=.55);assert.ok(s.width*s.height<=190000);assert.deepEqual(s.fog,[35,70]);assert.ok(s.blocks<=9);assert.equal(s.components,0);assert.equal(s.environment,false);assert.equal(s.glError,0);assert.deepEqual(s.failed,[]);}
  const gameplay=await page.evaluate(async()=>{
   const T=await import('three'),{FineBuildings}=await import('/src/world/fine-buildings.js'),{fractureRecipe}=await import('/shared/city/fracture.js'),{roofColliders}=await import('/shared/props.js');
   const {city,fx}=window.__COLOSSUS,c=city.cells.find(c=>city.attachments.get(c.id)?.length),attached=city.attachments.get(c.id),boxes=roofColliders(c),pose=city.buildings.pose(c.id),original=pose.p.clone(),matrix=new T.Matrix4();
   const collision=JSON.stringify(city.colliderCache.get(c.id));pose.rendered=true;city.buildings.setCell(c.id,original.clone().add(new T.Vector3(2,3,4)),null,false);city.buildings.writeAttachments(pose);
   attached[0].batch.getMatrixAt(attached[0].index,matrix);const moved=new T.Vector3().setFromMatrixPosition(matrix).toArray();
   city.buildings.setCell(c.id,null,null,true);attached[0].batch.getMatrixAt(attached[0].index,matrix);const hidden=new T.Vector3().setFromMatrixScale(matrix).length()===0;
   city.buildings.setCell(c.id,original,null,false);
   const brick=city.cells.find(c=>c.material==='brick'&&c.floor===2&&c.walls[2]),piece=fractureRecipe(brick).pieces.find(p=>p.kind==='wall'&&p.material==='brick'),origin=piece.p.map((n,k)=>n+brick.p[k]);
   const fine=new FineBuildings(new T.Group(),city.tier);
   for(const [id,p] of [[1,[0,0,-10]],[2,[0,0,-140]]])fine.addShards(brick,{id,cell:brick.id,pieces:[piece.id],origin,p,q:[0,0,0,1],settled:true,born:0},city.buildings);
   const camera=new T.PerspectiveCamera();camera.updateMatrixWorld(true);fine.select(camera,70);
   const nearVisible=fine.shards.get(1).parts.some(d=>d.visible),farVisible=fine.shards.get(2).parts.some(d=>d.visible),retained=fine.shards.size;fine.reset();
   fx.impact([0,5,0],2);fx.soarBreach([0,5,0],[0,0,-1]);fx.missileExplosion([0,5,0]);fx.update(.05);
   return {proxies:attached.length,boxes:boxes.length,moved,expected:original.toArray().map((v,i)=>v+[2,3,4][i]+boxes[0][i]),hidden,collisionUnchanged:collision===JSON.stringify(city.colliderCache.get(c.id)),nearVisible,farVisible,retained,particles:[fx.smoke,fx.dust,fx.sparks,fx.flashes,fx.flares].reduce((sum,p)=>sum+p.limit,0),shockwave:fx.boomMesh.count>0};
  });
  assert.equal(gameplay.proxies,gameplay.boxes);gameplay.moved.forEach((v,i)=>assert.ok(Math.abs(v-gameplay.expected[i])<.001));assert.ok(gameplay.hidden&&gameplay.collisionUnchanged);assert.ok(gameplay.nearVisible);assert.equal(gameplay.farVisible,false);assert.equal(gameplay.retained,2);assert.ok(gameplay.particles<=32);assert.ok(gameplay.shockwave);
  // Old settings and a shared high-quality link must not bypass the phone budget.
  await page.evaluate(()=>localStorage.setItem('colossus-tier','high'));await page.goto(url+'/?quality=high');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
  assert.equal(await page.evaluate(()=>window.__COLOSSUS.gameRenderer.tier.name),'MOBILE');
  const adaptive=await page.evaluate(()=>{const gr=window.__COLOSSUS.gameRenderer;gr.renderer.setAnimationLoop(null);gr.lastAdjust=0;gr.frameEMA=100;const before=gr.scale;for(let i=1;i<=8;i++)gr.adapt(.1,performance.now()+i*1000);const after=gr.scale;gr.toggleCinematic();return {before,after,bloom:gr.bloom,shadows:gr.shadows};});
  assert.ok(adaptive.after<adaptive.before,'100ms frames must lower resolution');assert.ok(adaptive.after>=.3);assert.equal(adaptive.bloom,false);assert.equal(adaptive.shadows,false);
  await page.setViewportSize({width:1366,height:1024});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>{const c=window.__COLOSSUS.renderer.domElement;return c.width*c.height<=190000;}));
 }
 assert.deepEqual(errors,[]);await writeFile(`artifacts/mobile-quality/${baseline?'before':'after'}.json`,JSON.stringify({samples,errors},null,2));console.log(JSON.stringify({samples,errors},null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
