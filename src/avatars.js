import * as T from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {raiderParts} from '../shared/raider-rig.js';
import {raiderPose} from '../shared/raider-pose.js';
import {armElbow} from './arm-rig.js';
import {SelfBodyVisibility} from './giant-visibility.js';
import {GIANT,handQuaternion,resolveHand} from '../shared/giant-rig.js';
import {resolveBreakableHand,handSurfaceKey} from '../shared/hand-break.js';
import {loadModel,bakedModel} from './assets.js';
import {surfaceMap,ensureSurfaceUV} from './render/surface-art.js';
import {TEAM_COLORS} from '../shared/config.js';
import {rounded,mesh,glow,coloredGeometry,up} from './art.js';
const metal=new T.MeshStandardMaterial({color:0x536978,metalness:.78,roughness:.34});
const dark=new T.MeshStandardMaterial({color:0x172b37,metalness:.68,roughness:.49});
const trim=new T.MeshStandardMaterial({color:0x9aada8,metalness:.82,roughness:.35});
const reactor=new T.MeshBasicMaterial({color:0xdfff97,toneMapped:false});
const cyan=new T.MeshBasicMaterial({color:0x83eeff,toneMapped:false});
const tmp=new T.Vector3(),frameInverse=new T.Quaternion(),swing=new T.Quaternion();
function segment(parent,a,b,width,depth,material=metal){const g=new T.Group();parent.add(g);const armor=mesh(rounded(width,1,depth,.1),material,g),joint=mesh(new T.SphereGeometry(width*.5,10,8),dark,g);return {g,armor,joint,width,set(a,b,bodyRotation){
 g.position.copy(a).add(b).multiplyScalar(.5);
 if(this.rigidLength){const direction=tmp.copy(b).sub(a).normalize();g.position.copy(this.anchorEnd?b:a).addScaledVector(direction,(this.anchorEnd?-1:1)*this.rigidLength/2);}
 // Solve the limb's swing in body space, then carry it into the world. A
 // world-up shortest arc reaches the endpoints but introduces unwanted twist
 // when the whole tracked rig yaws (especially for nearly downward arms).
 frameInverse.copy(bodyRotation).invert();tmp.copy(b).sub(a).normalize().applyQuaternion(frameInverse);
 g.quaternion.copy(bodyRotation).multiply(swing.setFromUnitVectors(up,tmp));
 this.armor.scale.y=this.rigidLength||a.distanceTo(b);this.joint.position.y=-(this.rigidLength||a.distanceTo(b))*.5;
}};}
export class GiantView{
 constructor(scene){
  for(const material of [metal,dark,trim]){material.map=surfaceMap('armor');material.needsUpdate=true;}
  this.selfBody=new SelfBodyVisibility();
  this.root=new T.Group();scene.add(this.root);this.body=new T.Group();this.head=new T.Group();this.root.add(this.body,this.head);
  const torso=new T.Shape();torso.moveTo(-3.1,4);torso.lineTo(3.1,4);torso.lineTo(3.8,2);torso.lineTo(2.25,-3.5);torso.lineTo(-2.25,-3.5);torso.lineTo(-3.8,2);torso.closePath();
  const tg=new T.ExtrudeGeometry(torso,{depth:3.3,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.3,bevelThickness:.22});tg.translate(0,0,-1.65);mesh(tg,metal,this.body);
  mesh(rounded(3.3,2,3,.2),dark,this.body,[0,-4.5,0]);
  for(const s of [-1,1]){
   const plate=mesh(rounded(1.9,4.5,.7,.18),trim,this.body,[s*2.5,1,-1.72]);plate.rotation.z=-s*.2;
   mesh(rounded(.16,3.3,.1,.03),reactor,this.body,[s*2.2,.5,-2.13]);
   mesh(rounded(2.2,1.6,3,.24),metal,this.body,[s*4,3.5,0]);
  }
  mesh(new T.CylinderGeometry(1.2,1.5,1.6,12),dark,this.body,[0,5,0]);
  mesh(new T.TorusGeometry(1.65,.23,8,32),dark,this.body,[0,.8,-1.95]);
  mesh(new T.TorusGeometry(1.38,.065,6,32),reactor,this.body,[0,.8,-2.19]);
  mesh(new T.SphereGeometry(1.05,18,12),reactor,this.body,[0,.8,-2.05]);this.coreGlow=glow(this.body,0xbdff91,8,[0,.8,-2.5]);
  mesh(rounded(3.7,3.9,3.15,.3),metal,this.head);
  mesh(rounded(3.12,1.6,.46,.1),dark,this.head,[0,-.15,-1.65]);
  mesh(rounded(2.88,.28,.18,.06),reactor,this.head,[0,.35,-1.95]);
  mesh(rounded(1.35,.38,.45,.08),trim,this.head,[0,-1.15,-1.69]);
  for(const s of [-1,1]){mesh(rounded(.48,2,2.6,.09),trim,this.head,[s*2,.35,.1]);mesh(rounded(.25,1.9,.5,.05),dark,this.head,[s*1.65,2.7,.7]);}
  this.eyeGlow=glow(this.head,0xbeff9e,5,[0,.35,-2.15]);
  this.arms=[-1,1].map(s=>({upper:segment(this.root,null,null,1.8,2),lower:segment(this.root,null,null,2.2,2.25),fist:this.fist()}));
  for(const arm of this.arms){arm.upper.rigidLength=GIANT.upperLength;arm.lower.rigidLength=GIANT.lowerLength;arm.lower.anchorEnd=true;arm.wrist=mesh(new T.SphereGeometry(.65,12,8),dark,this.root);arm.shoulder=mesh(new T.SphereGeometry(1.15,12,8),dark,this.root);arm.cuff=mesh(new T.CylinderGeometry(.56,.65,1.55,12),trim,arm.fist,[0,0,2.125]);arm.cuff.rotation.x=Math.PI/2;arm.elbow=mesh(new T.SphereGeometry(1.05,12,8),dark,this.root);arm.piston=mesh(new T.CylinderGeometry(.5,.5,1,10),trim,this.root);}
  this.ready=this.loadArmor();
  this.legs=[-1,1].map(s=>({thigh:segment(this.root,null,null,2.3,2.5),shin:segment(this.root,null,null,2.1,2.35),hip:mesh(new T.SphereGeometry(.95,12,8),dark,this.root),knee:mesh(new T.SphereGeometry(.85,12,8),dark,this.root),ankle:mesh(new T.SphereGeometry(.7,12,8),dark,this.root),foot:mesh(rounded(2.65,1.3,4,.15),dark,this.root)}));
  this.registerSelfBody();
 }
 registerSelfBody(){this.selfBody.register(this.body);for(const leg of this.legs)for(const part of [leg.thigh.g,leg.shin.g,leg.hip,leg.knee,leg.ankle,leg.foot])this.selfBody.register(part);}
 async loadArmor(){
  try{
   const model=await loadModel('/assets/imported/mechs/colossus.glb?v=89cc8138');
   const replace=(parent,name,size)=>{const source=model.getObjectByName(name);if(!source)return;parent.traverse(o=>{if(o.isMesh)o.geometry.dispose();});parent.clear();const armor=new T.Mesh(source.geometry,source.material);armor.scale.set(...size);armor.castShadow=true;armor.receiveShadow=true;parent.add(armor);return armor;};
   replace(this.body,'body',GIANT.bodySize);replace(this.head,'head',GIANT.headSize);
   mesh(new T.CylinderGeometry(.9,1.05,.9,12),dark,this.body,[0,5.02,0]);
   // Weak points retain their exact gameplay positions and stay visible at a distance.
   mesh(new T.TorusGeometry(1.42,.18,8,24),dark,this.body,[0,.05,-2.38]);
   mesh(new T.SphereGeometry(1.08,16,10),reactor,this.body,[0,.05,-2.35]);this.coreGlow=glow(this.body,0xc3ff98,6,[0,.05,-2.95]);
   this.eyeGlow=glow(this.head,0xc3ff98,1.2,[-1.13,.66,-1.98]);glow(this.head,0xc3ff98,1.2,[1.13,.66,-1.98]);
   for(const [i,side]of ['L','R'].entries()){
    const arm=this.arms[i],leg=this.legs[i];
    for(const [segment,name,width,depth]of [[arm.upper,'upper',2.7,2.8],[arm.lower,'lower',2.7,2.7],[leg.thigh,'thigh',2.8,3],[leg.shin,'shin',2.15,2.6]]){
     const replacement=replace(segment.g,name+side,[width,1,depth]);if(replacement){segment.armor=replacement;segment.joint=new T.Object3D();}
    }
    // The imported articulated fingers are closed around the tracked impact point.
    replace(arm.fist,'fist'+side,GIANT.handSize);arm.cuff=mesh(new T.CylinderGeometry(.56,.65,1.55,12),trim,arm.fist,[0,0,2.125]);arm.cuff.rotation.x=Math.PI/2;
   }
   this.registerSelfBody();
  }catch(error){console.error('Mech armor failed to load',error);}
 }
 fist(){const g=new T.Group();this.root.add(g);mesh(rounded(2.7,1.9,2.6,.25),metal,g);for(let i=0;i<4;i++)mesh(rounded(.53,.85,1.25,.12),trim,g,[(i-1.5)*.64,-.55,-.95]);mesh(rounded(.25,.3,2.2,.04),reactor,g,[1.38,.25,0]);return g;}
 update(s,{local=false,collisionWorld=null,stagger=0}={}){
  if(!local)this.selfBody.update();
  const head=new T.Vector3(...s.head),q=new T.Quaternion().setFromAxisAngle(up,s.bossYaw||0);this.head.position.copy(head);this.head.quaternion.copy(q);this.head.visible=!local;
  // The decorative halo is for other players. From inside the giant it can
  // cover the pilot's view when looking down or leaning toward the reactor.
  this.coreGlow.visible=!local; this.coreGlow.scale.setScalar(6*(stagger>.35?1.6+Math.sin(performance.now()*.02)*.5:1));
  const chest=head.clone().add(new T.Vector3(0,-GIANT.chestDrop,0));this.body.position.copy(chest);this.body.quaternion.copy(q);
  [-1,1].forEach((sign,i)=>{
   const arm=this.arms[i],side=i?'right':'left',rotation=handQuaternion(s[side+'Quaternion'],s.bossYaw||0),target=s[side];
   const now=performance.now(),claims=arm.breakClaims??=new Map();
   for(const [key,until] of claims)if(until<=now)claims.delete(key);
   if(s.resetHands||!collisionWorld)claims.clear();
   let contact={position:target,contacts:[]};
   if(collisionWorld&&!s.resetHands){
    const from=arm.lastHand||target;
    contact=s.handVelocity?resolveBreakableHand(from,target,rotation,collisionWorld,s.handVelocity[side],hit=>{
     claims.set(handSurfaceKey(hit),now+200);return true;
    },new Set(claims.keys())):resolveHand(from,target,rotation,collisionWorld);
   }
   if(contact.broken?.length)contact.contacts.push(...contact.broken);
   const hand=new T.Vector3(...contact.position);arm.lastHand=contact.position;arm.contacts=contact.contacts;
   arm.fist.position.copy(hand);arm.fist.quaternion.fromArray(rotation);
   // A controller tracks the palm. The forearm attaches behind it at the wrist,
   // never at the palm center or at the tips of the fingers.
   const wrist=new T.Vector3(...GIANT.wrist).applyQuaternion(arm.fist.quaternion).add(hand),shoulder=new T.Vector3(sign*GIANT.shoulder[0],GIANT.shoulder[1],0).applyQuaternion(q).add(chest);
   arm.wrist.position.copy(wrist);arm.shoulder.position.copy(shoulder);
   const center=armElbow(shoulder,wrist,q,sign,GIANT.upperLength,GIANT.lowerLength);arm.elbow.position.copy(center);
   const reach=center.distanceTo(wrist),extension=Math.max(0,reach-arm.lower.rigidLength);arm.piston.visible=extension>.02;
   if(arm.piston.visible){const direction=wrist.clone().sub(center).normalize();arm.piston.position.copy(center).addScaledVector(direction,extension/2);arm.piston.quaternion.setFromUnitVectors(up,direction);arm.piston.scale.set(1,extension+.2,1);}
   arm.upper.set(shoulder,center,q);arm.lower.set(center,wrist,q);
   const hip=new T.Vector3(sign*1.6,-4.3,0).applyQuaternion(q).add(chest),foot=new T.Vector3(sign*2.1,1,-.65).applyQuaternion(q);foot.x+=head.x;foot.z+=head.z;
   const ankle=foot.clone().add(new T.Vector3(0,.55,.65).applyQuaternion(q)),leg=this.legs[i];leg.hip.position.copy(hip);leg.ankle.position.copy(ankle);
   const knee=hip.clone().lerp(ankle,.52).add(new T.Vector3(0,0,-1.3).applyQuaternion(q));this.legs[i].thigh.set(hip,knee,q);this.legs[i].shin.set(knee,ankle,q);leg.knee.position.copy(knee);this.legs[i].foot.position.copy(foot);this.legs[i].foot.quaternion.copy(q);
  });
 }
}
function suitGeometry(color){
 const parts=[
  {g:rounded(.52,.36,.32,.06),p:[0,0,0],color:0x334454},
  {g:rounded(.62,.42,.34,.08),p:[0,.38,0],color:0xb1c1c6},
  {g:new T.SphereGeometry(.245,12,8),p:[0,.82,0],color:0xd1d9d2},
  {g:rounded(.4,.2,.1,.04),p:[0,.84,-.2],color:0x1d4a59},
  {g:rounded(.38,.095,.06,.02),p:[0,.97,-.23],color},
  {g:rounded(.45,.52,.25,.06),p:[0,.29,.32],color:0x354c5d},
  ...[-1,1].flatMap(s=>[
   {g:rounded(.24,.44,.24,.045),p:[s*.48,.35,0],r:[0,0,s*-.25],color:0x82979f},
   {g:rounded(.22,.4,.22,.035),p:[s*.57,-.05,0],color:0x526777},
   {g:rounded(.27,.5,.29,.04),p:[s*.18,-.42,0],color:0x7c909a},
   {g:rounded(.24,.45,.26,.04),p:[s*.18,-.91,0],color:0x425569},
   {g:rounded(.25,.14,.37,.035),p:[s*.18,-1.17,-.06],color:0x233b49},
   {g:new T.CylinderGeometry(.11,.13,.38,8),p:[s*.27,.16,.34],color},
   {g:rounded(.04,.24,.045,.01),p:[s*.26,.41,-.195],color}
  ])
 ];return coloredGeometry(parts);
}
function flightPack(parent,offset=new T.Vector3()){
 const pack=new T.Group();pack.position.set(0,.28,.27).sub(offset);parent.add(pack);mesh(rounded(.32,.4,.18,.04),dark,pack);
 pack.thrusters=[];
 for(const sign of [-1,1]){const nozzle=new T.Group();nozzle.position.set(sign*.25,-.07,.05);pack.add(nozzle);pack.thrusters.push(nozzle);mesh(new T.CylinderGeometry(.095,.13,.48,10),metal,nozzle);mesh(new T.CylinderGeometry(.065,.065,.05,10),cyan,nozzle,[0,-.26,0]);}return pack;
}
function equipRifle(parent,rifle,mount,offset=new T.Vector3()){
 return rifle.parts.map(part=>{const material=part.material.clone();if(!material.map){material.map=surfaceMap('metal');ensureSurfaceUV(part.geometry,1.5);}material.color.set(0x587486);material.metalness=.6;const gun=new T.Mesh(part.geometry,material);gun.scale.setScalar(1.2);gun.position.fromArray(mount).add(new T.Vector3(0,-1.25,-.13)).sub(offset);gun.castShadow=true;parent.add(gun);return material;});
}
// Prepare the one shared bind-pose model before either live or ragdoll clones.
function raiderModel(){return loadModel('/assets/imported/raider/armored-ragdoll.glb').then(model=>{
 if(!model.userData.surfaceArt){model.traverse(o=>{if(o.isSkinnedMesh){ensureSurfaceUV(o.geometry,.9);for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.map){m.map=surfaceMap('armor');m.roughness=.48;m.needsUpdate=true;}}});model.userData.surfaceArt=true;}return model;
});}
export class RaiderView{
 constructor(scene,id){
  this.id=id;this.weaponMaterials=[];this.root=new T.Group();scene.add(this.root);const color=TEAM_COLORS[(id-1)%TEAM_COLORS.length];
  this.mesh=new T.Mesh(suitGeometry(color),new T.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.56}));this.mesh.castShadow=true;this.root.add(this.mesh);
  this.flight={blend:0,dodge:0,time:0};this.disposed=false;this.ready=Promise.all([raiderModel(),bakedModel('/assets/imported/space-kit/weapon_rifle.glb')]).then(([source,rifle])=>{
   if(this.disposed)return;this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();
   this.mesh=cloneSkeleton(source);this.mesh.traverse(part=>{if(part.isSkinnedMesh){this.skin=part;part.castShadow=true;part.frustumCulled=false;}});
   this.bones=new Map(this.skin.skeleton.bones.map(b=>[b.name.replace('rag_',''),b]));
   this.pack=flightPack(this.bones.get('chest'),new T.Vector3(...raiderParts.find(p=>p.name==='chest').o));
   this.weaponMaterials=equipRifle(this.bones.get('lowerR'),rifle,this.skin.userData.weaponMount,new T.Vector3(...raiderParts.find(p=>p.name==='lowerR').o));
   for(const jet of this.jets){jet.material.dispose();jet.removeFromParent();}
   this.jets=this.pack.thrusters.map(nozzle=>glow(nozzle,color,.9,[0,-.4,0]));
   this.root.add(this.mesh);this.imported=true;
  }).catch(error=>console.error('Raider model failed to load',error));
  this.jets=[-1,1].map(s=>glow(this.root,color,.9,[s*.27,-.21,.36]));this.color=color;
 }
 update(p,local=false,firstPerson=false,dt=1/60,time=null){
  this.root.visible=!(p.flags&3)&&!(local&&firstPerson);this.root.position.set(...p.p);this.root.rotation.set(0,p.yaw,0);
  const speed=Math.hypot(p.v[0],p.v[2]),k=1-Math.exp(-Math.min(dt,.1)*9),flight=this.flight;
  flight.time=time??flight.time+dt;flight.blend+=((p.flags&16?1:0)-flight.blend)*k;flight.dodge+=((p.flags&32?1:0)-flight.dodge)*k;
  const target=-(1-flight.blend)*Math.min(.4,speed*.018)+flight.blend*(-Math.PI/2+(p.pitch||0));this.mesh.rotation.x=target;
  const bank=Math.max(-.4,Math.min(.4,(p.v[0]*Math.cos(p.yaw)-p.v[2]*Math.sin(p.yaw))*.025));this.mesh.rotation.z+=(bank-this.mesh.rotation.z)*k;
  this.pose=raiderPose({soar:flight.blend,time:flight.time,id:this.id,bank:this.mesh.rotation.z,dodge:flight.dodge});
  if(this.bones)for(const [i,part]of raiderParts.entries()){const bone=this.bones.get(part.name);bone.position.fromArray(this.pose[i].p);bone.quaternion.fromArray(this.pose[i].q);}
  for(const [index,j]of this.jets.entries()){if(!this.imported)j.position.set(index?.27:-.27,-.21,.36).applyAxisAngle(tmp.set(0,0,1),this.mesh.rotation.z).applyAxisAngle(tmp.set(1,0,0),this.mesh.rotation.x);const on=(p.v[1]>1||speed>4)&&p.fuel>.01;j.visible=on;j.scale.setScalar(.8+flight.blend*.6+flight.dodge*.6+Math.sin(flight.time*38+index)*.12);}
  for(const [i,nozzle]of (this.pack?.thrusters||[]).entries()){nozzle.rotation.x=flight.blend*(.1+Math.sin(flight.time*3.8+i)*.04);nozzle.rotation.z=-this.mesh.rotation.z*.4+(i?1:-1)*flight.dodge*.18;}
 }
 dispose(){this.disposed=true;this.root.removeFromParent();if(!this.imported){this.mesh.geometry.dispose();this.mesh.material.dispose();}this.pack?.traverse(o=>{if(o.isMesh)o.geometry.dispose();});for(const material of this.weaponMaterials)material.dispose();for(const j of this.jets)j.material.dispose();this.skin?.skeleton.dispose();}
}
export class RagView{
 constructor(scene,rag){
  this.root=new T.Group();scene.add(this.root);this.parts=new Map(rag.parts.map(p=>[p.id,{...p}]));this.weaponMaterials=[];
  this.ready=Promise.all([raiderModel(),bakedModel('/assets/imported/space-kit/weapon_rifle.glb')]).then(([source,rifle])=>{
   if(this.disposed)return;const model=cloneSkeleton(source);this.root.add(model);model.traverse(o=>{if(o.isSkinnedMesh){this.skin=o;o.castShadow=true;o.frustumCulled=false;}});
   this.bones=new Map(this.skin.skeleton.bones.map(b=>[b.name.replace('rag_',''),b]));
   this.pack=flightPack(this.bones.get('chest'),new T.Vector3(...raiderParts.find(p=>p.name==='chest').o));
   this.weaponMaterials=equipRifle(this.bones.get('lowerR'),rifle,this.skin.userData.weaponMount,new T.Vector3(...raiderParts.find(p=>p.name==='lowerR').o));
   for(const [id,p]of this.parts)this.update(id,p.p,p.q);
  }).catch(error=>console.error('Raider ragdoll failed to load',error));
 }
 update(id,p,q){const part=this.parts.get(id);if(!part)return;part.p=p;part.q=q;const bone=this.bones?.get(part.name);if(bone){bone.position.fromArray(p);bone.quaternion.fromArray(q);}}
 remove(id){this.parts.delete(id);if(!this.parts.size)this.dispose();}
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.pack?.traverse(o=>o.geometry?.dispose());for(const material of this.weaponMaterials)material.dispose();this.skin?.skeleton.dispose();}
}
