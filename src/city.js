import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {generateCells,cellColliders} from '../shared/environment.js';
import {seeded,rayAABB} from '../shared/math.js';
import {mergeParts,mesh,box,labelTexture,glow} from './art.js';
const temp=new T.Object3D(),matrix=new T.Matrix4(),offset=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0);
const skyVertex=`varying vec3 vDir; void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const skyFragment=`varying vec3 vDir;uniform vec3 topColor;uniform vec3 horizon;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(horizon,topColor,pow(h,.42));vec3 sun=normalize(vec3(-.8,.22,-.65));float s=max(dot(d,sun),0.);c+=vec3(1.,.51,.22)*pow(s,18.)*.37;c+=vec3(1.,.82,.48)*smoothstep(.9986,.9995,s)*2.;float cloud=sin(d.x*15.+sin(d.z*9.))*sin(d.z*20.+d.x*8.);c+=vec3(.035)*smoothstep(.2,.8,cloud)*smoothstep(0.,.25,h)*(1.-smoothstep(.3,.6,h));gl_FragColor=vec4(c,1.);}`;
export class CityView{
 constructor(scene,env,{quest=false}={}){
  this.scene=scene;this.env=env;this.quest=quest;this.root=new T.Group();scene.add(this.root);this.cells=generateCells(env);this.byId=new Map(this.cells.map(c=>[c.id,c]));this.entries=new Map();this.moving=new Map();this.batches=[];this.assetCells=new Map();this.transforms=new Map();this.colliderCache=new Map(this.cells.map(c=>[c.id,cellColliders(c)]));
  this.loader=new T.TextureLoader();this.materials=[];this.makeWorld();this.makeBuildings();this.makeDetails();this.loadCustomAssets();
 }
 texture(url,repeat=1,srgb=true){const t=this.loader.load(url);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;}
 makeWorld(){
  const env=this.env;
  this.scene.fog=new T.FogExp2(env.sky.fog,.0067);
  const sky=new T.Mesh(new T.SphereGeometry(500,32,16),new T.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:{topColor:{value:new T.Color(env.sky.top)},horizon:{value:new T.Color(env.sky.horizon)}},side:T.BackSide,depthWrite:false}));sky.renderOrder=-100;this.root.add(sky);
  const envScene=new T.Scene();envScene.add(sky.clone());this.envScene=envScene;
  const hemi=new T.HemisphereLight(0xb6dfe9,0x515348,2.1);this.root.add(hemi);
  const sun=new T.DirectionalLight(0xffd2a6,3.4);sun.position.set(-60,65,-40);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(this.quest?1024:2048);Object.assign(sun.shadow.camera,{left:-78,right:78,top:78,bottom:-78,near:1,far:180});sun.shadow.bias=-.00035;sun.shadow.normalBias=.06;this.root.add(sun);this.sun=sun;
  const concrete=this.texture(env.textures.concrete,30),asphalt=this.texture(env.textures.asphalt,38);
  const ground=new T.Mesh(new T.PlaneGeometry(164,164),new T.MeshStandardMaterial({map:asphalt,roughness:.78,color:0x727c80}));ground.rotation.x=-Math.PI/2;ground.position.y=.012;ground.receiveShadow=true;this.root.add(ground);
  const ocean=new T.Mesh(new T.PlaneGeometry(1800,1800,1,1),new T.MeshStandardMaterial({color:0x1a4b60,roughness:.29,metalness:.75}));ocean.rotation.x=-Math.PI/2;ocean.position.y=-.45;this.root.add(ocean);
  this.baseMaterial=new T.MeshStandardMaterial({map:concrete,roughness:.94,color:0x809092});
  box(this.root,[166,1,166],[0,-.52,0],this.baseMaterial);
  const markingMaterial=new T.MeshBasicMaterial({color:0xbebfaf}),yellow=new T.MeshBasicMaterial({color:0xbb984e});
  const markings=[];for(const axis of [0,1])for(const road of [-37,0,37])for(let j=-78;j<79;j+=7){const p=axis?[j,.037,road]:[road,.037,j],s=axis?[3,.014,.1]:[.1,.014,3];markings.push([new T.BoxGeometry(...s),p]);}
  mesh(mergeParts(markings),markingMaterial,this.root).castShadow=false;
  for(const road of [-37,0,37]){
   box(this.root,[.1,.02,155],[road-.22,.039,0],yellow).castShadow=false;box(this.root,[.1,.02,155],[road+.22,.039,0],yellow).castShadow=false;
   box(this.root,[155,.02,.1],[0,.04,road-.22],yellow).castShadow=false;box(this.root,[155,.02,.1],[0,.04,road+.22],yellow).castShadow=false;
  }
  const walks=[];for(const x of [-37,0,37])for(const z of [-37,0,37])for(let i=-3;i<=3;i++){
   for(const side of [-1,1]){walks.push([new T.BoxGeometry(.65,.016,2.3),[x+i*1.2,.06,z+side*7.2]]);walks.push([new T.BoxGeometry(2.3,.016,.65),[x+side*7.2,.06,z+i*1.2]]);}
  }
  mesh(mergeParts(walks),markingMaterial,this.root).castShadow=false;
  const plaza=new T.Mesh(new T.CircleGeometry(8.5,48),new T.MeshStandardMaterial({map:concrete,color:0xa4b3af,roughness:.65}));plaza.rotation.x=-Math.PI/2;plaza.position.y=.1;this.root.add(plaza);
  const ring=new T.Mesh(new T.RingGeometry(6.9,7.05,64),new T.MeshBasicMaterial({color:0x7addcd}));ring.rotation.x=-Math.PI/2;ring.position.y=.11;this.root.add(ring);
  for(const p of env.spawns){const pad=new T.Mesh(new T.CircleGeometry(3.8,40),new T.MeshStandardMaterial({color:0x234348,metalness:.55,roughness:.6}));pad.rotation.x=-Math.PI/2;pad.position.set(p[0],.05,p[2]);this.root.add(pad);const t=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshBasicMaterial({map:labelTexture('H',{bg:'#25494b',fg:'#b8efad',w:256,h:256}),transparent:false}));t.rotation.x=-Math.PI/2;t.position.set(p[0],.07,p[2]);this.root.add(t);}
 }
 batch(g,m,n){const b=new T.InstancedMesh(g,m,n);b.instanceMatrix.setUsage(T.DynamicDrawUsage);b.frustumCulled=false;b.castShadow=true;b.receiveShadow=true;this.root.add(b);this.batches.push(b);return b;}
 makeBuildings(){
  const facade=this.texture(this.env.textures.facade),normal=this.texture(this.env.textures.facadeNormal,1,false),emissive=this.texture(this.env.textures.facadeEmissive);
  const stone=this.texture(this.env.textures.concrete,1);
  const slabGeometry=mergeParts([
   [new T.BoxGeometry(.998,.078,.998),[0,.461,0]],
   ...[-1,1].flatMap(x=>[-1,1].map(z=>[new T.BoxGeometry(.057,.922,.057),[x*.47,-.02,z*.47]]))
  ]);
  this.structural=this.batch(slabGeometry,new T.MeshStandardMaterial({map:stone,color:0x879398,roughness:.84}),this.cells.length);
  const styles=[0x7b9caa,0x5b7e8c,0xa79b88];
  this.wallBatches=styles.map(color=>this.batch(new T.BoxGeometry(.887,.84,.026),new T.MeshStandardMaterial({map:facade,normalMap:normal,normalScale:new T.Vector2(.35,.35),emissiveMap:emissive,emissive:0xffc780,emissiveIntensity:.68,color,roughness:.42,metalness:.42}),this.cells.length*4));
  this.wallCount=[0,0,0];
  this.cells.forEach((c,i)=>{
   const e={index:i,walls:[],size:new T.Vector3(...c.size),base:new T.Vector3(...c.p)};
   c.walls.forEach((visible,side)=>{if(visible)e.walls.push({side,index:this.wallCount[c.style]++});});this.entries.set(c.id,e);this.setCell(c.id,new T.Vector3(...c.p),new T.Quaternion());
  });this.wallBatches.forEach((b,i)=>b.count=this.wallCount[i]);this.commit();
  // Detailed roof furniture is batched. It follows the cell below it on collapse.
  const roofGeometry=mergeParts([[new T.BoxGeometry(.5,.12,.38),[0,.56,0]],[new T.BoxGeometry(.08,.06,.4),[-.2,.65,0]],[new T.BoxGeometry(.08,.06,.4),[.2,.65,0]],[new T.CylinderGeometry(.1,.1,.09,10),[0,.665,0]]]);
  this.roofs=this.batch(roofGeometry,new T.MeshStandardMaterial({color:0x637d82,metalness:.7,roughness:.64}),this.cells.length);this.roofs.count=this.cells.length;
  for(const c of this.cells){this.roofs.setMatrixAt(this.entries.get(c.id).index,c.roof?this.cellMatrix(c):zero);}this.roofs.instanceMatrix.needsUpdate=true;
 }
 cellMatrix(c){temp.position.set(...c.p);temp.rotation.set(0,0,0);temp.scale.set(...c.size);temp.updateMatrix();return temp.matrix;}
 setCell(id,p,q,hidden=false){
  const c=this.byId.get(id),e=this.entries.get(id);if(!e)return;
  this.transforms.set(id,{p:p.clone(),q:q.clone(),hidden});
  temp.position.copy(p);temp.quaternion.copy(q);temp.scale.copy(e.size);temp.updateMatrix();const m=(hidden||this.assetCells.has(id))?zero:temp.matrix;
  this.structural.setMatrixAt(e.index,m);if(this.roofs)this.roofs.setMatrixAt(e.index,c.roof?m:zero);
  const s=new T.Matrix4();for(const w of e.walls){
   const a=w.side*Math.PI/2,pos=new T.Vector3(Math.sin(a)*.48,0,-Math.cos(a)*.48),rot=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-a);
   s.compose(pos,rot,new T.Vector3(1,1,1));matrix.multiplyMatrices(m,s);this.wallBatches[c.style].setMatrixAt(w.index,matrix);
  }
  const asset=this.assetCells.get(id);if(asset){for(const part of asset){matrix.multiplyMatrices(temp.matrix,part.local);part.batch.setMatrixAt(part.index,hidden||!part.active?zero:matrix);}}
 }
 commit(){for(const b of this.batches)b.instanceMatrix.needsUpdate=true;}
 addDebris(e){this.moving.set(e.id,{cells:e.cells,origin:new T.Vector3(...e.origin)});this.poseDebris(e.id,e.p,e.q);}
 poseDebris(id,p,q){const e=this.moving.get(id);if(!e)return;const pos=new T.Vector3(...p),rot=new T.Quaternion(...q);
  for(const cId of e.cells){const c=this.byId.get(cId),off=new T.Vector3(...c.p).sub(e.origin).applyQuaternion(rot).add(pos);this.setCell(cId,off,rot);}
 }
 removeDebris(id){const e=this.moving.get(id);if(!e)return;for(const c of e.cells)this.setCell(c,new T.Vector3(),new T.Quaternion(),true);this.moving.delete(id);this.commit();}
 hideCells(ids){for(const id of ids)this.setCell(id,new T.Vector3(),new T.Quaternion(),true);this.commit();}
 reset(){this.moving.clear();for(const c of this.cells)this.setCell(c.id,new T.Vector3(...c.p),new T.Quaternion());this.commit();}
 makeDetails(){
  const rand=seeded(this.env.seed),dark=new T.MeshStandardMaterial({color:0x293d42,metalness:.65,roughness:.61});
  // Pavement, steps, and signboards. These are static non-interactive trim.
  for(const b of this.env.buildings){
   const w=b.nx*b.bay,d=b.nz*b.bay;
   box(this.root,[w+3,.16,d+3],[b.x,.08,b.z],this.baseMaterial);
   for(const z of [-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(w*.84,.9),new T.MeshBasicMaterial({map:labelTexture(b.name),toneMapped:false}));sign.position.set(b.x,1.4,b.z+z*(d/2+.12));if(z<0)sign.rotation.y=Math.PI;this.root.add(sign);for(const dx of [-1,1])box(this.root,[.07,1.85,.07],[b.x+dx*w*.36,.93,sign.position.z],dark);}
  }
  // One draw call per car material, instead of hundreds of separate body panels.
  const carGeometry=mergeParts([[new T.BoxGeometry(1.6,.65,3.4),[0,.48,0]],[new T.BoxGeometry(1.3,.5,1.8),[0,1.03,-.2]]]);
  const cars=new T.InstancedMesh(carGeometry,new T.MeshStandardMaterial({color:0xffffff,metalness:.62,roughness:.34}),44);
  cars.castShadow=true;cars.receiveShadow=true;this.root.add(cars);
  const windowGeometry=new T.BoxGeometry(1.32,.37,1.5),windows=new T.InstancedMesh(windowGeometry,new T.MeshStandardMaterial({color:0x152a39,metalness:.7,roughness:.2}),44);this.root.add(windows);
  for(let i=0;i<44;i++){
   const along=(i%11)*13-65,road=[-37,0,37][Math.floor(i/11)%3],swap=i%2;
   temp.position.set(swap?along:road+3.4,.15,swap?road+3.4:along);temp.rotation.set(0,swap?Math.PI/2:0,0);temp.scale.setScalar(1);temp.updateMatrix();cars.setMatrixAt(i,temp.matrix);cars.setColorAt(i,new T.Color([0xd1ad55,0xb9c3c1,0x526d7c,0xa16156,0x586675][i%5]));
   temp.position.y=1.18;temp.updateMatrix();windows.setMatrixAt(i,temp.matrix);
  }
  const lamps=[];for(const x of [-44,-7,7,44])for(let z=-68;z<=68;z+=20){
   lamps.push([new T.CylinderGeometry(.065,.09,5,5),[x,2.6,z]],[new T.BoxGeometry(1.4,.09,.09),[x+.6,5.1,z]]);
   const light=box(this.root,[.75,.04,.28],[x+1,5.03,z],new T.MeshBasicMaterial({color:0xffd998,toneMapped:false}));light.castShadow=false;
  }
  mesh(mergeParts(lamps),dark,this.root);
  // Decorative far skyline, non-collidable and outside the playable island.
  const count=this.quest?90:160,skyline=this.batch(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({map:this.wallBatches[0].material.map,color:0x55788a,roughness:.7,metalness:.2}),count);skyline.castShadow=false;
  for(let i=0;i<count;i++){
   const a=rand()*Math.PI*2,r=140+rand()*170,h=14+Math.pow(rand(),1.6)*70;
   temp.position.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r);temp.rotation.set(0,0,0);temp.scale.set(8+rand()*13,h,8+rand()*12);temp.updateMatrix();skyline.setMatrixAt(i,temp.matrix);
  }
  const bridgeParts=[];for(const z of [-1,1]){
   const bz=z*91;bridgeParts.push([new T.BoxGeometry(370,.8,7),[0,3.4,bz]]);
   for(const x of [-100,-40,40,100]){bridgeParts.push([new T.BoxGeometry(1.4,23,1.5),[x,11,bz-3]],[new T.BoxGeometry(1.4,23,1.5),[x,11,bz+3]],[new T.BoxGeometry(1.4,1,7.5),[x,21.5,bz]]);}
   for(let x=-150;x<150;x+=6){const y=5+13*Math.pow(Math.cos(x*Math.PI/80),2);bridgeParts.push([new T.CylinderGeometry(.05,.05,Math.max(.1,y-4),4),[x,(y+4)/2,bz-3]],[new T.CylinderGeometry(.05,.05,Math.max(.1,y-4),4),[x,(y+4)/2,bz+3]]);}
  }
  mesh(mergeParts(bridgeParts),new T.MeshStandardMaterial({color:0x687f82,metalness:.55,roughness:.7}),this.root).castShadow=false;
 }
 rayDistance(origin,direction,maxDistance,padding=0){
  let result=maxDistance;
  const o=new T.Vector3(),d=new T.Vector3(),inv=new T.Quaternion(),center=new T.Vector3(),half=new T.Vector3();
  for(const c of this.cells){
   const state=this.transforms.get(c.id);if(!state||state.hidden)continue;
   inv.copy(state.q).invert();o.copy(origin).sub(state.p).applyQuaternion(inv);d.copy(direction).applyQuaternion(inv);
   half.set(c.size[0]/2,c.size[1]/2,c.size[2]/2);center.set(0,0,0);
   if(rayAABB(o,d,center,half,result,padding)===Infinity)continue;
   for(const a of this.colliderCache.get(c.id)){center.set(a[0],a[1],a[2]);half.set(a[3],a[4],a[5]);result=Math.min(result,rayAABB(o,d,center,half,result,padding));}
  }
  return result;
 }
 async loadCustomAssets(){
  const loader=new GLTFLoader();
  // Prefab meshes must retain separate structural node names to preserve breakability.
  for(const [style,url] of Object.entries(this.env.cellAssets||{})){
   try{
    const gltf=await loader.loadAsync(url),cells=this.cells.filter(c=>String(c.style)===style),nodes=[];
    gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(n=>{if(n.isMesh&&!n.isSkinnedMesh)nodes.push(n);});
    if(!nodes.length)throw Error('A cell GLB needs at least one unskinned mesh.');
    if(!cells.length)continue;
    for(const c of cells)this.assetCells.set(c.id,[]);
    for(const node of nodes){
     const batch=this.batch(node.geometry,node.material,cells.length),local=node.matrixWorld.clone();
     let semantic=node.name,ancestor=node;while(ancestor&&ancestor!==gltf.scene){if(['wall_n','wall_e','wall_s','wall_w','roof'].includes(ancestor.name)){semantic=ancestor.name;break;}ancestor=ancestor.parent;}
     const side=['wall_n','wall_e','wall_s','wall_w'].indexOf(semantic);
     cells.forEach((c,index)=>this.assetCells.get(c.id).push({batch,index,local,active:(side<0||c.walls[side])&&(semantic!=='roof'||c.roof)}));
    }
    for(const c of cells){const state=this.transforms.get(c.id);this.setCell(c.id,state.p,state.q,state.hidden);}this.commit();
   }catch(e){console.warn('Custom cell asset unavailable; retaining default architecture.',url,e);}
  }
  for(const prop of this.env.props){if(!prop.url)continue;try{const a=await loader.loadAsync(prop.url),o=a.scene;o.position.set(...(prop.position||[0,0,0]));o.rotation.set(...(prop.rotation||[0,0,0]));o.scale.setScalar(prop.scale||1);this.root.add(o);}catch(e){console.warn('Optional prop failed',e);}}
 }
}
