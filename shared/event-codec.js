// Lossless JSON event packing. Room events and welcome state retain their public
// objects; only clients advertising eventFormat:1 receive this wire representation.
const shardFields=['id','cell','pieces','origin','p','q','half','material','born','velocity','settled','ballistic','start','ground','duration'];
const known=new Set(['type',...shardFields]);
export function packIds(ids){
 const runs=[];for(let i=0;i<ids.length;){const start=ids[i++];let count=1;while(i<ids.length&&ids[i]===start+count){i++;count++;}runs.push(start,count);}
 return runs.length<ids.length?{runs}:ids;
}
export function unpackIds(ids){if(Array.isArray(ids))return ids;const out=[];for(let i=0;i<ids.runs.length;i+=2)for(let n=0;n<ids.runs[i+1];n++)out.push(ids.runs[i]+n);return out;}
export function packEvents(events){
 const out=[];let batch;
 for(const event of events){
  if(event.type==='shards'&&Object.keys(event).every(key=>known.has(key))){
   if(!batch){batch={type:'shard-batch',rows:[]};out.push(batch);}const row=[0];
   shardFields.forEach((key,i)=>{if(event[key]!==undefined){row[0]|=1<<i;row.push(key==='pieces'?packIds(event[key]):event[key]);}});batch.rows.push(row);
  }else{batch=null;out.push(event.type==='fracture'?{...event,parts:packIds(event.parts)}:event);}
 }return out;
}
export function unpackEvents(events){
 const out=[];for(const event of events){
  if(event.type==='shard-batch')for(const row of event.rows){const e={type:'shards'};let at=1;shardFields.forEach((key,i)=>{if(row[0]&(1<<i))e[key]=key==='pieces'?unpackIds(row[at++]):row[at++];});out.push(e);}
  else out.push(event.type==='fracture'?{...event,parts:unpackIds(event.parts)}:event);
 }return out;
}
