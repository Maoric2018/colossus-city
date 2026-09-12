// Room-authenticated signaling is separate from gameplay. Real-time video uses
// WebRTC's congestion control and late-frame dropping rather than a TCP queue.
export class ViewStream{
 constructor(owner,welcome){
  this.owner=owner;this.welcome=welcome;this.peers=new Map();this.rtc=typeof RTCPeerConnection==='function'&&typeof owner.canvas.captureStream==='function';this.signals=Promise.resolve();this.viewers=[];
  const socket=this.socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/views`);socket.binaryType='arraybuffer';
  socket.onopen=()=>this.send({room:welcome.room,id:welcome.id,key:welcome.viewKey,watch:owner.visible===true,rtc:this.rtc});
  socket.onmessage=({data})=>{
   if(typeof data!=='string'){owner.receiveImage(data,this);return;}
   const m=JSON.parse(data);
   if(m.type==='view-ready')this.iceServers=m.iceServers;
   if(m.type==='capture'){owner.active=m.active;this.viewers=m.viewers||[];this.syncViewers();}
   if(m.type==='image-ack')this.imagePending=false;
   if(m.type==='view-info'){const card=owner.cards.get(m.id);if(card)Object.assign(card,{mode:m.mode,paused:m.paused,tracking:m.tracking});}
   if(m.type==='signal')this.signals=this.signals.then(()=>this.signal(m)).catch(()=>this.fail(m.from));
  };
  socket.onclose=()=>{this.stopPeers();if(owner.stream!==this)return;owner.active=false;if(!this.closed)this.retry=setTimeout(()=>{if(owner.stream===this)owner.connect(welcome,true);},2000);};
 }
 send(m){if(this.socket.readyState===1&&this.socket.bufferedAmount<32*1024)this.socket.send(JSON.stringify(m));}
 watch(active){if(!active)this.stopPeers();this.send({type:'watch',active});}
 close(){this.closed=true;clearTimeout(this.retry);this.stopPeers();this.socket.close();}
 stopPeers(){for(const id of this.peers.keys())this.remove(id);this.track?.stop();this.track=null;this.media=null;this.viewers=[];}
 remove(id){const peer=this.peers.get(id);if(!peer)return;this.peers.delete(id);clearTimeout(peer.timeout);peer.pc.close();const card=this.owner.cards.get(id);if(card){if(card.callback)card.video.cancelVideoFrameCallback?.(card.callback);card.video.srcObject=null;card.received=0;}}
 fail(id){if(this.closed)return;this.remove(id);if(this.welcome.role==='spectator'&&this.owner.visible){this.send({type:'fallback',id});const card=this.owner.cards.get(id);if(card)card.transport='fallback';}else if(!this.closed&&this.viewers.some(v=>v.id===id&&v.rtc)){
   // A failed sender is renegotiated; the receiver's watchdog also switches to
   // the bounded JPEG fallback if no usable video arrives.
   this.offer(id).catch(()=>{});
  }}
 syncViewers(){
  for(const id of this.peers.keys())if(!this.viewers.some(v=>v.id===id&&v.rtc))this.remove(id);
  if(!this.viewers.some(v=>v.rtc)){this.track?.stop();this.track=null;this.media=null;return;}
  try{
   if(!this.track){this.media=this.owner.canvas.captureStream(0);this.track=this.media.getVideoTracks()[0];if(!this.track.requestFrame){this.track.stop();this.media=this.owner.canvas.captureStream(30);this.track=this.media.getVideoTracks()[0];}this.track.contentHint='motion';}
   for(const v of this.viewers)if(v.rtc&&!this.peers.has(v.id))this.offer(v.id).catch(()=>this.send({type:'media-unavailable'}));
  }catch{this.send({type:'media-unavailable'});}
 }
 peer(id,session){
  const pc=new RTCPeerConnection({iceServers:this.iceServers||[]}),peer={pc,session,ice:[],announced:false};this.peers.set(id,peer);
  pc.onicecandidate=e=>{if(e.candidate&&this.peers.get(id)===peer){const m={type:'signal',to:id,session,candidate:e.candidate.toJSON()};if(peer.announced)this.send(m);else peer.ice.push(m);}};
  pc.onconnectionstatechange=()=>{if(this.peers.get(id)!==peer)return;if(pc.connectionState==='failed')this.fail(id);};
  if(this.welcome.role==='spectator'){
   peer.timeout=setTimeout(()=>{if(this.peers.get(id)===peer)this.fail(id);},8000);
   pc.ontrack=e=>{
    const card=this.owner.cards.get(id);if(!card)return;
    // Browser support varies; a small jitter cushion prevents late-frame stutter while keeping delay low.
    try{if('jitterBufferTarget'in e.receiver)e.receiver.jitterBufferTarget=30;if('playoutDelayHint'in e.receiver)e.receiver.playoutDelayHint=.03;}catch{}
    card.rateStart=0;card.fps=undefined;card.latency=undefined;card.video.srcObject=new MediaStream([e.track]);card.transport='video';card.video.hidden=false;card.surface.hidden=true;card.video.play().catch(()=>this.fail(id));
    const presented=(now,meta)=>{
     if(this.peers.get(id)!==peer)return;clearTimeout(peer.timeout);peer.timeout=setTimeout(()=>{if(this.peers.get(id)===peer)this.fail(id);},8000);
     card.received=now;card.frames+=meta.presentedFrames-(peer.lastPresented??meta.presentedFrames-1);peer.lastPresented=meta.presentedFrames;if(Number.isFinite(meta.captureTime)){const latency=now-meta.captureTime;if(latency>=0&&latency<10000)card.latency=latency;}
     if(!card.rateStart){card.rateStart=now;card.rateFrames=card.frames;}
     if(now-card.rateStart>=1000){card.fps=(card.frames-card.rateFrames)*1000/(now-card.rateStart);card.rateStart=now;card.rateFrames=card.frames;}
     card.callback=card.video.requestVideoFrameCallback(presented);
    };
    if(card.video.requestVideoFrameCallback)card.callback=card.video.requestVideoFrameCallback(presented);
    else{clearTimeout(peer.timeout);card.video.onloadeddata=card.video.ontimeupdate=()=>{card.received=performance.now();};}
   };
  }
  return peer;
 }
 async offer(id){
  if(this.closed||!this.track||this.peers.has(id))return;
  const peer=this.peer(id,Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-')),sender=peer.pc.addTrack(this.track,this.media);
  const parameters=sender.getParameters();parameters.encodings??=[{}];parameters.encodings[0].maxBitrate=1200000;parameters.encodings[0].maxFramerate=30;parameters.degradationPreference='maintain-framerate';await sender.setParameters(parameters).catch(()=>{});
  await peer.pc.setLocalDescription(await peer.pc.createOffer());
  if(this.peers.get(id)===peer)this.announce(id,peer);
 }
 announce(id,peer){this.send({type:'signal',to:id,session:peer.session,description:peer.pc.localDescription});peer.announced=true;for(const m of peer.ice)this.send(m);peer.ice=[];}
 async signal(m){
  if(this.closed)return;
  let peer=this.peers.get(m.from);
  if(m.description?.type==='offer'){
   if(this.welcome.role!=='spectator'||!this.owner.visible)return;
   this.remove(m.from);peer=this.peer(m.from,m.session);
   await peer.pc.setRemoteDescription(m.description);await peer.pc.setLocalDescription(await peer.pc.createAnswer());
   if(this.peers.get(m.from)===peer)this.announce(m.from,peer);
  }else if(peer?.session===m.session){
   if(m.description?.type==='answer')await peer.pc.setRemoteDescription(m.description);
   else if(m.candidate)await peer.pc.addIceCandidate(m.candidate);
  }
 }
 publish(){this.track?.requestFrame?.();}
 get fallback(){return this.viewers.some(v=>!v.rtc);}
 image(){
  if(!this.fallback||this.imagePending||this.encoding||this.socket.readyState!==1||this.socket.bufferedAmount>16*1024)return;
  this.encoding=true;this.owner.canvas.toBlob(blob=>{this.encoding=false;if(!this.closed&&blob&&blob.size<96*1024&&this.socket.readyState===1&&this.socket.bufferedAmount<16*1024){this.imagePending=true;this.socket.send(blob);}},'image/jpeg',.55);
 }
}
