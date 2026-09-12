import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {Room,physicsReady} from '../server/room.js';
import {v,len} from '../shared/math.js';
import {C} from '../shared/config.js';
import {Prediction} from '../src/app/prediction.js';
import {flightRotation} from '../shared/flight.js';
import {soarBreachCells,flightHalf} from '../shared/soar-breach.js';
import {box} from '../shared/giant-rig.js';
await physicsReady;
const socket={send(){},readyState:1};
function setup(){
 const r=new Room('ABC123');r.attach(socket,'boss','giant');const client=r.attach(socket,'raider','pilot'),p=r.players.get(client.id),bounds=r.buildingBounds[5],cell=r.cellsByBuilding[5].find(c=>c.floor===3&&c.walls[2]);
 r.spawn(p,v(cell.p[0],cell.p[1],bounds[5]+5));p.invulnerable=0;p.body.setLinvel(v(0,0,-32),true);return {r,client,p,bounds,cell};
}
function tick(r,client,input){r.input(client,{type:'input',yaw:0,pitch:.07,z:-1,...input});r.step();}
test('soaring opens both sides of a building, keeps speed and health, and replicates persistent rubble',()=>{
 const {r,client,p,bounds}=setup();try{
  for(let i=0;i<45;i++){tick(r,client,{soar:true});const actual=p.body.collider(0).rotation(),expected=flightRotation(p,p.input);assert.ok(Math.abs(actual.x-expected.x)<.00001,'The prone collider rotation survives the physics step');}
  assert.ok(p.body&&p.body.translation().z<bounds[2]-3,'pilot exits the far wall');assert.equal(p.hp,100);assert.ok(len(p.body.linvel())>28);
  const broken=r.cellsByBuilding[5].filter(c=>c.skin.parts?.length);assert.equal(broken.length,2,'only the two directly struck wall bays break');
  for(const c of broken){assert.equal(c.lastHitBy,p.id);assert.ok([...r.shards.values()].some(e=>e.cell===c.id));assert.ok(!r.detached.has(c.id),'Only the flight corridor breaks');}
  const events=r.drainEvents();assert.ok(events.some(e=>e.type==='soar-breach'&&e.player===p.id));assert.ok(events.some(e=>e.type==='fracture'));
  const late=r.welcome({id:99,role:'spectator'});for(const c of broken){assert.ok(late.shards.some(e=>e.cell===c.id));assert.ok(late.fractures.some(s=>s[0]===c.id));}
  for(let i=0;i<65;i++)tick(r,client,{soar:false,z:0});assert.equal(p.breachCells.size,0);r.spawn(p);assert.equal(p.breachCells.size,0);
 }finally{r.dispose();}
});
test('normal flight, normal dodge, exhausted fuel and stale soar input cannot breach',()=>{
 for(const mode of ['normal','dodge','empty','stale']){
  const {r,client,p}=setup();try{
   if(mode==='empty')p.fuel=0;
   if(mode==='stale'){r.input(client,{type:'input',soar:true,z:-1,yaw:0,pitch:0});r.time+=.5;}
   for(let i=0;i<30;i++){if(mode==='stale')r.step();else tick(r,client,{soar:mode==='empty',dodge:mode==='dodge'?1:0});}
   assert.equal(r.detached.size,0,mode);assert.equal(p.breachCells.size,0);assert.ok(!r.drainEvents().some(e=>e.type==='soar-breach'));
  }finally{r.dispose();}
 }
});
test('holding soar against a wall from rest can start a breach',()=>{
 const {r,client,p,bounds,cell}=setup();try{
  p.body.setTranslation(v(cell.p[0],cell.p[1],bounds[5]+.6),true);p.body.setLinvel(v(),true);
  for(let i=0;i<65;i++)tick(r,client,{soar:true});assert.ok(p.body&&p.body.translation().z<bounds[2]-2);assert.equal(p.hp,100);assert.ok(r.cells.some(c=>c.skin.parts?.length));
 }finally{r.dispose();}
});
test('breaching works in generated blocks and its holes survive unloading and reloading',()=>{
 const {r,client,p}=setup();try{
  const tile=r.stream.load(9,7),cell=tile.cells.find(c=>c.floor===2&&c.walls[2]),bounds=r.buildingBounds[cell.building];r.spawn(p,v(cell.p[0],cell.p[1],bounds[5]+3));p.body.setLinvel(v(0,0,-32),true);p.invulnerable=0;
  for(let i=0;i<60&&p.body&&p.body.translation().z>bounds[2]-2;i++)tick(r,client,{soar:true});
  assert.ok(p.body&&p.body.translation().z<bounds[2]-2);const broken=tile.cells.filter(c=>c.skin.parts?.length);assert.ok(broken.length>0);
  // Directly breached bays lose their skins; connected fragments may fall with
  // intact cladding. Both must reload their exact original state.
  assert.ok(broken.some(c=>c.skin.parts.length>0));const saved=broken.map(c=>[c.id,structuredClone(c.skin)]);r.stream.unload(tile.key);r.stream.load(9,7);for(const [id,skin]of saved){assert.deepEqual(r.cellMap.get(id).skin,skin);}
 }finally{r.dispose();}
});
test('breach grace filters only the owning pilot and expires in real Rapier contacts',()=>{
 const {r,client,p,cell}=setup();try{
  tick(r,client,{soar:true});r.breakCells([cell.id],v());const e=r.debris.get(cell.entity);e.body.setBodyType(RAPIER.RigidBodyType.Fixed,true);const at=e.body.translation();
  const other=r.attach(socket,'raider','other'),p2=r.players.get(other.id);r.spawn(p,at);r.spawn(p2,at);p.breachCells.set(cell.id,r.time+C.SOAR_DEBRIS_GRACE);
  const contact=pilot=>{let count=0;r.world.contactPair(pilot.body.collider(0),e.body.collider(0),m=>count+=m.numContacts());return count;};
  r.world.step(r.queue,r.physicsHooks);assert.equal(contact(p),0);assert.ok(contact(p2)>0,'other pilot still collides');
  r.time+=C.SOAR_DEBRIS_GRACE+.01;p.body.setTranslation(at,true);r.world.step(r.queue,r.physicsHooks);assert.ok(contact(p)>0,'owner collides after grace');
 }finally{r.dispose();}
});
test('continuous sweep catches thin walls at speed, respects solid props and ignores existing rubble',()=>{
 const state={soaring:true},from=v(0,10,0),velocity=v(0,0,-48),input={yaw:0,pitch:0},wall=box([0,10,-1.5],[2,2,.02],undefined,12),far=box([0,10,-2],[2,2,.02],undefined,13);
 assert.deepEqual(soarBreachCells(state,from,velocity,input,{*near(){yield wall;yield far;}}),[12,13]);
 const prop=box([0,10,-.9],[2,2,.02]);assert.deepEqual(soarBreachCells(state,from,velocity,input,{*near(){yield wall;yield prop;}}),[]);
 assert.deepEqual(soarBreachCells(state,from,velocity,input,{*near(){yield {...wall,debris:true};yield far;}}),[]);
 const half=flightHalf(state,input);assert.ok(half.y<.37&&half.z>1.1);assert.deepEqual(soarBreachCells({soaring:false},from,velocity,input,{*near(){yield wall;}}),[]);
});
test('prediction crosses only swept building cells while leaving unrelated collision active',()=>{
 const wall=box([0,10,-1.5],[2,2,.02],undefined,12);let skipped=false;
 const city={handWorld:{*near(){yield wall;}},overlapBox(p,half,ignored){skipped=!!ignored?.has(12);return skipped?null:{center:v(0,10,-1.5),half:v(2,2,.02)};}},prediction=new Prediction(city);
 prediction.reset({p:[0,10,0],v:[0,0,-32],fuel:1});prediction.simulate({yaw:0,pitch:0,soar:true,z:-1,up:0,x:0,dodge:0});assert.ok(skipped);assert.ok(prediction.vel.z<-25);
 prediction.reset({p:[0,10,0],v:[0,0,-32],fuel:1});prediction.simulate({yaw:0,pitch:0,soar:false,z:-1,up:0,x:0,dodge:0});assert.equal(skipped,false);
});
