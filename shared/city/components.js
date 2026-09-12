// Architectural kit in normalized bay coordinates. Parts have distinct geometry and jobs;
// structural assemblies share a physics bay, while facade/glass pieces follow their own skin.
// All of these same assemblies remain attached when their bay falls or comes to rest.
const box=(s,p=[0,0,0],r=[0,0,0])=>({s,p,r});
const rail=(y,z=-.51)=>[box([.9,.024,.022],[0,y,z]),...[-.42,-.21,0,.21,.42].map(x=>box([.016,.23,.018],[x,y-.11,z]))];
const beam=(x=0,z=0)=>[box([.1,.86,.025],[x,-.025,z]),...[-.075,.075].map(d=>box([.1,.86,.02],[x,-.025,z+d]))];
const kit=(label,material,parts)=>({label,material,parts});
export const COMPONENTS=Object.freeze({
 slabEdge:kit('Precast slab edge','stone',[box([1,.075,.07],[0,.46,-.48])]),
 iBeam:kit('Steel I girder','steel',[box([.96,.09,.024],[0,.38,-.38]),...[-.05,.05].map(y=>box([.96,.018,.075],[0,.38+y,-.38]))]),
 hColumn:kit('Flanged steel column','steel',beam(-.46,-.46)),
 crossBrace:kit('Diagonal frame bracing','steel',[-1,1].map(s=>box([.025,1.15,.03],[0,0,-.44],[0,0,s*.79]))),
 joists:kit('Open floor joists','steel',[-.24,0,.24].map(x=>box([.026,.05,.86],[x,.385,0]))),
 coreWall:kit('Concrete service core','concrete',[box([.045,.88,.48],[.14,-.02,.13])]),
 elevator:kit('Elevator door and jambs','steel',[box([.035,.7,.29],[.11,-.09,.13]),box([.036,.65,.008],[.087,-.105,.13]),box([.05,.024,.34],[.11,.27,.13])]),
 stairFlight:kit('Ten-tread stair flight','concrete',Array.from({length:10},(_,i)=>box([.24,.04,.074],[-.2,-.43+i*.087,-.3+i*.063]))),
 stairLanding:kit('Stair landing','concrete',[box([.5,.045,.22],[-.14,.425,.36])]),
 stairRail:kit('Stair handrail','steel',[box([.016,1.08,.018],[-.325,.09,.01],[-.625,0,0]),...[-.2,.05,.3].map(z=>box([.014,.22,.014],[-.325,z+.02,z]))]),
 pipe:kit('Vertical service riser','steel',[box([.034,.89,.034],[.36,-.01,.35]),box([.14,.028,.035],[.31,.2,.35])]),
 lintel:kit('Window lintel','stone',[box([.77,.055,.042],[0,.32,-.519])]),
 sill:kit('Projecting stone sill','stone',[box([.78,.04,.07],[0,-.32,-.525])]),
 mullion:kit('Window mullions','steel',[-.29,0,.29].map(x=>box([.016,.61,.025],[x,0,-.524]))),
 transom:kit('Window transom','steel',[box([.62,.018,.025],[0,.15,-.525])]),
 pier:kit('Masonry wall pier','stone',[-.45,.45].map(x=>box([.085,.89,.045],[x,0,-.519]))),
 quoin:kit('Stacked corner quoins','stone',Array.from({length:5},(_,i)=>box([i%2?.12:.19,.11,.06],[-.4,-.35+i*.175,-.53]))),
 cornice:kit('Moulded cornice','stone',[box([1,.04,.1],[0,.48,-.51]),box([.97,.035,.065],[0,.44,-.51])]),
 dentils:kit('Dentil blocks','stone',Array.from({length:9},(_,i)=>box([.04,.035,.06],[-.44+i*.11,.4,-.52]))),
 door:kit('Recessed shop doorway','steel',[box([.028,.69,.09],[-.29,-.075,-.501]),box([.028,.69,.09],[-.07,-.075,-.501]),box([.25,.026,.09],[-.18,.275,-.501]),box([.009,.12,.02],[-.095,-.04,-.549])]),
 shopfront:kit('Storefront framing','steel',[box([.38,.025,.06],[.19,-.3,-.53]),box([.025,.65,.06],[.4,0,-.53]),box([.38,.025,.06],[.19,.3,-.53])]),
 shutter:kit('Roller shutter slats','steel',Array.from({length:10},(_,i)=>box([.36,.027,.04],[.2,-.28+i*.055,-.516]))),
 canopy:kit('Shop entrance canopy','bronze',[box([.86,.045,.21],[0,.36,-.49],[-.08,0,0]),box([.86,.08,.025],[0,.31,-.59])]),
 balcony:kit('Balcony platform','stone',[box([.66,.05,.22],[0,-.33,-.48])]),
 balconyRail:kit('Balcony railing','steel',rail(-.04,-.58)),
 escapePlatform:kit('Fire escape landing','steel',[box([.6,.026,.16],[0,-.3,-.52]),...[-.26,0,.26].map(x=>box([.02,.11,.14],[x,-.36,-.5],[.5,0,0]))]),
 escapeLadder:kit('Fire escape ladder','steel',[...[-.09,.09].map(x=>box([.02,.91,.028],[x,0,-.58])),...Array.from({length:8},(_,i)=>box([.2,.018,.025],[0,-.4+i*.11,-.59]))]),
 parapet:kit('Roof parapet coping','stone',[box([.99,.07,.09],[0,.56,-.47])]),
 roofDrain:kit('Roof drain and elbow','steel',[box([.027,.48,.027],[.42,.32,-.44]),box([.1,.026,.027],[.39,.55,-.44])]),
 chimney:kit('Capped chimney stack','stone',[box([.14,.28,.14],[.25,.64,.22]),box([.18,.035,.18],[.25,.79,.22])]),
 duct:kit('Ventilation duct and elbow','steel',[box([.38,.08,.09],[-.15,.57,.22]),box([.09,.16,.09],[-.3,.63,.22])]),
 skylight:kit('Ridge skylight frame','steel',[-1,1].map(sign=>box([.35,.018,.18],[0,.575,sign*.065],[sign*.3,0,0]))),
 roofVent:kit('Louvered vent housing','steel',[box([.18,.16,.17],[.28,.6,-.2]),...Array.from({length:4},(_,i)=>box([.2,.018,.19],[.28,.56+i*.04,-.2]))]),
 wtcRibs:kit('WTC closely spaced perimeter ribs','silver',Array.from({length:7},(_,i)=>box([.027,.925,.047],[-.42+i*.14,0,-.519]))),
 wtcTrident:kit('WTC three-prong lobby trident','silver',[box([.075,.38,.06],[0,-.26,-.53]),box([.045,.49,.06],[0,.2,-.53]),...[-1,1].flatMap(s=>[box([.038,.35,.06],[s*.16,.08,-.53],[0,0,-s*.88]),box([.038,.26,.06],[s*.29,.33,-.53])])]),
 wtcSpandrel:kit('WTC steel spandrel belt','silver',[box([1,.12,.04],[0,-.39,-.52])]),
 wtcMechanical:kit('WTC mechanical floor louvers','steel',Array.from({length:6},(_,i)=>box([1,.027,.055],[0,-.31+i*.125,-.516]))),
 wtcHatTruss:kit('WTC rooftop hat truss','steel',[box([.87,.028,.04],[0,.63,0]),box([.87,.028,.04],[0,.53,0]),...[-1,1].map(s=>box([.025,.47,.04],[s*.23,.58,0],[0,0,s*1.35]))]),
 wtcRoofRim:kit('WTC flat roof crown rim','silver',[box([1,.14,.055],[0,.55,-.49])]),
 empirePilaster:kit('Empire fluted limestone pilaster','stone',[-.44,.44].flatMap(x=>[-.024,.024].map(dx=>box([.028,.93,.074],[x+dx,0,-.528])))),
 empireFan:kit('Empire Art Deco entrance sunburst','bronze',Array.from({length:7},(_,i)=>box([.025,.29,.05],[Math.sin((i-3)*.26)*.13,.13+Math.cos((i-3)*.26)*.15,-.54],[0,0,-(i-3)*.26]))),
 empireSetback:kit('Empire setback terrace cornice','stone',[box([1,.055,.14],[0,.52,-.46]),box([1,.05,.095],[0,.57,-.46]),box([1,.035,.06],[0,.61,-.46])]),
 empireCrown:kit('Empire stepped metal crown','silver',[box([.74,.1,.1],[0,.05,-.53]),box([.57,.1,.1],[0,.15,-.53]),box([.4,.1,.1],[0,.25,-.53]),box([.23,.16,.1],[0,.38,-.53])]),
 empireObservation:kit('Empire observation deck balustrade','bronze',rail(.81,-.49)),
 empireMast:kit('Empire mast buttresses','silver',[-1,1].flatMap(x=>[-1,1].map(z=>box([.075,.45,.075],[x*.22,.7,z*.22],[z*.17,0,-x*.17])))),
 windowRecess:kit('Deep window reveal','stone',[box([.035,.67,.095],[-.34,0,-.49]),box([.035,.67,.095],[.34,0,-.49]),box([.71,.035,.095],[0,.34,-.49])]),
 casement:kit('Operable casement frame','steel',[-1,1].flatMap(s=>[box([.018,.55,.035],[s*.16,0,-.56]),box([.31,.018,.035],[s*.16,.275,-.56]),box([.31,.018,.035],[s*.16,-.275,-.56])])),
 windowHood:kit('Window hood and brackets','stone',[box([.82,.035,.14],[0,.36,-.54]),...[-.29,.29].map(x=>box([.055,.1,.06],[x,.3,-.54]))]),
 arch:kit('Segmental masonry arch','stone',Array.from({length:7},(_,i)=>box([.12,.065,.09],[Math.sin((i-3)*.3)*.38,.19+Math.cos((i-3)*.3)*.2,-.54],[0,0,-(i-3)*.18]))),
 keystone:kit('Projecting arch keystone','stone',[box([.095,.13,.12],[0,.39,-.55])]),
 jamb:kit('Layered entrance jamb','stone',[-.3,.3].flatMap(x=>[box([.045,.75,.08],[x,-.065,-.54]),box([.02,.78,.055],[x*1.17,-.05,-.53])])),
 doorPanel:kit('Panelled entrance door','bronze',[box([.24,.62,.025],[-.16,-.1,-.54]),...[-.24,0,.19].map(y=>box([.18,.14,.025],[-.16,y,-.56]))]),
 kickPlate:kit('Brass door kickplate','bronze',[box([.24,.1,.03],[-.16,-.35,-.57])]),
 doorCloser:kit('Door closer and link','steel',[box([.12,.035,.04],[-.16,.25,-.55]),box([.14,.012,.014],[-.13,.28,-.59],[0,.45,0])]),
 intercom:kit('Entry intercom and buttons','steel',[box([.065,.12,.035],[.01,-.04,-.55]),...[-.065,-.03,.005].map(y=>box([.012,.008,.01],[.025,y,-.574]))]),
 mailSlot:kit('Door letterbox','bronze',[box([.12,.025,.02],[-.16,-.13,-.585])]),
 threshold:kit('Entrance stone threshold','stone',[box([.67,.05,.2],[0,-.44,-.52])]),
 shopSign:kit('Framed storefront signboard','bronze',[box([.79,.16,.05],[0,.22,-.55]),box([.83,.018,.07],[0,.31,-.55]),box([.83,.018,.07],[0,.13,-.55])]),
 displayShelf:kit('Shop display shelving','bronze',[-.29,-.02,.2].map(y=>box([.38,.018,.1],[.2,y,-.42]))),
 awningStripes:kit('Striped canvas awning ribs','stone',Array.from({length:6},(_,i)=>box([.03,.025,.23],[-.37+i*.148,.39,-.51],[-.08,0,0]))),
 wallLantern:kit('Caged wall lantern','bronze',[box([.055,.14,.045],[.42,.14,-.565]),box([.09,.018,.08],[.42,.22,-.565]),box([.09,.018,.08],[.42,.06,-.565]),box([.02,.09,.06],[.42,.22,-.525])]),
 securityGrille:kit('Window security grille','steel',[-.24,-.12,0,.12,.24].map(x=>box([.012,.48,.023],[x,0,-.58]))),
 acUnit:kit('Window AC compressor','steel',[box([.23,.15,.16],[.2,-.23,-.57]),...[-.275,-.24,-.205].map(y=>box([.21,.012,.017],[.2,y,-.66]))]),
 radiator:kit('Cast iron interior radiator','steel',Array.from({length:6},(_,i)=>box([.025,.19,.055],[-.16+i*.065,-.31,-.36]))),
 frieze:kit('Decorative facade frieze','stone',[box([.98,.08,.065],[0,.39,-.54]),...[-.35,0,.35].map(x=>box([.07,.06,.025],[x,.39,-.583],[0,0,.785]))]),
 dripEdge:kit('Metal flashing drip edge','silver',[box([.94,.013,.12],[0,-.37,-.53]),box([.94,.025,.014],[0,-.385,-.59])]),
 expansionJoint:kit('Facade expansion joint','steel',[box([.012,.85,.028],[.38,0,-.528])]),
 panelBolts:kit('Exposed cladding fixings','silver',[-.36,.36].flatMap(x=>[-.32,.32].map(y=>box([.024,.025,.035],[x,y,-.55])))),
 downspout:kit('Rainwater downpipe and collars','steel',[box([.035,.94,.04],[-.45,0,-.555]),...[-.3,.05,.35].map(y=>box([.06,.022,.06],[-.45,y,-.555]))]),
 gutter:kit('Roof drainage gutter','steel',[box([1,.025,.11],[0,.53,-.53]),box([1,.06,.015],[0,.56,-.585])]),
 soffit:kit('Roof eave soffit panels','stone',[box([.98,.025,.17],[0,.465,-.49]),...[-.35,0,.35].map(x=>box([.035,.055,.16],[x,.44,-.49]))]),
 corbel:kit('Carved cornice corbels','stone',[-.36,0,.36].flatMap(x=>[box([.065,.1,.09],[x,.38,-.54]),box([.085,.04,.13],[x,.45,-.54])])),
 ceilingLight:kit('Suspended interior light','silver',[box([.32,.025,.09],[0,.32,.05]),box([.012,.1,.014],[-.12,.38,.05]),box([.012,.1,.014],[.12,.38,.05])]),
 sprinkler:kit('Sprinkler main and drop','steel',[box([.7,.018,.022],[0,.32,.28]),box([.018,.08,.018],[.12,.28,.28]),box([.045,.012,.045],[.12,.235,.28])]),
 cableTray:kit('Perforated cable tray','steel',[box([.08,.025,.8],[.32,.32,0]),...[-.3,0,.3].map(z=>box([.12,.012,.025],[.32,.34,z]))]),
 partition:kit('Office partition and header','concrete',[box([.045,.63,.35],[.36,-.12,.04]),box([.045,.05,.6],[.36,.22,.05])]),
 desk:kit('Office workstation','bronze',[box([.27,.025,.13],[-.2,-.19,.25]),...[-.3,-.1].map(x=>box([.018,.24,.018],[x,-.32,.25]))]),
 serviceDoor:kit('Fire-rated service door','steel',[box([.025,.67,.26],[.12,-.08,.13]),box([.02,.018,.14],[.095,-.09,.13])]),
 exitSign:kit('Emergency exit fixture','silver',[box([.025,.07,.16],[.095,.29,.13])]),
 stairStringer:kit('Stair side stringers','steel',[-.33,-.07].map(x=>box([.017,1.07,.034],[x,-.035,.015],[-.625,0,0]))),
 conduit:kit('Electrical conduits and junction','steel',[box([.02,.72,.02],[.4,0,.38]),box([.075,.065,.04],[.4,-.15,.38])]),
 roofHatch:kit('Roof access hatch and hinges','steel',[box([.25,.055,.27],[-.18,.55,-.08]),box([.028,.025,.29],[-.28,.59,-.08])]),
 ductFan:kit('Roof extractor fan and cage','steel',[box([.21,.12,.21],[.05,.59,.18]),...[-1,1].map(s=>box([.21,.012,.04],[.05,.66,.18],[0,s*.785,0]))]),
 roofWalkway:kit('Roof maintenance walkway','steel',[box([.11,.017,.68],[-.38,.54,0]),...[-.24,0,.24].map(z=>box([.16,.025,.02],[-.38,.56,z]))]),
 solarRack:kit('Tilted solar support rack','steel',[box([.3,.024,.25],[.22,.61,.1],[-.25,0,0]),...[-.12,.12].map(x=>box([.022,.13,.02],[.22+x,.565,.1]))]),
 utilityTank:kit('Expansion tank and feed pipe','silver',[box([.12,.2,.14],[-.05,.65,-.3]),box([.024,.12,.024],[-.05,.53,-.3])]),
 lightningRod:kit('Lightning conductor and bracket','silver',[box([.012,.4,.014],[.43,.72,.42]),box([.1,.012,.014],[.4,.58,.42])]),
 chimneyCap:kit('Chimney rain hood','stone',[box([.2,.03,.2],[.25,.85,.22]),...[-1,1].map(s=>box([.012,.06,.012],[.25+s*.065,.81,.22]))]),
 planter:kit('Roof terrace planter','stone',[box([.36,.11,.13],[0,.57,-.3]),box([.39,.022,.16],[0,.635,-.3])]),
 louverScreen:kit('Rooftop equipment screen','steel',Array.from({length:5},(_,i)=>box([.52,.017,.027],[0,.55+i*.055,.4]))),
 bayWindow:kit('Projecting bay-window frame','bronze',[box([.48,.04,.16],[0,-.32,-.6]),...[-.24,0,.24].map(x=>box([.022,.64,.05],[x,0,-.68])),box([.48,.04,.16],[0,.32,-.6])]),
 frenchDoor:kit('Full-height balcony doors','bronze',[-.24,0,.24].map(x=>box([.019,.81,.035],[x,-.025,-.55]))),
 sunshade:kit('Horizontal brise soleil','silver',[-.26,0,.26].map(y=>box([.86,.024,.22],[0,y,-.55],[-.16,0,0]))),
 verticalFin:kit('Vertical solar fins','silver',[-.35,0,.35].map(x=>box([.028,.86,.21],[x,0,-.53]))),
 gothicArch:kit('Pointed Gothic window tracery','stone',[-1,1].flatMap(s=>[box([.035,.43,.08],[s*.25,-.06,-.55]),box([.035,.36,.08],[s*.13,.23,-.55],[0,0,s*.68])])),
 copperRoof:kit('Copper mansard roof edge','bronze',[box([.95,.06,.28],[0,.6,-.36],[.5,0,0]),box([1,.045,.07],[0,.51,-.51])]),
 sawtooth:kit('Industrial sawtooth rooflight','steel',[-1,1].flatMap(s=>[box([.38,.025,.28],[s*.23,.61,0],[0,0,.4]),box([.025,.18,.25],[s*.23+.17,.6,0])])),
 decoChevron:kit('Art Deco chevron panel','bronze',[-1,1].map(s=>box([.035,.29,.055],[s*.09,.07,-.55],[0,0,s*.6]))),
 castIronCapital:kit('Cast iron column capital','bronze',[-.43,.43].flatMap(x=>[box([.12,.08,.065],[x,.34,-.55]),box([.16,.022,.09],[x,.395,-.55])])),
 arcade:kit('Ground-floor arcade springing','stone',[-1,1].flatMap(s=>[box([.1,.59,.13],[s*.42,-.15,-.54]),box([.18,.075,.14],[s*.36,.2,-.54])])),
 terraceGlass:kit('Terrace glass balustrade posts','silver',[-.38,-.19,0,.19,.38].map(x=>box([.014,.25,.035],[x,.66,-.49])))
});
export function componentPlacements(c,{interiors=true}={}){
 const out=[],put=(type,side=-1,layer='frame')=>out.push({type,side,layer});
 const core=c.ix%2===0&&c.iz%2===0;
 if(core && (interiors || c.ground))for(const type of ['iBeam','hColumn','joists','coreWall','elevator','stairFlight','stairLanding','stairRail','pipe'])put(type);
 if(core&&c.floor%3===1)put('crossBrace');
 for(let side=0;side<4;side++)if(c.walls[side]){
  const facade=c.material==='glass'?'glass':'facade';
  const detailed=interiors||c.floor<3||c.roof;
  put('slabEdge',side);put('mullion',side,'glass');
  if(c.architecture==='wtc'){
   if(c.ground)for(const t of ['door','shopfront','shutter','canopy','lintel','sill','transom'])put(t,side,'glass');
   if(c.roof)for(const t of ['parapet','roofDrain'])put(t,side);
   put('wtcSpandrel',side);put(c.floor<2?'wtcTrident':'wtcRibs',side);
   if(c.floor===10||c.floor===20)put('wtcMechanical',side,facade);
   if(c.roof)put('wtcRoofRim',side);
  }else{
   if(detailed)for(const t of ['lintel','sill','transom','pier'])put(t,side,facade);
   if(detailed&&c.ix%2===0&&c.iz%2===0)put('quoin',side,facade);
   if(c.ground)for(const t of ['door','shopfront','shutter','canopy'])put(t,side,facade);
   if(c.floor===1){put('balcony',side,facade);put('balconyRail',side,facade);}
   if(detailed&&side===1&&c.floor>0){put('escapePlatform',side,facade);put('escapeLadder',side,facade);}
   if(c.roof){for(const t of ['cornice','dentils','parapet','roofDrain'])put(t,side);}
   if(c.architecture==='empire'){
    put('empirePilaster',side,facade);if(c.ground)put('empireFan',side,facade);
    if(c.roof){put('empireSetback',side);put('empireObservation',side);}
    if(c.tier>=3)put('empireCrown',side,facade);
   }
  }
 }
 // Close-range service, facade and roof assemblies add depth without more physics bodies.
 if(core&&(interiors||c.ground))for(const t of ['ceilingLight','sprinkler','cableTray','partition','desk','serviceDoor','exitSign','stairStringer','conduit'])put(t);
 for(let side=0;side<4;side++)if(c.walls[side]){
  const layer=c.material==='glass'?'glass':'facade';
  if(interiors||c.floor<3||c.roof)for(const t of ['windowRecess','casement','windowHood','radiator','dripEdge','expansionJoint','panelBolts','downspout'])put(t,side,layer);
  if(c.ground)for(const t of ['jamb','doorPanel','kickPlate','doorCloser','intercom','mailSlot','threshold','shopSign','displayShelf','awningStripes','wallLantern','securityGrille','arcade'])put(t,side,layer);
  if(c.floor===1)for(const t of ['acUnit','frieze','bayWindow','frenchDoor'])put(t,side,layer);
  if(c.roof)for(const t of ['gutter','soffit','corbel','terraceGlass'])put(t,side);
  const styleParts={brownstone:['arch','keystone'],tenement:['arch','keystone'],warehouse:['castIronCapital'],castiron:['castIronCapital','arch'],beauxarts:['arch','keystone'],deco:['decoChevron'],curtain:['verticalFin','sunshade'],terraced:['sunshade'],brutalist:['verticalFin'],hotel:['arch','keystone'],apartment:['sunshade'],industrial:['castIronCapital'],market:['arch','keystone'],gothic:['gothicArch'],copper:['decoChevron'],modern:['verticalFin']};
  if(interiors||c.floor<3||c.roof)for(const t of styleParts[c.architecture]||[])put(t,side,layer);
  if(c.roof&&['copper','beauxarts','hotel'].includes(c.architecture))put('copperRoof',side);
 }
 if(c.roof){
  for(const t of ['roofHatch','ductFan','roofWalkway','solarRack','utilityTank','lightningRod','chimneyCap','planter','louverScreen'])put(t);
  if(['industrial','warehouse','market'].includes(c.architecture))put('sawtooth');
  if(c.architecture==='wtc')put('wtcHatTruss');
  for(const t of ['chimney','duct','skylight','roofVent'])put(t);
  if(c.architecture==='empire'&&c.spire)put('empireMast');
 }
 return out;
}
