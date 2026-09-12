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
 empireMast:kit('Empire mast buttresses','silver',[-1,1].flatMap(x=>[-1,1].map(z=>box([.075,.45,.075],[x*.22,.7,z*.22],[z*.17,0,-x*.17]))))
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
 if(c.roof){
  if(c.architecture==='wtc')put('wtcHatTruss');
  for(const t of ['chimney','duct','skylight','roofVent'])put(t);
  if(c.architecture==='empire'&&c.spire)put('empireMast');
 }
 return out;
}
