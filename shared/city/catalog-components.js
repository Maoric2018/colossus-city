import {STYLE_BY_ID} from './catalog.js';
import {WORLD_COMPONENTS,worldRoofTypes,worldPlacements,worldColliders} from './world-landmarks.js';
// Reusable functional assemblies, not individual bricks counted as component types.
// Roof geometry and its stepped collision proxies share the same height profile.
const box=(s,p=[0,0,0],r=[0,0,0])=>({s,p,r});
const kit=(label,material,parts,signature=false)=>({label,material,parts,signature});
const row=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const bars=(n,y,z=-.55)=>row(n,i=>box([.025,.66,.055],[-.4+i*.8/(n-1),y,z]));
const arch=(radius=.36,y=.02,n=11)=>row(n,i=>{const a=i/(n-1)*Math.PI;return box([.085,.045,.07],[Math.cos(a)*radius,y+Math.sin(a)*radius,-.56],[0,0,a-Math.PI/2]);});
const ring=(radius=.27,y=.04,n=16)=>row(n,i=>{const a=i/n*Math.PI*2;return box([.11,.035,.065],[Math.cos(a)*radius,y+Math.sin(a)*radius,-.55],[0,0,a-Math.PI/2]);});
const grid=(n=4)=>[...bars(n,0),...[-.3,0,.3].map(y=>box([.84,.025,.04],[0,y,-.55]))];
const portico=[...[-.34,.34].map(x=>box([.08,.8,.21],[x,-.025,-.58])),box([.92,.09,.3],[0,.42,-.58])];
const pyramid=(width,height,y=.51)=>({shape:'cone',segments:4,s:[width*Math.SQRT2,height,width*Math.SQRT2],p:[0,y+height/2,0],r:[0,Math.PI/4,0]});
const roofLoft=(low,high)=>({shape:'loft',s:[1,1,1],p:[0,0,0],r:[0,0,0],corners:[[-.5,.51,-.5],[.5,.51,-.5],[.5,.51,.5],[-.5,.51,.5],[-.5,high,-.5],[.5,high,-.5],[.5,low,.5],[-.5,low,.5]]});
export const CATALOG_COMPONENTS={
 ...WORLD_COMPONENTS,
 urbanStoop:kit('Townhouse stoop steps and iron rails','stone',[...row(5,i=>box([.53,.055,.1],[0,-.43+i*.045,-.78+i*.06])),...[-.28,.28].map(x=>box([.025,.5,.028],[x,-.15,-.64],[-.65,0,0]))]),
 urbanDutchGable:kit('Dutch stepped gable masonry','terracotta',row(5,i=>box([.95-i*.17,.085,.09],[0,.47+i*.085,-.49]))),
 urbanFanlight:kit('Federal fanlight spokes','bronze',[...arch(.3,.05),...row(7,i=>{const a=i*Math.PI/6;return box([.018,.3,.03],[Math.cos(a)*.14,.05+Math.sin(a)*.14,-.58],[0,0,a-Math.PI/2]);})]),
 urbanAshlar:kit('Rusticated ashlar courses','stone',row(5,i=>box([.94,.12,.055],[0,-.36+i*.18,-.55]))),
 urbanBalustrade:kit('Turned stone balustrade','stone',[...row(6,i=>box([.047,.24,.07],[-.4+i*.16,-.2,-.59])),box([.98,.05,.13],[0,-.055,-.59]),box([.98,.05,.13],[0,-.345,-.59])]),
 urbanDormer:kit('Dormer window cheeks and peaked hood','stone',[...[-.22,.22].map(x=>box([.04,.36,.14],[x,.65,-.37])),...[-1,1].map(s=>box([.3,.045,.2],[s*.11,.91,-.38],[0,0,-s*.55]))]),
 urbanCarriageArch:kit('Carriage arch and timber leaves','bronze',[...arch(.4,0),...[-.3,.3].map(x=>box([.035,.47,.12],[x,-.22,-.55])),...row(9,i=>box([.045,.53,.04],[-.24+i*.06,-.16,-.55]))]),
 urbanCornerAwning:kit('Deep corner-shop awning','ruby',[box([.97,.045,.5],[0,.28,-.68],[-.14,0,0]),box([.97,.13,.025],[0,.18,-.92])]),
 urbanDinerChrome:kit('Diner stainless steel fluting','chrome',[...row(7,i=>box([1,.023,.055],[0,-.4+i*.035,-.55])),box([1,.065,.09],[0,.42,-.55])]),
 urbanFlutedPanel:kit('Fluted civic stone panel','stone',row(9,i=>box([.04,.75,.08],[-.4+i*.1,0,-.55]))),
 urbanMarquee:kit('Cinema marquee and bulb rows','bronze',[box([1,.12,.46],[0,.24,-.66]),...[-.98,-.78,-.58].flatMap(z=>row(9,i=>box([.025,.025,.025],[-.43+i*.108,.165,z])))]),
 urbanHoseVent:kit('Firehouse hose drying louvers','bronze',row(8,i=>box([.5,.035,.09],[0,-.3+i*.085,-.55],[-.28,0,0]))),
 urbanApparatusDoor:kit('Emergency vehicle sectional door','ruby',[...row(8,i=>box([.84,.073,.06],[0,-.34+i*.09,-.55])),...[-.45,.45].map(x=>box([.04,.9,.1],[x,0,-.55]))]),
 urbanFlagBracket:kit('Wall flagpole bracket and finial','bronze',[box([.035,.7,.035],[.36,.25,-.72],[.65,0,0]),box([.09,.12,.04],[.36,-.03,-.53])]),
 urbanColonnade:kit('Classical fluted colonnade','stone',[-.35,0,.35].flatMap(x=>[box([.085,.7,.13],[x,-.03,-.58]),box([.16,.06,.2],[x,.35,-.58]),box([.16,.05,.2],[x,-.4,-.58])])),
 urbanPediment:kit('Triangular entrance pediment','stone',[...[-1,1].map(s=>box([.54,.07,.19],[s*.23,.39,-.61],[0,0,-s*.36])),box([.98,.055,.21],[0,.29,-.61])]),
 urbanPortico:kit('Projecting stone portico','stone',portico),
 urbanPostalGrille:kit('Postal brass lattice grille','bronze',[...grid(6),...[-1,1].map(s=>box([.02,.65,.04],[s*.13,0,-.58],[0,0,s*.45]))]),
 urbanTileBorder:kit('Glazed transit tile border','jade',[...row(9,i=>box([.078,.065,.04],[-.4+i*.1,.37,-.55])),...[-.44,.44].map(x=>box([.045,.79,.04],[x,-.015,-.55]))]),
 urbanSubwayCanopy:kit('Transit entrance iron and glass canopy','jade',[box([.96,.04,.45],[0,.32,-.65]),...[-.43,.43].map(x=>box([.035,.9,.04],[x,-.07,-.85])),...row(5,i=>box([.023,.025,.46],[-.42+i*.21,.35,-.65]))]),
 urbanTransformerLouvers:kit('Substation deep ventilation louvers','steel',row(7,i=>box([.86,.055,.17],[0,-.31+i*.103,-.57],[-.25,0,0]))),
 urbanClockDial:kit('Clock dial rim, hour marks and hands','bronze',[...ring(.32,.03),...row(12,i=>{const a=i*Math.PI/6;return box([.025,.055,.04],[Math.sin(a)*.25,.03+Math.cos(a)*.25,-.58],[0,0,-a]);}),box([.02,.23,.035],[0,.13,-.6]),box([.17,.02,.035],[.075,.03,-.61])]),
 urbanBellBelfry:kit('Open belfry columns and bronze bell','bronze',[...[-.3,.3].map(x=>box([.055,.64,.07],[x,0,-.57])),...arch(.32,.12),{shape:'cone',segments:12,s:[.32,.28,.18],p:[0,.04,-.57],r:[0,0,0]},box([.025,.27,.035],[0,.27,-.57])]),
 urbanRoseWindow:kit('Rose window radial stone tracery','stone',[...ring(.31),...row(8,i=>box([.025,.55,.04],[0,.04,-.59],[0,0,i*Math.PI/8]))]),
 urbanButtress:kit('Gothic stepped buttresses','stone',[-.43,.43].flatMap(x=>[box([.09,.82,.19],[x,-.04,-.56]),box([.09,.17,.3],[x,-.37,-.6])])),
 urbanClerestory:kit('Clerestory glazing and arch ribs','silver',[...bars(7,.07),...arch(.42,-.02)]),
 urbanAcademicShield:kit('Carved academic escutcheon','stone',[box([.22,.24,.09],[0,.15,-.57]),box([.16,.16,.09],[0,-.01,-.57],[0,0,Math.PI/4]),box([.03,.26,.025],[0,.12,-.63])]),
 urbanClassroom:kit('Tall classroom window bank','bronze',[...bars(6,0),...[-.29,.19,.32].map(y=>box([.86,.025,.045],[0,y,-.55]))]),
 urbanRibbonWindow:kit('Continuous ribbon window reveals','silver',[-.32,.32].map(y=>box([1,.045,.1],[0,y,-.54]))),
 urbanAmbulanceCanopy:kit('Cantilevered arrival canopy','silver',[box([.98,.05,.62],[0,.26,-.72]),...[-.4,.4].map(x=>box([.025,.3,.025],[x,.08,-.94]))]),
 urbanLabDuct:kit('External laboratory exhaust riser','steel',[box([.11,.94,.12],[.33,0,-.59]),...[-.3,.3].map(y=>box([.16,.035,.17],[.33,y,-.59]))]),
 urbanGarageBarrier:kit('Parking slab crash rail and ventilation','concrete',[box([1,.15,.095],[0,-.3,-.54]),...[-.28,.28].map(x=>box([.03,.34,.05],[x,.05,-.54]))]),
 urbanLoadingBay:kit('Loading dock bumper and roller guides','steel',[box([.85,.15,.25],[0,-.37,-.63]),...[-.43,.43].map(x=>box([.065,.73,.07],[x,.025,-.55])),...row(5,i=>box([.77,.027,.035],[0,-.2+i*.14,-.55]))]),
 urbanTerminalTruss:kit('Terminal triangulated steel truss','steel',[box([.95,.04,.08],[0,.3,-.54]),...row(6,i=>box([.02,.3,.05],[-.4+i*.16,.19,-.55],[0,0,i%2?.7:-.7]))]),
 urbanPorthole:kit('Circular harbor window rim','bronze',[...ring(.24,0),box([.46,.022,.045],[0,0,-.58]),box([.022,.46,.045],[0,0,-.58])]),
 urbanCraneRail:kit('Warehouse hoist rail and pulley','steel',[box([.035,.1,.56],[.34,.31,-.66]),box([.075,.08,.035],[.34,.24,-.89]),box([.012,.55,.016],[.34,-.025,-.89])]),
 urbanMillWindow:kit('Factory twelve-light sash','steel',[...grid(4),...[-.31,.31].map(x=>box([.035,.73,.08],[x,0,-.55]))]),
 urbanBrewPipe:kit('Brewery copper pipe manifold','copper',[...[-.32,.32].map(x=>box([.055,.85,.06],[x,0,-.58])),box([.69,.045,.06],[0,.26,-.58]),...[-.25,0,.25].map(x=>box([.085,.07,.035],[x,.26,-.625]))]),
 urbanColdPanel:kit('Insulated cold-store panels','silver',[...[-.35,0,.35].map(x=>box([.3,.82,.065],[x,0,-.55])),...[-.3,.3].map(y=>box([.94,.017,.03],[0,y,-.59]))]),
 urbanColdDoor:kit('Insulated loading door and motor','silver',[box([.69,.75,.09],[0,-.04,-.56]),box([.89,.08,.09],[0,.39,-.56]),box([.035,.22,.07],[.23,-.04,-.63])]),
 urbanPrintVent:kit('Print works fan intake grille','steel',[...ring(.25),...row(7,i=>box([.46,.025,.04],[0,-.2+i*.067,-.58]))]),
 urbanLoftGrid:kit('Large loft steel glazing grid','steel',[...grid(5),box([.95,.055,.12],[0,-.39,-.55])]),
 urbanAcousticPanel:kit('Concert hall folded acoustic panels','bronze',row(8,i=>box([.09,.78,.08],[-.39+i*.112,0,-.57],[0,i%2?.35:-.35,0]))),
 urbanMuseumFin:kit('Sculptural museum fins','stone',[-.35,0,.35].map(x=>box([.065,.95,.35],[x,0,-.55],[0,.3,0]))),
 urbanDisplayCase:kit('Gallery display vitrine framing','silver',[...[-.36,.36].map(x=>box([.022,.79,.12],[x,0,-.58])),...[-.39,.39].map(y=>box([.74,.022,.12],[0,y,-.58])),box([.7,.04,.3],[0,-.34,-.55])]),
 urbanBalconyPlanter:kit('Planted residential balcony','jade',[box([.8,.13,.28],[0,-.28,-.65]),...row(7,i=>box([.025,.12,.035],[-.32+i*.106,-.16,-.69],[0,0,(i%3-1)*.25]))]),
 urbanZigBalcony:kit('Angled glass balcony edge','silver',[box([.86,.04,.37],[0,-.34,-.63]),...[-1,1].map(s=>box([.43,.027,.04],[s*.21,-.08,-.77],[0,s*.2,0])),...[-.4,0,.4].map(x=>box([.016,.27,.025],[x,-.22,-.77]))]),
 urbanPointFin:kit('Point tower blade fins','silver',[-.42,.42].map(x=>box([.035,.97,.3],[x,0,-.55]))),
 urbanSlabRail:kit('Continuous residential balcony rail','stone',[box([1,.055,.27],[0,-.36,-.61]),box([1,.035,.045],[0,-.06,-.73]),...bars(9,-.13,-.73).map(p=>({...p,s:[.016,.3,.025]}))]),
 urbanOfficeRecess:kit('Deep stepped office reveal','stone',[-1,1].flatMap(s=>[box([.06,.84,.1],[s*.4,0,-.55]),box([.03,.73,.14],[s*.32,0,-.56])])),
 urbanPVPanel:kit('Photovoltaic facade shades','crownGlass',[-.28,.03,.34].map(y=>box([.87,.035,.3],[0,y,-.6],[-.24,0,0]))),
 parkSquareFrame:kit('432 Park exposed square concrete grid','marble',[...[-.45,.45].map(x=>box([.1,1,.13],[x,0,-.54])),...[-.44,.44].map(y=>box([1,.12,.13],[0,y,-.54]))],true),
 parkWindowGasket:kit('432 Park inset square window gasket','slate',[...[-.365,.365].map(x=>box([.018,.75,.025],[x,0,-.53])),...[-.365,.365].map(y=>box([.75,.018,.025],[0,y,-.53]))]),
 parkLobbyPortal:kit('432 Park marble lobby portal','marble',portico,true),
 parkMechanicalCore:kit('432 Park exposed mechanical-floor core','concrete',[box([.14,.9,.14],[0,-.025,0]),box([.72,.065,.72],[0,.37,0])],true),
 woolworthTracery:kit('Woolworth pointed terra-cotta tracery','terracotta',[...arch(.28,.09),...[-.29,0,.29].map(x=>box([.035,.53,.075],[x,-.16,-.55]))],true),
 woolworthPier:kit('Woolworth clustered Gothic piers','terracotta',[-.43,.43].flatMap(x=>[-.035,0,.035].map(dx=>box([.027,.98,.11],[x+dx,0,-.55]))),true),
 woolworthPortal:kit('Woolworth layered Gothic entrance','terracotta',[...arch(.4,-.03),...arch(.32,-.03),...[-.4,.4].map(x=>box([.06,.5,.17],[x,-.24,-.57]))],true),
 woolworthPinnacle:kit('Woolworth corner pinnacles','terracotta',[-.4,.4].flatMap(x=>[-.4,.4].map(z=>({ ...pyramid(.16,.85),p:[x,.935,z]}))),true),
 wall40Piers:kit('40 Wall limestone vertical piers','stone',[-.44,.44].map(x=>box([.085,.98,.09],[x,0,-.54])),true),
 wall40Spandrel:kit('40 Wall recessed bronze spandrel','bronze',[box([.79,.2,.055],[0,-.35,-.54]),...[-.22,0,.22].map(x=>box([.025,.14,.025],[x,-.35,-.58]))],true),
 wall40Portal:kit('40 Wall monumental bank portal','stone',[...portico,...arch(.29,.025)],true),
 wall40Lantern:kit('40 Wall roof lantern louvers','jade',[...row(5,i=>box([.82,.055,.08],[0,-.23+i*.11,-.53])),...[-.43,.43].map(x=>box([.035,.68,.1],[x,0,-.54]))],true),
 rockLimestoneFin:kit('Rockefeller limestone vertical ribbons','stone',[-.43,-.14,.14,.43].map(x=>box([.05,.98,.11],[x,0,-.55])),true),
 rockSpandrel:kit('Rockefeller recessed spandrel strip','bronze',[box([1,.19,.04],[0,-.35,-.53])],true),
 rockPortal:kit('Rockefeller entrance relief rays','stone',[...portico,...row(7,i=>box([.025,.22,.045],[(i-3)*.065,.29,-.76],[0,0,-(i-3)*.19]))],true),
 rockObservation:kit('Top of the Rock observation screens','silver',[...bars(9,.76,-.48).map(p=>({...p,s:[.015,.35,.025]})),box([1,.025,.04],[0,.94,-.48])],true),
 seagramIBeam:kit('Seagram bronze exterior I-beams','darkBronze',[-.4,-.13,.13,.4].flatMap(x=>[box([.035,.99,.12],[x,0,-.55]),box([.075,.99,.018],[x,0,-.615])]),true),
 seagramSpandrel:kit('Seagram bronze spandrel panels','darkBronze',[box([1,.24,.055],[0,-.35,-.55])],true),
 seagramPortal:kit('Seagram bronze lobby portal','darkBronze',portico,true),
 leverMullion:kit('Lever House stainless curtain wall mullions','silver',bars(5,0),true),
 leverSpandrel:kit('Lever House green enamel spandrels','jade',[box([1,.3,.055],[0,-.32,-.55])],true),
 leverPilotis:kit('Lever House stainless podium pilotis','silver',[-.38,.38].map(x=>box([.07,.9,.1],[x,-.025,-.5])),true),
 leverTerrace:kit('Lever House podium garden railing','silver',[box([1,.03,.04],[0,.82,-.48]),...[-.45,0,.45].map(x=>box([.018,.3,.035],[x,.66,-.48]))],true),
 citiBand:kit('Citigroup horizontal aluminum cladding','silver',[box([1,.3,.06],[0,-.32,-.54])],true),
 citiMullion:kit('Citigroup continuous window-strip mullions','steel',bars(5,.14),true),
 citiStilt:kit('Citigroup raised tower piers','silver',[box([.26,.99,.27],[0,-.005,0])],true),
 hearstDiagrid:kit('Hearst triangular stainless diagrid','silver',[-1,1].map(s=>box([.065,1.35,.095],[0,0,-.56],[0,0,s*.785])),true),
 hearstNode:kit('Hearst diagrid node plates','silver',[box([.15,.13,.13],[0,0,-.58]),...[-.45,.45].map(x=>box([.14,.095,.12],[x,.44,-.58]))],true),
 hearstPortal:kit('Hearst historic stone entrance','stone',[...portico,...[-.29,0,.29].map(x=>box([.045,.22,.08],[x,.32,-.76]))],true),
 hearstUrn:kit('Hearst historic base sculptural urns','stone',[box([.18,.19,.2],[0,.62,-.38]),pyramid(.24,.16,.71)],true),
};
// Roof slices keep large crowns local to their actual supporting destructible bay.
const roofKits={
 gable:['slate',[roofLoft(.52,1.02),{...roofLoft(.52,1.02),s:[1,1,1],r:[0,Math.PI,0]}]],
 hip:['slate',[pyramid(.98,.65)]],mansard:['slate',[{shape:'cylinder',segments:4,s:[1.38,.4,1.38],p:[0,.71,0],r:[0,Math.PI/4,0]},pyramid(.86,.3,.91)]],
 pyramid:['jade',[pyramid(.94,1.2)]],dome:['jade',[...row(5,i=>({shape:'cylinder',segments:16,s:[Math.sqrt(1-(i/5)**2)*.92,.11,Math.sqrt(1-(i/5)**2)*.92],p:[0,.565+i*.105,0],r:[0,0,0]}))]],
 barrel:['silver',row(6,i=>{const x=(i-2.5)/6;return box([.18,.045,1],[x,.56+Math.sqrt(.25-x*x)*.7,0],[0,0,-Math.asin(x*2)]);})],
 'glass-ridge':['jade',[pyramid(.98,.58),...[-.32,0,.32].map(x=>box([.018,.025,.94],[x,.72,0]))]],
 saw:['steel',[roofLoft(.53,1.02)]],plant:['steel',[box([.62,.45,.62],[0,.735,0]),...row(5,i=>box([.66,.025,.66],[0,.56+i*.085,0]))]],
 garden:['jade',[...[-.35,.35].flatMap(x=>[-.35,.35].map(z=>box([.24,.2,.24],[x,.62,z])))]],
 solar:['crownGlass',[-.25,.25].map(x=>box([.44,.04,.81],[x,.7,0],[-.28,0,0]))],
 woolworth:['jade',[pyramid(.98,2.6)]],wall40:['jade',[pyramid(.98,1.9),box([.035,.6,.035],[0,2.65,0])]],
 rock:['stone',[box([.96,.35,.94],[0,.685,0]),box([.7,.24,.7],[0,.98,0])]],
 seagram:['darkBronze',[box([.97,.28,.97],[0,.65,0])]],lever:['jade',[box([.97,.2,.97],[0,.61,0])]],
 hearst:['silver',[box([.98,.09,.98],[0,.555,0])]],
};
// The two gable halves meet at the ridge rather than filling a crossed wedge.
roofKits.gable[1]=[-1,1].map(s=>{const z0=s<0?-.5:0,z1=s<0?0:.5,h0=s<0?.54:1.05,h1=s<0?1.05:.54;return {shape:'loft',s:[1,1,1],p:[0,0,0],r:[0,0,0],corners:[[-.5,.51,z0],[.5,.51,z0],[.5,.51,z1],[-.5,.51,z1],[-.5,h0,z0],[.5,h0,z0],[.5,h1,z1],[-.5,h1,z1]]};});
for(const [id,[material,parts]]of Object.entries(roofKits))CATALOG_COMPONENTS[`roof_${id}`]=kit(`${id} roof assembly`,material,parts,true);
for(let i=0;i<3;i++)CATALOG_COMPONENTS[`citiRoof${i}`]=kit('Citigroup 45-degree roof section '+i,'silver',[roofLoft(.51+(2-i)*4.2/3.4,.51+(3-i)*4.2/3.4)],true);
Object.freeze(CATALOG_COMPONENTS);

