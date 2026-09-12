import test from 'node:test';
import assert from 'node:assert/strict';
import {NEW_BUILDING_STYLES,CATALOG_STYLES,WORLD_BUILDING_STYLES,STYLE_BY_ID,catalogBuilding} from '../shared/city/catalog.js';
import {CATALOG_COMPONENTS,catalogRoofTypes,catalogRoofColliders} from '../shared/city/catalog-components.js';
import {COMPONENTS,componentPlacements} from '../shared/city/components.js';
import {generateBlock,BUILDING_STYLES,buildingFootprint,midtown} from '../shared/city/layout.js';
import {generateCells,initialSkin,cellColliders} from '../shared/city/cells.js';
import {unsupportedCells,overloadedCells} from '../shared/city/structure.js';
import {componentGeometry} from '../src/render/component-geometry.js';
import {Room,physicsReady} from '../server/room.js';
import {v} from '../shared/math.js';
await physicsReady;
const envFor=(s,variant=0)=>({...midtown,id:'catalog-test',infinite:false,buildings:[catalogBuilding(s,0,-30,{variant,random:()=>variant%2?.99:0})]});
test('the urban and world catalogs have distinct designs, at least 30 actually placed component types, and stable structures',()=>{
 assert.equal(NEW_BUILDING_STYLES.length,52);assert.equal(BUILDING_STYLES.length,68+WORLD_BUILDING_STYLES.length);assert.equal(NEW_BUILDING_STYLES.filter(s=>s.landmark).length,8);
 const designs=new Set(),used=new Set();
 for(const s of CATALOG_STYLES){
  const design=JSON.stringify([s.footprint,s.massing,s.facade,s.entry,s.roof]);assert.ok(!designs.has(design),s.id+' copied design');designs.add(design);
  for(const variant of [0,1,2,3]){
   const cells=generateCells(envFor(s,variant)),byId=new Map(cells.map(c=>[c.id,c]));
   for(const interiors of [false,true]){
    const types=new Set(cells.flatMap(c=>componentPlacements(c,{interiors}).map(p=>p.type)));
    assert.ok(types.size>=30,s.id+' '+types.size+' component types');for(const type of types){assert.ok(COMPONENTS[type],type);used.add(type);}
   }
   assert.deepEqual(unsupportedCells(cells,new Set()),[],s.id);assert.deepEqual(overloadedCells(cells,new Set()),[],s.id);
   for(const c of cells)for(const n of c.neighbors)assert.ok(byId.get(n)?.neighbors.includes(c.id),s.id+' reciprocal support');
  }
 }
 for(const type of Object.keys(CATALOG_COMPONENTS))assert.ok(used.has(type),'unused new component '+type);
});
test('all new component geometry has finite positions, normals and texture coordinates',()=>{
 for(const [name,spec] of Object.entries(CATALOG_COMPONENTS))for(const part of spec.parts){
  assert.ok(part.p.every(Number.isFinite)&&part.r.every(Number.isFinite));const g=componentGeometry(part);
  for(const a of ['position','normal','uv'])assert.ok([...g.attributes[a].array].every(Number.isFinite),name+' '+a);g.dispose();
 }
});
test('distant addresses vary by seed, preserve reload identities, and cover every type without plot collisions',()=>{
 const styles=new Set(),districts=new Set(),counts=[];
 for(let n=0;n<1024;n++){
  const x=n%2?-(n+3):n+3,z=(n*41)%127-63,env=generateBlock(x,z);districts.add(env.buildings[0].district);
  assert.deepEqual(env,generateBlock(x,z));assert.notDeepEqual(env.buildings,generateBlock(x,z,91234).buildings);
  assert.equal(new Set(env.buildings.slice(0,8).map(b=>b.architecture)).size,8,'avoid identical neighbors');
  const cells=generateCells(env);counts.push(cells.length);assert.ok(cells.length<4096);
  for(const [i,b]of env.buildings.entries()){
   styles.add(b.architecture);const a=buildingFootprint(b);assert.ok(a[0]>=x*70-27&&a[2]<=x*70+27&&a[1]>=z*70-29&&a[3]<=z*70+29);
   for(const other of env.buildings.slice(i+1)){const q=buildingFootprint(other);assert.ok(a[0]>=q[2]||a[2]<=q[0]||a[1]>=q[3]||a[3]<=q[1],b.name+' overlaps '+other.name);}
  }
 }
 assert.deepEqual([...styles].sort(),[...BUILDING_STYLES.map(s=>s.id),'chrysler'].sort());assert.equal(districts.size,6);
 assert.ok(counts.reduce((a,b)=>a+b,0)/counts.length<420,'physics cost remains bounded per block');
});
test('architectural open floors have no invisible merged wall; cathedral tower gaps remain open',()=>{
 for(const id of ['park432','citigroup','lever-house','cathedral']){
  const r=new Room('OPEN '+id,{environment:envFor(STYLE_BY_ID.get(id))});try{
   for(const c of r.cells.filter(c=>c.openSkin)){
    const skin=initialSkin(c);assert.equal(skin.glass|skin.facade,0);assert.ok(!cellColliders(c,skin).some(a=>a.kind==='wall'));
    const floor=r.floors[0][c.floor];assert.ok(!floor.walls.flat().length);assert.ok(!c.wallHandles.flat().length);
    assert.ok(c.roofHandles.length>0,'visible mechanical cores and raised supports keep solid contact shapes');
   }
   if(id==='cathedral'){
    const f=r.floors[0].at(-1);assert.equal(f.cells.length,2);assert.ok(f.notched);assert.equal(f.structure.length,2,'no merged slab across the gap between bell towers');
   }
  }finally{r.dispose();}
 }
});
test('new roofs collide at their actual height and remain attached when their owning bay breaks',()=>{
 for(const id of ['woolworth','wall40','citigroup','dutch-gable','cathedral']){
  const r=new Room('ROOF '+id,{environment:envFor(STYLE_BY_ID.get(id))});try{
   const c=r.cells.find(c=>c.topFloor&&catalogRoofTypes(c).length),shapes=catalogRoofColliders(c);assert.ok(shapes.length);
   for(const a of shapes){assert.ok(a.every(Number.isFinite)&&a.slice(3).every(n=>n>0));const p=c.p.map((n,k)=>n+a[k]);assert.ok([...r.handWorld.near(p,p)].some(b=>b.cell===c.id),'roof broad phase '+id);}
   const e=r.breakCells([c.id],v(0,0,0))[0];assert.ok(e);assert.ok(e.body.numColliders()>=shapes.length+1,id+' debris roof');
  }finally{r.dispose();}
 }
});
