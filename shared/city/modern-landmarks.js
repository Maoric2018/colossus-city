// Scaled, destructible interpretations of KPF's 30 Hudson Yards and One Vanderbilt.
// References and deliberate game-scale simplifications: docs/NYC_LANDMARKS.md.
const box=(s,p=[0,0,0],r=[0,0,0])=>({s,p,r});
const kit=(label,material,parts)=>({label,material,parts});
const polygon=(points,depth,p=[0,0,0],r=[0,0,0])=>({shape:'polygon',points,s:[1,1,depth],p,r});
const beam=(a,b,width=.018)=>{const d=b.map((n,i)=>n-a[i]),length=Math.hypot(...d);return box([width,length,width],a.map((n,i)=>(n+b[i])/2),[Math.atan2(d[2],d[1]),0,-Math.atan2(d[0],Math.hypot(d[1],d[2]))]);};
const loft=(bottom,top)=>({shape:'loft',corners:[...bottom,...top],s:[1,1,1],p:[0,0,0],r:[0,0,0]});
const rectangle=(cx,y,cz,w,d)=>[[cx-w/2,y,cz-d/2],[cx+w/2,y,cz-d/2],[cx+w/2,y,cz+d/2],[cx-w/2,y,cz+d/2]];
const tier=(nx,nz,floors,ix=0,iz=0)=>({nx,nz,floors,ix,iz});
export const modernLandmark=architecture=>architecture==='hudson30'||architecture==='vanderbilt';
export function hudsonBuilding(x,z){return {x,z,name:'30 HUDSON YARDS',material:'glass',architecture:'hudson30',bay:6,story:3.7,strength:1.18,tiers:[tier(3,3,20),tier(3,2,8)]};}
export function vanderbiltBuilding(x,z){return {x,z,name:'ONE VANDERBILT',material:'glass',architecture:'vanderbilt',bay:4.5,story:3.4,strength:1.18,tiers:[tier(4,4,23),{...tier(4,4,2),voids:[{ix:2,iz:0,nx:2,nz:2}]},tier(2,4,2),tier(2,2,4,0,2)]};}
// All bays on a floor share one spacing. The authoritative merged floor remains an
// rectangle (or a notched union), and shrinking plates preserve the supports below.
export function shapeModernCell(c,b){
 if(!modernLandmark(b.architecture))return;
 const t=c.floor/(c.buildingFloors-1),v=b.architecture==='vanderbilt',width=b.bay*(1-(v?.23:.14)*t),depth=v?width:b.bay;
 c.size=[width,b.story,depth];c.p[0]=b.x+(c.ix-(b.tiers[0].nx-1)/2)*width-(v?0:.7*t);c.p[2]=b.z+(c.iz-(b.tiers[0].nz-1)/2)*depth;
}
export function finishModernCells(cells,b){
 if(!modernLandmark(b.architecture))return;
 for(const c of cells){delete c.roofAsset;
  if(b.architecture==='hudson30'){
   if(c.floor===27)c.hudsonCrown=true;
   if(c.floor===25&&c.ix===2&&c.iz===1)c.hudsonEdge=true;
  }else if(c.floor===30&&c.ix===0&&c.iz===2)c.vanderbiltCrown=true;
  if(c.hudsonCrown||c.hudsonEdge||c.vanderbiltCrown)c.landmarkAttachment=true;
 }
}
const modern={
 modernPressureCap:kit('Curtain-wall pressure cap','silver',[-.5,-.25,0,.25,.5].map(x=>box([.011,.97,.026],[x,0,-.51]))),
 modernSiliconeJoint:kit('Curtain-wall silicone joint','slate',[-.5,0,.5].map(x=>box([.006,.98,.012],[x,0,-.518]))),
 modernFloorGasket:kit('Intermediate floor gasket','slate',[-.49,0,.49].map(y=>box([1,.014,.019],[0,y,-.511]))),
 modernShadowBox:kit('Recessed insulated spandrel','crownGlass',[-.445,.045].map(y=>box([.98,.075,.017],[0,y,-.501]))),
 modernGlassStop:kit('Glazing retaining bead','silver',[-.49,.49].map(x=>box([.009,.98,.032],[x,0,-.512]))),
 modernFireStop:kit('Perimeter slab fire barrier','concrete',[box([.99,.032,.07],[0,.435,-.45])]),
 modernCeilingTrack:kit('Recessed ceiling track','silver',[box([.94,.018,.024],[0,.35,-.35])]),
 modernBlindRail:kit('Roller blind headbox','silver',[box([.22,.024,.035],[.125,.35,-.43])]),
 modernBlindPanel:kit('Partially lowered roller blind','marble',[box([.21,.14,.008],[.125,.27,-.43])]),
 modernCableAnchor:kit('Glass fin anchor plates','silver',[-.38,.38].map(y=>box([.035,.025,.065],[0,y,-.522]))),
 modernLobbyFin:kit('Lobby structural glass fins','blueGlass',[-.33,0,.33].map(x=>box([.012,.96,.12],[x,0,-.49]))),
 modernRevolvingFrame:kit('Revolving entrance drum','silver',[{shape:'cylinder',s:[.3,.68,.3],p:[0,-.12,-.39],r:[0,0,0],segments:16,open:true},box([.36,.035,.36],[0,.23,-.39])]),
 modernRevolvingLeaves:kit('Revolving glass door leaves','blueGlass',[box([.29,.63,.013],[0,-.13,-.39]),box([.013,.63,.29],[0,-.13,-.39])]),
 modernHandle:kit('Stainless pull handles','silver',[-.22,.22].map(x=>box([.012,.19,.027],[x,-.12,-.55]))),
 modernVestibule:kit('Recessed entrance vestibule','slate',[box([.04,.78,.2],[-.29,-.08,-.42]),box([.04,.78,.2],[.29,-.08,-.42]),box([.62,.035,.2],[0,.32,-.42])]),
 modernLobbyLight:kit('Linear lobby downlight','marble',[box([.72,.014,.035],[0,.36,-.49])]),
 modernDrainSlot:kit('Entry trench drain','slate',[box([.95,.014,.035],[0,-.475,-.55])]),
 modernDoorSensor:kit('Automatic door sensor','slate',[box([.045,.018,.027],[0,.31,-.55])]),
 modernTerracePaver:kit('Setback terrace paving','stone',[box([.91,.02,.91],[0,.517,0])]),
 modernFacadeCradle:kit('Recessed maintenance cradle','silver',[box([.4,.035,.14],[0,.57,0]),...[-.18,.18].map(x=>box([.018,.13,.12],[x,.63,0]))])
};
const hudson={
 hudsonRibbon:kit('30 Hudson dark horizontal ribbon','slate',[-.44,.06].map(y=>box([1,.05,.023],[0,y,-.516]))),
 hudsonSilverLip:kit('30 Hudson silver band lip','silver',[-.47,.03].map(y=>box([1,.012,.029],[0,y,-.526]))),
 hudsonKnifeFin:kit('30 Hudson projecting corner blade','silver',[box([.025,.98,.105],[-.485,0,-.5])]),
 hudsonPanelSeam:kit('30 Hudson flush unitized panel joint','slate',[-.375,-.125,.125,.375].map(x=>box([.005,.98,.012],[x,0,-.52]))),
 hudsonLobbyPier:kit('30 Hudson triple-height lobby pier','silver',[box([.065,.99,.09],[-.46,0,-.48])]),
 hudsonLobbySoffit:kit('30 Hudson folded entrance soffit','silver',[polygon([[-.5,.32],[.5,.17],[.5,.21],[-.5,.36]],.19,[0,0,-.46])]),
 hudsonLobbyChevron:kit('30 Hudson lobby diagonal glass brace','silver',[beam([-.48,-.44,-.51],[.48,.44,-.51],.02)]),
 hudsonCanopy:kit('30 Hudson cantilever entry canopy','silver',[box([.94,.025,.25],[0,.32,-.56])]),
 hudsonCanopyRod:kit('30 Hudson canopy suspension rods','steel',[-.35,.35].map(x=>beam([x,.48,-.49],[x,.33,-.66],.009))),
 hudsonMechanical:kit('30 Hudson upper mechanical grilles','slate',Array.from({length:10},(_,i)=>box([.96,.025,.025],[0,-.45+i*.1,-.527]))),
 hudsonTerraceRim:kit('30 Hudson shoulder parapet','silver',[box([1,.22,.022],[0,.61,-.49])]),
 hudsonTerraceGlass:kit('30 Hudson shoulder windscreen','blueGlass',[box([.97,.19,.012],[0,.61,-.501])]),
 hudsonEdgePlate:kit('Edge triangular steel platform','silver',[polygon([[.39,-.52],[.39,.52],[1.95,.64]],.045,[0,.48,0],[Math.PI/2,0,0])]),
 hudsonEdgeSoffit:kit('Edge faceted stainless underside','steel',[loft([[.39,-.05,-.52],[1.95,.42,.64],[.39,-.05,.52],[.39,-.05,.52]],[[.39,.44,-.52],[1.95,.44,.64],[.39,.44,.52],[.39,.44,.52]])]),
 hudsonEdgeGlass:kit('Edge angled glass balustrade','clearGlass',[
  loft([[.39,.5,-.52],[1.95,.5,.64],[1.95,.5,.65],[.39,.5,-.51]],[[.34,.82,-.57],[2.0,.82,.69],[2.0,.82,.7],[.34,.82,-.56]]),
  loft([[.39,.5,.52],[1.95,.5,.64],[1.95,.5,.65],[.39,.5,.53]],[[.39,.82,.59],[2.0,.82,.71],[2.0,.82,.72],[.39,.82,.6]])]),
 hudsonEdgeGlassFloor:kit('Edge triangular glass floor inset','crownGlass',[polygon([[.67,-.16],[1.48,.43],[.67,.32]],.01,[0,.51,0],[Math.PI/2,0,0])]),
 hudsonEdgeSeams:kit('Edge prefabricated section seams','slate',[beam([.4,.516,-.48],[1.8,.516,.58],.008),beam([.4,.516,.3],[1.3,.516,.44],.008)]),
 hudsonEdgeBleachers:kit('Edge observation bleacher steps','stone',Array.from({length:5},(_,i)=>box([.065,.032+i*.034,.38],[.46+i*.065,.51+i*.017,.25]))),
 hudsonEdgeDoor:kit('Edge observation lounge portal','silver',[box([.035,.8,.055],[.508,0,-.24]),box([.035,.8,.055],[.508,0,.24]),box([.035,.025,.53],[.508,.4,0])]),
 hudsonEdgeRim:kit('Edge stainless nose flashing','chrome',[beam([.4,.485,-.52],[1.95,.485,.64],.019),beam([.4,.485,.52],[1.95,.485,.64],.019)]),
 hudsonClimbRail:kit('City Climb roof ascent handrails','silver',[-.19,.19].map(z=>beam([-.48,.95,z],[.48,2.0,z],.013))),
 hudsonClimbTreads:kit('City Climb inclined roof stair treads','slate',Array.from({length:12},(_,i)=>box([.07,.025,.34],[-.46+i*.083,.69+i*.092,0])))
};
// Each roof bay owns its own sliced wedge, avoiding an indestructible whole-tower shell.
for(let ix=0;ix<3;ix++){
 const lo=.62+ix*1.1,hi=lo+1.1;
 hudson[`hudsonRoofShell${ix}`]=kit('30 Hudson sloping glass roof segment '+(ix+1),'blueGlass',[loft(rectangle(0,.5,0,1,1),[[-.5,lo,-.5],[.5,hi,-.5],[.5,hi,.5],[-.5,lo,.5]])]);
 hudson[`hudsonRoofTrim${ix}`]=kit('30 Hudson diagonal roof-edge frame '+(ix+1),'silver',[...[-.502,.502].map(z=>beam([-.5,lo,z],[.5,hi,z],.025)),...[-1,1].flatMap(sign=>[-.502,.502].map(z=>beam([sign*.502,.5,z],[sign*.502,sign<0?lo:hi,z],.018)))]);
 hudson[`hudsonRoofRibs${ix}`]=kit('30 Hudson crown horizontal glazing ribbons '+(ix+1),'slate',Array.from({length:8},(_,i)=>.7+i*.5).filter(y=>y<hi).flatMap(y=>{const x=Math.max(-.5,-.5+(y-lo)/1.1);return [...[-.506,.506].map(z=>box([.5-x,.023,.015],[(x+.5)/2,y,z])),box([.015,.023,1],[.506,y,0]),...(y<lo?[box([.015,.023,1],[-.506,y,0])]:[])];}));
 // Fine vertical glazing continues through the sloped cap rather than ending at
 // the last rectangular floor. End-wall fins wrap the tall knife-edge face too.
 for(let i=0;i<9;i++){
  const x=-.49+i*.1225,top=lo+(x+.5)*1.1;
  for(const z of [-.512,.512])hudson[`hudsonRoofRibs${ix}`].parts.push(box([.006,top-.5,.009],[x,(top+.5)/2,z]));
  const z=-.49+i*.1225;for(const sign of [-1,1]){const top=sign<0?lo:hi;hudson[`hudsonRoofRibs${ix}`].parts.push(box([.009,top-.5,.006],[sign*.512,(top+.5)/2,z]));}
 }

}
const vanderbilt={
 vanderbiltSpandrel:kit('One Vanderbilt warm terra-cotta spandrel','terracotta',[-.435,.065].map(y=>box([.99,.095,.027],[0,y,-.513]))),
 vanderbiltFlutes:kit('One Vanderbilt extruded terra-cotta flutes','terracotta',[-.435,.065].flatMap(y=>Array.from({length:18},(_,i)=>box([.014,.09,.026],[-.472+i*.0555,y,-.538])))),
 vanderbiltGlazedLip:kit('One Vanderbilt glazed spandrel edge','marble',[-.493,.007].map(y=>box([1,.012,.022],[0,y,-.54]))),
 vanderbiltMullion:kit('One Vanderbilt slender vertical mullions','silver',[-.333,0,.333].map(x=>box([.012,.98,.028],[x,0,-.526]))),
 vanderbiltVolumeFin:kit('One Vanderbilt volume junction fin','terracotta',[box([.024,.98,.05],[-.485,0,-.523])]),
 vanderbiltReentrant:kit('One Vanderbilt recessed corner shadow joint','slate',[box([.024,.98,.034],[.485,0,-.516])]),
 vanderbiltLobbyBronze:kit('One Vanderbilt bronze lobby flutes','bronze',Array.from({length:8},(_,i)=>box([.015,.98,.038],[-.475+i*.019,0,-.524]))),
 vanderbiltLobbyCeiling:kit('One Vanderbilt terra-cotta lobby ceiling','terracotta',Array.from({length:8},(_,i)=>box([.025,.025,.93],[-.42+i*.12,.38,0]))),
 vanderbiltAngledCut:kit('One Vanderbilt diagonal entrance reveal','terracotta',[polygon([[-.5,.34],[.5,-.24],[.5,-.18],[-.5,.4]],.13,[0,0,-.51])]),
 vanderbiltCutGlazing:kit('One Vanderbilt angled lobby glass brace','silver',[beam([-.48,-.38,-.529],[.48,.34,-.529],.012)]),
 vanderbiltTransitPortal:kit('One Vanderbilt transit entrance surround','bronze',[box([.046,.89,.17],[-.39,-.02,-.48]),box([.046,.89,.17],[.39,-.02,-.48]),box([.82,.055,.17],[0,.43,-.48])]),
 vanderbiltPortalSoffit:kit('One Vanderbilt recessed bronze portal soffit','bronze',[box([.9,.022,.23],[0,.43,-.38])]),
 vanderbiltLobbyPlinth:kit('One Vanderbilt limestone lobby plinth','marble',[box([.18,.065,.14],[-.43,-.46,-.51])]),
 vanderbiltMechanical:kit('One Vanderbilt crown mechanical louvers','silver',Array.from({length:12},(_,i)=>box([.96,.014,.022],[0,-.47+i*.085,-.534]))),
 vanderbiltSetbackFascia:kit('One Vanderbilt offset volume termination','terracotta',[box([1,.14,.04],[0,.54,-.502])]),
 vanderbiltSetbackGlass:kit('One Vanderbilt setback glass screen','blueGlass',[box([.96,.22,.018],[0,.67,-.49])]),
 vanderbiltSetbackCap:kit('One Vanderbilt setback cap flashing','silver',[box([1,.018,.055],[0,.62,-.51])]),
 vanderbiltSummitFin:kit('SUMMIT observation floor glazing fin','silver',[-.33,0,.33].map(x=>box([.011,.96,.075],[x,0,-.51]))),
 vanderbiltLevitation:kit('SUMMIT projecting glass skybox','clearGlass',[box([.58,.022,.23],[0,-.26,-.6]),box([.58,.4,.016],[0,-.05,-.71]),...[-.29,.29].map(x=>box([.016,.4,.23],[x,-.05,-.6]))]),
 vanderbiltSkyboxFrame:kit('SUMMIT cantilever skybox frame','silver',[box([.62,.025,.27],[0,-.285,-.6]),...[-.3,.3].map(x=>box([.016,.44,.018],[x,-.06,-.72]))]),
 vanderbiltCrownShell:kit('One Vanderbilt tapering glass lantern','blueGlass',[loft(rectangle(.5,.52,.5,2,2),rectangle(.34,2.82,.35,1.65,1.7))]),
 vanderbiltCrownRibs:kit('One Vanderbilt lantern vertical fins','silver',Array.from({length:9},(_,i)=>{const x=-.5+i*.25;return [-1,1].map(s=>beam([x,.52,.5+s],[x*.825-.0725,2.82,.35+s*.85],.014));}).flat()),
 vanderbiltCrownBands:kit('One Vanderbilt lantern horizontal glazing seams','terracotta',Array.from({length:8},(_,i)=>{const t=(i+1)/9,w=2-.35*t,d=2-.3*t,cx=.5-.16*t,cz=.5-.15*t,y=.52+2.3*t;return [box([w,.013,.02],[cx,y,cz-d/2]),box([w,.013,.02],[cx,y,cz+d/2]),box([.02,.013,d],[cx-w/2,y,cz]),box([.02,.013,d],[cx+w/2,y,cz])];}).flat()),
 vanderbiltCrownSteel:kit('One Vanderbilt lantern exposed steelwork','steel',[-1,1].map(s=>beam([.5+s*.95,.55,.48],[.34,2.78,.35],.025))),
 vanderbiltNeedleBase:kit('One Vanderbilt spire support collar','silver',[box([.18,.25,.2],[.34,2.86,.35])]),
 vanderbiltNeedle:kit('One Vanderbilt tapered needle spire','silver',[{shape:'cone',s:[.12,3.7,.12],p:[.34,4.8,.35],r:[0,0,0],segments:8}]),
 vanderbiltNeedleRings:kit('One Vanderbilt spire structural collars','silver',[3.25,3.95,4.65].map(y=>({shape:'cylinder',s:[.13,.03,.13],p:[.34,y,.35],r:[0,0,0],segments:8})))
};
for(let i=0;i<9;i++){const z=-.5+i*.25;for(const sign of [-1,1])vanderbilt.vanderbiltCrownRibs.parts.push(beam([.5+sign,.52,z],[.34+sign*.825,2.82,z*.85-.075],.014));}
export const MODERN_LANDMARK_COMPONENTS=Object.freeze({...modern,...hudson,...vanderbilt});
const sharedService=['roofHatch','ductFan','roofWalkway','utilityTank','louverScreen','duct','roofVent','lightningRod','planter'];
export function modernPlacements(c,put,{interiors=true}={}){
 const v=c.architecture==='vanderbilt',detail=interiors||c.floor<3||c.roof;
 for(let side=0;side<4;side++)if(c.walls[side]){
  for(const t of ['modernPressureCap','modernFloorGasket','modernShadowBox','modernSiliconeJoint','modernGlassStop'])put(t,side,'glass');
  if(detail)for(const t of ['modernFireStop','modernCeilingTrack','modernBlindRail','modernCableAnchor','expansionJoint','panelBolts','dripEdge'])put(t,side,'glass');
  if(detail&&(c.ix+c.iz+c.floor)%3===0)put('modernBlindPanel',side,'glass');
  if(v){
   for(const t of ['vanderbiltSpandrel','vanderbiltFlutes','vanderbiltGlazedLip','vanderbiltMullion','vanderbiltVolumeFin','vanderbiltReentrant'])put(t,side,'glass');
   if(c.floor===23||c.floor===26)put('vanderbiltMechanical',side,'glass');
   if(c.floor===22){put('vanderbiltSummitFin',side,'glass');if((side===0||side===2)&&c.ix===2){put('vanderbiltLevitation',side);put('vanderbiltSkyboxFrame',side);}}
  }else{
   for(const t of ['hudsonRibbon','hudsonSilverLip','hudsonKnifeFin','hudsonPanelSeam'])put(t,side,'glass');
   if(c.floor===19||c.floor===26)put('hudsonMechanical',side,'glass');
  }
  if(c.floor<3){
   put('modernLobbyFin',side,'glass');
   for(const t of v?['vanderbiltLobbyBronze','vanderbiltCutGlazing']:['hudsonLobbyPier','hudsonLobbyChevron'])put(t,side,'glass');
   if(c.floor===2)put(v?'vanderbiltAngledCut':'hudsonLobbySoffit',side,'glass');
  }
  if(c.ground){
   for(const t of ['modernRevolvingFrame','modernRevolvingLeaves','modernHandle','modernVestibule','modernLobbyLight','modernDrainSlot','modernDoorSensor','doorCloser','threshold','intercom','kickPlate'])put(t,side,'glass');
   for(const t of v?['vanderbiltTransitPortal','vanderbiltPortalSoffit','vanderbiltLobbyPlinth']:['hudsonCanopy','hudsonCanopyRod'])put(t,side,'glass');
  }
  if(c.roof&&c.floor<c.buildingFloors-1){
   for(const t of v?['vanderbiltSetbackFascia','vanderbiltSetbackGlass','vanderbiltSetbackCap']:['hudsonTerraceRim','hudsonTerraceGlass'])put(t,side);
   for(const t of ['roofDrain','gutter','terraceGlass'])put(t,side);
  }
 }
 if(v&&c.ground)put('vanderbiltLobbyCeiling');
 if(c.roof&&c.floor<c.buildingFloors-1){put('modernTerracePaver');put('modernFacadeCradle');for(const t of sharedService)put(t);}
 if(c.hudsonCrown){for(const t of ['hudsonRoofShell','hudsonRoofTrim','hudsonRoofRibs'])put(t+c.ix);if(c.ix===0){put('hudsonClimbRail');put('hudsonClimbTreads');}}
 if(c.hudsonEdge)for(const t of ['hudsonEdgePlate','hudsonEdgeSoffit','hudsonEdgeGlass','hudsonEdgeGlassFloor','hudsonEdgeSeams','hudsonEdgeBleachers','hudsonEdgeDoor','hudsonEdgeRim'])put(t);
 if(c.vanderbiltCrown)for(const t of ['vanderbiltCrownShell','vanderbiltCrownRibs','vanderbiltCrownBands','vanderbiltCrownSteel','vanderbiltNeedleBase','vanderbiltNeedle','vanderbiltNeedleRings'])put(t);
}
// Conservative, small cuboid slices approximate the sculpted extensions. The same
// local proxies feed server physics, client hand contacts and detached debris.
export function modernColliders(c){
 if(!modernLandmark(c.architecture))return [];
 const out=[],[w,h,d]=c.size,add=(x,y,z,hx,hy,hz)=>out.push([x*w,y*h,z*d,hx*w,hy*h,hz*d]);
 if(c.hudsonCrown)for(let i=0;i<8;i++){const x=-.5+(i+.5)/8,top=.62+c.ix*1.1+(x+.5)*1.1;add(x,(top+.5)/2,0,1/16,(top-.5)/2,.5);}
 if(c.hudsonCrown&&c.ix===0)for(const z of [-.19,.19])for(let i=0;i<6;i++){const t=(i+.5)/6;add(-.48+.96*t,.95+1.05*t,z,.08,.095,.014);}
 if(c.hudsonEdge)for(let i=0;i<12;i++){
  const x=.39+(i+.5)*1.56/12,t=(x-.39)/1.56,lo=-.52+1.16*t,hi=.52+.12*t;
  const bottom=-.05+.47*t;add(x,(bottom+.5)/2,(lo+hi)/2,1.56/24,(.5-bottom)/2,(hi-lo)/2);add(x,.66,lo,1.56/24,.16,.035);add(x,.66,hi,1.56/24,.16,.035);
 }
 if(c.vanderbiltCrown){for(let i=0;i<12;i++){const t=(i+.5)/12;add(.5-.16*t,.52+2.3*t,.5-.15*t,(2-.35*t)/2,2.3/24,(2-.3*t)/2);}add(.34,4.8,.35,.07,1.85,.07);}
 if(c.architecture==='vanderbilt'&&c.floor===22&&c.ix===2)for(const side of [0,2])if(c.walls[side])add(0,-.07,side===0?-.61:.61,.31,.24,.14);
 return out;
}