export function catalogRoofTypes(c){
 const style=STYLE_BY_ID.get(c.architecture);if(!style||!c.roof||style.roof==='flat')return [];
 if(style.world)return worldRoofTypes(c);
 if(style.landmark&&!c.topFloor)return [];
 if(style.roof==='citi')return [`citiRoof${c.iz}`];
 return [`roof_${style.roof}`];
}
export function catalogPlacements(c,put,{interiors=true}={}){
 const style=STYLE_BY_ID.get(c.architecture);if(!style)return;
 for(let side=0;side<4;side++)if(c.walls[side]){
  const layer=c.material==='glass'?'glass':'facade';
  if(!c.openSkin){
   const facade=c.architecture==='hearst'&&c.floor<3?['urbanAshlar','urbanAcademicShield']:style.facade;
   for(const type of facade){
    if(type==='urbanClockDial'&&!c.topFloor||type==='urbanAcademicShield'&&c.floor!==1||['urbanDutchGable','urbanDormer'].includes(type)&&!c.roof)continue;
    put(type,side,layer);
   }
   if(c.ground||c.architecture==='citigroup'&&c.floor===2)put(style.entry,side,layer);
  }
  if(c.architecture==='rockefeller30'&&c.roof)put('rockObservation',side);
  if(c.architecture==='wall40'&&c.topFloor)put('wall40Lantern',side,layer);
  if(c.architecture==='lever-house'&&c.roof&&!c.topFloor)put('leverTerrace',side);
  if(c.architecture==='hearst'&&c.floor===2)put('hearstUrn',side);
 }
 if(c.openSkin){if(c.architecture==='park432')put('parkMechanicalCore');else put(style.entry);}
 for(const type of catalogRoofTypes(c))put(type);
 if(c.architecture==='woolworth'&&c.topFloor)put('woolworthPinnacle');
 worldPlacements(c,put);
}

