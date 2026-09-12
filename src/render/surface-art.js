// Downloaded painted materials, decoded once before the city is built. Final maps
// are shared at 256px on Quest/mobile and 512px on desktop, including fracture art.
import * as T from 'three';
const root='/assets/imported/stylized/',names=['brick','paving','metal','vent','concrete','marble'];
const images=new Map(),maps=new Map();let loading;
export const surfaceArtStatus={loaded:[],failed:[],ready:false,size:256};
export function loadSurfaceArt(size=256){
 if(loading)return loading;surfaceArtStatus.size=Math.min(512,size);
 loading=Promise.all(names.map(name=>new Promise(resolve=>{
  const url=root+name+'.webp',image=new Image();let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);if(ok){images.set(name,image);surfaceArtStatus.loaded.push(url);}else surfaceArtStatus.failed.push(url);resolve();};
  const timeout=setTimeout(()=>finish(false),8000);image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=url;
 }))).then(()=>{surfaceArtStatus.ready=true;return surfaceArtStatus;});return loading;
}
export function paintImported(x,s,name,{alpha=1,repeat=1,filter='none'}={}){
 const image=images.get(name);if(!image)return false;
 x.save();x.globalAlpha=alpha;x.filter=filter;
 for(let row=0;row<repeat;row++)for(let col=0;col<repeat;col++)x.drawImage(image,col*s/repeat,row*s/repeat,s/repeat,s/repeat);
 x.restore();return true;
}
export function canvasMap(size,draw,name=''){
 const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);
 const t=new T.CanvasTexture(c);t.name=name;t.colorSpace=T.SRGBColorSpace;t.anisotropy=size<=256?2:4;
 t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
export function surfaceMap(kind,size=surfaceArtStatus.size){
 const key=kind+':'+size;if(maps.has(key))return maps.get(key);
 const t=canvasMap(size,(x,s)=>{
  const settings={concrete:['#d8d9d4','concrete',.45,'grayscale(1) brightness(1.45)'],stone:['#e8dfc9','marble',.24,'grayscale(1) brightness(1.6)'],metal:['#d9e1e6','metal',.23,'grayscale(1) brightness(1.9)'],armor:['#f0f4f5','metal',.10,'grayscale(1) brightness(2)'],paving:['#bac4ca','paving',.6,'grayscale(1) brightness(1.45)'],asphalt:['#788492','concrete',.3,'grayscale(1) brightness(1.1)'],vent:['#748795','vent',.9,'grayscale(1) brightness(1.75)']}[kind];
  if(!settings)throw Error('Unknown surface '+kind);const [base,source,alpha,filter]=settings;x.fillStyle=base;x.fillRect(0,0,s,s);paintImported(x,s,source,{alpha,filter});
 },'surface:'+kind);if(kind==='vent')t.repeat.setScalar(1/3);maps.set(key,t);return t;
}
// The raider kit and some vehicles use vertex colors without UVs. Generate a
// bind-pose projection once; UVs follow the existing animated vertices, not world space.
export function ensureSurfaceUV(geometry,scale=1){
 if(geometry.attributes.uv)return geometry;
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const nx=Math.abs(n?.getX(i)||0),ny=Math.abs(n?.getY(i)||0),nz=Math.abs(n?.getZ(i)||0);
  uv[i*2]=(nx>ny&&nx>nz?p.getZ(i):p.getX(i))*scale;
  uv[i*2+1]=(ny>nx&&ny>nz?p.getZ(i):p.getY(i))*scale;
 }
 geometry.setAttribute('uv',new T.BufferAttribute(uv,2));return geometry;
}
