import {STYLE_BY_ID} from './catalog.js';
import {modernLandmark} from './modern-landmarks.js';
import {quatEuler} from '../math.js';
import {box} from '../giant-rig.js';

export const GENERIC_WINDOWS={brick:[[.1,.28,.2,.42],[.4,.28,.2,.42],[.7,.28,.2,.42]],stone:[[.12,.22,.3,.5],[.58,.22,.3,.5]],concrete:[[.06,.3,.88,.36]],glass:[[0,0,1,1]]};
const windowChecks=new Map(),balconies=new Set(['urbanBalconyPlanter','urbanZigBalcony','urbanSlabRail','frenchDoor','urbanGarageBarrier']);
function crossesWindow(type,material,spec){
 const key=type+':'+material;if(windowChecks.has(key))return windowChecks.get(key);
 const crosses=spec.parts.some(p=>{
  const q=quatEuler(...p.r),bounds=box(p.p,p.s.map(n=>n/2),[q.x,q.y,q.z,q.w]);
  if(bounds.center[2]-bounds.extent[2]>-.49)return false;
  return (GENERIC_WINDOWS[material]||[]).some(([x,y,w,h])=>{
   const width=Math.min(bounds.center[0]+bounds.extent[0],x+w-.5)-Math.max(bounds.center[0]-bounds.extent[0],x-.5);
   const height=Math.min(bounds.center[1]+bounds.extent[1],(.5-y)*.925)-Math.max(bounds.center[1]-bounds.extent[1],(.5-y-h)*.925);
   return width>0&&height>0&&width*height>.0005;
  });
 });windowChecks.set(key,crosses);return crosses;
}

export const genericBuilding=id=>!['wtc','empire','chrysler'].includes(id)&&!modernLandmark(id)&&!STYLE_BY_ID.get(id)?.landmark;

// Choose service locations once per building, rather than decorating each bay
// like an independent house. Shared by rendering, streamed previews and physics.
export function finishGenericDetails(cells,b){
 if(!genericBuilding(b.architecture))return;
 const style=STYLE_BY_ID.get(b.architecture),roofs=cells.filter(c=>c.roof);
 for(const c of cells){delete c.roofAsset;c.hasRoofProps=false;}
 const highest=Math.max(...roofs.map(c=>c.p[1]));
 const top=roofs.filter(c=>c.p[1]===highest).sort((a,c)=>Math.hypot(a.p[0]-b.x,a.p[2]-b.z)-Math.hypot(c.p[0]-b.x,c.p[2]-b.z)||a.iz-c.iz||a.ix-c.ix);
 const front=cells.filter(c=>c.ground&&c.walls?.[2]).sort((a,c)=>Math.abs(a.p[0]-b.x)-Math.abs(c.p[0]-b.x)||a.ix-c.ix)[0];
 if(front)front.genericEntrySide=2;
 const walkup=b.material==='brick'&&(!style||['brooklyn-rowhouse','corner-bodega','loft-conversion','garden-apartment'].includes(style.id));
 if(walkup){const rear=cells.filter(c=>c.ground&&c.walls?.[0]).sort((a,c)=>a.ix-c.ix)[0];if(rear)for(const c of cells)if(c.ix===rear.ix&&c.iz===rear.iz&&c.floor>0&&c.walls?.[0])c.genericEscapeSide=0;}
 if(!top.length)return;
 const roof=style?.roof||'flat';
 if(['plant','garden','solar'].includes(roof))top[0].genericRoofFeature=true;
 if(!['flat','plant','garden','solar'].includes(roof))return;
 const access=top[roof==='flat'?0:Math.min(1,top.length-1)];
 if(roof!=='plant'||top.length>1)access.genericRoofParts=['roofHatch'];
 if(roof!=='flat')return;
 if(b.waterTower){const owner=top[Math.min(1,top.length-1)];owner.roofAsset=['city-kit-industrial/water-tower',2.6];if(owner===access)delete access.genericRoofParts;}
 else access.genericRoofParts.push('roofVent');
}

const windowOverlays=new Set(['mullion','transom','casement','windowRecess','bayWindow','urbanPostalGrille','urbanLoftGrid','urbanMillWindow','urbanClassroom','urbanPorthole','urbanClerestory','urbanPrintVent','urbanTransformerLouvers','sunshade','verticalFin','urbanPVPanel','escapeLadder','terraceGlass']);
export function genericPlacements(c,put,catalogPlacements,{interiors=true,specs}={}){
 const style=STYLE_BY_ID.get(c.architecture),core=c.ix%2===0&&c.iz%2===0;
 if(core&&(interiors||c.ground))for(const type of ['iBeam','hColumn','joists','coreWall','elevator','stairFlight','stairLanding','stairRail','pipe'])put(type);
 if(core&&interiors)for(const type of ['ceilingLight','sprinkler','serviceDoor','stairStringer'])put(type);
 for(let side=0;side<4;side++)if(c.walls[side]){
  const layer=c.material==='glass'?'glass':'facade';
  // These trims surround the actual small windows in the base facade texture.
  // The existing glass texture already has mullions; no second grid goes over it.
  if(c.material!=='glass')put(`generic_${c.material}_trim`,side,layer);
  if(c.material==='glass'||c.material==='concrete')put('slabEdge',side);
  if(c.roof){
   const roof=style?.roof||'flat';
   if(['flat','plant','garden','solar'].includes(roof))put('parapet',side);
   if(c.material==='brick'||c.material==='stone')put('cornice',side);
  }
  if(c.genericEntrySide===side){put('door',side,layer);put('threshold',side,layer);if(!style)put('canopy',side,layer);}
  if(c.genericEscapeSide===side){put('escapePlatform',side,layer);put('escapeLadder',side,layer);}
 }
 for(const type of c.genericRoofParts||[])put(type);
 if(style)catalogPlacements(c,(type,side=-1,layer='frame')=>{
  if(windowOverlays.has(type))return;
  if(type===style.entry&&side!==c.genericEntrySide)return;
  if(side>=0&&type!==style.entry&&!balconies.has(type)&&crossesWindow(type,c.material,specs[type]))return;
  // Service pipes and AC belong on the rear, not across every front window.
  if(['acUnit','urbanLabDuct','urbanBrewPipe','urbanCraneRail'].includes(type)&&side!==0)return;
  put(type,side,layer);
 },{interiors});
}
