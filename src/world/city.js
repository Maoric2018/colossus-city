// CityView: the rendered district. Owns sky, lights, ground, the instanced towers, moving
// debris poses, skin state, cosmetic rubble and the spatial queries (camera collision, aim
// rays, prediction boxes) that the rest of the client needs. No gameplay authority lives here.
import {StreamedBlocks} from './streaming.js';
import {staticProps} from '../../shared/props.js';
import {HandWorld} from '../../shared/hand-world.js';
import {TIERS} from '../render/quality.js';
import {installDistanceFog} from '../render/distance-fog.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {generateCells, cellColliders, initialSkin} from '../../shared/environment.js';
import {MATERIALS, sideBit} from '../../shared/city/materials.js';
import {rayAABB} from '../../shared/math.js';
import {Buildings} from './buildings.js';
import {buildGround} from './ground.js';
import {Rubble} from './rubble.js';
import {CarsView} from './cars.js';
import {Fragments} from './fragments.js';
import {FineBuildings} from './fine-buildings.js';
const skyVertex = `varying vec3 vDir; void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const skyFragment = `varying vec3 vDir;uniform vec3 topColor;uniform vec3 horizon;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(horizon,topColor,pow(h,.42));vec3 sun=normalize(vec3(-.8,.22,-.65));float s=max(dot(d,sun),0.);c+=vec3(1.,.51,.22)*pow(s,18.)*.37*smoothstep(0.,.15,h);c+=vec3(1.,.82,.48)*smoothstep(.9986,.9995,s)*2.;gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
const tp = new T.Vector3(), tq = new T.Quaternion(), tinv = new T.Quaternion(), to = new T.Vector3(), td = new T.Vector3(), tc = new T.Vector3(), th = new T.Vector3(), tPos = new T.Vector3(), tRot = new T.Quaternion();
export class CityView {
 constructor(scene, env, {tier = TIERS.low, quest = false, parent = null} = {}){
  this.parent=parent;this.scene = scene; this.env = env; this.tier = tier; this.quest = quest; this.root = new T.Group(); scene.add(this.root);
  this.cells = generateCells(env); this.byId = new Map(this.cells.map(c => [c.id, c])); this.moving = new Map(); this.detached = new Set(); this.attachments = new Map(); this.assetCells = new Map(); this.batches = [];
  this.handWorld = new HandWorld(env,this.cells); this.props = staticProps(env);
  this.skins = new Map(this.cells.map(c => [c.id, initialSkin(c)])); this.colliderCache = new Map(this.cells.map(c => [c.id, cellColliders(c)]));
  for(const c of this.cells){c.queryHalf=c.size.map(v=>v/2);for(const a of this.colliderCache.get(c.id))for(let k=0;k<3;k++)c.queryHalf[k]=Math.max(c.queryHalf[k],Math.abs(a[k])+a[k+3]);}
  this.cellsByBuilding = env.buildings.map(() => []); this.bounds = env.buildings.map(() => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for(const c of this.cells){ this.cellsByBuilding[c.building].push(c); const b = this.bounds[c.building]; for(let k = 0; k < 3; k++){ b[k] = Math.min(b[k], c.p[k] - c.queryHalf[k]); b[k + 3] = Math.max(b[k + 3], c.p[k] + c.queryHalf[k]); } }
  this.loader = parent?.loader || new T.TextureLoader();
  const t = env.textures, tex = (url, repeat, srgb = true) => url ? this.texture(url, repeat, srgb) : null;
  this.textures = parent?.textures || {concrete:tex(t.concrete, 30), concreteNormal:tex(tier.normalMaps&&t.concreteNormal, 30, false), concreteRoughness:tex(!tier.lambert&&t.concreteRoughness, 30, false), asphalt:tex(t.asphalt, 38), asphaltNormal:tex(tier.normalMaps&&t.asphaltNormal, 38, false), asphaltRoughness:tex(!tier.lambert&&t.asphaltRoughness, 38, false)};
  if(!parent)this.makeSkyAndLights(); this.ground = parent ? {update(){}} : buildGround(this.root, env, tier, this.textures);
  this.buildings = new Buildings(this.root, this.cells, tier, {concrete:parent?.buildings.frame.material.map || this.texture(t.concrete, 1),resources:parent?.buildings,components:parent?.buildings.components});
  if(!parent&&env.infinite)this.buildings.components.radius=Math.max(this.buildings.components.radius,this.scene.fog.far+12);
  this.buildings.attachments=this.attachments;this.transforms = this.buildings.entries;
  this.fine=parent?.fine||new FineBuildings(this.root,tier);
  if(!parent)scene.onBeforeRender=(renderer,_scene,camera)=>{if(scene.userData.reuseCityVisibility)return;this.stream?.select(camera);const far=this.scene.fog.far||Infinity;this.buildings.select(camera,far,renderer.shadowMap.enabled);for(const v of this.stream?.views.values()||[])v.buildings.select(camera,far,renderer.shadowMap.enabled);this.buildings.components.select(camera);this.fine.select(camera);this.commit();};
  for(const c of this.cells){ const s = this.skins.get(c.id); this.buildings.setSkin(c.id, s.glass, s.facade); }
  this.buildings.commit(); this.rubble = parent?.rubble || new Rubble(scene, tier); this.fragments=new Fragments(this.root,this.cells,tier); this.cars=parent?{entries:new Map(),reset(){},*boxes(){}}:new CarsView(this.root,env,tier); this.ready = Promise.all([this.loadCustomAssets(),this.cars.ready]);
  if(!parent&&env.infinite)this.stream=new StreamedBlocks(this);
 }
 texture(url, repeat = 1, srgb = true){ const t = this.loader.load(url); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = this.quest ? 2 : 4; if(srgb) t.colorSpace = T.SRGBColorSpace; return t; }
 makeSkyAndLights(){
  const env = this.env;
  // Two neighboring blocks are detailed in every direction. Fade completely
  // inside that footprint, before unloaded buildings or simpler facades appear.
  if(env.infinite)installDistanceFog();
  const headset=this.quest||this.tier.name==='QUEST';
  this.scene.fog = env.infinite ? new T.Fog(env.sky.fog,headset?64:80,headset?120:130) : new T.FogExp2(env.sky.fog, env.sky.fogDensity);
  const sky = new T.Mesh(new T.SphereGeometry(800, 24, 12), new T.ShaderMaterial({vertexShader:skyVertex, fragmentShader:skyFragment, toneMapped:false, uniforms:{topColor:{value:new T.Color(env.infinite?0x6e8eaa:env.sky.top)}, horizon:{value:new T.Color(env.infinite?env.sky.fog:env.sky.horizon)}}, side:T.BackSide, depthWrite:false})); this.sky = sky; sky.renderOrder = -100; this.root.add(sky);
  // Neutral ground bounce: a green ground colour tints Lambert facades olive.
  this.root.add(new T.HemisphereLight(0xdcecf5, 0x8f887c, this.tier.lambert ? 1.7 : 1.4));
  const sun = new T.DirectionalLight(0xfff0dc, this.tier.lambert ? 2.9 : 3.1); sun.position.set(-120, 160, -90); sun.castShadow = this.tier.shadows;
  sun.shadow.mapSize.setScalar(this.tier.shadowSize || 1024); Object.assign(sun.shadow.camera, {left:-190, right:190, top:190, bottom:-190, near:1, far:420}); sun.shadow.bias = -.0004; sun.shadow.normalBias = .08; this.root.add(sun); this.sun = sun;
 }
 batch(g, m, n){ const b = new T.InstancedMesh(g, m, n); b.instanceMatrix.setUsage(T.DynamicDrawUsage); b.frustumCulled = false; b.castShadow = true; b.receiveShadow = true; this.root.add(b); this.batches.push(b); return b; }
 // ---- state from the server ----
 setFracture(id,parts){
  const c=this.byId.get(id);if(!c){this.stream?.setFracture(id,parts);return;}const s=this.skins.get(id);s.parts=[...parts];this.colliderCache.set(id,cellColliders(c,s));this.handWorld.setSkin(id,s);
  const pose=this.buildings.pose(id);this.fine.set(c,s,pose,this.buildings);pose.skinDirty=true;this.buildings.setCell(id,null,null,pose.hidden);this.buildings.components.selectionDirty=true;
 }
 addShards(meta){const c=this.byId.get(meta.cell);if(!c){this.stream?.addShards(meta);return;}this.fine.addShards(c,meta,this.buildings);}
 setSkin(id, glass, facade, fx = true){
  const c = this.byId.get(id), s = this.skins.get(id); if(!c){this.stream?.setSkin(id,glass,facade,fx);return;}
  const lostGlass = s.glass & ~glass, lostFacade = s.facade & ~facade;
  s.glass = glass; s.facade = facade; this.buildings.setSkin(id, glass, facade); this.colliderCache.set(id, cellColliders(c, s)); this.handWorld.setSkin(id,s);
  if(s.parts?.length){this.setFracture(id,s.parts);return;}
  if(!lostGlass && !lostFacade) return;
  const e = this.buildings.pose(id);
  for(let side = 0; side < 4; side++){
   const bit = sideBit(side); if(!(lostGlass & bit) && !(lostFacade & bit)) continue;
   const a = side * Math.PI / 2, p = [e.p.x + Math.sin(a) * c.size[0] * .5, e.p.y, e.p.z - Math.cos(a) * c.size[2] * .5], out = [Math.sin(a) * 3, 0, -Math.cos(a) * 3];
   if(lostGlass & bit)this.fragments.add(c,side,'glass',e,fx);
   if(lostFacade & bit)this.fragments.add(c,side,'facade',e,fx);
   if(!fx)continue;
   if(lostGlass & bit) this.rubble.burst('glass', p, this.quest ? 8 : 14, {velocity:out, spread:3, up:2});
   if(lostFacade & bit) this.rubble.burst(c.material, p, this.quest ? 10 : 18, {velocity:out, spread:3, up:3});
  }
 }
 hideCells(ids){ for(const id of ids){ if(!this.byId.has(id)){this.stream?.hideCells([id]);continue;}this.detached.add(id); this.handWorld.setCell(id,null,undefined,true); this.buildings.setCell(id, null, null, true); } }
 addDebris(e){ if(!this.byId.has(e.cells[0])){this.stream?.addDebris(e);return;}const entry = {cells:e.cells, origin:new T.Vector3(...e.origin), material:e.material, pos:new T.Vector3(), rot:new T.Quaternion(), radius:0}; for(const id of e.cells){ this.detached.add(id); this.handWorld.setCell(id,null,undefined,true); entry.radius = Math.max(entry.radius, new T.Vector3(...this.byId.get(id).p).distanceTo(entry.origin) + Math.hypot(...this.byId.get(id).queryHalf)); } this.moving.set(e.id, entry); this.poseDebris(e.id, e.p, e.q); entry.settled=!!e.settled;if(entry.settled)for(const id of e.cells){const pose=this.buildings.pose(id);this.handWorld.setDebris(id,pose.p.toArray(),pose.q.toArray());} }
 poseDebris(id, p, q){
  if(this.fine.poseShard(id,p,q))return;
  const e = this.moving.get(id); if(!e){this.stream?.poseDebris(id,p,q);return;}if(e.settled)return;
  e.pos.set(p[0], p[1], p[2]); e.rot.set(q[0], q[1], q[2], q[3]);
  for(const cId of e.cells){ const c = this.byId.get(cId); tp.set(c.p[0], c.p[1], c.p[2]).sub(e.origin).applyQuaternion(e.rot).add(e.pos); this.buildings.setCell(cId, tp, e.rot, false); }
 }
 removeDebris(id){ const e = this.moving.get(id); if(!e){this.stream?.removeDebris(id);return;} for(const c of e.cells) this.buildings.setCell(c, null, null, true); this.moving.delete(id); }
 // A bay (or a moving chunk) turned to rubble on the server.
 crumble(ev){
  if(!this.byId.has(ev.cells[0])){this.stream?.crumble(ev);return;}
  const e = ev.id ? this.moving.get(ev.id) : null;
  for(const cId of ev.cells){
   const c = this.byId.get(cId), pose = this.buildings.pose(cId); if(!c) continue;
   const p = pose ? [pose.p.x, pose.p.y, pose.p.z] : c.p;
   this.rubble.bay(ev.material || c.material, p, e ? [0, -2, 0] : [0, 0, 0], this.quest ? .6 : 1);
   this.detached.add(cId); this.handWorld.setCell(cId,null,undefined,true); this.buildings.setCell(cId, null, null, true);
  }
  if(ev.id) this.moving.delete(ev.id);
 }
 reset(){ this.stream?.reset();if(!this.parent)this.fine.reset();else this.fine.unregister(this.cells);this.cars.reset(); this.fragments.reset(); this.handWorld = new HandWorld(this.env,this.cells); this.moving.clear(); this.detached.clear(); for(const c of this.cells){ const s = initialSkin(c); this.skins.set(c.id, s); this.colliderCache.set(c.id, cellColliders(c)); this.buildings.pose(c.id).skinDirty=true;this.buildings.setSkin(c.id, s.glass, s.facade); this.buildings.setCell(c.id, tp.set(c.p[0], c.p[1], c.p[2]), tq.identity(), false); } this.commit(); }
 commit(){ this.buildings.commit();this.fine.commit();for(const v of this.stream?.views.values()||[])v.buildings.commit(); }
 getCell(id){return this.byId.get(id)||this.stream?.getCell(id);}
 dispose(){this.disposed=true;this.fine.unregister(this.cells);this.buildings.components.unregister(this.cells);this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const mesh of this.fragments.batches.values()){mesh.geometry.dispose();mesh.material.dispose();}this.root.removeFromParent();}
 *solidProps(){yield* this.handWorld.fixed;yield* this.cars.boxes();}
 update(dt){ this.ground.update(dt);if(!this.parent){this.rubble.update(dt);this.fine.update(dt);}this.fragments.update(dt);for(const v of this.stream?.views.values()||[])v.fragments.update(dt); }
 // ---- spatial queries ----
 rayBuilding(origin, direction, maxDistance){
  const out = [];
  this.bounds.forEach((b, i) => { tc.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); th.set((b[3] - b[0]) / 2, (b[4] - b[1]) / 2, (b[5] - b[2]) / 2); if(rayAABB(origin, direction, tc, th, maxDistance, 1) !== Infinity) out.push(i); });
  return out;
 }
 // Forward distance to the nearest structural piece. Static bays use world boxes directly;
 // moving chunks are tested in their local frame.
 rayDistance(origin, direction, maxDistance, padding = 0){
  let result = maxDistance;
  for(const bi of this.rayBuilding(origin, direction, result)) for(const c of this.cellsByBuilding[bi]){
   if(this.detached.has(c.id)) continue;
   tc.set(c.p[0], c.p[1], c.p[2]); th.set(...c.queryHalf);
   if(rayAABB(origin, direction, tc, th, result, padding) === Infinity) continue;
   for(const a of this.colliderCache.get(c.id)){ tc.set(c.p[0] + a[0], c.p[1] + a[1], c.p[2] + a[2]); th.set(a[3], a[4], a[5]); result = Math.min(result, rayAABB(origin, direction, tc, th, result, padding)); }
  }
  for(const e of this.moving.values()){
   tc.copy(e.pos); th.setScalar(e.radius); if(rayAABB(origin, direction, tc, th, result, padding) === Infinity) continue;
   for(const cId of e.cells){
    const c = this.byId.get(cId), pose = this.buildings.pose(cId); tinv.copy(pose.q).invert(); to.copy(origin).sub(pose.p).applyQuaternion(tinv); td.copy(direction).applyQuaternion(tinv);
    th.set(...c.queryHalf); tc.set(0, 0, 0); if(rayAABB(to, td, tc, th, result, padding) === Infinity) continue;
    for(const a of this.colliderCache.get(cId)){ tc.set(a[0], a[1], a[2]); th.set(a[3], a[4], a[5]); result = Math.min(result, rayAABB(to, td, tc, th, result, padding)); }
   }
  }
  for(const b of this.solidProps()){const x=origin.x-b.center[0],y=origin.y-b.center[1],z=origin.z-b.center[2],a=b.basis;to.set(x*a[0][0]+y*a[0][1]+z*a[0][2],x*a[1][0]+y*a[1][1]+z*a[1][2],x*a[2][0]+y*a[2][1]+z*a[2][2]);td.set(direction.x*a[0][0]+direction.y*a[0][1]+direction.z*a[0][2],direction.x*a[1][0]+direction.y*a[1][1]+direction.z*a[1][2],direction.x*a[2][0]+direction.y*a[2][1]+direction.z*a[2][2]);tc.set(0,0,0);th.set(...b.half);result=Math.min(result,rayAABB(to,td,tc,th,result,padding));}
  for(const v of this.stream?.views.values()||[])result=Math.min(result,v.rayDistance(origin,direction,result,padding));
  return result;
 }
 // First static collider box overlapping an axis-aligned box (for client prediction).
 overlapBox(center, half,ignoredCells){
  for(let bi = 0; bi < this.bounds.length; bi++){
   const b = this.bounds[bi]; if(center.x + half.x < b[0] || center.x - half.x > b[3] || center.y + half.y < b[1] || center.y - half.y > b[4] || center.z + half.z < b[2] || center.z - half.z > b[5]) continue;
   for(const c of this.cellsByBuilding[bi]){
    if(this.detached.has(c.id) || ignoredCells?.has(c.id) || Math.abs(center.x - c.p[0]) > half.x + c.queryHalf[0] || Math.abs(center.y - c.p[1]) > half.y + c.queryHalf[1] || Math.abs(center.z - c.p[2]) > half.z + c.queryHalf[2]) continue;
    for(const a of this.colliderCache.get(c.id)){ const cx = c.p[0] + a[0], cy = c.p[1] + a[1], cz = c.p[2] + a[2]; if(Math.abs(center.x - cx) < half.x + a[3] && Math.abs(center.y - cy) < half.y + a[4] && Math.abs(center.z - cz) < half.z + a[5]) return {center:{x:cx, y:cy, z:cz}, half:{x:a[3], y:a[4], z:a[5]}}; }
   }
  }
  for(const b of this.solidProps()){if(b.center[1]<0)continue;if(b.center.every((v,i)=>Math.abs([center.x,center.y,center.z][i]-v)<[half.x,half.y,half.z][i]+b.extent[i]))return {center:{x:b.center[0],y:b.center[1],z:b.center[2]},half:{x:b.extent[0],y:b.extent[1],z:b.extent[2]}};}
  for(const v of this.stream?.views.values()||[]){const hit=v.overlapBox(center,half,ignoredCells);if(hit)return hit;}
  return null;
 }
 // Intact bays whose envelope a segment crosses (local pre-impact effects for tracked hands).
 cellsAlongSegment(a, b, pad = 1){
  const out = [], lo = [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.min(a[2], b[2]) - pad], hi = [Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, Math.max(a[2], b[2]) + pad];
  this.bounds.forEach((bb, i) => { if(lo[0] > bb[3] || hi[0] < bb[0] || lo[1] > bb[4] || hi[1] < bb[1] || lo[2] > bb[5] || hi[2] < bb[2]) return;
   for(const c of this.cellsByBuilding[i]) if(!this.detached.has(c.id) && c.p[0] + c.size[0] / 2 > lo[0] && c.p[0] - c.size[0] / 2 < hi[0] && c.p[1] + c.size[1] / 2 > lo[1] && c.p[1] - c.size[1] / 2 < hi[1] && c.p[2] + c.size[2] / 2 > lo[2] && c.p[2] - c.size[2] / 2 < hi[2]) out.push(c); });
  for(const v of this.stream?.views.values()||[])out.push(...v.cellsAlongSegment(a,b,pad));
  return out;
 }
 async loadCustomAssets(){
  const loader = new GLTFLoader();
  for(const prop of this.env.props){ if(!prop.url) continue; try{ const a = await loader.loadAsync(prop.url), o = a.scene; o.position.set(...(prop.position || [0, 0, 0])); o.rotation.set(...(prop.rotation || [0, 0, 0])); o.scale.setScalar(prop.scale || 1); this.root.add(o); }catch(e){ console.warn('Optional prop failed', e); } }
 }
}
export {MATERIALS};
