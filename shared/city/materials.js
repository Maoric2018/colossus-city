// Facade material table shared by server damage rules and client rendering.
// Every exterior wall has up to two skin layers (glass, facade) over a steel/concrete frame.
// glassHP/facadeHP are the impact energies that break a layer; frameHP is the structural
// hit budget of one bay at the roof (lower floors scale up via frameScale in cells.js).
export const MATERIALS = Object.freeze({
 glass:    {label:'CURTAIN WALL', glassHP:8,  facadeHP:0,  frameHP:80,  safety:2.5, shards:'glass',    haptic:.35, tint:0x8fc9e6, lit:.55},
 concrete: {label:'CONCRETE',     glassHP:6,  facadeHP:55, frameHP:95,  safety:2.3, shards:'concrete', haptic:.6,  tint:0xb9b6ad, lit:.4},
 stone:    {label:'LIMESTONE',    glassHP:6,  facadeHP:75, frameHP:110, safety:2.4, shards:'stone',    haptic:.7,  tint:0xd8cdb4, lit:.35},
 brick:    {label:'BRICK',        glassHP:5,  facadeHP:40, frameHP:65,  safety:2.1, shards:'brick',    haptic:.5,  tint:0x9c5a48, lit:.45}
});
export const MATERIAL_NAMES = Object.keys(MATERIALS);
export const SIDES = ['n','e','s','w'];
// Bitmask helpers for the four exterior sides of a bay (n=1,e=2,s=4,w=8).
export const sideBit = side => 1 << side;
export const ALL_SIDES = 15;
// A wall blocks movement while its solid layer is intact: the facade for masonry/concrete,
// the glass itself for a curtain wall (which has no facade layer).
export function wallSolid(material, glassMask, facadeMask, side){
 const m = MATERIALS[material];
 return m.facadeHP > 0 ? !!(facadeMask & sideBit(side)) : !!(glassMask & sideBit(side));
}
