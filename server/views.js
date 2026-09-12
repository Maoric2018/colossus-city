// A separate, bounded debug channel keeps image traffic out of gameplay sockets.
import {WebSocketServer,WebSocket} from 'ws';
export function installViews(server,rooms){
 const wss=new WebSocketServer({noServer:true,maxPayload:96*1024,perMessageDeflate:false}),watchers=new Map();
 const send=(ws,m)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<192*1024)ws.send(JSON.stringify(m));};
 function notify(room){const active=(watchers.get(room.code)?.size||0)>0;for(const c of room.clients.values())if(c.role!=='spectator'&&c.viewSocket)send(c.viewSocket,{type:'capture',active});}
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/views')return;
  try{const permitted=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host||(process.env.ALLOWED_ORIGIN&&req.headers.origin===process.env.ALLOWED_ORIGIN);if(!permitted)throw Error();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));}catch{socket.destroy();}
 });
 wss.on('connection',ws=>{
  let room,client,lastFrame=0,windowStart=Date.now(),messages=0;const timeout=setTimeout(()=>ws.close(1008,'Authentication timeout'),5000);
  ws.on('error',()=>{});
  ws.on('message',(data,binary)=>{
   if(Date.now()-windowStart>1000){windowStart=Date.now();messages=0;}if(++messages>32){ws.close(1008,'Debug frame rate exceeded');return;}
   try{
    if(!client){if(binary||data.length>1024)throw Error('Invalid handshake');const m=JSON.parse(data.toString());room=rooms.get(m.room);client=room?.clients.get(m.id);if(!client||m.key!==client.viewKey)throw Error('Not a room participant');
     clearTimeout(timeout);client.viewSocket?.close(1000,'Replaced');client.viewSocket=ws;
     if(client.role==='spectator'&&m.watch){if(!watchers.has(room.code))watchers.set(room.code,new Set());watchers.get(room.code).add(ws);}notify(room);return;
    }
    if(room.clients.get(client.id)!==client)throw Error('Room participant disconnected');
    if(client.role==='spectator'){if(!binary&&data.length<256){const m=JSON.parse(data.toString());if(m.type==='watch'){if(m.active){if(!watchers.has(room.code))watchers.set(room.code,new Set());watchers.get(room.code).add(ws);}else watchers.get(room.code)?.delete(ws);notify(room);}}return;}
    if(!binary){if(data.length>2048)return;const m=JSON.parse(data.toString());if(m.type==='view-info')for(const watcher of watchers.get(room.code)||[])send(watcher,{type:'view-info',id:client.id,mode:['Headset left eye','Desktop first person','Desktop third person','Desktop giant'].includes(m.mode)?m.mode:'Game view',paused:!!m.paused,tracking:!!m.tracking});return;}
    if(data.length<4||data[0]!==255||data[1]!==216||data[data.length-2]!==255||data[data.length-1]!==217)return;
    if(Date.now()-lastFrame<120)return;lastFrame=Date.now();
    const header=Buffer.alloc(12);header.writeUInt32LE(client.id);header.writeDoubleLE(Date.now(),4);const packet=Buffer.concat([header,data]);
    for(const watcher of watchers.get(room.code)||[])if(watcher.readyState===WebSocket.OPEN&&watcher.bufferedAmount<192*1024)watcher.send(packet);
   }catch{ws.close(1008,'Invalid debug channel request');}
  });
  ws.on('close',()=>{clearTimeout(timeout);if(!room||!client)return;if(client.viewSocket===ws)client.viewSocket=null;watchers.get(room.code)?.delete(ws);if(!watchers.get(room.code)?.size)watchers.delete(room.code);notify(room);});
 });
 server.on('close',()=>wss.close());return wss;
}
