import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {serve,root} from './serve.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.join(root,'.cache/ms-playwright');
const {chromium}=await import('playwright');
const args=process.argv.slice(2),stills=args.includes('--stills'),width=Number(args.find(a=>a.startsWith('--width='))?.split('=')[1]||(stills?1280:1920));
const only=args.find(a=>a.startsWith('--shot='))?.split('=')[1];
const times=args.find(a=>a.startsWith('--times='))?.split('=')[1].split(',').map(Number);
const extendedMode=args.includes('--extended'),actionMode=args.includes('--action')||extendedMode,noText=args.includes('--no-text')||actionMode;
const output=path.join(root,'artifacts/cinematic-demo',extendedMode?'extended':actionMode?'action':noText?'no-text':'');await mkdir(output,{recursive:true});
const {server,url}=await serve();let browser,encoder;const errors=[];
try{
 browser=await chromium.launch({headless:true,channel:'chromium',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const page=await browser.newPage({viewport:{width,height:Math.round(width*9/16)},deviceScaleFactor:1});
 page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
 await page.goto(`${url}/?width=${width}&text=${noText?0:1}&edit=${extendedMode?'extended':actionMode?'action':'original'}`);await page.waitForFunction(()=>window.DIRECTOR_READY);await page.waitForLoadState('networkidle');
 console.log('Director ready',await page.evaluate(()=>director.diagnostics()));
 const shots=await page.evaluate(()=>director.shots);
 if(stills){
  if(times){for(const t of times){const b64=await page.evaluate(async t=>{await director.frame(t);return director.png();},t);await writeFile(path.join(output,`still-at-${t}.png`),Buffer.from(b64,'base64'));console.log('Contact',t);}}
  else
  for(const shot of shots.filter(s=>!only||s.id===only)){
   const t=shot.start+(shot.end-shot.start)*.48;
   const b64=await page.evaluate(async t=>{await director.frame(t);return director.png();},t);
   await writeFile(path.join(output,`still-${shot.id}.png`),Buffer.from(b64,'base64'));console.log('Still',shot.id,t);
  }
 }else{
  const selected=only?shots.filter(s=>s.id===only):shots;
  for(const shot of selected){
   const frames=Math.round((shot.end-shot.start)*24),file=path.join(output,`shot-${shot.id}.mp4`);
   encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','ignore','pipe']});
   let encodeErrors='';encoder.stderr.on('data',b=>encodeErrors+=b);encoder.stdin.on('error',()=>{});
   const closed=once(encoder,'close');const at=Date.now();
   for(let i=0;i<frames;i++){
    const t=shot.start+i/24;
    const b64=await page.evaluate(async t=>{await director.frame(t);return director.jpeg();},t);
    if(!encoder.stdin.write(Buffer.from(b64,'base64')))await once(encoder.stdin,'drain');
    if(i%48===0)console.log(JSON.stringify({shot:shot.id,frame:i,total:frames,seconds:Math.round((Date.now()-at)/1000)}));
   }
   encoder.stdin.end();const [code]=await closed;encoder=null;if(code!==0)throw Error(encodeErrors);
   console.log('Rendered',shot.id,`${Math.round((Date.now()-at)/1000)}s`);
  }
 }
 const diagnostics=await page.evaluate(()=>director.diagnostics());
 await writeFile(path.join(output,stills?'stills-report.json':'capture-report.json'),JSON.stringify({width,height:Math.round(width*9/16),fps:24,showText:!noText,shots,diagnostics,errors},null,2));
 if(errors.length||diagnostics.failedAssets.length||diagnostics.glError)throw Error('Render validation failed');
}finally{encoder?.kill();await browser?.close();await new Promise(r=>server.close(r));}
