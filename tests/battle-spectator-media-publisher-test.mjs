import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {setImmediate as settle} from 'node:timers/promises';

const source = await readFile(new URL('../battle-spectator-media-publisher.js', import.meta.url), 'utf8');
const tracks = ['video', 'audio'].map(kind => ({kind, readyState:'live', enabled:true,
  stop(){this.readyState='ended';}}));
const rooms=[], timers=[], events={};
let admitted=true, requests=0, failPublish=false;
// Models the pinned LiveKit 2.15.6 Room engine-disconnect behavior:
// handleDisconnect(options.stopLocalTrackOnUnpublish), default true.
class Room {
  constructor(options){
    this.options=options; this.handlers={}; this.closed=false; rooms.push(this);
    this.localParticipant={trackPublications:new Map(),
      publishTrack:async track=>{
        assert.equal(this.closed,false,'never publish into a disconnected room');
        if(failPublish && track.kind==='audio')throw Error('publish failed');
        this.localParticipant.trackPublications.set(track.kind,{track:{mediaStreamTrack:track}});
      },
      unpublishTrack:async (track,stop=true)=>{
        if(stop)track.mediaStreamTrack.stop();
        this.localParticipant.trackPublications.delete(track.mediaStreamTrack.kind);
      }};
  }
  on(event,fn){this.handlers[event]=fn;return this;}
  async connect(){this.closed=false;}
  async disconnect(stop=true){
    for(const pub of [...this.localParticipant.trackPublications.values()])await this.localParticipant.unpublishTrack(pub.track,stop);
    this.closed=true;this.handlers.disconnected?.();
  }
  async removeParticipant(){await this.disconnect(this.options.stopLocalTrackOnUnpublish ?? true);}
}
const context={currentMatch:{id:'match',host_id:'host',guest_id:'guest',status:'ready'},user:{id:'host'},
  stream:{get active(){return tracks.some(t=>t.readyState==='live');},getTracks:()=>tracks},
  db:{auth:{getSession:async()=>({data:{session:{access_token:'fixture-only'}}})}},
  DV_SUPABASE:{url:'https://fixture.invalid'},LivekitClient:{Room,RoomEvent:{Disconnected:'disconnected'},Track:{Source:{Camera:'camera',Microphone:'microphone'}}},
  fetch:async()=>{requests++;return {ok:admitted,json:async()=>({url:'wss://fixture.invalid',token:'fixture-only'})};},
  setInterval:fn=>timers.push(fn),addEventListener:(name,fn)=>events[name]=fn};
context.window=context;
const flush=async()=>{for(let i=0;i<10;i++)await settle();};
const tick=async()=>{timers[0]();await flush();};
const preserved=()=>assert.ok(tracks.every(t=>t.readyState==='live'),'SFU must preserve original P2P tracks');
runInNewContext(source,context);await flush();
assert.equal(rooms[0].localParticipant.trackPublications.size,2);
await rooms[0].removeParticipant();preserved();
admitted=false;const before=requests;await tick();
assert.ok(requests>before,'server disconnect must require fresh broker admission');
assert.equal(rooms.length,1,'closed admission must not reconnect');preserved();
admitted=true;await tick();assert.equal(rooms.length,2);
tracks[1].enabled=false;await tick();preserved();
assert.equal(rooms[1].localParticipant.trackPublications.size,1);
tracks[1].enabled=true;await tick();assert.equal(rooms[1].localParticipant.trackPublications.size,2);
events.pagehide();await flush();preserved();assert.equal(rooms[1].closed,true);
failPublish=true;await tick();preserved();assert.equal(rooms.at(-1).closed,true,'partial publish failure must dispose of room');
failPublish=false;await tick();preserved();assert.equal(rooms.at(-1).localParticipant.trackPublications.size,2);
context.currentMatch=null;await tick();preserved();assert.equal(rooms.at(-1).closed,true);
console.log('PASS: publisher forced removal, fresh admission, mute/unmute, pagehide, partial failure and match cleanup preserve P2P tracks');
