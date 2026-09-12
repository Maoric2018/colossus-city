// The only authoritative map definition. Visual assets never decide collisions.
// A structural cell is a hollow storey bay: slab + corner columns + exterior walls.
// Adjacent bays are a support graph, anchored to foundations. No triangle-mesh physics.
export const city = {
 id:'harbor-district', name:'HARBOR DISTRICT', seed:42069, radius:74,
 sky:{top:0x16364c,horizon:0xc18b77,fog:0x65868c},
 buildings:[
  {x:-23,z:-20,nx:2,nz:2,floors:6,bay:4.8,story:3.2,style:0,name:'HUDSON / 01'},
  {x:23,z:-22,nx:3,nz:2,floors:8,bay:4.3,story:3.1,style:1,name:'MERIDIAN'},
  {x:-24,z:22,nx:2,nz:2,floors:5,bay:5,story:3.3,style:2,name:'NORTH BANK'},
  {x:24,z:22,nx:2,nz:3,floors:7,bay:4.4,story:3.1,style:0,name:'ATLAS'},
  {x:-47,z:-17,nx:2,nz:2,floors:9,bay:4.4,story:3.1,style:1,name:'ECHO'},
  {x:47,z:16,nx:2,nz:2,floors:6,bay:4.8,story:3.2,style:2,name:'THE STANDARD'},
  {x:4,z:-49,nx:2,nz:2,floors:10,bay:4.5,story:3.05,style:0,name:'CROWN'},
  {x:-5,z:48,nx:3,nz:2,floors:5,bay:4.3,story:3.2,style:1,name:'UNION WORKS'},
  {x:46,z:-45,nx:2,nz:2,floors:6,bay:4.6,story:3.2,style:2,name:'QUAY'},
  {x:-48,z:45,nx:2,nz:2,floors:7,bay:4.5,story:3.15,style:0,name:'PORT / 07'}
 ],
 // Optional local glTF models. Set a URL, transform and collider descriptor here.
 // Decorative-only props must be outside the gameplay footprint unless given colliders.
 props:[],
 // Optional per-style GLB: nodes named slab, col_nw, col_ne, col_sw, col_se,
 // wall_n, wall_s, wall_e, wall_w. Author a 1x1x1 bay. Loader scales to bay dimensions.
 cellAssets:{},
 textures:{concrete:'/assets/concrete.jpg',asphalt:'/assets/asphalt.jpg',facade:'/assets/facade.jpg',
  facadeNormal:'/assets/facade-normal.jpg',facadeEmissive:'/assets/facade-emissive.jpg'},
 spawns:[[0,1.3,61],[61,1.3,0],[0,1.3,-61],[-61,1.3,0]]
};
export const environments = {'harbor-district':city};
// Register an environment above and change this ONE selection for both server and clients.
export const activeEnvironment = environments['harbor-district'];
export function generateCells(env=city){
 const cells=[];let id=1;
 env.buildings.forEach((b,bi)=>{
  const ids=new Map();
  for(let f=0;f<b.floors;f++)for(let z=0;z<b.nz;z++)for(let x=0;x<b.nx;x++){
   const cell={id:id++,building:bi,floor:f,ix:x,iz:z,style:b.style,ground:f===0,
    p:[b.x+(x-(b.nx-1)/2)*b.bay,.15+f*b.story+b.story/2,b.z+(z-(b.nz-1)/2)*b.bay],
    size:[b.bay,b.story,b.bay],walls:[z===0,x===b.nx-1,z===b.nz-1,x===0],
    neighbors:[],roof:f===b.floors-1};
   ids.set(`${x}:${f}:${z}`,cell.id);cells.push(cell);
  }
  for(const c of cells.filter(c=>c.building===bi)){
   for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const other=ids.get(`${c.ix+dx}:${c.floor+dy}:${c.iz+dz}`);if(other)c.neighbors.push(other);
   }
  }
 });return cells;
}
// Return intact cells whose paths to all ground anchors were severed.
export function unsupportedCells(cells, detached){
 const byId=new Map(cells.map(c=>[c.id,c])),supported=new Set(),todo=[];
 for(const c of cells)if(c.ground&&!detached.has(c.id)){supported.add(c.id);todo.push(c.id);}
 while(todo.length){const id=todo.pop();for(const n of byId.get(id).neighbors){if(!detached.has(n)&&!supported.has(n)){supported.add(n);todo.push(n);}}}
 return cells.filter(c=>!detached.has(c.id)&&!supported.has(c.id)).map(c=>c.id);
}
// Cuboid components in LOCAL space: [center x,y,z, half x,y,z].
export function cellColliders(c){
 const [w,h,d]=c.size,slab=.13,col=.13,out=[];
 out.push([0,h/2-slab,0,w/2,slab,d/2]);
 for(const x of [-1,1])for(const z of [-1,1])out.push([x*(w/2-col),0,z*(d/2-col),col,h/2-.26,col]);
 if(c.walls[0])out.push([0,0,-d/2+.06,w/2-.24,h/2-.22,.06]);
 if(c.walls[1])out.push([w/2-.06,0,0,.06,h/2-.22,d/2-.24]);
 if(c.walls[2])out.push([0,0,d/2-.06,w/2-.24,h/2-.22,.06]);
 if(c.walls[3])out.push([-w/2+.06,0,0,.06,h/2-.22,d/2-.24]);
 return out;
}
