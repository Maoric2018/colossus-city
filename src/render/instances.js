// Keep GPU uploads inside the changed part of an instance buffer. Pending writes
// merge until Three uploads them, including multiple scene/capture passes.
export function markRange(attribute,index,count=1){
 const start=index*attribute.itemSize,end=start+count*attribute.itemSize,range=attribute.updateRanges[0];
 if(range){const lo=Math.min(start,range.start);range.count=Math.max(end,range.start+range.count)-lo;range.start=lo;}
 else attribute.addUpdateRange(start,end-start);
}
export function partialInstanceUpdates(mesh,dirty){
 const matrix=mesh.setMatrixAt,color=mesh.setColorAt;
 mesh.setMatrixAt=function(index,value){matrix.call(this,index,value);markRange(this.instanceMatrix,index);dirty.add(this);};
 mesh.setColorAt=function(index,value){color.call(this,index,value);markRange(this.instanceColor,index);dirty.add(this);};
 return mesh;
}
export function commitInstances(dirty){
 for(const mesh of dirty){if(mesh.instanceMatrix.updateRanges.length)mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor?.updateRanges.length)mesh.instanceColor.needsUpdate=true;}
 dirty.clear();
}
