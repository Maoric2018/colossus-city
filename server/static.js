import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {promisify} from 'node:util';
import {brotliCompress, gzip, constants} from 'node:zlib';
import path from 'node:path';

const brotli=promisify(brotliCompress),zip=promisify(gzip);
const compressible=new Set(['.html','.js','.css','.json','.svg','.gltf','.glb','.bin','.wasm','.hdr']);
// Keep compressed copies bounded across the whole server, not per room/client.
const cache=new Map(),pending=new Map(),budget=16*1024*1024;
let cachedBytes=0;
function encoding(header){
 const weights=new Map(String(header||'').toLowerCase().split(',').map(part=>{
  const [name,...params]=part.trim().split(';'),q=params.find(p=>p.trim().startsWith('q='));
  const value=q?Number(q.trim().slice(2)):1;return [name,Number.isFinite(value)?Math.max(0,Math.min(1,value)):0];
 }));
 const br=weights.get('br')??weights.get('*')??0,gz=weights.get('gzip')??weights.get('*')??0;
 return br>0&&br>=gz?'br':gz>0?'gzip':null;
}
async function compressed(target,tag,format){
 const key=`${target}:${tag}:${format}`;
 if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
 if(pending.has(key))return pending.get(key);
 const work=(async()=>{
  const source=await readFile(target),body=await (format==='br'?brotli(source,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):zip(source,{level:6}));
  while(cache.size&&(cachedBytes+body.length>budget||cache.size>=128)){const oldest=cache.keys().next().value;cachedBytes-=cache.get(oldest).length;cache.delete(oldest);}
  if(body.length<=budget){cache.set(key,body);cachedBytes+=body.length;}return body;
 })();
 pending.set(key,work);try{return await work;}finally{pending.delete(key);}
}
export async function serveStatic(req,res,target,stat,headers){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 // A weak source validator remains valid across the gzip/Brotli representations.
 const tag=`W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
 headers={...headers,ETag:tag,Vary:'Accept-Encoding'};
 const validators=String(req.headers['if-none-match']||'').split(',').map(v=>v.trim().replace(/^W\//,''));
 if(validators.includes('*')||validators.includes(tag.slice(2))){res.writeHead(304,headers);res.end();return;}
 const format=stat.size>=1024&&stat.size<=8*1024*1024&&compressible.has(path.extname(target))?encoding(req.headers['accept-encoding']):null;
 if(format){
  const body=await compressed(target,tag,format);
  res.writeHead(200,{...headers,'Content-Encoding':format,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
 }else{
  res.writeHead(200,{...headers,'Content-Length':stat.size});
  if(req.method==='HEAD'){res.end();return;}
  createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 }
}
