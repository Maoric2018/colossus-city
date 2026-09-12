// Layered building damage, structural collapse scheduling and debris lifecycle.
// Every function takes the Room as its first argument and only touches room-owned state.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {rotate,plus,minus} from '../shared/giant-rig.js';
import {C, group} from '../shared/config.js';
import {roofColliders} from '../shared/props.js';
import {MATERIALS, sideBit, ALL_SIDES, wallSolid} from '../shared/city/materials.js';
import {cellColliders, initialSkin, facingSide} from '../shared/city/cells.js';
import {unsupportedCells, overloadedCells} from '../shared/city/structure.js';
import {v, add, sub, mul, len, norm, arr, vec, clamp, dist} from '../shared/math.js';
const G = C.COLLISION;
export const bodyPose = b => { const p = b.translation(), q = b.rotation(); return {p:[p.x, p.y, p.z], q:[q.x, q.y, q.z, q.w]}; };

// ---- world construction -------------------------------------------------------------
// Rapier's step cost grows with every collider, intact or not, so an untouched floor is one
// slab, a shared column grid and one wall per side. A floor only splits into per-bay shapes
// (structure, or one wall side) the first time something in it breaks.
export function buildCity(room){
 room.buildingBodies=[];room.cellsByBuilding=[];room.floors=[];room.buildingBounds=[];room.buildingColumns=[];
 room.collapsed = new Set(); room.pendingFailures = new Map(); room.dirtyBuildings = new Set(); room.skinEvents = []; room.lastCreak = new Map();
 addBuildings(room,room.cells,room.env.buildings.map((_,i)=>i));
}
export function addBuildings(room,cells,indices){
 for(const i of indices){room.buildingBodies[i]=room.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());room.cellsByBuilding[i]=[];room.floors[i]=[];room.buildingBounds[i]=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];room.buildingColumns[i]={merged:true,handles:[]};}
 for(const c of cells){
  c.queryHalf=c.size.map(v=>v/2);c.skin = initialSkin(c); c.lastHit = -100; c.entity = 0; c.lastHitBy = 0; c.handles = []; c.wallHandles = [[], [], [], []]; c.structureHandles = []; c.roofHandles = [];
  room.cellsByBuilding[c.building].push(c); room.cellMap.set(c.id, c);
  const b = room.buildingBounds[c.building];
  for(let k = 0; k < 3; k++){ b[k] = Math.min(b[k], c.p[k] - c.size[k] / 2); b[k + 3] = Math.max(b[k + 3], c.p[k] + c.size[k] / 2); }
  const floors = room.floors[c.building]; if(!floors[c.floor]) floors[c.floor] = {building:c.building, floor:c.floor, cells:[], structureMerged:false, wallsMerged:[false, false, false, false], structure:[], walls:[[], [], [], []]};
  floors[c.floor].cells.push(c);
 }
 for(const c of cells)for(const a of roofColliders(c)){
  c.roofHandles.push(staticCollider(room,room.buildingBodies[c.building],[c.p[0]+a[0],c.p[1]+a[1],c.p[2]+a[2],...a.slice(3)],{cell:c.id}));
  const b=room.buildingBounds[c.building];for(let k=0;k<3;k++){c.queryHalf[k]=Math.max(c.queryHalf[k],Math.abs(a[k])+a[k+3]);b[k]=Math.min(b[k],c.p[k]+a[k]-a[k+3]);b[k+3]=Math.max(b[k+3],c.p[k]+a[k]+a[k+3]);}
 }
 for(const i of indices) for(const f of room.floors[i]) if(f) mergeFloor(room, f);
 // Intact columns are continuous vertical runs. Split a building's runs only when its
 // first structural bay fails; this keeps the dense undamaged city cheap to simulate.
 indices.forEach(bi=>{
  const floors=room.floors[bi];
  const runs=new Map();
  for(const f of floors)for(const a of floorColumns(f)){
   const key=a.grid,lo=a[1]-a[4],hi=a[1]+a[4];
   const run=runs.get(key);if(run){run.end=[a[0],hi,a[2]];}else runs.set(key,{start:[a[0],lo,a[2]],end:[a[0],hi,a[2]]});
  }
  // Tapered floors move the same column line a little each storey. Merge by its
  // logical grid corner, then rotate the continuous run instead of adding hundreds
  // of separate colliders. A structural failure still splits it into local bays.
  for(const {start,end} of runs.values()){
   const delta=end.map((n,k)=>n-start[k]),length=Math.hypot(...delta),q=[delta[2],0,-delta[0],length+delta[1]],ql=Math.hypot(...q),shape=RAPIER.ColliderDesc.cuboid(.15,length/2,.15)
    .setTranslation(...start.map((n,k)=>(n+end[k])/2)).setRotation({x:q[0]/ql,y:0,z:q[2]/ql,w:q[3]/ql}).setDensity(22).setFriction(1.05).setRestitution(.015)
    .setCollisionGroups(group(G.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
   const co=room.world.createCollider(shape,room.buildingBodies[bi]);room.colliderTags.set(co.handle,{building:bi,column:true});room.buildingColumns[bi].handles.push(co.handle);
  }
 });
}
function staticCollider(room, body, a, tag){
 const co = room.world.createCollider(RAPIER.ColliderDesc.cuboid(a[3], a[4], a[5]).setTranslation(a[0], a[1], a[2]).setDensity(22).setFriction(1.05).setRestitution(.015)
  .setCollisionGroups(group(G.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
 room.colliderTags.set(co.handle, tag); return co.handle;
}
function removeHandles(room, handles){ for(const h of handles){ const co = room.world.getCollider(h); if(co) room.world.removeCollider(co, true); room.colliderTags.delete(h); } handles.length = 0; }
function mergeFloor(room, f){
 const cells = f.cells, body = room.buildingBodies[f.building], any = cells[0], [w, h, d] = any.size, col = .15, slab = .13;
 let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
 for(const c of cells){ minX = Math.min(minX, c.p[0] - w / 2); maxX = Math.max(maxX, c.p[0] + w / 2); minZ = Math.min(minZ, c.p[2] - d / 2); maxZ = Math.max(maxZ, c.p[2] + d / 2); }
 const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, y = any.p[1], tag = {building:f.building, floor:f.floor};
 // Notched landmark shoulders have real empty corners. A bounding rectangle would
 // create invisible floors and walls across the cut; only these rare floors use bays.
 const rectangular=new Set(cells.map(c=>c.ix)).size*new Set(cells.map(c=>c.iz)).size===cells.length;
 f.notched=!rectangular;
 if(f.notched){
  // Greedily merge occupied runs into rectangles without spanning the empty notch.
  const rows=new Map(),rects=[],last=new Map();for(const c of cells){if(!rows.has(c.iz))rows.set(c.iz,[]);rows.get(c.iz).push(c.ix);}
  for(const [z,xs] of [...rows].sort((a,b)=>a[0]-b[0])){
   xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;){const x0=xs[i++];let x1=x0;while(xs[i]===x1+1)x1=xs[i++];const key=`${x0}:${x1}`,r=last.get(key);if(r&&r.z1===z-1)r.z1=z;else{const next={x0,x1,z0:z,z1:z};rects.push(next);last.set(key,next);}}
  }
  const ox=any.p[0]-any.ix*w,oz=any.p[2]-any.iz*d;
  for(const r of rects)f.structure.push(staticCollider(room,body,[ox+(r.x0+r.x1)*w/2,y+h/2-slab,oz+(r.z0+r.z1)*d/2,(r.x1-r.x0+1)*w/2,slab,(r.z1-r.z0+1)*d/2],tag));
  for(const c of cells){
   for(let side=0;side<4;side++)if(c.walls[side]){
    const a=side===0?[c.p[0],y,c.p[2]-d/2+.06,w/2-.3,h/2-.22,.06]:side===1?[c.p[0]+w/2-.06,y,c.p[2],.06,h/2-.22,d/2-.3]:side===2?[c.p[0],y,c.p[2]+d/2-.06,w/2-.3,h/2-.22,.06]:[c.p[0]-w/2+.06,y,c.p[2],.06,h/2-.22,d/2-.3];
    f.walls[side].push(staticCollider(room,body,a,{...tag,side}));
   }
  }
  f.structureMerged=true;f.wallsMerged.fill(true);return;
 }

 f.structure.push(staticCollider(room, body, [cx, y + h / 2 - slab, cz, (maxX - minX) / 2, slab, (maxZ - minZ) / 2], tag));

 f.structureMerged = true;
 const spans = [[cx, minZ + .06, (maxX - minX) / 2 - .3, .06], [maxX - .06, cz, .06, (maxZ - minZ) / 2 - .3], [cx, maxZ - .06, (maxX - minX) / 2 - .3, .06], [minX + .06, cz, .06, (maxZ - minZ) / 2 - .3]];
 for(let side = 0; side < 4; side++){ const [sx, sz, hx, hz] = spans[side]; f.walls[side].push(staticCollider(room, body, [sx, y, sz, hx, h / 2 - .22, hz], {...tag, side})); f.wallsMerged[side] = true; }
}
function floorColumns(f){
 const [w,h,d]=f.cells[0].size, y=f.cells[0].p[1],minX=Math.min(...f.cells.map(c=>c.p[0]-w/2)),maxX=Math.max(...f.cells.map(c=>c.p[0]+w/2)),minZ=Math.min(...f.cells.map(c=>c.p[2]-d/2)),maxZ=Math.max(...f.cells.map(c=>c.p[2]+d/2)),out=[];
 const put=(x,z,ix,iz)=>{const a=[x,y,z,.15,h/2-.26,.15];a.grid=`${ix}:${iz}`;out.push(a);};
 if(f.notched){const points=new Set();for(const c of f.cells)for(const dx of [-1,1])for(const dz of [-1,1]){const ix=c.ix+(dx+1)/2,iz=c.iz+(dz+1)/2,key=`${ix}:${iz}`;if(!points.has(key)){points.add(key);put(c.p[0]+dx*w/2,c.p[2]+dz*d/2,ix,iz);}}return out;}
 const ix=Math.min(...f.cells.map(c=>c.ix)),iz=Math.min(...f.cells.map(c=>c.iz));
 for(let x=minX,i=0;x<=maxX+.01;x+=w,i++)for(let z=minZ,j=0;z<=maxZ+.01;z+=d,j++)put(x,z,ix+i,iz+j);return out;
}
function unmergeColumns(room,bi){
 const columns=room.buildingColumns[bi];if(!columns.merged)return;removeHandles(room,columns.handles);columns.merged=false;
 for(const f of room.floors[bi])for(const a of floorColumns(f))f.structure.push(staticCollider(room,room.buildingBodies[bi],a,{building:bi,floor:f.floor}));
}
const floorOf = (room, c) => room.floors[c.building][c.floor];
function attachStructure(room, c){
 const body = room.buildingBodies[c.building], [w, h, d] = c.size, col = .15, slab = .13, p = c.p, tag = {cell:c.id};
 c.structureHandles.push(staticCollider(room, body, [p[0], p[1] + h / 2 - slab, p[2], w / 2, slab, d / 2], tag));
 for(const x of [-1, 1]) for(const z of [-1, 1]) c.structureHandles.push(staticCollider(room, body, [p[0] + x * (w / 2 - col), p[1], p[2] + z * (d / 2 - col), col, h / 2 - .26, col], tag));
}
function sideOfShape(c, s){ const [w, , d] = c.size; return Math.abs(s[2] + d / 2 - .06) < 1e-6 ? 0 : Math.abs(s[0] - w / 2 + .06) < 1e-6 ? 1 : Math.abs(s[2] - d / 2 + .06) < 1e-6 ? 2 : 3; }
function attachWall(room, c, side){
 if(!c.walls[side] || !wallSolid(c.material, c.skin.glass, c.skin.facade, side)) return;
 const a = cellColliders(c, c.skin).find((s, i) => i >= 5 && sideOfShape(c, s) === side); if(!a) return;
 c.wallHandles[side].push(staticCollider(room, room.buildingBodies[c.building], [c.p[0] + a[0], c.p[1] + a[1], c.p[2] + a[2], a[3], a[4], a[5]], {cell:c.id}));
}
function unmergeStructure(room, f){ if(!f.structureMerged) return; unmergeColumns(room,f.building); removeHandles(room, f.structure); f.structureMerged = false; for(const c of f.cells) if(!room.detached.has(c.id)) attachStructure(room, c); }
function unmergeWall(room, f, side){ if(!f.wallsMerged[side]) return; removeHandles(room, f.walls[side]); f.wallsMerged[side] = false; for(const c of f.cells) if(!room.detached.has(c.id)) attachWall(room, c, side); }
// Remove every shape a bay owns. A static bay splits its floor first if it was still merged.
export function detachCellColliders(room, c){
 if(c.entity){ removeHandles(room, c.handles); return; }
 removeHandles(room, c.roofHandles);
 const f = floorOf(room, c); unmergeStructure(room, f); for(let side = 0; side < 4; side++) if(c.walls[side]) unmergeWall(room, f, side);
 removeHandles(room, c.structureHandles); for(let side = 0; side < 4; side++) removeHandles(room, c.wallHandles[side]);
}
// Debris is one solid box per bay: six times fewer contact shapes for the same silhouette.
export function attachCellColliders(room, c, body, offset){
 const co = room.world.createCollider(RAPIER.ColliderDesc.cuboid(c.size[0] * .48, c.size[1] * .48, c.size[2] * .48).setTranslation(offset.x, offset.y, offset.z).setDensity(22).setFriction(1.05).setRestitution(.015)
  .setCollisionGroups(group(G.DEBRIS)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
 room.colliderTags.set(co.handle, {cell:c.id}); c.handles = [co.handle];
 for(const a of roofColliders(c)){const prop=room.world.createCollider(RAPIER.ColliderDesc.cuboid(...a.slice(3)).setTranslation(offset.x+a[0],offset.y+a[1],offset.z+a[2]).setDensity(2).setCollisionGroups(group(G.DEBRIS)),body);room.colliderTags.set(prop.handle,{cell:c.id});c.handles.push(prop.handle);}
 return c.handles;
}
// A skin change opened or closed a wall: rebuild that side for this bay (splitting the floor's wall first).
function refreshStaticColliders(room, c, sides){
 if(c.entity || room.detached.has(c.id)) return;
 const f = floorOf(room, c);
 for(let side = 0; side < 4; side++){ if(!(sides & sideBit(side)) || !c.walls[side]) continue; unmergeWall(room, f, side); removeHandles(room, c.wallHandles[side]); attachWall(room, c, side); }
}
// Streaming restores exact accumulated damage without applying a second hit.
export function restoreSkin(room,c,skin){const changed=c.skin.glass!==skin.glass||c.skin.facade!==skin.facade;Object.assign(c.skin,skin);if(changed)refreshStaticColliders(room,c,ALL_SIDES);room.handWorld?.setSkin(c.id,c.skin);}
export function restoreDebris(room,meta){
 const body=room.world.createRigidBody((meta.settled?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic()).setTranslation(...meta.p).setRotation({x:meta.q[0],y:meta.q[1],z:meta.q[2],w:meta.q[3]}));
 const e={...meta,body,born:room.time,radius:0,building:room.cellMap.get(meta.cells[0]).building};
 for(const id of e.cells){const c=room.cellMap.get(id);c.entity=e.id;attachCellColliders(room,c,body,sub(vec(c.p),vec(e.origin)));e.radius=Math.max(e.radius,dist(vec(c.p),vec(e.origin))+c.size[0]*.7);if(meta.settled)room.handWorld.setDebris(id,plus(rotate(minus(c.p,e.origin),meta.q),meta.p),meta.q);}
 if(!meta.settled){body.setLinearDamping(.4);body.setAngularDamping(1.1);body.enableCcd(true);body.setLinvel(vec(meta.velocity||[0,0,0]),true);body.setAngvel(vec(meta.angular||[0,0,0]),true);}
 (meta.settled?room.settled:room.debris).set(e.id,e);return e;
}
// Map a collider tag back to a bay. Merged floor shapes resolve to the nearest intact bay to `point`.
export function resolveCell(room, tag, point){
 if(!tag) return null;
 if(tag.cell) return room.cellMap.get(tag.cell) || null;
 const floor=tag.column?Math.max(0,Math.floor((point.y-.15)/room.env.buildings[tag.building].story)):tag.floor;
 const f = room.floors[tag.building]?.[floor]; if(!f) return null;
 let best = null, bestD = Infinity;
 for(const c of f.cells){ if(room.detached.has(c.id)) continue; const d = (c.p[0] - point.x) ** 2 + (c.p[2] - point.z) ** 2; if(d < bestD){ bestD = d; best = c; } }
 return best;
}
export function removeBody(room, body){
 if(!body || !body.isValid()) return;
 for(let i = 0; i < body.numColliders(); i++) room.colliderTags.delete(body.collider(i).handle);
 room.world.removeRigidBody(body);
}

// ---- damage pipeline ----------------------------------------------------------------
// Apply `energy` to a bay from `sides` (bitmask). Glass shatters first, the facade cracks and
// shields the frame, then the structural frame absorbs the rest. Returns true when the frame fails.
export function damageCell(room, c, energy, sides = ALL_SIDES, by = 0){
 if(room.detached.has(c.id) || energy <= 0) return false;
 const m = MATERIALS[c.material], s = c.skin; let changed = false, shield = 0;
 for(let side = 0; side < 4; side++){
  if(!(sides & sideBit(side)) || !c.walls[side]) continue;
  const bit = sideBit(side);
  if((s.glass & bit) && energy >= m.glassHP){ s.glass &= ~bit; changed = true; energy -= m.glassHP * .3; }
  if(s.facade & bit){
   if(energy >= m.facadeHP * .35){ s.facadeHp[side] -= energy; if(s.facadeHp[side] <= 0){ s.facade &= ~bit; changed = true; energy = Math.max(0, energy - m.facadeHP * .3); } else shield++; }
   else shield++;
  }
 }
 if(changed){ room.skinEvents.push([c.id, s.glass, s.facade]); refreshStaticColliders(room, c, sides); room.handWorld?.setSkin(c.id, c.skin); }
 const frameHit = energy * (shield ? .3 : 1);
 if(frameHit > 0){ s.hp -= frameHit; c.lastHitBy = by; room.dirtyBuildings.add(c.building); }
 return s.hp <= 0;
}
// Damage every intact bay whose envelope intersects a sphere, strongest at the centre.
export function damageSphere(room, center, radius, energy, by = 0, limit = 12){
 const hit = [];
 for(const c of cellsNear(room, center, radius + 4)){
  let d=dist(vec(c.p),center);
  if(c.chryslerCrown||c.landmarkAttachment)for(const a of roofColliders(c))d=Math.min(d,Math.hypot(Math.max(0,Math.abs(center.x-c.p[0]-a[0])-a[3]),Math.max(0,Math.abs(center.y-c.p[1]-a[1])-a[4]),Math.max(0,Math.abs(center.z-c.p[2]-a[2])-a[5])));
  if(d > radius + 3) continue;
  const e = energy * clamp(1 - d / (radius + 3), .35, 1);
  if(damageCell(room, c, e, ALL_SIDES, by)) hit.push(c.id);
  if(hit.length >= limit) break;
 }
 return hit;
}
export function cellsNear(room, point, radius){
 const out = [];
 room.buildingBounds.forEach((b, i) => {
  if(point.x < b[0] - radius || point.x > b[3] + radius || point.y < b[1] - radius || point.y > b[4] + radius || point.z < b[2] - radius || point.z > b[5] + radius) return;
  for(const c of room.cellsByBuilding[i]){const reach=(c.chryslerCrown||c.landmarkAttachment)?c.queryHalf:c.size;if(!room.detached.has(c.id)&&Math.abs(c.p[0]-point.x)<radius+reach[0]&&Math.abs(c.p[1]-point.y)<radius+reach[1]&&Math.abs(c.p[2]-point.z)<radius+reach[2])out.push(c);}
 });
 return out;
}
export function buildingsAlong(room, a, b, pad){
 const out = [];
 room.buildingBounds.forEach((bb, i) => {
  const lo = [Math.min(a.x, b.x) - pad, Math.min(a.y, b.y) - pad, Math.min(a.z, b.z) - pad], hi = [Math.max(a.x, b.x) + pad, Math.max(a.y, b.y) + pad, Math.max(a.z, b.z) + pad];
  if(lo[0] <= bb[3] && hi[0] >= bb[0] && lo[1] <= bb[4] && hi[1] >= bb[1] && lo[2] <= bb[5] && hi[2] >= bb[2]) out.push(i);
 });
 return out;
}

// ---- detachment / chunks ------------------------------------------------------------
export function breakCells(room, requested, kick = v(0, 0, 0), hint = {}){
 const hits = [...new Set(requested)].filter(id => room.cellMap.has(id) && !room.detached.has(id));
 if(!hits.length) return [];
 const buildings = new Set(hits.map(id => room.cellMap.get(id).building)), prospective = new Set([...room.detached, ...hits]);
 const unsupported = [];
 for(const b of buildings) unsupported.push(...unsupportedCells(room.cellsByBuilding[b], prospective));
 // A column crushed by load or a direct hit without momentum becomes rubble at once, so it can
 // never keep propping up the storeys above. Kicked bays fly off as single pieces; a severed
 // section falls as one structural island per building so towers topple and pancake.
 // Failed foundations detach as real bodies as well; nothing vanishes on failure.
 const crush = !!hint.crush;
 let batches = hits.map(id => [id]);
 const islands = new Map();
 for(const id of unsupported){ const c = room.cellMap.get(id); if(!islands.has(c.building)) islands.set(c.building, []); islands.get(c.building).push(id); }
 for(const [building, ids] of islands){
  if(ids.length <= 3) batches.push(...ids.map(id => [id]));
  else if(ids.length <= 12){ const floors = new Map(); for(const id of ids){ const f = room.cellMap.get(id).floor; if(!floors.has(f)) floors.set(f, []); floors.get(f).push(id); } batches.push(...floors.values()); }
  else batches.push(ids);
  room.dirtyBuildings.add(building);
 }
 if(room.debris.size + batches.length > C.MAX_ACTIVE_CHUNKS){
  // Coarse fracture LOD: everything from one building becomes a single island.
  const coarse = new Map();
  for(const id of [...hits, ...unsupported]){ const c = room.cellMap.get(id); if(!coarse.has(c.building)) coarse.set(c.building, []); coarse.get(c.building).push(id); }
  batches = [...coarse.values()];
  if(room.debris.size + batches.length > C.MAX_ACTIVE_CHUNKS){
   // No body slot: structure stays intact until capacity returns.
   if(crush){ const first = room.cellMap.get(hits[0]); room.event({type:'impact', p:first.p, power:.4, material:first.material}); }
   return [];
  }
 }
 const created = [];
 if(hint.shatter)for(const id of hits){const c=room.cellMap.get(id);c.skin.hp=0;c.skin.glass=0;c.skin.facade=0;c.skin.facadeHp.fill(0);c.lastHitBy=hint.by||0;room.skinEvents.push([id,0,0]);}
 for(const ids of batches){
  let origin = v(); for(const id of ids) origin = add(origin, vec(room.cellMap.get(id).p)); origin = mul(origin, 1 / ids.length);
  const building = room.cellMap.get(ids[0]).building;
  for(const id of ids){ const c = room.cellMap.get(id); detachCellColliders(room, c); room.detached.add(id); room.handWorld?.setCell(id, c.p, undefined, true); room.pendingFailures.delete(id); room.dirtyBuildings.add(c.building); }
  const body = room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x, origin.y, origin.z).setLinearDamping(.1).setAngularDamping(ids.length > 12 ? .25 : .45).setCcdEnabled(true));
  const id = room.nextDebris++, entity = {id, body, cells:ids, origin:arr(origin), born:room.time, radius:0, material:room.cellMap.get(ids[0]).material, building};
  for(const cid of ids){ const c = room.cellMap.get(cid); c.entity = id; attachCellColliders(room, c, body, sub(vec(c.p), origin)); entity.radius = Math.max(entity.radius, dist(vec(c.p), origin) + c.size[0] * .7); }
  const big = ids.length > 12;
  body.setLinvel(add(mul(kick, big ? .12 : ids.length > 1 ? .34 : 1), v(0, big ? 0 : 1, 0)), true);
  if(big) topple(room, entity, building, hint.at || origin, kick);
  else body.setAngvel(v(kick.z * .035, 0, -kick.x * .035), true);
  room.debris.set(id, entity); room.event(debrisMeta(entity)); created.push(entity);
  if(big || ids.length >= 9) announceCollapse(room, building, ids.length);
 }
 const first = room.cellMap.get(hits[0]);
 room.event({type:'impact', p:first.p, power:Math.min(1, batches.length / 10 + .3), material:first.material});
 room.destroyedThisRound += hits.length + unsupported.length;
 return created;
}
// Tip a severed island about the far edge of whatever still stands beneath it.
function topple(room, entity, building, at, kick){
 const stubs = room.cellsByBuilding[building].filter(c => c.ground && !room.detached.has(c.id));
 let hinge;
 if(stubs.length){ hinge = v(); for(const c of stubs) hinge = add(hinge, vec(c.p)); hinge = mul(hinge, 1 / stubs.length); }
 const origin = vec(entity.origin);
 let away = hinge ? v(origin.x - hinge.x, 0, origin.z - hinge.z) : v(origin.x - at.x, 0, origin.z - at.z);
 if(len(away) < .5) away = v(kick.x, 0, kick.z);
 if(len(away) < .1) return;
 away = norm(away);
 const axis = v(-away.z, 0, away.x), omega = mul(axis, .28);
 entity.body.setAngvel(omega, true);
 const lever = v(0, origin.y - (hinge ? hinge.y : 0), 0);
 entity.body.setLinvel(add(entity.body.linvel(), v(omega.y * lever.z - omega.z * lever.y, 0, omega.x * lever.y - omega.y * lever.x)), true);
}
function announceCollapse(room, building, count){
 const b = room.env.buildings[building], total = room.cellsByBuilding[building].length;
 const gone = room.cellsByBuilding[building].filter(c => room.detached.has(c.id)).length;
 if(room.collapsed.has(building) || (gone < total * .45 && count < 40)) return;
 room.collapsed.add(building); room.towersDown++;
 room.event({type:'towerdown', building, name:b.name, cells:count, p:[b.x, 10, b.z]});
}
export function debrisMeta(e){ return {type:'debris', id:e.id, cells:e.cells, origin:e.origin, material:e.material, settled:!!e.settled, ...bodyPose(e.body)}; }

// Secondary fracture: a fast island breaks into floor bands (budget permitting), a band into bays.
export function splitDebris(room, id){
 const e = room.debris.get(id); if(!e || e.cells.length < 2) return;
 const available = C.MAX_ACTIVE_CHUNKS - room.debris.size + 1; if(available < 2) return;
 let groups;
 if(e.cells.length <= 9 && available >= e.cells.length) groups = e.cells.map(c => [c]);
 else {
  const floors = new Map();
  for(const cid of e.cells){ const f = room.cellMap.get(cid).floor; if(!floors.has(f)) floors.set(f, []); floors.get(f).push(cid); }
  const levels = [...floors.keys()].sort((a, b) => a - b), pieces = Math.max(2, Math.min(levels.length, available, 12)), per = Math.ceil(levels.length / pieces);
  groups = []; for(let i = 0; i < levels.length; i += per) groups.push(levels.slice(i, i + per).flatMap(f => floors.get(f)));
 }
 if(groups.length < 2) return;
 const state = bodyPose(e.body), velocity = e.body.linvel(), omega = e.body.angvel(), q = e.body.rotation();
 const rotate = p => { const u = v(q.x, q.y, q.z), uv = v(u.y * p.z - u.z * p.y, u.z * p.x - u.x * p.z, u.x * p.y - u.y * p.x), uuv = v(u.y * uv.z - u.z * uv.y, u.z * uv.x - u.x * uv.z, u.x * uv.y - u.y * uv.x); return add(p, add(mul(uv, 2 * q.w), mul(uuv, 2))); };
 removeBody(room, e.body); room.debris.delete(id); room.event({type:'remove', id});
 for(const ids of groups){
  let local = v(); for(const cid of ids) local = add(local, sub(vec(room.cellMap.get(cid).p), vec(e.origin))); local = mul(local, 1 / ids.length);
  const off = rotate(local), pos = add(vec(state.p), off);
  const body = room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(q).setLinearDamping(.12).setAngularDamping(.6).setCcdEnabled(true));
  const newId = room.nextDebris++, part = {id:newId, body, cells:ids, origin:arr(add(vec(e.origin), local)), born:room.time, radius:0, material:e.material, building:e.building};
  for(const cid of ids){ const c = room.cellMap.get(cid); c.entity = newId; attachCellColliders(room, c, body, sub(vec(c.p), vec(part.origin))); part.radius = Math.max(part.radius, dist(vec(c.p), vec(part.origin)) + c.size[0] * .7); }
  const tangent = v(omega.y * off.z - omega.z * off.y, omega.z * off.x - omega.x * off.z, omega.x * off.y - omega.y * off.x);
  body.setLinvel(add(add(velocity, tangent), mul(norm(off), .7)), true); body.setAngvel(omega, true);
  room.debris.set(newId, part); room.event(debrisMeta(part));
 }
 room.event({type:'impact', p:state.p, power:Math.min(1.4, .3 + groups.length * .08), material:e.material});
}
// Hard landings roughen and slow the piece; its modeled components remain visible.
export function crumble(room,id){
 const e=room.debris.get(id);if(!e || e.fractured)return;
 e.fractured=true;e.body.setLinearDamping(.4);e.body.setAngularDamping(1.1);
 room.event({type:'impact',p:bodyPose(e.body).p,power:.45,material:e.material});
}
export function settleDebris(room,id){
 const e=room.debris.get(id);if(!e || !e.body.isSleeping())return false;
 e.body.setBodyType(RAPIER.RigidBodyType.Fixed,true);e.settled=true;
 const pose=bodyPose(e.body);for(const cid of e.cells){const c=room.cellMap.get(cid);room.handWorld?.setDebris(cid,plus(rotate(minus(c.p,e.origin),pose.q),pose.p),pose.q);}
 room.debris.delete(id);room.settled.set(id,e);room.event({...debrisMeta(e),type:'settled'});return true;
}

// ---- per-tick collapse processing ---------------------------------------------------
export function scheduleFailures(room){
 if(!room.dirtyBuildings.size) return;
 for(const b of room.dirtyBuildings){
  const cells = room.cellsByBuilding[b];
  const overloaded = overloadedCells(cells, room.detached, c => c.skin.hp / c.skin.maxHp);
  for(const id of overloaded) if(!room.pendingFailures.has(id)) room.pendingFailures.set(id, room.time + C.COLLAPSE_DELAY + Math.random() * C.COLLAPSE_JITTER);
  // Frame destroyed outright by hits.
  for(const c of cells) if(!room.detached.has(c.id) && c.skin.hp <= 0 && !room.pendingFailures.has(c.id)) room.pendingFailures.set(c.id, room.time);
  if(overloaded.length && room.time - (room.lastCreak.get(b) || -10) > .7){
   room.lastCreak.set(b, room.time); const c = room.cellMap.get(overloaded[0]);
   room.event({type:'creak', building:b, p:c.p, n:overloaded.length, material:c.material});
  }
 }
 room.dirtyBuildings.clear();
}
export function processFailures(room){
 if(!room.pendingFailures.size) return;
 const due = [];
 for(const [id, at] of room.pendingFailures) if(room.time >= at) due.push(id);
 if(!due.length) return;
 for(const id of due) room.pendingFailures.delete(id);
 const c = room.cellMap.get(due[0]);
 breakCells(room, due, v(0, 0, 0), {at:vec(c.p), crush:true});
}
export function flushSkinEvents(room){
 if(!room.skinEvents.length) return;
 const merged = new Map(); for(const s of room.skinEvents) merged.set(s[0], s);
 room.event({type:'skin', cells:[...merged.values()]}); room.skinEvents = [];
}
export function damagedSkins(room){
 const out = [];
 for(const c of room.cells){ const init = initialSkin(c); if(c.skin.glass !== init.glass || c.skin.facade !== init.facade) out.push([c.id, c.skin.glass, c.skin.facade]); }
 return out;
}
export function updateDebris(room, hits, fractures, crumbles){
 // One secondary fracture per tick keeps collider churn bounded during a cascade.
 for(const id of [...fractures].slice(0, 1)) splitDebris(room, id);
 for(const id of crumbles) crumble(room, id);
 // Debris retains its physics and lifetime, but never damages the colossus.
 for(const [id, e] of room.debris){
  const pos = e.body.translation();
  if(pos.y < -30){ removeBody(room, e.body); room.debris.delete(id); room.event({type:'remove', id}); continue; }
  if(room.time-e.born>2 && e.body.isSleeping())settleDebris(room,id);
 }
}
export function wallOpen(c, side){ return !wallSolid(c.material, c.skin.glass, c.skin.facade, side); }
export {facingSide};
