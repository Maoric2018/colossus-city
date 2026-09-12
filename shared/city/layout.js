// The only authoritative map definition. Visual assets never decide collisions.
// MIDTOWN: a Manhattan-style grid of avenues (north-south) and streets (east-west) with
// Dense blocks, landmark towers and street-front infill. Integer bay grids keep
// vertical support continuity. Coordinates are metres; +x east, +z south.
const bay = 6, story = 3.6;
const tower = (x, z, name, material, tiers, extra = {}) => ({x, z, name, material, bay, story, tiers, ...extra});
const box = (nx, nz, floors, ix = 0, iz = 0) => ({nx, nz, floors, ix, iz});
export const midtown = {
 id:'midtown', name:'MIDTOWN', seed:90210,
 half:160, arena:150, giantBound:125, plaza:24, maxAltitude:150,
 sky:{top:0x16364c, horizon:0xc18b77, fog:0x8fa6ad, fogDensity:.0019},
 roads:{avenues:[-105,-35,35,105], streets:[-105,-35,35,105], avenueWidth:16, streetWidth:12},
 buildings:[
  // Inner ring around the plaza
  tower(-70,-70,'EMPIRE STATE','stone',[box(5,5,4), box(4,4,4,1,1), box(3,3,17,1,1), box(2,2,4,2,2), box(1,1,4,2,2)],{bay:4.8,story:3.4,spire:17,architecture:'empire',strength:1.2}),
  tower(-12,-78,'WORLD TRADE • NORTH','glass',[box(3,3,30)],{spire:15,architecture:'wtc',strength:1.15}),
  tower(70,-70,'HUDSON YARDS','concrete',[box(3,3,18)]),
  tower(-70,0,'CHRYSLER','stone',[box(4,3,10), box(2,2,14,1,0)],{spire:16}),
  tower(70,0,'ONE VANDERBILT','glass',[box(3,3,28)],{spire:10}),
  tower(-70,70,'TENEMENT ROW','brick',[box(4,2,7)],{waterTower:true}),
  tower(0,70,'GRAND CENTRAL','stone',[box(5,3,6)]),
  tower(70,70,'BROADWAY LOFTS','brick',[box(3,3,12)],{waterTower:true}),
  // Outer ring
  tower(-136,-136,'FLATIRON','stone',[box(2,3,14)]),
  tower(0,-136,'PARK PLAZA','concrete',[box(3,2,16)]),
  tower(136,-136,'WATERSIDE','brick',[box(3,3,9)],{waterTower:true}),
  tower(-136,0,'MADISON','concrete',[box(3,3,20)]),
  tower(136,0,'LEXINGTON','glass',[box(2,2,22)]),
  tower(-136,136,'BOWERY','brick',[box(4,2,6)],{waterTower:true}),
  tower(0,136,'UNION SQUARE','stone',[box(3,3,12)]),
  tower(136,136,'EAST RIVER','concrete',[box(2,2,14)]),
  tower(-70,-136,'CANAL WALKUP','brick',[box(3,2,7)]),
  tower(70,-136,'MULBERRY','brick',[box(2,2,8)],{waterTower:true}),
  tower(-136,-70,'SEVENTH','concrete',[box(2,2,16)]),
  tower(136,-70,'FIFTH & 57TH','stone',[box(2,2,12)]),
  tower(-136,70,'LUDLOW','brick',[box(3,2,6)]),
  tower(136,70,'HARBORVIEW','glass',[box(2,2,18)]),
  tower(-70,136,'CHELSEA','concrete',[box(3,2,10)]),
  tower(70,136,'ORCHARD','brick',[box(2,3,8)],{waterTower:true}),
  tower(12,-60,'WORLD TRADE • SOUTH','glass',[box(3,3,30)],{architecture:'wtc',strength:1.15})
 ],
 // Optional local glTF props with optional fixed-box colliders (see docs/ASSET_PIPELINE.md).
 props:[],
 cellAssets:{},
 textures:{concrete:'/assets/imported/textures/concrete-Diffuse.jpg', asphalt:'/assets/imported/textures/asphalt-Diffuse.jpg',
  concreteNormal:'/assets/imported/textures/concrete-nor_gl.jpg', concreteRoughness:'/assets/imported/textures/concrete-Rough.jpg',
  asphaltNormal:'/assets/imported/textures/asphalt-nor_gl.jpg', asphaltRoughness:'/assets/imported/textures/asphalt-Rough.jpg',
  facade:'/assets/facade.jpg', facadeNormal:'/assets/facade-normal.jpg', facadeEmissive:'/assets/facade-emissive.jpg'},
 // [x, y, z, facing yaw]: raiders drop onto the outer avenues looking straight down them.
 spawns:[[105,1.3,158,0],[-105,1.3,-158,Math.PI],[158,1.3,105,Math.PI/2],[-158,1.3,-105,-Math.PI/2]]
};
// Footprint of the base tier in world units: [minX, minZ, maxX, maxZ].
export function buildingFootprint(b){
 const t = b.tiers[0];
 return [b.x - t.nx * b.bay / 2, b.z - t.nz * b.bay / 2, b.x + t.nx * b.bay / 2, b.z + t.nz * b.bay / 2];
}
export function buildingHeight(b){ return .15 + b.tiers.reduce((s, t) => s + t.floors, 0) * b.story; }

