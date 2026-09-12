import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {WebSocket} from 'ws';
import {installViews} from '../server/views.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t){
 const clients=new Map([[1,{id:1,role:'boss',viewKey:'boss-key'}],[2,{id:2,role:'spectator',viewKey:'viewer-key'}],[3,{id:3,role:'raider',viewKey:'raider-key'}],[4,{id:4,role:'spectator',viewKey:'viewer-two-key'}]]),room={code:'ABC123',clients},server=createServer(),sockets=[];
 installViews(server,new Map([[room.code,room]]));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const socket of sockets)socket.terminate();await new Promise(resolve=>server.close(resolve));});
 return async(id,{rtc=true,watch=true,key=clients.get(id).viewKey}={})=>{
  const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/views`),messages=[],frames=[];sockets.push(socket);
  socket.on('message',(data,binary)=>binary?frames.push(data):messages.push(JSON.parse(data)));
  const closed=new Promise(resolve=>socket.on('close',code=>resolve(code)));
  await new Promise(resolve=>socket.on('open',resolve));socket.send(JSON.stringify({room:room.code,id,key,rtc,watch}));await sleep(25);
  return {socket,messages,frames,closed,send:m=>socket.send(JSON.stringify(m))};
 };
}
test('video signaling is restricted to authenticated, actively watching room pairs',async t=>{
 const connect=await fixture(t),boss=await connect(1),watcher=await connect(2);
 assert.deepEqual(boss.messages.at(-1).viewers,[{id:2,rtc:true}]);
 boss.send({type:'signal',to:2,session:'session-a',description:{type:'offer',sdp:'test-offer'}});await sleep(25);
 assert.deepEqual(watcher.messages.at(-1),{type:'signal',from:1,session:'session-a',description:{type:'offer',sdp:'test-offer'}});
 watcher.send({type:'signal',to:1,session:'session-a',description:{type:'answer',sdp:'test-answer'}});await sleep(25);assert.equal(boss.messages.at(-1).description.sdp,'test-answer');
 const bad=await connect(4,{key:'wrong-key'});assert.equal(await bad.closed,1008);
 watcher.send({type:'watch',active:false});await sleep(25);assert.equal(boss.messages.at(-1).active,false);
 const before=watcher.messages.length;boss.send({type:'signal',to:2,session:'session-a',candidate:{candidate:'candidate:test'}});await sleep(25);assert.equal(watcher.messages.length,before,'A closed panel cannot receive signaling');assert.equal(boss.socket.readyState,WebSocket.OPEN,'Late ICE must not interrupt other viewers');
});
test('publishers cannot signal other players or unknown participants',async t=>{
 const connect=await fixture(t),boss=await connect(1);await connect(3);
 boss.send({type:'signal',to:3,session:'bad',description:{type:'offer',sdp:'test'}});assert.equal(await boss.closed,1008);
 const replacement=await connect(1);replacement.send({type:'signal',to:999,session:'outside-room',description:{type:'offer',sdp:'test'}});assert.equal(await replacement.closed,1008);
});
test('fallback drops queued old images and isolates fallback to the affected viewer',async t=>{
 const connect=await fixture(t),boss=await connect(1),watcher=await connect(2),other=await connect(4);
 watcher.send({type:'fallback',id:1});await sleep(25);assert.deepEqual(boss.messages.at(-1).viewers,[{id:2,rtc:false},{id:4,rtc:true}]);
 for(let frame=0;frame<4;frame++){boss.socket.send(Buffer.from([255,216,frame,255,217]));await sleep(75);}
 assert.equal(watcher.frames.length,1,'Only one unacknowledged frame may be in flight');assert.equal(other.frames.length,0,'Video viewers must not receive duplicate JPEG traffic');
 watcher.send({type:'frame-ack',id:1});await sleep(25);assert.equal(watcher.frames.length,2);assert.equal(watcher.frames[1][14],3,'A slow viewer receives the newest frame, not the backlog');
 watcher.send({type:'frame-ack',id:1});await sleep(25);assert.equal(watcher.frames.length,2);
 watcher.send({type:'watch',active:false});watcher.send({type:'watch',active:true});await sleep(25);assert.ok(boss.messages.at(-1).viewers.every(v=>v.rtc),'Reopening the panel retries video');
});
