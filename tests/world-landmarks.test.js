import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_BUILDING_STYLES,STYLE_BY_ID,catalogBuilding} from '../shared/city/catalog.js';
import {WORLD_COMPONENTS,worldColliders,worldRoofTypes} from '../shared/city/world-landmarks.js';
import {componentPlacements} from '../shared/city/components.js';
import {midtown} from '../shared/city/layout.js';
import {Room,physicsReady} from '../server/room.js';
import {v} from '../shared/math.js';
await physicsReady;
const fixture=id=>new Room('WORLD '+id,{environment:{...midtown,id:'world-test',infinite:false,buildings:[catalogBuilding(STYLE_BY_ID.get(id),0,-30)]}});
test('18 world landmarks cover 11 cities, use all their special parts and remain supported in actual physics',()=>{
 assert.equal(WORLD_BUILDING_STYLES.length,18);assert.equal(new Set(WORLD_BUILDING_STYLES.map(s=>s.city)).size,11);const used=new Set();
 for(const s of WORLD_BUILDING_STYLES){const r=fixture(s.id);try{
  for(const c of r.cells)for(const p of componentPlacements(c,{interiors:false}))used.add(p.type);
  for(let i=0;i<120;i++)r.step();assert.equal(r.detached.size,0,s.id+' intact stability');
  for(const c of r.cells)for(const a of worldColliders(c)){assert.ok(a.every(Number.isFinite)&&a.slice(3).every(n=>n>0));assert.ok(c.p[1]+a[1]+a[4]<midtown.maxAltitude,s.id+' playable crown');}
 }finally{r.dispose();}}
 for(const type of Object.keys(WORLD_COMPONENTS))assert.ok(used.has(type),type+' must actually appear');
});
test('SWFC aperture, twin-tower gaps, Marina Bay tower gaps and Grande Arche portal are actually open',()=>{
 for(const [id,floor,ix,iz]of [['swfc',26,1,0],['petronas',8,2,0],['marina-bay',8,1,0],['grande-arche',3,1,0]]){
  const r=fixture(id);try{
   assert.ok(!r.cells.some(c=>c.floor===floor&&c.ix===ix&&c.iz===iz));const f=r.floors[0][floor],c=f.cells[0],p=[c.p[0]+(ix-c.ix)*c.size[0],c.p[1],c.p[2]+(iz-c.iz)*c.size[2]];
   const hits=[...r.handWorld.near(p,p)].filter(b=>b.cell!=null&&p.every((v,k)=>Math.abs(v-b.center[k])<b.half[k]));assert.equal(hits.length,0,id+' hand query opening');
   const handles=[...f.structure,...f.walls.flat(),...r.buildingColumns[0].handles];
   for(const handle of handles){const co=r.world.getCollider(handle),at=co.translation(),half=co.halfExtents();assert.ok(!(Math.abs(p[0]-at.x)<half.x&&Math.abs(p[1]-at.y)<half.y&&Math.abs(p[2]-at.z)<half.z),id+' real static collider across opening');}
  }finally{r.dispose();}
 }
});
test('world crown contact shapes follow detached bays and survive streaming snapshots',()=>{
 for(const id of ['transamerica','shard','burj-khalifa','petronas','emirates-towers','marina-bay']){
  const r=fixture(id);try{
   const c=r.cells.find(c=>c.topFloor&&worldRoofTypes(c).length),shapes=worldColliders(c),a=shapes.at(-1),p=c.p.map((n,k)=>n+a[k]);
   assert.ok([...r.handWorld.near(p,p)].some(b=>b.cell===c.id),id+' reachable crown');
   const e=r.breakCells([c.id],v())[0];assert.ok(e);assert.ok(e.body.numColliders()>=shapes.length+1);assert.ok(r.welcome({id:100,role:'spectator'}).entities.some(x=>x.cells.includes(c.id)));
  }finally{r.dispose();}
 }
});
test('stepped pagoda profiles keep their column colliders on each actual step',()=>{
 for(const id of ['taipei101','jin-mao']){const r=fixture(id);try{
  assert.ok(new Set(r.cells.map(c=>c.columnSection)).size>5);
  const floor=r.floors[0][8],c=floor.cells[0],p=[c.p[0]-c.size[0]/2,c.p[1],c.p[2]-c.size[2]/2];
  assert.ok(r.buildingColumns[0].handles.some(h=>{const co=r.world.getCollider(h),a=co.translation(),b=co.halfExtents();return Math.abs(p[0]-a.x)<=b.x+.01&&Math.abs(p[1]-a.y)<=b.y&&Math.abs(p[2]-a.z)<=b.z+.01;}));
 }finally{r.dispose();}}
});