// Conservative stepped roof boxes track the visible roof profile. This avoids the
// invisible full-height bounding cube around a pyramid or the low end of a wedge.
export function catalogRoofColliders(c){
 if(STYLE_BY_ID.get(c.architecture)?.world)return worldColliders(c);
 const out=[],[w,h,d]=c.size;
 for(const type of catalogRoofTypes(c)){
  const id=type.replace('roof_','');
  if(type.startsWith('citiRoof')){const iz=c.iz;for(let i=0;i<6;i++){const z=-.5+(i+.5)/6,top=.51+(2.5-iz-z)*4.2/3.4;out.push([0,(.51+top)/2*h,z*d,w/2,Math.max(.015,(top-.51)*h/2),d/12]);}}
  else if(['pyramid','hip','woolworth','wall40'].includes(id)){const height={pyramid:1.2,hip:.65,woolworth:2.6,wall40:1.9}[id];for(let i=0;i<6;i++){const width=.98*(1-(i+.5)/6);out.push([0,(.51+(i+.5)*height/6)*h,0,width*w/2,height*h/12,width*d/2]);}if(id==='wall40')out.push([0,2.65*h,0,.018*w,.3*h,.018*d]);}
  else if(id==='gable'||id==='saw'){for(let i=0;i<6;i++){const z=-.5+(i+.5)/6,top=id==='gable'?1.05-Math.abs(z)*1.02:.51+(.5-z)*.51;out.push([0,(.51+top)/2*h,z*d,w/2,(top-.51)*h/2,d/12]);}}
  else{const height={mansard:.7,dome:.55,barrel:.42,'glass-ridge':.58,plant:.45,garden:.22,solar:.35,rock:.59,seagram:.28,lever:.2,hearst:.09}[id]||.2;out.push([0,(.51+height/2)*h,0,w*.49,height*h/2,d*.49]);}
 }
 if(c.architecture==='woolworth'&&c.topFloor)for(const x of [-.4,.4])for(const z of [-.4,.4])out.push([x*w,.935*h,z*d,.08*w,.425*h,.08*d]);
 if(c.openSkin&&c.architecture==='park432')out.push([0,-.025*h,0,.07*w,.45*h,.07*d]);
 if(c.openSkin&&c.architecture==='citigroup')out.push([0,-.005*h,0,.13*w,.495*h,.135*d]);
 if(c.openSkin&&c.architecture==='lever-house')for(const x of [-.38,.38])out.push([x*w,-.025*h,-.5*d,.035*w,.45*h,.05*d]);
 return out;
}
