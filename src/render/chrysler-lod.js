import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHRYSLER_COMPONENTS} from '../../shared/city/chrysler.js';
import {componentGeometry} from './component-geometry.js';
// One instanced draw preserves the landmark's crown outside detailed city chunks.
export function chryslerLODGeometry(){
 const geometries=[],matrix=new T.Matrix4(),rotation=new T.Matrix4(),v=new T.Vector3(),q=new T.Quaternion(),one=new T.Vector3(1,1,1);
 for(const type of ['CrownShell','CrownWindows','CrownDecks','SpireCollar','Spire']){
  const spec=CHRYSLER_COMPONENTS['chrysler'+type],color=new T.Color(type==='CrownWindows'?0x162f3e:0xdde7eb),sides=['CrownShell','CrownWindows'].includes(type)?4:1;
  for(let side=0;side<sides;side++)for(const part of spec.parts){
   const original=componentGeometry({...part,coarse:true}),g=original.index?original.toNonIndexed():original;
   matrix.compose(v.set(...part.p),q.setFromEuler(new T.Euler(...part.r)),one);rotation.makeRotationY(-side*Math.PI/2);g.applyMatrix4(matrix).applyMatrix4(rotation);
   const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)color.toArray(colors,i);g.setAttribute('color',new T.BufferAttribute(colors,3));geometries.push(g);if(g!==original)original.dispose();
  }
 }
 const result=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();return result;
}
