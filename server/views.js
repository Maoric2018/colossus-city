// Authenticated room signaling. Video goes directly between browsers; JPEGs
// remain a bounded fallback when a network cannot establish a media connection.
import {WebSocketServer,WebSocket} from 'ws';
export function installViews(server,rooms){
 const wss=new WebSocketServer({noServer:true,maxPayload:96*1024,perMessageDeflate:false}),watchers=new Map();
 const iceServers=process.env.VIEW_ICE_SERVERS?JSON.parse(process.env.VIEW_ICE_SERVERS):[{urls:'stun:stun.l.google.com:19302'}];
 const send=(ws,m)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<32*1024)ws.send(JSON.stringify(m));};
 function notify(room){
  const watching=[...(watchers.get(room.code)||[])].filter(w=>w.readyState===WebSocket.OPEN);
  for(const c of room.clients.values())if(c.role!=='spectator'&&c.viewSocket){const socket=c.viewSocket;send(socket,{type:'capture',active:watching.length>0,viewers:watching.map(w=>({id:w.clientId,rtc:!!(socket.rtc&&w.rtc&&!w.fallback.has(c.id))}))});}
 }
 function image(w,id,packet){
  if(w.readyState!==WebSocket.OPEN)return;
  if(w.inflight.has(id)){w.pending.set(id,packet);return;}
  if(w.bufferedAmount>16*1024)return;
  if(Date.now()-packet.readDoubleLE(4)>250)return;
  w.inflight.set(id,Date.now());w.send(packet);
 }
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/views')return;
  try{const permitted=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host||(process.env.ALLOWED_ORIGIN&&req.headers.origin===process.env.ALLOWED_ORIGIN);if(!permitted)throw Error();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));}catch{socket.destroy();}
 });
 wss.on('connection',ws=>{
  let room,client,lastFrame=0,windowStart=Date.now(),messages=0;ws.fallback=new Set();ws.inflight=new Map();ws.pending=new Map();
  const timeout=setTimeout(()=>ws.close(1008,'Authentication timeout'),5000);ws.on('error',()=>{});
  ws.on('message',(data,binary)=>{
   if(Date.now()-windowStart>1000){windowStart=Date.now();messages=0;}if(++messages>180){ws.close(1008,'View channel rate exceeded');return;}
   try{
    if(!client){
     if(binary||data.length>1024)throw Error('Invalid handshake');const m=JSON.parse(data.toString());room=rooms.get(m.room);client=room?.clients.get(m.id);if(!client||m.key!==client.viewKey)throw Error('Not a room participant');
     clearTimeout(timeout);client.viewSocket?.close(1000,'Replaced');client.viewSocket=ws;ws.clientId=client.id;ws.rtc=m.rtc===true;
     if(client.role==='spectator'&&m.watch){if(!watchers.has(room.code))watchers.set(room.code,new Set());watchers.get(room.code).add(ws);}
     send(ws,{type:'view-ready',iceServers});notify(room);return;
    }
    if(room.clients.get(client.id)!==client)throw Error('Room participant disconnected');
    if(!binary){
     if(data.length>64*1024)throw Error('Signal too large');const m=JSON.parse(data.toString());
     if(m.type==='media-unavailable'&&client.role!=='spectator'){ws.rtc=false;notify(room);return;}
     if(m.type==='signal'){
      const target=room.clients.get(m.to),spectator=client.role==='spectator'?ws:target?.viewSocket,publisher=client.role==='spectator'?target:client;
      if(!target||publisher?.role==='spectator'||(client.role!=='spectator'&&target.role!=='spectator'))throw Error('Not a room video pair');
      // Late ICE from a closing panel is normal; do not disconnect a publisher
      // that may still be streaming to other spectators.
      if(!watchers.get(room.code)?.has(spectator)||!spectator.rtc||!publisher?.viewSocket?.rtc)return;
      if(typeof m.session!=='string'||m.session.length>64)throw Error('Invalid video session');
      const description=m.description&&['offer','answer'].includes(m.description.type)&&typeof m.description.sdp==='string'?{type:m.description.type,sdp:m.description.sdp}:undefined;
      const candidate=m.candidate&&typeof m.candidate.candidate==='string'&&m.candidate.candidate.length<8192?{candidate:m.candidate.candidate,sdpMid:m.candidate.sdpMid,sdpMLineIndex:m.candidate.sdpMLineIndex,usernameFragment:m.candidate.usernameFragment}:undefined;
      if(!description&&!candidate)return;send(target.viewSocket,{type:'signal',from:client.id,session:m.session,description,candidate});return;
     }
     if(client.role==='spectator'){
      if(m.type==='watch'){if(m.active){if(!watchers.has(room.code))watchers.set(room.code,new Set());watchers.get(room.code).add(ws);}else{watchers.get(room.code)?.delete(ws);ws.pending.clear();ws.inflight.clear();ws.fallback.clear();}notify(room);}
      if(m.type==='fallback'&&watchers.get(room.code)?.has(ws)&&room.clients.has(m.id)&&room.clients.get(m.id).role!=='spectator'){ws.fallback.add(m.id);notify(room);}
      if(m.type==='frame-ack'){ws.inflight.delete(m.id);const packet=ws.pending.get(m.id);ws.pending.delete(m.id);if(packet&&watchers.get(room.code)?.has(ws))image(ws,m.id,packet);}
      return;
     }
     if(m.type==='view-info'){const info={type:'view-info',id:client.id,mode:['Headset left eye','Desktop first person','Desktop third person','Desktop giant'].includes(m.mode)?m.mode:'Game view',paused:!!m.paused,tracking:!!m.tracking};for(const watcher of watchers.get(room.code)||[])send(watcher,info);}return;
    }
    if(client.role==='spectator')return;send(ws,{type:'image-ack'});
    if(data.length<4||data[0]!==255||data[1]!==216||data[data.length-2]!==255||data[data.length-1]!==217)return;
    if(Date.now()-lastFrame<60)return;lastFrame=Date.now();
    const header=Buffer.alloc(12);header.writeUInt32LE(client.id);header.writeDoubleLE(Date.now(),4);const packet=Buffer.concat([header,data]);
    for(const watcher of watchers.get(room.code)||[])if(!ws.rtc||!watcher.rtc||watcher.fallback.has(client.id))image(watcher,client.id,packet);
   }catch{ws.close(1008,'Invalid view channel request');}
  });
  ws.on('close',()=>{clearTimeout(timeout);if(!room||!client)return;if(client.viewSocket===ws)client.viewSocket=null;watchers.get(room.code)?.delete(ws);if(!watchers.get(room.code)?.size)watchers.delete(room.code);notify(room);});
 });
 server.on('close',()=>wss.close());return wss;
}
