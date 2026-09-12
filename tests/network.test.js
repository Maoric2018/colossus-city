// Starts an actual server and two WebSocket clients. Requires npm install.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {decodeSnapshot} from '../shared/protocol.js';
const port=18287,url=`ws://127.0.0.1:${port}/ws`;
async function connect(join){
 const ws=new WebSocket(url),messages=[],snapshots=[];
 await new Promise((resolve,reject)=>{ws.on('open',()=>{ws.send(JSON.stringify({type:'join',...join}));});ws.on('error',reject);ws.on('message',(data,binary)=>{if(binary){const a=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);snapshots.push(decodeSnapshot(a));}else{const m=JSON.parse(data);messages.push(m);if(m.type==='welcome')resolve();if(m.type==='error')reject(Error(m.message));}});});
 return {ws,messages,snapshots,welcome:messages.find(m=>m.type==='welcome')};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('two clients share one authoritative match and observe the same movement',{timeout:15000},async()=>{
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let output='';server.stderr.on('data',d=>output+=d);let a,b,spectator,publisher,watcher,bad;
 try{
  for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/healthz`);if(r.ok)break;}catch{}await sleep(100);}
  a=await connect({create:true,role:'boss',name:'Giant'});b=await connect({room:a.welcome.room,role:'raider',name:'Raider'});
  await sleep(200);const initial=b.snapshots.at(-1).players.find(p=>p.id===b.welcome.id).p;
  for(let i=0;i<15;i++){b.ws.send(JSON.stringify({type:'input',x:1,z:0,up:1,yaw:0,pitch:0,seq:i}));await sleep(33);}
  await sleep(100);assert.ok(a.snapshots.length>3&&b.snapshots.length>3);assert.equal(a.welcome.room,b.welcome.room);
  const final=b.snapshots.at(-1).players.find(p=>p.id===b.welcome.id).p;assert.ok(final[0]>initial[0]+.5);assert.ok(final[1]>initial[1]+.3);
  const common=a.snapshots.find(s=>b.snapshots.some(t=>s.tick===t.tick));const other=b.snapshots.find(t=>t.tick===common.tick);assert.deepEqual(common,other);
  spectator=await connect({room:a.welcome.room,role:'spectator',name:'Observer'});
  const view=async(client,key=client.welcome.viewKey,watch=false)=>{const socket=new WebSocket(`ws://127.0.0.1:${port}/views`),messages=[],frames=[];socket.on('message',(data,binary)=>binary?frames.push(data):messages.push(JSON.parse(data)));await new Promise((resolve,reject)=>{socket.on('error',reject);socket.on('open',()=>{socket.send(JSON.stringify({room:client.welcome.room,id:client.welcome.id,key,watch}));resolve();});});return {socket,messages,frames};};
  publisher=await view(a);await sleep(30);assert.equal(publisher.messages.at(-1).active,false);
  bad=await view(spectator,'wrong-key',true);await new Promise(resolve=>bad.socket.on('close',resolve));
  watcher=await view(spectator,spectator.welcome.viewKey,true);await sleep(40);assert.equal(publisher.messages.at(-1).active,true);
  publisher.socket.send(Buffer.from([255,216,255,217]));await sleep(40);assert.equal(watcher.frames[0].readUInt32LE(0),a.welcome.id);
  watcher.socket.send(JSON.stringify({type:'watch',active:false}));await sleep(40);assert.equal(publisher.messages.at(-1).active,false);
  const html=await fetch(`http://127.0.0.1:${port}/`);assert.equal(html.status,200);assert.ok((await html.text()).includes('COLOSSUS'));
  const traversal=await fetch(`http://127.0.0.1:${port}/server/room.js`);assert.equal(traversal.status,404);
 }catch(e){throw new Error(e.message+'\nServer stderr: '+output,{cause:e});}
 finally{publisher?.socket.close();watcher?.socket.close();bad?.socket.close();spectator?.ws.close();a?.ws.close();b?.ws.close();server.kill('SIGTERM');}
});
