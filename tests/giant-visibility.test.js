import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SelfBodyVisibility} from '../src/giant-visibility.js';
test('local self-body fading cannot alter the material shared with arms or another robot',()=>{
 const source=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(),leg=new T.Mesh(geometry,source),hand=new T.Mesh(geometry,source),other=new T.Mesh(geometry,source),fade=new SelfBodyVisibility();fade.register(leg);fade.register(leg);
 for(let i=0;i<80;i++)fade.update({local:true,lookDown:.95});
 assert.equal(fade.materials.size,1);assert.notEqual(leg.material,source);assert.ok(fade.opacity<=.181);assert.equal(leg.material.opacity,fade.opacity);assert.ok(leg.material.transparent);assert.equal(leg.material.depthWrite,false);
 for(const part of [hand,other]){assert.equal(part.material.opacity,1);assert.equal(part.material.transparent,false);assert.equal(part.material.depthWrite,true);}
 fade.update({local:false,lookDown:1});assert.equal(fade.opacity,1);assert.equal(leg.material.opacity,1);assert.equal(leg.material.transparent,false);assert.equal(leg.material.depthWrite,true);
 geometry.dispose();source.dispose();leg.material.dispose();
});
test('looking down fades gradually at the same rate across frame rates, and looking up restores opacity',()=>{
 const a=new SelfBodyVisibility(),b=new SelfBodyVisibility();a.update({local:true,lookDown:.2});assert.equal(a.opacity,1);
 a.update({local:true,lookDown:1});assert.ok(a.opacity>.8&&a.opacity<1);a.update({local:false});
 for(const [fade,fps]of [[a,30],[b,144]])for(let i=0;i<fps*.5;i++)fade.update({local:true,lookDown:.7,dt:1/fps});assert.ok(Math.abs(a.opacity-b.opacity)<1e-8);assert.ok(a.opacity>.18&&a.opacity<.5);
 for(let i=0;i<100;i++)a.update({local:true,lookDown:-.4});assert.equal(a.opacity,1);
});
