import {decodeSnapshot} from '../shared/protocol.js';
import {C} from '../shared/config.js';
const mix=(a,b,t)=>a+(b-a)*t;
const vector=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
const qmix=(a,b,t)=>{const sign=a.reduce((s,x,i)=>s+x*b[i],0)<0?-1:1,q=a.map((x,i)=>mix(x,b[i]*sign,t)),n=Math.hypot(...q)||1;return q.map(x=>x/n);};
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export class Connection{
 constructor(onMessage,onClose){this.onMessage=onMessage;this.onClose=onClose;this.snapshots=[];this.ping=0;this.bytes=0;this.kbps=0;this.lastBytes=0;this.receivedAt=0;this.ws=null;
  this.timer=setInterval(()=>{if(this.ws?.readyState===1){this.send({type:'ping',t:performance.now()});this.kbps=(this.bytes-this.lastBytes)*8/2000;this.lastBytes=this.bytes;}},2000);
 }
 connect(join){
  this.close(false);this.joinRequest=join;this.snapshots=[];
  return new Promise((resolve,reject)=>{
   const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);this.ws=ws;ws.binaryType='arraybuffer';let joined=false;
   const timeout=setTimeout(()=>{if(!joined){reject(Error('Connection timed out. Make sure the server is running.'));ws.close();}},10000);
   ws.onopen=()=>this.send({type:'join',...join});
   ws.onmessage=e=>{
    if(e.data instanceof ArrayBuffer){
     this.bytes+=e.data.byteLength;
     try{const s=decodeSnapshot(e.data);this.receivedAt=performance.now();this.snapshots.push(s);if(this.snapshots.length>20)this.snapshots.shift();}catch(err){console.warn(err);}return;
    }
    this.bytes+=e.data.length;
    try{const m=JSON.parse(e.data);
     if(m.type==='pong'){this.ping=Math.round(performance.now()-m.t);return;}
     if(m.type==='welcome'){joined=true;clearTimeout(timeout);this.snapshots=[];this.id=m.id;this.room=m.room;this.role=m.role;resolve(m);}
     if(m.type==='error'&&!joined){clearTimeout(timeout);reject(Error(m.message));ws.close();return;}
     this.onMessage(m);
    }catch(err){console.error(err);}
   };
   ws.onerror=()=>{if(!joined){clearTimeout(timeout);reject(Error('Unable to reach the game server. Use the server URL, not a local HTML file.'));}};
   ws.onclose=()=>{clearTimeout(timeout);if(this.ws!==ws)return;if(!joined)reject(Error('Server closed the connection.'));this.onClose?.();};
  });
 }
 send(m){if(this.ws?.readyState!==1||this.ws.bufferedAmount>=64*1024)return false;this.ws.send(JSON.stringify(m));return true;}
 get latest(){return this.snapshots.at(-1);}
 sample(){
  const latest=this.latest;if(!latest)return null;
  const target=latest.time+Math.min((performance.now()-this.receivedAt)/1000,.15)-C.INTERPOLATION_MS/1000;
  let a=this.snapshots[0],b=latest;
  for(let i=1;i<this.snapshots.length;i++){if(this.snapshots[i].time>=target){a=this.snapshots[i-1];b=this.snapshots[i];break;}a=this.snapshots[i];}
  const t=Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time||1))),pm=new Map(a.players.map(p=>[p.id,p])),bm=new Map(a.bodies.map(p=>[p.id,p]));
  const s={...b,head:vector(a.head,b.head,t),left:vector(a.left,b.left,t),right:vector(a.right,b.right,t),bossYaw:angle(a.bossYaw,b.bossYaw,t),bossX:mix(a.bossX,b.bossX,t),bossZ:mix(a.bossZ,b.bossZ,t)};
  s.players=b.players.map(p=>{const q=pm.get(p.id);return q?{...p,p:vector(q.p,p.p,t),v:vector(q.v,p.v,t),yaw:angle(q.yaw,p.yaw,t)}:p;});
  s.bodies=b.bodies.map(p=>{const q=bm.get(p.id);return q?{...p,p:vector(q.p,p.p,t),q:qmix(q.q,p.q,t)}:p;});return s;
 }
 close(notify=false){const ws=this.ws;this.ws=null;if(ws){if(!notify)ws.onclose=null;ws.close();}this.snapshots=[];}
 dispose(){this.close();clearInterval(this.timer);}
}
