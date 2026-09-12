// Inspect the city haze and prove culled surfaces dissolve into the same sky.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=26400+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`;
const baseline=process.argv.includes('--baseline'),label=baseline?'before':'after',errors=[],results=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});
let browser;await mkdir('artifacts/atmosphere',{recursive:true});
try{
 for(let i=0;i<100;i++){if(await fetch(url+'/healthz').then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const quality of baseline?['low']:['low','high','quest']){
  await page.goto(`${url}/?quality=${quality}`);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
  await page.evaluate(()=>{const c=window.__COLOSSUS;c.renderer.setAnimationLoop(null);c.renderer.setPixelRatio(1);c.gameRenderer.adaptive=false;document.body.replaceChildren(c.renderer.domElement);c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.rig.scale.setScalar(1);});
  for(const [name,p,target]of [['street',[0,2.5,40],[0,17,-40]],['rooftops',[0,20,40],[0,44,-45]],['flight',[70,90,55],[-25,40,-50]]]){
   await page.evaluate(async({p,target})=>{const c=window.__COLOSSUS;c.camera.position.set(...p);c.camera.lookAt(...target);c.camera.fov=82;c.camera.updateProjectionMatrix();for(let i=0;i<30;i++){c.gameRenderer.render(c.scene,c.camera,1/60);await new Promise(r=>requestAnimationFrame(r));}},{p,target});
   await page.screenshot({path:`artifacts/atmosphere/${label}-${quality}-${name}.png`});
  }
  const metrics=await page.evaluate(()=>({far:window.__COLOSSUS.scene.fog.far,glError:window.__COLOSSUS.renderer.getContext().getError(),failedAssets:window.__COLOSSUS.assetStatus.failed}));
  if(!baseline)metrics.concealment=await page.evaluate(async()=>{
   const c=window.__COLOSSUS,T=await import('three'),scene=new T.Scene(),camera=new T.PerspectiveCamera(100,innerWidth/innerHeight,.01,2000),rig=new T.Group();rig.add(camera);scene.add(rig);scene.fog=c.scene.fog;
   const source=c.city.sky,sky=new T.Mesh(source.geometry,source.material);sky.frustumCulled=false;sky.renderOrder=100;scene.add(sky);
   const geometry=new T.PlaneGeometry(1200,1200),wall=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xff00ff}));wall.frustumCulled=false;scene.add(wall);
   const gl=c.renderer.getContext(),w=innerWidth,h=innerHeight,read=()=>{
    if(c.gameRenderer.bloom){const composer=c.gameRenderer.ensureComposer(scene,camera);composer.passes[0].scene=scene;composer.passes[0].camera=camera;composer.render(1/60);}else c.renderer.render(scene,camera);
    const data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;
   };
   const compare=(a,b)=>{let max=0,changed=0,squared=0;for(let i=0;i<a.length;i+=4){const delta=[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])),d=Math.max(...delta);squared+=delta.reduce((n,v)=>n+v*v,0);max=Math.max(max,d);if(d>2)changed++;}return {max,changed,rms:Math.sqrt(squared/(w*h*3))};};
   const poses=[[0,20,0,0,.2,1],[5000,80,-5000,1.2,.55,1],[0,24,0,-1,-.1,14],[.032,24,0,.8,.4,14],[-.032,24,0,.8,.4,14]],samples=[];
   for(const [x,y,z,yaw,pitch,scale]of poses){
    rig.position.set(x,y,z);rig.scale.setScalar(scale);camera.rotation.set(pitch,yaw,0,'YXZ');scene.updateMatrixWorld(true);
    wall.visible=false;const background=read();wall.visible=true;const direction=camera.getWorldDirection(new T.Vector3());wall.position.copy(camera.getWorldPosition(new T.Vector3())).addScaledVector(direction,scene.fog.far+20);camera.getWorldQuaternion(wall.quaternion);
    const folded=compare(background,read());samples.push({scale,yaw,pitch,...folded});
   }
   rig.position.set(0,3,0);rig.scale.setScalar(1);camera.rotation.set(0,0,0);scene.updateMatrixWorld(true);wall.quaternion.identity();
   const i=(Math.floor(h/2)*w+Math.floor(w/2))*4,center=a=>Array.from(a.slice(i,i+3));wall.visible=false;const background=center(read());wall.visible=true;
   const fades=[];wall.material.fog=false;wall.material.needsUpdate=true;wall.position.set(0,3,-5);const clear=center(read());wall.material.fog=true;wall.material.needsUpdate=true;
   for(const distance of [5,80,110,120,130,140,145,scene.fog.far]){wall.position.z=-distance;const pixel=center(read()),delta=Math.hypot(...pixel.map((v,k)=>v-background[k])),full=Math.hypot(...clear.map((v,k)=>v-background[k]));fades.push({distance,fraction:1-delta/full});}
   const stale=[];c.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m?.fog||m.isShaderMaterial)return;const u=c.renderer.properties.get(m).uniforms;if(u?.citySkyReady&&u.citySkyReady.value!==1)stale.push(m.type);}});
   geometry.dispose();wall.material.dispose();return {samples,fades,stale};
  });
  assert.equal(metrics.far,150);assert.equal(metrics.glError,0);assert.deepEqual(metrics.failedAssets,[]);
  if(metrics.concealment){
   await writeFile(`artifacts/atmosphere/check-${quality}.json`,JSON.stringify(metrics.concealment,null,2));
   // HDR cloud edges and bloom amplify subpixel interpolation rounding. Measure
   // image-wide agreement, not a single brightest texel: a visible silhouette
   // would exceed both the 99.99% matching requirement and 1/4-level RMS budget.
   for(const s of metrics.concealment.samples)assert.ok(s.changed<130&&s.rms<.25,JSON.stringify(s));
   const f=metrics.concealment.fades;
   for(const sample of f.slice(0,3))assert.ok(Math.abs(sample.fraction)<.015,JSON.stringify(sample));
   assert.ok(f[3].fraction>=0&&f[3].fraction<.08);assert.ok(f.at(-1).fraction>.99);
   for(let i=3;i<f.length;i++)assert.ok(f[i].fraction>f[i-1].fraction);
   // Bloom changes measured color contrast. Check exact curve samples in the
   // direct-render tiers, and early clarity/monotonicity/concealment in cinematic.
   if(quality!=='high'){assert.ok(f[3].fraction<.04);assert.ok(f[4].fraction>.1&&f[4].fraction<.23);assert.ok(f[5].fraction>.5&&f[5].fraction<.68);assert.ok(f[6].fraction>.78&&f[6].fraction<.94);}
   assert.deepEqual(metrics.concealment.stale,[]);
  }
  results.push({quality,...metrics});
 }
 assert.deepEqual(errors,[]);const report={result:'PASS',label,results,errors};await writeFile(`artifacts/atmosphere/${label}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
