import * as T from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {bakedModel,instances,assetStatus} from './assets.js';
import {seeded} from '../shared/math.js';
const base='/assets/imported/';
export async function installDistrict(view,renderer){
 const skyURL=base+'textures/sky-'+(view.quest?'1k':'2k')+'.hdr';
 const tasks=[],rand=seeded(78021),root=view.root;
 tasks.push(new RGBELoader().loadAsync(skyURL).then(hdr=>{
  hdr.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(hdr);pmrem.dispose();
  view.scene.environment=env.texture;view.scene.environmentIntensity=.6;view.scene.background=hdr;view.scene.backgroundIntensity=.8;view.scene.backgroundBlurriness=0;
  view.scene.backgroundRotation.y=.4;view.scene.environmentRotation.y=.4;view.sky.visible=false;assetStatus.loaded.push(skyURL);
 }).catch(error=>{assetStatus.failed.push(skyURL);console.error('Sky panorama failed to load',error);}));
 // A continuous outer shore grounds the downloaded skyline across the harbor.
 const shore=new T.Mesh(new T.RingGeometry(126,470,96),new T.MeshStandardMaterial({color:0x607a70,roughness:1}));shore.rotation.x=-Math.PI/2;shore.position.y=-.19;root.add(shore);
 const skylineNames=['building-skyscraper-a','building-skyscraper-b','building-skyscraper-c','building-skyscraper-d','building-skyscraper-e','building-a','building-c','building-f','building-g','building-k','low-detail-building-a','low-detail-building-c'];
 skylineNames.forEach((name,type)=>{
  const places=[];for(let j=0;j<(view.quest?3:7);j++){const angle=(type+j*skylineNames.length)*2.39996,r=152+rand()*148,h=(type<5?38:17)+rand()*(type<5?51:23);places.push({position:[Math.cos(angle)*r,-.15,Math.sin(angle)*r],yaw:Math.round(rand()*4)*Math.PI/2,height:h});}
  tasks.push(bakedModel(base+`city-kit-commercial/${name}.glb`).then(model=>{for(const p of places)p.scale=p.height/model.size.y;for(const part of model.parts)part.material.color.setHex(0x9aafb9);instances(root,model,places,{castShadow:false});}));
 });
 // Street cars sit in the existing traffic lanes, preserving walkable space.
 const cars=['taxi','sedan','police','van','firetruck','delivery'];
 cars.forEach((name,type)=>{const places=[];for(let i=type;i<42;i+=cars.length){const along=(i%14)*10-66,road=[-37,0,37][Math.floor(i/14)],swap=i%2;if([-37,0,37].some(n=>Math.abs(along-n)<8))continue;places.push({position:[swap?along:road+3.6,.13,swap?road-3.6:along],yaw:swap?Math.PI/2:Math.PI});}
  tasks.push(bakedModel(base+`car-kit/${name}.glb`).then(model=>{for(const p of places)p.scale=(type>2?4.8:3.9)/model.size.z;instances(root,model,places);}));
 });
 // Harbor equipment is outside the playable island. Roof props follow the bay
 // underneath them, including rotations, removal and full round resets.
 const roofAssets=[['city-kit-industrial/water-tower',2.8],['space-kit/satelliteDish_detailed',2.4],['city-kit-industrial/detail-tank',1.1],['city-kit-industrial/solar-panel-flat',.25]];
 roofAssets.forEach(([name,height],type)=>tasks.push(bakedModel(base+name+'.glb').then(model=>{
  const cells=view.cells.filter(c=>c.roof&&(c.ix+c.iz*2+c.building)%4===type);
  for(const part of model.parts){const batch=view.batch(part.geometry,part.material,cells.length);cells.forEach((c,index)=>{
    const local=new T.Matrix4().compose(new T.Vector3(0,c.size[1]/2+.02,0),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),c.building*Math.PI/2),new T.Vector3().setScalar(height/model.size.y));
    if(!view.attachments.has(c.id))view.attachments.set(c.id,[]);view.attachments.get(c.id).push({batch,index,local});
   });}
  for(const c of cells){const state=view.transforms.get(c.id);view.setCell(c.id,state.p,state.q,state.hidden);}view.commit();
 })));
 for(const [type,name]of ['shipping-container-a','shipping-container-b','building-a','building-g','chimney-large'].entries()){
  tasks.push(bakedModel(base+`city-kit-industrial/${name}.glb`).then(model=>{
   const places=[];for(let i=0;i<8;i++)places.push({position:[-107+i*28,-.15,-143-type*15],scale:(type<2?3.1:type===4?24:10)/model.size.y,yaw:Math.PI/2});instances(root,model,places,{castShadow:false});
  }));
 }
 const results=await Promise.allSettled(tasks);for(const result of results)if(result.status==='rejected')console.error('District asset failed to load',result.reason);
 return results;
}
