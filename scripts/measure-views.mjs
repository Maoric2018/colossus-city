// Measures actual encoded pixels from capture to presentation on this machine.
// The timestamp covers encoding, transport and presentation after the game
// canvas is copied. It does not measure game rendering or physical tracking.
export async function measureViews(publishers,observer){
 for(const page of publishers)await page.evaluate(()=>{
  const stream=window.__COLOSSUS.views.stream,original=stream.publish.bind(stream);window.captureMeasurement={start:performance.now(),frames:0};stream.publish=()=>{
   window.captureMeasurement.frames++;
   const ctx=stream.owner.context,stamp=Date.now()>>>0;ctx.fillStyle='black';ctx.fillRect(0,0,272,20);ctx.fillStyle='white';ctx.fillRect(0,0,8,20);ctx.fillRect(264,0,8,20);
   for(let bit=0;bit<32;bit++){ctx.fillStyle=(stamp>>>bit)&1?'white':'black';ctx.fillRect(8+bit*8,0,8,20);}original();
  };window.restoreVideoStamp=()=>{stream.publish=original;};
 });
 await observer.evaluate(()=>{
  window.videoMeasurements=new Map();
  for(const [id,card]of window.__COLOSSUS.views.cards){
   const canvas=document.createElement('canvas');canvas.width=272;canvas.height=20;const ctx=canvas.getContext('2d',{willReadFrequently:true}),samples=[],presentations=[];window.videoMeasurements.set(id,{samples,presentations,role:card.role});
   const frame=(now,meta)=>{
    presentations.push({now,frames:meta.presentedFrames});
    ctx.drawImage(card.video,0,0,272,20,0,0,272,20);const pixels=ctx.getImageData(0,0,272,20).data,white=x=>{const i=(10*272+x)*4;return pixels[i]+pixels[i+1]+pixels[i+2]>384;};
    if(white(4)&&white(268)){let stamp=0;for(let bit=0;bit<32;bit++)if(white(12+8*bit))stamp=(stamp|(1<<bit))>>>0;const latency=((Date.now()>>>0)-stamp)>>>0;if(latency<2000)samples.push({now,latency});}
    if(window.videoMeasurements)card.video.requestVideoFrameCallback(frame);
   };card.video.requestVideoFrameCallback(frame);
  }
 });
 await observer.waitForTimeout(6500);
 const measured=await observer.evaluate(async()=>{
  const rows=[...window.videoMeasurements].map(([id,{role,samples,presentations}])=>{const steady=samples.filter(s=>s.now>=samples[0]?.now+1000),latencies=steady.map(s=>s.latency).sort((a,b)=>a-b);return {id,role,presentedFps:(presentations.at(-1).frames-presentations[0].frames)*1000/(presentations.at(-1).now-presentations[0].now),callbackFps:(presentations.length-1)*1000/(presentations.at(-1).now-presentations[0].now),samples:steady.length,timestampSampleFps:steady.length>1?(steady.length-1)*1000/(steady.at(-1).now-steady[0].now):0,medianMs:latencies[Math.floor(latencies.length*.5)],p95Ms:latencies[Math.floor(latencies.length*.95)],maxMs:latencies.at(-1)};});window.videoMeasurements=null;for(const row of rows){const peer=window.__COLOSSUS.views.stream.peers.get(row.id);row.inbound=[...await peer.pc.getStats()].map(([,s])=>s).filter(s=>s.type==='inbound-rtp').map(s=>({framesDecoded:s.framesDecoded,framesDropped:s.framesDropped,framesPerSecond:s.framesPerSecond,jitterBufferDelay:s.jitterBufferDelay,jitterBufferEmittedCount:s.jitterBufferEmittedCount}));}return rows;
 });
 for(const page of publishers){const capture=await page.evaluate(async()=>{window.restoreVideoStamp();const {views,net,renderer}=window.__COLOSSUS;return {id:net.id,captureFps:window.captureMeasurement.frames*1000/(performance.now()-window.captureMeasurement.start),targetCaptureFps:1000/views.captureBudget.interval(renderer.xr.isPresenting?24:30),captureCostMS:views.captureBudget.cost,captureScale:views.captureBudget.scale,hidden:document.hidden,outbound:await Promise.all([...views.stream.peers.values()].map(async p=>[...await p.pc.getStats()].map(([,s])=>s).filter(s=>s.type==='outbound-rtp').map(s=>({framesSent:s.framesSent,framesEncoded:s.framesEncoded,framesPerSecond:s.framesPerSecond,qualityLimitationReason:s.qualityLimitationReason,totalEncodeTime:s.totalEncodeTime}))))};});Object.assign(measured.find(m=>m.id===capture.id),capture);}
 return measured;
}
