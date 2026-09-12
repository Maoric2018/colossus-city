import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const up=new T.Vector3(0,1,0), dummy=new T.Object3D();
export const rounded=(x=1,y=1,z=1,r=.09)=>new RoundedBoxGeometry(x,y,z,2,Math.min(r,x/3,y/3,z/3));
export function mesh(g,m,parent,p=[0,0,0],s){const o=new T.Mesh(g,m);o.position.set(...p);if(s)o.scale.set(...s);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(g,s,p,m){return mesh(new T.BoxGeometry(...s),m,g,p);}
export function mergeParts(parts){return mergeGeometries(parts.map(([g,p=[0,0,0],r=[0,0,0],s=[1,1,1]])=>{
 const geo=g.index?g.toNonIndexed():g.clone();dummy.position.set(...p);dummy.rotation.set(...r);dummy.scale.set(...s);dummy.updateMatrix();geo.applyMatrix4(dummy.matrix);return geo;
}),false);}
export function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,255,255,.65)');g.addColorStop(.4,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
export const glowMap=glowTexture();
export function glow(parent,color,size,p=[0,0,0]){const s=new T.Sprite(new T.SpriteMaterial({map:glowMap,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.position.set(...p);s.scale.setScalar(size);parent.add(s);return s;}
export function labelTexture(text,{bg='#09202b',fg='#c9efdc',w=512,h=128}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font=`bold ${Math.floor(h*.34)}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2,w*.92);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
}
export function coloredGeometry(parts){
 const gs=parts.map(({g,p=[0,0,0],r=[0,0,0],color=0xffffff})=>{const a=g.index?g.toNonIndexed():g.clone();dummy.position.set(...p);dummy.rotation.set(...r);dummy.scale.setScalar(1);dummy.updateMatrix();a.applyMatrix4(dummy.matrix);const c=new T.Color(color),colors=new Float32Array(a.attributes.position.count*3);for(let j=0;j<colors.length;j+=3)c.toArray(colors,j);a.setAttribute('color',new T.BufferAttribute(colors,3));return a;});return mergeGeometries(gs,false);
}
