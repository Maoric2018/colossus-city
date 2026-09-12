// Instanced destructible towers. Every bay is one frame instance (slab + columns) plus, per
// exterior side, a facade panel and a glass pane batched by material. Broken layers collapse
// their instance matrix to zero; moving bays reuse the same instances with a new transform.
// Core batches plus the instanced architectural kit; count is independent of city size.
import * as T from 'three';
import {skinKey} from '../render/building-skin.js';
import {Components} from './components.js';
import {BuildingShadows} from '../render/building-shadows.js';
import {WORLD_STYLE_BY_ID} from '../../shared/city/world-landmarks.js';
import {partialInstanceUpdates,commitInstances} from '../render/instances.js';
import {mergeParts} from '../art.js';
import {MATERIALS, sideBit} from '../../shared/city/materials.js';
import {surface, glassMaterial} from '../render/quality.js';
import {facadeMaps, roofTexture} from './textures.js';
const temp = new T.Object3D(), matrix = new T.Matrix4(), local = new T.Matrix4(), zero = new T.Matrix4().makeScale(0, 0, 0);
const sphere=new T.Sphere(),projection=new T.Matrix4(),eyePosition=new T.Vector3();
const white=new T.Color(0xffffff),wtcGlass=new T.Color(0x718087);
export {skinKey} from '../render/building-skin.js';
const wallLocal = [0, 1, 2, 3].map(side => { const a = side * Math.PI / 2; return new T.Matrix4().compose(new T.Vector3(Math.sin(a) * .5, 0, -Math.cos(a) * .5), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -a), new T.Vector3(1, 1, 1)); });
// Masonry window panes sit just outside the facade box (which spans ±.011 around the wall plane).
const paneLocal = [0, 1, 2, 3].map(side => { const a = side * Math.PI / 2; return new T.Matrix4().compose(new T.Vector3(Math.sin(a) * .514, 0, -Math.cos(a) * .514), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -a), new T.Vector3(1, 1, 1)); });
function colored(geometry, color){ const c = new T.Color(color), n = geometry.attributes.position.count, colors = new Float32Array(n * 3); for(let i = 0; i < n; i++) c.toArray(colors, i * 3); geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); return geometry; }
export class Buildings {
 constructor(root, cells, tier, {concrete,resources=null,components=null,deferComponents=false}){
  this.root = root; this.cells = cells; this.tier = tier; this.entries = new Map(); this.dirty = new Set(); this.batches = [];this.slots={frame:[],empire:[],roof:[],walls:{}};this.selectionDirty=true;this.lastViews=[];
  // Columns are open-ended prisms (no caps): 8 triangles each instead of 12, times 2,500 bays.
  const column = () => new T.CylinderGeometry(.039, .039, .925, 4, 1, true).rotateY(Math.PI / 4);
  const frameGeometry = resources?.frame.geometry || mergeParts([
   [colored(new T.BoxGeometry(1, .075, 1), 0xcfcac0), [0, .462, 0]],
   ...[-1, 1].flatMap(x => [-1, 1].map(z => [colored(column(), 0x2e363c), [x * .472, -.012, z * .472]]))
  ]);
  this.frame = this.batch(frameGeometry, resources?.frame.material || surface(tier, {map:concrete, vertexColors:true, roughness:.85}), cells.length);
  this.empireFrame=this.batch(frameGeometry,resources?.empireFrame.material||surface(tier,{map:concrete,color:0xe2ded1,roughness:.8}),cells.filter(c=>c.architecture==='empire').length);
  const roofGeometry = resources?.roof.geometry || mergeParts([[new T.BoxGeometry(1, .05, .04), [0, .525, -.48]], [new T.BoxGeometry(1, .05, .04), [0, .525, .48]], [new T.BoxGeometry(.04, .05, 1), [-.48, .525, 0]], [new T.BoxGeometry(.04, .05, 1), [.48, .525, 0]], [new T.BoxGeometry(.96, .012, .96), [0, .505, 0]]]);
  this.roof = this.batch(roofGeometry, resources?.roof.material || surface(tier, {map:roofTexture(tier.textureSize), color:0xffffff, roughness:1}), cells.filter(c => c.roof).length);
  this.facade = {}; this.glass = {}; this.wallCount = {}; this.paneCount = {};
  const size = tier.textureSize;
  for(const name of [...Object.keys(MATERIALS),'empire','chrysler','hudson30','vanderbilt','worldGlass']){
   // Keep one empty world-glass resource on the home owner. Streamed districts
   // share its texture/material instead of allocating a new set on every revisit.
   const walls = cells.reduce((s, c) => s + (skinKey(c) === name ? c.walls.filter(Boolean).length : 0), 0); if(!walls&&(name!=='worldGlass'||resources)) continue;
   const maps = resources?.glass[name]?null:facadeMaps(name, size), m = MATERIALS[['empire','chrysler'].includes(name)?'stone':['hudson30','vanderbilt','worldGlass'].includes(name)?'glass':name];
   this.wallCount[name] = 0; this.paneCount[name] = 0;
   if(m.facadeHP > 0) this.facade[name] = this.batch(resources?.facade[name]?.geometry||new T.BoxGeometry(1, .925, .022), resources?.facade[name]?.material||surface(tier, {map:maps.map, color:0xffffff, roughness:.9}), walls);
   this.glass[name] = this.batch(resources?.glass[name]?.geometry||new T.PlaneGeometry(1, .925), resources?.glass[name]?.material||glassMaterial(tier, {map:maps.panes, emissiveMap:maps.emissive, emissive:0xffd9a0, emissiveIntensity:m.lit * (name==='worldGlass'?.08:.45), color:name==='worldGlass'?0xffffff:['hudson30','vanderbilt'].includes(name)?0xe4f0f4:m.facadeHP > 0 ? 0xd6ecf6 : m.tint, alphaTest:.02,...(m.facadeHP>0?{transparent:false,opacity:1,depthWrite:true,metalness:.2,roughness:.34,envMapIntensity:.6}:{}),...(['hudson30','vanderbilt','worldGlass'].includes(name)?{transparent:false,opacity:1,depthWrite:true,side:T.DoubleSide,metalness:.5,roughness:.24,envMapIntensity:.9}: {})}), walls);
   this.glass[name].castShadow = false;
  }

  cells.forEach((c, i) => {
   const e = {cell:c,index:i,frameIndex:-1,empireIndex:-1,walls:[],size:new T.Vector3(...c.size),roofIndex:-1,radius:Math.hypot(...(c.queryHalf||c.size.map(v=>v/2)))+1,revision:0, glassMask:0, facadeMask:0, hidden:false, p:new T.Vector3(...c.p), q:new T.Quaternion()};
   e.tint=new T.Color().setHSL(((c.variant%29)-14)*.001+.08,.06+(c.variant%5)*.015,.79+(c.variant%7)*.025);
   const worldStyle=WORLD_STYLE_BY_ID.get(c.architecture);if(worldStyle){e.tint.setHex(worldStyle.tint);e.glassTint=new T.Color(worldStyle.tint);}
   c.walls.forEach((exterior, side) => { if(exterior) e.walls.push({side,index:-1,owner:e}); });
   this.entries.set(c.id, e);
  });
  for(const mesh of this.batches)mesh.count=0;
  this.components=components||new Components(this,cells,tier,concrete);if(components&&!deferComponents)components.register(this,cells);
  if(deferComponents)for(const e of this.entries.values())e.pending=true;
  for(const c of cells) this.setCell(c.id, null, null, false);
 }
 batch(geometry, material, count){
  const b = new T.InstancedMesh(geometry, material, Math.max(1, count)); b.count=count; b.instanceMatrix.setUsage(T.DynamicDrawUsage); b.frustumCulled = false; b.castShadow = true; b.receiveShadow = true;
  this.root.add(b); this.batches.push(b); return partialInstanceUpdates(b,this.dirty);
 }
 setSkin(id, glassMask, facadeMask){ const e = this.entries.get(id); if(!e) return; if(e.glassMask===glassMask&&e.facadeMask===facadeMask)return;e.glassMask = glassMask; e.facadeMask = facadeMask;e.skinDirty=true; this.setCell(id, null, null, e.hidden); }
 // p/q null keeps the stored transform. Zero-scale matrices hide layers cheaply.
 setCell(id, p, q, hidden){
  const e = this.entries.get(id); if(!e) return;
  const c = this.cells[e.index];
  const moved=(p&&!e.p.equals(p))||(q&&!e.q.equals(q));
  if(!moved&&e.hidden===hidden&&!e.skinDirty&&e.initialized)return;
  if(moved||!e.initialized)e.revision++;e.initialized=true;e.skinDirty=false;this.selectionDirty=true;
  if(p) e.p.copy(p); if(q) e.q.copy(q); e.hidden = hidden;
  e.fine?.update?.();
  this.writeCore(c,e);
  this.shadowView?.write(e);
  this.components?.setCell(c,e);
  this.writeAttachments?.(e);
 }
 // Compact only render slots. Cell identities, collision geometry and attachments
 // retain their world transforms even while a bay is behind the headset.
 select(camera,far=Infinity,shadows=this.tier.shadows){
  const shadowChanged=this.shadowView?.enabled!==shadows;
  if(shadows&&!this.shadowView)this.shadowView=new BuildingShadows(this);
  if(this.shadowView)this.shadowView.enabled=shadows;
  const eyes=camera.cameras?.length?camera.cameras:[camera];let changed=this.selectionDirty||this.eyeCount!==eyes.length||this.lastFar!==far||this.lastShadows!==shadows;
  this.frustums||=[];
  for(let i=0;i<eyes.length;i++){
   projection.multiplyMatrices(eyes[i].projectionMatrix,eyes[i].matrixWorldInverse);
   const last=this.lastViews[i]||=new Float64Array(16);for(let k=0;k<16;k++)if(last[k]!==projection.elements[k]){changed=true;last[k]=projection.elements[k];}
   const f=this.frustums[i]||=new T.Frustum();f.setFromProjectionMatrix(projection);for(const plane of f.planes)plane.constant+=2;
  }
  if(!changed)return;this.selectionDirty=false;this.eyeCount=eyes.length;this.lastFar=far;this.lastShadows=shadows;
  eyePosition.setFromMatrixPosition(eyes[0].matrixWorld);
  for(const e of this.entries.values()){
   sphere.center.copy(e.p);sphere.radius=e.radius;const near=e.p.distanceToSquared(eyePosition)<(far+e.radius)**2;e.renderNear=near;
   e.inView=false;if(near)for(let i=0;i<eyes.length;i++)if(this.frustums[i].intersectsSphere(sphere)){e.inView=true;break;}
   if(this.shadowView&&(e.shadowNear!==near||shadowChanged)){e.shadowNear=near;this.shadowView.write(e);}
   const rendered=!e.hidden&&near&&e.inView;
   if(rendered!==e.rendered){e.rendered=rendered;if(rendered)this.show(e);else this.hide(e);}
   this.writeAttachments?.(e);
  }
 }
 show(e){
  const c=e.cell,kind=c.architecture==='empire'?'empire':'frame',field=kind==='empire'?'empireIndex':'frameIndex';
  e[field]=this.slots[kind].length;this.slots[kind].push(e);(kind==='empire'?this.empireFrame:this.frame).count=this.slots[kind].length;
  if(c.roof){e.roofIndex=this.slots.roof.length;this.slots.roof.push(e);this.roof.count=this.slots.roof.length;}
  const name=skinKey(c),walls=this.slots.walls[name]||=[];
  for(const wall of e.walls){wall.index=walls.length;walls.push(wall);}
  if(this.glass[name])this.glass[name].count=walls.length;if(this.facade[name])this.facade[name].count=walls.length;
  this.writeCore(c,e);
 }
 removeSlot(slots,item,field,mesh){
  const index=item[field];if(index<0)return;const last=slots.pop();
  if(last!==item){slots[index]=last;last[field]=index;this.writeCore(last.cell,last);}
  item[field]=-1;mesh.count=slots.length;
 }
 hide(e){
  this.removeSlot(this.slots.frame,e,'frameIndex',this.frame);this.removeSlot(this.slots.empire,e,'empireIndex',this.empireFrame);this.removeSlot(this.slots.roof,e,'roofIndex',this.roof);
  const name=skinKey(e.cell),slots=this.slots.walls[name];if(!slots)return;
  for(const wall of e.walls){if(wall.index<0)continue;const index=wall.index,last=slots.pop();if(last!==wall){slots[index]=last;last.index=index;this.writeCore(last.owner.cell,last.owner);}wall.index=-1;}
  if(this.glass[name])this.glass[name].count=slots.length;if(this.facade[name])this.facade[name].count=slots.length;
 }

