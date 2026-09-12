// Import maps apply to the page, but not to module workers. Both paths load the
// same installed Three version served by this project's /vendor route.
const types=await import(typeof WorkerGlobalScope!=='undefined'?'/vendor/three/build/three.module.js':'three');
export const {Color,Matrix4,Quaternion,Vector3,BufferGeometry,BufferAttribute,ShapeUtils,Vector2}=types;
