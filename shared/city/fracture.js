// Fine pieces are allocated only for touched bays. The coarse support graph stays
// small; these piece IDs and holes are shared by authority, prediction and rendering.
import {roofColliders} from '../props.js';
import {sideBit} from './materials.js';
const cache=new WeakMap();
const windows={brick:[[.1,.28,.2,.42],[.4,.28,.2,.42],[.7,.28,.2,.42]],stone:[[.12,.22,.3,.5],[.58,.22,.3,.5]],concrete:[[.06,.3,.88,.36]],empire:[[.13,.15,.16,.71],[.42,.15,.16,.71],[.71,.15,.16,.71]],chrysler:[[.13,.14,.16,.7],[.42,.14,.16,.7],[.71,.14,.16,.7]]};
export function fractureRecipe(c){
 if(cache.has(c))return cache.get(c);
 const [w,h,d]=c.size,pieces=[],groups=[];
 const partition=(center,size,step,kind,side=-1,material='concrete')=>{
  const n=size.map((v,k)=>Math.max(1,Math.ceil(v/step[k]))),unit=size.map((v,k)=>v/n[k]),group={id:groups.length,n,center,size,unit,start:pieces.length,kind,side};groups.push(group);
  for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
   const grid=[x,y,z],p=grid.map((v,k)=>center[k]+(v-(n[k]-1)/2)*unit[k]);let mat=material;
   if(kind==='wall'&&material!=='glass'){
    const u=(side%2?p[2]/d:p[0]/w)*(side===1||side===2?-1:1)+.5,v=.5-p[1]/h;
    if((windows[c.architecture]||windows[material]||[]).some(([a,b,ww,hh])=>u>a&&u<a+ww&&v>b&&v<b+hh))mat='glass';
   }
   pieces.push({id:pieces.length,group:group.id,grid,p,size:[...unit],kind,side,material:mat,layer:kind==='wall'?(mat==='glass'?'glass':'facade'):'frame'});
  }
 };
 partition([0,h/2-.13,0],[w,.26,d],[.72,1,.72],'frame');
 for(const x of [-1,1])for(const z of [-1,1])partition([x*(w/2-.15),0,z*(d/2-.15)],[.3,Math.max(.08,h-.52),.3],[1,.62,1],'frame',-1,'steel');
 for(let side=0;side<4;side++)if(c.walls[side]&&!c.openSkin){
  const glass=c.material==='glass',width=side%2?d:w,step=glass?.76:c.material==='brick'?.42:.58,sy=glass?.82:c.material==='brick'?.24:.38;
  const center=side%2?[(side===1?1:-1)*w/2,0,0]:[0,0,(side===0?-1:1)*d/2],size=side%2?[.12,h*.925,width]:[width,h*.925,.12];
  partition(center,size,side%2?[1,sy,step]:[step,sy,1],'wall',side,c.material);
 }
 // Roof equipment/crowns fragment where hit, while undamaged signature parts
 // continue to use their exact authored mesh and contact proxies.
 for(const a of roofColliders(c))partition(a.slice(0,3),a.slice(3).map(v=>v*2),[.8,.8,.8],'attachment',-1,'stone');
 const recipe={pieces,groups};cache.set(c,recipe);return recipe;
}
export function pieceAlive(piece,skin,gone){
 if(gone?gone.has(piece.id):skin.parts?.includes(piece.id))return false;
 if(piece.kind!=='wall')return true;
 return !!(skin[piece.layer]&sideBit(piece.side));
}
// Greedily combine adjacent surviving tiles into contact rectangles. A thousand
// visible bricks need only a handful of colliders around the punched opening.
export function fractureColliders(c,skin){
 const {pieces,groups}=fractureRecipe(c),gone=new Set(skin.parts||[]),out=[];
 for(const g of groups){
  const [nx,ny,nz]=g.n,live=new Uint8Array(nx*ny*nz),at=(x,y,z)=>x+nx*(y+ny*z);
  for(let i=0;i<live.length;i++){const p=pieces[g.start+i];live[i]=!gone.has(p.id)&&(p.kind!=='wall'||!!(skin[p.layer]&sideBit(p.side)))?1:0;}
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   if(!live[at(x,y,z)])continue;let ex=x+1,ey=y+1,ez=z+1;
   while(ex<nx&&live[at(ex,y,z)])ex++;
   const row=yy=>{for(let xx=x;xx<ex;xx++)if(!live[at(xx,yy,z)])return false;return true;};while(ey<ny&&row(ey))ey++;
   const plane=zz=>{for(let yy=y;yy<ey;yy++)for(let xx=x;xx<ex;xx++)if(!live[at(xx,yy,zz)])return false;return true;};while(ez<nz&&plane(ez))ez++;
   for(let zz=z;zz<ez;zz++)for(let yy=y;yy<ey;yy++)for(let xx=x;xx<ex;xx++)live[at(xx,yy,zz)]=0;
   const lo=[x,y,z],hi=[ex,ey,ez],a=lo.map((v,k)=>g.center[k]+((v+hi[k])/2-g.n[k]/2)*g.unit[k]);a.push(...lo.map((v,k)=>(hi[k]-v)*g.unit[k]/2));a.kind=g.kind;a.side=g.side;a.part=pieces[g.start+at(x,y,z)].id;out.push(a);
  }
 }return out;
}
export function pieceDistance(piece,point){return Math.hypot(...point.map((v,k)=>Math.max(0,Math.abs(v-piece.p[k])-piece.size[k]/2)));}
export function fractureStrength(c,skin){
 const {pieces,groups}=fractureRecipe(c),gone=new Set(skin.parts||[]),columns=groups.filter(g=>g.kind==='frame'&&pieces[g.start].material==='steel');
 const cut=columns.filter(g=>pieces.slice(g.start,g.start+g.n.reduce((a,b)=>a*b,1)).some(p=>gone.has(p.id))).length;
 const frame=pieces.filter(p=>p.kind==='frame'),lost=frame.filter(p=>gone.has(p.id)).length/frame.length;
 return cut===4||lost>.87?0:Math.max(.45,1-lost*.5-cut*.07);
}
export const pieceEnergy=p=>({glass:2,brick:5,stone:7,concrete:8,steel:12}[p.material]||6);
// Small islands surrounded by a hole cannot remain suspended in a facade.
// Border-connected masonry still benefits from the building's strong frame.
export function unsupportedWallPieces(c,gone){
 const {pieces,groups}=fractureRecipe(c),out=[];
 for(const g of groups){if(g.kind!=='wall')continue;const [nx,ny,nz]=g.n,count=nx*ny*nz,seen=new Set(),queue=[],index=(x,y,z)=>g.start+x+nx*(y+ny*z);
  for(let i=g.start;i<g.start+count;i++){const p=pieces[i];if(!gone.has(i)&&p.grid.some((v,k)=>g.n[k]>1&&(v===0||v===g.n[k]-1))){seen.add(i);queue.push(p);}}
  for(let j=0;j<queue.length;j++)for(let k=0;k<3;k++)for(const d of [-1,1]){const xyz=[...queue[j].grid];xyz[k]+=d;if(xyz[k]<0||xyz[k]>=g.n[k])continue;const id=index(...xyz);if(!gone.has(id)&&!seen.has(id)){seen.add(id);queue.push(pieces[id]);}}
  for(let i=g.start;i<g.start+count;i++)if(!gone.has(i)&&!seen.has(i))out.push(pieces[i]);
 }return out;
}
export function shardBallistic(meta,time){
 const t=Math.max(0,Math.min(meta.duration,time-meta.born)),p=meta.start.map((v,k)=>v+meta.velocity[k]*t+(k===1?-12*t*t:0));
 p[1]=Math.max(meta.ground,p[1]);return {p,q:[Math.sin(t*.7)*.3,Math.sin(t*.5)*.3,0,Math.sqrt(1-(Math.sin(t*.7)*.3)**2-(Math.sin(t*.5)*.3)**2)]};
}
