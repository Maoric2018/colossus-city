// Lobby and menu DOM wiring. Pure UI: every action is a callback supplied by main.js.
import {state, quest, $} from './state.js';
export function bindLobby(actions){
 const setRole = r => { state.selectedRole = r; document.querySelectorAll('[data-role]').forEach(e => e.classList.toggle('active', e.dataset.role === r)); };
 document.querySelectorAll('[data-role]').forEach(e => e.onclick = () => setRole(e.dataset.role));
 $('create').onclick = () => actions.start(true); $('join').onclick = () => actions.start(false); $('practice').onclick = () => actions.start(true, true); $('spectate').onclick = () => actions.start(false, false, true);
 $('resume').onclick = actions.resume; $('menu-button').onclick = actions.menu; $('leave').onclick = actions.leave; $('spectator-leave').onclick = actions.leave;
 $('open-spectator').onclick = actions.openSpectator; $('menu-spectator').onclick = actions.openSpectator; $('spectator-free').onclick = actions.freeCamera;
 $('restart').onclick = actions.restart; $('vr-button').onclick = actions.enterVR; $('copy-link').onclick = actions.copyLink;
 const settings = () => { const turn = Number($('turn-speed').value), reach = Number($('hand-reach').value); actions.settings({turnDegrees:turn, reachGain:reach}); $('turn-value').textContent = `${turn}°/s`; $('reach-value').textContent = `${reach.toFixed(1)}× giant scale`; localStorage.setItem('colossus-turn', String(turn)); localStorage.setItem('colossus-reach', String(reach)); };
 $('turn-speed').value = localStorage.getItem('colossus-turn') || '90'; $('hand-reach').value = localStorage.getItem('colossus-reach') || '1'; $('turn-speed').oninput = settings; $('hand-reach').oninput = settings; settings();
 const params = new URLSearchParams(location.search); $('room-input').value = params.get('room') || ''; $('name').value = localStorage.getItem('colossus-name') || '';
 if(params.get('role') === 'boss' || quest) setRole('boss');
 return {setRole, params};
}
export function notice(text){ $('notice').textContent = text; }
