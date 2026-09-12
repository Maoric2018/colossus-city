// Shared client state and tiny DOM helper. Modules read from here instead of importing main.js.
export const $ = id => document.getElementById(id);
export const quest = /OculusBrowser|Quest|Mobile VR/i.test(navigator.userAgent);
// Phones and tablets. Primary pointer (not `any-pointer`) keeps touch-capable laptops on the
// mouse path; the Quest browser keeps its own. `?touch=1` / `?touch=0` force it for testing.
const forcedTouch = new URLSearchParams(location.search).get('touch');
export const touch = forcedTouch !== null ? forcedTouch === '1'
 : !quest && matchMedia('(pointer:coarse)').matches && matchMedia('(hover:none)').matches && navigator.maxTouchPoints > 0;
export const state = {
 role:'', selectedRole:'raider', playing:false, paused:false, firstPerson:true,
 current:null, welcome:null, previousPhase:0, localId:0
};
export const me = s => s?.players.find(p => p.id === state.localId) || null;
