/** Optional CC0 photographic surface upgrade. The game ships working local fallbacks.
 * Usage: npm run assets. No API key, build-time fetch, or runtime CDN dependency.
 * Original images are backed up once; metadata and source attribution are retained.
 */
import {mkdir,writeFile,copyFile,rename,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/assets');
const assets=[['aerial_asphalt_01','asphalt.jpg'],['concrete_wall_006','concrete.jpg']];
const headers={'User-Agent':'COLOSSUS-CITY-demo/0.1 (+optional local asset fetch)'};
async function fetchChecked(url){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(`HTTP ${response.status} from ${url}`);return response;
}
function urls(value,out=[]){if(!value||typeof value!=='object')return out;if(typeof value.url==='string')out.push(value.url);for(const child of Object.values(value))if(child&&typeof child==='object')urls(child,out);return [...new Set(out)];}
let failures=0;await mkdir(root,{recursive:true});
for(const [id,filename] of assets){
 try{
  const metadata=await (await fetchChecked(`https://api.polyhaven.com/files/${id}`)).json();
  const matches=urls(metadata).filter(u=>/\/1k\//i.test(u)&&/_diff(?:use)?_1k\.jpe?g(?:\?|$)/i.test(u));
  const source=matches[0];if(!source)throw Error('No 1K JPEG diffuse texture was listed. Keeping bundled texture.');
  const url=new URL(source);if(url.protocol!=='https:'||!(url.hostname==='polyhaven.com'||url.hostname.endsWith('.polyhaven.com')))throw Error('Unexpected download host');
  const response=await fetchChecked(url),expected=Number(response.headers.get('content-length')||0);
  if(expected>12*1024*1024)throw Error('Image exceeds size budget');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>12*1024*1024||bytes[0]!==0xff||bytes[1]!==0xd8)throw Error('Download was not a budget-sized JPEG');
  const file=path.join(root,filename),backup=path.join(root,filename.replace('.jpg','.original.jpg'));
  try{await access(backup);}catch{await copyFile(file,backup);}
  await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);
  await writeFile(path.join(root,`${id}.source.json`),JSON.stringify({asset:id,page:`https://polyhaven.com/a/${id}`,license:'CC0',licensePage:'https://polyhaven.com/license',download:source,retrieved:new Date().toISOString()},null,2));
  console.log(`Installed ${id}: ${Math.round(bytes.length/1024)} KiB → ${filename}`);
 }catch(error){failures++;console.warn(`${id}: ${error.message}`);}
}
console.log(failures?'Some optional downloads were unavailable. Existing local textures remain usable.':'Optional texture upgrade complete. Restart the server and hard-refresh the game.');
