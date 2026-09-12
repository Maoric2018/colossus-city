// The colossus: tracked-hand embodiment, desktop stand-in, practice AI, swept strikes and the
// body stopping against buildings. The server never extrapolates a disconnected punch.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {GIANT, handQuaternion, resolveHand, identity} from '../shared/giant-rig.js';
import {C} from '../shared/config.js';
import {v, add, sub, mul, len, norm, dist, arr, vec, clamp, rotateYaw, segmentDistance, segmentAABB, lookDir} from '../shared/math.js';
import {launchMissile} from './abilities.js';
import {knockdown} from './combat.js';
import {damageCell, breakCells, buildingsAlong} from './destruction.js';
import {sideBit} from '../shared/city/materials.js';
import {facingSide} from '../shared/city/cells.js';
import {noInput} from './players.js';
export function initialBoss(){
 return {x:0, z:0, yaw:0, head:v(0, 23.8, 0), left:v(-5.6, 16, -4), right:v(5.6, 16, -4), lastPose:-100, input:noInput(), lastInput:-100, missileReady:0, stagger:0, combo:0, comboAt:-10, stepDistance:0, leftQuaternion:[...identity], rightQuaternion:[...identity], pressed:{}};
}
export function updateBoss(room){
 const b = room.boss, prevL = {...b.left}, prevR = {...b.right}, before = v(b.x, 0, b.z), rawPrevious = {left:b.rawLeft || prevL, right:b.rawRight || prevR},previousHead={...b.head};
 b.walkContacts=[];b.pushing=false;
 b.stagger = Math.max(0, b.stagger - C.TICK * .55);
 const slow = (1 - b.stagger * .6), bound = C.GIANT_BOUND;
 if(room.bossClient && room.time - b.lastPose < .4 && !b.desktop){
  const d = rotateYaw(v(b.moveX || 0, 0, b.moveZ || 0), b.yaw), step = mul(len(d) > 1 ? norm(d) : d, C.GIANT_SPEED * C.TICK * slow);
  walkBoss(room, clamp(b.x + step.x, -bound, bound), clamp(b.z + step.z, -bound, bound));
  for(const key of ['head', 'left', 'right']) b[key] = {...b.target[key]};
  for(const side of ['left', 'right']) b[side + 'Quaternion'] = b.target[side + 'Quaternion'];
 }else if(room.bossClient && b.desktop){
  const i = room.time - b.lastInput < .45 ? b.input : noInput(); b.yaw = i.yaw;
  let dir = rotateYaw(v(i.x, 0, i.z), b.yaw); if(len(dir) > 1) dir = norm(dir); walkBoss(room, clamp(b.x + dir.x * C.GIANT_SPEED * C.TICK * slow, -bound, bound), clamp(b.z + dir.z * C.GIANT_SPEED * C.TICK * slow, -bound, bound));
  b.head = v(b.x, 23.8, b.z); let l = v(-5.6, 15.5, -4), r = v(5.6, 15.5, -4);
  if(i.fire){ const phase = room.time * 7, sweep = Math.sin(phase); r = v(6 * sweep, 10 + Math.cos(phase) * 5, -9 - Math.max(0, -Math.cos(phase)) * 5); }
  if(i.up > 0){ const t = Math.sin(room.time * 6); l = v(-5, 9 + t * 8, -9); r = v(5, 9 + t * 8, -9); }
  b.left = add(v(b.x, 0, b.z), rotateYaw(l, b.yaw)); b.right = add(v(b.x, 0, b.z), rotateYaw(r, b.yaw));
 }else if(!room.bossClient){
  // Clearly labelled practice/stand-in AI. It yields immediately when a headset joins.
  const theta = room.time * .12; b.x = Math.sin(theta) * 6; b.z = Math.cos(theta) * 6;
  const target = [...room.players.values()].find(p => p.body)?.body.translation();
  if(target) b.yaw = Math.atan2(b.x - target.x, b.z - target.z);
  b.head = v(b.x, 23.8 + Math.sin(room.time * .8) * .3, b.z);
  b.left = add(v(b.x, 0, b.z), rotateYaw(v(-5 + Math.sin(room.time * .7) * 7, 13 + Math.sin(room.time * 1.1) * 7, -7), b.yaw));
  b.right = add(v(b.x, 0, b.z), rotateYaw(v(5 + Math.sin(room.time * 1.25) * 9, 12 + Math.cos(room.time * 1.6) * 9, -8), b.yaw));
 }
 if(b.desktop || !room.bossClient) for(const side of ['left', 'right']) b[side + 'Quaternion'] = handQuaternion(null, b.yaw);
 if(room.bossClient && !b.desktop && room.time - b.lastPose < .4 && !b.resetPose){ for(const side of ['left', 'right']) if(b.triggers?.[side] && b.aims?.[side]) launchMissile(room, side, b.aims[side]); }
 if(room.bossClient && b.desktop && room.time - b.lastInput < .45 && b.input.missile) launchMissile(room, 'right', lookDir(b.yaw, b.input.pitch));
 const canAttack = (!room.bossClient || (b.desktop ? room.time - b.lastInput < .45 : room.time - b.lastPose < .4)) && !(room.time < b.noContactUntil);
 // Raiders cannot fly through the giant's torso/head as if they were non-solid visuals.
 for(const p of room.players.values()) if(canAttack && p.body){
  const at = p.body.translation();
  for(const [center, radius] of [[b.head, 2.55], [v(b.head.x, b.head.y - 7.2, b.head.z), 4.5]]){
   if(dist(at, center) < radius){ knockdown(room, p, add(mul(norm(sub(at, center)), 13), v(0, 5, 0)), 55, -1); break; }
  }
 }
  // Stale tracking holds hands still. Never extrapolate a disconnected punch.
  for(const [idx,key,prev] of [[0,'left',prevL],[1,'right',prevR]]){
   const hand=room.handBodies[idx];
   for(let i=0;i<hand.numColliders();i++)hand.collider(i).setEnabled(canAttack);
   const rotation=b[key+'Quaternion'],q={x:rotation[0],y:rotation[1],z:rotation[2],w:rotation[3]},raw={...b[key]};
   const previousRaw=rawPrevious[key],rawPrev=!b.desktop&&b.turnDelta?add(b.head,rotateYaw(sub(previousRaw,b.head),b.turnDelta)):previousRaw;
   const displacement=sub(raw,rawPrev),physical=sub(sub(raw,b.head),rotateYaw(sub(previousRaw,previousHead),b.turnDelta||0)),speed=Math.min(C.MAX_HAND_SPEED,len(physical)/C.TICK);
   b[idx?'rawRight':'rawLeft']=raw;
   if(b.resetPose||!canAttack){b.pressed[key]=false;hand.setTranslation(raw,true);hand.setRotation(q,true);hand.setNextKinematicTranslation(raw);hand.setNextKinematicRotation(q);continue;}
   const collisionPrev=!b.desktop&&b.turnDelta?add(b.head,rotateYaw(sub(prev,b.head),b.turnDelta)):prev;
   const contact=resolveHand(arr(prev),arr(raw),rotation,room.handWorld);b[key]=vec(contact.position);
   if(!b.desktop&&Math.abs(b.turnDelta||0)>.001)hand.setTranslation(speed>.2?collisionPrev:b[key],true);
   hand.setNextKinematicTranslation(b[key]);hand.setNextKinematicRotation(q);
   const stoppedDisplacement=sub(b[key],collisionPrev);
   for(const p of room.players.values())if(p.body&&!(b.turnDelta&&speed<.2)&&len(sub(mul(displacement,1/C.TICK),p.body.linvel()))>4){
    // Sweep the same oriented fist against the raider's actual capsule shape.
    const hit=p.body.collider(0).castShape(v(),new RAPIER.Cuboid(...GIANT.handHalf),collisionPrev,q,stoppedDisplacement,0,1,true);
    if(hit){const direction=speed>3?norm(displacement):norm(sub(p.body.translation(),b[key]));const kick=add(mul(direction,clamp(speed*.65,8,35)),v(0,6,0));knockdown(room,p,kick,25+speed*1.15,-1);}else if(speed>9&&segmentDistance(p.body.translation(),collisionPrev,b[key])<C.HAND_RADIUS+3.4&&room.time-p.closeCallAt>2.5&&!p.bot){p.closeCallAt=room.time;p.fuel=Math.min(1,p.fuel+.18);room.event({type:'closecall',player:p.id,p:arr(p.body.translation())});}
   }
   const blocked=dist(raw,b[key])>.025;
   if(!blocked)b.pressed[key]=false;else if(speed>.2)b.pressed[key]=true;
   if(contact.contacts.length&&b.pressed[key]&&speed>.75&&(!b.desktop||b.input.fire||b.input.up>0)){
    const hit=[],touched=new Set();
    for(const point of contact.contacts){const c=room.cellMap.get(point.cell);if(!c||touched.has(c.id)||room.detached.has(c.id)||room.time-c.lastHit<=C.HAND_CONTACT_INTERVAL)continue;touched.add(c.id);
     c.lastHit=room.time;
     const sides=sideBit(facingSide(c,point.point));
     if(damageCell(room,c,speed*.95+5,sides,0))hit.push(c.id);
     room.event({type:'strike',p:point.point,power:Math.max(.15,Math.min(1,speed/30)),material:c.material,broke:c.skin.hp<=0});
     if(hit.length>=5)break;
    }
    if(hit.length){breakCells(room,hit,mul(norm(displacement),Math.min(16,Math.max(2,speed*.28))),{at:b[key]});registerCombo(room,hit.length);}
   }
  }
 // A walking body chips a single contacted bay; it cannot grind its frame to failure.
 const moved = dist(v(b.x, 0, b.z), before) / C.TICK;
 if(canAttack && b.walkContacts?.length && room.time-(b.lastWalkChip || -10)>C.WALK_CHIP_INTERVAL){
  const c=b.walkContacts[0],hp=c.skin.hp; b.lastWalkChip=room.time;
  if(hp>c.skin.maxHp*.95){damageCell(room,c,C.WALK_CHIP,sideBit(facingSide(c,[b.x,8,b.z])),0);c.skin.hp=Math.max(c.skin.hp,c.skin.maxHp*.95);}
  room.event({type:'strike',p:[b.x,6,b.z],material:c.material,power:.08,broke:false});
 }
 b.stepDistance += moved * C.TICK;
 if(b.stepDistance > 7){ b.stepDistance = 0; room.event({type:'stomp', p:[b.x, 0, b.z]}); }
 b.resetPose = false; b.turnDelta = 0;
}
export function registerCombo(room, n){
 const b = room.boss;
 b.combo = room.time - b.comboAt < 2.6 ? b.combo + n : n; b.comboAt = room.time;
 if(b.combo >= 3) room.event({type:'combo', n:b.combo});
}

