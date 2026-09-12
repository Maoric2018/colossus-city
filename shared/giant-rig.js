// Shared palm-centered dimensions: rendering, solid contact and hits use one box.
export const GIANT=Object.freeze({handSize:[2.9,2.5,2.8],handHalf:[1.45,1.25,1.4],wrist:[0,0,2.85],upperLength:6,lowerLength:6,bodySize:[8.8,9.5,4.7],headSize:[4.5,4.3,3.8],chestDrop:7.2,shoulder:[4.2,3.1,0]});
export const identity=[0,0,0,1];
export const plus=(a,b)=>a.map((v,i)=>v+b[i]);
export const minus=(a,b)=>a.map((v,i)=>v-b[i]);
export const times=(a,n)=>a.map(v=>v*n);
export const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function rotate(p,q=identity){const u=q.slice(0,3),t=times(cross(u,p),2);return plus(p,plus(times(t,q[3]),cross(u,t)));}
export function handQuaternion(value,yaw=0){if(Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)){const n=Math.hypot(...value);if(n>.5&&n<1.5)return value.map(v=>v/n);}return [0,Math.sin(yaw/2),0,Math.cos(yaw/2)];}
export function axes(q){return [[1,0,0],[0,1,0],[0,0,1]].map(a=>rotate(a,q));}
export const support=(basis,half,n)=>half.reduce((sum,h,i)=>sum+h*Math.abs(dot(basis[i],n)),0);
export function box(center,half,q=identity,cell=null){const basis=axes(q),extent=[0,1,2].map(i=>support(basis,half,[0,1,2].map(k=>+(i===k))));return {center,half,basis,extent,cell};}
// Continuous translational OBB sweep using the 15 separating axes. Unlike a
// center ray / undersized sphere, this catches the knuckles and rotated corners.
export function sweepBox(from,to,basis,half,other,padding=.015){
 const offset=minus(from,other.center),motion=minus(to,from),testAxes=[...basis,...other.basis,...basis.flatMap(a=>other.basis.map(b=>cross(a,b)))];
 let enter=0,exit=1,normal=null,inside=true,depth=Infinity,push=null;
 for(let n of testAxes){const length=Math.hypot(...n);if(length<1e-7)continue;n=times(n,1/length);
  const radius=support(basis,half,n)+support(other.basis,other.half,n)+padding,d=dot(offset,n),speed=dot(motion,n),overlap=radius-Math.abs(d);
  if(overlap<0)inside=false;if(overlap<depth){depth=overlap;push=times(n,d<0?-1:1);}
  if(Math.abs(speed)<1e-9){if(Math.abs(d)>radius)return null;continue;}
  let a=(-radius-d)/speed,b=(radius-d)/speed;if(a>b)[a,b]=[b,a];
  if(a>enter){enter=a;normal=times(n,speed>0?-1:1);}exit=Math.min(exit,b);if(enter>exit)return null;
 }
 if(inside){if(depth<.025&&dot(motion,push)>=-1e-8)return null;return {t:0,normal:push,depth};}
 return enter>=0&&enter<=1&&normal?{t:enter,normal,depth:0}:null;
}
export function handRay(origin,direction,center,q,maxDistance=Infinity){const basis=axes(q),offset=minus(origin,center);let lo=0,hi=maxDistance;for(let i=0;i<3;i++){const d=dot(offset,basis[i]),v=dot(direction,basis[i]),h=GIANT.handHalf[i];if(Math.abs(v)<1e-9){if(Math.abs(d)>h)return Infinity;}else{let a=(-h-d)/v,b=(h-d)/v;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;}}return lo;}
// Stop at the first surface, then slide along it. A bent wrist may require a
// small separation correction; tracked targets themselves are never overwritten.
// Contact points are clamped to the actual obstacle, including glancing knuckles.
export function closestBoxPoint(point,other){const delta=minus(point,other.center);let result=[...other.center];for(let i=0;i<3;i++)result=plus(result,times(other.basis[i],Math.max(-other.half[i],Math.min(other.half[i],dot(delta,other.basis[i])))));return result;}
export function resolveHand(from,target,q,world){
 const basis=axes(q),half=GIANT.handHalf,contacts=new Map();let position=[...from];
 for(let iteration=0;iteration<6;iteration++){
  let nearest=null;const hits=[];
  for(const other of world.near(position,target)){const hit=sweepBox(position,target,basis,half,other);if(!hit)continue;hits.push({hit,other});if(!nearest||hit.t<nearest.t||(hit.t===0&&hit.depth>nearest.depth))nearest=hit;}
  if(!nearest){position=[...target];break;}
  const motion=minus(target,position);position=plus(position,times(motion,nearest.t));
  position=plus(position,times(nearest.normal,nearest.depth+.002));
  // A fist straddling two coplanar bays really touches both. Do not let iteration
  // order choose one arbitrary bay, or carry the sweep through the front wall.
  for(const {hit,other} of hits)if(Math.abs(hit.t-nearest.t)<1e-5&&dot(hit.normal,nearest.normal)>.95){
   const point=closestBoxPoint(minus(position,times(hit.normal,support(basis,half,hit.normal))),other);
   contacts.set(other,{cell:other.cell,point,normal:hit.normal,kind:other.kind||'frame',side:other.side,debris:!!other.debris});
  }
  const rest=minus(target,position),into=dot(rest,nearest.normal);target=into<0?minus(target,times(nearest.normal,into)):target;
  if(Math.hypot(...minus(target,position))<.0001)break;
 }
 return {position,contacts:[...contacts.values()]};
}
