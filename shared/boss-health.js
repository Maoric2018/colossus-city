import {C} from './config.js';
// Count the raider roster, including practice drones and players awaiting respawn.
// An empty room retains the solo baseline until someone joins.
export const bossMaxHealth = count => C.BOSS_HP * Math.max(1, Math.min(C.MAX_RAIDERS, Math.floor(count) || 0));
export function bossHealthFraction(state){
 if(!state)return 1;
 const max=state.bossMaxHP>0?state.bossMaxHP:C.BOSS_HP;
 return Math.max(0,Math.min(1,state.bossHP/max));
}
