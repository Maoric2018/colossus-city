// Verify the downloaded cloud panorama actually renders in the infinite city,
// remains at infinity, and blends into the same haze as distant buildings.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=28000+Math.floor(Math.random()*800),url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
const errors=[],results=[];let browser;await mkdir('artifacts',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const quality of ['low','high','quest']){
  await page.goto(`${url}/?quality=${quality}`);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
  const result=await page.evaluate(async()=>{
   const c=window.__COLOSSUS,T=await import('three');c.renderer.setAnimationLoop(null);c.renderer.setPixelRatio(1);c.gameRenderer.adaptive=false;
   const source=c.city.sky,material=source.material,map=material.uniforms.panorama.value;
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(82,innerWidth/innerHeight,.1,900),sky=new T.Mesh(source.geometry,material);sky.frustumCulled=false;scene.add(sky);
   const gl=c.renderer.getContext(),w=innerWidth,h=innerHeight;
   const read=()=>{c.renderer.render(scene,camera);const data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
   const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>2)n++;return n;};
   camera.rotation.x=.4;const original=read();let cloudPixels=0,bluePixels=0,min=255,max=0;
   for(let i=0;i<original.length;i+=4){const r=original[i],g=original[i+1],b=original[i+2];if(r>140&&Math.abs(r-g)<30&&b-r<40)cloudPixels++;if(b-r>40)bluePixels++;min=Math.min(min,r);max=Math.max(max,r);}
   camera.position.set(5000,300,-5000);const translated=changed(original,read());
   camera.position.set(-.032,0,0);const left=read();camera.position.x=.032;const eyeParallax=changed(left,read());
   camera.position.set(0,0,0);camera.rotation.set(0,0,0);const horizon=read(),i=(Math.floor(h/2)*w+Math.floor(w/2))*4;
   // Far geometry must meet the actual, tone-mapped sky, including its haze.
   scene.fog=c.scene.fog;const wall=new T.Mesh(new T.PlaneGeometry(500,500),new T.MeshBasicMaterial({color:0}));wall.position.z=-160;scene.add(wall);
   const fogged=read(),horizonError=Math.max(...[0,1,2].map(k=>Math.abs(fogged[i+k]-horizon[i+k])));scene.remove(wall);wall.geometry.dispose();wall.material.dispose();scene.fog=null;
   c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.rig.scale.setScalar(1);c.camera.position.set(0,20,40);c.camera.rotation.set(.25,0,0,'YXZ');c.camera.fov=82;c.camera.updateProjectionMatrix();
   document.body.replaceChildren(c.renderer.domElement,document.getElementById('flight-effects'));c.gameRenderer.render(c.scene,c.camera,1/60);
   return {quality:c.gameRenderer.tierName,panorama:[map.image.width,map.image.height],cloudPixels,bluePixels,contrast:max-min,translated,eyeParallax,horizonError,failedAssets:c.assetStatus.failed,glError:gl.getError()};
  });
  await page.screenshot({path:`artifacts/cloud-sky-${quality}.png`});results.push(result);
  assert.deepEqual(result.panorama,quality==='quest'?[1024,512]:[2048,1024]);
  assert.ok(result.cloudPixels>5000&&result.bluePixels>5000&&result.contrast>60,'Both cloud detail and blue sky must be visible');
  assert.equal(result.translated,0,'The sky must not move as the pilot flies across the city');assert.equal(result.eyeParallax,0,'The panorama must stay at infinity in stereo');
  assert.ok(result.horizonError<=2,'The horizon must meet the existing city fog');assert.equal(result.glError,0);assert.deepEqual(result.failedAssets,[]);
 }
 assert.deepEqual(errors,[]);const report={result:'PASS',views:results,browserErrors:errors};await writeFile('artifacts/sky-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
