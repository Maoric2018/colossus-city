import * as T from 'three';
const direction=new T.Vector3(),pole=new T.Vector3(),back=new T.Vector3();
// Rigid two-link arm. Out-of-range tracking extends a mechanical piston rather
// than stretching textured armor or moving the controller's impact point.
export function armElbow(shoulder,hand,bodyRotation,side,upper=6,lower=6){
 direction.copy(hand).sub(shoulder);const distance=direction.length();
 if(distance<1e-6)direction.set(0,-1,0).applyQuaternion(bodyRotation);else direction.divideScalar(distance);
 pole.set(side,.05,1.3).applyQuaternion(bodyRotation);pole.addScaledVector(direction,-pole.dot(direction));
 if(pole.lengthSq()<1e-6){back.set(0,1,0).applyQuaternion(bodyRotation);pole.copy(back).addScaledVector(direction,-back.dot(direction));}
 pole.normalize();const reach=Math.max(.001,Math.min(distance,upper+lower)),along=(upper*upper-lower*lower+reach*reach)/(2*reach),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
 return shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,bend);
}
