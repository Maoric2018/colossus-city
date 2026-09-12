import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),output=process.argv[3]||'artifacts/optimization/locality-after';
const {Room,physicsReady}=await import(pathToFileURL(path.join(root,'server/room.js'))),{midtown}=await import(pathToFileURL(path.join(root,'shared/city/layout.js'))),{fractureRecipe}=await import(pathToFileURL(path.join(root,'shared/city/fracture.js'))),{chipCell}=await import(pathToFileURL(path.join(root,'server/fracture.js')));
await physicsReady;const runs=[];
for(let run=0;run<8;run++){
 const environment={...midtown,infinite:false,props:[],buildings:[{x:0,z:-20,bay:4,story:4,material:'concrete',tiers:[{nx:3,nz:3,floors:20,ix:0,iz:0}]}]},room=new Room('LOCALITY',{environment});
 try{
  const before=room.world.colliders.len(),floor=room.floors[0][10],c=floor.cells[4],recipe=fractureRecipe(c),group=recipe.groups.find(g=>g.kind==='frame'&&g.n[1]>1),piece=recipe.pieces[group.start+2],start=performance.now();
  const pieces=chipCell(room,c,piece.p.map((n,k)=>n+c.p[k]),.12,Infinity),ms=performance.now()-start;
  runs.push({ms,collidersBefore:before,collidersAfter:room.world.colliders.len(),pieces:pieces.length,groups:room.shards.size,untouchedFloorColliders:room.floors[0][15].structure.length});
 }finally{room.dispose();}
}
const times=runs.slice(1).map(r=>r.ms).sort((a,b)=>a-b),report={description:'One cold structural cut in a 20-storey, 3×3-bay building. First run excluded from timing summary.',runs,medianMS:times[Math.floor(times.length/2)]};
await mkdir(output,{recursive:true});await writeFile(`${output}/structure.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
