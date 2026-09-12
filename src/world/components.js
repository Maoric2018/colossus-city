import * as T from 'three';
import {mergeParts} from '../art.js';
import {surface} from '../render/quality.js';
import {COMPONENTS,componentPlacements} from '../../shared/city/components.js';
const zero=new T.Matrix4().makeScale(0,0,0),matrix=new T.Matrix4(),base=new T.Matrix4(),scale=new T.Vector3();
const sides=Array.from({length:4},(_,side)=>new T.Matrix4().makeRotationY(-side*Math.PI/2));
// Every streamed block shares these part batches: adding streets does not add
// another hundred detail draw calls. Only nearby parts occupy rendered slots.
export class Components{
 constructor(buildings,cells,tier,concrete){
  this.buildings=buildings;this.tier=tier;this.radius=tier.name==='QUEST'?64:tier.lambert?85:115;this.lastPosition=null;this.entries=new Map();this.cells=new Map();this.poses=new Map();this.batches=new Map();this.capacities=new Map();
  const colors={stone:0xd2c9b8,steel:0x465059,concrete:0x999d99,bronze:0x8c7047,silver:0xc5cac9};
  this.materials=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,surface(tier,{color,roughness:k==='silver'?.5:.86,map:k==='stone'||k==='concrete'?concrete:null})]));
  this.register(buildings,cells);
 }
 register(buildings,cells){
  for(const c of cells){this.cells.set(c.id,c);this.poses.set(c.id,buildings.entries.get(c.id));this.entries.set(c.id,componentPlacements(c,{interiors:!this.tier.lambert}).map(p=>({...p,index:-1})));}
  // Create geometry once. Instance buffers grow only when the visible subset needs it.
  for(const c of cells)for(const p of this.entries.get(c.id))if(!this.batches.has(p.type))this.reserve(p.type,32);
  this.lastPosition=null;
 }
 unregister(cells){for(const c of cells){this.cells.delete(c.id);this.poses.delete(c.id);this.entries.delete(c.id);}this.lastPosition=null;}
 reserve(type,count){
  if((this.capacities.get(type)||0)>=count)return;
  const old=this.batches.get(type),spec=COMPONENTS[type],geometry=old?.geometry||mergeParts(spec.parts.map(p=>[new T.BoxGeometry(...p.s),p.p,p.r])),capacity=2**Math.ceil(Math.log2(Math.max(32,count)));
  const mesh=this.buildings.batch(geometry,this.materials[spec.material],capacity);mesh.count=0;mesh.castShadow=false;mesh.userData.component=true;
  if(old){old.removeFromParent();old.dispose();this.buildings.dirty.delete(old);this.buildings.batches=this.buildings.batches.filter(b=>b!==old);}
  this.batches.set(type,mesh);this.capacities.set(type,capacity);
 }
 select(camera){
  const view=camera.cameras?.[0]||camera,p=new T.Vector3().setFromMatrixPosition(view.matrixWorld),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(view.matrixWorld)),now=performance.now();
  if(this.lastPosition&&p.distanceToSquared(this.lastPosition)<1&&Math.abs(q.dot(this.lastRotation))>.99985&&now-(this.lastUpdate||0)<100)return;
  this.lastPosition=p;this.lastRotation=q;this.lastUpdate=now;const counts={};
  for(const c of this.cells.values()){
   const e=this.poses.get(c.id),distance=e.p.distanceTo(p),near=distance<this.radius;
   for(const part of this.entries.get(c.id)){
    const signature=(part.type.startsWith('wtc')||part.type.startsWith('empire'))&&distance<230;
    const mask=part.layer==='glass'?e.glassMask:e.facadeMask;
    if(e.hidden||e.inView===false||(!near&&!signature)||(part.layer!=='frame'&&!(mask&(1<<part.side)))){part.index=-1;continue;}
    part.index=counts[part.type]||0;counts[part.type]=part.index+1;
   }
  }
  for(const [type,count]of Object.entries(counts))this.reserve(type,count);
  for(const c of this.cells.values())this.setCell(c,this.poses.get(c.id));
  for(const [type,mesh]of this.batches)mesh.count=counts[type]||0;
 }
 setCell(c,e){
  base.compose(e.p,e.q,scale.set(...c.size));
  for(const p of this.entries.get(c.id)||[]){
   if(p.index<0)continue;const mesh=this.batches.get(p.type),mask=p.layer==='glass'?e.glassMask:e.facadeMask;
   const hidden=e.hidden||(p.layer!=='frame'&&!(mask&(1<<p.side)));
   if(p.side>=0)matrix.multiplyMatrices(base,sides[p.side]);else matrix.copy(base);
   mesh.setMatrixAt(p.index,hidden?zero:matrix);this.buildings.dirty.add(mesh);
  }
 }
}
