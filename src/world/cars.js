import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {bakedModel} from '../assets.js';
import {surface} from '../render/quality.js';
import {carPlacements} from '../../shared/props.js';
import {CAR_ID_START,carBox} from '../../shared/cars.js';
const dummy=new T.Object3D(),zero=new T.Matrix4().makeScale(0,0,0);
const scrapNames=['debris-door','debris-bumper','debris-tire','debris-drivetrain','debris-plate-a'];
export class CarsView {
 constructor(root,env,tier){
  this.root=root;this.tier=tier;this.placements=carPlacements(env);this.entries=new Map();this.batches=[];this.ready=this.load();
  this.placements.forEach((prop,i)=>this.entries.set(CAR_ID_START+i,{id:CAR_ID_START+i,prop,parts:[],p:[prop.position[0],prop.position[1]+prop.size[1]/2,prop.position[2]],q:[0,Math.sin(prop.yaw/2),0,Math.cos(prop.yaw/2)],wreck:false,sleeping:true,removed:false,burn:0}));
  for(const e of this.entries.values())this.apply(e);
 }
 batch(g,m,count,name){const b=new T.InstancedMesh(g,m,count);b.name=name;b.instanceMatrix.setUsage(T.DynamicDrawUsage);b.frustumCulled=false;b.castShadow=this.tier.shadows;b.receiveShadow=true;this.root.add(b);this.batches.push(b);return b;}
 async load(){
  // The existing downloaded kit supplies the vehicles and the torn doors, bumpers,
  // tires, drivetrain and plates. Each wreck retains a crushed version of its own shell.
  const scraps=await Promise.all(scrapNames.map(n=>bakedModel(`/assets/imported/car-kit/${n}.glb`)));
  for(const asset of new Set(this.placements.map(p=>p.asset))){
   const model=await bakedModel(`/assets/imported/${asset}.glb`),entries=[...this.entries.values()].filter(e=>e.prop.asset===asset),prop=entries[0].prop;
   for(const part of model.parts){const geo=part.geometry.clone().scale(prop.scale,prop.scale,prop.scale).translate(0,-prop.size[1]/2,0),batch=this.batch(geo,part.material,entries.length,'car-intact:'+asset);entries.forEach((e,index)=>e.parts.push({batch,index,wreck:false}));}
   const wreck=this.batch(wreckGeometry(model,scraps,prop),surface(this.tier,{color:0xffffff,vertexColors:true,roughness:.92,metalness:.3}),entries.length,'car-wreck:'+asset);
   entries.forEach((e,index)=>{e.parts.push({batch:wreck,index,wreck:true});this.apply(e);});
  }
 }
 apply(e){
  dummy.position.set(...e.p);dummy.quaternion.set(...e.q);dummy.scale.setScalar(1);dummy.updateMatrix();
  e.box=carBox(e.prop.size,e.p,e.q,e.wreck);
  for(const part of e.parts){part.batch.setMatrixAt(part.index,e.removed||e.wreck!==part.wreck?zero:dummy.matrix);part.batch.instanceMatrix.needsUpdate=true;}
 }
 setState(state){const e=this.entries.get(state.id);if(!e)return;for(const k of ['p','q','wreck','sleeping','removed','burn'])if(state[k]!==undefined)e[k]=Array.isArray(state[k])?[...state[k]]:state[k];this.apply(e);}
 pose(id,p,q){const e=this.entries.get(id);if(!e||e.sleeping||e.removed)return;this.setState({id,p,q});}
 reset(){for(const e of this.entries.values()){const p=e.prop;this.setState({id:e.id,p:[p.position[0],p.position[1]+p.size[1]/2,p.position[2]],q:[0,Math.sin(p.yaw/2),0,Math.cos(p.yaw/2)],wreck:false,sleeping:true,removed:false,burn:0});}}
 *boxes(){for(const e of this.entries.values())if(!e.removed)yield e.box;}
 update(dt,fx){
  for(const e of this.entries.values())if(e.burn>0&&!e.removed){e.burn=Math.max(0,e.burn-dt);e.smokeAt=(e.smokeAt||0)-dt;if(fx&&e.smokeAt<=0){e.smokeAt=.22;const p=[e.p[0],e.p[1]+e.prop.size[1]*.1,e.p[2]];fx.particle(fx.smoke,p,{v:new T.Vector3(0,2,0),life:1.5,size:.9,color:new T.Color(0x252a2c),growth:2,opacity:.6});if(e.burn>3)fx.particle(fx.flares,p,{life:.2,size:.7,color:new T.Color(0xff7525),growth:1});}}
 }
}
function wreckGeometry(model,scraps,prop){
 const [w,h,d]=prop.size,geometries=[];
 const burn=g=>{g.deleteAttribute('uv');const color=g.getAttribute('color');if(color)for(let i=0;i<color.count;i++){const heat=.035+.02*Math.sin(g.attributes.position.getZ(i)*13);color.setXYZ(i,heat+color.getX(i)*.16,heat+color.getY(i)*.14,heat+color.getZ(i)*.13);}return g;};
 for(const part of model.parts){
  const g=part.geometry.clone().scale(prop.scale,prop.scale,prop.scale),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)/h,z=p.getZ(i),upper=Math.max(0,y-.25);p.setXYZ(i,x*(1+upper*.18)+Math.sin(z*8)*w*.025*upper,h*(y*.55+Math.sin(z*4)*.06*upper)-h/2,z*(.9-upper*.14));}
  g.computeVertexNormals();geometries.push(burn(g));
 }
 const places=[{p:[-w*.52,-h*.22,0],r:[.2,.3,-.7],size:h*.65},{p:[0,-h*.33,d*.48],r:[.18,.2,.1],size:w*.9},{p:[w*.53,-h*.33,d*.28],r:[.7,0,.5],size:h*.38},{p:[0,-h*.2,d*.25],r:[0,0,.15],size:w*.65},{p:[w*.34,-h*.12,-d*.3],r:[.4,.2,-.2],size:w*.45}];
 scraps.forEach((m,i)=>{const place=places[i],s=place.size/Math.max(m.size.x,m.size.y,m.size.z);dummy.position.set(...place.p);dummy.rotation.set(...place.r);dummy.scale.setScalar(s);dummy.updateMatrix();for(const part of m.parts)geometries.push(burn(part.geometry.clone().applyMatrix4(dummy.matrix)));});
 const merged=mergeGeometries(geometries);for(const g of geometries)g.dispose();
 // Fit all torn components into the shared crushed-shell collision envelope.
 merged.computeBoundingBox();const bounds=merged.boundingBox,size=bounds.getSize(new T.Vector3()),p=merged.attributes.position;
 for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*Math.min(1,w*1.04/size.x),(p.getY(i)-bounds.min.y)/size.y*h*.56-h*.5,p.getZ(i)*Math.min(1,d/size.z));
 merged.computeVertexNormals();merged.computeBoundingBox();return merged;
}
