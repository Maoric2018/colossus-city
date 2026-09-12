// Destructible, gameplay-scaled world landmarks. See docs/WORLD_LANDMARKS.md.
// A recipe controls its actual floor plan, not just a name or a decorative rooftop.
const style=(id,name,city,material,footprint,floors,bay,tint,facade,entry,roof=id)=>Object.freeze({
 id,name,city,material,footprint,floors:[floors,floors],bay,tint,facade,entry,roof:'world-'+roof,
 massing:'world-'+id,neighborhood:'office',landmark:true,world:true
});
export const WORLD_BUILDING_STYLES=Object.freeze([
 style('transamerica','Transamerica Pyramid','San Francisco','stone',[3,3],28,4.2,0xe0d9c8,['sfQuartzRibs','sfWindowRecess'],'sfLobbyBrace'),
 style('ferry-building','Ferry Building','San Francisco','stone',[5,1],11,2.8,0xd4c3a5,['ferryArcade','ferryCornice'],'ferryPortal'),
 style('jin-mao','Jin Mao Tower','Shanghai','glass',[3,3],27,4.2,0x94a6a5,['jinMaoRibs','jinMaoSpandrel'],'jinMaoPortal'),
 style('swfc','Shanghai World Financial Center','Shanghai','glass',[3,2],31,4.2,0x6d99ab,['swfcSilverSeam','swfcRibbon'],'swfcPortal'),
 style('bank-china','Bank of China Tower','Hong Kong','glass',[3,3],27,4.2,0x6993a6,['bocMullion','bocSpandrel'],'bocPortal'),
 style('hsbc','HSBC Main Building','Hong Kong','glass',[3,2],17,4.2,0x929e9c,['hsbcServiceMast','hsbcFloorRail'],'hsbcPortal'),
 style('shard','The Shard','London','glass',[3,2],29,4.2,0x8da9b7,['shardBlade','shardGasket'],'shardPortal'),
 style('elizabeth-tower','Elizabeth Tower','London','stone',[1,1],18,5.4,0xc7b084,['elizabethPiers','elizabethLancet'],'elizabethPortal'),
 style('lloyds','Lloyd’s Building','London','glass',[3,2],14,4.2,0x879c9e,['lloydsRiser','lloydsWalkway'],'lloydsPortal'),
 style('burj-khalifa','Burj Khalifa','Dubai','glass',[3,3],32,4.2,0xa2b7bd,['burjFlutedGlass','burjSilverBand'],'burjPortal'),
 style('emirates-towers','Emirates Towers','Dubai','glass',[5,2],25,2.6,0x95a8af,['emiratesMullion','emiratesFloorBand'],'emiratesPortal'),
 style('willis','Willis Tower','Chicago','glass',[3,3],29,4.2,0x383d3f,['willisBlackPier','willisRibbon'],'willisPortal'),
 style('hancock','875 North Michigan Avenue','Chicago','glass',[2,2],26,4.7,0x39474c,['hancockMullion','hancockRibbon'],'hancockPortal'),
 style('taipei101','Taipei 101','Taipei','glass',[3,3],30,4.2,0x588b83,['taipeiJadeFin','taipeiCloudBracket'],'taipeiPortal'),
 style('petronas','Petronas Twin Towers','Kuala Lumpur','glass',[5,2],28,2.6,0xa7bcbc,['petronasSteelRing','petronasPier'],'petronasPortal'),
 style('marina-bay','Marina Bay Sands','Singapore','glass',[5,2],20,2.6,0xb2b6aa,['marinaBalcony','marinaMullion'],'marinaPortal'),
 style('tokyo-metropolitan','Tokyo Metropolitan Government Building','Tokyo','stone',[3,3],22,4.2,0xb6b8ae,['tokyoGrid','tokyoPier'],'tokyoPortal'),
 style('grande-arche','Grande Arche','Paris','stone',[3,1],8,4.2,0xe0ded5,['archeGrid','archeRecess'],'archePortal')
]);
export const WORLD_STYLE_BY_ID=new Map(WORLD_BUILDING_STYLES.map(s=>[s.id,s]));
const tier=(nx,nz,floors,ix=0,iz=0,voids)=>({nx,nz,floors,ix,iz,...(voids?{voids}:{})});
const gap=(ix,iz,nx=1,nz=1)=>({ix,iz,nx,nz});
export function worldTiers(id){
 switch(id){
  case 'transamerica':return [tier(3,3,28)];
  case 'ferry-building':return [tier(5,1,3),tier(1,1,8,2)];
  case 'jin-mao':return [tier(3,3,18),tier(2,2,6),tier(1,1,3)];
  case 'swfc':return [tier(3,2,24),tier(3,1,6,0,0,[gap(1,0)]),tier(3,1,1)];
  case 'bank-china':return [tier(3,3,3),tier(2,2,12),tier(2,1,6),tier(1,1,6)];
  case 'hsbc':return [tier(3,2,12),tier(2,2,3),tier(1,2,2)];
  case 'shard':return [tier(3,2,29)];
  case 'elizabeth-tower':return [tier(1,1,18)];
  case 'lloyds':return [tier(3,2,10),tier(2,2,4)];
  case 'burj-khalifa':return [tier(3,3,5,0,0,[gap(0,0),gap(2,0),gap(1,2)]),tier(3,2,6,0,1),tier(2,2,7,1,1),tier(2,1,6,1,1),tier(1,1,8,1,1)];
  case 'emirates-towers':return [tier(5,2,2),tier(5,2,17,0,0,[gap(2,0,1,2)]),tier(2,2,6)];
  case 'willis':return [tier(3,3,12),tier(3,3,6,0,0,[gap(2,2)]),tier(2,3,5),tier(2,2,6,0,0,[gap(1,0),gap(0,1)])];
  case 'hancock':return [tier(2,2,26)];
  case 'taipei101':return [tier(3,3,3),tier(3,3,24),tier(1,1,3,1,1)];
  case 'petronas':return [tier(5,2,2),tier(5,2,10,0,0,[gap(2,0,1,2)]),tier(5,2,1),tier(5,2,15,0,0,[gap(2,0,1,2)])];
  case 'marina-bay':return [tier(5,2,2),tier(5,2,17,0,0,[gap(1,0,1,2),gap(3,0,1,2)]),tier(5,2,1)];
  case 'tokyo-metropolitan':return [tier(3,3,5),tier(3,2,9),tier(3,1,8,0,0,[gap(1,0)])];
  case 'grande-arche':return [tier(3,1,1),tier(3,1,5,0,0,[gap(1,0)]),tier(3,1,2)];
  default:return null;
 }
}
export function shapeWorldCell(c,b){
 const style=WORLD_STYLE_BY_ID.get(b.architecture);if(!style)return;
 const t=c.floor/(c.buildingFloors-1);let sx=1,sz=1;
 if(style.id==='transamerica')sx=sz=1-.78*t;
 if(style.id==='shard'){sx=1-.79*t;sz=1-.71*t;}
 if(style.id==='swfc'){sx=1-.2*t;sz=1-.24*t;}
 if(style.id==='hancock')sx=sz=1-.38*t;
 if(style.id==='jin-mao'){sx=sz=1-Math.floor(c.floor/3)*.025;c.columnSection=Math.floor(c.floor/3);}
 if(style.id==='burj-khalifa'){sx=sz=1-.48*t;}
 if(style.id==='taipei101'){sx=sz=c.floor<3?1:c.floor>=27?.8:.74+(c.floor%3)*.09;c.columnSection=c.floor;}
 c.size=[b.bay*sx,b.story,b.bay*sz];
 c.p[0]=b.x+(c.ix-(b.tiers[0].nx-1)/2)*c.size[0];c.p[2]=b.z+(c.iz-(b.tiers[0].nz-1)/2)*c.size[2];
 // Narrow portal piers leave a clear, recognizable opening beneath the SWFC lintel.
 if(style.id==='swfc'){c.columnSection=c.floor<24?0:c.floor<30?1:2;if(c.floor>=24&&c.floor<30){c.p[0]=b.x+(c.ix-1)*c.size[0]*1.175;c.size[0]*=.65;}}
 // Each Petronas tower steps inward about its own center, retaining the skybridge
 // and the gap between the towers. Splitting column runs preserves these ledges.
 if(style.id==='petronas'&&c.floor>=19){
  const scale=1-Math.floor((c.floor-19)/2)*.115,side=c.ix<2?-1:1,local=c.ix<2?c.ix-.5:c.ix-3.5;
  c.size[0]=c.size[2]=b.bay*scale;c.p[0]=b.x+side*1.5*b.bay+local*c.size[0];c.p[2]=b.z+(c.iz-.5)*c.size[2];c.columnSection=Math.floor((c.floor-19)/2);
 }
 if(style.id==='hsbc'&&c.ground)c.openSkin=true;
}

