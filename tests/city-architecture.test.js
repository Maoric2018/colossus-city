import test from 'node:test';
import assert from 'node:assert/strict';
import {city,generateCells,buildingFootprint,buildingHeight} from '../shared/environment.js';
import {COMPONENTS,componentPlacements} from '../shared/city/components.js';
import {genericBuilding} from '../shared/city/generic-details.js';
const cells=generateCells(city);
test('dense blocks preserve clear roads, alleys, plaza and disjoint building footprints',()=>{
 assert.ok(city.buildings.length>=150);const perBlock=new Map();
 for(const [i,b] of city.buildings.entries()){
  const f=buildingFootprint(b),block=`${Math.round(b.x/70)}:${Math.round(b.z/70)}`;perBlock.set(block,(perBlock.get(block)||0)+1);
  assert.ok(!(f[0]<24&&f[2]>-24&&f[1]<24&&f[3]>-24),b.name+' intrudes on the plaza');
  for(const x of city.roads.avenues)assert.ok(f[2]<=x-city.roads.avenueWidth/2||f[0]>=x+city.roads.avenueWidth/2,b.name+' blocks an avenue');
  for(const z of city.roads.streets)assert.ok(f[3]<=z-city.roads.streetWidth/2||f[1]>=z+city.roads.streetWidth/2,b.name+' blocks a street');
  for(const other of city.buildings.slice(i+1)){const g=buildingFootprint(other);assert.ok(f[0]>=g[2]||f[2]<=g[0]||f[1]>=g[3]||f[3]<=g[1],b.name+' overlaps '+other.name);}
 }
 assert.equal(perBlock.size,24);assert.ok([...perBlock.values()].every(n=>n>=6));
});
test('home landmarks retain their detailed kits and generic buildings use restrained coherent detail',()=>{
 const used=new Set();for(const interiors of [true,false])for(let b=0;b<city.buildings.length;b++){
  const parts=cells.filter(c=>c.building===b).flatMap(c=>componentPlacements(c,{interiors}));for(const p of parts){used.add(p.type);assert.ok(COMPONENTS[p.type]);}
  if(!genericBuilding(city.buildings[b].architecture))assert.ok(new Set(parts.map(p=>p.type)).size>=75,city.buildings[b].name);
  else assert.ok(!parts.some(p=>p.type==='crossBrace'||p.type==='securityGrille'),city.buildings[b].name);
 }
 for(const type of ['generic_brick_trim','generic_stone_trim','generic_concrete_trim'])assert.ok(used.has(type));
 for(const spec of Object.values(COMPONENTS))for(const p of spec.parts){assert.ok(p.s.every(n=>n>0&&Number.isFinite(n)));assert.ok([...p.p,...p.r].every(Number.isFinite));}
});
test('landmark silhouettes and component kits are distinct and stay structurally supported',()=>{
 const twins=city.buildings.filter(b=>b.architecture==='wtc');assert.equal(twins.length,2);assert.equal(buildingHeight(twins[0]),buildingHeight(twins[1]));assert.equal(twins.filter(b=>b.spire).length,1);
 const empire=city.buildings.find(b=>b.architecture==='empire');assert.ok(empire.tiers[0].nx>empire.tiers.at(-1).nx);assert.ok(empire.spire>10);
 const types=architecture=>new Set(cells.filter(c=>c.architecture===architecture).flatMap(c=>componentPlacements(c).map(p=>p.type)));
 assert.ok(types('wtc').has('wtcTrident')&&types('wtc').has('wtcMechanical'));assert.ok(types('empire').has('empireCrown')&&types('empire').has('empireMast'));
 for(const c of cells)if(c.architecture!=='urban'&&!c.ground)assert.ok(c.below);
});
