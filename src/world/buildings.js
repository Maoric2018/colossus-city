// Instanced destructible towers. Every bay is one frame instance (slab + columns) plus, per
// exterior side, a facade panel and a glass pane batched by material. Broken layers collapse
// their instance matrix to zero; moving bays reuse the same instances with a new transform.
// Draw calls: 1 frame + 3 facades + 4 glass + 1 roof, regardless of city size.
import * as T from 'three';
import {mergeParts} from '../art.js';
import {MATERIALS, sideBit} from '../../shared/city/materials.js';
import {surface, glassMaterial} from '../render/quality.js';
import {facadeMaps, roofTexture} from './textures.js';
const temp = new T.Object3D(), matrix = new T.Matrix4(), local = new T.Matrix4(), zero = new T.Matrix4().makeScale(0, 0, 0);
const wallLocal = [0, 1, 2, 3].map(side => { const a = side * Math.PI / 2; return new T.Matrix4().compose(new T.Vector3(Math.sin(a) * .5, 0, -Math.cos(a) * .5), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -a), new T.Vector3(1, 1, 1)); });
// Masonry window panes sit just outside the facade box (which spans ±.011 around the wall plane).
const paneLocal = [0, 1, 2, 3].map(side => { const a = side * Math.PI / 2; return new T.Matrix4().compose(new T.Vector3(Math.sin(a) * .514, 0, -Math.cos(a) * .514), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -a), new T.Vector3(1, 1, 1)); });
function colored(geometry, color){ const c = new T.Color(color), n = geometry.attributes.position.count, colors = new Float32Array(n * 3); for(let i = 0; i < n; i++) c.toArray(colors, i * 3); geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); return geometry; }
export class Buildings {
 constructor(root, cells, tier, {concrete}){
  this.root = root; this.cells = cells; this.tier = tier; this.entries = new Map(); this.dirty = new Set(); this.batches = [];
  // Columns are open-ended prisms (no caps): 8 triangles each instead of 12, times 2,500 bays.
  const column = () => new T.CylinderGeometry(.039, .039, .925, 4, 1, true).rotateY(Math.PI / 4);
  const frameGeometry = mergeParts([
   [colored(new T.BoxGeometry(1, .075, 1), 0xcfcac0), [0, .462, 0]],
   ...[-1, 1].flatMap(x => [-1, 1].map(z => [colored(column(), 0x2e363c), [x * .472, -.012, z * .472]]))
  ]);
  this.frame = this.batch(frameGeometry, surface(tier, {map:concrete, vertexColors:true, roughness:.85}), cells.length);
  const roofGeometry = mergeParts([[new T.BoxGeometry(1, .05, .04), [0, .525, -.48]], [new T.BoxGeometry(1, .05, .04), [0, .525, .48]], [new T.BoxGeometry(.04, .05, 1), [-.48, .525, 0]], [new T.BoxGeometry(.04, .05, 1), [.48, .525, 0]], [new T.BoxGeometry(.96, .012, .96), [0, .505, 0]]]);
  this.roof = this.batch(roofGeometry, surface(tier, {map:roofTexture(), color:0x8a8884, roughness:1}), cells.filter(c => c.roof).length);
  this.facade = {}; this.glass = {}; this.wallCount = {}; this.paneCount = {};
  const size = tier.textureSize;
  for(const name of Object.keys(MATERIALS)){
   const walls = cells.reduce((s, c) => s + (c.material === name ? c.walls.filter(Boolean).length : 0), 0); if(!walls) continue;
   const maps = facadeMaps(name, size), m = MATERIALS[name];
   this.wallCount[name] = 0; this.paneCount[name] = 0;
   if(m.facadeHP > 0) this.facade[name] = this.batch(new T.BoxGeometry(1, .925, .022), surface(tier, {map:maps.map, color:m.tint, roughness:.9}), walls);
   this.glass[name] = this.batch(new T.PlaneGeometry(1, .925), glassMaterial(tier, {map:maps.panes, emissiveMap:maps.emissive, emissive:0xffd9a0, emissiveIntensity:m.lit * .45, color:m.facadeHP > 0 ? 0xd6ecf6 : m.tint, alphaTest:.02}), walls);
   this.glass[name].castShadow = false;
  }
  let roofIndex = 0;
  cells.forEach((c, i) => {
   const e = {index:i, walls:[], size:new T.Vector3(...c.size), roofIndex:c.roof ? roofIndex++ : -1, glassMask:0, facadeMask:0, hidden:false, p:new T.Vector3(...c.p), q:new T.Quaternion()};
   c.walls.forEach((exterior, side) => { if(exterior) e.walls.push({side, index:this.wallCount[c.material]++}); });
   this.entries.set(c.id, e);
  });
  for(const c of cells) this.setCell(c.id, null, null, false);
 }
 batch(geometry, material, count){
  const b = new T.InstancedMesh(geometry, material, Math.max(1, count)); b.instanceMatrix.setUsage(T.DynamicDrawUsage); b.frustumCulled = false; b.castShadow = true; b.receiveShadow = true;
  this.root.add(b); this.batches.push(b); this.dirty.add(b); return b;
 }
 setSkin(id, glassMask, facadeMask){ const e = this.entries.get(id); if(!e) return; e.glassMask = glassMask; e.facadeMask = facadeMask; this.setCell(id, null, null, e.hidden); }
 // p/q null keeps the stored transform. Zero-scale matrices hide layers cheaply.
 setCell(id, p, q, hidden){
  const e = this.entries.get(id); if(!e) return;
  const c = this.cells[e.index];
  if(p) e.p.copy(p); if(q) e.q.copy(q); e.hidden = hidden;
  temp.position.copy(e.p); temp.quaternion.copy(e.q); temp.scale.copy(e.size); temp.updateMatrix();
  const m = hidden ? zero : temp.matrix;
  this.frame.setMatrixAt(e.index, m); this.dirty.add(this.frame);
  if(e.roofIndex >= 0){ this.roof.setMatrixAt(e.roofIndex, m); this.dirty.add(this.roof); }
  const facade = this.facade[c.material], glass = this.glass[c.material];
  for(const w of e.walls){
   const bit = sideBit(w.side);
   if(facade){ matrix.multiplyMatrices(m, wallLocal[w.side]); facade.setMatrixAt(w.index, (hidden || !(e.facadeMask & bit)) ? zero : matrix); this.dirty.add(facade); }
   if(glass){ matrix.multiplyMatrices(m, facade ? paneLocal[w.side] : wallLocal[w.side]); glass.setMatrixAt(w.index, (hidden || !(e.glassMask & bit)) ? zero : matrix); this.dirty.add(glass); }
  }
 }
 commit(){ for(const b of this.dirty) b.instanceMatrix.needsUpdate = true; this.dirty.clear(); }
 // Current transform of a bay (shared object, do not mutate).
 pose(id){ return this.entries.get(id); }
}
