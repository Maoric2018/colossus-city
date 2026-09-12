import * as T from 'three';
import {mergeParts} from '../art.js';
import {componentGeometry} from './component-geometry.js';
import {surface} from './quality.js';
import {generateCells} from '../../shared/city/cells.js';
import {catalogBuilding,STYLE_BY_ID,catalogLandmark} from '../../shared/city/catalog.js';
import {CATALOG_COMPONENTS,catalogRoofTypes} from '../../shared/city/catalog-components.js';
const color={stone:0xd2c9b8,concrete:0xbbbcb5,glass:0x668996,silver:0xc5cac9,slate:0x29363d,jade:0x538a79,steel:0x465059,crownGlass:0x162f3e,darkBronze:0x514436,marble:0xeeeae0,terracotta:0xc9bfac,bronze:0x8c7047};
export const catalogTint=id=>({park432:0xe4e1d8,woolworth:0xd2c9b8,wall40:0xbcb7a7,rockefeller30:0xd0c6af,seagram:0x554c3c,'lever-house':0x62938a,citigroup:0x9dabb2,hearst:0x6e939c}[id]);
function paint(g,value){const c=new T.Color(value),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);g.setAttribute('color',new T.BufferAttribute(a,3));return g;}
function assembly(type,flat=false){const spec=CATALOG_COMPONENTS[type];
 // Distant facade strips need two triangles, not twelve-sided solid boxes. Close
 // buildings retain the full depth. Crown silhouettes continue to use solid geometry.
 return paint(mergeParts(spec.parts.map(p=>[flat&&!p.shape?new T.PlaneGeometry(p.s[0],p.s[1]).rotateY(Math.PI):componentGeometry(p),p.p,p.r])),color[spec.material]??0xaaaaaa);
}
// Exact roof sites without generating a support graph for hundreds of preview buildings.
export function roofSites(b){
 const out=[],base=b.tiers[0];let floor=0;
 const occupied=(t,x,z)=>t&&x>=t.ix&&x<t.ix+t.nx&&z>=t.iz&&z<t.iz+t.nz&&!t.voids?.some(v=>x>=v.ix&&x<v.ix+v.nx&&z>=v.iz&&z<v.iz+v.nz);
 for(let i=0;i<b.tiers.length;i++){const t=b.tiers[i];floor+=t.floors;
  for(let iz=t.iz;iz<t.iz+t.nz;iz++)for(let ix=t.ix;ix<t.ix+t.nx;ix++)if(occupied(t,ix,iz)&&!occupied(b.tiers[i+1],ix,iz))out.push({architecture:b.architecture,ix,iz,roof:true,topFloor:i===b.tiers.length-1,floor:floor-1,size:[b.bay,b.story,b.bay],p:[b.x+(ix-(base.nx-1)/2)*b.bay,.15+(floor-.5)*b.story,b.z+(iz-(base.nz-1)/2)*b.bay]});
 }return out;
}
function landmarkGeometry(style){
 const b=catalogBuilding(style,0,0),cells=generateCells({buildings:[b]}),parts=[],local=new T.Matrix4(),world=new T.Matrix4(),scale=new T.Vector3();
 const cached=new Map(),add=(type,c,side=-1)=>{const key=type+(side>=0?':flat':'');let template=cached.get(key);if(!template){template=assembly(type,side>=0);cached.set(key,template);}world.compose(new T.Vector3(...c.p),new T.Quaternion(),scale.set(...c.size));if(side>=0)world.multiply(local.makeRotationY(-side*Math.PI/2));parts.push([template.clone().applyMatrix4(world)]);};
 for(const c of cells){
  const tint=c.architecture==='hearst'&&c.floor<3?color.stone:catalogTint(c.architecture);
  parts.push([paint(new T.BoxGeometry(c.size[0],c.openSkin?.16:c.size[1],c.size[2]),tint),[c.p[0],c.p[1]+(c.openSkin?c.size[1]/2-.08:0),c.p[2]]]);
  const facade=c.architecture==='hearst'&&c.floor<3?['urbanAshlar','urbanAcademicShield']:style.facade;
  for(let side=0;side<4;side++)if(c.walls[side]&&!c.openSkin)for(const type of facade)add(type,c,side);
  if(c.openSkin)add(c.architecture==='park432'?'parkMechanicalCore':style.entry,c);
  for(const type of catalogRoofTypes(c))add(type,c);
  if(c.architecture==='woolworth'&&c.topFloor)add('woolworthPinnacle',c);
 }
 for(const g of cached.values())g.dispose();
 const merged=mergeParts(parts);return merged;
}
// One reusable instance batch per silhouette/roof type, allocated only on first sight.
// No new physics bodies, per-building materials or unbounded mesh cache while travelling.
export class CatalogLOD{
 constructor(root,tier){this.root=root;this.tier=tier;this.batches=new Map();this.material=surface(tier,{vertexColors:true,roughness:.7});this.matrix=new T.Matrix4();this.rotation=new T.Quaternion();this.position=new T.Vector3();this.scale=new T.Vector3();}
 reset(){for(const b of this.batches.values())b.count=0;}
 add(type,p,size){let mesh=this.batches.get(type);if(!mesh){const landmark=type.startsWith('building:'),id=type.slice(9),geometry=landmark?landmarkGeometry(STYLE_BY_ID.get(id)):assembly(type);mesh=new T.InstancedMesh(geometry,this.material,landmark?128:8192);mesh.count=0;mesh.frustumCulled=false;this.batches.set(type,mesh);this.root.add(mesh);}if(mesh.count>=mesh.instanceMatrix.count)return;
  this.matrix.compose(this.position.set(...p),this.rotation,this.scale.set(...size));mesh.setMatrixAt(mesh.count++,this.matrix);
 }
 building(b){if(!catalogLandmark(b.architecture))return false;const reference=catalogBuilding(STYLE_BY_ID.get(b.architecture),0,0);this.add(`building:${b.architecture}`,[b.x,0,b.z],[b.bay/reference.bay,b.story/reference.story,b.bay/reference.bay]);return true;}
 roofs(b,goneCells=[]){for(const c of roofSites(b)){if(goneCells.some(g=>g.ix===c.ix&&g.iz===c.iz&&g.floor===c.floor))continue;for(const type of catalogRoofTypes(c))this.add(type,c.p,c.size);}}
 commit(){for(const mesh of this.batches.values()){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;}}
}
