// Real Chromium media/RTCPeerConnections, isolated in-memory signaling only.
// No login, Supabase, production/staging writes, external STUN or recorded media.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const source=await readFile(new URL('../battle-webrtc.js',import.meta.url),'utf8');
const evidence=new URL('../test-results/battle-webrtc-browser.json',import.meta.url);
const MATCH='10000000-0000-4000-8000-000000000001';
const HOST='20000000-0000-4000-8000-000000000001',GUEST='20000000-0000-4000-8000-000000000002';
const pages=new Map(),queues=new Map(),signals=[],rpcs=[],errors=[],blockedRequests=[],checks=[];
let nextId=0,browser;
const watchdog=setTimeout(()=>{console.error('FAIL: BATTLE WebRTC regression exceeded 90000ms');process.exit(1)},90000);
const html=`<!doctype html><html><head><meta charset="utf-8"><title>Isolated BATTLE WebRTC regression</title></head><body>
<video id="myVideo" autoplay muted playsinline></video><div id="myVideoFallback"></div>
<div id="opponentFrame"><video id="opponentVideo" autoplay playsinline></video></div><div id="connectionState"></div>
${['cameraBtn','micBtn','readyBtn','leaveMatch','logout','reportUser','sendReport'].map(id=>`<button id="${id}">${id}</button>`).join('')}
<select id="reportCategory"><option value="other">other</option></select><textarea id="reportDetails"></textarea><div id="reportMsg"></div><dialog id="reportDialog"></dialog>
</body></html>`;