// Resolve each horizontal axis against intact structural bays at torso height. This
// lets the giant scrape along walls, while cleared bays become real walk-through gaps.
export function walkBoss(room,x,z){
 const b=room.boss,r=C.GIANT_BODY_RADIUS,contacts=new Map(),pos={x:b.x,z:b.z};
 const candidates=[];for(const bi of buildingsAlong(room,v(b.x,10,b.z),v(x,10,z),r+1))for(const c of room.cellsByBuilding[bi])if(!room.detached.has(c.id)&&c.p[1]-c.size[1]/2<19&&c.p[1]+c.size[1]/2>3)candidates.push(c);
 for(const [axis,target,k,other,j] of [['x',x,0,'z',2],['z',z,2,'x',0]]){
  const start=pos[axis],direction=Math.sign(target-start);if(!direction)continue;let end=target;
  for(const c of candidates){const min=c.p[k]-c.size[k]/2-r,max=c.p[k]+c.size[k]/2+r,sideMin=c.p[j]-c.size[j]/2-r,sideMax=c.p[j]+c.size[j]/2+r;
   if(pos[other]<=sideMin || pos[other]>=sideMax)continue;
   if(direction>0&&start<=min+.02&&end>min){end=min-.015;contacts.set(c.id,c);}
   if(direction<0&&start>=max-.02&&end<max){end=max+.015;contacts.set(c.id,c);}
  }pos[axis]=end;
 }
 b.x=pos.x;b.z=pos.z;b.walkContacts=[...contacts.values()].sort((a,c)=>Math.abs(a.p[1]-8)-Math.abs(c.p[1]-8));b.pushing=contacts.size>0;
}
