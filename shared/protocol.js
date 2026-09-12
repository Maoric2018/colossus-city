// 32-byte header + 60-byte boss + players(48 each) + moving bodies(32 each).
// Float32 positions/quaternions, not JSON transforms. Little-endian, versioned.
export const MAGIC=0x434f4c31;
export const KIND={CELL:0,RAGDOLL:1};
export function encodeSnapshot(s){
 const p=s.players||[], b=s.bodies||[],buffer=new ArrayBuffer(92+p.length*48+b.length*32),d=new DataView(buffer);let o=0;
 const u=x=>{d.setUint32(o,x>>>0,true);o+=4;},f=x=>{d.setFloat32(o,Number.isFinite(x)?x:0,true);o+=4;};
 u(MAGIC);u(s.tick);f(s.time);f(s.bossHP);f(s.remaining);u(s.kills);u(p.length);u(b.length);
 for(const a of [s.head,s.left,s.right])for(const x of a)f(x);
 f(s.bossYaw);f(s.bossX);f(s.bossZ);f(s.damage);f(s.phase);f(s.round);
 for(const a of p){u(a.id);u(a.flags);for(const x of a.p)f(x);for(const x of a.v)f(x);f(a.yaw);f(a.hp);f(a.fuel);f(a.seq);}
 for(const a of b){u(a.id);for(const x of a.p)f(x);for(const x of a.q)f(x);}
 return buffer;
}
export function decodeSnapshot(buffer){
 const d=new DataView(buffer);let o=0;
 if(d.byteLength<92||d.getUint32(0,true)!==MAGIC)throw Error('Bad snapshot');
 const u=()=>{const n=d.getUint32(o,true);o+=4;return n;},f=()=>{const n=d.getFloat32(o,true);o+=4;return n;};
 u();const s={tick:u(),time:f(),bossHP:f(),remaining:f(),kills:u()},np=u(),nb=u();
 if(np>9||nb>1200||d.byteLength!==92+np*48+nb*32)throw Error('Invalid snapshot size');
 s.head=[f(),f(),f()];s.left=[f(),f(),f()];s.right=[f(),f(),f()];
 s.bossYaw=f();s.bossX=f();s.bossZ=f();s.damage=f();s.phase=f();s.round=f();
 s.players=[];s.bodies=[];
 for(let i=0;i<np;i++)s.players.push({id:u(),flags:u(),p:[f(),f(),f()],v:[f(),f(),f()],yaw:f(),hp:f(),fuel:f(),seq:f()});
 for(let i=0;i<nb;i++)s.bodies.push({id:u(),p:[f(),f(),f()],q:[f(),f(),f(),f()]});return s;
}
