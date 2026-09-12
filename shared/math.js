export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const v = (x=0,y=0,z=0) => ({x,y,z});
export const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a,s)=>v(a.x*s,a.y*s,a.z*s);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const len=a=>Math.hypot(a.x,a.y,a.z);
export const norm=a=>mul(a,1/(len(a)||1));
export const dist=(a,b)=>len(sub(a,b));
export const arr=a=>[a.x,a.y,a.z];
export const vec=a=>v(a[0],a[1],a[2]);
export const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
export const identity=()=>({x:0,y:0,z:0,w:1});
export function quatYaw(yaw){return {x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)};}
export function rotateYaw(p,yaw){const s=Math.sin(yaw),c=Math.cos(yaw);return v(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
export function segmentDistance(p,a,b){const ab=sub(b,a); const t=clamp(dot(sub(p,a),ab)/(dot(ab,ab)||1),0,1);return dist(p,add(a,mul(ab,t)));}
export function raySphere(origin, direction, center, radius){
 const oc=sub(origin,center), b=dot(oc,direction),c=dot(oc,oc)-radius*radius,d=b*b-c;
 if(d<0)return Infinity; const a=-b-Math.sqrt(d),z=-b+Math.sqrt(d);return a>=0?a:(z>=0?z:Infinity);
}
export function segmentAABB(a,b,center,half,padding=0){
 let lo=0,hi=1;const d=sub(b,a);
 for(const k of ['x','y','z']){const mn=center[k]-half[k]-padding,mx=center[k]+half[k]+padding;
  if(Math.abs(d[k])<1e-8){if(a[k]<mn||a[k]>mx)return false;}else{
   let t1=(mn-a[k])/d[k],t2=(mx-a[k])/d[k];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;
  }
 }return true;
}
export function seeded(seed=12345){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function finiteVector(x,n=3,limit=1000){return Array.isArray(x)&&x.length===n&&x.every(a=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a)<=limit);}
export function sanitizeInput(m){
 if(!m||!Number.isFinite(m.yaw)||!Number.isFinite(m.pitch))return null;
 return {x:clamp(Number(m.x)||0,-1,1),z:clamp(Number(m.z)||0,-1,1),up:clamp(Number(m.up)||0,-1,1),boost:!!m.boost,fire:!!m.fire,soar:!!m.soar,missile:!!m.missile,dodge:clamp(Math.floor(Number(m.dodge)||0),0,1e9),rocket:clamp(Math.floor(Number(m.rocket)||0),0,1e9),
 aimYaw:clamp(Number.isFinite(m.aimYaw)?m.aimYaw:m.yaw,-1e5,1e5),aimPitch:clamp(Number.isFinite(m.aimPitch)?m.aimPitch:m.pitch,-1.55,1.55),
 yaw:clamp(m.yaw,-1e5,1e5),pitch:clamp(m.pitch,-1.45,1.45),seq:clamp(Number(m.seq)||0,0,1e9)};
}
export function lookDir(yaw,pitch=0){return v(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}

// Forward distance to an AABB. Direction must be normalized; an inside origin returns zero.
export function rayAABB(origin,direction,center,half,maxDistance=Infinity,padding=0){
 let lo=0,hi=maxDistance;
 for(const k of ['x','y','z']){
  const mn=center[k]-half[k]-padding,mx=center[k]+half[k]+padding;
  if(Math.abs(direction[k])<1e-10){if(origin[k]<mn||origin[k]>mx)return Infinity;}
  else{let a=(mn-origin[k])/direction[k],b=(mx-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;}
 }
 return lo;
}
export function quatEuler(x=0,y=0,z=0){
 const c1=Math.cos(x/2),c2=Math.cos(y/2),c3=Math.cos(z/2),s1=Math.sin(x/2),s2=Math.sin(y/2),s3=Math.sin(z/2);
 return {x:s1*c2*c3+c1*s2*s3,y:c1*s2*c3-s1*c2*s3,z:c1*c2*s3+s1*s2*c3,w:c1*c2*c3-s1*s2*s3};
}
