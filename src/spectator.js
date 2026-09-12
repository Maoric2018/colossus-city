import * as T from 'three';
// Feed pixels come from each player's renderer. XR is rendered with the actual
// left-eye matrices; it is not reconstructed from delayed multiplayer snapshots.
export class SpectatorViews{
 constructor(renderer,scene,camera,{getState,getRole,getPlayerId,getMode,getPaused,getTracking,players,giant,xr}={}){
  Object.assign(this,{renderer,scene,camera,getState,getRole,getPlayerId,getMode,getPaused,getTracking,players,giant,xr});
  this.canvas=document.createElement('canvas');this.canvas.width=640;this.canvas.height=400;this.context=this.canvas.getContext('2d');
  this.mirror=new T.PerspectiveCamera();
  this.panel=document.getElementById('spectator-panel');this.grid=document.getElementById('spectator-grid');this.cards=new Map();this.roster=[];this.lastFrame=0;this.botCursor=0;this.active=false;
 }
 connect(welcome){
  if(this.key===welcome.viewKey&&this.socket?.readyState<=1)return;this.disconnect();this.key=welcome.viewKey;this.role=welcome.role;this.roster=welcome.roster||[];this.updateRoster(this.roster);
  const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/views`);socket.binaryType='arraybuffer';this.socket=socket;
  socket.onopen=()=>socket.send(JSON.stringify({room:welcome.room,id:welcome.id,key:welcome.viewKey,watch:this.visible===true}));
  socket.onmessage=({data})=>{
   if(typeof data==='string'){const m=JSON.parse(data);if(m.type==='capture')this.active=m.active;if(m.type==='view-info'){const card=this.cards.get(m.id);if(card){card.mode=m.mode;card.paused=m.paused;card.tracking=m.tracking;}}return;}
   const header=new DataView(data),id=header.getUint32(0,true),card=this.cards.get(id);if(!card)return;
   const url=URL.createObjectURL(new Blob([data.slice(12)],{type:'image/jpeg'}));const old=card.url;card.url=url;card.image.src=url;if(old)URL.revokeObjectURL(old);card.received=performance.now();card.frames=(card.frames||0)+1;
  };
  socket.onclose=()=>{if(this.socket===socket){this.active=false;for(const card of this.cards.values())card.received=0;setTimeout(()=>{if(this.socket===socket&&this.key===welcome.viewKey){this.key=null;this.connect(welcome);}},2000);}};
 }
 disconnect(){this.key=null;this.socket?.close();this.socket=null;this.active=false;this.busy=false;for(const c of this.cards.values())if(c.url)URL.revokeObjectURL(c.url);this.cards.clear();this.grid.replaceChildren();}
 setVisible(visible){this.visible=visible;if(this.role==='spectator'&&this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'watch',active:visible}));this.panel.classList.toggle('hidden',!visible);document.body.classList.toggle('spectator-open',visible);}
 updateRoster(roster){
  this.roster=roster;const ids=new Set();for(const p of roster){if(p.role==='spectator')continue;ids.add(p.id);if(this.cards.has(p.id))continue;
   const card=document.createElement('article'),title=document.createElement('header'),image=document.createElement('img'),status=document.createElement('p');title.textContent=`${p.role==='boss'?'COLOSSUS':p.role==='bot'?'DRONE':'RAIDER'} / ${p.name}`;image.alt=`${p.name}'s game view`;status.textContent=p.role==='bot'?'AI camera · simulated':'Waiting for player view…';card.append(title,image,status);card.className=p.role==='boss'?'view-card colossus-view':'view-card';card.tabIndex=0;card.title='Select to enlarge';const focus=()=>card.classList.toggle('expanded');card.onclick=focus;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')focus();};this.grid.append(card);this.cards.set(p.id,{card,image,status,role:p.role,received:0,frames:0});
  }
  for(const [id,c]of this.cards)if(!ids.has(id)){if(c.url)URL.revokeObjectURL(c.url);c.card.remove();this.cards.delete(id);}
 }
 // Extra view rendering occurs only while somebody has the debug panel connected.
 renderCamera(camera,aspect=1.6){
  const r=this.renderer,previous={target:r.getRenderTarget(),enabled:r.xr.enabled,viewport:r.getViewport(new T.Vector4()),scissor:r.getScissor(new T.Vector4()),test:r.getScissorTest(),shadows:r.shadowMap.autoUpdate};
  // The desktop framebuffer applies the same tone mapping as direct XR rendering.
  // Rendering to a normal texture target would bypass material tone mapping.
  const width=r.domElement.width,height=r.domElement.height,w=Math.min(width,640,height*aspect,400*aspect),h=w/aspect,vx=(width-w)/2,vy=(height-h)/2,dpr=r.getPixelRatio();
  try{r.xr.enabled=false;r.shadowMap.autoUpdate=false;r.setRenderTarget(null);r.setViewport(vx/dpr,vy/dpr,w/dpr,h/dpr);r.setScissorTest(false);r.clear();r.render(this.scene,camera);
   this.context.fillStyle='#030c10';this.context.fillRect(0,0,640,400);const dw=Math.min(640,400*aspect),dh=dw/aspect;
   this.context.drawImage(r.domElement,vx,height-vy-h,w,h,(640-dw)/2,(400-dh)/2,dw,dh);
  }finally{r.setRenderTarget(previous.target);r.setViewport(previous.viewport);r.setScissor(previous.scissor);r.setScissorTest(previous.test);r.shadowMap.autoUpdate=previous.shadows;r.xr.enabled=previous.enabled;}
 }
 captureXR(){const eye=this.renderer.xr.getCamera().cameras[0];if(!eye)return false;this.mirror.copy(eye,false);this.mirror.matrixAutoUpdate=false;this.mirror.matrixWorldAutoUpdate=false;this.renderCamera(this.mirror,eye.viewport?eye.viewport.z/eye.viewport.w:eye.projectionMatrix.elements[5]/eye.projectionMatrix.elements[0]);return true;}
 update(now){
  if(this.role==='spectator'){
   if(!this.visible)return;
   const state=this.getState();for(const [id,c]of this.cards){const age=c.received?(now-c.received)/1000:Infinity,p=state?.players.find(p=>p.id===id);c.status.textContent=c.role==='bot'?`AI camera · simulated · ${Math.round(p?.hp||0)} HP`:age>3?'Waiting for live view…':`${c.mode||'Game view'} · ${c.paused?'PAUSED':c.tracking===false&&c.mode==='Headset left eye'?'TRACKING LOST':'LIVE'} · ${(age*1000).toFixed(0)} ms since frame${p?' · '+Math.round(p.hp)+' HP':''}`;}
   if(now-this.lastFrame>300&&state){this.lastFrame=now;const bots=state.players.filter(p=>p.flags&8);if(bots.length){const p=bots[this.botCursor++%bots.length],card=this.cards.get(p.id),pilot=this.players.get(p.id);if(card){const camera=new T.PerspectiveCamera(65,1.6,.05,650);camera.position.set(p.p[0],p.p[1]+.67,p.p[2]);camera.rotation.set(p.pitch||0,p.yaw,0,'YXZ');const visible=pilot?.root.visible;if(pilot)pilot.root.visible=false;try{this.renderCamera(camera);card.image.src=this.canvas.toDataURL('image/jpeg',.6);}finally{if(pilot)pilot.root.visible=visible;}}}}
   return;
  }
  if(!this.active||this.busy||now-this.lastFrame<166||this.socket?.readyState!==1||this.socket.bufferedAmount>96*1024)return;
  this.lastFrame=now;const socket=this.socket;this.busy=true;
  try{
   const headset=this.renderer.xr.isPresenting;if(headset){if(!this.captureXR()){this.busy=false;return;}}
   else{const source=this.renderer.domElement,aspect=source.width/source.height,w=Math.min(640,400*aspect),h=w/aspect,x=(640-w)/2,y=(400-h)/2;this.context.fillStyle='#030c10';this.context.fillRect(0,0,640,400);this.context.drawImage(source,x,y,w,h);this.context.drawImage(document.getElementById('flight-effects'),x,y,w,h);this.drawHUD();}
   socket.send(JSON.stringify({type:'view-info',mode:headset?'Headset left eye':this.getMode(),paused:this.getPaused(),tracking:this.getTracking()}));
   this.canvas.toBlob(blob=>{this.busy=false;if(blob&&blob.size<96*1024&&this.socket===socket&&socket.readyState===1&&socket.bufferedAmount<96*1024)socket.send(blob);},'image/jpeg',.62);
  }catch(error){this.busy=false;console.warn('View capture unavailable',error);this.active=false;}
 }
 drawHUD(){
  const state=this.getState();if(!state)return;const p=state.players.find(p=>p.id===this.getPlayerId()),ctx=this.context;
  ctx.fillStyle='#07191bcc';ctx.fillRect(0,369,640,31);ctx.fillStyle='#d3ff9d';ctx.font='12px monospace';ctx.fillText(p?`${Math.round(p.hp)} HP · ${Math.round(p.fuel*100)}% THRUST · ${p.flags&16?'SOARING':'HOVER'} · ${Math.round(Math.hypot(...p.v))} m/s`:`COLOSSUS · ${Math.round(state.bossHP/26)}% CORE`,14,389);
  if(p){ctx.strokeStyle='#d8ffb9';ctx.beginPath();ctx.moveTo(315,200);ctx.lineTo(325,200);ctx.moveTo(320,195);ctx.lineTo(320,205);ctx.stroke();}
  if(this.getPaused()){ctx.fillStyle='#07191b99';ctx.fillRect(0,0,640,45);ctx.fillStyle='white';ctx.fillText('PLAYER MENU OPEN',225,27);}
 }
}
