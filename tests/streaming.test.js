import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {generateBlock,blockCellBase,cellBlock,homeBlock,buildingFootprint,BUILDING_STYLES} from '../shared/city/layout.js';
import {generateCells} from '../shared/environment.js';
import {componentPlacements} from '../shared/city/components.js';
import {STYLE_BY_ID} from '../shared/city/catalog.js';
import {flightStep} from '../shared/flight.js';
import {noInput} from '../server/players.js';
import {v} from '../shared/math.js';
await physicsReady;
test('procedural addresses are deterministic, disjoint, detailed and vary across districts',()=>{
 const ids=new Set(),styles=new Set();
 for(const [x,z]of [[3,0],[-3,0],[0,3],[0,-3],[105,-83],[-900,420]]){
  const env=generateBlock(x,z),cells=generateCells(env);assert.deepEqual(env,generateBlock(x,z));assert.ok(cells.length<4096);assert.ok(!homeBlock(x,z));
  for(const c of cells){assert.ok(!ids.has(c.id));ids.add(c.id);assert.deepEqual(cellBlock(c.id),[x,z]);}
  env.buildings.forEach((b,i)=>{styles.add(b.architecture);const f=buildingFootprint(b);assert.ok(f[0]>=x*70-27&&f[2]<=x*70+27);assert.ok(f[1]>=z*70-29&&f[3]<=z*70+29);for(const a of env.buildings.slice(i+1)){const g=buildingFootprint(a);assert.ok(f[0]>=g[2]||f[2]<=g[0]||f[1]>=g[3]||f[3]<=g[1]);}assert.ok(new Set(cells.filter(c=>c.building===i).flatMap(c=>componentPlacements(c,{interiors:false}).map(p=>p.type))).size>=(STYLE_BY_ID.has(b.architecture)?30:75),b.architecture);});
 }
 for(let x=3;x<260;x++)for(const b of generateBlock(x,7).buildings)styles.add(b.architecture);
 assert.deepEqual([...styles].sort(),[...BUILDING_STYLES.map(s=>s.id),'chrysler'].sort());assert.notEqual(blockCellBase(3,0),blockCellBase(-3,0));
});
test('unloaded blocks restore structural HP, open skins, persistent debris and stable cell IDs',()=>{
 const room=new Room('SAVE');try{
  const tile=room.stream.load(4,-3),c=tile.cells.find(c=>c.floor===1&&c.walls[0]),other=tile.cells.find(c=>c.floor===3&&c.walls[2]);
  const partial=tile.cells.find(c=>c.floor===2&&c.walls[0]);room.damageCell(partial,2,1);const partialSkin=structuredClone(partial.skin);
  room.damageCell(c,70,1);const skin=structuredClone(c.skin);const pieces=room.breakCells([other.id],v(2,1,0));assert.ok(pieces.length);
  const piece=pieces[0],pose=room.debrisMeta(piece),baseCells=room.cells.length-tile.cells.length;
  room.stream.unload(tile.key);assert.equal(room.cells.length,baseCells);assert.ok(!room.cellMap.has(c.id));assert.ok(!room.debris.has(piece.id));
  const saved=room.stream.welcome().find(t=>t.key===tile.key);assert.ok(saved.entities.some(e=>e.id===piece.id));assert.ok(saved.skins.some(s=>s[0]===c.id));
  const restored=room.stream.load(4,-3);assert.deepEqual(restored.cells.map(c=>c.id),tile.cells.map(c=>c.id));assert.deepEqual(room.cellMap.get(c.id).skin,skin);assert.deepEqual(room.cellMap.get(partial.id).skin,partialSkin);assert.deepEqual(room.debrisMeta(room.debris.get(piece.id)).p,pose.p);assert.ok(room.detached.has(other.id));
  for(const cell of restored.cells)if(!room.detached.has(cell.id))assert.ok(room.handWorld.cells.get(cell.id).pose);
 }finally{room.dispose();}
});
test('long travel releases bodies and reuses building slots while all separated players keep solid blocks',()=>{
 const room=new Room('BOUNDS');try{
  const baseline=room.cells.length;let max=0;
  for(let i=0;i<18;i++){room.boss.x=(i+5)*140;room.boss.z=i%2?350:-350;for(let j=0;j<10;j++)room.stream.update();max=Math.max(max,room.stream.active.size);assert.ok(room.stream.active.size<=9);assert.ok(room.cells.length<baseline+5000);}
  assert.ok(max===9);assert.ok(room.env.buildings.length<=169+18*8);assert.equal(room.stream.archive.size,0);
  const client=room.attach({send(){}},'raider','REMOTE'),player=room.players.get(client.id);room.spawn(player,v(-700,20,-420));for(let j=0;j<10;j++)room.stream.update();assert.ok(room.stream.active.has('-10,-6'));assert.ok(room.stream.active.has('44,5'));assert.ok(room.stream.active.size<=18);
 }finally{room.dispose();}
});
test('raider flight and tracked giant poses work beyond the old map boundary',()=>{
 const p={fuel:1,soaring:false,lastDodgeSeq:0,dodgeUntil:0,dodgeReady:0};const result=flightStep(p,v(1400,20,-700),v(0,0,0),{...noInput(),x:1},0);assert.ok(result.velocity.x>0);assert.equal(result.velocity.z,0);
 const room=new Room('REACH');try{const boss=room.attach({send(){}},'boss','GIANT');room.boss.x=1400;room.boss.z=-700;room.input(boss,{type:'pose',head:[1400,24,-700],left:[1394,14,-704],right:[1406,14,-704],yaw:0,reset:true});assert.equal(room.boss.target.head.x,1400);room.stream.update();assert.ok(room.stream.active.has('20,-10'));const client=room.attach({send(){}},'raider','ARRIVAL'),at=room.players.get(client.id).body.translation();assert.ok(Math.hypot(at.x-room.boss.x,at.z-room.boss.z)<120);assert.equal((at.x-35)%70,0);assert.equal(Math.abs((at.z-35)%70),0);room.initWorld();assert.equal(room.stream.active.size,0);assert.equal(room.stream.archive.size,0);assert.equal(room.env.buildings.length,169);}finally{room.dispose();}
});

test('real giant locomotion and raider physics cross the old kill boundary onto solid generated streets',()=>{
 const room=new Room('TRAVEL');try{
  const boss=room.attach({send(){}},'boss','PILOT'),raider=room.attach({send(){}},'raider','SCOUT');room.boss.x=105;room.boss.z=-202;room.boss.resetPose=true;room.boss.noContactUntil=10;
  const player=room.players.get(raider.id);room.spawn(player,v(105,20,-202));player.body.setLinvel(v(0,0,-11),true);
  for(let i=0;i<60;i++){room.input(boss,{type:'input',...noInput(),z:-1});room.input(raider,{type:'input',...noInput(),z:-1});room.step();}
  assert.ok(room.boss.z<-210);assert.ok(player.body.translation().z<-210);assert.equal(player.hp,100);assert.ok(room.stream.active.size>0);
 }finally{room.dispose();}
});
