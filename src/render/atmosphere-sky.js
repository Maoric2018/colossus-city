// Shared by the sky dome and distant surfaces: at full extinction they must
// produce the same pixel, including cloud detail above the horizon.
export const atmosphereSkyGLSL=`
 vec3 citySkyRadiance(sampler2D panorama,vec3 direction,vec3 horizon,float rotation,float intensity){
  float c=cos(rotation),s=sin(rotation);
  vec3 sampleDirection=vec3(c*direction.x-s*direction.z,direction.y,s*direction.x+c*direction.z);
  vec3 sky=texture2D(panorama,equirectUv(sampleDirection)).rgb*intensity;
  // Broad daylight scattering, cooler away from the sun, warmer toward it.
  float sun=pow(max(dot(direction,normalize(vec3(-.6,.25,-.5))),0.),8.);
  vec3 air=mix(horizon*vec3(.9,1.,1.05),vec3(.87,.82,.70),sun*.28);
  return mix(air,sky,smoothstep(-.025,.20,direction.y));
 }
`;
