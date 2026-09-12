// Structural integrity: graph support (who still touches a foundation) plus a load model
// (who is carrying more than their columns can bear). Both are pure functions of the static
// cell table and mutable damage state, so server tests and tools can call them directly.
import {MATERIALS} from './materials.js';
import {C} from '../config.js';
// Return intact cells whose paths to all ground anchors were severed.
export function unsupportedCells(cells, detached){
 const byId = new Map(cells.map(c => [c.id, c])), supported = new Set(), todo = [];
 for(const c of cells) if(c.ground && !detached.has(c.id)){ supported.add(c.id); todo.push(c.id); }
 while(todo.length){ const id = todo.pop(); for(const n of byId.get(id).neighbors){ if(!detached.has(n) && !supported.has(n)){ supported.add(n); todo.push(n); } } }
 return cells.filter(c => !detached.has(c.id) && !supported.has(c.id)).map(c => c.id);
}
// Design capacity of one bay: it was built to carry its own stack with a material safety
// factor; structural damage (hpRatio) erodes that capacity.
export function capacity(c, hpRatio = 1){
 return (c.stackAbove + 1) * MATERIALS[c.material].safety * C.BUILDING_COHESION * Math.max(0, hpRatio);
}
// Load redistribution for one building. Weight flows down each stack; a bay whose support
// below is gone hangs from lateral neighbours (beam action) up to `span` bays away, splitting
// its load among the nearest still-supported bays on the same floor.
// Returns Map(cellId -> {carried, capacity}) for intact cells; cells past the span or with no
// lateral path are reported with capacity 0 (they must fail).
export function structuralLoads(cells, detached, hpRatio = () => 1, span = C.BUILDING_BRIDGE_SPAN){
 const byId = new Map(cells.map(c => [c.id, c])), result = new Map();
 const intact = id => id && !detached.has(id);
 const floors = new Map();
 for(const c of cells) if(intact(c.id)){ if(!floors.has(c.floor)) floors.set(c.floor, []); floors.get(c.floor).push(c); }
 const incoming = new Map(), carried = new Map();
 const levels = [...floors.keys()].sort((a, b) => b - a);
 for(const f of levels){
  const row = floors.get(f);
  for(const c of row) carried.set(c.id, 1 + (incoming.get(c.id) || 0));
  for(const c of row){
   if(c.ground || intact(c.below)) continue;
   // Hanging bay: BFS along intact lateral neighbours on this floor for supported bays.
   const seen = new Set([c.id]);
   let frontier = [c.id], targets = [], depth = 0;
   while(frontier.length && depth < span && !targets.length){
    const next = [];
    for(const id of frontier) for(const n of byId.get(id).lateral){
     if(!intact(n) || seen.has(n)) continue; seen.add(n);
     const cell = byId.get(n);
     if(cell.ground || intact(cell.below)) targets.push(cell); else next.push(n);
    }
    frontier = next; depth++;
   }
   const load = carried.get(c.id);
   if(!targets.length){ result.set(c.id, {carried:load, capacity:0}); continue; }
   for(const t of targets) carried.set(t.id, carried.get(t.id) + load / targets.length);
   result.set(c.id, {carried:load, capacity:capacity(c, hpRatio(c)) * 1.5});
  }
  for(const c of row){
   if(!result.has(c.id)) result.set(c.id, {carried:carried.get(c.id), capacity:capacity(c, hpRatio(c))});
   if(intact(c.below)) incoming.set(c.below, (incoming.get(c.below) || 0) + carried.get(c.id));
  }
 }
 return result;
}
export function overloadedCells(cells, detached, hpRatio, span){
 const loads = structuralLoads(cells, detached, hpRatio, span), out = [];
 for(const [id, {carried, capacity}] of loads) if(carried > capacity) out.push(id);
 return out;
}
