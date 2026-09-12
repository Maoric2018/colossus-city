import * as T from 'three';
import {ViewStream} from './view-stream.js';
import {bossHealthFraction} from '../shared/boss-health.js';
// Feed pixels come from each player's renderer. XR is rendered with the actual
// left-eye matrices; it is not reconstructed from delayed multiplayer snapshots.
export class SpectatorViews{
 constructor(renderer,scene,camera,{getState,getRole,getPlayerId,getMode,getPaused,getTracking,players,giant,xr}={}){
  Object.assign(this,{renderer,scene,camera,getState,getRole,getPlayerId,getMode,getPaused,getTracking,players,giant,xr});
  this.canvas=document.createElement('canvas');this.canvas.width=640;this.canvas.height=400;this.context=this.canvas.getContext('2d');
  this.mirror=new T.PerspectiveCamera();
  this.panel=document.getElementById('spectator-panel');this.grid=document.getElementById('spectator-grid');this.cards=new Map();this.roster=[];this.lastFrame=0;this.botCursor=0;this.active=false;
 }
 connect(welcome,retry=false){
  if(!retry&&this.key===welcome.viewKey&&this.stream?.socket.readyState<=1)return;
  if(retry)welcome={...welcome,roster:this.roster};
  this.disconnect();this.key=welcome.viewKey;this.role=welcome.role;this.updateRoster(welcome.roster||[]);this.stream=new ViewStream(this,welcome);
 }
 disconnect(){this.key=null;this.stream?.close();this.stream=null;this.active=false;for(const c of this.cards.values())c.video.srcObject=null;this.cards.clear();this.grid.replaceChildren();}
 setVisible(visible){this.visible=visible;if(this.role==='spectator')this.stream?.watch(visible);this.panel.classList.toggle('hidden',!visible);document.body.classList.toggle('spectator-open',visible);}
 updateRoster(roster){
  this.roster=roster;const ids=new Set();for(const p of roster){if(p.role==='spectator')continue;ids.add(p.id);if(this.cards.has(p.id))continue;
   const card=document.createElement('article'),title=document.createElement('header'),video=document.createElement('video'),surface=document.createElement('canvas'),status=document.createElement('p');
   title.textContent=`${p.role==='boss'?'COLOSSUS':p.role==='bot'?'DRONE':'RAIDER'} / ${p.name}`;
   video.autoplay=true;video.muted=true;video.playsInline=true;video.hidden=true;video.setAttribute('aria-label',`${p.name}'s live game view`);surface.width=640;surface.height=400;
   status.textContent=p.role==='bot'?'AI camera · simulated':'Connecting live video…';card.append(title,video,surface,status);card.className=p.role==='boss'?'view-card colossus-view':'view-card';card.tabIndex=0;card.title='Select to enlarge';const focus=()=>card.classList.toggle('expanded');card.onclick=focus;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus();}};this.grid.append(card);this.cards.set(p.id,{card,video,surface,status,role:p.role,received:0,frames:0});
  }
  for(const [id,c]of this.cards)if(!ids.has(id)){this.stream?.remove(id);c.card.remove();this.cards.delete(id);}
 }
 async receiveImage(data,stream){
  if(data.byteLength<16)return;const id=new DataView(data).getUint32(0,true),card=this.cards.get(id);
  try{
   if(!card||!this.visible)return;
   const bitmap=await createImageBitmap(new Blob([data.slice(12)],{type:'image/jpeg'}));
   if(this.stream===stream&&this.visible&&this.cards.get(id)===card){card.surface.getContext('2d').drawImage(bitmap,0,0);card.video.hidden=true;card.surface.hidden=false;card.transport='fallback';card.received=performance.now();card.frames++;}
   bitmap.close();
  }catch{/* A bad preview must not interrupt gameplay or stop subsequent frames. */}
  finally{stream.send({type:'frame-ack',id});}
 }
 // Extra view rendering occurs only while somebody has the debug panel connected.
 renderCamera(camera,aspect=1.6,reuseCityVisibility=false){
  const r=this.renderer,previous={target:r.getRenderTarget(),enabled:r.xr.enabled,viewport:r.getViewport(new T.Vector4()),scissor:r.getScissor(new T.Vector4()),test:r.getScissorTest(),shadows:r.shadowMap.autoUpdate,visibility:this.scene.userData.reuseCityVisibility};
  // The desktop framebuffer applies the same tone mapping as direct XR rendering.
  // Rendering to a normal texture target would bypass material tone mapping.
  const width=r.domElement.width,height=r.domElement.height,w=Math.min(width,640,height*aspect,400*aspect),h=w/aspect,vx=(width-w)/2,vy=(height-h)/2,dpr=r.getPixelRatio();
  try{this.scene.userData.reuseCityVisibility=reuseCityVisibility;r.xr.enabled=false;r.shadowMap.autoUpdate=false;r.setRenderTarget(null);r.setViewport(vx/dpr,vy/dpr,w/dpr,h/dpr);r.setScissor(vx/dpr,vy/dpr,w/dpr,h/dpr);r.setScissorTest(true);r.clear();r.render(this.scene,camera);
   this.context.fillStyle='#030c10';this.context.fillRect(0,0,640,400);const dw=Math.min(640,400*aspect),dh=dw/aspect;
   this.context.drawImage(r.domElement,vx,height-vy-h,w,h,(640-dw)/2,(400-dh)/2,dw,dh);
  }finally{this.scene.userData.reuseCityVisibility=previous.visibility;r.setRenderTarget(previous.target);r.setViewport(previous.viewport);r.setScissor(previous.scissor);r.setScissorTest(previous.test);r.shadowMap.autoUpdate=previous.shadows;r.xr.enabled=previous.enabled;}
 }
 captureXR(){const eye=this.renderer.xr.getCamera().cameras[0];if(!eye)return false;this.mirror.copy(eye,false);this.mirror.matrixAutoUpdate=false;this.mirror.matrixWorldAutoUpdate=false;this.renderCamera(this.mirror,eye.viewport?eye.viewport.z/eye.viewport.w:eye.projectionMatrix.elements[5]/eye.projectionMatrix.elements[0],true);return true;}
 update(now){
  if(this.role==='spectator'){
   if(!this.visible)return;
   const state=this.getState();
   if(!this.lastStatus||now-this.lastStatus>250){this.lastStatus=now;for(const [id,c]of this.cards){const age=c.received?now-c.received:Infinity,p=state?.players.find(p=>p.id===id);c.status.textContent=c.role==='bot'?`AI camera · simulated · ${Math.round(p?.hp||0)} HP`:age>3000?'Connecting live view…':`${c.mode||'Game view'} · ${c.paused?'PAUSED':c.tracking===false&&c.mode==='Headset left eye'?'TRACKING LOST':'LIVE'} · ${c.transport==='video'?`${c.fps?Math.round(c.fps)+' fps':'VIDEO'}${c.latency!==undefined?' · ~'+Math.round(c.latency)+' ms':''}`:'NETWORK FALLBACK · reduced frame rate'}${p?' · '+Math.round(p.hp)+' HP':''}`;}}
   // Bots have no browser to stream. Render directly into their display canvas,
   // without JPEG encoding, one per frame and at most ten updates/s per bot.
   const bots=state?.players.filter(p=>p.flags&8)||[];
   if(bots.length){const p=bots[this.botCursor++%bots.length],card=this.cards.get(p.id),pilot=this.players.get(p.id);if(card&&now-card.received>=100){
    const camera=this.botCamera??=new T.PerspectiveCamera(65,1.6,.05,650);camera.position.set(p.p[0],p.p[1]+.67,p.p[2]);camera.rotation.set(p.pitch||0,p.yaw,0,'YXZ');const visible=pilot?.root.visible;if(pilot)pilot.root.visible=false;
    try{this.renderCamera(camera);card.surface.getContext('2d').drawImage(this.canvas,0,0);card.received=now;card.frames++;}finally{if(pilot)pilot.root.visible=visible;}
   }}
   return;
  }
  const stream=this.stream,headset=this.renderer.xr.isPresenting,interval=1000/(headset?24:30);
  if(!this.active||!stream||now-this.lastFrame<interval-.5)return;
  this.lastFrame+=Math.max(1,Math.floor((now-this.lastFrame+.5)/interval))*interval;
  try{
   if(headset){if(!this.captureXR())return;}
   else{const source=this.renderer.domElement,aspect=source.width/source.height,w=Math.min(640,400*aspect),h=w/aspect,x=(640-w)/2,y=(400-h)/2;this.context.fillStyle='#030c10';this.context.fillRect(0,0,640,400);this.context.drawImage(source,x,y,w,h);this.context.drawImage(document.getElementById('flight-effects'),x,y,w,h);this.drawHUD();}
   const info=JSON.stringify({type:'view-info',mode:headset?'Headset left eye':this.getMode(),paused:this.getPaused(),tracking:this.getTracking()});
   if(info!==this.lastInfo||now-(this.lastInfoAt||0)>1000){stream.send(JSON.parse(info));this.lastInfo=info;this.lastInfoAt=now;}
   stream.publish();if(now-(this.lastImage||0)>=1000/15){this.lastImage=now;stream.image();}
  }catch(error){console.warn('View capture unavailable',error);}
 }
 drawHUD(){
  const state=this.getState();if(!state)return;const p=state.players.find(p=>p.id===this.getPlayerId()),ctx=this.context;
  ctx.fillStyle='#07191bcc';ctx.fillRect(0,369,640,31);ctx.fillStyle='#d3ff9d';ctx.font='12px monospace';ctx.fillText(p?`${Math.round(p.hp)} HP · ${Math.round(p.fuel*100)}% THRUST · ${p.flags&16?'SOARING':'HOVER'} · ${Math.round(Math.hypot(...p.v))} m/s`:`COLOSSUS · ${Math.ceil(bossHealthFraction(state)*100)}% CORE`,14,389);
  if(p){ctx.strokeStyle='#d8ffb9';ctx.beginPath();ctx.moveTo(315,200);ctx.lineTo(325,200);ctx.moveTo(320,195);ctx.lineTo(320,205);ctx.stroke();}
  if(this.getPaused()){ctx.fillStyle='#07191b99';ctx.fillRect(0,0,640,45);ctx.fillStyle='white';ctx.fillText('PLAYER MENU OPEN',225,27);}
 }
}
