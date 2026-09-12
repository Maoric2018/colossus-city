import * as T from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {bakedModel, instances, assetStatus} from './assets.js';
import {roofProp,ROOF_ASSETS} from '../shared/props.js';
import {seeded} from '../shared/math.js';
import {cloudSkyMaterial} from './render/cloud-sky.js';
import {setAtmospherePanorama} from './render/distance-fog.js';
const base = '/assets/imported/';
// Downloaded dressing around the destructible district: HDR sky, far skyline, street traffic,
// rooftop equipment that rides its bay, harbour industry. Nothing here is gameplay collision.
export async function installDistrict(view, renderer){
 const tier = view.tier, env = view.env, half = env.half;
 const skyURL = base + 'textures/sky-' + (view.quest || tier.name==='QUEST' ? '1k' : '2k') + '.hdr';
 const tasks = [], rand = seeded(78021), root = view.root;
 tasks.push(new RGBELoader().loadAsync(skyURL).then(hdr => {
  hdr.mapping = T.EquirectangularReflectionMapping; const pmrem = new T.PMREMGenerator(renderer), envMap = pmrem.fromEquirectangular(hdr); pmrem.dispose();
  view.scene.environment = envMap.texture; view.scene.environmentIntensity = tier.lambert ? .45 : .6; view.scene.background = env.infinite ? null : hdr; view.scene.backgroundIntensity = .8; view.scene.backgroundBlurriness = 0;
  view.scene.backgroundRotation.y = .4; view.scene.environmentRotation.y = .4; view.sky.visible = !!env.infinite; assetStatus.loaded.push(skyURL);
  if(env.infinite){
   setAtmospherePanorama(view.scene,hdr,view.scene.environmentRotation.y);
   const fallback=view.sky.material;
   view.sky.material=cloudSkyMaterial(hdr,view.scene.fog.color,view.scene.environmentRotation.y);view.sky.frustumCulled=false;fallback.dispose();
  }
 }).catch(error => { assetStatus.failed.push(skyURL); console.error('Sky panorama failed to load', error); }));
 // Lower tiers lean on the two low-detail models for the ring (they are 10x cheaper) and keep
 // only a few detailed skyscrapers for silhouette.
 const detailed = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e', 'building-a', 'building-c', 'building-f', 'building-g', 'building-k'];
 const skylineNames = tier.skyline >= 1 ? [...detailed, 'low-detail-building-a', 'low-detail-building-c'] : [...detailed.slice(0, 3), 'low-detail-building-a', 'low-detail-building-c', 'low-detail-building-a', 'low-detail-building-c'];
 const perType = Math.max(2, Math.round(7 * Math.max(tier.skyline, .6)));
 if(!env.infinite)skylineNames.forEach((name, type) => {
  const tall = name.includes('skyscraper') || name.startsWith('low-detail');
  const places = []; for(let j = 0; j < perType; j++){ const angle = (type + j * skylineNames.length) * 2.39996, r = half + 60 + rand() * 160, h = (tall ? 48 : 20) + rand() * (tall ? 70 : 28); places.push({position:[Math.cos(angle) * r, -.15, Math.sin(angle) * r], yaw:Math.round(rand() * 4) * Math.PI / 2, height:h}); }
  tasks.push(bakedModel(base + `city-kit-commercial/${name}.glb`).then(model => { for(const p of places) p.scale = p.height / model.size.y; for(const part of model.parts) part.material.color.setHex(0x9aafb9); instances(root, model, places, {castShadow:false}); }));
 });
 // Movable street traffic and wrecks are owned by CityView.cars.
 tasks.push(installRoofDressing(view));
 if(!env.infinite)for(const [type, name] of ['shipping-container-a', 'shipping-container-b', 'building-a', 'building-g', 'chimney-large'].entries()){
  tasks.push(bakedModel(base + `city-kit-industrial/${name}.glb`).then(model => {
   const places = []; for(let i = 0; i < 10; i++) places.push({position:[-half - 20 + i * 38, -.15, -half - 60 - type * 16], scale:(type < 2 ? 3.1 : type === 4 ? 24 : 10) / model.size.y, yaw:Math.PI / 2}); instances(root, model, places, {castShadow:false});
  }));
 }
 const results = await Promise.allSettled(tasks); for(const result of results) if(result.status === 'rejected') console.error('District asset failed to load', result.reason);
 return results;
}
export async function installRoofDressing(view){
 const tasks=[],env=view.env;
 // Roof props follow the bay underneath them, including rotations, removal and round resets.
 const roofAssets = [['city-kit-industrial/water-tower', 3.2], ['space-kit/satelliteDish_detailed', 2.6], ['city-kit-industrial/detail-tank', 1.3], ['city-kit-industrial/solar-panel-flat', .3]];
 roofAssets.forEach(([name, height], type) => tasks.push(bakedModel(base + name + '.glb').then(model => {
  if(view.disposed)return;
  const cells = view.cells.filter(c => roofProp(c)?.asset === name);
  if(!cells.length) return;
  for(const part of model.parts){ const batch = view.batch(part.geometry, part.material, cells.length); cells.forEach((c, index) => {
   const local = new T.Matrix4().compose(new T.Vector3(0, c.size[1] / 2 + .04, 0), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (c.roofYaw??c.building) * Math.PI / 2), new T.Vector3().setScalar(roofProp(c).height / model.size.y));
   if(!view.attachments.has(c.id)) view.attachments.set(c.id, []); view.attachments.get(c.id).push({batch, index, local});
  }); }
  attachRoofProps(view, cells);
 })));
 // Spires on the signature towers.
 const spires = env.buildings.map((b, i) => b.spire ? {b, i} : null).filter(Boolean);
 if(spires.length){
  const geometry = new T.CylinderGeometry(.08, .9, 1, 6), material = new T.MeshStandardMaterial({color:0x9aa8b0, metalness:.8, roughness:.35}), batch = view.batch(geometry, material, spires.length);
  spires.forEach(({b, i}, index) => { const top = view.cells.filter(c => c.building === i && c.roof).sort((a, c) => c.p[1] - a.p[1])[0]; if(!top) return; const local = new T.Matrix4().compose(new T.Vector3(0, top.size[1] / 2 + b.spire / 2, 0), new T.Quaternion(), new T.Vector3(1, b.spire, 1)); if(!view.attachments.has(top.id)) view.attachments.set(top.id, []); view.attachments.get(top.id).push({batch, index, local}); });
  attachRoofProps(view, view.cells.filter(c => view.attachments.has(c.id)));
 }
 await Promise.all(tasks);
}
// Attached props are re-posed whenever their bay moves; register them with the buildings layer.
export function attachRoofProps(view, cells){
 const {buildings} = view, matrix = new T.Matrix4(), offset = new T.Matrix4(), zero = new T.Matrix4().makeScale(0, 0, 0), temp = new T.Object3D();
 if(!buildings.attachmentHook){
  buildings.writeAttachments = e => {
   const attached = view.attachments.get(e.cell.id); if(!attached) return;
   // Nearby off-camera props still cast shadows when enabled. In headset mode
   // and beyond the fog cutoff they share their bay's stereo visibility.
   const visible=!e.hidden&&!e.fine&&(e.rendered!==false||!!(buildings.lastShadows&&e.renderNear));
   if(e.attachmentVisible===visible&&e.attachmentRevision===e.revision)return;e.attachmentVisible=visible;e.attachmentRevision=e.revision;
   temp.position.copy(e.p); temp.quaternion.copy(e.q); temp.scale.set(1, 1, 1); temp.updateMatrix(); offset.copy(temp.matrix);
   for(const part of attached){ matrix.multiplyMatrices(offset, part.local); part.batch.setMatrixAt(part.index, visible ? matrix : zero); part.batch.instanceMatrix.needsUpdate = true; }
  };
  buildings.attachmentHook = true;
 }
 for(const c of cells){view.fine?.refreshSource(c,buildings); const e = buildings.entries.get(c.id);e.attachmentVisible=undefined;buildings.writeAttachments(e); }
 buildings.commit();
}
