// 32-byte header + 104-byte boss + players(64 each) + moving bodies(32 each).
// Float32 positions/quaternions, not JSON transforms. Little-endian, versioned (COL5).
import {handQuaternion} from './giant-rig.js';
export const MAGIC = 0x434f4c35;
export const HEADER = 136, PLAYER = 64, BODY = 32, MAX_PLAYERS = 9, MAX_BODIES = 1200;
export function encodeSnapshot(s){
 const p = s.players || [], b = s.bodies || [], buffer = new ArrayBuffer(HEADER + p.length * PLAYER + b.length * BODY), d = new DataView(buffer); let o = 0;
 const u = x => { d.setUint32(o, x >>> 0, true); o += 4; }, f = x => { d.setFloat32(o, Number.isFinite(x) ? x : 0, true); o += 4; };
 u(MAGIC); u(s.tick); f(s.time); f(s.bossHP); f(s.remaining); u(s.kills); u(p.length); u(b.length);
 for(const a of [s.head, s.left, s.right]) for(const x of a) f(x);
 f(s.bossYaw); f(s.bossX); f(s.bossZ); f(s.damage); f(s.phase); f(s.round); f(s.bossStagger || 0); u(s.towersDown || 0); f(s.bossBlocked || 0);
 for(const side of ['left', 'right']) for(const x of handQuaternion(s[side + 'Quaternion'], s.bossYaw)) f(x);
 for(const a of p){ u(a.id); u(a.flags); for(const x of a.p) f(x); for(const x of a.v) f(x); f(a.yaw); f(a.hp); f(a.fuel); f(a.seq); f(a.pitch); f(a.dodgeCooldown); f(a.heavyCooldown || 0); f(a.score || 0); }
 for(const a of b){ u(a.id); for(const x of a.p) f(x); for(const x of a.q) f(x); }
 return buffer;
}
export function decodeSnapshot(buffer){
 const d = new DataView(buffer); let o = 0;
 if(d.byteLength < HEADER || d.getUint32(0, true) !== MAGIC) throw Error('Bad snapshot');
 const u = () => { const n = d.getUint32(o, true); o += 4; return n; }, f = () => { const n = d.getFloat32(o, true); o += 4; return n; };
 u(); const s = {tick:u(), time:f(), bossHP:f(), remaining:f(), kills:u()}, np = u(), nb = u();
 if(np > MAX_PLAYERS || nb > MAX_BODIES || d.byteLength !== HEADER + np * PLAYER + nb * BODY) throw Error('Invalid snapshot size');
 s.head = [f(), f(), f()]; s.left = [f(), f(), f()]; s.right = [f(), f(), f()];
 s.bossYaw = f(); s.bossX = f(); s.bossZ = f(); s.damage = f(); s.phase = f(); s.round = f(); s.bossStagger = f(); s.towersDown = u(); s.bossBlocked = f();
 s.leftQuaternion = [f(), f(), f(), f()]; s.rightQuaternion = [f(), f(), f(), f()];
 s.players = []; s.bodies = [];
 for(let i = 0; i < np; i++) s.players.push({id:u(), flags:u(), p:[f(), f(), f()], v:[f(), f(), f()], yaw:f(), hp:f(), fuel:f(), seq:f(), pitch:f(), dodgeCooldown:f(), heavyCooldown:f(), score:f()});
 for(let i = 0; i < nb; i++) s.bodies.push({id:u(), p:[f(), f(), f()], q:[f(), f(), f(), f()]});
 return s;
}
