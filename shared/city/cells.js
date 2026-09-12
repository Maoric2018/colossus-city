import {shapeModernCell,finishModernCells} from './modern-landmarks.js';
import {shapeCatalogCell,finishCatalogCells} from './catalog.js';
// A structural cell is one hollow storey bay: slab + four corner columns + exterior skins.
// Cells form a support graph anchored at foundations. No triangle-mesh physics anywhere.
import {C} from '../config.js';
import {roofColliders} from '../props.js';
import {MATERIALS, ALL_SIDES, sideBit, wallSolid} from './materials.js';
export function generateCells(env){
 const cells = [];
 let id = (env.cellBase || 0) + 1;
 env.buildings.forEach((b, localIndex) => {
  const bi=b.index??localIndex;
  const ids = new Map(), totalFloors = b.tiers.reduce((s, t) => s + t.floors, 0);
  const base = b.tiers[0], originX = b.x - (base.nx - 1) / 2 * b.bay, originZ = b.z - (base.nz - 1) / 2 * b.bay;
  let floor = 0;
  b.tiers.forEach((t, ti) => {
   for(let f = 0; f < t.floors; f++, floor++)
    for(let z = 0; z < t.nz; z++) for(let x = 0; x < t.nx; x++){
     const ix = t.ix + x, iz = t.iz + z;
     if(t.voids?.some(v=>ix>=v.ix&&ix<v.ix+v.nx&&iz>=v.iz&&iz<v.iz+v.nz))continue;
     const cell = {id:id++, building:bi, tier:ti, floor, ix, iz, material:b.material, architecture:b.architecture || 'urban', variant:b.variant || 0, roofYaw:env.cellBase?b.variant%4:undefined, buildingFloors:totalFloors, ground:floor === 0,
      p:[originX + ix * b.bay, .15 + floor * b.story + b.story / 2, originZ + iz * b.bay],
      size:[b.bay, b.story, b.bay], walls:[false, false, false, false], neighbors:[], below:0, above:0, lateral:[],
      roof:false, stackAbove:0, frameScale:C.BUILDING_STRENGTH * (b.strength || 1) * Math.max(.55,Math.min(1.25,(b.bay/6)**1.25)) * (.68+.32*Math.min(1,totalFloors/16)) * (1 + .7 * (1 - floor / Math.max(1, totalFloors - 1)))};
     shapeModernCell(cell,b);
     shapeCatalogCell(cell,b);
     ids.set(`${ix}:${floor}:${iz}`, cell.id); cells.push(cell);
    }
  });
  const mine = cells.filter(c => c.building === bi), byId = new Map(mine.map(c => [c.id, c]));
  for(const c of mine){
   const at = (dx, dy, dz) => ids.get(`${c.ix + dx}:${c.floor + dy}:${c.iz + dz}`) || 0;
   c.below = at(0, -1, 0); c.above = at(0, 1, 0);
   // walls: n(-z) e(+x) s(+z) w(-x). Exterior where no lateral neighbour exists on this floor.
   const sides = [at(0, 0, -1), at(1, 0, 0), at(0, 0, 1), at(-1, 0, 0)];
   sides.forEach((n, side) => { if(n) c.lateral.push(n); else c.walls[side] = true; });
   c.neighbors = [c.below, c.above, ...c.lateral].filter(Boolean);
   c.roof = !c.above;
  }
  const assets=[['city-kit-industrial/water-tower',3.2],['space-kit/satelliteDish_detailed',2.6],['city-kit-industrial/detail-tank',1.3],['city-kit-industrial/solar-panel-flat',.3]];
  for(const c of mine) if(c.roof){const type=(c.ix+c.iz*2+(env.cellBase?localIndex:c.building)+c.tier)%5;if(b.waterTower && c.ix===0 && c.iz===0)c.roofAsset=assets[0];else if(!b.spire && type>=1 && type<=3)c.roofAsset=assets[type];}
  if(b.spire){const top=mine.filter(c=>c.roof).sort((a,b)=>b.p[1]-a.p[1])[0];if(top)top.spire=b.spire;}
  if(b.architecture==='chrysler'){const top=mine.find(c=>c.floor===totalFloors-1&&c.ix===2&&c.iz===2);if(top)top.chryslerCrown=true;for(const c of mine)delete c.roofAsset;}
  finishModernCells(mine,b);
  finishCatalogCells(mine,b);
  for(const c of mine){ let n = 0, up = c.above; while(up){ n++; up = byId.get(up).above; } c.stackAbove = n; }
 });
 return cells;
}
// Per-cell mutable damage state, kept separately so the static cell table stays shareable.
export function initialSkin(c){
 const m = MATERIALS[c.material], mask = c.openSkin?0:c.walls.reduce((acc, w, side) => acc | (w ? sideBit(side) : 0), 0);
 return {glass:mask, facade:m.facadeHP > 0 ? mask : 0, hp:m.frameHP * c.frameScale, maxHp:m.frameHP * c.frameScale, glassHp:c.walls.map(w=>w&&!c.openSkin?m.glassHP:0), facadeHp:c.walls.map(w => w&&!c.openSkin ? m.facadeHP : 0)};
}
export const exteriorMask = c => c.walls.reduce((acc, w, side) => acc | (w ? sideBit(side) : 0), 0);
// Cuboid components in LOCAL space: [center x,y,z, half x,y,z]. A wall is present only
// while its solid skin layer stands, so broken windows/facades become openings.
export function cellColliders(c, skin){
 const [w, h, d] = c.size, slab = .13, col = .15, out = [];
 out.push([0, h / 2 - slab, 0, w / 2, slab, d / 2]);
 for(const x of [-1, 1]) for(const z of [-1, 1]) out.push([x * (w / 2 - col), 0, z * (d / 2 - col), col, h / 2 - .26, col]);
 const solid = side => !c.openSkin && c.walls[side] && (!skin || wallSolid(c.material, skin.glass, skin.facade, side));
 if(solid(0)) out.push([0, 0, -d / 2 + .06, w / 2 - .3, h / 2 - .22, .06]);
 if(solid(1)) out.push([w / 2 - .06, 0, 0, .06, h / 2 - .22, d / 2 - .3]);
 if(solid(2)) out.push([0, 0, d / 2 - .06, w / 2 - .3, h / 2 - .22, .06]);
 if(solid(3)) out.push([-w / 2 + .06, 0, 0, .06, h / 2 - .22, d / 2 - .3]);
 for(let i=0;i<5;i++)out[i].kind='frame';
 let index=5;for(let side=0;side<4;side++)if(solid(side)){out[index].kind='wall';out[index++].side=side;}
 for(const a of roofColliders(c)){a.kind='attachment';out.push(a);}
 return out;
}
// Which exterior side of a bay faces a world point (dominant horizontal axis).
export function facingSide(c, point){
 const dx = point[0] - c.p[0], dz = point[2] - c.p[2];
 return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
}
export {ALL_SIDES};
