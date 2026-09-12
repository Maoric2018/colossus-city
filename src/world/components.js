import {modernLandmark} from '../../shared/city/modern-landmarks.js';
import {catalogLandmark} from '../../shared/city/catalog.js';
import {componentGeometry} from '../render/component-geometry.js';
import * as T from 'three';
import {mergeParts} from '../art.js';
import {surface} from '../render/quality.js';
import {COMPONENTS,componentPlacements} from '../../shared/city/components.js';
const zero=new T.Matrix4().makeScale(0,0,0),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion(),rotationMatrix=new T.Matrix4();
const sides=Array.from({length:4},(_,side)=>new T.Matrix4().makeRotationY(-side*Math.PI/2));
// Global part batches retain stable slots. Visibility changes add/remove only the
// affected instances; unchanged city detail never needs another GPU upload.
export class Components{
 constructor(buildings,cells,tier,concrete){
  this.buildings=buildings;this.tier=tier;this.radius=tier.name==='QUEST'?64:tier.lambert?85:115;this.lastPosition=null;this.lastRotation=new T.Quaternion();this.entries=new Map();this.cells=new Map();this.poses=new Map();this.batches=new Map();this.capacities=new Map();this.active=new Map();this.activeCells=new Set();
  const colors={stone:0xd2c9b8,steel:0x465059,concrete:0x999d99,bronze:0x8c7047,silver:0xc5cac9,chrome:0xdde7eb,marble:0xeeeae0,slate:0x29363d,crownGlass:0x162f3e,blueGlass:0x7095a9,terracotta:0xc9bfac,clearGlass:0xa8cede,jade:0x538a79,copper:0xad7351,ruby:0x863d32,darkBronze:0x514436};
  this.materials=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,surface(tier,{color,roughness:k==='blueGlass'?.22:k==='chrome'?.28:k==='silver'?.5:.86,metalness:k==='blueGlass'?.45:k==='chrome'?.75:0,map:k==='stone'||k==='concrete'?concrete:null})]));
  this.materials.blueGlass.dispose();this.materials.blueGlass=new T.MeshStandardMaterial({color:0x89aaba,roughness:.24,metalness:.5,envMapIntensity:.9});
  this.materials.clearGlass.dispose();this.materials.clearGlass=new T.MeshStandardMaterial({color:0xb7d7e4,roughness:.15,metalness:.2,transparent:true,opacity:.3,depthWrite:false,side:T.DoubleSide});
  this.register(buildings,cells);
 }
 register(buildings,cells){
  for(const c of cells){const e=buildings.entries.get(c.id);this.cells.set(c.id,c);this.poses.set(c.id,e);this.entries.set(c.id,componentPlacements(c,{interiors:!this.tier.lambert}).map(p=>({...p,index:-1,cell:c,pose:e,signature:COMPONENTS[p.type].signature||p.type.startsWith('wtc')||p.type.startsWith('empire')||p.type.startsWith('chrysler')||(/^hudson(Roof|Edge|Ribbon|SilverLip|KnifeFin)|^vanderbilt(Spandrel|Mullion|VolumeFin|Setback|Crown|Needle)/.test(p.type)),fine:p.type==='vanderbiltFlutes'||p.type==='hudsonPanelSeam'})));}
  for(const c of cells)for(const p of this.entries.get(c.id))if(!this.batches.has(p.type)){this.active.set(p.type,[]);this.reserve(p.type,32);}
  this.lastPosition=null;
 }
 unregister(cells){for(const c of cells){for(const part of this.entries.get(c.id))this.remove(part);this.cells.delete(c.id);this.poses.delete(c.id);this.entries.delete(c.id);this.activeCells.delete(c.id);}this.lastPosition=null;}
 reserve(type,count){
  if((this.capacities.get(type)||0)>=count)return;
  const old=this.batches.get(type),spec=COMPONENTS[type],geometry=old?.geometry||mergeParts(spec.parts.map(p=>[componentGeometry(p),p.p,p.r])),capacity=2**Math.ceil(Math.log2(Math.max(32,count)));
  const mesh=this.buildings.batch(geometry,this.materials[spec.material],capacity);mesh.count=this.active.get(type).length;mesh.castShadow=false;mesh.userData.component=true;mesh.visible=mesh.count>0;
  if(old){mesh.instanceMatrix.array.set(old.instanceMatrix.array);old.removeFromParent();old.dispose();this.buildings.dirty.delete(old);this.buildings.batches=this.buildings.batches.filter(b=>b!==old);}
  this.batches.set(type,mesh);this.capacities.set(type,capacity);
 }
 select(camera){
  const view=camera.cameras?.[0]||camera,now=performance.now();position.setFromMatrixPosition(view.matrixWorld);rotation.setFromRotationMatrix(rotationMatrix.extractRotation(view.matrixWorld));
  if(!this.selectionDirty&&this.lastPosition&&position.distanceToSquared(this.lastPosition)<1&&Math.abs(rotation.dot(this.lastRotation))>.99985&&now-(this.lastUpdate||0)<100)return;
  (this.lastPosition??=new T.Vector3()).copy(position);this.lastRotation.copy(rotation);this.lastUpdate=now;this.selectionDirty=false;
  const radius2=this.radius*this.radius;
  for(const c of this.cells.values()){
   const e=this.poses.get(c.id),distance2=e.p.distanceToSquared(position),near=distance2<radius2,landmark=c.architecture==='wtc'||c.architecture==='empire'||c.architecture==='chrysler'||modernLandmark(c.architecture)||catalogLandmark(c.architecture)||c.roof&&c.catalogRoof&&c.catalogRoof!=='flat';
   const eligible=!e.hidden&&e.inView!==false&&(near||(landmark&&distance2<230*230));
   if(!eligible&&!this.activeCells.has(c.id))continue;let any=false;
   for(const part of this.entries.get(c.id)){
    const mask=part.layer==='glass'?e.glassMask:e.facadeMask;
    const cut=e.fine&&this.intersectsOpening(part);
    const visible=eligible&&!cut&&(!part.fine||distance2<(this.tier.lambert?36:65)**2)&&(near||part.signature)&&(part.layer==='frame'||!!(mask&(1<<part.side)));
    if(visible){any=true;if(part.index<0)this.add(part);}else this.remove(part);
   }
   if(any)this.activeCells.add(c.id);else this.activeCells.delete(c.id);
  }
 }
 intersectsOpening(part){
  const fine=part.pose.fine,key=part.type+':'+part.side;if(fine.cutComponents.has(key))return fine.cutComponents.get(key);
  const geometry=this.batches.get(part.type).geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
  const transform=new T.Matrix4().makeScale(...part.cell.size);if(part.side>=0)transform.multiply(sides[part.side]);const bounds=geometry.boundingBox.clone().applyMatrix4(transform),lo=bounds.min.toArray(),hi=bounds.max.toArray();
  // Preserve intact cornices, sills and trim beside a hole. A decorative assembly
  // detaches only where its footprint overlaps removed material on its own face.
  const dimensions=part.side>=0?[part.side%2?2:0,1]:[0,1,2],cut=fine.lost.some(p=>(part.side<0||p.side===part.side)&&dimensions.every(k=>hi[k]>=p.p[k]-p.size[k]/2-.04&&lo[k]<=p.p[k]+p.size[k]/2+.04));
  fine.cutComponents.set(key,cut);return cut;
 }
 add(part){const slots=this.active.get(part.type);this.reserve(part.type,slots.length+1);part.index=slots.length;slots.push(part);this.batches.get(part.type).count=slots.length;this.batches.get(part.type).visible=true;this.write(part);}
 remove(part){
  if(part.index<0)return;const slots=this.active.get(part.type),index=part.index,last=slots.pop();
  if(last!==part){slots[index]=last;last.index=index;this.write(last);}part.index=-1;this.batches.get(part.type).count=slots.length;this.batches.get(part.type).visible=slots.length>0;
 }
 matrices(c,e){
  if(e.detailRevision===e.revision&&e.detailMatrices)return e.detailMatrices;
  const m=e.detailMatrices??=Array.from({length:5},()=>new T.Matrix4());m[4].compose(e.p,e.q,scale.set(...c.size));
  for(let side=0;side<4;side++)m[side].multiplyMatrices(m[4],sides[side]);e.detailRevision=e.revision;return m;
 }
 write(part){
  const e=part.pose,mask=part.layer==='glass'?e.glassMask:e.facadeMask,hidden=e.hidden||(part.layer!=='frame'&&!(mask&(1<<part.side)));
  this.batches.get(part.type).setMatrixAt(part.index,hidden?zero:this.matrices(part.cell,e)[part.side>=0?part.side:4]);
 }
 setCell(c,e){
  this.selectionDirty=true;if(!this.activeCells.has(c.id))return;
  for(const part of this.entries.get(c.id))if(part.index>=0)this.write(part);
 }
}
