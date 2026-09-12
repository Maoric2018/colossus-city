// Reliable server events -> presentation. One place decides what each event looks, sounds and
// feels like, for both the desktop HUD and the headset.
import * as T from 'three';
import {state} from './state.js';
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function makeEventHandler({city, fx, audio, hud, shake, xr, missiles, flightFX, giant, addRag, rags, listenerPosition}){
 const near = (p, range) => 1 - Math.min(1, dist(p, listenerPosition()) / range);
 const vr = () => xr.session;
 return function handle(e){
  switch(e.type){
   case 'block-load':case 'block-unload':city.stream?.state(e);return;
   case 'car-state': city.cars.setState(e); return;
   case 'car-explode': city.cars.setState(e);fx.carExplosion(e.p);audio.play('explosion',{p:e.p,power:.8});if(state.role==='boss')xr.haptic(near(e.p,35)*.4,100);else shake.add(near(e.p,45)*.5);return;
   case 'missile-pose': missiles.pose(e); return;
   case 'missile': missiles.add(e); audio.play('missile', {p:e.p}); if(state.role === 'boss') xr.haptic(.25, 60); return;
   case 'detonate': missiles.remove(e.id); fx.impact(e.p, 1.5); audio.play('explosion', {p:e.p}); shake.add(near(e.p, 60) * .6); return;
   case 'dodge': fx.particle(fx.flares, e.p, {life:.25, size:2, color:new T.Color(0x8beaff), growth:2}); if(e.player === state.localId){ flightFX.dodge(); audio.play('dodge'); } return;
   case 'soar-breach': fx.particle(fx.flares,e.p,{life:.18,size:2.5,color:new T.Color(0xa7edff),growth:1.8});audio.play('heavy',{p:e.p,power:.65});if(e.player===state.localId){flightFX.dodge();shake.add(.18);}return;
   case 'skin': for(const [id, glass, facade] of e.cells) city.setSkin(id, glass, facade); city.commit(); return;
   case 'strike': {
    const power = e.power || .5; fx.impact(e.p, power * .8, e.material); audio.play(e.material === 'glass' && !e.broke ? 'glass' : e.material === 'body' ? 'thud' : e.material, {p:e.p, power:.6 + power * .5});
    if(e.broke){ city.rubble.bay(e.material, e.p, [0, 0, 0], .5); audio.play('steel', {p:e.p, power:.7}); }
    if(state.role === 'boss') xr.hapticMaterial(e.material, e.broke ? 1 : power); else shake.add(near(e.p, 45) * .25);
    return; }
   case 'debris': city.addDebris(e); return;
   case 'settled': city.addDebris(e); return;
   case 'crumble': city.crumble(e); audio.play(e.material, {p:e.p, power:.9}); fx.impact(e.p, .6, e.material); if(state.role !== 'boss') shake.add(near(e.p, 60) * .22); return;
   case 'creak': audio.play('creak', {p:e.p}); fx.dustRing(e.p, .5); return;
   case 'towerdown': audio.play('towerdown'); audio.play('collapse', {p:e.p, power:1}); shake.add(state.role === 'boss' ? 0 : .9); if(state.role === 'boss') xr.haptic(1, 400); return;
   case 'combo': if(state.role === 'boss'){ audio.play('combo', {power:e.n}); } return;
   case 'rag': addRag(e); if(e.player === state.localId){ hud.flash(280); shake.add(.7); audio.play('thud', {power:1}); } else audio.play('thud', {p:e.parts[0].p}); return;
   case 'remove': if(rags.has(e.id)){ rags.get(e.id).dispose(); rags.delete(e.id); } else city.removeDebris(e.id); return;
   case 'shot': fx.shot(e); if(e.player === state.localId){ audio.play('shot', {power:.7}); shake.recoil(.004); if(e.hit){ hud.hit(e.weak); audio.play(e.weak ? 'headshot' : 'hit'); } } else audio.play('shot', {p:e.from, power:.5}); return;
   case 'heavy': fx.shot(e, 0xffa640); fx.impact(e.to, .5); if(e.player === state.localId){ audio.play('heavy', {power:1}); shake.recoil(.02); shake.add(.35); if(e.hit){ hud.hit(e.weak); } } else audio.play('heavy', {p:e.from, power:.8}); return;
   case 'impact': fx.impact(e.p, e.power, e.material); if(state.role === 'boss') xr.haptic(e.power * .35, 70); else shake.add(near(e.p, 70) * e.power * .4); if(e.power > .8) audio.play('collapse', {p:e.p, power:e.power * .5}); return;
   case 'gianthit': fx.impact(e.p, e.power * 1.2, 'steel'); audio.play('gianthit', {p:e.p, power:e.power}); if(state.role === 'boss'){ xr.flash(e.power); xr.haptic(Math.min(1, .4 + e.power), 180); shake.add(.5); } return;
   case 'closecall': if(e.player === state.localId){ audio.play('closecall'); flightFX.dodge(); } return;
   case 'stomp': audio.play('stomp', {p:e.p}); if(state.role !== 'boss') shake.add(near(e.p, 90) * .35); fx.dustRing(e.p, .8); return;
   case 'kill': if(e.player === state.localId){ audio.play('lose', {power:.4}); } else if(state.role === 'boss'){ audio.play('kill'); xr.haptic(.6, 120); } return;
   case 'end': missiles.reset(); audio.play((e.winner === 'giant') === (state.role === 'boss') ? 'win' : 'lose'); hud.scoreboard(e.players, e.winner); return;
   case 'reset': hud.hideOverlay(); return;
  }
 };
}
