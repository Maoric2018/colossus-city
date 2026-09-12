// Building recipes, shared by the server, close geometry and distant skyline.
// Dimensions are gameplay-scaled; landmark proportions and identifying details are fixed.
import {WORLD_BUILDING_STYLES,worldTiers,shapeWorldCell} from './world-landmarks.js';
export {WORLD_BUILDING_STYLES};
const recipe=(id,name,material,floors,footprint,massing,neighborhood,facade,entry,roof)=>
 Object.freeze({id,name,material,floors,footprint,massing,neighborhood,facade,entry,roof});
export const NEW_BUILDING_STYLES=Object.freeze([
 recipe('brooklyn-rowhouse','Brooklyn rowhouse','brick',[3,5],[1,3],'flat','residential',['arch','bayWindow'],'urbanStoop','mansard'),
 recipe('dutch-gable','Dutch gabled house','brick',[3,4],[2,2],'flat','residential',['urbanDutchGable','casement'],'doorPanel','gable'),
 recipe('federal-townhouse','Federal townhouse','brick',[3,5],[1,2],'flat','residential',['urbanFanlight','keystone'],'urbanStoop','hip'),
 recipe('greystone','Greystone apartments','stone',[5,7],[2,2],'setback','residential',['urbanAshlar','bayWindow'],'jamb','mansard'),
 recipe('limestone-mansion','Limestone mansion','stone',[3,4],[3,2],'wings','residential',['urbanBalustrade','quoin'],'urbanPortico','hip'),
 recipe('carriage-house','Carriage house','brick',[2,3],[2,2],'flat','residential',['urbanDormer','arch'],'urbanCarriageArch','gable'),
 recipe('corner-bodega','Corner bodega apartments','brick',[3,5],[2,2],'flat','market',['castIronCapital','acUnit'],'urbanCornerAwning','flat'),
 recipe('diner','Chrome diner','concrete',[2,2],[3,1],'flat','market',['urbanDinerChrome','shopfront'],'canopy','barrel'),
 recipe('art-moderne-theater','Art Moderne cinema','stone',[3,4],[2,3],'setback','arts',['decoChevron','urbanFlutedPanel'],'urbanMarquee','flat'),
 recipe('firehouse','City firehouse','brick',[3,4],[2,3],'rear-tower','civic',['arch','urbanHoseVent'],'urbanApparatusDoor','hip'),
 recipe('police-precinct','Neighborhood precinct','stone',[4,6],[2,3],'setback','civic',['urbanAshlar','quoin'],'urbanFlagBracket','flat'),
 recipe('library','Public library','stone',[3,4],[3,2],'wings','civic',['urbanColonnade','arch'],'urbanPediment','hip'),
 recipe('courthouse','Courthouse','stone',[4,6],[3,3],'wings','civic',['urbanFlutedPanel','urbanBalustrade'],'urbanPortico','dome'),
 recipe('post-office','Post office','brick',[3,4],[3,2],'flat','civic',['urbanPostalGrille','keystone'],'arcade','hip'),
 recipe('subway-headhouse','Transit headhouse','stone',[2,3],[2,2],'flat','market',['arch','urbanTileBorder'],'urbanSubwayCanopy','gable'),
 recipe('power-substation','Power substation','brick',[3,4],[2,3],'flat','industrial',['urbanTransformerLouvers','panelBolts'],'serviceDoor','saw'),
 recipe('clocktower','Municipal clock tower','brick',[7,9],[2,2],'tower','civic',['urbanClockDial','urbanAshlar'],'urbanPortico','pyramid'),
 recipe('church','Neighborhood church','stone',[3,4],[2,3],'rear-tower','civic',['gothicArch','urbanClerestory'],'urbanBellBelfry','pyramid'),
 recipe('synagogue','Neighborhood synagogue','stone',[3,4],[3,2],'wings','civic',['urbanRoseWindow','arch'],'urbanPediment','dome'),
 recipe('cathedral','Gothic cathedral','stone',[5,6],[3,3],'twin-tower','civic',['gothicArch','urbanButtress'],'urbanRoseWindow','pyramid'),
 recipe('conservatory','Glass conservatory','glass',[2,3],[3,2],'flat','arts',['urbanClerestory','castIronCapital'],'arcade','glass-ridge'),
 recipe('university-hall','University hall','brick',[4,6],[3,2],'wings','civic',['urbanAcademicShield','gothicArch'],'urbanPortico','hip'),
 recipe('school','City school','brick',[4,6],[3,3],'wings','residential',['urbanClassroom','lintel'],'urbanPediment','flat'),
 recipe('hospital','Hospital wing','concrete',[7,10],[3,2],'slab','civic',['sunshade','urbanRibbonWindow'],'urbanAmbulanceCanopy','flat'),
 recipe('laboratory','Research laboratory','glass',[5,8],[2,3],'setback','office',['urbanLabDuct','verticalFin'],'shopfront','plant'),
 recipe('parking-garage','Parking garage','concrete',[4,6],[3,2],'flat','industrial',['urbanGarageBarrier','expansionJoint'],'urbanLoadingBay','flat'),
 recipe('bus-depot','Bus depot','brick',[2,3],[3,3],'flat','industrial',['urbanTerminalTruss','urbanRibbonWindow'],'urbanApparatusDoor','saw'),
 recipe('railway-terminal','Railway terminal','stone',[3,4],[3,3],'wings','civic',['urbanTerminalTruss','urbanClockDial'],'urbanPortico','barrel'),
 recipe('ferry-terminal','Ferry terminal','brick',[3,4],[3,2],'rear-tower','industrial',['urbanPorthole','urbanBalustrade'],'urbanSubwayCanopy','hip'),
 recipe('shipping-warehouse','Shipping warehouse','brick',[4,6],[3,2],'flat','industrial',['urbanCraneRail','castIronCapital'],'urbanLoadingBay','saw'),
 recipe('textile-mill','Textile mill','brick',[4,6],[2,3],'rear-tower','industrial',['urbanMillWindow','arch'],'urbanCarriageArch','saw'),
 recipe('brewery','Brewery','brick',[3,5],[3,2],'setback','industrial',['urbanBrewPipe','urbanPorthole'],'urbanLoadingBay','plant'),
 recipe('cold-storage','Cold storage warehouse','concrete',[4,5],[3,2],'flat','industrial',['urbanColdPanel','urbanTransformerLouvers'],'urbanColdDoor','plant'),
 recipe('printing-house','Printing house','brick',[4,6],[2,3],'setback','industrial',['urbanPrintVent','urbanMillWindow'],'urbanLoadingBay','saw'),
 recipe('loft-conversion','Converted industrial lofts','brick',[5,7],[3,2],'setback','arts',['urbanLoftGrid','escapeLadder'],'urbanCarriageArch','flat'),
 recipe('music-hall','Music hall','stone',[3,5],[3,2],'wings','arts',['urbanAcousticPanel','decoChevron'],'urbanMarquee','barrel'),
 recipe('museum','Contemporary museum','concrete',[3,5],[3,3],'terrace','arts',['urbanMuseumFin','expansionJoint'],'urbanPortico','flat'),
 recipe('gallery','Art gallery','glass',[3,4],[2,2],'setback','arts',['urbanDisplayCase','verticalFin'],'canopy','glass-ridge'),
 recipe('garden-apartment','Garden apartments','brick',[4,6],[3,2],'terrace','residential',['urbanBalconyPlanter','frenchDoor'],'urbanStoop','garden'),
 recipe('luxury-condo','Balcony condominiums','glass',[8,12],[2,2],'setback','residential',['urbanZigBalcony','terraceGlass'],'urbanAmbulanceCanopy','garden'),
 recipe('point-tower','Slender point tower','glass',[12,18],[1,2],'flat','office',['urbanPointFin','sunshade'],'shopfront','plant'),
 recipe('slab-residence','Slab apartments','concrete',[7,11],[3,2],'slab','residential',['urbanSlabRail','frenchDoor'],'urbanCornerAwning','garden'),
 recipe('stepped-office','Stepped offices','stone',[9,13],[3,2],'tower','office',['urbanOfficeRecess','decoChevron'],'urbanPortico','flat'),
 recipe('solar-office','Solar office building','glass',[6,9],[2,3],'terrace','office',['urbanPVPanel','verticalFin'],'shopfront','solar'),
 ...[
  ['park432','432 Park Avenue','concrete',[32,32],[2,2],'flat',['parkSquareFrame','parkWindowGasket'],'parkLobbyPortal','flat'],
  ['woolworth','Woolworth Building','stone',[23,23],[3,3],'gothic-tower',['woolworthTracery','woolworthPier'],'woolworthPortal','woolworth'],
  ['wall40','40 Wall Street','stone',[23,23],[3,3],'wall-tower',['wall40Piers','wall40Spandrel'],'wall40Portal','wall40'],
  ['rockefeller30','30 Rockefeller Plaza','stone',[25,25],[3,3],'rock-slab',['rockLimestoneFin','rockSpandrel'],'rockPortal','rock'],
  ['seagram','Seagram Building','glass',[20,20],[2,3],'flat',['seagramIBeam','seagramSpandrel'],'seagramPortal','seagram'],
  ['lever-house','Lever House','glass',[18,18],[3,3],'lever-slab',['leverMullion','leverSpandrel'],'leverPilotis','lever'],
  ['citigroup','Citigroup Center','glass',[24,24],[3,3],'stilt-tower',['citiBand','citiMullion'],'citiStilt','citi'],
  ['hearst','Hearst Tower','glass',[21,21],[3,2],'hearst-tower',['hearstDiagrid','hearstNode'],'hearstPortal','hearst']
 ].map(([id,name,material,floors,footprint,massing,facade,entry,roof])=>Object.freeze({...recipe(id,name,material,floors,footprint,massing,'office',facade,entry,roof),landmark:true}))
]);
export const CATALOG_STYLES=Object.freeze([...NEW_BUILDING_STYLES,...WORLD_BUILDING_STYLES]);
export const STYLE_BY_ID=new Map(CATALOG_STYLES.map(s=>[s.id,s]));
export const catalogLandmark=id=>!!STYLE_BY_ID.get(id)?.landmark;
export const NEIGHBORHOODS=Object.freeze(['residential','industrial','civic','arts','office','market']);
const box=(nx,nz,floors,ix=0,iz=0,voids)=>({nx,nz,floors,ix,iz,...(voids?{voids}:{})});
export function catalogTiers(s,floors,variant=0){
 if(s.world)return worldTiers(s.id);
 const [nx,nz]=s.footprint,high=Math.max(1,floors-2),ox=variant%2,oz=(variant>>>1)%2;
 switch(s.massing){
  case 'setback':return [box(nx,nz,high),box(Math.max(1,nx-1),Math.max(1,nz-1),2,ox,oz)];
  case 'terrace':return [box(nx,nz,Math.max(1,floors-3)),box(nx,Math.max(1,nz-1),2,0,oz),box(Math.max(1,nx-1),1,1,ox,oz)];
  case 'wings':return [box(nx,nz,high),box(1,nz,2,Math.floor(nx/2))];
  case 'slab':return [box(nx,nz,2),box(nx,1,floors-2,0,oz)];
  case 'tower':return [box(nx,nz,3),box(Math.max(1,nx-1),Math.max(1,nz-1),floors-5,ox,oz),box(1,1,2,ox,oz)];
  case 'rear-tower':return [box(nx,nz,floors-1),box(1,1,2,ox,nz-1)];
  case 'twin-tower':return [box(nx,nz,floors-2),box(nx,1,3,0,0,[{ix:1,iz:0,nx:1,nz:1}])];
  case 'gothic-tower':return [box(3,3,5),box(2,2,14),box(1,1,4)];
  case 'wall-tower':return [box(3,3,5),box(2,2,13,1,1),box(1,1,5,1,1)];
  case 'rock-slab':return [box(3,3,3),box(3,1,18,0,1),box(2,1,2,0,1),box(1,1,2,1,1)];
  case 'lever-slab':return [box(3,3,2),box(3,1,16,0,1)];
  case 'stilt-tower':return [box(3,3,2,0,0,[{ix:0,iz:0,nx:1,nz:1},{ix:2,iz:0,nx:1,nz:1},{ix:0,iz:2,nx:1,nz:1},{ix:2,iz:2,nx:1,nz:1}]),box(3,3,22)];
  case 'hearst-tower':return [box(3,2,3),box(2,2,18)];
  default:return [box(nx,nz,floors)];
 }
}
export function catalogBuilding(style,x,z,{variant=0,random=()=>.5,district=style.neighborhood}={}){
 const max=Math.max(...style.footprint),floors=style.floors[0]+Math.floor(random()*(style.floors[1]-style.floors[0]+1));
 return {x,z,name:style.name,architecture:style.id,material:style.material,variant,district,streamed:true,
  bay:style.bay??(style.landmark?(style.id==='park432'?3.65:4.2):max===3?4.05+random()*.65:4.5+random()*.9),
  story:({'grande-arche':1.65,'marina-bay':.8,'ferry-building':1.4,'elizabeth-tower':2.2,'petronas':1.8,'emirates-towers':2.5,'transamerica':2.5}[style.id])??(style.landmark?3.4:3.1+random()*.6),tiers:catalogTiers(style,floors,variant),
  waterTower:['loft-conversion','textile-mill','shipping-warehouse'].includes(style.id)};
}
// Only intended open mechanical floors / pilotis lack skins. Their structural bays
// remain in the support graph, and the same opening is used by rendering and physics.
export function shapeCatalogCell(c,b){
 if(b.architecture==='hearst'&&c.floor<3)c.material='stone';
 if(b.architecture==='park432'&&[5,10,15,20,25,30].includes(c.floor))c.openSkin=true;
 if(b.architecture==='citigroup'&&c.floor<2)c.openSkin=true;
 if(b.architecture==='lever-house'&&c.ground)c.openSkin=true;
 c.catalogRoof=STYLE_BY_ID.get(b.architecture)?.roof;
 shapeWorldCell(c,b);
}
export function finishCatalogCells(cells,b){
 const style=STYLE_BY_ID.get(b.architecture);if(!style)return;
 for(const c of cells){
  if(style.landmark||style.roof!=='flat')delete c.roofAsset;
  c.topFloor=c.floor===c.buildingFloors-1;
 }
}
