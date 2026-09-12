import * as T from 'three';
import {C} from '../shared/config.js';
import {clamp} from '../shared/math.js';
const axis=new T.Vector3(0,1,0),q=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
export class XRControl{
 constructor(renderer,camera,rig,connection,{onEnter,onExit}={}){
  this.renderer=renderer;this.camera=camera;this.rig=rig;this.net=connection;this.onEnter=onEnter;this.onExit=onExit;this.local=null;this.lastSend=0;this.lastUpdate=null;this.pendingTurn=0;this.scale=C.GIANT_SCALE;this.turn=0;this.turnSpeed=C.TURN_SPEED;this.reachGain=1;this.originOffset=new T.Vector3();this.session=null;this.hudTime=0;
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
  // Set resolution BEFORE session creation. No effects composer is used in XR.
  renderer.xr.setFramebufferScaleFactor(.85);renderer.xr.setFoveation(1);
  this.hudCanvas=document.createElement('canvas');this.hudCanvas.width=1024;this.hudCanvas.height=256;
  this.hudTexture=new T.CanvasTexture(this.hudCanvas);this.hudTexture.colorSpace=T.SRGBColorSpace;
  this.hud=new T.Mesh(new T.PlaneGeometry(.64,.16),new T.MeshBasicMaterial({map:this.hudTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));this.hud.position.set(0,-.28,-.87);this.hud.renderOrder=999;this.hud.visible=false;camera.add(this.hud);
 }
 async supported(){try{return !!(window.isSecureContext&&navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr'));}catch{return false;}}
 setSettings({turnDegrees=90,reachGain=1}={}){this.turnSpeed=clamp(Number(turnDegrees)||90,30,180)*Math.PI/180;const gain=clamp(Number(reachGain)||1,.5,1.5);if(gain!==this.reachGain)this.resetPose();this.reachGain=gain;}
 resetPose(){this.poseReset=true;}
 stopTracking(){
  this.resetPose();this.lastUpdate=null;this.pendingTurn=0;this.calibrateLatch=false;
  if(!this.trackingStopped)this.trackingStopped=this.net.send({type:'pose',tracking:false})===true;
 }
 async enter(){
  if(this.entering||this.session)return;
  if(this.net.role!=='boss')throw Error('Only the colossus seat can enter VR.');
  if(!window.isSecureContext)throw Error('WebXR requires HTTPS on the headset. Use the deployed HTTPS URL.');
  if(!navigator.xr)throw Error('Open this game in Meta Quest Browser.');
  this.entering=true;let session,entered=false,cleaned=false,ref;
  const reset=()=>this.resetPose(),visibility=()=>{if(session.visibilityState!=='visible')this.stopTracking();else this.resetPose();};
  const cleanup=()=>{
   if(cleaned)return;cleaned=true;ref?.removeEventListener('reset',reset);session?.removeEventListener('visibilitychange',visibility);
   this.stopTracking();this.session=null;this.local=null;this.hud.visible=false;
   if(this.saved){const s=this.saved;this.rig.scale.copy(s.scale);this.rig.position.copy(s.rigPos);this.rig.quaternion.copy(s.rigQuat);this.camera.position.copy(s.pos);this.camera.quaternion.copy(s.quat);this.camera.scale.copy(s.cameraScale);this.camera.fov=s.fov;this.camera.zoom=s.zoom;this.camera.updateProjectionMatrix();this.renderer.shadowMap.enabled=s.shadows;this.saved=null;}
   if(entered)this.onExit?.();
  };
  try{
   session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor']});
   this.session=session;this.saved={pos:this.camera.position.clone(),quat:this.camera.quaternion.clone(),cameraScale:this.camera.scale.clone(),scale:this.rig.scale.clone(),rigPos:this.rig.position.clone(),rigQuat:this.rig.quaternion.clone(),fov:this.camera.fov,zoom:this.camera.zoom,shadows:this.renderer.shadowMap.enabled};
   this.turn=0;this.originOffset.set(0,0,0);this.lastSend=0;this.lastUpdate=null;this.pendingTurn=0;this.calibrateLatch=false;this.trackingStopped=false;this.resetPose();this.fps=0;this.frames=0;this.fpsStart=performance.now();
   this.rig.scale.setScalar(this.scale);this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);this.renderer.shadowMap.enabled=false;
   this.renderer.xr.setReferenceSpaceType('local-floor');
   // setSession installs Three's end listener synchronously; cleanup follows it.
   const binding=this.renderer.xr.setSession(session);session.addEventListener('end',cleanup,{once:true});await binding;
   if(cleaned)return;
   this.renderer.xr.setFoveation(1);ref=this.renderer.xr.getReferenceSpace();ref?.addEventListener('reset',reset);session.addEventListener('visibilitychange',visibility);
  // Feature-detected: unsupported frame-rate requests must not prevent entering VR.
  if(session.supportedFrameRates?.includes(72)&&session.updateTargetFrameRate){try{await session.updateTargetFrameRate(72);}catch{}}
   if(!cleaned){entered=true;this.hud.visible=true;this.onEnter?.();}
  }catch(error){if(session)try{await session.end();}catch{}cleanup();throw error;}
  finally{this.entering=false;}
 }
 update(frame,snapshot,now){
  if(!frame||!this.session)return null;
  if(this.session.visibilityState&&this.session.visibilityState!=='visible'){this.stopTracking();return null;}
  const ref=this.renderer.xr.getReferenceSpace(),viewer=ref&&frame.getViewerPose(ref);if(!viewer){this.stopTracking();return null;}
  this.frames++;if(now-this.fpsStart>=1000){this.fps=Math.round(this.frames*1000/(now-this.fpsStart));this.frames=0;this.fpsStart=now;}
  const dt=this.lastUpdate===null?0:Math.min(.05,Math.max(0,(now-this.lastUpdate)/1000));this.lastUpdate=now;
  const latest=this.net.latest||snapshot;
  this.rig.position.set(latest?.bossX||0,0,latest?.bossZ||0).add(this.originOffset);this.rig.rotation.y=this.turn;this.rig.updateMatrixWorld(true);
  const sources=[...this.session.inputSources],poses={},aims={},handQuaternions={},triggers={};let mx=0,mz=0,turnInput=0;
  for(const src of sources){
   const pose=src.gripSpace&&frame.getPose(src.gripSpace,ref);if(pose&&src.gamepad&&['left','right'].includes(src.handedness)){poses[src.handedness]=pose.transform.position;const ray=src.targetRaySpace&&frame.getPose(src.targetRaySpace,ref);aims[src.handedness]=(ray||pose).transform.orientation||viewer.transform.orientation;handQuaternions[src.handedness]=pose.transform.orientation||viewer.transform.orientation;triggers[src.handedness]=!!src.gamepad.buttons[0]?.pressed;}
   const gp=src.gamepad;if(!gp)continue;const a=gp.axes,n=a.length;
   if(src.handedness==='left'){mx=a[n>=4?2:0]||0;mz=a[n>=4?3:1]||0;}
   if(src.handedness==='right'){
    turnInput=a[n>=4?2:0]||0;
    // A recalibrates standing height; it does not request a camera or passthrough API.
    if(gp.buttons[4]?.pressed&&!this.calibrateLatch){this.scale=clamp(23.8/Math.max(.8,viewer.transform.position.y),10,22);this.rig.scale.setScalar(this.scale);this.calibrateLatch=true;this.resetPose();}
    if(!gp.buttons[4]?.pressed)this.calibrateLatch=false;
   }
  }
  if(poses.left&&poses.right&&Math.abs(turnInput)>.18){
   const before=new T.Vector3(viewer.transform.position.x,viewer.transform.position.y,viewer.transform.position.z).applyMatrix4(this.rig.matrixWorld);
   const change=-Math.sign(turnInput)*(Math.abs(turnInput)-.18)/.82*this.turnSpeed*dt;this.turn=Math.atan2(Math.sin(this.turn+change),Math.cos(this.turn+change));this.pendingTurn+=change;
   this.rig.rotation.y=this.turn;this.rig.updateMatrixWorld(true);
   const after=new T.Vector3(viewer.transform.position.x,viewer.transform.position.y,viewer.transform.position.z).applyMatrix4(this.rig.matrixWorld);
   this.originOffset.add(before.sub(after));this.rig.position.set(latest?.bossX||0,0,latest?.bossZ||0).add(this.originOffset);
  }
  this.rig.rotation.y=this.turn;this.rig.updateMatrixWorld(true);
  const world=p=>new T.Vector3(p.x,p.y,p.z).applyMatrix4(this.rig.matrixWorld).toArray();
  const head=world(viewer.transform.position),turnQ=new T.Quaternion().setFromAxisAngle(axis,this.turn);
  const hand=p=>{const point=new T.Vector3(...world(p));return point.sub(new T.Vector3(...head)).multiplyScalar(this.reachGain).add(new T.Vector3(...head)).toArray();};
  const aim=side=>{const r=aims[side];return r?new T.Vector3(0,0,-1).applyQuaternion(new T.Quaternion(r.x,r.y,r.z,r.w).premultiply(turnQ)).toArray():[0,0,-1];};
  const handQ=side=>{const r=handQuaternions[side];return r?new T.Quaternion(r.x,r.y,r.z,r.w).premultiply(turnQ).toArray():turnQ.toArray();};
  const rot=viewer.transform.orientation;q.set(rot.x,rot.y,rot.z,rot.w);q.premultiply(new T.Quaternion().setFromAxisAngle(axis,this.turn));euler.setFromQuaternion(q,'YXZ');
  const local={...(snapshot||{}),head,bossYaw:euler.y,bossX:this.rig.position.x,bossZ:this.rig.position.z,left:poses.left?hand(poses.left):(this.local?.left||[head[0]-5,head[1]-7,head[2]-4]),right:poses.right?hand(poses.right):(this.local?.right||[head[0]+5,head[1]-7,head[2]-4])};local.leftQuaternion=handQ('left');local.rightQuaternion=handQ('right');local.resetHands=this.poseReset;this.local=local;
  if(!poses.left||!poses.right)this.stopTracking();
  else if(now-this.lastSend>1000/C.INPUT_HZ){
   if(this.net.send({type:'pose',head:local.head,left:local.left,right:local.right,yaw:local.bossYaw,leftQuaternion:local.leftQuaternion,rightQuaternion:local.rightQuaternion,leftAim:aim('left'),rightAim:aim('right'),fireLeft:triggers.left,fireRight:triggers.right,turnDelta:this.pendingTurn,moveX:Math.abs(mx)>.15?mx:0,moveZ:Math.abs(mz)>.15?mz:0,reset:this.poseReset===true})){this.lastSend=now;this.pendingTurn=0;this.poseReset=false;this.trackingStopped=false;}
  }
  if(now-this.hudTime>120){this.paintHUD(latest,!!poses.left&&!!poses.right);this.hudTime=now;}return local;
 }
 paintHUD(s,tracking){
  const x=this.hudCanvas.getContext('2d');x.clearRect(0,0,1024,256);x.fillStyle='rgba(6,22,29,.85)';x.fillRect(0,0,1024,256);x.fillStyle='#cfff94';x.font='bold 38px Arial';x.fillText('COLOSSUS',35,53);x.fillStyle='#c5d7d8';x.font='24px monospace';x.fillText(`ROOM ${this.net.room||'------'}`,715,50);
  const hp=s?Math.max(0,s.bossHP/C.BOSS_HP):1;x.fillStyle='#31474b';x.fillRect(35,80,955,13);x.fillStyle='#cfff94';x.fillRect(35,80,955*hp,13);
  x.font='27px monospace';x.fillStyle='#e2eeee';const sec=Math.ceil(s?.remaining||0);x.fillText(`CORE ${Math.ceil(hp*100)}%    ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}    TAKEDOWNS ${s?.kills||0}`,35,144);
  x.font='20px monospace';x.fillStyle=tracking?'#99b7bd':'#ffbc80';x.fillText(!tracking?'CONTROLLER TRACKING LOST · HOLD STILL':s?.phase===1?'RAIDERS WIN · NEW ROUND IN 20 SECONDS':s?.phase===2?'COLOSSUS WINS · NEW ROUND IN 20 SECONDS':'LEFT: MOVE   RIGHT: SMOOTH TURN   TRIGGERS: MISSILES   A: CALIBRATE',35,204);
  x.font='18px monospace';x.fillText(`${this.fps||0} FPS · ${this.net.ping||0}ms · REACH ${(this.scale*this.reachGain).toFixed(1)}× · 0.5m → ${(this.scale*this.reachGain*.5).toFixed(1)}m`,35,238);this.hudTexture.needsUpdate=true;
 }
 haptic(power=.3){for(const s of this.session?.inputSources||[]){try{s.gamepad?.hapticActuators?.[0]?.pulse(power,55)?.catch?.(()=>{});}catch{}}}
}
