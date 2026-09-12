import {modernColliders} from './city/modern-landmarks.js';
import {catalogRoofColliders} from './city/catalog-components.js';
import {chryslerColliders} from './city/chrysler.js';
import {trafficRoutes,routePose} from './traffic.js';
import {seeded} from './math.js';
import {propBounds} from './prop-bounds.js';
import {sidewalkSlabs} from './streets.js';
export const ROOF_ASSETS=[['city-kit-industrial/water-tower',2.8],['space-kit/satelliteDish_detailed',2.4],['city-kit-industrial/detail-tank',1.1],['city-kit-industrial/solar-panel-flat',.25]];
// One placement list drives both the downloaded car instances and their physics.
export function carPlacements(env){
 if(env.id==='midtown')return midtownCars(env);
 if(env.id!=='harbor-district')return [];
 const cars=['taxi','sedan','police','van','firetruck','delivery'],out=[];
 cars.forEach((name,type)=>{for(let i=type;i<42;i+=cars.length){const along=(i%14)*10-66,road=[-37,0,37][Math.floor(i/14)],swap=i%2;if([-37,0,37].some(n=>Math.abs(along-n)<8))continue;const asset='car-kit/'+name,scale=(type>2?4.8:3.9)/propBounds[asset][2],size=propBounds[asset].map(v=>v*scale);out.push({id:'car-'+i,kind:'car',asset,scale,size,position:[swap?along:road+3.6,.13,swap?road-3.6:along],yaw:swap?Math.PI/2:Math.PI,boxes:[[0,size[1]/2,0,size[0]/2,size[1]/2,size[2]/2]]});}});return out;
}
export function roofProp(c){
 if(c.roofAsset){const [asset,height]=c.roofAsset,scale=height/propBounds[asset][1],size=propBounds[asset].map(v=>v*scale);return {asset,height,scale,size,yaw:(c.roofYaw??c.building)*Math.PI/2};}
 if(!c.roof||!c.hasRoofProps)return null;const [asset,height]=ROOF_ASSETS[(c.ix+c.iz*2+c.building)%4],scale=height/propBounds[asset][1],size=propBounds[asset].map(v=>v*scale);
 return {asset,height,scale,size,yaw:(c.roofYaw??c.building)*Math.PI/2};
}
export function roofColliders(c){
 const crown=[...(c.architecture==='chrysler'?chryslerColliders(c):modernColliders(c)),...catalogRoofColliders(c)];
 const spire=c.spire?[[0,c.size[1]/2+c.spire/2,0,.9,c.spire/2,.9]]:[];
 const p=roofProp(c);if(!p)return [...spire,...crown];const [w,h,d]=p.size,swap=(c.roofYaw??c.building)%2,base=c.size[1]/2+(c.roofAsset?.04:.02);
 // Quarter-turn roof placements allow exact axis-aligned bounds in bay space.
 return [...spire,...crown,[0,base+h/2,0,(swap?d:w)/2,h/2,(swap?w:d)/2]];
}
export function staticProps(env){
 const props=[];if(env.id==='midtown')return props.concat(midtownProps(env));if(env.id==='city-block')return sidewalkSlabs(env);if(env.id!=='harbor-district')return props;
 const add=(id,kind,position,half)=>props.push({id,kind,position,yaw:0,boxes:[[0,0,0,...half]]});
 for(const x of [-44,-7,7,44])for(let z=-68;z<=68;z+=20){add(`lamp-${x}-${z}`,'lamp',[x,2.6,z],[.09,2.5,.09]);add(`lamp-arm-${x}-${z}`,'lamp',[x+.6,5.1,z],[.7,.045,.045]);add(`lamp-bulb-${x}-${z}`,'lamp',[x+1,5.03,z],[.375,.02,.14]);}
 env.buildings.forEach((b,i)=>{const w=b.nx*b.bay,d=b.nz*b.bay;add('walk-'+i,'pavement',[b.x,.08,b.z],[(w+3)/2,.08,(d+3)/2]);});
 for(const side of [-1,1]){const z=side*91;add('bridge-'+side,'bridge',[0,3.4,z],[185,.4,3.5]);for(const x of [-100,-40,40,100]){for(const dz of [-3,3])add(`bridgepost-${side}-${x}-${dz}`,'bridge',[x,11,z+dz],[.7,11.5,.75]);add(`bridgecap-${side}-${x}`,'bridge',[x,21.5,z],[.7,.5,3.75]);}for(let x=-150;x<150;x+=6){const y=5+13*Math.cos(x*Math.PI/80)**2;for(const dz of [-3,3])add(`cable-${side}-${x}-${dz}`,'bridge',[x,(y+4)/2,z+dz],[.05,Math.max(.1,y-4)/2,.05]);}}
 return props;
}

