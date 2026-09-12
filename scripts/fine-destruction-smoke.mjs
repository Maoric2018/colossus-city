import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {Room,physicsReady} from '../server/room.js';
import {midtown} from '../shared/city/layout.js';
import {chipCell,shardMeta} from '../server/fracture.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=27000+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
await mkdir('artifacts',{recursive:true});await physicsReady;
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1200,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);assert.equal(await page.locator('#spawn-chrysler').count(),0);
 await page.evaluate(()=>{const {renderer}=window.__COLOSSUS;renderer.setAnimationLoop(null);document.body.replaceChildren(renderer.domElement);});
 const reports=[];
 for(const material of ['brick','glass','stone','concrete']){
  const env={...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material,architecture:'urban',tiers:[{nx:1,nz:1,floors:5,ix:0,iz:0}]}]},r=new Room('FINE',{environment:env});r.attach({send(){}},'boss','test');
  try{
   const c=r.cells.find(c=>c.floor===2),at=[c.p[0],c.p[1],c.p[2]+2];
   const before=await page.evaluate(async({env,id,at})=>{
    const T=await import('three'),{CityView}=await import('/src/world/city.js'),{TIERS}=await import('/src/render/quality.js'),g=window.__COLOSSUS;
    const scene=new T.Scene(),city=new CityView(scene,env,{tier:TIERS.quest,quest:true}),camera=new T.PerspectiveCamera(46,1200/900,.1,300);await city.ready;
    // City.ready covers models; texture image loads must finish before comparing pixels.
    const textures=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
    await new Promise((resolve,reject)=>{const deadline=performance.now()+15000;function check(){if([...textures].every(t=>t.image&&t.image.complete!==false&&(t.image.width||t.image.videoWidth)))return resolve();if(performance.now()>deadline)return reject(new Error('Building textures did not finish loading'));requestAnimationFrame(check);}check();});
    camera.position.set(6,12,-4);camera.lookAt(0,9,-20);camera.updateMatrixWorld(true);g.renderer.shadowMap.enabled=false;g.renderer.render(scene,camera);window.fineShot={scene,city,camera,id,at};
    const gl=g.renderer.getContext(),pixels=new Uint8Array(1200*900*4),matched=new Uint8Array(pixels.length);gl.readPixels(0,0,1200,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);city.setFracture(id,[]);g.renderer.render(scene,camera);gl.readPixels(0,0,1200,900,gl.RGBA,gl.UNSIGNED_BYTE,matched);let changed=0,error=0;for(let i=0;i<pixels.length;i+=4){const d=Math.abs(pixels[i]-matched[i])+Math.abs(pixels[i+1]-matched[i+1])+Math.abs(pixels[i+2]-matched[i+2]);error+=d;if(d>15)changed++;}if(!pixels.some((n,i)=>i%4!==3&&n>20))throw new Error('Appearance comparison did not read rendered pixels');window.fineShot.originalPixels=pixels;window.fineShot.match={changedFraction:changed/(1200*900),meanError:error/(1200*900*3)};city.reset();g.renderer.render(scene,camera);
    return city.rayDistance(new T.Vector3(at[0],at[1],at[2]+3),new T.Vector3(0,0,-1),12);
   },{env,id:c.id,at});await page.screenshot({path:`artifacts/fine-${material}-before.png`});
   const removed=chipCell(r,c,at,1.05,Infinity,0,[1,2,5]),freshShards=[...r.shards.values()].map(shardMeta);for(let i=0;i<180;i++)r.step();const shards=[...r.shards.values()].map(shardMeta),parts=c.skin.parts;
   const report=await page.evaluate(async({parts,shards,freshShards,before})=>{
    const T=await import('three'),g=window.__COLOSSUS,{city,scene,camera,id,at}=window.fineShot;city.setFracture(id,parts);for(const e of freshShards)city.addShards(e);g.renderer.render(scene,camera);const gl=g.renderer.getContext(),pixels=new Uint8Array(1200*900*4),original=window.fineShot.originalPixels;gl.readPixels(0,0,1200,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let different=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-original[i])+Math.abs(pixels[i+1]-original[i+1])+Math.abs(pixels[i+2]-original[i+2])>15)different++;window.fineShot.reassembledDifference=different/(1200*900);window.fineShot.reassembledURL=g.renderer.domElement.toDataURL();
    for(const e of shards)city.addShards(e);g.renderer.info.reset();g.renderer.render(scene,camera);
    const after=city.rayDistance(new T.Vector3(at[0],at[1],at[2]+3),new T.Vector3(0,0,-1),12),e=city.buildings.pose(id),m=new T.Matrix4();city.buildings.frame.getMatrixAt(e.frameIndex,m);
    const finite=[...city.fine.pools.values()].every(b=>[...b.mesh.geometry.attributes.position.array.slice(0,b.allocated*3)].every(Number.isFinite)),count=[...city.fine.pools.values()].reduce((n,b)=>n+b.count,0);
    return {reassembledDifference:window.fineShot.reassembledDifference,appearanceMatch:window.fineShot.match,before,after,wholeFrameHidden:m.elements.slice(0,12).every(n=>n===0),fineDraws:count,finite,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
   },{parts,shards,freshShards,before});await writeFile(`artifacts/fine-${material}-reassembled.png`,Buffer.from((await page.evaluate(()=>window.fineShot.reassembledURL)).split(',')[1],'base64'));assert.ok(report.after>report.before+2);assert.ok(report.reassembledDifference<.025,report.reassembledDifference);assert.ok(report.appearanceMatch.changedFraction<.025,JSON.stringify(report.appearanceMatch));assert.ok(report.wholeFrameHidden&&report.finite&&report.fineDraws>3);assert.ok(!r.detached.has(c.id));
   reports.push({material,removed:removed.length,shards:shards.length,...report});await page.screenshot({path:`artifacts/fine-${material}-after.png`});
   await page.evaluate(()=>{const {city,camera,scene}=window.fineShot;city.reset();window.__COLOSSUS.renderer.render(scene,camera);if(city.fine.cells.size||city.fine.shards.size)throw new Error('Fine state survived round reset');city.root.removeFromParent();});
  }finally{r.dispose();}
 }
 assert.deepEqual(errors,[]);const report={result:'PASS',models:reports,errors};await writeFile('artifacts/fine-destruction-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
