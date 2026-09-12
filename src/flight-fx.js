export class FlightFX{
 constructor(){this.canvas=document.getElementById('flight-effects');this.ctx=this.canvas.getContext('2d');this.lines=Array.from({length:42},(_,i)=>({angle:i*2.39996,r:(i*.618)%1}));this.pulse=0;}
 dodge(){this.pulse=1;}
 update(dt,player,enabled){
  const c=this.canvas,x=this.ctx,w=innerWidth,h=innerHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  x.clearRect(0,0,w,h);this.pulse=Math.max(0,this.pulse-dt*3);if(!enabled||!player)return;
  const speed=Math.hypot(...player.v),strength=Math.min(1,Math.max(0,(speed-15)/25)),cx=w*.5,cy=h*.5;
  for(const line of this.lines){line.r=(line.r+dt*(.4+speed*.035))%1;if(strength===0)continue;const r=.28+line.r*.7,length=.018+strength*.11;x.strokeStyle=`rgba(165,235,255,${strength*line.r*.5})`;x.lineWidth=1+strength;x.beginPath();x.moveTo(cx+Math.cos(line.angle)*w*r,cy+Math.sin(line.angle)*h*r);x.lineTo(cx+Math.cos(line.angle)*w*(r+length),cy+Math.sin(line.angle)*h*(r+length));x.stroke();}
  if(this.pulse){const g=x.createRadialGradient(cx,cy,w*.15,cx,cy,w*.7);g.addColorStop(0,'#75ebff00');g.addColorStop(1,`rgba(103,226,255,${this.pulse*.4})`);x.fillStyle=g;x.fillRect(0,0,w,h);}
 }
}
