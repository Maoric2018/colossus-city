// Rounded circuits use the existing street grid and right-hand traffic lanes.
// Distances are metres along a continuous route; no wrap teleports are needed.
const TAU=Math.PI*2,wrap=(n,max)=>(n%max+max)%max;
export function trafficRoutes(env){
 const roads=env.roads;if(!roads)return [];
 const {avenues,streets,avenueWidth,streetWidth}=roads,out=[];
 for(let x=0;x<avenues.length-1;x++)for(let z=0;z<streets.length-1;z++){
  const left=avenues[x]+avenueWidth/4,right=avenues[x+1]-avenueWidth/4,top=streets[z]+streetWidth/4,bottom=streets[z+1]-streetWidth/4;
  // Right-turn circuits keep ambient traffic flowing through the junctions
  // without crossing opposing lanes or needing extra traffic-light rendering.
  const nodes=[[left,top],[right,top],[right,bottom],[left,bottom]],radius=5;
  out.push(roundedRoute(nodes,radius));
 }return out;
}
function roundedRoute(nodes,radius){
 const corners=nodes.map((p,i)=>{const a=nodes[(i+3)%4],b=nodes[(i+1)%4],d1=Math.hypot(p[0]-a[0],p[1]-a[1]),d2=Math.hypot(b[0]-p[0],b[1]-p[1]),u=[(p[0]-a[0])/d1,(p[1]-a[1])/d1],v=[(b[0]-p[0])/d2,(b[1]-p[1])/d2],r=Math.min(radius,d1/3,d2/3),entry=p.map((n,k)=>n-u[k]*r),exit=p.map((n,k)=>n+v[k]*r),center=entry.map((n,k)=>n+v[k]*r);return {entry,exit,center,r,angle:Math.atan2(entry[1]-center[1],entry[0]-center[0]),sign:Math.sign(u[0]*v[1]-u[1]*v[0])};});
 const segments=[];let length=0;
 for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],n=Math.hypot(...b.entry.map((v,k)=>v-a.exit[k]));segments.push({start:length,length:n,a:a.exit,b:b.entry});length+=n;const arcLength=b.r*Math.PI/2;segments.push({...b,start:length,length:arcLength});length+=arcLength;}
 return {segments,length};
}
export function routePose(route,distance){
 const d=wrap(distance,route.length),s=route.segments.find(s=>d<s.start+s.length)||route.segments.at(-1),t=(d-s.start)/s.length;
 if(s.center){const a=s.angle+s.sign*t*Math.PI/2;return {x:s.center[0]+Math.cos(a)*s.r,z:s.center[1]+Math.sin(a)*s.r,dx:-Math.sin(a)*s.sign,dz:Math.cos(a)*s.sign,turn:true};}
 return {x:s.a[0]+(s.b[0]-s.a[0])*t,z:s.a[1]+(s.b[1]-s.a[1])*t,dx:(s.b[0]-s.a[0])/s.length,dz:(s.b[1]-s.a[1])/s.length,turn:false};
}
export function closestRoute(route,x,z){
 let best={error:Infinity,distance:0};
 for(const s of route.segments){let t;
  if(s.center){const angle=Math.atan2(z-s.center[1],x-s.center[0]),a=wrap((angle-s.angle)*s.sign,TAU);t=a<=Math.PI/2?a/(Math.PI/2):a<Math.PI*1.25?1:0;}
  else t=Math.max(0,Math.min(1,((x-s.a[0])*(s.b[0]-s.a[0])+(z-s.a[1])*(s.b[1]-s.a[1]))/(s.length*s.length)));
  const distance=s.start+t*s.length,p=routePose(route,distance),error=Math.hypot(p.x-x,p.z-z);if(error<best.error)best={distance,error};
 }return best;
}
