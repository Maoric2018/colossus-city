import * as T from 'three';
import {mergeParts} from '../art.js';
import {surface} from '../render/quality.js';
import {COMPONENTS,componentPlacements} from '../../shared/city/components.js';
const zero=new T.Matrix4().makeScale(0,0,0), matrix=new T.Matrix4(),base=new T.Matrix4(),scale=new T.Vector3(),axis=new T.Vector3(0,1,0);
const sides=Array.from({length:4},(_,side)=>new T.Matrix4().makeRotationY(-side*Math.PI/2));
// One instanced batch per reusable part, irrespective of the number of buildings. The
// reduced headset kit omits repeated enclosed interior rooms, not exterior architecture.
export class Components {
 constructor(buildings,cells,tier,concrete){
  this.buildings=buildings;this.cells=cells;this.radius=tier.name==='QUEST'?58:tier.lambert?95:180;this.lastPosition=null;this.entries=new Map();this.batches=new Map();
  const colors={stone:0xd2c9b8,steel:0x465059,concrete:0x999d99,bronze:0x8c7047,silver:0xc5cac9};
  const materials=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,surface(tier,{color,roughness:k==='silver'?.5:.86,map:k==='stone'||k==='concrete'?concrete:null})]));
  const counts={};
  for(const c of cells){const parts=componentPlacements(c,{interiors:!tier.lambert});this.entries.set(c.id,parts);for(const p of parts){p.index=counts[p.type]||0;counts[p.type]=p.index+1;}}
  for(const [type,count] of Object.entries(counts)){
   const spec=COMPONENTS[type],geo=mergeParts(spec.parts.map(p=>[new T.BoxGeometry(...p.s),p.p,p.r]));
   const mesh=buildings.batch(geo,materials[spec.material],count);mesh.castShadow=false;this.batches.set(type,mesh);
  }
 }
 select(camera){
  const view=camera.cameras?.[0]||camera,p=new T.Vector3().setFromMatrixPosition(view.matrixWorld);
  const now=performance.now();if(this.lastPosition&&p.distanceToSquared(this.lastPosition)<64&&now-(this.lastUpdate||0)<400)return;this.lastUpdate=now;
  this.lastPosition=p;const counts={};
  for(const c of this.cells){
   const e=this.buildings.entries.get(c.id),near=Math.hypot(e.p.x-p.x,e.p.z-p.z)<this.radius;
   for(const part of this.entries.get(c.id)){
    const visible=near||part.type.startsWith('wtc')||part.type.startsWith('empire');
    if(!visible){part.index=-1;continue;}
    part.index=counts[part.type]||0;counts[part.type]=part.index+1;
   }
   this.setCell(c,e);
  }
  for(const [type,mesh] of this.batches)mesh.count=counts[type]||0;
 }
 setCell(c,e){
  base.compose(e.p,e.q,scale.set(...c.size));
  for(const p of this.entries.get(c.id)){
   if(p.index<0)continue;
   const mesh=this.batches.get(p.type),mask=p.layer==='glass'?e.glassMask:e.facadeMask;
   const hidden=e.hidden||(p.layer!=='frame'&&!(mask&(1<<p.side)));
   if(p.side>=0)matrix.multiplyMatrices(base,sides[p.side]);else matrix.copy(base);
   mesh.setMatrixAt(p.index,hidden?zero:matrix);this.buildings.dirty.add(mesh);
  }
 }
}
