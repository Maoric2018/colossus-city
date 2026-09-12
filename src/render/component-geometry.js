import * as T from 'three';
// Keep the kit declarative and shared; only this adapter knows about Three.js.
export function componentGeometry(part){
 let geometry;
 if(part.shape==='loft'){
  const positions=[],uvs=[],faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
  for(const f of faces)for(const i of [0,1,2,0,2,3]){positions.push(...part.corners[f[i]]);uvs.push(...[[0,0],[1,0],[1,1],[0,1]][i]);}
  geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
 }
 else if(part.shape==='polygon'){
  const path=points=>{const p=new T.Shape();p.moveTo(...points[0]);for(const v of points.slice(1))p.lineTo(...v);p.closePath();return p;};
  const shape=path(part.points);for(const points of part.holes||[])shape.holes.push(path(points));
  geometry=new T.ExtrudeGeometry(shape,{depth:part.s[2],bevelEnabled:false,steps:1,curveSegments:12}).translate(0,0,-part.s[2]/2);
 }
 else if(part.shape==='cone'||part.shape==='cylinder')geometry= new T.CylinderGeometry(part.shape==='cone'?0:.5,.5,1,part.segments||8,1,!!part.open).scale(...part.s);
 else geometry=new T.BoxGeometry(...part.s);
 if(part.arch){
  if(part.shape==='polygon'&&!part.coarse){const coarse=geometry;geometry=subdivide(coarse);coarse.dispose();}
  const {radius,base,height}=part.arch,local=new T.Matrix4().compose(new T.Vector3(...part.p),new T.Quaternion().setFromEuler(new T.Euler(...part.r)),new T.Vector3(1,1,1));
  geometry.applyMatrix4(local);const points=geometry.attributes.position;
  for(let i=0;i<points.count;i++){const t=T.MathUtils.clamp((points.getY(i)-base)/height,0,1);points.setZ(i,points.getZ(i)+radius*(1-Math.sqrt(1-t*t)));}
  geometry.applyMatrix4(local.invert());geometry.computeVertexNormals();
 }
 return geometry;
}

// Subdivide large shell faces before bending: warped long triangles otherwise fold
// across the triangular windows. Small trim and ordinary city parts stay untouched.
function subdivide(geometry){
 const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,uv=g.attributes.uv,positions=[],coords=[];
 const midpoint=(a,b)=>a.map((n,i)=>(n+b[i])/2),distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
 const triangle=(a,b,c,depth=0)=>{
  const lengths=[distance(a,b),distance(b,c),distance(c,a)],max=Math.max(...lengths);
  if(max>.075&&depth<8){const i=lengths.indexOf(max);if(i===0){const m=midpoint(a,b);triangle(a,m,c,depth+1);triangle(m,b,c,depth+1);}else if(i===1){const m=midpoint(b,c);triangle(a,b,m,depth+1);triangle(a,m,c,depth+1);}else{const m=midpoint(c,a);triangle(a,b,m,depth+1);triangle(m,b,c,depth+1);}return;}
  for(const v of [a,b,c]){positions.push(...v.slice(0,3));coords.push(...v.slice(3));}
 };
 const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)];
 for(let i=0;i<p.count;i+=3)triangle(vertex(i),vertex(i+1),vertex(i+2));
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('uv',new T.Float32BufferAttribute(coords,2));result.computeVertexNormals();if(g!==geometry)g.dispose();return result;
}
