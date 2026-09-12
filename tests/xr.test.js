// Focused lifecycle/input regressions using real Three math and fake XR frames.
// Real rendering and the Quest 2 API profile are covered by test:browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {XRControl} from '../src/xr.js';

function fixture({bindingError=false}={}){
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 globalThis.window={isSecureContext:true};
 const session=new EventTarget(),ref=new EventTarget(),messages=[];
 Object.assign(session,{visibilityState:'visible',inputSources:[],supportedFrameRates:new Float32Array([72,90]),frameRate:90,async updateTargetFrameRate(hz){this.frameRate=hz;},async end(){this.dispatchEvent(new Event('end'));}});
 let requests=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{xr:{async isSessionSupported(){return true;},async requestSession(mode,options){requests++;assert.equal(mode,'immersive-vr');assert.deepEqual(options.requiredFeatures,['local-floor']);return session;}}}});
 const manager={enabled:false,setReferenceSpaceType(){},setFramebufferScaleFactor(){},setFoveation(){},getReferenceSpace(){return ref;},async setSession(){if(bindingError)throw Error('Binding failed');}};
 const renderer={xr:manager,shadowMap:{enabled:true}},camera=new T.PerspectiveCamera(65,1.5,.05,650),rig=new T.Group();rig.add(camera);camera.position.set(1,2,3);
 const net={role:'boss',latest:{bossX:0,bossZ:0},send:m=>{messages.push(m);return true;}};
 let enters=0,exits=0;
 const xr=new XRControl(renderer,camera,rig,net,{onEnter(){enters++;},onExit(){exits++;}});
 let height=1.7;
 const frame={getViewerPose:()=>({transform:{position:{x:0,y:height,z:0},orientation:{x:0,y:0,z:0,w:1}}}),getPose:space=>({transform:{position:space}})};
 function controller(side){const src={handedness:side,gripSpace:{x:side==='left'?-.4:.4,y:1.2,z:-.3},gamepad:{axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}};session.inputSources.push(src);return src;}
 return {xr,session,ref,renderer,camera,rig,net,messages,frame,controller,setHeight:h=>height=h,get requests(){return requests;},get enters(){return enters;},get exits(){return exits;}};
}
test('VR rejects an insecure origin and the wrong player role before requesting a session',async()=>{
 const f=fixture();window.isSecureContext=false;assert.equal(await f.xr.supported(),false);await assert.rejects(f.xr.enter(),/HTTPS/);window.isSecureContext=true;f.net.role='raider';await assert.rejects(f.xr.enter(),/colossus/);assert.equal(f.requests,0);
});
test('session setup failure restores the desktop camera, rig and rendering settings',async()=>{
 const f=fixture({bindingError:true});await assert.rejects(f.xr.enter(),/Binding failed/);
 assert.equal(f.xr.session,null);assert.equal(f.xr.entering,false);assert.equal(f.xr.hud.visible,false);assert.deepEqual(f.rig.scale.toArray(),[1,1,1]);assert.deepEqual(f.camera.position.toArray(),[1,2,3]);assert.equal(f.renderer.shadowMap.enabled,true);assert.equal(f.enters,0);
});
test('duplicate entry is ignored; exit restores projection and allows a fresh session',async()=>{
 const f=fixture();await Promise.all([f.xr.enter(),f.xr.enter()]);assert.equal(f.requests,1);assert.equal(f.session.frameRate,72);assert.equal(f.renderer.shadowMap.enabled,false);
 f.camera.fov=90;await f.session.end();assert.equal(f.camera.fov,65);assert.equal(f.xr.session,null);assert.equal(f.exits,1);assert.equal(f.renderer.shadowMap.enabled,true);
 await f.xr.enter();assert.equal(f.requests,2);await f.session.end();
});
test('unsupported frame-rate requests do not prevent immersive entry',async()=>{
 const f=fixture();f.session.updateTargetFrameRate=async()=>{throw Error('Unsupported');};await f.xr.enter();assert.equal(f.enters,1);await f.session.end();
});
test('Touch smooth turning is continuous, proportional and stops inside the deadzone',async()=>{
 const f=fixture(),left=f.controller('left'),right=f.controller('right');await f.xr.enter();left.gamepad.axes[3]=-1;f.xr.update(f.frame,{},1000);
 const first=f.messages.at(-1);assert.equal(first.reset,true);assert.equal(first.moveZ,-1);assert.ok(Math.abs(first.head[1]-23.8)<.001);
 right.gamepad.axes[2]=1;f.xr.update(f.frame,{},1050);const a=f.xr.turn;assert.ok(Math.abs(a+Math.PI/40)<1e-6);assert.equal(f.messages.at(-1).reset,false);
 f.xr.update(f.frame,{},1100);assert.ok(Math.abs(f.xr.turn-2*a)<1e-6);
 right.gamepad.axes[2]=.59;f.xr.update(f.frame,{},1150);assert.ok(Math.abs(f.xr.turn-2.5*a)<1e-6);
 right.gamepad.axes[2]=.1;f.xr.update(f.frame,{},1200);assert.ok(Math.abs(f.xr.turn-2.5*a)<1e-6);
 f.setHeight(1.4);right.gamepad.buttons[4].pressed=true;f.xr.update(f.frame,{},1250);assert.equal(f.messages.at(-1).reset,true);assert.ok(Math.abs(f.messages.at(-1).head[1]-23.8)<.001);await f.session.end();
});
test('half a metre of tracked hand travel produces seven city metres without input lag',async()=>{
 const f=fixture(),left=f.controller('left');f.controller('right');await f.xr.enter();const a=f.xr.update(f.frame,{},1000).left;left.gripSpace.x-=.5;const b=f.xr.update(f.frame,{},1050).left;assert.ok(Math.abs(b[0]-a[0]+7)<1e-6);assert.deepEqual(f.messages.at(-1).left,b);
 f.xr.setSettings({reachGain:1.5});const c=f.xr.update(f.frame,{},1100).left;left.gripSpace.x-=.5;const d=f.xr.update(f.frame,{},1150).left;assert.ok(Math.abs(d[0]-c[0]+10.5)<1e-6);await f.session.end();
});
test('turning pivots around the tracked head and controller triggers carry aim',async()=>{
 const f=fixture();f.controller('left');const right=f.controller('right');await f.xr.enter();f.frame.getViewerPose=()=>({transform:{position:{x:.3,y:1.7,z:.2},orientation:{x:0,y:0,z:0,w:1}}});
 const before=f.xr.update(f.frame,{},1000).head;right.gamepad.axes[2]=1;right.gamepad.buttons[0].pressed=true;
 for(let i=1;i<=20;i++)f.xr.update(f.frame,{},1000+i*50);
 f.xr.local.head.forEach((n,i)=>assert.ok(Math.abs(n-before[i])<1e-5));assert.equal(f.messages.at(-1).fireRight,true);assert.ok(Math.abs(Math.hypot(...f.messages.at(-1).rightAim)-1)<1e-6);await f.session.end();
});
test('tracking loss and suspended sessions stop input; recovery and recenter rebase the pose',async()=>{
 const f=fixture();f.controller('left');const right=f.controller('right');await f.xr.enter();f.xr.update(f.frame,{},1000);
 f.session.inputSources.pop();f.xr.update(f.frame,{},1100);assert.deepEqual(f.messages.at(-1),{type:'pose',tracking:false});const count=f.messages.length;f.xr.update(f.frame,{},1200);assert.equal(f.messages.length,count);
 f.session.inputSources.push(right);f.xr.update(f.frame,{},1300);assert.equal(f.messages.at(-1).reset,true);
 f.session.visibilityState='visible-blurred';f.session.dispatchEvent(new Event('visibilitychange'));assert.equal(f.messages.at(-1).tracking,false);f.xr.update(f.frame,{},1400);assert.equal(f.messages.at(-1).tracking,false);
 f.session.visibilityState='visible';f.xr.update(f.frame,{},1500);assert.equal(f.messages.at(-1).reset,true);f.ref.dispatchEvent(new Event('reset'));f.xr.update(f.frame,{},1600);assert.equal(f.messages.at(-1).reset,true);await f.session.end();
});
test('untracked head and target rays without tracked controller grips cannot attack',async()=>{
 const f=fixture();f.controller('left');const right=f.controller('right');right.targetRaySpace=right.gripSpace;delete right.gripSpace;await f.xr.enter();f.xr.update(f.frame,{},1000);assert.equal(f.messages.at(-1).tracking,false);
 f.frame.getViewerPose=()=>null;assert.equal(f.xr.update(f.frame,{},1100),null);await f.session.end();
});
test('a congested connection cannot discard the pending pose reset',async()=>{
 const f=fixture();f.controller('left');f.controller('right');await f.xr.enter();const send=f.net.send;f.net.send=()=>false;f.xr.update(f.frame,{},1000);assert.equal(f.xr.poseReset,true);
 f.net.send=send;f.xr.update(f.frame,{},1100);assert.equal(f.messages.at(-1).reset,true);assert.equal(f.xr.poseReset,false);await f.session.end();
});
