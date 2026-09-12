import * as T from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import {city,generateCells,cellColliders,initialSkin} from '../shared/environment.js';
import {componentPlacements} from '../shared/city/components.js';
import {MODERN_LANDMARK_COMPONENTS,modernLandmark,modernColliders} from '../shared/city/modern-landmarks.js';
import {componentGeometry} from '../src/render/component-geometry.js';
import {Room,physicsReady} from '../server/room.js';
import {damageSphere} from '../server/destruction.js';
import {v} from '../shared/math.js';
await physicsReady;
const cells=generateCells(city),landmarks=cells.filter(c=>modernLandmark(c.architecture));
test('modern landmark floors taper continuously, stay supported and retain four Vanderbilt volumes',()=>{
 const vandy=city.buildings.find(b=>b.architecture==='vanderbilt');assert.equal(vandy.tiers.length,4);
 for(const arch of ['vanderbilt','hudson30']){
  const mine=landmarks.filter(c=>c.architecture===arch),ids=new Map(mine.map(c=>[c.id,c]));
  assert.ok(mine.at(-1).size[0]<mine[0].size[0]*.9);
  for(const c of mine){assert.equal(c.material,'glass');assert.ok(!c.roofAsset);if(c.ground)continue;const below=ids.get(c.below);assert.ok(below);
   for(const k of [0,2])assert.ok(Math.abs(below.p[k]-c.p[k])<(below.size[k]+c.size[k])/2-.3,'taper must overlap its support');
  }
  for(const floor of new Set(mine.map(c=>c.floor))){const f=mine.filter(c=>c.floor===floor),x=new Set(f.map(c=>c.ix)),z=new Set(f.map(c=>c.iz));if(arch==='vanderbilt'&&[23,24].includes(floor))assert.equal(f.length,12,'four stepped volumes expose an L-shaped shoulder');else assert.equal(f.length,x.size*z.size);for(const c of f)assert.deepEqual(c.size,f[0].size);}
 }
 assert.equal(landmarks.filter(c=>c.hudsonEdge).length,1);assert.equal(landmarks.filter(c=>c.hudsonCrown).length,6);assert.equal(landmarks.filter(c=>c.vanderbiltCrown).length,1);
});
test('each custom part is used on both quality tiers, with no masonry, balconies or name signs on modern curtain walls',()=>{
 const used=new Set();for(const interiors of [false,true])for(const c of landmarks)for(const p of componentPlacements(c,{interiors})){used.add(p.type);assert.ok(!['balcony','escapeLadder','quoin','shopSign','acUnit','chimney'].includes(p.type));}
 for(const [name,spec] of Object.entries(MODERN_LANDMARK_COMPONENTS)){
  assert.ok(used.has(name),name);
  for(const part of spec.parts){const g=componentGeometry(part);for(const a of ['position','normal','uv'])assert.ok([...g.attributes[a].array].every(Number.isFinite),name+' '+a);g.dispose();}
 }
});
test('Edge rim beams follow the three-dimensional diagonal instead of projecting beyond the deck',()=>{
 const part=MODERN_LANDMARK_COMPONENTS.hudsonEdgeRim.parts[0],g=componentGeometry(part);g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...part.r)));g.translate(...part.p);g.computeBoundingBox();assert.ok(g.boundingBox.max.z>.63&&g.boundingBox.max.z<.67);assert.ok(g.boundingBox.max.x>1.94&&g.boundingBox.max.x<1.98);g.dispose();
});

test('Edge, angled crowns, SUMMIT boxes and spire have finite shared contact geometry within playable height',()=>{
 for(const c of landmarks){for(const a of modernColliders(c)){
  assert.ok(a.every(Number.isFinite));assert.ok(a.slice(3).every(n=>n>0));assert.ok(c.p[1]+a[1]+a[4]<city.maxAltitude);
  assert.ok(cellColliders(c,initialSkin(c)).some(b=>JSON.stringify(a)===JSON.stringify(b)));
 }}
 const edge=landmarks.find(c=>c.hudsonEdge);assert.ok(modernColliders(edge).some(a=>a[0]+a[3]>edge.size[0]*1.8));
 const needle=landmarks.find(c=>c.vanderbiltCrown);assert.ok(modernColliders(needle).some(a=>a[1]+a[4]>needle.size[1]*6.6));
});
test('hands and missiles reach projected landmark parts; breaking the owner keeps their collision shapes on debris',()=>{
 const room=new Room('MODERN CONTACT');try{
  for(const flag of ['hudsonEdge','hudsonCrown','vanderbiltCrown']){
   const c=room.cells.find(c=>c[flag]),shapes=modernColliders(c),a=flag==='hudsonEdge'?shapes.at(-3):shapes.at(-1),point=[c.p[0]+a[0],c.p[1]+a[1],c.p[2]+a[2]];
   assert.ok([...room.handWorld.near(point,point)].some(b=>b.cell===c.id),flag+' broad phase');
   const hp=c.skin.hp;damageSphere(room,v(...point),2,100);assert.ok(c.skin.hp<hp,flag+' missile damage');
   const pieces=room.breakCells([c.id],v(0,0,0));assert.ok(pieces.length);assert.ok(pieces[0].body.numColliders()>=shapes.length+1,flag+' debris geometry');
  }
 }finally{room.dispose();}
});
test('Vanderbilt shoulder notches have no invisible floor or wall across their empty corner',()=>{
 const room=new Room('NOTCHED');try{
  const bi=city.buildings.findIndex(b=>b.architecture==='vanderbilt'),f=room.floors[bi][23],anchor=f.cells.find(c=>c.ix===0&&c.iz===0),[w,h,d]=anchor.size;
  assert.ok(f.notched);assert.equal(f.structure.length,2);assert.ok(room.buildingColumns[bi].handles.length<=25);const point=[anchor.p[0]+2.5*w,anchor.p[1]+h/2-.1,anchor.p[2]+.5*d];
  const contains=(co,p)=>{const a=co.translation(),b=co.halfExtents();return Math.abs(p[0]-a.x)<=b.x&&Math.abs(p[1]-a.y)<=b.y&&Math.abs(p[2]-a.z)<=b.z;};
  const handles=[...f.structure,...f.walls.flat(),...room.buildingColumns[bi].handles];
  assert.ok(!handles.some(h=>contains(room.world.getCollider(h),point)),'an absent quadrant must be open');
  assert.ok(f.structure.some(handle=>contains(room.world.getCollider(handle),[anchor.p[0],point[1],anchor.p[2]])),'adjacent shoulder keeps its slab');
  room.breakCells([f.cells.at(-1).id],v(0,0,0));
  const remaining=[...f.structure,...f.walls.flat(),...f.cells.flatMap(c=>[...c.structureHandles,...c.wallHandles.flat()])];
  assert.ok(!remaining.some(h=>{const co=room.world.getCollider(h);return co&&contains(co,point);}), 'breaking the shoulder must not fill its notch');
 }finally{room.dispose();}
});