// Fill each block with real destructible addresses, leaving roads, alleys and the plaza open.
// A deterministic perimeter pack creates continuous street fronts around the taller cores.
const xs=[[-157,-115],[-95,-45],[-25,25],[45,95],[115,157]], zs=[[-157,-113],[-97,-43],[-27,27],[43,97],[113,157]];
for(let bz=0;bz<5;bz++)for(let bx=0;bx<5;bx++){
 if(bx===2&&bz===2)continue;
 const [x0,x1]=xs[bx],[z0,z1]=zs[bz], candidates=[];
 for(let iz=0;iz<4;iz++)for(let ix=0;ix<4;ix++)if(ix===0||iz===0||ix===3||iz===3)candidates.push([ix,iz]);
 // Alternate frontages instead of putting all infill on one edge of a block.
 candidates.sort((a,b)=>((a[0]*7+a[1]*5+bx+bz*3)%13)-((b[0]*7+b[1]*5+bx+bz*3)%13));
 let count=0;
 for(const [ix,iz] of candidates){
  const variant=(bx*31+bz*17+ix*3+iz*5)%12, x=x0+4.4+(x1-x0-8.8)*ix/3,z=z0+4.4+(z1-z0-8.8)*iz/3;
  const material=['brick','stone','concrete','brick'][variant%4];
  const b=tower(x,z,`${['CANAL','MADISON','BROADWAY','LEXINGTON','RIVER'][bx]} ${bz*20+count+1}`,material,[box(2,2,3+variant%4)],{bay:4.2,story:3.3,variant,waterTower:variant%3===0,infill:true});
  const f=buildingFootprint(b),overlap=midtown.buildings.some(other=>{const a=buildingFootprint(other);return f[0]<a[2]+1.7&&f[2]>a[0]-1.7&&f[1]<a[3]+1.7&&f[3]>a[1]-1.7;});
  if(overlap)continue;
  midtown.buildings.push(b);if(++count===6)break;
 }
}