const box=(s,p=[0,0,0],r=[0,0,0])=>({s,p,r});
const kit=(label,material,parts,signature=true)=>({label,material,parts,signature});
const row=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const poles=(xs,width=.025,depth=.06)=>xs.map(x=>box([width,.98,depth],[x,0,-.54]));
const bands=(ys,width=.035,depth=.06)=>ys.map(y=>box([1,width,depth],[0,y,-.54]));
const portal=(width=.8)=>[...[-width/2,width/2].map(x=>box([.06,.84,.15],[x,-.015,-.55])),box([width+.12,.055,.22],[0,.415,-.55])];
const diagonal=(sign=1,width=.028)=>box([width,1.35,.075],[0,0,-.57],[0,0,sign*Math.PI/4]);
const cylinder=(s,p,segments=12)=>({shape:'cylinder',s,p,r:[0,0,0],segments});
const pyramid=(w,h,y=.51,p=[0,0])=>({shape:'cone',segments:4,s:[w*Math.SQRT2,h,w*Math.SQRT2],p:[p[0],y+h/2,p[1]],r:[0,Math.PI/4,0]});
const loft=(corners)=>({shape:'loft',corners,s:[1,1,1],p:[0,0,0],r:[0,0,0]});
const wedge=(low,high,x0=-.5,x1=.5)=>loft([[x0,.51,-.5],[x1,.51,-.5],[x1,.51,.5],[x0,.51,.5],[x0,low,-.5],[x1,high,-.5],[x1,high,.5],[x0,low,.5]]);
const arch=(radius=.35)=>row(9,i=>{const a=i*Math.PI/8;return box([.13,.045,.09],[Math.cos(a)*radius,.04+Math.sin(a)*radius,-.55],[0,0,a-Math.PI/2]);});
const clock=[...row(16,i=>{const a=i*Math.PI/8;return box([.12,.035,.07],[Math.cos(a)*.3,Math.sin(a)*.3,-.59],[0,0,a-Math.PI/2]);}),...row(12,i=>{const a=i*Math.PI/6;return box([.018,.05,.04],[Math.sin(a)*.24,Math.cos(a)*.24,-.64],[0,0,-a]);}),box([.018,.22,.03],[0,.09,-.66]),box([.16,.018,.03],[.07,0,-.66])];
export const WORLD_COMPONENTS={
 sfQuartzRibs:kit('Transamerica white quartz facade piers','marble',poles([-.44,-.15,.15,.44],.044)),
 sfWindowRecess:kit('Transamerica recessed horizontal window sills','stone',bands([-.35,.34],.055)),
 sfLobbyBrace:kit('Transamerica splayed ground-level braces','marble',[diagonal(-1,.08),diagonal(1,.08)]),
 sfElevatorWing:kit('Transamerica projecting elevator wing','marble',[box([.38,1,.45],[0,0,-.67])]),
 ferryArcade:kit('Ferry Building masonry arcades','stone',[...arch(),...poles([-.4,.4],.075)]),
 ferryCornice:kit('Ferry Building entablature and dentils','stone',[...bands([.35,.44],.055),...row(8,i=>box([.04,.045,.09],[-.42+i*.12,.28,-.56]))]),
 ferryPortal:kit('Ferry Building arched market entry','bronze',[...arch(.4),...portal(.7)]),
 ferryClock:kit('Ferry Building clock dial and hands','bronze',clock),
 jinMaoRibs:kit('Jin Mao vertical stainless ribs','silver',poles([-.45,-.3,0,.3,.45],.026)),
 jinMaoSpandrel:kit('Jin Mao recessed dark spandrels','slate',bands([-.37,.13],.07)),
 jinMaoPortal:kit('Jin Mao layered stainless lobby surround','silver',[...portal(),...portal(.57)]),
 jinMaoPagoda:kit('Jin Mao projecting pagoda eave','silver',[box([1.08,.045,.19],[0,.44,-.53]),...[-1,1].map(s=>box([.2,.032,.21],[s*.48,.49,-.53],[0,0,s*.24]))]),
 swfcSilverSeam:kit('SWFC silver curtain-wall blades','silver',poles([-.48,-.24,0,.24,.48],.015)),
 swfcRibbon:kit('SWFC horizontal glazing seals','slate',bands([-.45,.05],.018)),
 swfcPortal:kit('SWFC steel-framed entrance','silver',portal(.88)),
 swfcAperture:kit('SWFC sky-portal edge lining','silver',poles([-.44,.44],.085,.12)),
 bocMullion:kit('Bank of China blue-glass mullion bank','silver',poles([-.45,-.225,0,.225,.45],.012)),
 bocSpandrel:kit('Bank of China recessed glazing band','slate',bands([-.42,.08],.035)),
 bocPortal:kit('Bank of China triangular lobby braces','silver',[diagonal(-1,.07),diagonal(1,.07),...portal()]),
 hsbcServiceMast:kit('HSBC exposed paired suspension masts','silver',[-.4,.4].flatMap(x=>[-.032,.032].map(dx=>box([.035,1,.12],[x+dx,0,-.57])))),
 hsbcFloorRail:kit('HSBC exterior maintenance deck','silver',[box([1,.035,.19],[0,-.38,-.57]),box([1,.023,.024],[0,-.14,-.65])]),
 hsbcPortal:kit('HSBC open-plaza structural portal','silver',portal(.76)),
 hsbcHangerTruss:kit('HSBC suspension crosshead truss','silver',[...bands([-.33,.34],.06),diagonal(-1,.055),diagonal(1,.055)]),
 shardBlade:kit('Shard projecting glass-edge blade','silver',poles([-.48,.48],.023,.17)),
 shardGasket:kit('Shard fine curtain-wall grid','slate',[...poles([-.25,0,.25],.008,.022),...bands([-.45,.05],.011,.024)]),
 shardPortal:kit('Shard inclined glass lobby framing','silver',[...portal(),...[-1,1].map(s=>box([.03,.8,.05],[s*.24,0,-.59],[0,0,s*.15]))]),
 shardVent:kit('Shard upper mechanical louvers','slate',row(7,i=>box([.9,.024,.055],[0,-.3+i*.1,-.55])),false),
 elizabethPiers:kit('Elizabeth Tower fluted limestone buttresses','stone',[-.43,.43].flatMap(x=>[-.028,.028].map(dx=>box([.04,.98,.15],[x+dx,0,-.54])))),
 elizabethLancet:kit('Elizabeth Tower pointed lancet tracery','bronze',[...poles([-.26,0,.26],.025),...[-1,1].map(s=>box([.028,.33,.055],[s*.13,.25,-.56],[0,0,s*.65]))]),
 elizabethPortal:kit('Elizabeth Tower Gothic doorway','stone',[...portal(.65),...arch(.33)]),
 elizabethClockFace:kit('Elizabeth Tower white opal clock dial','marble',[box([.68,.67,.018],[0,0,-.57])]),
 elizabethClock:kit('Elizabeth Tower gilded clock frame and hands','bronze',clock),
 lloydsRiser:kit('Lloyds external cylindrical service risers','silver',[-.38,.38].map(x=>cylinder([.14,.99,.14],[x,0,-.58]))),
 lloydsWalkway:kit('Lloyds steel access gallery','silver',[box([1,.045,.24],[0,-.36,-.59]),...poles([-.45,-.225,0,.225,.45],.013,.026).map(p=>({...p,s:[.013,.22,.026],p:[p.p[0],-.2,-.71]})),box([1,.024,.03],[0,-.08,-.71])]),
 lloydsPortal:kit('Lloyds external escalator truss','silver',[box([.22,.05,.85],[0,-.14,-.59],[.48,0,0]),...[-.13,.13].map(x=>box([.025,.08,.85],[x,-.04,-.59],[.48,0,0]))]),
 lloydsValve:kit('Lloyds pipe crossover and valve cage','steel',[box([.83,.08,.1],[0,.23,-.6]),cylinder([.12,.1,.12],[0,.31,-.6])],false),
 burjFlutedGlass:kit('Burj Khalifa rounded silver facade flutes','silver',poles([-.44,-.22,0,.22,.44],.02,.075)),
 burjSilverBand:kit('Burj Khalifa stainless horizontal fins','silver',bands([-.45,-.1,.25],.017,.085)),
 burjPortal:kit('Burj Khalifa layered entrance arches','silver',[...arch(.4),...arch(.29),...portal(.82)]),
 burjTerrace:kit('Burj Khalifa setback observation rails','silver',[...bands([.57,.8],.02),...poles([-.45,0,.45],.014).map(p=>({...p,s:[.014,.25,.03],p:[p.p[0],.685,-.5]}))]),
 emiratesMullion:kit('Emirates Towers stainless blade mullions','silver',poles([-.43,-.14,.14,.43],.02)),
 emiratesFloorBand:kit('Emirates Towers horizontal glazing seals','slate',bands([-.4,.1],.022)),
 emiratesPortal:kit('Emirates Towers triangular entrance canopy','silver',[pyramid(.83,.2,.3,[0,-.54]),...portal()]),
 emiratesLouver:kit('Emirates Towers roof-screen louvers','silver',row(7,i=>box([.95,.035,.06],[0,-.3+i*.1,-.55]))),
 willisBlackPier:kit('Willis bundled-tube black aluminum piers','slate',poles([-.47,-.235,0,.235,.47],.035,.07)),
 willisRibbon:kit('Willis bronze-black floor ribbons','darkBronze',bands([-.4,.1],.055)),
 willisPortal:kit('Willis black-framed lobby entry','slate',portal(.84)),
 willisMechanical:kit('Willis rooftop mechanical louver panels','slate',row(9,i=>box([.95,.045,.08],[0,-.37+i*.09,-.55]))),
 hancockMullion:kit('Hancock black curtain-wall mullions','slate',poles([-.45,-.225,0,.225,.45],.02)),
 hancockRibbon:kit('Hancock dark horizontal floor bands','slate',bands([-.43,.07],.055)),
 hancockPortal:kit('Hancock massive diagonal base brace','slate',[diagonal(-1,.1),diagonal(1,.1)]),
 taipeiJadeFin:kit('Taipei 101 jade-colored vertical flutes','jade',poles([-.45,-.3,0,.3,.45],.035,.095)),
 taipeiCloudBracket:kit('Taipei 101 projecting ruyi cloud brackets','jade',[-1,1].flatMap(s=>[box([.21,.07,.16],[s*.35,.28,-.59]),box([.08,.16,.14],[s*.43,.2,-.59])])),
 taipeiPortal:kit('Taipei 101 bronze entrance surround','bronze',[...portal(.88),...bands([.28],.07)]),
 taipeiEave:kit('Taipei 101 flared bamboo-section ledge','jade',[box([1.08,.055,.22],[0,.44,-.56]),...[-1,1].map(s=>box([.23,.04,.23],[s*.49,.49,-.56],[0,0,s*.22]))]),
 petronasSteelRing:kit('Petronas stainless horizontal rings','silver',bands([-.44,-.1,.24],.035,.075)),
 petronasPier:kit('Petronas Islamic-pattern facade piers','silver',[...poles([-.45,-.15,.15,.45],.025),...[-1,1].map(s=>box([.026,.4,.06],[s*.12,.12,-.57],[0,0,s*.58]))]),
 petronasPortal:kit('Petronas pointed entrance portal','silver',[...portal(),...arch(.35)]),
 petronasBridgeRail:kit('Petronas skybridge guard and girder','silver',[...bands([-.38,.12],.065,.12),diagonal(1,.025)]),
 marinaBalcony:kit('Marina Bay Sands horizontal balcony decks','stone',[box([1,.05,.19],[0,-.36,-.56]),box([1,.03,.04],[0,-.1,-.64])]),
 marinaMullion:kit('Marina Bay Sands glass tower mullions','silver',poles([-.45,-.15,.15,.45],.025)),
 marinaPortal:kit('Marina Bay Sands broad arrival canopy','stone',[box([1,.075,.4],[0,.3,-.63]),...portal(.83)]),
 marinaSkyGarden:kit('Marina Bay Sands SkyPark palms and planters','jade',[box([.78,.12,.18],[0,.68,-.26]),...[-.28,.28].flatMap(x=>[box([.024,.48,.025],[x,.96,-.26]),...[-1,1].map(s=>box([.25,.035,.12],[x+s*.11,1.2,-.26],[0,0,-s*.2]))])]),
 tokyoGrid:kit('Tokyo Metropolitan square stone window grid','stone',[...poles([-.45,0,.45],.055),...bands([-.43,.03,.45],.06)]),
 tokyoPier:kit('Tokyo Metropolitan projecting vertical ribs','stone',poles([-.47,.47],.075,.14)),
 tokyoPortal:kit('Tokyo Metropolitan civic entrance columns','stone',portal(.9)),
 tokyoCrownVent:kit('Tokyo Metropolitan tower ventilation grille','steel',row(7,i=>box([.75,.034,.04],[0,-.3+i*.1,-.54]))),
 archeGrid:kit('Grande Arche white marble grid','marble',[...poles([-.45,0,.45],.045),...bands([-.44,.02,.44],.045)]),
 archeRecess:kit('Grande Arche deep cubic recess','slate',[...poles([-.32,.32],.025,.08),...bands([-.32,.32],.025,.08)]),
 archePortal:kit('Grande Arche monumental base plinth','marble',[box([.98,.12,.4],[0,-.4,-.59])]),
 archeRoofRail:kit('Grande Arche panoramic roof balustrade','silver',[...bands([.63,.87],.02),...poles([-.4,0,.4],.013).map(p=>({...p,s:[.013,.24,.03],p:[p.p[0],.75,-.5]}))])
};
// Large diagonal patterns are cut into independent storey pieces. They never glue
// several floors together visually or keep drawing across a destroyed bay.
for(const [prefix,material,width]of [['boc','silver',.045],['hancock','slate',.085]])for(let i=0;i<4;i++){
 const a=(i+.5)/4-.5;WORLD_COMPONENTS[`${prefix}Brace${i}`]=kit(`${prefix} diagonal megabrace section ${i}`,material,[-1,1].map(s=>box([width,1.035,.095],[s*a,0,-.59],[0,0,-s*Math.atan(.25)])));
}
const roofs={
 transamerica:['marble',[pyramid(2.8,3.3,.51,[1,1]),box([.04,.4,.04],[1,4,1])]],
 'ferry-building':['slate',[pyramid(.98,1.2),box([.03,.28,.03],[0,1.8,0])]],
 'jin-mao':['silver',[pyramid(.96,.8),pyramid(.63,.6,1.2),box([.07,1.8,.07],[0,2.35,0])]],
 swfc:['silver',[box([1,.085,1],[0,.555,0])]],
 'bank-china':['silver',[wedge(.56,1.6),...[-.33,.33].map(x=>box([.035,2.4,.035],[x,2.7,0]))]],
 hsbc:['silver',[box([.98,.18,.86],[0,.6,0]),...[-.34,.34].map(x=>cylinder([.15,.65,.15],[x,1,.24]))]],
 shard:['blueGlass',[loft([[-.5,.51,-.5],[2.5,.51,-.5],[2.5,.51,1.5],[-.5,.51,1.5],[.55,3,-.03],[.85,3,-.03],[.85,3,.21],[.55,3,.21]]),box([.04,3.1,.09],[1.1,2,-.15])]],
 'elizabeth-tower':['slate',[pyramid(.98,1.25),pyramid(.49,.7,1.65),box([.028,.4,.028],[0,2.5,0])]],
 lloyds:['silver',[...[-.3,.3].map(x=>cylinder([.25,.75,.25],[x,.89,.24])),...[-1,1].map(s=>box([.54,.04,.96],[s*.22,.69,0],[0,0,-s*.34]))]],
 'burj-khalifa':['silver',[pyramid(.94,.7),cylinder([.2,2,.2],[0,2.15,0],8),box([.035,1.7,.035],[0,3.8,0])]],
 willis:['slate',[box([.92,.3,.92],[0,.66,0]),box([.04,2.5,.04],[0,2.05,0])]],
 hancock:['slate',[...[-.23,1.23].map(x=>box([.05,2.7,.05],[x,1.86,.5]))]],
 taipei101:['jade',[pyramid(.97,.6),pyramid(.64,.5,1.05),box([.065,1.9,.065],[0,2.25,0])]],
 petronas:['silver',[...row(5,i=>cylinder([1.9-i*.28,.14,1.9-i*.28],[.5,.62+i*.16,.5],8)),pyramid(.55,.8,1.36,[.5,.5]),box([.035,1.1,.035],[.5,2.5,.5])]],
 'marina-bay':['stone',[box([1,.15,1],[0,.58,0])]],
 'tokyo-metropolitan':['stone',[box([.97,.2,.95],[0,.61,0]),box([.65,.36,.67],[0,.89,0]),box([.31,.2,.34],[0,1.15,0])]],
 'grande-arche':['marble',[box([1,.08,1],[0,.55,0])]]
};
for(const [id,[material,parts]]of Object.entries(roofs))WORLD_COMPONENTS[`roof_world-${id}`]=kit(`${id} custom crown assembly`,material,parts);
for(let i=0;i<2;i++)WORLD_COMPONENTS[`roof_world-emirates-${i}`]=kit('Emirates Towers slanted roof slice '+i,'silver',[wedge(.51+i*.9,.51+(i+1)*.9)]);
// Ferry hall gables and the SkyPark bow are real separate bays on their lower roofs.
WORLD_COMPONENTS.ferryHallRoof=kit('Ferry Building long hall roof','slate',[-1,1].map(s=>box([1,.045,.57],[0,.68,s*.24],[s*.52,0,0])));
WORLD_COMPONENTS.marinaBow=kit('Marina Bay Sands projecting SkyPark bow','stone',[loft([[-.5,.51,-.5],[.5,.51,-.5],[.5,.51,.5],[-.5,.51,.5],[-1.1,.72,-.25],[.5,.72,-.5],[.5,.72,.5],[-1.1,.72,.25]])]);
Object.freeze(WORLD_COMPONENTS);

