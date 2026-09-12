// Raider weapons, knockdowns and ragdolls. Server-authoritative; clients only draw the results.
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {handRay} from '../shared/giant-rig.js';
import {raiderParts, raiderLinks, raiderGear} from '../shared/raider-rig.js';
import {raiderPose,composeRotation} from '../shared/raider-pose.js';
import {C, group} from '../shared/config.js';
import {v, add, sub, mul, arr, vec, clamp, quatYaw, quatEuler, rotateYaw, raySphere, lookDir} from '../shared/math.js';
import {damageCell, damageSphere, removeBody, resolveCell, contactFromTag, bodyPose} from './destruction.js';
import {sideBit} from '../shared/city/materials.js';
const G = C.COLLISION;
function giantTargets(b){
 return [[b.head, C.HEAD_RADIUS, 1.8], [v(b.head.x, b.head.y - 7.2, b.head.z), 4.1, 1]];
}
export function shoot(room, p, heavy = false){
 if(!p.body || p.hp <= 0) return;
 const origin = add(p.body.translation(), v(0, .5, 0)), direction = lookDir(p.input.aimYaw ?? p.input.yaw, p.input.aimPitch ?? p.input.pitch), b = room.boss;
 let distance = heavy ? C.HEAVY_RANGE : C.SHOT_RANGE, damage = 0, weak = false;
 for(const [center, radius, mult] of giantTargets(b)){
  const t = raySphere(origin, direction, center, radius); if(t < distance){ distance = t; damage = (heavy ? C.HEAVY_DAMAGE : C.SHOT_DAMAGE) * mult; weak = mult > 1; }
 }
 for(const side of ['left','right']){const t=handRay(arr(origin),arr(direction),arr(b[side]),b[side+'Quaternion'],distance);if(t<distance){distance=t;damage=(heavy?C.HEAVY_DAMAGE:C.SHOT_DAMAGE)*.55;weak=false;}}
 room.stream?.ensureRay(origin,add(origin,mul(direction,distance)));
 const obstruction = room.world.castRayAndGetNormal(new RAPIER.Ray(origin, direction), distance, true, undefined, group(G.PLAYER, G.WORLD | G.DEBRIS));
 let structure = false;
 if(obstruction){
  distance = obstruction.timeOfImpact ?? obstruction.toi; damage = 0; weak = false;
  const at=add(origin,mul(direction,distance)),tag=room.colliderTags.get(obstruction.collider.handle),c=resolveCell(room,tag,at);
  if(c && !room.detached.has(c.id)){
   const contact=contactFromTag(tag),side=contact.side==null?0:sideBit(contact.side);
   if(heavy){structure=true;damageSphere(room,at,2.4,C.HEAVY_STRUCTURE,p.id,6);room.event({type:'impact',p:arr(at),power:.5,material:c.material});}
   else damageCell(room,c,6,side,p.id,contact);

  }
 }
 if(damage){
  // A staggered giant has its core exposed: teamwork (breach or falling debris) opens a damage window.
  damage *= 1 + b.stagger * .6; if(p.bot) damage *= .26;
  room.hurtBoss(damage, {kind:heavy ? 'heavy' : 'shot', p:arr(add(origin, mul(direction, distance))), power:heavy ? .6 : .08, by:p.id}); p.damage += damage; p.score += damage;
 }
 room.event({type:heavy ? 'heavy' : 'shot', player:p.id, from:arr(origin), to:arr(add(origin, mul(direction, distance))), hit:damage > 0, impact:!!obstruction || damage > 0, normal:obstruction ? arr(obstruction.normal) : arr(mul(direction,-1)), weak, structure});
}
export function knockdown(room, p, kick, damage, by = 0){
 if(!p.body || room.time < p.invulnerable) return;
 p.hp = Math.max(0, p.hp - damage);
 const at = p.body.translation(), flightVelocity = p.body.linvel(), velocity = add(flightVelocity, kick);
 removeBody(room, p.body); p.body = null;
 const rag = makeRag(room, p, at, velocity, flightVelocity); p.rag = rag.id; p.recoverAt = room.time + 2.1;
 if(p.hp <= 0){ p.deadUntil = room.time + C.RESPAWN_SECONDS; room.kills++; room.event({type:'kill', player:p.id, by}); }
 room.event({type:'impact', p:arr(at), power:.45, material:'body'});
}
export function makeRag(room, p, at, velocity, flightVelocity = v()){
  if(room.rags.size>=C.MAX_RAGDOLLS){const candidate=[...room.rags.values()].find(r=>![...room.players.values()].some(p=>p.rag===r.id));if(candidate)room.removeRag(candidate.id);}
  const defs=raiderParts,yaw=p.input.yaw||0,speed=Math.hypot(flightVelocity.x,flightVelocity.z),tilt=p.soaring?-Math.PI/2+(p.input.pitch||0):-Math.min(.4,speed*.018),bank=clamp((flightVelocity.x*Math.cos(yaw)-flightVelocity.z*Math.sin(yaw))*.025,-.4,.4);
  // Match the live pilot's yaw * flight lean * bank, including prone knockdowns.
  const local=quatEuler(tilt,0,bank),sy=Math.sin(yaw/2),cy=Math.cos(yaw/2),q={x:cy*local.x+sy*local.z,y:cy*local.y+sy*local.w,z:cy*local.z-sy*local.x,w:cy*local.w-sy*local.y};
  const rotate=p=>{const t=v(2*(q.y*p.z-q.z*p.y),2*(q.z*p.x-q.x*p.z),2*(q.x*p.y-q.y*p.x));return v(p.x+q.w*t.x+q.y*t.z-q.z*t.y,p.y+q.w*t.y+q.z*t.x-q.x*t.z,p.z+q.w*t.z+q.x*t.y-q.y*t.x);};
  const pose=raiderPose({soar:p.soaring?1:0,time:room.time,id:p.id,bank,dodge:room.time<p.dodgeUntil?1:0});
  const parts=defs.map((d,i)=>{
   const pos=add(at,rotate(vec(pose[i].p))),rotation=composeRotation([q.x,q.y,q.z,q.w],pose[i].q);
   const body=room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation({x:rotation[0],y:rotation[1],z:rotation[2],w:rotation[3]}).setLinearDamping(.12).setAngularDamping(.6).setCcdEnabled(true));
   room.world.createCollider(RAPIER.ColliderDesc.cuboid(d.s[0]/2,d.s[1]/2,d.s[2]/2).setMass(i===1?22:i===0?14:5).setFriction(.65).setRestitution(.04).setCollisionGroups(group(G.RAGDOLL,G.WORLD|G.DEBRIS|G.GIANT)),body);
   for(const gear of raiderGear.filter(g=>g.part===d.name)){const o=sub(vec(gear.o),vec(d.o));room.world.createCollider(RAPIER.ColliderDesc.cuboid(...gear.s.map(v=>v/2)).setTranslation(o.x,o.y,o.z).setDensity(0).setFriction(.65).setCollisionGroups(group(G.RAGDOLL,G.WORLD|G.DEBRIS|G.GIANT)),body);}
   body.setLinvel(velocity,true);body.setAngvel(v(velocity.z*.14,0,-velocity.x*.14),true);
   return {id:room.nextRag++,name:d.name,body,size:d.s,offset:d.o};
  });
  for(const {a,b,anchor,hinge,axis} of raiderLinks){
   const aa=sub(vec(anchor),vec(defs[a].o)),ab=sub(vec(anchor),vec(defs[b].o));
   const params=hinge?RAPIER.JointData.revolute(aa,ab,vec(axis)):RAPIER.JointData.spherical(aa,ab);
   const joint=room.world.createImpulseJoint(params,parts[a].body,parts[b].body,true);if(hinge)joint.setLimits(-.15,2.2);
  }
  const rag={id:parts[0].id,player:p.id,parts,born:room.time};room.rags.set(rag.id,rag);room.event(room.ragMeta(rag));return rag;
 }
export function ragMeta(r){ return {type:'rag',id:r.id,player:r.player,parts:r.parts.map(p=>({id:p.id,name:p.name,size:p.size,...bodyPose(p.body)}))};}
export function removeRag(room, id){
 const r = room.rags.get(id); if(!r) return;
 for(const part of r.parts){ removeBody(room, part.body); room.event({type:'remove', id:part.id}); }
 room.rags.delete(id);
}
export {damageSphere, clamp};
