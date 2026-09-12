import {decodeSnapshot} from '../shared/protocol.js';
import {handQuaternion} from '../shared/giant-rig.js';
import {C} from '../shared/config.js';
const mix = (a, b, t) => a + (b - a) * t;
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function vectorInto(out, a, b, t){ out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t); return out; }
function quatInto(out, a, b, t){
 const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
 let n = 0; for(let i = 0; i < 4; i++){ out[i] = mix(a[i], b[i] * sign, t); n += out[i] * out[i]; } n = Math.sqrt(n) || 1; for(let i = 0; i < 4; i++) out[i] /= n; return out;
}
// Game socket: reliable JSON control/events plus binary snapshots, interpolated ~100 ms behind.
// sample() reuses its output objects so a 60 Hz render loop does not churn the garbage collector.
export class Connection {
 constructor(onMessage, onClose){
  this.onMessage = onMessage; this.onClose = onClose; this.snapshots = []; this.ping = 0; this.bytes = 0; this.kbps = 0; this.lastBytes = 0; this.receivedAt = 0; this.ws = null;
  this.scratch = {players:new Map(), bodies:new Map(), state:{head:[0, 0, 0], left:[0, 0, 0], right:[0, 0, 0], players:[], bodies:[]}};
  this.timer = setInterval(() => { if(this.ws?.readyState === 1){ this.send({type:'ping', t:performance.now()}); this.kbps = (this.bytes - this.lastBytes) * 8 / 2000; this.lastBytes = this.bytes; } }, 2000);
 }
 connect(join){
  this.close(false); this.joinRequest = join; this.snapshots = [];
  return new Promise((resolve, reject) => {
   const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); this.ws = ws; ws.binaryType = 'arraybuffer'; let joined = false;
   const timeout = setTimeout(() => { if(!joined){ reject(Error('Connection timed out. Make sure the server is running.')); ws.close(); } }, 10000);
   ws.onopen = () => this.send({type:'join', ...join});
   ws.onmessage = e => {
    if(e.data instanceof ArrayBuffer){
     this.bytes += e.data.byteLength;
     try{ const s = decodeSnapshot(e.data); this.receivedAt = performance.now(); this.snapshots.push(s); if(this.snapshots.length > 20) this.snapshots.shift(); }catch(err){ console.warn(err); } return;
    }
    this.bytes += e.data.length;
    try{ const m = JSON.parse(e.data);
     if(m.type === 'pong'){ this.ping = Math.round(performance.now() - m.t); return; }
     if(m.type === 'welcome'){ joined = true; clearTimeout(timeout); this.snapshots = []; this.id = m.id; this.room = m.room; this.role = m.role; resolve(m); }
     if(m.type === 'error' && !joined){ clearTimeout(timeout); reject(Error(m.message)); ws.close(); return; }
     this.onMessage(m);
    }catch(err){ console.error(err); }
   };
   ws.onerror = () => { if(!joined){ clearTimeout(timeout); reject(Error('Unable to reach the game server. Use the server URL, not a local HTML file.')); } };
   ws.onclose = () => { clearTimeout(timeout); if(this.ws !== ws) return; if(!joined) reject(Error('Server closed the connection.')); this.onClose?.(); };
  });
 }
 send(m){ if(this.ws?.readyState !== 1 || this.ws.bufferedAmount >= 64 * 1024) return false; this.ws.send(JSON.stringify(m)); return true; }
 get latest(){ return this.snapshots.at(-1); }
 // Estimated one-way delay from the newest server state to now (for prediction lead).
 get lead(){ return Math.min(.25, (performance.now() - this.receivedAt) / 1000 + this.ping / 2000); }
 sample(){
  const latest = this.latest; if(!latest) return null;
  const target = latest.time + Math.min((performance.now() - this.receivedAt) / 1000, .15) - C.INTERPOLATION_MS / 1000;
  let a = this.snapshots[0], b = latest;
  for(let i = 1; i < this.snapshots.length; i++){ if(this.snapshots[i].time >= target){ a = this.snapshots[i - 1]; b = this.snapshots[i]; break; } a = this.snapshots[i]; }
  const t = Math.max(0, Math.min(1, (target - a.time) / (b.time - a.time || 1))), s = this.scratch.state;
  for(const key of Object.keys(b)) if(key !== 'players' && key !== 'bodies' && key !== 'head' && key !== 'left' && key !== 'right' && key !== 'leftQuaternion' && key !== 'rightQuaternion') s[key] = b[key];
  // Animation needs a continuous clock between the 20 Hz packets, matching the
  // interpolated positions. Keep authoritative time unchanged for gameplay.
  s.renderTime=mix(a.time,b.time,t);
  vectorInto(s.head, a.head, b.head, t); vectorInto(s.left, a.left, b.left, t); vectorInto(s.right, a.right, b.right, t);
  s.bossYaw = angle(a.bossYaw, b.bossYaw, t); s.bossX = mix(a.bossX, b.bossX, t); s.bossZ = mix(a.bossZ, b.bossZ, t);
  for(const side of ['left', 'right']){ const key = side + 'Quaternion'; if(!s[key] || s[key] === b[key]) s[key] = [0, 0, 0, 1]; quatInto(s[key], handQuaternion(a[key], a.bossYaw), handQuaternion(b[key], b.bossYaw), t); }
  // Lookup maps are built once per snapshot, not once per rendered frame.
  if(!a._players){ a._players = new Map(); for(const p of a.players) a._players.set(p.id, p); a._bodies = new Map(); for(const body of a.bodies) a._bodies.set(body.id, body); }
  const pa = a._players, ba = a._bodies;
  s.players.length = 0;
  for(const p of b.players){
   let out = this.scratch.players.get(p.id); if(!out){ out = {p:[0, 0, 0], v:[0, 0, 0]}; this.scratch.players.set(p.id, out); }
   for(const key of Object.keys(p)) if(key !== 'p' && key !== 'v') out[key] = p[key];
   const q = pa.get(p.id);
   if(q){ vectorInto(out.p, q.p, p.p, t); vectorInto(out.v, q.v, p.v, t); out.yaw = angle(q.yaw, p.yaw, t); out.pitch = mix(q.pitch || 0, p.pitch || 0, t); }
   else { out.p[0] = p.p[0]; out.p[1] = p.p[1]; out.p[2] = p.p[2]; out.v[0] = p.v[0]; out.v[1] = p.v[1]; out.v[2] = p.v[2]; }
   s.players.push(out);
  }
  s.bodies.length = 0;
  for(const body of b.bodies){
   let out = this.scratch.bodies.get(body.id); if(!out){ out = {id:body.id, p:[0, 0, 0], q:[0, 0, 0, 1]}; this.scratch.bodies.set(body.id, out); }
   const q = ba.get(body.id);
   if(q){ vectorInto(out.p, q.p, body.p, t); quatInto(out.q, q.q, body.q, t); } else { out.p[0] = body.p[0]; out.p[1] = body.p[1]; out.p[2] = body.p[2]; out.q[0] = body.q[0]; out.q[1] = body.q[1]; out.q[2] = body.q[2]; out.q[3] = body.q[3]; }
   s.bodies.push(out);
  }
  if(this.scratch.bodies.size > 600) this.scratch.bodies.clear();
  return s;
 }
 close(notify = false){ const ws = this.ws; this.ws = null; if(ws){ if(!notify) ws.onclose = null; ws.close(); } this.snapshots = []; }
 dispose(){ this.close(); clearInterval(this.timer); }
}
