import http from 'node:http';
import https from 'node:https';
import {readFile,stat} from 'node:fs/promises';
import {readFileSync,createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {WebSocketServer,WebSocket} from 'ws';
import {Room,physicsReady} from './room.js';
import {C} from '../shared/config.js';
import {encodeSnapshot} from '../shared/protocol.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.PORT)||8080,rooms=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
const handler=async(req,res)=>{
 try{
  const url=new URL(req.url,'http://local'),p=decodeURIComponent(url.pathname);
  if(p==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
  let root,relative;
  if(p.startsWith('/vendor/three/')){root=path.join(ROOT,'node_modules/three');relative=p.slice('/vendor/three/'.length);}
  else if(p.startsWith('/shared/')){root=path.join(ROOT,'shared');relative=p.slice(8);}
  else if(p.startsWith('/src/')){root=path.join(ROOT,'src');relative=p.slice(5);}
  else{root=path.join(ROOT,'public');relative=p==='/'?'index.html':p.slice(1);}
  const target=path.resolve(root,relative);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const s=await stat(target);if(!s.isFile())throw Error('Not a file');
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream',
   'Cache-Control':p.startsWith('/assets/')?'public, max-age=3600':'no-cache',
   'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',
   'Permissions-Policy':'xr-spatial-tracking=(self), camera=(), microphone=()',
   'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; font-src 'self'; media-src 'self' blob:; object-src 'none'"});
  if(req.method==='HEAD'){res.end();return;}createReadStream(target).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
};
const server=process.env.TLS_CERT&&process.env.TLS_KEY?https.createServer({cert:readFileSync(process.env.TLS_CERT),key:readFileSync(process.env.TLS_KEY)},handler):http.createServer(handler);
const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 try{
  const origin=req.headers.origin,host=req.headers.host;
  const permitted=!origin||new URL(origin).host===host||(process.env.ALLOWED_ORIGIN&&origin===process.env.ALLOWED_ORIGIN);
  if(!permitted||req.url!=='/ws'){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 }catch{socket.destroy();}
});
function send(ws,m){if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024){ws.close(1013,'Connection too slow');return;}ws.send(JSON.stringify(m));}}
function broadcast(room,m){for(const c of room.clients.values())send(c.ws,m);}
function freshCode(){let code;do{code=randomBytes(5).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));return code;}
wss.on('connection',ws=>{
 let room=null,client=null,window=Date.now(),messages=0;ws.alive=true;
 ws.on('pong',()=>{ws.alive=true;});
 const joinTimeout=setTimeout(()=>{if(!client)ws.close(1008,'Join timeout');},10000);
 ws.on('message',(data,isBinary)=>{
  if(isBinary)return;
  if(Date.now()-window>1000){window=Date.now();messages=0;}if(++messages>100){ws.close(1008,'Rate limit');return;}
  try{
   const m=JSON.parse(data.toString());if(!m||typeof m!=='object')return;
   if(m.type==='ping'){send(ws,{type:'pong',t:m.t});return;}
   if(!client){
    if(m.type!=='join')return;
    const role=['raider','boss','spectator'].includes(m.role)?m.role:'raider';
    const name=String(m.name||'PLAYER').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,20)||'PLAYER';
    if(m.create){if(rooms.size>=C.MAX_ROOMS)throw Error('Server is full. Try again after a room closes.');room=new Room(freshCode(),{practice:!!m.practice});rooms.set(room.code,room);}
    else{const code=String(m.room||'').toUpperCase();if(!/^[A-F0-9]{6}$/.test(code)||!rooms.has(code))throw Error('Room not found. Ask the host for its six-character code.');room=rooms.get(code);}
    if(room.clients.size>=16)throw Error('This room is full.');
    client=room.attach(ws,role,name);clearTimeout(joinTimeout);send(ws,room.welcome(client));
    broadcast(room,{type:'roster',players:room.roster(),bossPresent:!!room.bossClient,host:room.hostId()});return;
   }
   room.input(client,m);
  }catch(e){send(ws,{type:'error',message:e.message||'Invalid request'});}
 });
 ws.on('error',()=>{});
 ws.on('close',()=>{clearTimeout(joinTimeout);if(room&&client){room.detach(client.id);broadcast(room,{type:'roster',players:room.roster(),bossPresent:!!room.bossClient,host:room.hostId()});}});
});
await physicsReady;
let previous=performance.now(),accumulator=0,frames=0,maxStepMS=0;
const interval=setInterval(()=>{
 const now=performance.now();accumulator+=Math.min((now-previous)/1000,.2);previous=now;let steps=0;
 while(accumulator>=C.TICK&&steps++<8){
  const t=performance.now();
  for(const [code,room] of rooms){
   if(room.emptySince&&Date.now()-room.emptySince>60000){room.dispose();rooms.delete(code);continue;}
   if(!room.clients.size)continue;
   room.step();
   if(room.tick%C.SNAPSHOT_EVERY===0){
    const events=room.drainEvents();
    if(events.some(e=>e.type==='reset'))for(const c of room.clients.values())send(c.ws,room.welcome(c));
    if(events.length)broadcast(room,{type:'events',events});
    const snapshot=Buffer.from(encodeSnapshot(room.snapshot()));
    for(const c of room.clients.values())if(c.ws.readyState===WebSocket.OPEN&&c.ws.bufferedAmount<128*1024)c.ws.send(snapshot);
   }
  }
  maxStepMS=Math.max(maxStepMS,performance.now()-t);accumulator-=C.TICK;
 }
 if(steps>8)accumulator=0;
 if(++frames%7500===0){console.log(`[physics] rooms=${rooms.size} peak step=${maxStepMS.toFixed(2)}ms`);maxStepMS=0;}
},4);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
server.listen(PORT,'0.0.0.0',()=>console.log(`COLOSSUS CITY | ${process.env.TLS_CERT?'https':'http'}://localhost:${PORT}\nQuest immersive VR needs HTTPS. See README.md.`));
function shutdown(){clearInterval(interval);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1001,'Server shutting down');for(const r of rooms.values())r.dispose();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
