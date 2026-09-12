// Procedural facade textures. Each material gets a colour map (with window openings drawn as
// dark recesses) and an emissive map of randomly lit windows. Everything is generated once on
// a canvas so nothing extra is downloaded and the Quest can use a smaller size.
import * as T from 'three';
import {seeded} from '../../shared/math.js';
function canvasTexture(size, draw){
 const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
 const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 4; return t;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
// Window rectangles for one bay wall in UV space: [x, y, w, h] fractions.
export const WINDOWS = {
 empire:[[.13,.15,.16,.71],[.42,.15,.16,.71],[.71,.15,.16,.71]],
 brick:[[.1, .28, .2, .42], [.4, .28, .2, .42], [.7, .28, .2, .42]],
 stone:[[.12, .22, .3, .5], [.58, .22, .3, .5]],
 concrete:[[.06, .3, .88, .36]],
 glass:[[0, 0, 1, 1]]
};
function windows(x, s, list, rand, lit, color, dark){
 for(const [wx, wy, ww, wh] of list){
  x.fillStyle = dark; x.fillRect(wx * s, wy * s, ww * s, wh * s);
  if(lit){ const on = rand() < lit; x.fillStyle = on ? color : 'rgb(0,0,0)'; x.fillRect((wx + .04 * ww) * s, (wy + .05 * wh) * s, ww * .92 * s, wh * .9 * s); }
 }
}
export function facadeMaps(material, size = 512, seed = 7){
 const rand = seeded(seed + material.length);
 const map = canvasTexture(size, (x, s) => {
  if(material === 'brick'){
   x.fillStyle = rgb(112, 92, 84); x.fillRect(0, 0, s, s);
   const rows = 30, cols = 12, bh = s / rows, bw = s / cols;
   for(let r = 0; r < rows; r++) for(let c = -1; c < cols; c++){ const shade = 138 + rand() * 40, ox = (r % 2) * bw / 2; x.fillStyle = rgb(shade + 18, shade * .55 + 8, shade * .42); x.fillRect(c * bw + ox + 1, r * bh + 1, bw - 2, bh - 2); }
   x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, s, s * .06); x.fillRect(0, s * .94, s, s * .06);
   windows(x, s, WINDOWS.brick, rand, 0, '', rgb(28, 32, 38));
   x.fillStyle = rgb(190, 178, 160); for(const [wx, wy, ww, wh] of WINDOWS.brick) x.fillRect((wx - .02) * s, (wy + wh) * s, (ww + .04) * s, s * .02);
  }else if(material==='empire'){
   x.fillStyle='#e2dfd2';x.fillRect(0,0,s,s);x.fillStyle='#cbc8bc';for(let i=1;i<7;i++)x.fillRect(0,i*s/7,s,1);
   windows(x,s,WINDOWS.empire,rand,0,'','#3e4850');x.fillStyle='#959787';for(const [wx,wy,ww,wh] of WINDOWS.empire)x.fillRect(wx*s,(wy+wh)*s,ww*s,s*.015);
  }else if(material === 'stone'){
   x.fillStyle = rgb(206, 194, 168); x.fillRect(0, 0, s, s);
   const rows = 6, cols = 4, bh = s / rows, bw = s / cols;
   for(let r = 0; r < rows; r++) for(let c = -1; c < cols; c++){ const shade = 196 + rand() * 26, ox = (r % 2) * bw / 2; x.fillStyle = rgb(shade + 6, shade - 6, shade - 30); x.fillRect(c * bw + ox + 2, r * bh + 2, bw - 4, bh - 4); }
   x.fillStyle = rgb(160, 148, 122); x.fillRect(0, s * .1, s, s * .025); x.fillRect(0, s * .9, s, s * .03);
   for(let i = 0; i < 6; i++) x.fillRect((.05 + i * .18) * s, s * .12, s * .012, s * .76);
   windows(x, s, WINDOWS.stone, rand, 0, '', rgb(30, 34, 40));
  }else if(material === 'concrete'){
   x.fillStyle = rgb(172, 170, 162); x.fillRect(0, 0, s, s);
   for(let i = 0; i < 4000; i++){ x.fillStyle = `rgba(${60 + rand() * 60 | 0},${60 + rand() * 60 | 0},${55 + rand() * 60 | 0},.12)`; x.fillRect(rand() * s, rand() * s, 2, 2); }
   x.fillStyle = rgb(120, 118, 112); for(let i = 0; i < 4; i++) x.fillRect(i * s / 4, 0, 3, s); x.fillRect(0, s * .22, s, 3); x.fillRect(0, s * .72, s, 3);
   windows(x, s, WINDOWS.concrete, rand, 0, '', rgb(24, 30, 38));
   x.fillStyle = rgb(90, 96, 100); for(let i = 1; i < 6; i++) x.fillRect((.06 + i * .88 / 6) * s, s * .3, 3, s * .36);
  }else{
   // Glass: pane alpha only inside the grid; mullions are opaque dark metal.
   x.clearRect(0, 0, s, s); x.fillStyle = 'rgba(150,200,225,.62)'; x.fillRect(0, 0, s, s);
   x.fillStyle = rgb(38, 46, 54); for(let i = 0; i <= 3; i++){ x.fillRect(i * s / 3 - 3, 0, 6, s); } x.fillRect(0, 0, s, 8); x.fillRect(0, s * .82, s, s * .18);
   x.fillStyle = 'rgba(70,84,96,.9)'; x.fillRect(0, s * .82, s, s * .18);
  }
 });
 const emissive = canvasTexture(size, (x, s) => {
  x.fillStyle = 'rgb(0,0,0)'; x.fillRect(0, 0, s, s);
  if(material === 'glass'){ for(let i = 0; i < 3; i++) if(rand() < .35) x.fillStyle = `rgba(255,${190 + rand() * 40 | 0},${120 + rand() * 60 | 0},${.5 + rand() * .3})`, x.fillRect(i * s / 3 + 8, 12, s / 3 - 16, s * .78); }
  else windows(x, s, WINDOWS[material], rand, .45, rgb(255, 205, 140), 'rgb(0,0,0)');
 });
 if(material === 'glass') map.premultiplyAlpha = false;
 // Window panes for masonry: transparent except inside the openings, drawn just outside the facade.
 const panes = material === 'glass' ? map : canvasTexture(size, (x, s) => {
  x.clearRect(0, 0, s, s);
  for(const [wx, wy, ww, wh] of WINDOWS[material]){ x.fillStyle = 'rgba(150,200,225,.6)'; x.fillRect(wx * s, wy * s, ww * s, wh * s); x.fillStyle = 'rgba(40,48,56,.95)'; x.fillRect((wx + ww / 2 - .008) * s, wy * s, .016 * s, wh * s); x.fillRect(wx * s, (wy + wh / 2 - .008) * s, ww * s, .016 * s); }
 });
 return {map, emissive, panes};
}
export function roofTexture(size = 256){
 const rand = seeded(31);
 return canvasTexture(size, (x, s) => { x.fillStyle = 'rgb(88,86,82)'; x.fillRect(0, 0, s, s); for(let i = 0; i < 2500; i++){ const g = 70 + rand() * 60; x.fillStyle = `rgb(${g},${g},${g - 6})`; x.fillRect(rand() * s, rand() * s, 2, 2); } });
}