// An address is derived from its grid coordinate, never from exploration order.
export const BLOCK_SIZE=70, CELL_STRIDE=4096, STREAM_CELL_BASE=1000000;
export const BUILDING_STYLES=Object.freeze([
 {id:'brownstone',name:'BROWNSTONE',material:'brick',floors:[4,7]},
 {id:'tenement',name:'WALKUP',material:'brick',floors:[5,9]},
 {id:'warehouse',name:'WAREHOUSE',material:'brick',floors:[3,5]},
 {id:'castiron',name:'CAST IRON LOFTS',material:'stone',floors:[5,8]},
 {id:'beauxarts',name:'BEAUX ARTS',material:'stone',floors:[6,10]},
 {id:'deco',name:'DECO HOUSE',material:'stone',floors:[9,17]},
 {id:'curtain',name:'GLASS OFFICES',material:'glass',floors:[10,20]},
 {id:'terraced',name:'TERRACE HOUSE',material:'concrete',floors:[6,12]},
 {id:'brutalist',name:'CIVIC CENTRE',material:'concrete',floors:[5,10]},
 {id:'hotel',name:'GRAND HOTEL',material:'stone',floors:[8,14]},
 {id:'apartment',name:'RESIDENCES',material:'concrete',floors:[7,13]},
 {id:'industrial',name:'WORKSHOP',material:'brick',floors:[3,5]},
 {id:'market',name:'MARKET HALL',material:'stone',floors:[3,4]},
 {id:'gothic',name:'GOTHIC COURT',material:'stone',floors:[6,12]},
 {id:'copper',name:'COPPER COURT',material:'stone',floors:[7,12]},
 {id:'modern',name:'DESIGN STUDIOS',material:'concrete',floors:[5,10]}
]);
const zig=n=>n>=0?n*2:-n*2-1,unzig=n=>n%2?-(n+1)/2:n/2;
export const blockAt=(x,z)=>[Math.floor((x+35)/70),Math.floor((z+35)/70)];
export const blockKey=(x,z)=>`${x},${z}`;
export const homeBlock=(x,z)=>Math.abs(x)<=2&&Math.abs(z)<=2;
export function blockCellBase(x,z){const a=zig(x),b=zig(z),s=a+b;return STREAM_CELL_BASE+(s*(s+1)/2+b)*CELL_STRIDE;}
export function cellBlock(id){if(id<=STREAM_CELL_BASE)return null;const n=Math.floor((id-STREAM_CELL_BASE-1)/CELL_STRIDE),w=Math.floor((Math.sqrt(8*n+1)-1)/2),b=n-w*(w+1)/2;return [unzig(w-b),unzig(b)];}
export function blockSeed(x,z,seed=90210){let h=(Math.imul(x,374761393)^Math.imul(z,668265263)^seed)>>>0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
export function generateBlock(x,z,seed=90210){
 const hash=blockSeed(x,z,seed);let state=hash||1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const buildings=[],district=BUILDING_STYLES[Math.floor(random()*BUILDING_STYLES.length)].id;
 // Eight independent street addresses leave a central service courtyard and 2 m alleys.
 const plots=[[-18,-18],[0,-18],[18,-18],[-18,0],[18,0],[-18,18],[0,18],[18,18]];
 for(let i=0;i<plots.length;i++){
  const style=BUILDING_STYLES[(hash+i*5+Math.floor(random()*4))%BUILDING_STYLES.length], [px,pz]=plots[i],variant=(hash+i*41)>>>0;
  const footprint={brownstone:[1,3],tenement:[2,3],warehouse:[3,2],castiron:[3,2],beauxarts:[3,3],deco:[3,2],curtain:[2,2],terraced:[3,3],brutalist:[3,2],hotel:[3,2],apartment:[2,3],industrial:[3,2],market:[3,3],gothic:[2,3],copper:[3,3],modern:[3,2]}[style.id];
  const [nx,nz]=footprint,width=Math.max(nx,nz)===3?4.05+random()*.65:4.7+random()*1.5,floors=style.floors[0]+Math.floor(random()*(style.floors[1]-style.floors[0]+1));
  const setbacks=['deco','terraced','copper','modern','gothic'].includes(style.id), tiers=style.id==='terraced'?[box(3,3,Math.max(2,floors-4)),box(2,2,2,i%2,(i>>1)%2),box(1,1,2,1,1)]:setbacks?[box(nx,nz,Math.max(2,floors-3)),box(nx-1,nz-1,3,i%2,(i>>1)%2)]:[box(nx,nz,floors)];
  const b=tower(x*70+px,z*70+pz,`${style.name} ${Math.abs(x*97+z*31)+i+1}`,style.material,tiers,{bay:width,story:style.id==='market'?4.2:3.2+random()*.55,architecture:style.id,variant,waterTower:['tenement','warehouse','industrial'].includes(style.id),streamed:true,district});
  buildings.push(b);
 }
 return {id:'city-block',key:blockKey(x,z),block:[x,z],cellBase:blockCellBase(x,z),seed,half:35,center:[x*70,z*70],plaza:0,buildings,props:[],spawns:[],textures:midtown.textures,sky:midtown.sky,roads:{avenues:[x*70-35,x*70+35],streets:[z*70-35,z*70+35],avenueWidth:16,streetWidth:12}};
}
// The original landmarks retain their special parts; ordinary home addresses now use the
// same architectural families as the surrounding city, with stable per-building palettes.
midtown.infinite=true;
midtown.buildings.forEach((b,i)=>{b.variant??=i*37+11;if(!b.architecture)b.architecture=BUILDING_STYLES.filter(s=>s.material===b.material)[i%BUILDING_STYLES.filter(s=>s.material===b.material).length].id;});
