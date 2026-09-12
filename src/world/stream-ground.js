import * as T from 'three';
import {STREET,SIDEWALK_HALF} from '../../shared/streets.js';
import {blockAt} from '../../shared/city/layout.js';
import {streetMaterial} from './street-material.js';

// A single road surface spans home and streamed districts. World-space UVs stay
// fixed when this plane and the small sidewalk pool move to the next block.
export function streamGround(root,tier,textures){
 const mesh=new T.Mesh(new T.PlaneGeometry(2000,2000),streetMaterial(tier,textures));mesh.rotation.x=-Math.PI/2;mesh.position.y=.001;mesh.receiveShadow=true;mesh.name='city-road-surface';root.add(mesh);
 const sidewalks=new T.InstancedMesh(new T.BoxGeometry(...SIDEWALK_HALF.map(v=>v*2)),streetMaterial(tier,textures,true),25);
 sidewalks.name='city-sidewalks';sidewalks.receiveShadow=true;sidewalks.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(sidewalks);
 const matrix=new T.Matrix4();let key='';
 const update=p=>{
  const [cx,cz]=blockAt(p.x,p.z),next=`${cx},${cz}`;if(key===next)return;key=next;
  mesh.position.x=cx*STREET.block;mesh.position.z=cz*STREET.block;
  let index=0;for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++)sidewalks.setMatrixAt(index++,matrix.makeTranslation(x*STREET.block,STREET.curb/2,z*STREET.block));
  sidewalks.instanceMatrix.needsUpdate=true;sidewalks.computeBoundingSphere();
 };
 update({x:0,z:0});return {mesh,sidewalks,update};
}
