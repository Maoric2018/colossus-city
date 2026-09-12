import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('.cache/ms-playwright');
const {chromium}=await import('playwright'),port=28000+Math.floor(Math.random()*500),errors=[];
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),VIEW_ICE_SERVERS:'[]'},stdio:'ignore'});let browser;
try{
 await mkdir('artifacts',{recursive:true});for(let i=0;i<100;i++){if(await fetch(`http://localhost:${port}/healthz`).then(r=>r.ok).catch(()=>false))break;await delay(100);}
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://localhost:${port}/?quality=quest`);await page.waitForFunction(()=>window.COLOSSUS_ART_READY);
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{FineBuildings}=await import('/src/world/fine-buildings.js'),{fractureRecipe}=await import('/shared/city/fracture.js'),g=window.__COLOSSUS,{renderer,city}=g;
  renderer.setAnimationLoop(null);renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(1000,800);document.body.replaceChildren(renderer.domElement);
  const scene=new T.Scene(),root=new T.Group();scene.add(root,new T.AmbientLight(0xffffff,2));scene.background=new T.Color(0x172330);
  const fine=new FineBuildings(root,city.tier),c=city.cells.find(c=>c.material==='brick'&&c.floor===2&&c.walls[2]),piece=fractureRecipe(c).pieces.find(p=>p.kind==='wall'&&p.side===2&&p.material==='brick'&&Math.abs(p.p[0])<1&&p.p[1]<-.8),origin=piece.p.map((n,k)=>n+c.p[k]);
  if(!piece)throw Error('Missing brick fixture');
  const add=(id,p)=>fine.addShards(c,{id,cell:c.id,pieces:[piece.id],origin,p,q:[0,0,0,1],settled:true,born:0},city.buildings);
  // A close view into a cut edge must hit textured red masonry, with the original
  // material and UVs. The ray targets the cut plane rather than an outer facade.
  add(1,[0,0,0]);const camera=new T.PerspectiveCamera(42,1.25,.005,250);
  camera.position.set(1,.04,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);fine.select(camera);fine.commit();renderer.render(scene,camera);
  const gl=renderer.getContext(),read=()=>{const a=new Uint8Array(1000*800*4);gl.readPixels(0,0,1000,800,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;},pixels=read();
  let red=0,white=0;for(let y=240;y<560;y++)for(let x=380;x<620;x++){const i=(y*1000+x)*4;if(pixels[i]>pixels[i+1]*1.25&&pixels[i]>pixels[i+2]*1.3&&pixels[i]>35)red++;if(Math.min(pixels[i],pixels[i+1],pixels[i+2])>220)white++;}
  const interior={redPixels:red,whitePixels:white,image:renderer.domElement.toDataURL()};
  fine.reset();
  // Reuse actual brick geometry in front, behind and beside the camera. Every
  // piece stays in simulation; only submitted render work should change.
  for(let i=0;i<480;i++){const a=i*Math.PI*2/480;add(i+1,[Math.sin(a)*(25+i%13),((i%17)-8)*.55,Math.cos(a)*(25+i%13)]);}
  const setCulling=enabled=>{for(const p of fine.pools.values()){p.mesh.perObjectFrustumCulled=enabled;p.mesh.setVisibleAt(0,false);p.mesh.setVisibleAt(0,true);}};
  const render=(camera,enabled)=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);fine.select(camera);fine.commit();setCulling(enabled);renderer.info.reset();renderer.render(scene,camera);return {triangles:renderer.info.render.triangles,draws:renderer.info.render.calls,pixels:read()};};
  const compare=(a,b)=>{let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>9)changed++;return changed/(1000*800);};
  const views=[];camera.position.set(0,0,0);for(const yaw of [0,Math.PI,Math.PI/2]){camera.rotation.set(0,yaw,0);const all=render(camera,false),culled=render(camera,true);views.push({yaw,allTriangles:all.triangles,visibleTriangles:culled.triangles,pixelDifference:compare(all.pixels,culled.pixels)});}
  const left=new T.PerspectiveCamera(42,.625,.005,250),right=left.clone();left.rotation.y=-.5;right.rotation.y=.5;left.viewport=new T.Vector4(0,0,500,800);right.viewport=new T.Vector4(500,0,500,800);left.updateMatrixWorld(true);right.updateMatrixWorld(true);
  const stereo=new T.ArrayCamera([left,right]),all=render(stereo,false),culled=render(stereo,true);views.push({stereo:true,allTriangles:all.triangles,visibleTriangles:culled.triangles,pixelDifference:compare(all.pixels,culled.pixels)});
  return {interior,views,retainedShards:fine.shards.size};
 });
 await writeFile('artifacts/fracture-cut-interior.png',Buffer.from(report.interior.image.split(',')[1],'base64'));delete report.interior.image;
 assert.ok(report.interior.redPixels>150,'the cut interior should show the source brick color');assert.equal(report.interior.whitePixels,0,'cut surface must not become plain white');assert.equal(report.retainedShards,480);
 for(const view of report.views){assert.ok(view.visibleTriangles<view.allTriangles*.55,JSON.stringify(view));assert.ok(view.pixelDifference<.0001,JSON.stringify(view));}
 assert.deepEqual(errors,[]);await writeFile('artifacts/fracture-render-report.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
