import {WORLD_STYLE_BY_ID} from '../../shared/city/world-landmarks.js';
export const skinKey=c=>WORLD_STYLE_BY_ID.has(c.architecture)&&c.material==='glass'?'worldGlass':['empire','chrysler','hudson30','vanderbilt'].includes(c.architecture)?c.architecture:c.material;
