// Streets, sidewalks, plaza, spawn pads, water and the far shore for the district grid.
// Static decoration only: nothing here has gameplay collision.
import * as T from 'three';
import {mergeParts, mesh, box, labelTexture} from '../art.js';
import {surface} from '../render/quality.js';
import {buildingFootprint} from '../../shared/city/layout.js';
export function buildGround(root, env, tier, textures){
 const half = env.half, span = half * 2 + 30, {avenues, streets, avenueWidth, streetWidth} = env.roads;
 const concrete = surface(tier, {map:textures.concrete, normalMap:textures.concreteNormal, normalScale:new T.Vector2(.2, .2), roughnessMap:textures.concreteRoughness, roughness:.9, color:0xcfc9bb});
 const asphalt = surface(tier, {map:textures.asphalt, normalMap:textures.asphaltNormal, normalScale:new T.Vector2(.3, .3), roughnessMap:textures.asphaltRoughness, roughness:.92, color:0x9ea6a7});
 const base = new T.Mesh(new T.PlaneGeometry(span, span), concrete); base.rotation.x = -Math.PI / 2; base.position.y = .012; base.receiveShadow = true; root.add(base);
 const roads = [];
 for(const x of avenues) roads.push([new T.BoxGeometry(avenueWidth, .02, span), [x, .03, 0]]);
 for(const z of streets) roads.push([new T.BoxGeometry(span, .02, streetWidth), [0, .03, z]]);
 mesh(mergeParts(roads), asphalt, root).castShadow = false;
 const marking = new T.MeshBasicMaterial({color:0xc9c8b6}), yellow = new T.MeshBasicMaterial({color:0xb9964a}), marks = [], yellows = [], walks = [];
 for(const x of avenues){ yellows.push([new T.BoxGeometry(.12, .012, span), [x - .3, .045, 0]], [new T.BoxGeometry(.12, .012, span), [x + .3, .045, 0]]); for(let z = -half; z < half; z += 8) for(const lane of [-avenueWidth / 4, avenueWidth / 4]) marks.push([new T.BoxGeometry(.12, .012, 3), [x + lane, .045, z]]); }
 for(const z of streets){ yellows.push([new T.BoxGeometry(span, .012, .12), [0, .045, z - .3]], [new T.BoxGeometry(span, .012, .12), [0, .045, z + .3]]); for(let x = -half; x < half; x += 8) for(const lane of [-streetWidth / 4, streetWidth / 4]) marks.push([new T.BoxGeometry(3, .012, .12), [x, .045, z + lane]]); }
 for(const x of avenues) for(const z of streets) for(let i = -3; i <= 3; i++) for(const side of [-1, 1]){ walks.push([new T.BoxGeometry(.7, .014, 2.6), [x + i * 1.3, .05, z + side * (streetWidth / 2 + 1.6)]]); walks.push([new T.BoxGeometry(2.6, .014, .7), [x + side * (avenueWidth / 2 + 1.6), .05, z + i * 1.3]]); }
 mesh(mergeParts(marks), marking, root).castShadow = false; mesh(mergeParts(yellows), yellow, root).castShadow = false; mesh(mergeParts(walks), marking, root).castShadow = false;
 // Raised sidewalk slab and name sign per tower.
 const dark = surface(tier, {color:0x293d42, metalness:.65, roughness:.61}), pads = [];
 for(const b of env.buildings){ const [x0, z0, x1, z1] = buildingFootprint(b); pads.push([new T.BoxGeometry(x1 - x0 + 4, .18, z1 - z0 + 4), [b.x, .09, b.z]]);
  for(const zs of [-1, 1]){ const sign = new T.Mesh(new T.PlaneGeometry(Math.min(14, x1 - x0) * .84, .9), new T.MeshBasicMaterial({map:labelTexture(b.name), toneMapped:false})); sign.position.set(b.x, 1.4, zs > 0 ? z1 + .3 : z0 - .3); if(zs < 0) sign.rotation.y = Math.PI; root.add(sign); }
 }
 mesh(mergeParts(pads), concrete, root).castShadow = false;
 const plaza = new T.Mesh(new T.CircleGeometry(env.plaza, 48), surface(tier, {map:textures.concrete, color:0xa4b3af, roughness:.65})); plaza.rotation.x = -Math.PI / 2; plaza.position.y = .1; root.add(plaza);
 const ring = new T.Mesh(new T.RingGeometry(env.plaza - 1.6, env.plaza - 1.4, 64), new T.MeshBasicMaterial({color:0x7addcd})); ring.rotation.x = -Math.PI / 2; ring.position.y = .11; root.add(ring);
 for(const p of env.spawns){ const pad = new T.Mesh(new T.CircleGeometry(3.8, 40), surface(tier, {color:0x234348, metalness:.55, roughness:.6})); pad.rotation.x = -Math.PI / 2; pad.position.set(p[0], .06, p[2]); root.add(pad); const t = new T.Mesh(new T.PlaneGeometry(5, 5), new T.MeshBasicMaterial({map:labelTexture('H', {bg:'#25494b', fg:'#b8efad', w:256, h:256})})); t.rotation.x = -Math.PI / 2; t.position.set(p[0], .08, p[2]); root.add(t); }
 // Street lamps along every avenue.
 const lamps = [], bulbs = [];
 for(const x of avenues) for(let z = -half + 8; z <= half - 8; z += 24) for(const side of [-1, 1]){ const lx = x + side * (avenueWidth / 2 + .8); lamps.push([new T.CylinderGeometry(.07, .1, 6, 5), [lx, 3, z]], [new T.BoxGeometry(1.6, .1, .1), [lx - side * .7, 6.1, z]]); bulbs.push([new T.BoxGeometry(.8, .05, .3), [lx - side * 1.2, 6.03, z]]); }
 mesh(mergeParts(lamps), dark, root).castShadow = false; mesh(mergeParts(bulbs), new T.MeshBasicMaterial({color:0xffd998, toneMapped:false}), root).castShadow = false;
 // Water beyond the island, a shore ring and two harbour bridges.
 const ocean = new T.Mesh(new T.PlaneGeometry(2800, 2800, 1, 1), surface(tier, {color:0x286a78, roughness:.26, metalness:.5})); ocean.rotation.x = -Math.PI / 2; ocean.position.y = -.45; root.add(ocean);
 const waterTime = {value:0};
 ocean.material.onBeforeCompile = shader => {
  shader.uniforms.harborTime = waterTime;
  shader.vertexShader = 'varying vec3 harborPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nharborPosition=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader = 'uniform float harborTime;varying vec3 harborPosition;\n' + shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
   vec2 wave=vec2(sin(harborPosition.x*.29+harborPosition.z*.13+harborTime*.7),cos(harborPosition.z*.41-harborPosition.x*.17+harborTime*.55));
   normal=normalize(normal+mat3(viewMatrix)*vec3(wave.x*.18,0.,wave.y*.18));`);
 };
 const shore = new T.Mesh(new T.RingGeometry(half + 32, 700, 96), surface(tier, {color:0x607a70, roughness:1})); shore.rotation.x = -Math.PI / 2; shore.position.y = -.19; root.add(shore);
 box(root, [span + 6, 1, span + 6], [0, -.52, 0], concrete);
 const bridgeParts = [];
 for(const z of [-1, 1]){
  const bz = z * (half + 22); bridgeParts.push([new T.BoxGeometry(900, .8, 8), [0, 3.4, bz]]);
  for(const x of [-300, -180, -60, 60, 180, 300]){ bridgeParts.push([new T.BoxGeometry(1.6, 34, 1.6), [x, 17, bz - 3.5]], [new T.BoxGeometry(1.6, 34, 1.6), [x, 17, bz + 3.5]], [new T.BoxGeometry(1.6, 1, 8.5), [x, 33, bz]]); }
  for(let x = -420; x < 420; x += 8){ const y = 6 + 22 * Math.pow(Math.cos(x * Math.PI / 120), 2); bridgeParts.push([new T.CylinderGeometry(.06, .06, Math.max(.1, y - 4), 4), [x, (y + 4) / 2, bz - 3.5]], [new T.CylinderGeometry(.06, .06, Math.max(.1, y - 4), 4), [x, (y + 4) / 2, bz + 3.5]]); }
 }
 mesh(mergeParts(bridgeParts), surface(tier, {color:0x687f82, metalness:.55, roughness:.7}), root).castShadow = false;
 return {waterTime, update(dt){ waterTime.value += dt; }};
}
