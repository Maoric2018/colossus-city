import {packEvents} from '../shared/event-codec.js';
const encoded=Symbol('encoded');
// A per-tick trie shares serialization across clients with identical reliable
// event histories, without hashing or stringifying the event contents first.
export class EventPackets{
 constructor(){this.formats=new Map();}
 get(events,format=0){
  let node=this.formats.get(format);if(!node)this.formats.set(format,node=new Map());
  for(const event of events){let next=node.get(event);if(!next)node.set(event,next=new Map());node=next;}
  if(!node.has(encoded))node.set(encoded,JSON.stringify({type:'events',...(format===1?{eventFormat:1}:{}),events:format===1?packEvents(events):events}));
  return node.get(encoded);
 }
}
