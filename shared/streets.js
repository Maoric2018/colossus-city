import {BLOCK_SIZE} from './city/layout.js';

export const STREET={block:BLOCK_SIZE,avenue:16,street:12,sidewalk:3.2,curb:.16};
export const SIDEWALK_HALF=[(STREET.block-STREET.avenue)/2,STREET.curb/2,(STREET.block-STREET.street)/2];
// One solid raised island per block replaces intersecting pads per building.
// The top is shared by the sidewalk band and the paved interior courtyard.
export function sidewalkSlabs(env){
 const blocks=env.id==='city-block'?[env.block]:env.id==='midtown'&&env.infinite?Array.from({length:25},(_,i)=>[i%5-2,Math.floor(i/5)-2]):[];
 return blocks.map(([x,z])=>({id:`sidewalk-${x}-${z}`,kind:'pavement',position:[x*STREET.block,STREET.curb/2,z*STREET.block],yaw:0,boxes:[[0,0,0,...SIDEWALK_HALF]]}));
}