function midtownCars(env){
 const cars=['taxi','sedan','police','van','firetruck','delivery'],out=[],rand=seeded(78103),routes=trafficRoutes(env);
 for(const [ri,route] of routes.entries())for(let i=0;i<4;i++){
  // Keep spawn gaps clear even where neighbouring circuits share a lane.
  let at,distance;for(let attempt=0;attempt<12;attempt++){distance=(i*.25+.04+rand()*.12)*route.length;at=routePose(route,distance);if(!at.turn&&out.every(p=>Math.hypot(p.position[0]-at.x,p.position[2]-at.z)>9))break;at=null;}
  if(!at)continue;const type=(ri*4+i)%cars.length,asset='car-kit/'+cars[type],scale=(type>2?4.8:3.9)/propBounds[asset][2],size=propBounds[asset].map(v=>v*scale);
  out.push({id:`car-${ri}-${i}`,kind:'car',asset,scale,size,position:[at.x,.13,at.z],yaw:Math.atan2(at.dx,at.dz),traffic:{route,distance,speed:4.8+rand()*2},boxes:[[0,size[1]/2,0,size[0]/2,size[1]/2,size[2]/2]]});
 }return out;
}

function midtownProps(env){
 const out=[],add=(id,kind,position,half)=>out.push({id,kind,position,yaw:0,boxes:[[0,0,0,...half]]}),{avenues,streets,avenueWidth,streetWidth}=env.roads;
 for(const x of avenues)for(let z=-env.half+8;z<=env.half-8;z+=24)for(const side of [-1,1]){
  if(streets.some(s=>Math.abs(z-s)<streetWidth/2+2))continue;
  const lx=x+side*(avenueWidth/2+.8),id=`lamp-${lx}-${z}`;add(id,'lamp',[lx,3,z],[.1,3,.1]);add(id+'-arm','lamp',[lx-side*.7,6.1,z],[.8,.05,.05]);add(id+'-bulb','lamp',[lx-side*1.2,6.03,z],[.4,.025,.15]);
 }
 if(env.infinite)out.push(...sidewalkSlabs(env));
 else for(const [i,b] of env.buildings.entries()){
  const w=b.tiers[0].nx*b.bay,d=b.tiers[0].nz*b.bay;add('walk-'+i,'pavement',[b.x,.09,b.z],[(w+4)/2,.09,(d+4)/2]);
 }
 if(!env.infinite)for(const side of [-1,1]){
  const z=side*(env.half+22);add('bridge-'+side,'bridge',[0,3.4,z],[450,.4,4]);
  for(const x of [-300,-180,-60,60,180,300]){for(const dz of [-3.5,3.5])add(`post-${side}-${x}-${dz}`,'bridge',[x,17,z+dz],[.8,17,.8]);add(`cap-${side}-${x}`,'bridge',[x,33,z],[.8,.5,4.25]);}
  for(let x=-420;x<420;x+=8){const y=6+22*Math.cos(x*Math.PI/120)**2;for(const dz of [-3.5,3.5])add(`cable-${side}-${x}-${dz}`,'bridge',[x,(y+4)/2,z+dz],[.06,Math.max(.1,y-4)/2,.06]);}
 }return out;
}
