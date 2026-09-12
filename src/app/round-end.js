import {ColossusDeath} from '../colossus-death.js';
import {ROUND_END} from '../../shared/round-end.js';
import {state,$} from './state.js';

export class RoundEnding {
 constructor({scene,giant,fx,audio,hud,shake,xr,net,renderer,listenerPosition}){
  Object.assign(this,{audio,hud,xr,net,renderer});
  this.death=new ColossusDeath(scene,giant,{fx,onBlast:(p,major)=>{
   audio.play('explosion',{p,power:major?1:.5});if(major)audio.play('collapse',{p,power:.7});
   const a=listenerPosition(),near=1-Math.min(1,Math.hypot(...p.map((n,i)=>n-a[i]))/110);
   if(xr.session)xr.haptic(near*(major?.75:.2),major?220:65);else shake.add(near*(major?.8:.18));
  }});
 }
 get defeated(){return this.result?.winner==='raiders';}
 start(result,serverTime=result.time){
  if(this.result?.round===result.round)return;
  this.reset();this.result=result;this.elapsed=Math.max(0,(serverTime??result.time)-result.time);this.startedNow=performance.now()-this.elapsed*1000;
  this.hud.hideOverlay();$('scoreboard').classList.add('hidden');document.body.classList.add('round-ending');
  $('round-transition').classList.remove('hidden');
  if(this.defeated)this.death.start(result.pose,result.round);
  this.xr.roundEnding=this;
 }
 update(s){
  if(!this.result)return;
  if(s.round!==this.result.round||!s.phase){if(s.round>this.result.round)this.reset();return;}
  this.elapsed=Math.max(this.elapsed,s.time-this.result.time,(performance.now()-this.startedNow)/1000);
  if(this.defeated)this.death.update(this.elapsed,{local:this.renderer.xr.isPresenting});
  const title=this.defeated?(this.elapsed<ROUND_END.breakApart?'CORE FAILURE':'COLOSSUS DESTROYED'):'COLOSSUS SURVIVES';
  $('round-transition-title').textContent=title;
  $('round-transition-detail').textContent=this.defeated?(this.elapsed<ROUND_END.breakApart?'REACTOR UNSTABLE':'RAIDERS WIN'):'TIME EXPIRED';
  if(this.elapsed>=(this.defeated?ROUND_END.results:1.4)&&!this.revealed){
   this.revealed=true;$('round-transition').classList.add('settled');
   this.audio.play((this.result.winner==='giant')===(state.role==='boss')?'win':'lose');
   this.hud.scoreboard(this.result.players,this.result.winner);
   if(!this.renderer.xr.isPresenting&&state.role!=='spectator'){
    document.exitPointerLock?.();this.hud.showOverlay(title+'.','',{renderer:this.renderer,net:this.net});
    $('overlay-kicker').textContent='ROUND COMPLETE';$('resume').textContent='WATCH AFTERMATH ↗';
    $('camera-toggle').classList.add('hidden');$('overlay-text').after($('scoreboard'));
   }
  }
  if(this.revealed){const text=`${s.kills} raiders down. ${Math.round(s.damage)}% city damage. New round in ${Math.max(0,Math.ceil(ROUND_END.restart-this.elapsed))} seconds.`;if($('overlay-text').textContent!==text)$('overlay-text').textContent=text;}
 }
 reset(){
  this.death.reset();this.result=null;this.elapsed=0;this.revealed=false;this.xr.roundEnding=null;
  document.body.classList.remove('round-ending');$('round-transition').classList.add('hidden');$('round-transition').classList.remove('settled');
  if($('scoreboard').parentElement!==document.body)document.body.append($('scoreboard'));$('scoreboard').classList.add('hidden');
  $('overlay-kicker').textContent='CONNECTION ESTABLISHED';
 }
}
