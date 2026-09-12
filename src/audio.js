// Procedural Web Audio: every sound is synthesised from oscillators and filtered noise, so no
// audio files ship and the Quest browser has nothing to download. Distance attenuation is
// computed from the listener position that the game sets every frame.
const KINDS = {
 shot:{range:220, priority:1}, hit:{range:40, priority:2}, headshot:{range:40, priority:3},
 glass:{range:170, priority:2}, brick:{range:200, priority:2}, stone:{range:220, priority:2}, concrete:{range:220, priority:2}, steel:{range:240, priority:2},
 collapse:{range:600, priority:4}, creak:{range:260, priority:3}, explosion:{range:420, priority:4}, missile:{range:300, priority:2}, dodge:{range:60, priority:2},
 thud:{range:120, priority:2}, stomp:{range:320, priority:2}, closecall:{range:40, priority:3}, towerdown:{range:2000, priority:5}, kill:{range:2000, priority:4},
 win:{range:2000, priority:5}, lose:{range:2000, priority:5}, combo:{range:2000, priority:3}, gianthit:{range:500, priority:4}, crumble:{range:200, priority:1}, ui:{range:2000, priority:3}
};
export class GameAudio {
 constructor(){ this.ctx = null; this.voices = 0; this.maxVoices = 26; this.listener = [0, 0, 0]; this.muted = false; this.thrustLevel = 0; this.windLevel = 0; }
 unlock(){
  if(this.ctx) { if(this.ctx.state !== 'running') this.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
  const ctx = this.ctx = new AC(); ctx.resume();
  this.master = ctx.createGain(); this.master.gain.value = .85;
  this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = .004; this.comp.release.value = .18;
  this.master.connect(this.comp).connect(ctx.destination);
  const length = ctx.sampleRate * 2, buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
  let last = 0; for(let i = 0; i < length; i++){ const white = Math.random() * 2 - 1; data[i] = white; last = white; }
  this.noise = buffer;
  // Continuous layers for the local pilot: jet thrust and wind.
  this.thrust = this.loop(380, 'lowpass'); this.wind = this.loop(900, 'bandpass'); this.wind.filter.Q.value = .6;
 }
 loop(frequency, type){
  const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; const gain = ctx.createGain(); gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(this.master); src.start(); return {src, filter, gain};
 }
 setListener(p){ this.listener = p; }
 // Per-frame continuous layers. thrust 0..1, wind 0..1.
 ambient(thrust, wind){
  if(!this.ctx) return; const t = this.ctx.currentTime;
  this.thrustLevel += (thrust - this.thrustLevel) * .15; this.windLevel += (wind - this.windLevel) * .1;
  this.thrust.gain.gain.setTargetAtTime(this.thrustLevel * .13, t, .05); this.thrust.filter.frequency.setTargetAtTime(300 + this.thrustLevel * 1500, t, .05);
  this.wind.gain.gain.setTargetAtTime(this.windLevel * .16, t, .08); this.wind.filter.frequency.setTargetAtTime(500 + this.windLevel * 1200, t, .08);
 }
 gainFor(kind, p, power = 1){
  const k = KINDS[kind] || KINDS.ui; if(!p) return power;
  const d = Math.hypot(p[0] - this.listener[0], p[1] - this.listener[1], p[2] - this.listener[2]);
  return power * Math.pow(Math.max(0, 1 - d / k.range), 1.6);
 }
 // Sound builders. Each returns quickly; nodes disconnect themselves when finished.
 play(kind, {p = null, power = 1} = {}){
  if(!this.ctx || this.muted || this.ctx.state !== 'running') return;
  const gain = this.gainFor(kind, p, power); if(gain < .012) return;
  if(this.voices >= this.maxVoices && (KINDS[kind]?.priority || 1) < 3) return;
  const fn = this[`_${kind}`]; if(fn) fn.call(this, gain, power);
 }
 env(node, peak, attack, hold, release, start = 0){
  const t = this.ctx.currentTime + start, g = node.gain; g.cancelScheduledValues(t); g.setValueAtTime(.0001, t); g.linearRampToValueAtTime(peak, t + attack); g.setValueAtTime(peak, t + attack + hold); g.exponentialRampToValueAtTime(.0001, t + attack + hold + release);
  return t + attack + hold + release;
 }
 tone(type, from, to, peak, attack, hold, release, start = 0){
  const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; const t = ctx.currentTime + start;
  o.frequency.setValueAtTime(from, t); if(to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + hold + release);
  const end = this.env(g, peak, attack, hold, release, start); o.connect(g).connect(this.master); o.start(t); o.stop(end + .02); this.track(o); return o;
 }
 burst(filterType, from, to, q, peak, attack, hold, release, start = 0){
  const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = .8 + Math.random() * .4;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q; const t = ctx.currentTime + start; f.frequency.setValueAtTime(from, t); if(to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + hold + release);
  const g = ctx.createGain(); const end = this.env(g, peak, attack, hold, release, start); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 1.5); s.stop(end + .02); this.track(s); return s;
 }
 track(node){ this.voices++; node.onended = () => { this.voices = Math.max(0, this.voices - 1); try{ node.disconnect(); }catch{} }; }
 _shot(g){ this.burst('bandpass', 1400, 500, .8, .22 * g, .003, .02, .09); this.tone('square', 220, 60, .07 * g, .002, .01, .06); }
 _hit(g){ this.tone('sine', 1500, 1100, .09 * g, .002, .02, .06); }
 _headshot(g){ this.tone('triangle', 1800, 1800, .1 * g, .002, .05, .08); this.tone('triangle', 2400, 2400, .09 * g, .002, .04, .1, .05); }
 _glass(g){ for(let i = 0; i < 5; i++){ const d = Math.random() * .16; this.burst('highpass', 2600 + Math.random() * 2000, 1800, 1.2, (.16 + Math.random() * .12) * g, .002, .01, .09 + Math.random() * .12, d); if(i < 3) this.tone('sine', 3200 + Math.random() * 2200, 2400, .05 * g, .002, .01, .12, d); } }
 _brick(g){ this.burst('lowpass', 900, 260, .7, .38 * g, .01, .06, .38); for(let i = 0; i < 4; i++) this.burst('bandpass', 500 + Math.random() * 700, 300, 2, .12 * g, .002, .01, .05, .06 + Math.random() * .3); this.tone('sine', 80, 40, .2 * g, .004, .04, .25); }
 _stone(g){ this.burst('lowpass', 600, 140, .6, .42 * g, .012, .08, .5); this.tone('sine', 62, 30, .3 * g, .005, .06, .4); for(let i = 0; i < 3; i++) this.burst('bandpass', 400 + Math.random() * 400, 250, 2, .14 * g, .002, .02, .08, .08 + Math.random() * .35); }
 _concrete(g){ this.burst('lowpass', 500, 110, .7, .4 * g, .01, .06, .42); this.tone('sine', 55, 28, .32 * g, .004, .05, .35); this.burst('bandpass', 1200, 700, 1.5, .1 * g, .002, .02, .1, .04); }
 _steel(g){ this.tone('triangle', 880 + Math.random() * 200, 640, .16 * g, .002, .05, .45); this.tone('sine', 1420, 1200, .08 * g, .002, .03, .5, .01); this.burst('lowpass', 700, 120, .6, .3 * g, .008, .04, .3); this.tone('sine', 60, 30, .22 * g, .004, .04, .3); }
 _crumble(g){ this.burst('lowpass', 700, 200, .7, .2 * g, .01, .04, .3); }
 _collapse(g, power){ const len = 1.8 + power * 2.2; this.burst('lowpass', 160, 60, .5, .7 * g, .25, len * .45, len * .55); this.tone('sine', 38, 24, .5 * g, .2, len * .4, len * .6); this.burst('lowpass', 900, 200, .8, .3 * g, .05, .3, 1.2, .1); for(let i = 0; i < 6; i++) this.burst('bandpass', 300 + Math.random() * 500, 200, 2, .12 * g, .01, .03, .2, .2 + Math.random() * len * .8); }
 _creak(g){ const o = this.tone('sawtooth', 84, 62, .12 * g, .08, .3, .35); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 4; try{ o.disconnect(); o.connect(f); f.connect(this.master); }catch{} this.burst('bandpass', 180, 120, 3, .12 * g, .1, .2, .4); }
 _explosion(g){ this.burst('lowpass', 500, 50, .5, .8 * g, .004, .08, .9); this.tone('sine', 70, 26, .5 * g, .003, .1, .7); this.burst('highpass', 1500, 4000, .5, .2 * g, .002, .02, .2); }
 _missile(g){ this.burst('bandpass', 400, 2600, 1, .3 * g, .02, .1, .35); this.tone('sawtooth', 160, 420, .06 * g, .02, .12, .2); }
 _dodge(g){ this.burst('highpass', 900, 3200, .7, .22 * g, .01, .05, .2); }
 _thud(g){ this.tone('sine', 95, 40, .28 * g, .003, .04, .22); this.burst('lowpass', 400, 120, .7, .18 * g, .004, .03, .16); }
 _stomp(g){ this.tone('sine', 44, 28, .5 * g, .01, .12, .45); this.burst('lowpass', 140, 60, .6, .35 * g, .01, .08, .4); }
 _closecall(g){ this.tone('sine', 620, 1500, .12 * g, .01, .05, .1); this.burst('highpass', 1200, 4000, .8, .1 * g, .01, .04, .12); }
 _gianthit(g, power){ this.tone('sine', 120, 40, .45 * g, .004, .08, .5); this.burst('lowpass', 800, 100, .6, .5 * g, .005, .06, .6); this.tone('triangle', 700, 300, .12 * g * power, .002, .04, .3); }
 _towerdown(g){ [220, 330, 440, 660].forEach((f, i) => this.tone('triangle', f, f, .16, .02, .18, .5, i * .11)); this.tone('sine', 55, 40, .35, .05, .5, 1.4); }
 _kill(g){ this.tone('triangle', 520, 520, .12, .01, .08, .18); this.tone('triangle', 780, 780, .12, .01, .1, .25, .09); }
 _combo(g, n){ const base = 440 * Math.pow(1.06, Math.min(12, n)); this.tone('triangle', base, base, .1, .005, .05, .12); this.tone('triangle', base * 1.5, base * 1.5, .08, .005, .05, .16, .05); }
 _win(g){ [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, .14, .02, .22, .6, i * .14)); }
 _lose(g){ [392, 349, 311, 262].forEach((f, i) => this.tone('sawtooth', f, f * .98, .08, .03, .25, .5, i * .2)); this.tone('sine', 50, 30, .3, .1, .6, 1.2); }
 _ui(g){ this.tone('sine', 880, 880, .05, .005, .03, .08); }
}
