import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {carPlacements} from '../shared/props.js';
import {CAR_ID_START,carShape} from '../shared/cars.js';
import {GIANT} from '../shared/giant-rig.js';
import {C,group} from '../shared/config.js';
import {v,add,sub,mul,norm,len,arr,vec,clamp,dist,segmentAABB} from '../shared/math.js';
const G=C.COLLISION;
export function buildCars(room){
 room.cars=new Map();
 carPlacements(room.env).forEach((prop,i)=>{
  const id=CAR_ID_START+i,size=prop.size,mass=1200*(size[2]/3.9)**3;
  const p=add(vec(prop.position),v(0,size[1]/2,0)),body=room.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation({x:0,y:Math.sin(prop.yaw/2),z:0,w:Math.cos(prop.yaw/2)}).setLinearDamping(.45).setAngularDamping(.8).setCcdEnabled(true));
  const co=room.world.createCollider(RAPIER.ColliderDesc.cuboid(...carShape(size).half).setDensity(mass/(size[0]*size[1]*size[2])).setFriction(.65).setRestitution(.12).setCollisionGroups(group(G.DEBRIS)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
  room.colliderTags.set(co.handle,{car:id,prop:prop.id});body.sleep();
  room.cars.set(id,{id,prop:prop.id,asset:prop.asset,size,body,collider:co,hp:C.CAR_HP,wreck:false,sleeping:true,lastHit:-100,armed:false,explodedAt:-100,removed:false});
 });
}
export function carMeta(room,c){const p=c.body?.translation(),q=c.body?.rotation();return {type:'car-state',id:c.id,prop:c.prop,p:p?arr(p):[0,-100,0],q:q?[q.x,q.y,q.z,q.w]:[0,0,0,1],wreck:c.wreck,removed:c.removed,sleeping:c.body?.isSleeping()??true,burn:Math.max(0,6-(room.time-c.explodedAt))};}
export function damageCar(room,c,damage){
 if(!c?.body||c.wreck||damage<=0)return false;c.hp-=damage;
 if(c.hp>0)return false;
 room.world.invalidateSceneQueries();c.hp=0;c.wreck=true;c.explodedAt=room.time;c.armed=true;
 const shape=carShape(c.size,true);c.collider.setShape(new RAPIER.Cuboid(...shape.half));c.collider.setTranslationWrtParent(vec(shape.offset));c.collider.setFriction(.82);
 c.body.setLinvel(add(c.body.linvel(),v(0,3.5,0)),true);c.body.setAngvel(add(c.body.angvel(),v(.8,0,.55)),true);
 room.event({...carMeta(room,c),type:'car-explode'});return true;
}
function shove(room,c,direction,speed){
 if(!c.body||room.time-c.lastHit<C.CAR_HIT_INTERVAL)return;c.lastHit=room.time;c.armed=true;
 const push=norm(add(direction,v(0,.18,0))),dv=clamp(speed*.8,2.5,28);
 c.body.applyImpulse(mul(push,c.body.mass()*dv),true);c.body.applyTorqueImpulse(mul(v(push.z,.15,-push.x),c.body.mass()*.25*dv),true);
 damageCar(room,c,Math.max(0,speed-C.CAR_DAMAGE_SPEED)*7);
}
export function strikeCars(room,from,to,rotation,speed){
 if(speed<.3)return;const delta=sub(to,from),q={x:rotation[0],y:rotation[1],z:rotation[2],w:rotation[3]};
 for(const c of room.cars.values()){
  if(!c.body||dist(c.body.translation(),from)>len(delta)+8)continue;
  const hit=c.collider.castShape(v(),new RAPIER.Cuboid(...GIANT.handHalf),from,q,delta,0,1,true);
  if(hit)shove(room,c,len(delta)>.01?norm(delta):norm(sub(c.body.translation(),from)),speed);
 }
}
export function pushCarsWithBody(room,from,to,speed){
 if(speed<.3)return;const a=v(from.x,1.3,from.z),b=v(to.x,1.3,to.z),direction=norm(sub(b,a));
 for(const c of room.cars.values())if(c.body&&segmentAABB(a,b,c.body.translation(),vec(c.size.map(x=>x/2)),2.4))shove(room,c,direction,speed*1.3);
}
export function blastCars(room,at,radius){for(const c of room.cars.values())if(c.body){const d=dist(c.body.translation(),at);if(d<radius+c.size[2]/2){c.armed=true;c.body.applyImpulse(mul(norm(add(sub(c.body.translation(),at),v(0,2,0))),c.body.mass()*10),true);damageCar(room,c,C.CAR_HP);}}}
export function crashCar(room,id){const c=room.cars.get(id);if(c?.body&&c.armed&&c.preImpactSpeed>9&&room.time-c.lastHit>.3){c.lastHit=room.time;damageCar(room,c,(c.preImpactSpeed-5)*6);}}
export function updateCars(room){
 for(const c of room.cars.values()){
  if(!c.body)continue;
  if(c.body.translation().y<-35){room.colliderTags.delete(c.collider.handle);room.world.removeRigidBody(c.body);c.body=null;c.removed=true;room.event(carMeta(room,c));continue;}
  const lv=c.body.linvel(),speed=len(lv);if(speed>55)c.body.setLinvel(mul(lv,55/speed),true);
  const av=c.body.angvel(),spin=len(av);if(spin>9)c.body.setAngvel(mul(av,9/spin),true);
  const sleeping=c.body.isSleeping();if(sleeping!==c.sleeping){c.sleeping=sleeping;room.event(carMeta(room,c));}
 }
}
export function carSnapshots(room){return [...room.cars.values()].filter(c=>c.body&&!c.body.isSleeping()).map(c=>{const p=c.body.translation(),q=c.body.rotation();return {id:c.id,p:arr(p),q:[q.x,q.y,q.z,q.w]};});}