 writeCore(c,e){
  temp.position.copy(e.p); temp.quaternion.copy(e.q); temp.scale.copy(e.size); temp.updateMatrix();
  const hidden=e.hidden,m = hidden ? zero : temp.matrix,core=e.fine?zero:m,frameIndex=e.frameIndex??e.index;
  if(frameIndex>=0){this.frame.setColorAt(frameIndex,e.tint);this.frame.setMatrixAt(frameIndex, e.empireIndex>=0?zero:core); this.dirty.add(this.frame);}
  if(e.empireIndex>=0){this.empireFrame.setMatrixAt(e.empireIndex,core);this.dirty.add(this.empireFrame);}
  if(e.roofIndex >= 0){ this.roof.setMatrixAt(e.roofIndex, e.fine?zero:m); this.dirty.add(this.roof); }
  const facade = this.facade[skinKey(c)], glass = this.glass[skinKey(c)];
  for(const w of e.walls){
   if(w.index<0)continue;
   const bit = sideBit(w.side);
   if(glass)glass.setColorAt(w.index,e.glassTint??(c.architecture==='wtc'?wtcGlass:white));
   if(facade){ facade.setColorAt(w.index,e.tint);matrix.multiplyMatrices(core, wallLocal[w.side]); facade.setMatrixAt(w.index, (hidden || !(e.facadeMask & bit)) ? zero : matrix); this.dirty.add(facade); }
   if(glass){ matrix.multiplyMatrices(core, facade ? paneLocal[w.side] : wallLocal[w.side]); glass.setMatrixAt(w.index, (hidden || !(e.glassMask & bit)) ? zero : matrix); this.dirty.add(glass); }
  }
 }
 commit(){for(const mesh of this.batches)mesh.visible=mesh.count>0&&!mesh.userData.batchedSource;commitInstances(this.dirty);this.shadowView?.commit();}
 // Current transform of a bay (shared object, do not mutate).
 pose(id){ return this.entries.get(id); }
}
