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
