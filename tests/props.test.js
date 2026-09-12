import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {carPlacements,staticProps,roofProp,roofColliders} from '../shared/props.js';
import {C,group} from '../shared/config.js';
import {v,rotateYaw,add,vec} from '../shared/math.js';
await physicsReady;
const ws={send(){},readyState:1},G=C.COLLISION;
const hit=(r,origin,direction,distance=20)=>r.world.castRay(new RAPIER.Ray(origin,direction),distance,true,undefined,group(G.PLAYER,G.WORLD|G.DEBRIS));
test('cars and lamps retain world collision after building name signs are removed',()=>{
 const r=new Room('ABC123');try{const car=carPlacements(r.env)[0],box=car.boxes[0],origin=add(vec(car.position),rotateYaw(v(0,box[1],box[5]+3),car.yaw)),direction=rotateYaw(v(0,0,-1),car.yaw);r.world.step();const contact=hit(r,origin,direction,5);assert.ok(contact);assert.equal(r.colliderTags.get(contact.collider.handle)?.prop,car.id);
 const c=r.attach(ws,'raider','pilot'),p=r.players.get(c.id);r.attach(ws,'boss','boss');r.spawn(p,origin);for(let i=0;i<70;i++){r.input(c,{type:'input',z:-1,yaw:car.yaw,pitch:0});r.step();}const chassis=[...r.cars.values()].find(c=>c.prop===car.id).body,at=chassis.translation(),q=chassis.rotation(),yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x)),local=rotateYaw(v(p.body.translation().x-at.x,0,p.body.translation().z-at.z),-yaw);assert.ok(local.z>box[5],'The capsule must stop at the current car surface even if it nudges the car');
 const prop=r.props.find(p=>p.kind==='lamp'),a=prop.boxes[0],start=add(vec(prop.position),v(0,0,a[5]+.25)),h=hit(r,start,v(0,0,-1),.5);assert.equal(r.colliderTags.get(h?.collider.handle)?.prop,prop.id);
 assert.ok(r.props.every(p=>p.kind!=='sign'));
 }finally{r.dispose();}
});
test('roof antenna hitboxes stay on their bay after collapse and reset',()=>{
 const r=new Room('ABC123');try{const c=r.cells.find(c=>roofProp(c)?.asset.includes('satelliteDish')),a=roofColliders(c)[0],rayFor=()=>hit(r,add(vec(c.p),v(a[0],a[1]+a[4]+1,a[2])),v(0,-1,0),3);r.world.step();assert.equal(r.colliderTags.get(rayFor()?.collider.handle)?.cell,c.id);
 r.breakCells([c.id]);const e=r.debris.get(c.entity);e.body.setTranslation(v(0,40,65),true);e.body.setRotation({x:0,y:0,z:0,w:1},true);r.world.step();const origin=add(e.body.translation(),v(0,a[1]+a[4]+1,0)),h=hit(r,origin,v(0,-1,0),3);assert.equal(r.colliderTags.get(h?.collider.handle)?.cell,c.id);assert.equal(e.body.numColliders(),1+roofColliders(c).length,'One coarse debris bay plus the actual roof equipment');
 r.initWorld();r.world.step();const restored=r.cells.find(x=>x.id===c.id);assert.equal(roofColliders(restored).length,1);assert.equal(r.colliderTags.get(rayFor()?.collider.handle)?.cell,c.id);
 }finally{r.dispose();}
});
test('laser hitting a car reports a surface impact without damaging the giant',()=>{
 const r=new Room('ABC123');try{const car=carPlacements(r.env)[0],a=car.boxes[0],origin=add(vec(car.position),rotateYaw(v(0,a[1]-.5,a[5]+3),car.yaw)),c=r.attach(ws,'raider','pilot'),p=r.players.get(c.id);r.spawn(p,origin);r.world.step();p.input.yaw=car.yaw;p.input.pitch=0;r.shoot(p);const shot=r.drainEvents().find(e=>e.type==='shot');assert.equal(shot.hit,false);assert.equal(shot.impact,true);assert.ok(Math.hypot(...shot.normal)>.99);assert.equal(r.bossHP,C.BOSS_HP);
 }finally{r.dispose();}
});
