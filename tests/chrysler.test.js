import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,physicsReady} from '../server/room.js';
import {city,generateCells,cellColliders,initialSkin} from '../shared/environment.js';
import {generateBlock,buildingFootprint,cellBlock} from '../shared/city/layout.js';
import {CHRYSLER_COMPONENTS,CHRYSLER_CROWN,CHRYSLER_SPIRE} from '../shared/city/chrysler.js';
import {componentPlacements} from '../shared/city/components.js';
import {v} from '../shared/math.js';
import {damageSphere} from '../server/destruction.js';
await physicsReady;
const disjoint=(a,b)=>a[0]>=b[2]||a[2]<=b[0]||a[1]>=b[3]||a[3]<=b[1];
test('Chrysler has its own supported silhouette, seven perforated arches and all 35 custom components',()=>{
 const cells=generateCells(city).filter(c=>c.architecture==='chrysler'),crown=cells.filter(c=>c.chryslerCrown);assert.equal(crown.length,1);assert.equal(crown[0].p[0],-70);assert.equal(crown[0].p[2],0);
 assert.equal(Object.keys(CHRYSLER_COMPONENTS).length,35);assert.equal(CHRYSLER_CROWN.length,7);
 for(const interiors of [false,true]){const used=new Set(cells.flatMap(c=>componentPlacements(c,{interiors}).map(p=>p.type)));for(const type of Object.keys(CHRYSLER_COMPONENTS))assert.ok(used.has(type),type);}
 for(const c of cells)if(!c.ground)assert.ok(c.below);
 const shell=CHRYSLER_COMPONENTS.chryslerCrownShell.parts;assert.equal(shell.length,7);assert.ok(shell.every(p=>p.shape==='polygon'&&p.holes.length>=3));
 const shapes=cellColliders(crown[0],initialSkin(crown[0])),tip=crown[0].size[1]*(CHRYSLER_SPIRE.base+CHRYSLER_SPIRE.height-.01);
 assert.ok(shapes.some(a=>tip>=a[1]-a[4]&&tip<=a[1]+a[4]));
 // The extended collision bounds cover every crown level and all four eagle corners.
 for(const l of CHRYSLER_CROWN)assert.ok(shapes.some(a=>a[3]>=l.radius*crown[0].size[0]-.01&&Math.abs(a[1]-(l.base+l.height/6)*crown[0].size[1])<.01));
 const eagles=cells.filter(c=>componentPlacements(c).some(p=>p.type==='chryslerEagleHead'));assert.equal(eagles.length,4);
 for(const c of eagles)assert.ok(cellColliders(c).some(a=>a[1]>c.size[1]/2));
});
test('generated Chrysler courtyards preserve existing address IDs and never overlap neighbors',()=>{
 let natural=0;
 for(let x=3;x<65;x++){
  const original=generateBlock(x,6),env=generateBlock(x,6,city.seed,{landmark:'chrysler'}),cells=generateCells(env),plain=generateCells(original),landmark=env.buildings.at(-1);
  if(original.landmark)natural++;assert.equal(landmark.architecture,'chrysler');assert.equal(env.buildings.length,9);assert.ok(cells.length<4096);
  assert.deepEqual(cells.slice(0,plain.length),plain);
  for(const b of env.buildings.slice(0,-1))assert.ok(disjoint(buildingFootprint(b),buildingFootprint(landmark)));
  assert.deepEqual(cellBlock(cells.at(-1).id),[x,6]);
 }
 assert.ok(natural>0&&natural<10);
});
test('host spawn preserves live buildings, broadcasts its blueprint, and survives unload and late join',()=>{
 const room=new Room('CHRYSLER'),messages=[];try{
  const host=room.attach({send:s=>messages.push(JSON.parse(s))},'boss','HOST'),guest=room.attach({send(){}},'spectator','GUEST');room.boss.x=210;room.boss.z=-20;
  const tile=room.stream.load(3,0);assert.ok(!tile.landmark);const original=tile.cells[0],body=room.buildingBodies[original.building];room.damageCell(original,60,host.id);const hp=original.skin.hp,ids=tile.cells.map(c=>c.id);
  room.input(guest,{type:'spawn-building',building:'chrysler'});assert.equal(room.stream.landmarks.size,0);
  room.input(host,{type:'spawn-building',building:'chrysler'});assert.equal(room.stream.landmarks.size,1);assert.equal(messages.at(-1).type,'building-spawned');assert.equal(messages.at(-1).x,210);assert.equal(messages.at(-1).z,0);
  assert.equal(room.cellMap.get(original.id),original);assert.equal(original.skin.hp,hp);assert.equal(room.buildingBodies[original.building],body);assert.deepEqual(tile.cells.slice(0,ids.length).map(c=>c.id),ids);
  assert.equal(room.stream.welcome().find(t=>t.key==='3,0').landmark,'chrysler');
  room.input(host,{type:'spawn-building',building:'chrysler'});assert.equal(room.stream.landmarks.size,1,'spawn cooldown');
  const crown=tile.cells.find(c=>c.chryslerCrown),parts=room.breakCells([crown.id],v(0,0,0));assert.ok(parts.length);assert.ok(parts[0].body.numColliders()>20);
  room.stream.unload('3,0');assert.equal(room.stream.welcome().find(t=>t.key==='3,0').landmark,'chrysler');
  const restored=room.stream.load(3,0);assert.ok(restored.cells.some(c=>c.id===crown.id&&c.chryslerCrown));assert.ok(room.debris.has(parts[0].id));assert.equal(room.cellMap.get(original.id).skin.hp,hp);
  room.initWorld();assert.equal(room.stream.landmarks.size,0);
 }finally{room.dispose();}
});
test('a pristine manually spawned tower is still described to late joiners after its block unloads',()=>{
 const room=new Room('PRISTINE');try{const host=room.attach({send(){}},'boss','HOST');room.boss.x=210;room.boss.z=-20;room.stream.spawnChrysler(host);room.stream.unload('3,0');assert.equal(room.stream.welcome().find(t=>t.key==='3,0').landmark,'chrysler');assert.ok(room.stream.load(3,0).cells.some(c=>c.chryslerCrown));}finally{room.dispose();}
});

test('missile blast at the high spire damages its owning crown bay',()=>{
 const room=new Room('CROWN HIT');try{const crown=room.cells.find(c=>c.chryslerCrown),hp=crown.skin.hp;damageSphere(room,v(crown.p[0],crown.p[1]+crown.size[1]*(CHRYSLER_SPIRE.base+2),crown.p[2]),3,180);assert.ok(crown.skin.parts?.length);assert.equal(crown.skin.hp,hp,'A spire hit preserves the supporting bay');const point=[crown.p[0],crown.p[1]+crown.size[1]*(CHRYSLER_SPIRE.base+2),crown.p[2]];assert.ok(room.shards.size,'The spire sheds actual small fragments');}finally{room.dispose();}
});
