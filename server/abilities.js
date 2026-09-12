import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {C,group} from '../shared/config.js';
import {v,add,sub,mul,len,norm,dist,arr,vec,clamp,rotateYaw,lookDir} from '../shared/math.js';
const G=C.COLLISION;
export function fly(room,p,i){
 const at=p.body.translation(),lv=p.body.linvel();
 let movement=i.world?v(i.x,0,i.z):rotateYaw(v(i.x,0,i.z),i.yaw);if(len(movement)>1)movement=norm(movement);
 p.soaring=!!i.soar&&p.fuel>(p.soaring?.005:.16)&&at.y>2;
 if(i.dodge>p.lastDodgeSeq){
  p.lastDodgeSeq=i.dodge;
  if(room.time>=p.dodgeReady&&p.fuel>=C.DODGE_FUEL){
   let dir=rotateYaw(v(i.x,i.up,i.z),i.yaw);if(len(dir)<.1)dir=lookDir(i.yaw,p.soaring?i.pitch:0);
   p.dodgeDirection=norm(dir);p.dodgeUntil=room.time+C.DODGE_SECONDS;p.dodgeReady=room.time+C.DODGE_COOLDOWN;p.fuel-=C.DODGE_FUEL;
   room.event({type:'dodge',player:p.id,p:arr(at),direction:arr(p.dodgeDirection)});
  }
 }
 const boosted=i.boost&&p.fuel>.02,air=i.up>0&&p.fuel>0;
 let desired=mul(movement,boosted?C.BOOST_SPEED:C.PLAYER_SPEED);
 desired.y=air?C.ASCEND_SPEED*i.up:i.up<0?-10:at.y>2?-2.3:lv.y;
 if(p.soaring){
  const aim=lookDir(i.yaw,clamp(i.pitch,-1,1)),strafe=rotateYaw(v(i.x*.4,i.up*.3,0),i.yaw),speed=(boosted?C.SOAR_BOOST_SPEED:C.SOAR_SPEED)*(i.z>0?.55:1);
  desired=mul(norm(add(aim,strafe)),speed);
 }
 const dodging=room.time<p.dodgeUntil;
 const a=1-Math.exp(-C.TICK*(p.soaring?4.5:6)),av=air||at.y>2?.12:0;
 let velocity=dodging?mul(p.dodgeDirection,C.DODGE_SPEED):v(lv.x+(desired.x-lv.x)*a,lv.y+(desired.y-lv.y)*(p.soaring?a:av),lv.z+(desired.z-lv.z)*a);
 if(Math.hypot(at.x,at.z)>C.ARENA_RADIUS){velocity.x-=at.x*.04;velocity.z-=at.z*.04;}
 if(at.y>C.MAX_ALTITUDE)velocity.y=Math.min(velocity.y,-4);
 p.fuel=clamp(p.fuel+((p.soaring?-(boosted?.14:.065):(air||boosted)?-.14:(at.y<2?.48:.16)))*C.TICK,0,1);
 p.body.setLinvel(velocity,true);
 // Rotate the capsule with the prone pilot, keeping visible and physical bodies aligned.
 const halfPitch=p.soaring?(-Math.PI/2+clamp(i.pitch,-1,1))/2:0,sy=Math.sin(i.yaw/2),cy=Math.cos(i.yaw/2),sx=Math.sin(halfPitch),cx=Math.cos(halfPitch);
 p.body.collider(0).setRotation({x:cy*sx,y:sy*cx,z:-sy*sx,w:cy*cx});
}
export function launchMissile(room,side,aim){
 const b=room.boss;if(room.phase||room.time<b.missileReady||room.missiles.size>=C.MAX_MISSILES)return false;
 const direction=norm(aim),origin=add(b[side],mul(direction,C.HAND_RADIUS+.5)),id=room.nextMissile++;
 const missile={id,p:origin,origin:arr(origin),direction:arr(direction),born:room.time,life:C.MISSILE_LIFETIME};
 room.missiles.set(id,missile);b.missileReady=room.time+C.MISSILE_COOLDOWN;room.event({type:'missile',...missile,p:arr(origin)});return true;
}
export function updateMissiles(room){
 for(const [id,m]of room.missiles){
  const direction=vec(m.direction),travel=C.MISSILE_SPEED*C.TICK;let distance=travel,hit=room.time-m.born>=m.life;
  const obstruction=room.world.castRay(new RAPIER.Ray(m.p,direction),travel,true,undefined,group(G.WORLD,G.WORLD|G.DEBRIS|G.PLAYER));
  if(obstruction){distance=obstruction.timeOfImpact??obstruction.toi;hit=true;}
  // Querying the shape world above catches buildings and moving raiders at high speed.
  m.p=add(m.p,mul(direction,distance));
  if(m.p.y<0||Math.hypot(m.p.x,m.p.z)>190)hit=true;
  if(!hit)continue;
  room.missiles.delete(id);room.event({type:'detonate',id,p:arr(m.p)});
  for(const p of room.players.values())if(p.body&&room.time>=p.invulnerable){
   const at=p.body.translation(),d=dist(at,m.p);if(d>C.MISSILE_RADIUS)continue;
   const toward=norm(sub(at,m.p)),wall=room.world.castRay(new RAPIER.Ray(add(m.p,mul(toward,.08)),toward),Math.max(0,d-.45),true,undefined,group(G.GIANT,G.WORLD|G.DEBRIS));
   if(wall)continue;room.knockdown(p,add(mul(toward,16*(1-d/C.MISSILE_RADIUS)),v(0,5,0)),85*(1-d/(C.MISSILE_RADIUS*1.25)));
  }
  const cells=room.cells.filter(c=>!room.detached.has(c.id)&&dist(vec(c.p),m.p)<C.MISSILE_RADIUS+1.5).sort((a,b)=>dist(vec(a.p),m.p)-dist(vec(b.p),m.p)).slice(0,5);
  if(cells.length)room.breakCells(cells.map(c=>c.id),mul(direction,12));
 }
}
