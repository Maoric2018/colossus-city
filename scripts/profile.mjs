// Real-GPU render profile: launches a visible Chromium (software rendering would lie), joins a
// practice match as a raider, flies for a few seconds and samples frame timing per quality tier.
// Usage: npm run profile [-- low medium high]   Results: artifacts/render-profile.json
import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.cache/ms-playwright');
const {chromium} = await import('playwright');
const tiers = process.argv.slice(2).filter(a => !a.startsWith('-'));
const list = tiers.length ? tiers : ['low', 'medium', 'high'];
await mkdir('artifacts', {recursive:true});
const port = 18000 + Math.floor(Math.random() * 1000), url = `http://localhost:${port}`;
const server = spawn(process.execPath, ['server/index.js'], {env:{...process.env, PORT:String(port)}, stdio:['ignore', 'pipe', 'pipe']});
let browser; const report = {created:new Date().toISOString(), viewport:'1600x900', gpu:null, tiers:{}};
try{
 for(let i = 0; i < 100; i++){ if(await fetch(`${url}/healthz`).then(r => r.ok).catch(() => false)) break; await delay(100); }
 browser = await chromium.launch({headless:false, channel:'chromium', args:['--enable-webgl', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1620,980']});
 for(const tier of list){
  const context = await browser.newContext({viewport:{width:1600, height:900}, deviceScaleFactor:1}), page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${url}/?quality=${tier}`); await page.waitForFunction(() => window.COLOSSUS_ART_READY === true);
  report.gpu ??= await page.evaluate(() => window.__COLOSSUS.gameRenderer.gpu);
  await page.evaluate(() => { window.__COLOSSUS.gameRenderer.adaptive = false; });
  const sample = async (label, seconds) => {
   const r = await page.evaluate(async seconds => {
    const c = window.__COLOSSUS, frames = []; let last = performance.now();
    await new Promise(resolve => { const start=performance.now();const tick=t=>{frames.push(t-last);last=t;if(t-start<seconds*1000)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick); });
    frames.shift(); frames.sort((a, b) => a - b);
    const p = q => frames[Math.min(frames.length - 1, Math.floor(frames.length * q))];
    return {fps:Math.round(1000 / (frames.reduce((s, x) => s + x, 0) / frames.length)), p50:+p(.5).toFixed(1), p95:+p(.95).toFixed(1), p99:+p(.99).toFixed(1), calls:c.renderer.info.render.calls, triangles:c.renderer.info.render.triangles, scale:c.gameRenderer.scale, shadows:c.gameRenderer.shadows, bloom:c.gameRenderer.bloom};
   }, seconds);
   console.log(tier, label, JSON.stringify(r)); return r;
  };
  const lobby = await sample('lobby', 3);
  await page.goto(`${url}/?quality=${tier}&role=boss&practice=1`); await page.waitForFunction(() => window.COLOSSUS_ART_READY === true); await page.waitForFunction(() => window.__COLOSSUS.state !== null);
  await page.locator('#resume').click(); await page.waitForTimeout(500);
  await page.keyboard.down('Space'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1500);
  const flight = await sample('flight', 4);
  await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
  // Stress: collapse two towers via the diagnostics hook on the server side is not exposed; instead
  // fire the breach shot repeatedly at the nearest tower to exercise skins, rubble and events.
  await page.mouse.down({button:'right'}); await page.waitForTimeout(900); await page.mouse.up({button:'right'}); await page.waitForTimeout(400);
  await page.mouse.down({button:'left'}); await page.waitForTimeout(1500); await page.mouse.up({button:'left'});
  const combat = await sample('combat', 3);
  await page.screenshot({path:`artifacts/profile-${tier}.png`});
  report.tiers[tier] = {lobby, flight, combat};
  await context.close();
 }
 await writeFile('artifacts/render-profile.json', JSON.stringify(report, null, 2)); console.log('Saved artifacts/render-profile.json');
}finally{ await browser?.close(); server.kill('SIGTERM'); }