export function worldRoofTypes(c){
 const id=c.architecture;if(!WORLD_STYLE_BY_ID.has(id)||!c.roof)return [];
 if(id==='ferry-building'&&!c.topFloor)return ['ferryHallRoof'];
 if(id==='emirates-towers'&&c.floor>=18)return [`roof_world-emirates-${c.ix%3}`];
 if(!c.topFloor)return [];
 if(id==='transamerica'||id==='shard'||id==='hancock'){if(c.ix!==0||c.iz!==0)return [];}
 if(id==='petronas'&&(c.iz!==0||![0,3].includes(c.ix)))return [];
 const out=[`roof_world-${id}`];if(id==='marina-bay'&&c.ix===0)out.push('marinaBow');return out;
}
export function worldPlacements(c,put){
 if(!WORLD_STYLE_BY_ID.has(c.architecture))return;
 for(let side=0;side<4;side++)if(c.walls[side]){
  const layer=c.material==='glass'?'glass':'facade',id=c.architecture;
  if(id==='transamerica'&&c.floor>=15&&c.floor<22&&side%2===0&&c.ix===1)put('sfElevatorWing',side);
  if(id==='ferry-building'&&c.floor===9)put('ferryClock',side,layer);
  if(id==='jin-mao'&&c.floor%3===2)put('jinMaoPagoda',side,layer);
  if(id==='swfc'&&c.floor>=24)put('swfcAperture',side,layer);
  if(id==='bank-china')put('bocBrace'+c.floor%4,side,layer);
  if(id==='hsbc'&&c.floor%4===3)put('hsbcHangerTruss',side,layer);
  if(id==='shard'&&c.floor>=25)put('shardVent',side,layer);
  if(id==='elizabeth-tower'&&c.floor===15){put('elizabethClockFace',side,layer);put('elizabethClock',side,layer);}
  if(id==='lloyds'&&c.floor%3===1)put('lloydsValve',side,layer);
  if(id==='burj-khalifa'&&c.roof)put('burjTerrace',side);
  if(id==='emirates-towers'&&c.roof)put('emiratesLouver',side,layer);
  if(id==='willis'&&c.roof)put('willisMechanical',side,layer);
  if(id==='hancock')put('hancockBrace'+c.floor%4,side,layer);
  if(id==='taipei101'&&c.floor%3===2)put('taipeiEave',side,layer);
  if(id==='petronas'&&c.floor===12&&c.ix===2)put('petronasBridgeRail',side);
  if(id==='tokyo-metropolitan'&&c.topFloor)put('tokyoCrownVent',side,layer);
  if(id==='grande-arche'&&c.topFloor)put('archeRoofRail',side);
 }
 if(c.architecture==='marina-bay'&&c.topFloor)put('marinaSkyGarden');
}

