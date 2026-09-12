import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Room,physicsReady} from '../server/room.js';
import {raiderParts,raiderLinks} from '../shared/raider-rig.js';
import {raiderPose} from '../shared/raider-pose.js';
import {C} from '../shared/config.js';
import {v,arr} from '../shared/math.js';
await physicsReady;const ws={send(){},readyState:1};
const worldPoint=(body,p)=>new T.Vector3(...p).applyQuaternion(new T.Quaternion(...Object.values(body.rotation()))).add(new T.Vector3(...arr(body.translation())));
test('ragdoll metadata names the pilot bones and preserves a soaring knockdown pose',()=>{
 const r=new Room('RIG123');try{const c=r.attach(ws,'raider','pilot'),p=r.players.get(c.id);r.spawn(p,v(0,20,60));p.invulnerable=0;p.soaring=true;p.input.yaw=.7;p.input.pitch=.2;p.body.setLinvel(v(0,0,0),true);r.knockdown(p,v(2,5,0),120);const rag=r.rags.get(p.rag),meta=r.welcome(c).rags[0];
 assert.deepEqual(meta.parts.map(p=>p.name),raiderParts.map(p=>p.name));assert.equal(rag.parts.length,11);assert.equal(r.world.impulseJoints.len(),10);
 const q=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2+.2,.7,0,'YXZ'));
 const pose=raiderPose({soar:1,time:r.time,id:p.id});
 for(const [i,part]of meta.parts.entries()){const expected=new T.Vector3(...pose[i].p).applyQuaternion(q).add(new T.Vector3(0,20,60)),rotation=q.clone().multiply(new T.Quaternion(...pose[i].q));assert.ok(expected.distanceTo(new T.Vector3(...part.p))<.00001);assert.ok(rotation.angleTo(new T.Quaternion(...part.q))<.001);}
 for(let n=0;n<120;n++){r.world.step();for(const link of raiderLinks){const a=rag.parts[link.a],b=rag.parts[link.b];assert.ok(worldPoint(a.body,link.anchor.map((v,i)=>v-a.offset[i])).distanceTo(worldPoint(b.body,link.anchor.map((v,i)=>v-b.offset[i])))<.15,'Animated knockdown joints must stay attached');}}
 }finally{r.dispose();}
});
test('pilot ragdoll joints stay connected while the full body tumbles onto the ground',()=>{
 const r=new Room('RIG123');try{const c=r.attach(ws,'raider','pilot'),p=r.players.get(c.id);r.spawn(p,v(0,4,60));p.invulnerable=0;r.knockdown(p,v(4,3,0),120);const rag=r.rags.get(p.rag);let maxError=0;
 for(let n=0;n<180;n++){r.world.step();for(const link of raiderLinks){const a=rag.parts[link.a],b=rag.parts[link.b],aa=link.anchor.map((v,i)=>v-a.offset[i]),ab=link.anchor.map((v,i)=>v-b.offset[i]);maxError=Math.max(maxError,worldPoint(a.body,aa).distanceTo(worldPoint(b.body,ab)));}for(const part of rag.parts)assert.ok(arr(part.body.translation()).every(Number.isFinite));}
 assert.ok(maxError<.15,`Joint separation ${maxError} m`);assert.ok(rag.parts[0].body.translation().y<1.5);
 }finally{r.dispose();}
});
test('desktop and Quest giant movement outrun normal raider flight without a diagonal speed bonus',()=>{
 assert.equal(C.GIANT_SPEED,13);assert.ok(C.GIANT_SPEED>C.PLAYER_SPEED&&C.GIANT_SPEED<C.PLAYER_SPEED*1.25);
 for(const mode of ['desktop','quest'])for(const diagonal of [false,true]){const r=new Room('SPD123');try{const boss=r.attach(ws,'boss','giant');for(let i=0;i<60;i++){if(mode==='desktop')r.input(boss,{type:'input',x:diagonal?1:0,z:-1,yaw:0,pitch:0});else{const b=r.boss;r.input(boss,{type:'pose',head:[b.x,23.8,b.z],left:[b.x-5,16,b.z-4],right:[b.x+5,16,b.z-4],yaw:0,moveX:diagonal?1:0,moveZ:-1});}r.step();}assert.ok(Math.abs(Math.hypot(r.boss.x,r.boss.z)-13)<.001,mode);}finally{r.dispose();}}
});
