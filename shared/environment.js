// Facade over shared/city/*. Server and clients import the same active environment here.
// Register a new district in shared/city/layout.js and change this ONE selection.
import {midtown} from './city/layout.js';
export {generateCells, cellColliders, initialSkin, facingSide, exteriorMask} from './city/cells.js';
export {unsupportedCells, structuralLoads, overloadedCells, capacity} from './city/structure.js';
export {MATERIALS, SIDES, sideBit, ALL_SIDES, wallSolid} from './city/materials.js';
export {buildingFootprint, buildingHeight} from './city/layout.js';
export const city = midtown;
export const environments = {midtown};
export const activeEnvironment = environments.midtown;
