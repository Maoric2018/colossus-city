import {generateCells} from '../../shared/city/cells.js';
import {componentPlacements} from '../../shared/city/components.js';
self.onmessage=({data:{id,env,interiors}})=>{
 try{const cells=generateCells(env);for(const c of cells)c.preparedComponents=componentPlacements(c,{interiors});self.postMessage({id,cells});}
 catch{self.postMessage({id,cells:null});}
};