function enqueue(page,row){
 const pending=(queues.get(page)||Promise.resolve()).then(()=>page.evaluate(row=>window.__deliver(row),row));
 queues.set(page,pending.catch(error=>errors.push(error.message)));
}
async function createPlayer(id){
 const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:390,height:844}});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://127.0.0.1:4179'&&url.pathname==='/fixture')return route.fulfill({status:200,contentType:'text/html',body:html});
  blockedRequests.push(url.origin+url.pathname);return route.abort();
 });
 const page=await context.newPage();pages.set(id,page);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
 await page.exposeFunction('__signalOp',async(op,arg)=>{
  if(op==='insert'){
   assert.equal(arg.match_id,MATCH);assert.equal(arg.sender_id,id);
   assert.ok(['offer','answer','ice','hangup'].includes(arg.signal_type));
   const row={...arg,id:++nextId};signals.push(row);
   for(const target of pages.values())enqueue(target,row);
   return {error:null};
  }
  if(op==='select')return {data:signals.filter(row=>row.match_id===arg).slice(-80),error:null};
  if(op==='rpc'){
   rpcs.push({user:id,...arg});
   assert.ok(['clear_my_battle_signals','set_battle_ready'].includes(arg.name));
   assert.equal(arg.args.p_match_id,MATCH);
   if(arg.name==='clear_my_battle_signals')for(let i=signals.length-1;i>=0;i--)if(signals[i].sender_id===id)signals.splice(i,1);
   return {error:null};
  }
  throw Error('Unexpected fixture operation '+op);
 });
 await page.goto('http://127.0.0.1:4179/fixture');
 await page.evaluate(({id,host,guest,match})=>{
  window.user={id};window.currentMatch={id:match,host_id:host,guest_id:guest,status:'ready'};window.stream=null;
  window.L=()=>({camera:'KAMERA TESTEN'});window.refreshMatch=()=>{};
  window.__peers=[];window.__streams=[];window.__alerts=[];window.__readyCalls=0;window.__handlers=new Set();
  window.alert=message=>window.__alerts.push(message);
  document.getElementById('readyBtn').onclick=()=>window.__readyCalls++;
  const Peer=window.RTCPeerConnection;
  window.RTCPeerConnection=class extends Peer{constructor(config){super({...config,iceServers:[]});window.__peers.push(this)}};
  const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async options=>{const media=await getMedia(options);window.__streams.push(media);return media};
  window.__deliver=async row=>{for(const handler of window.__handlers)await handler({new:row})};
  window.db={
   from(table){if(table!=='battle_signals')throw Error('Unexpected fixture table');return {
    insert:row=>window.__signalOp('insert',row),
    select(){return {eq(column,value){if(column!=='match_id')throw Error('Unexpected fixture filter');return {order(){return {limit:()=>window.__signalOp('select',value)}}}}}}
   }},
   rpc:(name,args)=>window.__signalOp('rpc',{name,args}),
   channel(){let handler;return {on(event,filter,callback){handler=callback;return this},subscribe(callback){window.__handlers.add(handler);this.handler=handler;setTimeout(()=>callback('SUBSCRIBED'),50);return this}}},
   removeChannel:async channel=>window.__handlers.delete(channel.handler)
  };
 },{id,host:HOST,guest:GUEST,match:MATCH});
 await page.addScriptTag({content:source});return page;
}
async function snapshot(page){return page.evaluate(async()=>{
 const peer=window.__peers.at(-1),stats=peer&&peer.connectionState!=='closed'?await peer.getStats():new Map();
 const inbound=[...stats.values()].filter(row=>row.type==='inbound-rtp'&&!row.isRemote);
 return {peers:window.__peers.length,state:peer?.connectionState,
  senders:peer?.getSenders().map(sender=>sender.track&&({kind:sender.track.kind,state:sender.track.readyState}))||[],
  frames:inbound.filter(row=>row.kind==='video').reduce((sum,row)=>sum+(row.framesDecoded||0),0),
  audioBytes:inbound.filter(row=>row.kind==='audio').reduce((sum,row)=>sum+(row.bytesReceived||0),0),
  local:!!window.stream,videoWidth:document.getElementById('opponentVideo').videoWidth,
  activePeers:window.__peers.filter(peer=>peer.connectionState!=='closed').length};
})}
async function waitForMedia(page,label){
 // Poll the awaited stats snapshot from Node: an async waitForFunction predicate
 // can be truthy before its Promise resolves in the pinned Playwright runtime.
 const hasMedia=state=>state.state==='connected'&&state.frames>0&&state.audioBytes>0&&state.videoWidth>0&&['audio','video'].every(kind=>state.senders.some(sender=>sender?.kind===kind&&sender.state==='live'));
 let state;const deadline=Date.now()+15000;
 do{state=await snapshot(page);if(hasMedia(state))break;await new Promise(resolve=>setTimeout(resolve,100))}while(Date.now()<deadline);
 assert.ok(hasMedia(state),`${label}: expected real bilateral media, received ${JSON.stringify(state)}`);
 assert.equal(state.activePeers,1,`${label}: only one active peer`);checks.push({label,...state});
 console.log(`PASS: ${label} (real audio/video received, ${state.frames} decoded frames)`);
}
async function stop(page,id){
 await page.evaluate(()=>window.DV_BATTLE_RTC.stopMedia());
 assert.equal(await page.evaluate(()=>window.stream),null);
 assert.equal(await page.evaluate(()=>window.__streams.every(media=>media.getTracks().every(track=>track.readyState==='ended'))),true);
 assert.ok(rpcs.some(call=>call.user===id&&call.name==='set_battle_ready'&&call.args.p_ready===false));
 await page.evaluate(()=>document.getElementById('readyBtn').click());
 assert.equal(await page.evaluate(()=>window.__readyCalls),0,'Ready remains blocked without a live camera');
}
try{
 browser=await chromium.launch({headless:true,...(process.env.BATTLE_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.BATTLE_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--disable-background-networking']});
 const host=await createPlayer(HOST),guest=await createPlayer(GUEST);
 await host.evaluate(()=>window.DV_BATTLE_RTC.startMedia());
 await guest.evaluate(()=>window.DV_BATTLE_RTC.startMedia());
 await waitForMedia(host,'initial host');await waitForMedia(guest,'initial guest');
 for(let attempt=1;attempt<=2;attempt++){
  await stop(guest,GUEST);
  // The host's existing sync loop offers again while the guest camera is off.
  await guest.waitForFunction(()=>{const p=window.__peers.at(-1);return p?.connectionState==='connected'&&p.remoteDescription&&p.getSenders().every(s=>!s.track)},null,{timeout:15000});
  const receiveOnly=await snapshot(guest);checks.push({label:`guest receive-only before restart ${attempt}`,...receiveOnly});
  await guest.evaluate(()=>window.DV_BATTLE_RTC.startMedia());
  await waitForMedia(host,`host after guest restart ${attempt}`);
  await waitForMedia(guest,`guest after restart ${attempt}`);
 }
 await stop(host,HOST);
 await host.evaluate(()=>window.DV_BATTLE_RTC.startMedia());
 await waitForMedia(host,'host after host restart');await waitForMedia(guest,'guest after host restart');
 await guest.evaluate(()=>document.getElementById('micBtn').click());
 assert.equal(await guest.evaluate(()=>window.stream.getAudioTracks().every(track=>!track.enabled)),true,'mute still works after restart');
 await guest.evaluate(()=>document.getElementById('micBtn').click());
 assert.equal(await guest.evaluate(()=>window.stream.getAudioTracks().every(track=>track.enabled)),true,'unmute still works after restart');
 assert.ok(signals.filter(row=>row.signal_type==='offer').every(row=>row.sender_id===HOST),'host remains the only offerer');
 assert.deepEqual(errors,[]);assert.deepEqual(blockedRequests,[]);
 console.log('PASS: BATTLE camera restart, bilateral media, repeated restart, stop/ready gate and microphone regression');
}catch(error){
 for(const [id,page] of pages)console.error(id===HOST?'HOST':'GUEST',await snapshot(page).catch(()=>null));
 throw error;
}finally{
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 await writeFile(evidence,JSON.stringify({checks,errors,blockedRequests,signaling:'isolated fixture; no Supabase calls'},null,2));
 for(const page of pages.values())await page.evaluate(()=>{window.stream?.getTracks().forEach(track=>track.stop());window.DV_BATTLE_RTC?.shutdownPeer(false)}).catch(()=>{});
 if(browser)await browser.close();clearTimeout(watchdog);
}