// Shared local cuboids for roof silhouettes, projecting service systems and masts.
// Tapered caps are sliced; their empty upper corners do not become an invisible cube.
function partBoxes(p){
 const out=[];
 if(p.shape==='loft'){
  const a=p.corners.slice(0,4),b=p.corners.slice(4),flat=b.every(v=>v[1]===b[0][1]);
  if(flat){for(let i=0;i<6;i++){const t=(i+.5)/6,points=a.map((v,j)=>v.map((n,k)=>n+(b[j][k]-n)*t)),lo=[0,1,2].map(k=>Math.min(...points.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...points.map(v=>v[k])));out.push([(lo[0]+hi[0])/2,(a[0][1]+(b[0][1]-a[0][1])*t),(lo[2]+hi[2])/2,(hi[0]-lo[0])/2,(b[0][1]-a[0][1])/12,(hi[2]-lo[2])/2]);}}
  else{for(let i=0;i<6;i++){const t=(i+.5)/6,x=a[0][0]+(a[1][0]-a[0][0])*t,top=b[0][1]+(b[1][1]-b[0][1])*t;out.push([x,(a[0][1]+top)/2,0,(a[1][0]-a[0][0])/12,Math.max(.01,(top-a[0][1])/2),.5]);}}
  return out;
 }
 if(p.shape==='cone'){
  // Four-sided cone is turned 45 degrees to produce a square pyramid.
  const factor=p.segments===4?1/Math.SQRT2:1;
  for(let i=0;i<6;i++){const t=(i+.5)/6;out.push([p.p[0],p.p[1]+(t-.5)*p.s[1],p.p[2],p.s[0]/2*(1-t)*factor,p.s[1]/12,p.s[2]/2*(1-t)*factor]);}return out;
 }
 const [x,y,z]=p.s.map(n=>n/2),[rx,ry,rz]=p.r,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
 // Absolute rotation matrix * half extents; small rails use their rotated bounds.
 const m=[cy*cz,-cy*sz,sy,cx*sz+sx*sy*cz,cx*cz-sx*sy*sz,-sx*cy,sx*sz-cx*sy*cz,sx*cz+cx*sy*sz,cx*cy];
 return [[...p.p,Math.abs(m[0])*x+Math.abs(m[1])*y+Math.abs(m[2])*z,Math.abs(m[3])*x+Math.abs(m[4])*y+Math.abs(m[5])*z,Math.abs(m[6])*x+Math.abs(m[7])*y+Math.abs(m[8])*z]];
}
export function worldColliders(c){
 if(!WORLD_STYLE_BY_ID.has(c.architecture))return [];
 const entries=worldRoofTypes(c).map(type=>({type,side:-1}));
 if(c.architecture==='hsbc'&&c.openSkin)entries.push({type:'hsbcPortal',side:-1});
 worldPlacements(c,(type,side=-1)=>{if(['sfElevatorWing','marinaSkyGarden'].includes(type))entries.push({type,side});});
 if(c.architecture==='lloyds')for(let side=0;side<4;side++)if(c.walls[side])entries.push({type:'lloydsRiser',side});
 const out=[];
 for(const {type,side}of entries)for(const p of WORLD_COMPONENTS[type].parts)for(const a of partBoxes(p)){
  const angle=side>=0?-side*Math.PI/2:0,co=Math.round(Math.cos(angle)),si=Math.round(Math.sin(angle)),x=co*a[0]+si*a[2],z=-si*a[0]+co*a[2],hx=Math.abs(co)*a[3]+Math.abs(si)*a[5],hz=Math.abs(si)*a[3]+Math.abs(co)*a[5];
  out.push([x*c.size[0],a[1]*c.size[1],z*c.size[2],hx*c.size[0],a[4]*c.size[1],hz*c.size[2]]);
 }return out;
}
