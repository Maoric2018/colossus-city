// Shared client state and tiny DOM helper. Modules read from here instead of importing main.js.
export const $ = id => document.getElementById(id);
export const quest = /OculusBrowser|Quest|Mobile VR/i.test(navigator.userAgent);
export const state = {
 role:'', selectedRole:'raider', playing:false, paused:false, firstPerson:false,
 current:null, welcome:null, previousPhase:0, localId:0
};
export const me = s => s?.players.find(p => p.id === state.localId) || null;
