import {F} from '../shared/config.js';
export class FlightFX{
 constructor(){this.canvas=document.getElementById('flight-effects');this.ctx=this.canvas.getContext('2d');this.lines=Array.from({length:84},(_,i)=>({angle:i*2.39996,r:(i*.618)%1,width:1+i%3}));this.pulse=0;this.boom=0;this.strength=0;this.time=0;}
 dodge(){this.pulse=1;}
 sonicBoom(){this.boom=1;this.pulse=.7;}
 update(dt,player,enabled){
  const c=this.canvas,x=this.ctx,w=innerWidth,h=innerHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  x.clearRect(0,0,w,h);this.time+=dt;this.pulse=Math.max(0,this.pulse-dt*3);this.boom=Math.max(0,this.boom-dt*1.8);
  const soaring=enabled&&player&&!!(player.flags&F.SOAR)&&!(player.flags&(F.DEAD|F.RAG)),speed=player?Math.hypot(...player.v):0,target=soaring?Math.min(1,.38+speed/65):enabled?Math.min(.5,Math.max(0,(speed-20)/40)):0;
  this.strength+=(target-this.strength)*(1-Math.exp(-dt*8));if(!enabled||!player){this.strength=0;this.boom=0;return;}
  const strength=this.strength,cx=w*.5,cy=h*.5;
  // Keep the aiming area clear. Streamlines accelerate through the outer screen
  // and gain brighter cores and longer tails while the pilot is soaring.
  x.globalCompositeOperation='lighter';
  for(const line of this.lines){line.r=(line.r+dt*(.4+speed*.024))%1;if(strength<.01)continue;const r=.33+line.r*.52,length=.035+strength*.15,alpha=strength*line.r*.38,dx=Math.cos(line.angle),dy=Math.sin(line.angle),g=x.createLinearGradient(cx+dx*w*r,cy+dy*h*r,cx+dx*w*(r+length),cy+dy*h*(r+length));g.addColorStop(0,'rgba(85,185,255,0)');g.addColorStop(.7,`rgba(128,213,255,${alpha})`);g.addColorStop(1,`rgba(232,250,255,${alpha*.8})`);x.strokeStyle=g;x.lineWidth=line.width*(.6+strength);x.beginPath();x.moveTo(cx+dx*w*r,cy+dy*h*r);x.lineTo(cx+dx*w*(r+length),cy+dy*h*(r+length));x.stroke();}
  // Broad, slowly moving condensation arcs sit at the edges of peripheral vision.
  if(strength>.05)for(let i=0;i<3;i++){const t=(this.time*.8+i/3)%1;x.strokeStyle=`rgba(142,220,255,${strength*(1-t)*.12})`;x.lineWidth=2+5*t;x.beginPath();x.ellipse(cx,cy,w*(.43+t*.17),h*(.48+t*.2),Math.sin(this.time)*.02,0,Math.PI*2);x.stroke();}
  if(this.boom){const t=1-this.boom;x.strokeStyle=`rgba(223,249,255,${this.boom*.65})`;x.lineWidth=2+this.boom*12;x.beginPath();x.ellipse(cx,cy,w*(.15+t*.8),h*(.15+t*.8),0,0,Math.PI*2);x.stroke();}
  x.globalCompositeOperation='source-over';if(this.pulse||strength>.01){const g=x.createRadialGradient(cx,cy,Math.min(w,h)*.32,cx,cy,Math.hypot(w,h)*.55);g.addColorStop(0,'rgba(75,180,235,0)');g.addColorStop(.65,`rgba(75,180,235,${strength*.045})`);g.addColorStop(1,`rgba(103,216,255,${this.pulse*.22+strength*.13})`);x.fillStyle=g;x.fillRect(0,0,w,h);}
 }
}
