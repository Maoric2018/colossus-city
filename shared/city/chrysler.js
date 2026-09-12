// Chrysler-inspired landmark. All dimensions below are in one bay's local units;
// the same kit and solid proxies serve the home tower, streamed copies and debris.
const box=(s,p=[0,0,0],r=[0,0,0])=>({s,p,r});
const kit=(label,material,parts)=>({label:'Chrysler '+label,material,parts});
const prism=(points,depth,p=[0,0,0],r=[0,0,0])=>({...box([1,1,depth],p,r),shape:'polygon',points});
const disc=(radius,depth,p,r=[Math.PI/2,0,0])=>({...box([radius*2,depth,radius*2],p,r),shape:'cylinder',segments:12});
export const CHRYSLER_CROWN=Object.freeze(Array.from({length:7},(_,i)=>({radius:1.5-i*.175,base:.5+i*.7,height:1.6-i*.06,windows:9-i})));
export const CHRYSLER_SPIRE={base:6.05,height:4.3};
export function chryslerBuilding(x,z,{bay=3.5,story=3.4,...extra}={}){
 return {x,z,name:'CHRYSLER BUILDING',material:'stone',architecture:'chrysler',bay,story,strength:1.2,variant:18,
  tiers:[{nx:5,nz:5,floors:4,ix:0,iz:0},{nx:5,nz:3,floors:4,ix:0,iz:1},{nx:3,nz:3,floors:17,ix:1,iz:1}],...extra};
}
// Low-polygon, genuinely curved arches with cut-out triangular sunburst windows.
// The renderer extrudes these shared profiles; dark inset prisms fill the openings.
export function crownProfile(level){
 const {radius:r,base:y,height:h,windows:n}=CHRYSLER_CROWN[level],points=[[-r,y],[r,y]];
 for(let i=0;i<=24;i++){const a=i*Math.PI/24;points.push([r*Math.cos(a),y+h*Math.sin(a)]);}
 const holes=[];
 for(let i=0;i<n;i++){
  const a=.22+(Math.PI-.44)*(i+.5)/n,cs=Math.cos(a),sn=Math.sin(a),width=Math.min(.09,r/(n+1)*.55);
  const tip=[r*.85*cs,y+h*.85*sn],cx=r*.51*cs,cy=y+h*.51*sn;
  holes.push([[cx-width*sn,cy+width*cs],tip,[cx+width*sn,cy-width*cs]]);
 }
 return {points,holes};
}
const crownShell=[],crownWindows=[],crownRims=[],crownSeams=[];
for(let i=0;i<CHRYSLER_CROWN.length;i++){
 const l=CHRYSLER_CROWN[i],{points,holes}=crownProfile(i),z=-l.radius;
 const bend=p=>({...p,arch:l});
 crownShell.push(bend({...prism(points,.055,[0,0,z]),holes}));
 for(const p of holes)crownWindows.push(bend(prism(p,.012,[0,0,z+.025])));
 const arc=[];for(let j=0;j<=24;j++){const a=j*Math.PI/24;arc.push([l.radius*Math.cos(a),l.base+l.height*Math.sin(a)]);}
 for(let j=0;j<24;j++){const [a,b]=[arc[j],arc[j+1]],dx=b[0]-a[0],dy=b[1]-a[1];crownRims.push(bend(box([Math.hypot(dx,dy)+.008,.022,.07],[(a[0]+b[0])/2,(a[1]+b[1])/2,z-.008],[0,0,Math.atan2(dy,dx)])));}
 for(let j=0;j<=8;j++){const a=.18+j*(Math.PI-.36)/8,dx=l.radius*.33*Math.cos(a),dy=l.height*.33*Math.sin(a);crownSeams.push(bend(box([Math.hypot(dx,dy),.009,.063],[l.radius*.66*Math.cos(a),l.base+l.height*.66*Math.sin(a),z-.004],[0,0,Math.atan2(dy,dx)])));}
}
export const CHRYSLER_COMPONENTS=Object.freeze({
 chryslerMarblePier:kit('white marble shaft piers','marble',[-.43,-.145,.145,.43].map(x=>box([.045,.94,.06],[x,0,-.528]))),
 chryslerBrickSpandrel:kit('gray brick spandrels','slate',[-.29,0,.29].map(x=>box([.205,.15,.032],[x,-.38,-.524]))),
 chryslerSteelSash:kit('flush steel window sash','chrome',[-.29,0,.29].flatMap(x=>[box([.009,.65,.025],[x,0,-.543]),box([.2,.011,.025],[x,.02,-.543])])),
 chryslerBasketweave:kit('basketweave masonry relief','marble',[-.41,0,.41].flatMap(x=>[-.35,0,.35].map(y=>box([.095,.025,.035],[x,y,-.557])))),
 chryslerBlackBand:kit('black brick setback bands','slate',[-.38,-.25,.36].map(y=>box([1,.055,.035],[0,y,-.542]))),
 chryslerZigzag:kit('chevron brick frieze','marble',[-.36,-.12,.12,.36].flatMap(x=>[-1,1].map(s=>box([.16,.032,.034],[x+s*.047,.14,-.561],[0,0,s*.65])))),
 chryslerRadiatorGrille:kit('radiator grille frieze','chrome',Array.from({length:13},(_,i)=>box([.016,.22,.05],[-.42+i*.07,.23,-.555]))),
 chryslerHubcap:kit('automotive hubcap medallions','chrome',[-.31,.31].map(x=>disc(.105,.045,[x,-.12,-.57]))),
 chryslerHubcapCenter:kit('hubcap enamel centers','slate',[-.31,.31].map(x=>disc(.045,.048,[x,-.12,-.598]))),
 chryslerFender:kit('sculpted car fender','chrome',[prism([[-.42,.02],[-.35,.18],[-.14,.28],[.14,.28],[.35,.18],[.42,.02]],.1,[0,0,-.6])]),
 chryslerHoodOrnament:kit('winged radiator cap','chrome',[box([.09,.2,.1],[0,.35,-.67]),...[-1,1].map(s=>prism([[0,0],[s*.35,.14],[s*.15,-.04]],.03,[0,.45,-.68]))]),
 chryslerEaglePlinth:kit('eagle mounting plinth','marble',[box([.46,.13,.45],[.32,.53,-.47]),box([.33,.13,.38],[.32,.65,-.48])]),
 chryslerEagleNeck:kit('cantilevered eagle neck','chrome',[prism([[-.12,0],[.2,0],[.15,.5],[-.12,.62],[-.27,.3]],.22,[.32,.66,-.68],[0,Math.PI/2,0])]),
 chryslerEagleHead:kit('faceted eagle head and beak','chrome',[prism([[-.4,.2],[-.29,.39],[.07,.43],[.22,.27],[.32,.19],[.13,.11],[-.15,.08]],.27,[.32,.77,-1.01],[0,Math.PI/2,0])]),
 chryslerEagleEyes:kit('eagle eye inlays','slate',[-1,1].map(s=>box([.025,.055,.075],[.32+s*.147,1.08,-1.12],[.2,0,0]))),
 chryslerEagleFeathers:kit('ribbed eagle throat plates','chrome',Array.from({length:4},(_,i)=>box([.28,.028,.29],[.32,.78+i*.075,-.73-i*.04]))),
 chryslerPineapple:kit('pointed setback finial','chrome',[{...box([.2,.38,.2],[.37,.73,-.39]),shape:'cone',segments:8}]),
 chryslerTerraceCoping:kit('stepped terrace coping','marble',[box([1,.065,.16],[0,.51,-.46]),box([1,.04,.1],[0,.565,-.46])]),
 chryslerTerraceRail:kit('steel terrace rail','chrome',[box([.96,.016,.02],[0,.84,-.48]),...Array.from({length:8},(_,i)=>box([.013,.26,.02],[-.44+i*.125,.71,-.48]))]),
 chryslerMechanicalLouver:kit('upper mechanical louvers','slate',Array.from({length:7},(_,i)=>box([.9,.025,.045],[0,-.32+i*.105,-.538]))),
 chryslerGranitePortal:kit('black granite entrance portal','slate',[-1,1].flatMap(s=>[box([.075,.87,.15],[s*.37,-.015,-.55]),box([.83,.07,.15],[0,.39,-.55])])),
 chryslerPortalReveal:kit('stepped entrance reveals','marble',[-1,1].map(s=>box([.023,.76,.12],[s*.315,-.04,-.575]))),
 chryslerDoorDrum:kit('revolving door drum','chrome',[{...box([.4,.63,.3],[0,-.12,-.57]),shape:'cylinder',segments:12,open:true}]),
 chryslerDoorWings:kit('revolving door wings','slate',[-.65,.65].map(a=>box([.35,.56,.014],[0,-.12,-.57],[0,a,0]))),
 chryslerLobbyFan:kit('entrance sunburst screen','chrome',Array.from({length:9},(_,i)=>box([.012,.22,.025],[Math.sin((i-4)*.3)*.19,.2+Math.cos((i-4)*.3)*.1,-.645],[0,0,-(i-4)*.3]))),
 chryslerCanopy:kit('stainless entrance canopy','chrome',[box([.94,.045,.32],[0,.45,-.6]),box([.94,.1,.035],[0,.385,-.76])]),
 chryslerShopTrim:kit('polished ground-floor shop trim','chrome',[-.43,.43].map(x=>box([.025,.85,.08],[x,0,-.57]))),
 chryslerCrownShell:kit('seven scalloped stainless crown shells','chrome',crownShell),
 chryslerCrownWindows:kit('triangular crown window recesses','crownGlass',crownWindows),
 chryslerCrownRim:kit('rolled crown arch edges','silver',crownRims),
 chryslerCrownSeams:kit('radial standing seams','silver',crownSeams),
 chryslerCrownDecks:kit('seven recessed crown decks','chrome',CHRYSLER_CROWN.map(l=>box([l.radius*2,.045,l.radius*2],[0,l.base,0]))),
 chryslerSpireCollar:kit('vertex mast collar','chrome',[{...box([.48,.5,.48],[0,5.94,0]),shape:'cylinder',segments:8}]),
 chryslerSpire:kit('tapered vertex spire','chrome',[{...box([.23,CHRYSLER_SPIRE.height,.23],[0,CHRYSLER_SPIRE.base+CHRYSLER_SPIRE.height/2,0]),shape:'cone',segments:8}]),
 chryslerSpireRibs:kit('spire base reinforcing fins','silver',[-1,1].flatMap(s=>[box([.022,1,.25],[s*.15,6.05,0],[0,0,s*.11]),box([.25,1,.022],[0,6.05,s*.15],[s*.11,0,0])]))
});
export function chryslerPlacements(c,put){
 for(let side=0;side<4;side++)if(c.walls[side]){
  for(const t of ['MarblePier','BrickSpandrel','SteelSash'])put('chrysler'+t,side,t==='SteelSash'?'glass':'facade');
  if(c.floor<8)put('chryslerBasketweave',side,'facade');
  if(c.floor===7)for(const t of ['BlackBand','Zigzag','RadiatorGrille','Hubcap','HubcapCenter','Fender','HoodOrnament'])put('chrysler'+t,side,'facade');
  if(c.ground)for(const t of ['GranitePortal','PortalReveal','DoorDrum','DoorWings','LobbyFan','Canopy','ShopTrim'])put('chrysler'+t,side,'facade');
  if(c.roof){for(const t of ['TerraceCoping','TerraceRail'])put('chrysler'+t,side);if(c.tier===1)put('chryslerPineapple',side);}
  if(c.floor===24&&c.walls[(side+1)%4])for(const t of ['EaglePlinth','EagleNeck','EagleHead','EagleEyes','EagleFeathers'])put('chrysler'+t,side);
  if(c.floor>=23)put('chryslerMechanicalLouver',side,'facade');
 }
 if(c.chryslerCrown){
  for(let side=0;side<4;side++)for(const t of ['CrownShell','CrownWindows','CrownRim','CrownSeams'])put('chrysler'+t,side);
  for(const t of ['CrownDecks','SpireCollar','Spire','SpireRibs'])put('chrysler'+t);
 }
}
export function chryslerColliders(c){
 const out=[],[w,h,d]=c.size;
 if(c.chryslerCrown){
  // Three vertical slices per arch approximate the stepped silhouette closely,
  // leaving the air outside the curved crown free. Their parent bay owns damage.
  for(const l of CHRYSLER_CROWN)for(let j=0;j<3;j++){
   const bottom=j/3,top=(j+1)/3,r=l.radius*Math.sqrt(1-bottom*bottom);
   out.push([0,(l.base+l.height*(bottom+top)/2)*h,0,r*w,l.height*h/6,r*d]);
  }
  out.push([0,(CHRYSLER_SPIRE.base+CHRYSLER_SPIRE.height/2)*h,0,.13*w,CHRYSLER_SPIRE.height*h/2,.13*d]);
 }
 if(c.floor===24)for(let side=0;side<4;side++)if(c.walls[side]&&c.walls[(side+1)%4]){
  const a=-side*Math.PI/2,x=.32*w,z=-.92*d,hx=.18*w,hz=.45*d;
  out.push([Math.cos(a)*x+Math.sin(a)*z,.92*h,-Math.sin(a)*x+Math.cos(a)*z,side%2?hz:hx,.37*h,side%2?hx:hz]);
 }
 return out;
}
