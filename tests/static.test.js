import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {serveStatic} from '../server/static.js';

async function request(target,headers={},method='GET'){
 const res=new PassThrough(),chunks=[];res.on('data',data=>chunks.push(data));res.writeHead=(status,h)=>{res.status=status;res.headers=h;};
 const done=new Promise((resolve,reject)=>{res.on('end',resolve);res.on('error',reject);});
 await serveStatic({method,headers},res,target,await stat(target),{'Content-Type':'text/javascript','Cache-Control':'no-cache'});await done;
 return {status:res.status,headers:res.headers,body:Buffer.concat(chunks)};
}
test('compressed assets preserve their bytes, negotiate encoding, and validate cached/updated files',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'colossus-static-')),target=path.join(dir,'asset.js'),source=Buffer.from('export const buildings = [1,2,3];\n'.repeat(2000));
 try{
  await writeFile(target,source);
  for(const [format,decode]of [['br',brotliDecompressSync],['gzip',gunzipSync]]){
   const r=await request(target,{'accept-encoding':format});assert.equal(r.status,200);assert.equal(r.headers['Content-Encoding'],format);assert.deepEqual(decode(r.body),source);assert.ok(r.body.length<source.length/2);assert.equal(r.headers.Vary,'Accept-Encoding');
   const head=await request(target,{'accept-encoding':format},'HEAD');assert.equal(head.headers['Content-Length'],r.body.length);assert.equal(head.body.length,0);
   const cached=await request(target,{'accept-encoding':format,'if-none-match':`"unrelated", ${r.headers.ETag}`});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
  }
  const plain=await request(target,{'accept-encoding':'gzip;q=0, br;q=0'});assert.equal(plain.headers['Content-Encoding'],undefined);assert.deepEqual(plain.body,source);
  const preferred=await request(target,{'accept-encoding':'br;q=0.1, gzip;q=0.9'});assert.equal(preferred.headers['Content-Encoding'],'gzip');
  const oldTag=plain.headers.ETag;await writeFile(target,Buffer.concat([source,Buffer.from('// changed')]));
  const changed=await request(target,{'accept-encoding':'br','if-none-match':oldTag});assert.equal(changed.status,200);assert.notEqual(changed.headers.ETag,oldTag);assert.ok(brotliDecompressSync(changed.body).toString().endsWith('// changed'));
  assert.equal((await request(target,{},'POST')).status,405);
 }finally{await rm(dir,{recursive:true,force:true});}
});
