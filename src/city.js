import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {staticProps,roofProp} from '../shared/props.js';
import {generateCells,cellColliders} from '../shared/environment.js';
import {rayAABB} from '../shared/math.js';
import {mergeParts,mesh,box,labelTexture} from './art.js';
const temp=new T.Object3D(),matrix=new T.Matrix4(),offset=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0);
const skyVertex=`varying vec3 vDir; void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const skyFragment=`varying vec3 vDir;uniform vec3 topColor;uniform vec3 horizon;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(horizon,topColor,pow(h,.42));vec3 sun=normalize(vec3(-.8,.22,-.65));float s=max(dot(d,sun),0.);c+=vec3(1.,.51,.22)*pow(s,18.)*.37;c+=vec3(1.,.82,.48)*smoothstep(.9986,.9995,s)*2.;float cloud=sin(d.x*15.+sin(d.z*9.))*sin(d.z*20.+d.x*8.);c+=vec3(.035)*smoothstep(.2,.8,cloud)*smoothstep(0.,.25,h)*(1.-smoothstep(.3,.6,h));gl_FragColor=vec4(c,1.);}`;
export class CityView{
 constructor(scene,env,{quest=false}={}){
  this.scene=scene;this.env=env;this.quest=quest;this.root=new T.Group();scene.add(this.root);this.cells=generateCells(env);this.byId=new Map(this.cells.map(c=>[c.id,c]));this.entries=new Map();this.moving=new Map();this.batches=[];this.assetCells=new Map();this.attachments=new Map();this.dirty=new Set();this.transforms=new Map();this.props=staticProps(env);this.colliderCache=new Map(this.cells.map(c=>[c.id,cellColliders(c)]));
  this.loader=new T.TextureLoader();this.materials=[];this.makeWorld();this.makeBuildings();this.makeDetails();this.ready=this.loadCustomAssets();
 }
 texture(url,repeat=1,srgb=true){const t=this.loader.load(url);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;}
 makeWorld(){
  const env=this.env;
  this.scene.fog=new T.FogExp2(0xacc2c6,.0035);
  const sky=new T.Mesh(new T.SphereGeometry(500,32,16),new T.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:{topColor:{value:new T.Color(env.sky.top)},horizon:{value:new T.Color(env.sky.horizon)}},side:T.BackSide,depthWrite:false}));this.sky=sky;sky.renderOrder=-100;this.root.add(sky);
  const hemi=new T.HemisphereLight(0xc5e8f5,0x677965,1.5);this.root.add(hemi);
  const sun=new T.DirectionalLight(0xffddbb,3.1);sun.position.set(-60,65,-40);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(this.quest?1024:2048);Object.assign(sun.shadow.camera,{left:-78,right:78,top:78,bottom:-78,near:1,far:180});sun.shadow.bias=-.00035;sun.shadow.normalBias=.06;this.root.add(sun);this.sun=sun;
  const concrete=this.texture(env.textures.concrete,30),asphalt=this.texture(env.textures.asphalt,38);
  const ground=new T.Mesh(new T.PlaneGeometry(164,164),new T.MeshStandardMaterial({map:asphalt,normalMap:env.textures.asphaltNormal?this.texture(env.textures.asphaltNormal,38,false):null,normalScale:new T.Vector2(.3,.3),roughnessMap:env.textures.asphaltRoughness?this.texture(env.textures.asphaltRoughness,38,false):null,roughness:.9,color:0xa1aaab}));ground.rotation.x=-Math.PI/2;ground.position.y=.012;ground.receiveShadow=true;this.root.add(ground);
  const ocean=new T.Mesh(new T.PlaneGeometry(1800,1800,1,1),new T.MeshStandardMaterial({color:0x286a78,roughness:.26,metalness:.5}));ocean.rotation.x=-Math.PI/2;ocean.position.y=-.45;this.root.add(ocean);
  this.waterTime={value:0};ocean.material.onBeforeCompile=shader=>{
   shader.uniforms.harborTime=this.waterTime;
   shader.vertexShader='varying vec3 harborPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nharborPosition=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='uniform float harborTime;varying vec3 harborPosition;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 wave=vec2(sin(harborPosition.x*.29+harborPosition.z*.13+harborTime*.7),cos(harborPosition.z*.41-harborPosition.x*.17+harborTime*.55));
    normal=normalize(normal+mat3(viewMatrix)*vec3(wave.x*.18,0.,wave.y*.18));`);
  };
  this.baseMaterial=new T.MeshStandardMaterial({map:concrete,normalMap:env.textures.concreteNormal?this.texture(env.textures.concreteNormal,30,false):null,normalScale:new T.Vector2(.22,.22),roughnessMap:env.textures.concreteRoughness?this.texture(env.textures.concreteRoughness,30,false):null,roughness:.9,color:0xd7d0bd});
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
 batch(g,m,n){const b=new T.InstancedMesh(g,m,n);b.instanceMatrix.setUsage(T.DynamicDrawUsage);b.frustumCulled=false;b.castShadow=true;b.receiveShadow=true;this.root.add(b);this.batches.push(b);this.dirty.add(b);return b;}
 makeBuildings(){
  const facade=this.texture(this.env.textures.facade),normal=this.texture(this.env.textures.facadeNormal,1,false),emissive=this.texture(this.env.textures.facadeEmissive);
  const stone=this.texture(this.env.textures.concrete,1);
  const slabGeometry=mergeParts([
   [new T.BoxGeometry(.998,.078,.998),[0,.461,0]],
   ...[-1,1].flatMap(x=>[-1,1].map(z=>[new T.BoxGeometry(.057,.922,.057),[x*.47,-.02,z*.47]]))
  ]);
  this.structural=this.batch(slabGeometry,new T.MeshStandardMaterial({map:stone,color:0xcbd0cb,roughness:.78}),this.cells.length);
  const styles=[0x72a6b5,0x526b80,0xc3b7a0];
  this.wallBatches=styles.map(color=>this.batch(new T.BoxGeometry(.887,.84,.026),new T.MeshStandardMaterial({map:facade,normalMap:normal,normalScale:new T.Vector2(.35,.35),emissiveMap:emissive,emissive:0xffc780,emissiveIntensity:.3,color,roughness:.28,metalness:.58}),this.cells.length*4));
  const trimGeometry=mergeParts([
   ...[-.445,-.222,0,.222,.445].map(x=>[new T.PlaneGeometry(.016,.86).rotateY(Math.PI),[x,0,-.036]]),
   ...[-.425,0,.425].map(y=>[new T.PlaneGeometry(.902,.018).rotateY(Math.PI),[0,y,-.039]]),
   [new T.BoxGeometry(.97,.038,.08),[0,.43,0]]
  ]);
  const trimMaterial=new T.MeshStandardMaterial({color:0x9aaab1,roughness:.42,metalness:.65});
  this.trimBatches=styles.map(()=>this.batch(trimGeometry,trimMaterial,this.cells.length*4));
  this.wallCount=[0,0,0];
  this.cells.forEach((c,i)=>{
   const e={index:i,walls:[],size:new T.Vector3(...c.size),base:new T.Vector3(...c.p)};
   c.walls.forEach((visible,side)=>{if(visible)e.walls.push({side,index:this.wallCount[c.style]++});});this.entries.set(c.id,e);this.setCell(c.id,new T.Vector3(...c.p),new T.Quaternion());
  });this.wallBatches.forEach((b,i)=>{b.count=this.wallCount[i];this.trimBatches[i].count=this.wallCount[i];});this.commit();

 }
 cellMatrix(c){temp.position.set(...c.p);temp.rotation.set(0,0,0);temp.scale.set(...c.size);temp.updateMatrix();return temp.matrix;}
 setCell(id,p,q,hidden=false){
  const c=this.byId.get(id),e=this.entries.get(id);if(!e)return;
  this.transforms.set(id,{p:p.clone(),q:q.clone(),hidden});
  temp.position.copy(p);temp.quaternion.copy(q);temp.scale.copy(e.size);temp.updateMatrix();const m=(hidden||this.assetCells.has(id))?zero:temp.matrix;
  this.structural.setMatrixAt(e.index,m);this.dirty.add(this.structural);
  const s=new T.Matrix4();for(const w of e.walls){
   const a=w.side*Math.PI/2,pos=new T.Vector3(Math.sin(a)*.48,0,-Math.cos(a)*.48),rot=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-a);
   s.compose(pos,rot,new T.Vector3(1,1,1));matrix.multiplyMatrices(m,s);this.wallBatches[c.style].setMatrixAt(w.index,matrix);this.trimBatches[c.style].setMatrixAt(w.index,matrix);this.dirty.add(this.wallBatches[c.style]);this.dirty.add(this.trimBatches[c.style]);
  }
  const attached=this.attachments.get(id);if(attached){offset.compose(p,q,new T.Vector3(1,1,1));for(const part of attached){matrix.multiplyMatrices(offset,part.local);part.batch.setMatrixAt(part.index,hidden?zero:matrix);this.dirty.add(part.batch);}}
  const asset=this.assetCells.get(id);if(asset){for(const part of asset){matrix.multiplyMatrices(temp.matrix,part.local);part.batch.setMatrixAt(part.index,hidden||!part.active?zero:matrix);this.dirty.add(part.batch);}}
 }
 commit(){for(const b of this.dirty)b.instanceMatrix.needsUpdate=true;this.dirty.clear();}
 update(dt){this.waterTime.value+=dt;}
 addDebris(e){this.moving.set(e.id,{cells:e.cells,origin:new T.Vector3(...e.origin)});this.poseDebris(e.id,e.p,e.q);}
 poseDebris(id,p,q){const e=this.moving.get(id);if(!e)return;const pos=new T.Vector3(...p),rot=new T.Quaternion(...q);
  for(const cId of e.cells){const c=this.byId.get(cId),off=new T.Vector3(...c.p).sub(e.origin).applyQuaternion(rot).add(pos);this.setCell(cId,off,rot);}
 }
 removeDebris(id){const e=this.moving.get(id);if(!e)return;for(const c of e.cells)this.setCell(c,new T.Vector3(),new T.Quaternion(),true);this.moving.delete(id);this.commit();}
 hideCells(ids){for(const id of ids)this.setCell(id,new T.Vector3(),new T.Quaternion(),true);this.commit();}
 reset(){this.moving.clear();for(const c of this.cells)this.setCell(c.id,new T.Vector3(...c.p),new T.Quaternion());this.commit();}
 makeDetails(){
  const dark=new T.MeshStandardMaterial({color:0x293d42,metalness:.65,roughness:.61});
  // Pavement, steps, and signboards. Fixed collision proxies are defined in shared/props.js.
  for(const b of this.env.buildings){
   const w=b.nx*b.bay,d=b.nz*b.bay;
   box(this.root,[w+3,.16,d+3],[b.x,.08,b.z],this.baseMaterial);
   for(const z of [-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(w*.84,.9),new T.MeshBasicMaterial({map:labelTexture(b.name),toneMapped:false}));sign.position.set(b.x,1.4,b.z+z*(d/2+.12));if(z<0)sign.rotation.y=Math.PI;this.root.add(sign);for(const dx of [-1,1])box(this.root,[.07,1.85,.07],[b.x+dx*w*.36,.93,sign.position.z],dark);}
  }
  const lamps=[],bulbs=[];for(const x of [-44,-7,7,44])for(let z=-68;z<=68;z+=20){
   lamps.push([new T.CylinderGeometry(.065,.09,5,5),[x,2.6,z]],[new T.BoxGeometry(1.4,.09,.09),[x+.6,5.1,z]]);
   bulbs.push([new T.BoxGeometry(.75,.04,.28),[x+1,5.03,z]]);
  }
  mesh(mergeParts(lamps),dark,this.root);mesh(mergeParts(bulbs),new T.MeshBasicMaterial({color:0xffd998,toneMapped:false}),this.root).castShadow=false;
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
   const roof=roofProp(c);half.set(Math.max(c.size[0]/2,roof?Math.max(roof.size[0],roof.size[2])/2:0),c.size[1]/2+(roof?.height||0)/2+.02,Math.max(c.size[2]/2,roof?Math.max(roof.size[0],roof.size[2])/2:0));center.set(0,(roof?.height||0)/2,0);
   if(rayAABB(o,d,center,half,result,padding)===Infinity)continue;
   for(const a of this.colliderCache.get(c.id)){center.set(a[0],a[1],a[2]);half.set(a[3],a[4],a[5]);result=Math.min(result,rayAABB(o,d,center,half,result,padding));}
  }
  for(const prop of this.props){inv.setFromAxisAngle(new T.Vector3(0,1,0),-prop.yaw);o.copy(origin).sub(new T.Vector3(...prop.position)).applyQuaternion(inv);d.copy(direction).applyQuaternion(inv);for(const a of prop.boxes){center.set(a[0],a[1],a[2]);half.set(a[3],a[4],a[5]);result=Math.min(result,rayAABB(o,d,center,half,result,padding));}}
  for(const prop of this.env.props||[]){if(!prop.collider)continue;inv.setFromEuler(new T.Euler(...(prop.rotation||[0,0,0]))).invert();o.copy(origin).sub(new T.Vector3(...(prop.position||[0,0,0]))).applyQuaternion(inv);d.copy(direction).applyQuaternion(inv);center.fromArray(prop.collider.offset||[0,0,0]).multiplyScalar(prop.scale||1);half.fromArray(prop.collider.half).multiplyScalar(prop.scale||1);result=Math.min(result,rayAABB(o,d,center,half,result,padding));}
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
