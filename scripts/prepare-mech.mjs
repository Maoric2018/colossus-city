// Turn the downloaded Quaternius Stan rig into rigid, textured armor parts.
// Runtime tracking drives these parts; animation buffers and skinning are unnecessary.
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent ??= class { constructor(type,values){this.type=type;Object.assign(this,values);} };
const source=process.argv[2]||'.cache/asset-downloads/Stan.gltf';
const original=JSON.parse(await fs.readFile(source,'utf8')),input=structuredClone(original);
input.animations=[];input.materials=[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:1}}];input.extensionsUsed=[];
const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(input),'');
scene.updateMatrixWorld(true);let skin;scene.traverse(o=>{if(o.isSkinnedMesh)skin=o;});skin.skeleton.update();
const geometry=skin.geometry,index=geometry.index,pos=geometry.attributes.position,weights=geometry.attributes.skinWeight,joints=geometry.attributes.skinIndex;
const turn=new T.Matrix4().makeRotationY(Math.PI),world=turn.clone().multiply(skin.matrixWorld),normalMatrix=new T.Matrix3().getNormalMatrix(world),parts=new Map();
function category(name){
 const side=name.endsWith('L')?'L':'R';
 if(/Head/.test(name))return 'head';
 if(/UpperArm/.test(name))return 'upper'+side;
 if(/LowerArm/.test(name))return 'lower'+side;
 if(/Palm|Finger|Pinky|Ring|Index|Thumb/.test(name))return 'fist'+side;
 if(/UpperLeg/.test(name))return 'thigh'+side;
 if(/LowerLeg/.test(name))return 'shin'+side;
 if(/Foot/.test(name))return 'foot'+side;
 return 'body';
}
for(let i=0;i<index.count;i+=3){
 const scores=new Map(),ids=[0,1,2].map(j=>index.getX(i+j));
 for(const v of ids)for(let k=0;k<4;k++){const w=weights.getComponent(v,k);if(!w)continue;const name=category(skin.skeleton.bones[joints.getComponent(v,k)].name);scores.set(name,(scores.get(name)||0)+w);}
 const name=[...scores].sort((a,b)=>b[1]-a[1])[0][0];if(!parts.has(name))parts.set(name,{p:[],n:[],uv:[]});const part=parts.get(name);
 for(const v of ids){const p=new T.Vector3().fromBufferAttribute(pos,v);skin.applyBoneTransform(v,p).applyMatrix4(world);part.p.push(...p.toArray());part.n.push(...new T.Vector3().fromBufferAttribute(geometry.attributes.normal,v).applyMatrix3(normalMatrix).normalize().toArray());part.uv.push(geometry.attributes.uv.getX(v),geometry.attributes.uv.getY(v));}
}
const doc={asset:{version:'2.0',generator:'Colossus City rigid armor preparation; source Quaternius Stan'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[{name:'Weathered teal armor',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:.5,roughnessFactor:.62}}],textures:[{source:0}],images:[{uri:'stan-texture.jpg'}]};
const chunks=[];let bytes=0;
function attribute(values,type){const data=new Float32Array(values),n=type==='VEC2'?2:3,view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.byteLength,target:34962});chunks.push(Buffer.from(data.buffer));bytes+=data.byteLength;const a={bufferView:view,componentType:5126,count:values.length/n,type};if(n===3){a.min=[0,1,2].map(k=>Math.min(...values.filter((_,i)=>i%3===k)));a.max=[0,1,2].map(k=>Math.max(...values.filter((_,i)=>i%3===k)));}doc.accessors.push(a);return doc.accessors.length-1;}
function bonePosition(name){return skin.skeleton.bones.find(b=>b.name===name).getWorldPosition(new T.Vector3()).applyMatrix4(turn);}
for(const [name,part]of parts){
 let rotation=new T.Quaternion(),center,size;
 const match=name.match(/^(upper|lower|thigh|shin)(L|R)$/);
 if(match){const [,kind,side]=match,pairs={upper:['UpperArm','LowerArm'],lower:['LowerArm','PalmP'],thigh:['UpperLeg','LowerLeg'],shin:['LowerLeg','Foot']},[a,b]=pairs[kind].map(n=>bonePosition(n+side));center=a.clone().lerp(b,.5);rotation.setFromUnitVectors(b.clone().sub(a).normalize(),new T.Vector3(0,1,0));size=new T.Vector3(1,a.distanceTo(b),1);}
 else {const box=new T.Box3();for(let i=0;i<part.p.length;i+=3)box.expandByPoint(new T.Vector3(...part.p.slice(i,i+3)));center=box.getCenter(new T.Vector3());size=box.getSize(new T.Vector3());}
 for(let i=0;i<part.p.length;i+=3){const p=new T.Vector3(...part.p.slice(i,i+3)).sub(center).applyQuaternion(rotation);if(match)p.y/=size.y;else p.divide(size);p.toArray(part.p,i);new T.Vector3(...part.n.slice(i,i+3)).applyQuaternion(rotation).multiply(size).normalize().toArray(part.n,i);}
 // Segment cross-sections normalized independently, retaining their joint positions.
 if(match){const xs=part.p.filter((_,i)=>i%3===0),zs=part.p.filter((_,i)=>i%3===2),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);for(let i=0;i<part.p.length;i+=3){part.p[i]/=w;part.p[i+2]/=d;new T.Vector3(part.n[i]*w,part.n[i+1],part.n[i+2]*d).normalize().toArray(part.n,i);}}
 doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push({name,mesh:doc.meshes.length});doc.meshes.push({primitives:[{attributes:{POSITION:attribute(part.p,'VEC3'),NORMAL:attribute(part.n,'VEC3'),TEXCOORD_0:attribute(part.uv,'VEC2')},material:0}]});
 console.log(name,part.p.length/9,'triangles');
}
doc.buffers[0].byteLength=bytes;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bytes,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bin=Buffer.alloc(8);bin.writeUInt32LE(bytes,0);bin.writeUInt32LE(0x004e4942,4);
await fs.writeFile('public/assets/imported/mechs/colossus.glb',Buffer.concat([header,json,bin,...chunks]));
