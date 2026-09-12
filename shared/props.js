import {propBounds} from './prop-bounds.js';
export const ROOF_ASSETS=[['city-kit-industrial/water-tower',2.8],['space-kit/satelliteDish_detailed',2.4],['city-kit-industrial/detail-tank',1.1],['city-kit-industrial/solar-panel-flat',.25]];
// One placement list drives both the downloaded car instances and their physics.
export function carPlacements(env){
 if(env.id!=='harbor-district')return [];
 const cars=['taxi','sedan','police','van','firetruck','delivery'],out=[];
 cars.forEach((name,type)=>{for(let i=type;i<42;i+=cars.length){const along=(i%14)*10-66,road=[-37,0,37][Math.floor(i/14)],swap=i%2;if([-37,0,37].some(n=>Math.abs(along-n)<8))continue;const asset='car-kit/'+name,scale=(type>2?4.8:3.9)/propBounds[asset][2],size=propBounds[asset].map(v=>v*scale);out.push({id:'car-'+i,kind:'car',asset,scale,size,position:[swap?along:road+3.6,.13,swap?road-3.6:along],yaw:swap?Math.PI/2:Math.PI,boxes:[[0,size[1]/2,0,size[0]/2,size[1]/2,size[2]/2]]});}});return out;
}
export function roofProp(c){
 if(!c.roof||!c.hasRoofProps)return null;const [asset,height]=ROOF_ASSETS[(c.ix+c.iz*2+c.building)%4],scale=height/propBounds[asset][1],size=propBounds[asset].map(v=>v*scale);
 return {asset,height,scale,size,yaw:c.building*Math.PI/2};
}
export function roofColliders(c){
 const p=roofProp(c);if(!p)return [];const [w,h,d]=p.size,swap=c.building%2,base=c.size[1]/2+.02;
 // Quarter-turn roof placements allow exact axis-aligned bounds in bay space.
 return [[0,base+h/2,0,(swap?d:w)/2,h/2,(swap?w:d)/2]];
}
export function staticProps(env){
 const props=carPlacements(env);if(env.id!=='harbor-district')return props;
 const add=(id,kind,position,half)=>props.push({id,kind,position,yaw:0,boxes:[[0,0,0,...half]]});
 for(const x of [-44,-7,7,44])for(let z=-68;z<=68;z+=20){add(`lamp-${x}-${z}`,'lamp',[x,2.6,z],[.09,2.5,.09]);add(`lamp-arm-${x}-${z}`,'lamp',[x+.6,5.1,z],[.7,.045,.045]);add(`lamp-bulb-${x}-${z}`,'lamp',[x+1,5.03,z],[.375,.02,.14]);}
 env.buildings.forEach((b,i)=>{const w=b.nx*b.bay,d=b.nz*b.bay;add('walk-'+i,'pavement',[b.x,.08,b.z],[(w+3)/2,.08,(d+3)/2]);for(const sign of [-1,1]){const z=b.z+sign*(d/2+.12);add(`sign-${i}-${sign}`,'sign',[b.x,1.4,z],[w*.42,.45,.04]);for(const dx of [-1,1])add(`signpost-${i}-${sign}-${dx}`,'sign',[b.x+dx*w*.36,.93,z],[.035,.925,.035]);}});
 for(const side of [-1,1]){const z=side*91;add('bridge-'+side,'bridge',[0,3.4,z],[185,.4,3.5]);for(const x of [-100,-40,40,100]){for(const dz of [-3,3])add(`bridgepost-${side}-${x}-${dz}`,'bridge',[x,11,z+dz],[.7,11.5,.75]);add(`bridgecap-${side}-${x}`,'bridge',[x,21.5,z],[.7,.5,3.75]);}for(let x=-150;x<150;x+=6){const y=5+13*Math.cos(x*Math.PI/80)**2;for(const dz of [-3,3])add(`cable-${side}-${x}-${dz}`,'bridge',[x,(y+4)/2,z+dz],[.05,Math.max(.1,y-4)/2,.05]);}}
 return props;
}
