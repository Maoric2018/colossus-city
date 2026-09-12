// Offline source-mesh bounds; no images or browser required.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{constructor(type,values){Object.assign(this,values);}};
const names=['car-kit/taxi','car-kit/sedan','car-kit/police','car-kit/van','car-kit/firetruck','car-kit/delivery','city-kit-industrial/water-tower','space-kit/satelliteDish_detailed','city-kit-industrial/detail-tank','city-kit-industrial/solar-panel-flat'];
const result={};
for(const name of names){const bytes=await readFile('public/assets/imported/'+name+'.glb'),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));delete doc.images;delete doc.textures;doc.materials=[{}];for(const mesh of doc.meshes)for(const p of mesh.primitives)p.material=0;
 const bin=bytes.subarray(28+length);doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');scene.updateMatrixWorld(true);result[name]=new T.Box3().setFromObject(scene).getSize(new T.Vector3()).toArray();}
await writeFile('shared/prop-bounds.js','// Measured from bundled source models by scripts/measure-props.mjs.\nexport const propBounds='+JSON.stringify(result,null,2)+';\n');console.log(result);
