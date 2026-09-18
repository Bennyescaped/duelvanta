// Execute the shipped module with isolated DOM/media/RTC/signaling doubles.
// Browser transport coverage is in battle-webrtc-browser-test.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {setImmediate as settle} from 'node:timers/promises';
const source=await readFile(new URL('../battle-webrtc.js',import.meta.url),'utf8');
const players=[],rows=[],jobs=[],errors=[];
let nextId=0;
const match={id:'test-match',host_id:'host',guest_id:'guest',status:'ready'};
function player(id){
 const nodes=new Map(),peers=[],media=[],handlers=new Set(),timers=[],rpcCalls=[],alerts=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',srcObject:null,onclick:null,classList:{add(){},remove(){},toggle(){}},showModal(){},close(){}});return nodes.get(id)};
 const context=createContext({document:{getElementById:node},user:{id},currentMatch:{...match},stream:null,
  console:{error:(...args)=>errors.push(args.join(' ')),warn:(...args)=>errors.push(args.join(' '))},
  alert:message=>alerts.push(message),L:()=>({camera:'KAMERA TESTEN'}),refreshMatch(){},
  setInterval:fn=>timers.push(fn),setTimeout:fn=>jobs.push(fn),addEventListener(){},
  RTCSessionDescription:class {constructor(value){Object.assign(this,value)}},RTCIceCandidate:class {constructor(value){Object.assign(this,value)}},
  RTCPeerConnection:class {
   constructor(){this.senders=[];this.connectionState='new';peers.push(this)}
   addTrack(track){this.senders.push({track})}getSenders(){return this.senders}
   async createOffer(){return {type:'offer',sdp:'fixture-offer'}}async createAnswer(){return {type:'answer',sdp:'fixture-answer'}}
   async setLocalDescription(value){this.localDescription=value}async setRemoteDescription(value){this.remoteDescription=value}
   async addIceCandidate(){}close(){this.connectionState='closed'}
  },
  navigator:{mediaDevices:{async getUserMedia(){
   const tracks=['audio','video'].map(kind=>({kind,readyState:'live',enabled:true,stop(){this.readyState='ended'}}));
   const value={getTracks:()=>tracks,getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),getVideoTracks:()=>tracks.filter(t=>t.kind==='video')};
   media.push(value);return value;
  }}},
  db:{
   from(table){assert.equal(table,'battle_signals');return {
    async insert(row){assert.equal(row.match_id,match.id);assert.equal(row.sender_id,id);const saved={...row,id:++nextId};rows.push(saved);for(const p of players)for(const handler of p.handlers)jobs.push(()=>handler({new:saved}));return {error:null}},
    select(){return {eq(column,value){assert.equal(column,'match_id');assert.equal(value,match.id);return {order(){return {limit:async()=>({data:rows.slice(-80)})}}}}}}
   }},
   async rpc(name,args){rpcCalls.push({name,args});assert.equal(args.p_match_id,match.id);assert.ok(['clear_my_battle_signals','set_battle_ready'].includes(name));if(name==='clear_my_battle_signals')for(let i=rows.length-1;i>=0;i--)if(rows[i].sender_id===id)rows.splice(i,1);return {error:null}},
   channel(){return {on(event,filter,callback){this.callback=callback;return this},subscribe(callback){handlers.add(this.callback);jobs.push(()=>callback('SUBSCRIBED'));return this}}},
   async removeChannel(channel){handlers.delete(channel.callback)}
  }
 });
 context.window=context;let readyCalls=0;node('readyBtn').onclick=()=>readyCalls++;
 runInContext(source,context,{filename:'battle-webrtc.js'});
 const state={id,context,peers,media,handlers,rpcCalls,alerts,node,get readyCalls(){return readyCalls}};players.push(state);return state;
}
async function drain(){for(let i=0;i<200;i++){await settle();if(!jobs.length)return;await jobs.shift()()}throw Error('Signaling fixture did not settle')}
function active(p){return p.peers.filter(peer=>peer.connectionState!=='closed')}
function assertSending(p,label){
 assert.equal(active(p).length,1,`${label}: exactly one open peer`);
 assert.deepEqual(active(p)[0].getSenders().map(s=>s.track.kind).sort(),['audio','video'],`${label}: the active peer must send both tracks from the current camera`);
 assert.ok(active(p)[0].getSenders().every(s=>p.context.stream.getTracks().includes(s.track)&&s.track.readyState==='live'));
}
async function start(p){await p.context.DV_BATTLE_RTC.startMedia();await drain()}
async function stop(p){await p.context.DV_BATTLE_RTC.stopMedia();await drain();assert.equal(p.context.stream,null);assert.ok(p.media.every(m=>m.getTracks().every(t=>t.readyState==='ended')));assert.ok(p.rpcCalls.some(c=>c.name==='set_battle_ready'&&c.args.p_ready===false));await p.node('readyBtn').onclick();assert.equal(p.readyCalls,0,'camera-off readiness gate must remain closed')}
const host=player('host'),guest=player('guest');
await start(host);await start(guest);assertSending(host,'initial host');assertSending(guest,'initial guest');
console.log('PASS: initial host/guest attach live audio and video');
for(let attempt=1;attempt<=2;attempt++){
 await stop(guest);
 host.context.DV_BATTLE_RTC.sync();await drain();
 assert.equal(active(guest).length,1);assert.equal(active(guest)[0].getSenders().length,0,'reproduce the receive-only peer created while the guest camera is off');
 console.log(`REPRO: receive-only guest peer before camera restart ${attempt}`);
 const oldPeer=active(guest)[0];await start(guest);
 host.context.DV_BATTLE_RTC.sync();await drain();
 assertSending(guest,`guest restart ${attempt}`);assertSending(host,`host after guest restart ${attempt}`);
 assert.equal(oldPeer.connectionState,'closed','restart must dispose of the receive-only peer');
 console.log(`PASS: guest camera restart ${attempt} restores both sending tracks`);
}
await stop(host);await start(host);assertSending(host,'host restart');assertSending(guest,'guest after host restart');
await guest.node('micBtn').onclick();assert.ok(guest.context.stream.getAudioTracks().every(t=>!t.enabled));
await guest.node('micBtn').onclick();assert.ok(guest.context.stream.getAudioTracks().every(t=>t.enabled));
assert.ok(rows.filter(row=>row.signal_type==='offer').every(row=>row.sender_id==='host'),'host remains the offerer');
assert.deepEqual(errors,[]);
console.log('PASS: BATTLE isolated camera restart regression; ready gate, stop and microphone behavior retained');
