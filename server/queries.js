// Rapier 0.17 World.step rebuilds the scene-query tree after every solver step.
// Contact physics uses its own broad phase. Refresh the ray/query tree only when
// gameplay asks for it, while invalidating it after movement or collider changes.
const queries=['castRay','castRayAndGetNormal','intersectionsWithRay','intersectionWithShape','projectPoint','projectPointAndGetFeature','intersectionsWithPoint','castShape','intersectionsWithShape','collidersWithAabbIntersecting'];
export function lazySceneQueries(world){
 let dirty=true;const refresh=world.updateSceneQueries.bind(world);
 world.invalidateSceneQueries=()=>{dirty=true;};
 world.updateSceneQueries=()=>{refresh();dirty=false;};
 for(const name of queries){if(typeof world[name]!=='function')continue;const query=world[name].bind(world);world[name]=(...args)=>{if(dirty)world.updateSceneQueries();return query(...args);};}
 for(const name of ['createRigidBody','createCollider','removeRigidBody','removeCollider']){const change=world[name].bind(world);world[name]=(...args)=>{
  if(name==='removeCollider')world.onColliderRemoved?.(args[0].handle);
  else if(name==='removeRigidBody'&&world.onColliderRemoved){const body=args[0];for(let i=0;i<body.numColliders();i++)world.onColliderRemoved(body.collider(i).handle);}
  dirty=true;return change(...args);
 };}
 world.step=(events,hooks)=>{
  world.physicsPipeline.step(world.gravity,world.integrationParameters,world.islands,world.broadPhase,world.narrowPhase,world.bodies,world.colliders,world.impulseJoints,world.multibodyJoints,world.ccdSolver,events,hooks);
  dirty=true;
 };
 return world;
}
