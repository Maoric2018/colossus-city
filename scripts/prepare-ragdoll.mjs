// Keep the normal pilot's exact posed surface, but bind it to the 11 physics bodies.
// Source URL and pose are recorded alongside scripts/prepare-raider.mjs.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
globalThis.ProgressEvent??=class{constructor(type,values){Object.assign(this,values);}};
const {scene,animations}=await new GLTFLoader().parseAsync(await readFile('.cache/asset-downloads/Spacesuit.gltf','utf8'),'');
const mixer=new T.AnimationMixer(scene);mixer.clipAction(animations.find(a=>a.name==='Idle_Gun_Pointing')).play();mixer.update(.3);scene.updateMatrixWorld(true);
const names=['hips','chest','head','upperL','lowerL','upperR','lowerR','thighL','shinL','thighR','shinR'];
function bodyIndex(name){
 const side=name.endsWith('L')?'L':'R';
 if(/^(Neck|Head)$/.test(name))return 2;
 if(/^(Torso|Chest)$/.test(name))return 1;
 if(/^(Shoulder|UpperArm)/.test(name))return names.indexOf('upper'+side);
 if(/^(LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(name))return names.indexOf('lower'+side);
 if(name.startsWith('UpperLeg'))return names.indexOf('thigh'+side);
 if(/^(LowerLeg|Foot|PT)/.test(name))return names.indexOf('shin'+side);
 return 0;
}
const turn=new T.Matrix4().makeRotationY(Math.PI),parts=[];
scene.traverse(node=>{
 if(!node.isMesh)return;node.skeleton?.update();const g=node.geometry.clone(),p=g.attributes.position,tmp=new T.Vector3();
 for(let i=0;i<p.count;i++){tmp.fromBufferAttribute(p,i);if(node.isSkinnedMesh)node.applyBoneTransform(i,tmp);tmp.applyMatrix4(node.matrixWorld).applyMatrix4(turn);p.setXYZ(i,...tmp.toArray());}
 g.computeVertexNormals();const geo=g.index?g.toNonIndexed():g,mats=Array.isArray(node.material)?node.material:[node.material],colors=new Float32Array(geo.attributes.position.count*3);
 for(const group of geo.groups.length?geo.groups:[{start:0,count:geo.attributes.position.count,materialIndex:0}])for(let i=group.start;i<group.start+group.count;i++)mats[group.materialIndex].color.toArray(colors,i*3);
 geo.setAttribute('color',new T.BufferAttribute(colors,3));
 const indices=new Uint16Array(geo.attributes.position.count*4),weights=new Float32Array(indices.length);
 for(let i=0;i<geo.attributes.position.count;i++){
  const mapped=new Map();for(let j=0;j<4;j++){const w=geo.attributes.skinWeight?.getComponent(i,j)||0;if(!w)continue;const bone=node.skeleton.bones[geo.attributes.skinIndex.getComponent(i,j)],index=bodyIndex(bone.name);mapped.set(index,(mapped.get(index)||0)+w);}
  const influences=[...mapped.entries()];if(!influences.length)influences.push([0,1]);const total=influences.reduce((a,b)=>a+b[1],0);
  influences.forEach(([index,w],j)=>{indices[i*4+j]=index;weights[i*4+j]=w/total;});
 }
 geo.setAttribute('skinIndex',new T.BufferAttribute(indices,4));geo.setAttribute('skinWeight',new T.BufferAttribute(weights,4));
 for(const name of Object.keys(geo.attributes))if(!['position','normal','color','skinIndex','skinWeight'].includes(name))geo.deleteAttribute(name);geo.clearGroups();parts.push(geo);
});
const geo=mergeGeometries(parts);geo.computeBoundingBox();const center=geo.boundingBox.getCenter(new T.Vector3()),scale=2.2/geo.boundingBox.getSize(new T.Vector3()).y,base=new T.Vector3(center.x,geo.boundingBox.min.y,center.z);
geo.translate(-base.x,-base.y,-base.z);geo.scale(scale,scale,scale);geo.translate(0,-1.15,0);
const anchor=name=>scene.getObjectByName(name).getWorldPosition(new T.Vector3()).applyMatrix4(turn).sub(base).multiplyScalar(scale).add(new T.Vector3(0,-1.15,0)).toArray();
const bounds=names.map(()=>new T.Box3()),p=geo.attributes.position,weights=geo.attributes.skinWeight,indices=geo.attributes.skinIndex;
for(let i=0;i<p.count;i++){let strongest=0;for(let j=1;j<4;j++)if(weights.getComponent(i,j)>weights.getComponent(i,strongest))strongest=j;bounds[indices.getComponent(i,strongest)].expandByPoint(new T.Vector3().fromBufferAttribute(p,i));}
const definitions=names.map((name,i)=>({name,o:bounds[i].getCenter(new T.Vector3()).toArray(),s:bounds[i].getSize(new T.Vector3()).toArray().map(v=>Math.max(.1,v))}));
const links=[[0,1,'Abdomen'],[1,2,'Neck'],[1,3,'UpperArmL'],[3,4,'LowerArmL',true],[1,5,'UpperArmR'],[5,6,'LowerArmR',true],[0,7,'UpperLegL'],[7,8,'LowerLegL',true],[0,9,'UpperLegR'],[9,10,'LowerLegR',true]].map(([a,b,bone,hinge=false])=>({a,b,anchor:anchor(bone),hinge,axis:new T.Vector3(1,0,0).applyQuaternion(scene.getObjectByName(bone).getWorldQuaternion(new T.Quaternion())).transformDirection(turn).toArray()}));
const weaponMount=anchor('WristR').map((v,i)=>v+(i===1?1.15:0));
const doc={asset:{version:'2.0',generator:'Colossus City: same Quaternius pilot, bound to authoritative ragdoll'},scene:0,scenes:[{nodes:[0,...names.map((_,i)=>i+1)]}],nodes:[{name:'Raider_Ragdoll',mesh:0,skin:0,extras:{weaponMount}},...definitions.map(d=>({name:'rag_'+d.name,translation:d.o}))],meshes:[{primitives:[{attributes:{},material:0}]}],materials:[{name:'Industrial flight armor',pbrMetallicRoughness:{metallicFactor:.45,roughnessFactor:.55}}],skins:[{joints:names.map((_,i)=>i+1)}],buffers:[{byteLength:0}],bufferViews:[],accessors:[]},chunks=[];let bytes=0;
function buffer(array,type,count,componentType,target){
 const pad=(4-bytes%4)%4;if(pad){chunks.push(Buffer.alloc(pad));bytes+=pad;}doc.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:array.byteLength,...(target?{target}:{})});doc.accessors.push({bufferView:doc.bufferViews.length-1,componentType,count,type});chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));bytes+=array.byteLength;return doc.accessors.length-1;
}
for(const [name,semantic]of [['position','POSITION'],['normal','NORMAL'],['color','COLOR_0'],['skinIndex','JOINTS_0'],['skinWeight','WEIGHTS_0']]){const a=geo.attributes[name],i=buffer(a.array,a.itemSize===4?'VEC4':'VEC3',a.count,name==='skinIndex'?5123:5126,34962);doc.meshes[0].primitives[0].attributes[semantic]=i;if(name==='position'){geo.computeBoundingBox();doc.accessors[i].min=geo.boundingBox.min.toArray();doc.accessors[i].max=geo.boundingBox.max.toArray();}}
const inverses=new Float32Array(names.length*16);definitions.forEach((d,i)=>new T.Matrix4().makeTranslation(...d.o.map(v=>-v)).toArray(inverses,i*16));doc.skins[0].inverseBindMatrices=buffer(inverses,'MAT4',names.length,5126);
doc.buffers[0].byteLength=bytes;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bytes,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bin=Buffer.alloc(8);bin.writeUInt32LE(bytes);bin.writeUInt32LE(0x004e4942,4);
await writeFile('public/assets/imported/raider/armored-ragdoll.glb',Buffer.concat([header,json,bin,...chunks]));
const gear=[{part:'chest',o:[0,.2025,.315],s:[.76,.555,.27]},{part:'lowerR',o:[weaponMount[0],weaponMount[1]-1.25+.165,weaponMount[2]-.13],s:[.12,.33,.6]}];
await writeFile('shared/raider-rig.js','// Generated from the same posed source as the live pilot by scripts/prepare-ragdoll.mjs.\nexport const raiderParts='+JSON.stringify(definitions,null,2)+';\nexport const raiderLinks='+JSON.stringify(links,null,2)+';\nexport const raiderGear='+JSON.stringify(gear,null,2)+';\n');
console.log({triangles:p.count/3,bytes:28+json.length+bytes,parts:definitions});
