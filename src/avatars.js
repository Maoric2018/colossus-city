import * as T from 'three';
import {loadModel,bakedModel} from './assets.js';
import {TEAM_COLORS} from '../shared/config.js';
import {rounded,mesh,glow,coloredGeometry,up} from './art.js';
const metal=new T.MeshStandardMaterial({color:0x536978,metalness:.78,roughness:.34});
const dark=new T.MeshStandardMaterial({color:0x172b37,metalness:.68,roughness:.49});
const trim=new T.MeshStandardMaterial({color:0x9aada8,metalness:.82,roughness:.35});
const reactor=new T.MeshBasicMaterial({color:0xdfff97,toneMapped:false});
const cyan=new T.MeshBasicMaterial({color:0x83eeff,toneMapped:false});
const tmp=new T.Vector3();
function segment(parent,a,b,width,depth,material=metal){const g=new T.Group();parent.add(g);const armor=mesh(rounded(width,1,depth,.1),material,g),joint=mesh(new T.SphereGeometry(width*.5,10,8),dark,g);return {g,armor,joint,width,set(a,b){g.position.copy(a).add(b).multiplyScalar(.5);g.quaternion.setFromUnitVectors(up,tmp.copy(b).sub(a).normalize());this.armor.scale.y=a.distanceTo(b);this.joint.position.y=-a.distanceTo(b)*.5;}};}
export class GiantView{
 constructor(scene){
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
  mesh(new T.SphereGeometry(1.05,18,12),reactor,this.body,[0,.8,-2.05]);this.coreGlow=glow(this.body,0xbdff91,8,[0,.8,-2.5]);this.coreScale=8;
  mesh(rounded(3.7,3.9,3.15,.3),metal,this.head);
  mesh(rounded(3.12,1.6,.46,.1),dark,this.head,[0,-.15,-1.65]);
  mesh(rounded(2.88,.28,.18,.06),reactor,this.head,[0,.35,-1.95]);
  mesh(rounded(1.35,.38,.45,.08),trim,this.head,[0,-1.15,-1.69]);
  for(const s of [-1,1]){mesh(rounded(.48,2,2.6,.09),trim,this.head,[s*2,.35,.1]);mesh(rounded(.25,1.9,.5,.05),dark,this.head,[s*1.65,2.7,.7]);}
  this.eyeGlow=glow(this.head,0xbeff9e,5,[0,.35,-2.15]);
  this.arms=[-1,1].map(s=>({upper:segment(this.root,null,null,1.8,2),lower:segment(this.root,null,null,2.2,2.25),fist:this.fist()}));
  this.ready=this.loadArmor();
  this.legs=[-1,1].map(s=>({thigh:segment(this.root,null,null,2.3,2.5),shin:segment(this.root,null,null,2.1,2.35),foot:mesh(rounded(2.65,1.3,4,.15),dark,this.root)}));
 }
 async loadArmor(){
  try{
   const model=await loadModel('/assets/imported/mechs/colossus.glb');
   const replace=(parent,name,size)=>{const source=model.getObjectByName(name);if(!source)return;parent.traverse(o=>{if(o.isMesh)o.geometry.dispose();});parent.clear();const armor=new T.Mesh(source.geometry,source.material);armor.scale.set(...size);armor.castShadow=true;armor.receiveShadow=true;parent.add(armor);return armor;};
   replace(this.body,'body',[8.8,9.5,4.7]);replace(this.head,'head',[4.5,4.3,3.8]);
   // Weak points retain their exact gameplay positions and stay visible at a distance.
   mesh(new T.TorusGeometry(1.42,.18,8,24),dark,this.body,[0,.05,-2.38]);
   mesh(new T.SphereGeometry(1.08,16,10),reactor,this.body,[0,.05,-2.35]);this.coreGlow=glow(this.body,0xc3ff98,6,[0,.05,-2.95]);this.coreScale=6;
   this.eyeGlow=glow(this.head,0xc3ff98,1.2,[-1.13,.66,-1.98]);glow(this.head,0xc3ff98,1.2,[1.13,.66,-1.98]);
   for(const [i,side]of ['R','L'].entries()){
    const arm=this.arms[i],leg=this.legs[i];
    for(const [segment,name,width,depth]of [[arm.upper,'upper',2.7,2.8],[arm.lower,'lower',2.7,2.7],[leg.thigh,'thigh',2.8,3],[leg.shin,'shin',2.15,2.6]]){
     const replacement=replace(segment.g,name+side,[width,1,depth]);if(replacement){segment.armor=replacement;segment.joint=new T.Object3D();}
    }
    // The imported articulated fingers are closed around the tracked impact point.
    replace(arm.fist,'fist'+side,[2.9,2.5,2.8]);
   }
  }catch(error){console.error('Mech armor failed to load',error);}
 }
 fist(){const g=new T.Group();this.root.add(g);mesh(rounded(2.7,1.9,2.6,.25),metal,g);for(let i=0;i<4;i++)mesh(rounded(.53,.85,1.25,.12),trim,g,[(i-1.5)*.64,-.55,-.95]);mesh(rounded(.25,.3,2.2,.04),reactor,g,[1.38,.25,0]);return g;}
 update(s,{local=false,stagger=0}={}){
  const head=new T.Vector3(...s.head),q=new T.Quaternion().setFromAxisAngle(up,s.bossYaw||0);this.head.position.copy(head);this.head.quaternion.copy(q);this.head.visible=!local;
  const chest=head.clone().add(new T.Vector3(0,-7.2,0));this.body.position.copy(chest);this.body.quaternion.copy(q);
  // A staggered giant shudders and its core flares: the raiders' damage window is readable from afar.
  if(stagger>0){const t=performance.now()*.012;this.body.rotateX(Math.sin(t)*stagger*.06);this.body.rotateZ(Math.cos(t*1.3)*stagger*.05);}
  const pulse=stagger>.35?1.6+Math.sin(performance.now()*.02)*.5:1;this.coreGlow.scale.setScalar((this.coreScale||6)*pulse);
  [-1,1].forEach((sign,i)=>{
   const shoulder=new T.Vector3(sign*4.2,3.1,0).applyQuaternion(q).add(chest),hand=new T.Vector3(...(i?s.right:s.left));
   const center=shoulder.clone().lerp(hand,.47),bend=new T.Vector3(sign*1.5,-1,2).applyQuaternion(q);center.add(bend);
   this.arms[i].upper.set(shoulder,center);this.arms[i].lower.set(center,hand);this.arms[i].fist.position.copy(hand);this.arms[i].fist.quaternion.copy(q);if(s[i?'rightQuaternion':'leftQuaternion'])this.arms[i].fist.quaternion.fromArray(s[i?'rightQuaternion':'leftQuaternion']);
   const hip=new T.Vector3(sign*1.6,-4.3,0).applyQuaternion(q).add(chest),foot=new T.Vector3(sign*2.1,1,1.1).applyQuaternion(q);foot.x+=head.x;foot.z+=head.z;
   const knee=hip.clone().lerp(foot,.52).add(new T.Vector3(0,0,-1.3).applyQuaternion(q));this.legs[i].thigh.set(hip,knee);this.legs[i].shin.set(knee,foot);this.legs[i].foot.position.copy(foot);this.legs[i].foot.quaternion.copy(q);
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
export class RaiderView{
 constructor(scene,id){
  this.id=id;this.root=new T.Group();scene.add(this.root);const color=TEAM_COLORS[(id-1)%TEAM_COLORS.length];
  this.mesh=new T.Mesh(suitGeometry(color),new T.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.56}));this.mesh.castShadow=true;this.root.add(this.mesh);
  this.disposed=false;this.ready=bakedModel('/assets/imported/space-kit/astronautA.glb').then(model=>{
   if(this.disposed)return;this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();
   this.mesh=new T.Group();const scale=2.2/model.size.y;for(const part of model.parts){const m=new T.Mesh(part.geometry,part.material);m.scale.setScalar(scale);m.position.y=-1.15;m.castShadow=true;this.mesh.add(m);}this.root.add(this.mesh);this.imported=true;
  }).catch(error=>console.error('Raider model failed to load',error));
  this.jets=[-1,1].map(s=>glow(this.root,color,.9,[s*.27,-.21,.36]));this.color=color;
 }
 update(p,local=false,firstPerson=false){
  this.root.visible=!(p.flags&3)&&!(local&&firstPerson);this.root.position.set(...p.p);this.root.rotation.set(0,p.yaw,0);
  const speed=Math.hypot(p.v[0],p.v[2]);const target=p.flags&16?-Math.PI/2+(p.pitch||0):-Math.min(.4,speed*.018);this.mesh.rotation.x+=(target-this.mesh.rotation.x)*.2;this.mesh.rotation.z+=(Math.max(-.4,Math.min(.4,(p.v[0]*Math.cos(p.yaw)-p.v[2]*Math.sin(p.yaw))*.025))-this.mesh.rotation.z)*.15;
  for(const [index,j]of this.jets.entries()){j.position.set(index? .27:-.27,-.21,.36).applyAxisAngle(new T.Vector3(1,0,0),this.mesh.rotation.x);const on=(p.v[1]>1||speed>4)&&p.fuel>.01;j.visible=on;j.scale.setScalar((p.flags&32?2:p.flags&16?1.4:.8)+Math.sin(performance.now()*.06)*.2);}
 }
 dispose(){this.disposed=true;this.root.removeFromParent();if(!this.imported){this.mesh.geometry.dispose();this.mesh.material.dispose();}for(const j of this.jets)j.material.dispose();}
}
export class RagView{
 constructor(scene,part,player){this.id=part.id;this.mesh=new T.Mesh(rounded(...part.size,.05),new T.MeshStandardMaterial({color:part.size[0]>.5?TEAM_COLORS[(player-1)%TEAM_COLORS.length]:0x8b9fa7,roughness:.55,metalness:.4}));this.mesh.castShadow=true;scene.add(this.mesh);this.update(part.p,part.q);}
 update(p,q){this.mesh.position.set(...p);this.mesh.quaternion.set(...q);}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
