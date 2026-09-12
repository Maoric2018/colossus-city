// A read-only, loopback-only production server. Never launches or joins a match.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function serve(port=0){
 const roots={'/cinematics/':'cinematics/','/src/':'src/','/shared/':'shared/','/assets/':'public/assets/','/vendor/three/':'node_modules/three/','/replay/':'artifacts/cinematic-demo/'};
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.hdr':'application/octet-stream'};
 const server=createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method))throw Error('method');
   let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(url==='/')url='/cinematics/index.html';
   const prefix=Object.keys(roots).find(p=>url.startsWith(p));if(!prefix)throw Error('path');
   const base=path.resolve(root,roots[prefix]),file=path.resolve(base,url.slice(prefix.length));
   if(!file.startsWith(base+path.sep))throw Error('path');const s=await stat(file);if(!s.isFile())throw Error('file');
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-cache'});
   if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {url}=await serve(Number(process.env.PORT||8096));console.log(url);}
