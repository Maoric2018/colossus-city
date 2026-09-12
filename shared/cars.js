import {box,plus,rotate} from './giant-rig.js';
// Keep persistent vehicles outside the counters used by repeated ragdolls and debris.
export const CAR_ID_START=0x40000000;
// Body origin is the original car's centre. Wrecks retain the same origin but have a
// lower crushed shell, so switching models does not teleport the chassis.
export function carShape(size,wreck=false){return {offset:[0,wreck?-size[1]*.22:0,0],half:[size[0]*(wreck?.52:.5),size[1]*(wreck?.28:.5),size[2]*.5]};}
export function carBox(size,p,q,wreck=false){const shape=carShape(size,wreck);return box(plus(p,rotate(shape.offset,q)),shape.half,q);}
