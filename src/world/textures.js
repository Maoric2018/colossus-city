// Compose the downloaded painted surfaces around the actual window layout. The
// existing facade/pane draws also carry recesses, reflections and lit interiors.
import * as T from 'three';
import {seeded} from '../../shared/math.js';
import {canvasMap,paintImported,surfaceMap} from '../render/surface-art.js';
const cache=new Map();
export const WINDOWS = {
 chrysler:[[.13,.14,.16,.7],[.42,.14,.16,.7],[.71,.14,.16,.7]],
 empire:[[.13,.15,.16,.71],[.42,.15,.16,.71],[.71,.15,.16,.71]],
 brick:[[.1,.28,.2,.42],[.4,.28,.2,.42],[.7,.28,.2,.42]],
 stone:[[.12,.22,.3,.5],[.58,.22,.3,.5]],
 concrete:[[.06,.3,.88,.36]],
 glass:[[0,0,1,1]]
};
function fill(x,color,a,b,w,h){x.fillStyle=color;x.fillRect(a,b,w,h);}
function gradient(x,a,b,w,h,top,bottom){const g=x.createLinearGradient(a,b,a+w*.35,b+h);g.addColorStop(0,top);g.addColorStop(1,bottom);fill(x,g,a,b,w,h);}
function recess(x,s,[u,v,w,h],slim=false){
 const a=u*s,b=v*s,ww=w*s,hh=h*s,pad=s*(slim?.006:.012);
 fill(x,'rgba(26,37,45,.28)',a-pad*1.5,b-pad,ww+pad*3,hh+pad*3);
 fill(x,'#b9bbad',a-pad,b-pad,ww+pad*2,hh+pad*2);
 fill(x,'#203746',a,b,ww,hh);
 fill(x,'rgba(240,237,211,.85)',a-pad,b+hh,ww+pad*2,pad*.8);
}
function pane(x,s,rect,style,{modern=false,columns=1}={}){
 const [u,v,w,h]=rect,a=u*s,b=v*s,ww=w*s,hh=h*s;
 gradient(x,a,b,ww,hh,style.lit?'#b9a482':modern?'#8ab8c9':'#6796ac',style.lit?'#5e625e':modern?'#386479':'#294656');
 x.save();x.beginPath();x.rect(a,b,ww,hh);x.clip();
 // Broad graphic reflections remain legible on low resolution headset maps.
 x.fillStyle=style.lit?'rgba(255,228,170,.12)':'rgba(208,240,242,.18)';
 x.beginPath();x.moveTo(a+ww*.06,b);x.lineTo(a+ww*.3,b);x.lineTo(a+ww*.9,b+hh);x.lineTo(a+ww*.68,b+hh);x.closePath();x.fill();
 if(style.blind){fill(x,'#768c96',a,b,ww,hh*style.blind);for(let i=1;i<5;i++)fill(x,'rgba(222,225,204,.28)',a,b+hh*style.blind*i/5,ww,Math.max(1,s*.002));}
 gradient(x,a,b,ww,hh*.16,'rgba(17,31,43,.5)','rgba(17,31,43,0)');
 x.restore();
 const line=Math.max(1,s*.004);fill(x,'rgba(205,226,221,.6)',a,b,ww,line);
 for(let i=1;i<columns;i++){fill(x,'#253e4b',a+ww*i/columns,b,line,hh);fill(x,'#abc4ca',a+ww*i/columns+line,b,line*.4,hh);}
 if(!modern&&h>.38)fill(x,'rgba(26,48,62,.8)',a,b+hh*.53,ww,line);
}
export function facadeMaps(material,size=512,seed=7){
 const key=material+':'+size+':'+seed;if(cache.has(key))return cache.get(key);
 const curtain=['glass','hudson30','vanderbilt','worldGlass'].includes(material),modern=curtain&&material!=='glass',rand=seeded(seed+material.length*101);
 const list=curtain?Array.from({length:modern?16:3},(_,i)=>{const cols=modern?8:3,rows=modern?2:1;return [(i%cols)/cols+.003,Math.floor(i/cols)/rows+.012,1/cols-.007,1/rows-(modern?.07:.18)];}):material==='concrete'?Array.from({length:6},(_,i)=>[.06+i*.88/6+.002,.3,.88/6-.004,.36]):WINDOWS[material];
 const styles=list.map(()=>({lit:rand()<(curtain?.12:.25),blind:rand()<.3?.12+rand()*.26:0}));
 const map=canvasMap(size,(x,s)=>{
  if(material==='brick'){
   fill(x,'#b5674b',0,0,s,s);
   if(!paintImported(x,s,'brick',{repeat:2})){
    for(let r=0;r<32;r++)for(let c=-1;c<12;c++)fill(x,`hsl(15,42%,${43+rand()*9}%)`,(c+(r%2)*.5)*s/12+1,r*s/32+1,s/12-2,s/32-2);
   }
  }else if(material==='stone'){
   fill(x,'#dbd1b9',0,0,s,s);paintImported(x,s,'marble',{alpha:.18,filter:'grayscale(1) brightness(1.5)'});
   for(let r=0;r<6;r++){fill(x,'rgba(94,87,69,.23)',0,r*s/6,s,Math.max(1,s*.002));for(let col=0;col<4;col++)fill(x,'rgba(94,87,69,.18)',(col+(r%2)*.5)*s/4,r*s/6,Math.max(1,s*.002),s/6);}
   fill(x,'#b9ae93',0,s*.1,s,s*.02);fill(x,'#f0e4ca',0,s*.12,s,s*.009);
  }else if(material==='empire'||material==='chrysler'){
   fill(x,material==='empire'?'#e7dfc9':'#e7e8db',0,0,s,s);
   paintImported(x,s,'concrete',{alpha:.13,filter:'grayscale(1) brightness(1.5)'});
   const rows=material==='empire'?8:20;for(let r=0;r<rows;r++)fill(x,'rgba(77,85,85,.14)',0,r*s/rows,s,Math.max(1,s*.0015));
   if(material==='chrysler')for(const [u,,w]of WINDOWS.chrysler)gradient(x,u*s,0,w*s,s,'#81939c','#4d6470');
  }else if(material==='concrete'){
   x.drawImage(surfaceMap('concrete',size).image,0,0,s,s);
   for(let col=0;col<4;col++){const a=col*s/4;fill(x,'rgba(69,91,104,.2)',a,0,Math.max(1,s*.003),s);fill(x,'rgba(255,255,244,.5)',a+2,0,1,s);}
   fill(x,'#84959d',0,s*.22,s,s*.012);fill(x,'#b6c2c6',0,s*.73,s,s*.008);
  }else{
   fill(x,material==='hudson30'?'#314d5d':material==='vanderbilt'?'#9da69f':'#536f7d',0,0,s,s);
   for(let i=0;i<list.length;i++)pane(x,s,list[i],styles[i],{modern:true});
   fill(x,'rgba(204,225,221,.6)',0,s*.985,s,s*.006);
  }
  if(!curtain){
   // A gentle recess at slab edges replaces the former heavy dark banding.
   gradient(x,0,0,s,s*.065,'rgba(42,49,52,.26)','rgba(42,49,52,0)');
   fill(x,'rgba(248,239,214,.5)',0,s*.985,s,s*.009);
   for(const rect of list)recess(x,s,rect,material==='chrysler'||material==='empire');
  }
 },'facade:'+material);
 const emissive=canvasMap(size,(x,s)=>{
  fill(x,'#000',0,0,s,s);for(let i=0;i<list.length;i++)if(styles[i].lit){const [u,v,w,h]=list[i],blind=styles[i].blind;fill(x,'#d7ac72',(u+w*.07)*s,(v+h*Math.max(.08,blind))*s,w*.86*s,h*(1-Math.max(.08,blind)-.08)*s);}
 },'windows-lit:'+material);
 const panes=curtain?map:canvasMap(size,(x,s)=>{for(let i=0;i<list.length;i++)pane(x,s,list[i],styles[i],{columns:material==='brick'||material==='stone'?2:1});},'panes:'+material);
 for(const t of new Set([map,panes,emissive]))t.wrapS=t.wrapT=T.ClampToEdgeWrapping;
 const result={map,emissive,panes};cache.set(key,result);return result;
}
export function roofTexture(size=256){
 const key='roof:'+size;if(cache.has(key))return cache.get(key);
 const texture=canvasMap(size,(x,s)=>{
  fill(x,'#85939c',0,0,s,s);paintImported(x,s,'concrete',{alpha:.45,filter:'grayscale(1) brightness(1.1)'});
  // Membrane seams and parapet contact shade, with no extra rooftop objects.
  for(let i=0;i<4;i++){const a=i*s/4;fill(x,'rgba(30,46,56,.35)',a,0,Math.max(1,s*.005),s);fill(x,'rgba(215,225,216,.2)',a+s*.006,0,1,s);}
  x.strokeStyle='rgba(26,41,51,.28)';x.lineWidth=s*.035;x.strokeRect(s*.017,s*.017,s*.966,s*.966);
 },'surface:roof');cache.set(key,texture);return texture;
}
