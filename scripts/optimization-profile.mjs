// Repeatable, actual-GPU CPU/upload profile. It does not claim physical Quest FPS.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),output=process.argv[2]||'artifacts/optimization/current',port=23000+Math.floor(Math.random()*900),url=`http://127.0.0.1:${port}`;
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
const report={created:new Date().toISOString(),description:'Mac GPU; CPU time issuing a frame, not GPU completion or physical Quest FPS',scenes:[],errors:[]};
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url+'/?quality=quest');await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 report.loading=await page.evaluate(()=>{const resources=performance.getEntriesByType('resource').filter(r=>r.decodedBodySize>0);return {files:resources.length,decodedBytes:resources.reduce((n,r)=>n+r.decodedBodySize,0),encodedBytes:resources.reduce((n,r)=>n+r.encodedBodySize,0),resources:resources.map(r=>({path:new URL(r.name).pathname,decoded:r.decodedBodySize,encoded:r.encodedBodySize}))};});
 await page.evaluate(()=>{const c=window.__COLOSSUS;c.renderer.setAnimationLoop(null);c.rig.scale.setScalar(1);c.rig.position.set(0,0,0);c.giant.root.visible=false;document.body.replaceChildren(c.renderer.domElement);});
 report.gpu=await page.evaluate(()=>window.__COLOSSUS.gameRenderer.gpu);
 const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 for(const name of ['home-idle','home-turn','street-travel']){
  const sample=await page.evaluate(async name=>{
   const c=window.__COLOSSUS,{renderer,camera,scene,city}=c,gl=renderer.getContext(),sub=gl.bufferSubData.bind(gl);let uploads=0,bytes=0;
   gl.bufferSubData=function(...a){uploads++;const source=a[2],size=source.BYTES_PER_ELEMENT||1;bytes+=(a[4]!==undefined?a[4]*size:source.byteLength-(a[3]||0)*size);return sub(...a);};
   const pose=i=>{if(name==='street-travel'){camera.position.set(595+i*.2,20,480-i*.35);camera.lookAt(camera.position.x+20,18,camera.position.z-40);}else{camera.position.set(40,32,35);const t=name==='home-turn'?i*.008:0;camera.lookAt(40+Math.sin(t)*60,20,35-Math.cos(t)*60);}camera.updateMatrixWorld(true);};
   pose(0);for(let i=0;i<24;i++){renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}uploads=0;bytes=0;
   const cpu=[],interval=[],draw=[],triangles=[];let last=performance.now();
   for(let i=0;i<240;i++){await new Promise(r=>requestAnimationFrame(r));const at=performance.now();interval.push(at-last);last=at;pose(i);renderer.info.reset();city.update(1/120);c.fx.update(1/120);renderer.render(scene,camera);cpu.push(performance.now()-at);draw.push(renderer.info.render.calls);triangles.push(renderer.info.render.triangles);}
   gl.bufferSubData=sub;cpu.sort((a,b)=>a-b);interval.sort((a,b)=>a-b);const pct=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))],mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
   return {cpuMean:mean(cpu),cpuP95:pct(cpu,.95),cpuMax:cpu.at(-1),frameP95:pct(interval,.95),uploadMB:bytes/1e6,uploads,meanDrawCalls:mean(draw),meanTriangles:mean(triangles),geometryCount:renderer.info.memory.geometries,textures:renderer.info.memory.textures,loadedBlocks:city.stream.views.size};
  },name);report.scenes.push({name,...sample});console.log(name,JSON.stringify(sample));await page.screenshot({path:`${output}/${name}.png`});
 }
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`${output}/client.cpuprofile`,JSON.stringify(profile));await writeFile(`${output}/client.json`,JSON.stringify(report,null,2));if(report.errors.length)throw Error(report.errors.join('\n'));
}finally{await browser?.close();server.kill('SIGTERM');}
