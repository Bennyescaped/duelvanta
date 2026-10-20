// Actual BATTLE HTML/modules and Chromium RTC; synthetic users, in-memory RPC transport.
// Native DB suite independently exercises the real RPCs/RLS. No hosted services/STUN.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4183',A='84000000-0000-4000-8000-000000000003',B='84000000-0000-4000-8000-000000000004';
const profiles=new Map([A,B].map(id=>[id,{id,role:'player',username:id===A?'alpha':'bravo',display_name:id===A?'Alpha':'Bravo',locale:'de',account_status:'active',age_band:'18_plus',conduct_accepted_at:'2026-10-20',conduct_version:'battle-v1-2026-09',safety_restricted:false}]));
const matches=[],signals=[],calls=[],errors=[],forbidden=[],checks=[],players=[];let seq=0,browser;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function op(uid,action,arg){
 if(action==='query'){
  let rows=arg.table==='profiles'?[...profiles.values()]:arg.table==='battle_matches'?matches:arg.table==='battle_signals'?signals:null;
  assert.ok(rows,'unexpected table '+arg.table);
  for(const [kind,k,v] of arg.filters){if(kind==='eq')rows=rows.filter(x=>x[k]===v);if(kind==='in')rows=rows.filter(x=>v.includes(x[k]));if(kind==='or')rows=rows.filter(x=>k.split(',').some(f=>{const [col,,val]=f.split('.');return x[col]===val;}));}
  return {data:arg.single?structuredClone(rows[0]||null):structuredClone(rows.slice(0,arg.limit||100)),error:null};
 }
 if(action==='insert'){
  assert.equal(arg.table,'battle_signals');assert.equal(arg.row.sender_id,uid);const row={...arg.row,id:++seq};signals.push(row);
  for(const p of players)p.queue=p.queue.then(()=>p.page.evaluate(row=>window.__deliver(row),row)).catch(e=>{if(!p.page.isClosed())errors.push(e.message)});
  return {error:null};
 }
 assert.equal(action,'rpc');const {name,args:p={}}=arg;calls.push({uid,name,args:p});
 const m=matches.find(x=>x.id===p.p_match_id);
 if(name==='create_battle_match_v2'||name==='create_battle_match'){
  assert.equal(p.p_tcg==='magic'?p.p_mode:'casual','casual');
  const row={id:'93000000-0000-4000-8000-'+String(++seq).padStart(12,'0'),host_id:uid,guest_id:null,host_display_name:profiles.get(uid).display_name,tcg:p.p_tcg,mode:p.p_mode||'casual',visibility:p.p_visibility,invite_code:p.p_visibility==='private'?'R23ABC':null,status:'waiting',host_ready:false,guest_ready:false,language:'de',title:p.p_title};matches.push(row);return {data:row.id,error:null};
 }
 if(name==='join_battle_match'){const x=m||matches.find(x=>x.invite_code===p.p_invite_code);assert.ok(x);x.guest_id=uid;x.guest_display_name=profiles.get(uid).display_name;x.status='ready';return {data:x.id,error:null};}
 if(name==='set_battle_ready'){if(m)m[uid===m.host_id?'host_ready':'guest_ready']=p.p_ready;return {error:null};}
 if(name==='start_battle_match'){assert.ok(m.host_ready&&m.guest_ready);m.status='live';return {error:null};}
 if(name==='report_battle_result'){m[uid===m.host_id?'host_result':'guest_result']=p.p_result;if(m.host_result&&m.guest_result)m.status=m.host_result===m.guest_result?'completed':'dispute';return {data:m.status,error:null};}
 if(name==='leave_battle_match'){if(uid===m.host_id)m.status='cancelled';else{m.guest_id=null;m.status='waiting';}return {error:null};}
 if(name==='clear_my_battle_signals'){for(let i=signals.length-1;i>=0;i--)if(signals[i].match_id===p.p_match_id&&signals[i].sender_id===uid)signals.splice(i,1);return {error:null};}
 if(name==='get_public_duelvanta_identity')return {data:profiles.get(p.p_user_id),error:null};
 if(name==='get_my_battle_history'||name==='get_my_battle_ratings')return {data:[],error:null};
 if(name==='report_battle_user')return {data:true,error:null};
 if(name==='get_battle_spectator_status'||name==='get_battle_spectator_media_status'){assert.notEqual(m?.tcg,'magic','no Magic spectator calls');return {data:{spectator_count:0,link_enabled:false,my_consent:false,media_open:false},error:null};}
 throw Error('Unexpected RPC '+name);
}
async function player(uid,blocked=false){
 const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:390,height:844}});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.host==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:'/* external SDK replaced by isolated transport */'});
  if(u.origin!==origin){forbidden.push(u.href);return route.abort();}
  if(u.pathname==='/api/compliance-message-dispatch')return route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"http://127.0.0.1:4183/mock",key:"synthetic"};'});
  if(u.pathname==='/i18n.js')return route.fulfill({contentType:'text/javascript',body:'window.DV_I18N={locale:"de",setLocale(l){this.locale=l}};'});
  const file=u.pathname.slice(1)||'battle.html';if(!/^[a-zA-Z0-9_.-]+$/.test(file)){forbidden.push(u.href);return route.abort();}
  try{return route.fulfill({body:await readFile(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await context.newPage(),p={page,context,queue:Promise.resolve()};players.push(p);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.exposeFunction('__op',(a,b)=>op(uid,a,b));
 await page.addInitScript(({uid})=>{
  window.__handlers=new Set();window.__peers=[];window.__alerts=[];
  window.__deliver=async row=>{for(const h of window.__handlers)await h({new:row});};window.alert=x=>window.__alerts.push(x);
  const Peer=RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(config){super({...config,iceServers:[]});window.__peers.push(this)}};
  const client={auth:{getSession:async()=>({data:{session:{user:{id:uid},access_token:'synthetic'}}}),signOut:async()=>({}),onAuthStateChange:()=>({})},
   from(table){return {insert:row=>__op('insert',{table,row}),select(){const q={table,filters:[]},chain={eq(k,v){q.filters.push(['eq',k,v]);return this},in(k,v){q.filters.push(['in',k,v]);return this},or(s){q.filters.push(['or',s]);return this},order(){return this},limit(n){q.limit=n;return this},single(){q.single=true;return this},then(a,b){return __op('query',q).then(a,b)}};return chain;}}},
   rpc:(name,args)=>__op('rpc',{name,args}),channel(){return {on(e,f,h){this.h=h;return this},subscribe(cb){window.__handlers.add(this.h);setTimeout(()=>cb('SUBSCRIBED'),20);return this}}},removeChannel:async c=>window.__handlers.delete(c.h)};
  window.supabase={createClient:()=>client};
 },{uid});
 await page.goto(origin+'/battle.html');await page.waitForFunction(blocked=>window.DV_BATTLE_RANKED&&window.DV_BATTLE_RTC&&(blocked?!document.getElementById('safetyBlocked').classList.contains('hidden'):!document.getElementById('battleShell').classList.contains('hidden')),blocked);return p;
}
async function refresh(p){await p.page.evaluate(()=>refreshMatch());}
async function media(p,label){const deadline=Date.now()+15000;let r;do{r=await p.page.evaluate(async()=>{const pc=window.__peers.at(-1);if(!pc)return {};const stats=await pc.getStats();return {state:pc.connectionState,frames:[...stats.values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='video').reduce((a,s)=>a+(s.framesDecoded||0),0),audio:[...stats.values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='audio').reduce((a,s)=>a+(s.bytesReceived||0),0),width:document.getElementById('opponentVideo').videoWidth};});if(r.state==='connected'&&r.frames>0&&r.audio>0&&r.width>0)break;await pause(100);}while(Date.now()<deadline);assert.ok(r.frames>0&&r.audio>0&&r.width>0,label+JSON.stringify(r));checks.push({name:label,...r});}
async function finish(p,choice){await p.page.locator('[data-result="'+choice+'"]').click();assert.equal(await p.page.locator('#dvResultConfirm').evaluate(n=>n.open),true);await p.page.locator('#dvResultConfirmBtn').click();}
try{
 browser=await chromium.launch({headless:true,args:['--allow-loopback-in-peer-connection','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--disable-background-networking']});
 for(const visibility of ['public','private']){
  matches.length=0;signals.length=0;
  const h=await player(A),g=await player(B);
  await h.page.locator('[data-tcg="magic"]').click();assert.equal(await h.page.locator('#dvRankedPanel').isVisible(),false);
  await h.page.locator('#createMatch').click();assert.equal(await h.page.locator('#matchMode').isDisabled(),true);assert.equal(await h.page.locator('#matchMode').inputValue(),'casual');
  await h.page.locator('#matchTcg').selectOption('one_piece');assert.equal(await h.page.locator('#matchMode').isDisabled(),false);await h.page.locator('#matchMode').selectOption('ranked');await h.page.locator('#matchTcg').selectOption('magic');assert.equal(await h.page.locator('#matchMode').inputValue(),'casual');
  await h.page.locator('#visibility').selectOption(visibility);await h.page.evaluate(()=>document.getElementById('matchMode').value='ranked');await h.page.locator('#confirmCreate').click();await h.page.waitForFunction(()=>currentMatch?.tcg==='magic');
  if(visibility==='public'){await g.page.locator('[data-tcg="magic"]').click();await g.page.locator('#matchGrid [data-join]').click();}else{await g.page.locator('#inviteCode').fill('R23ABC');await g.page.locator('#joinCodeBtn').click();}
  await g.page.waitForFunction(()=>currentMatch?.guest_id);await refresh(h);
  for(const p of [g,h]){assert.match(await p.page.locator('#arenaMeta').innerText(),/Magic: The Gathering · Casual/);await p.page.locator('#cameraBtn').click();}
  await media(h,visibility+' host actual RTC');await media(g,visibility+' guest actual RTC');
  for(const p of [h,g])await p.page.locator('#readyBtn').click();await refresh(h);await h.page.locator('#startMatch').click();await refresh(g);await g.page.waitForFunction(()=>currentMatch?.status==='live');
  await pause(5200);for(const p of [h,g])assert.equal(await p.page.locator('#battleSpectatorPanel').isVisible(),false);
  await h.page.locator('#reportUser').click();await h.page.locator('#reportCategory').selectOption('cheating');await h.page.locator('#sendReport').click();await h.page.waitForFunction(()=>!document.getElementById('reportDialog').open);
  await finish(h,'me');assert.equal(matches[0].status,'live');await finish(g,visibility==='public'?'opponent':'me');await refresh(h);await refresh(g);assert.equal(matches[0].status,visibility==='public'?'completed':'dispute');
  checks.push({name:visibility+' UI create/join/camera/ready/start/report/confirm '+matches[0].status,status:'PASS'});
  await h.page.screenshot({path:'test-results/r23/'+visibility+'-arena.png',fullPage:true});
  for(const p of [h,g]){await p.page.evaluate(()=>window.DV_BATTLE_RTC.stopMedia());await p.queue;await p.context.close();players.splice(players.indexOf(p),1);}
 }
 matches.length=0;const h=await player(A);for(const tcg of ['pokemon','one_piece']){await h.page.locator('[data-tcg="'+tcg+'"]').click();assert.equal(await h.page.locator('#dvRankedPanel').isVisible(),true);await h.page.locator('#createMatch').click();assert.equal(await h.page.locator('#matchMode').isDisabled(),false);await h.page.locator('#matchMode').selectOption('ranked');assert.equal(await h.page.locator('#visibility option[value="private"]').isDisabled(),true);await h.page.locator('#matchMode').selectOption('casual');assert.equal(await h.page.locator('#visibility option[value="private"]').isDisabled(),false);await h.page.evaluate(()=>createDialog.close());}checks.push({name:'Pokemon/One Piece ranked and casual controls unchanged',status:'PASS'});
 await h.page.locator('[data-tcg="magic"]').click();await h.page.locator('#createMatch').click();await h.page.locator('#confirmCreate').click();await h.page.waitForFunction(()=>currentMatch?.tcg==='magic');await h.page.locator('#leaveMatch').click();await h.page.waitForFunction(()=>currentMatch===null);assert.equal(matches[0].status,'cancelled');checks.push({name:'Magic leave uses existing lifecycle',status:'PASS'});
 profiles.get(A).safety_restricted=true;const blocked=await player(A,true);assert.equal(await blocked.page.locator('#battleShell').isVisible(),false);checks.push({name:'Actual Safety UI rejects restricted account',status:'PASS'});await blocked.context.close();profiles.get(A).safety_restricted=false;
 assert.equal(calls.filter(x=>/spectator/.test(x.name)&&matches.some(m=>m.id===x.args.p_match_id&&m.tcg==='magic')).length,0);assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
 await writeFile('test-results/r23/browser.json',JSON.stringify({passed:true,checks,actual_chromium_rtc:true,synthetic_rpc:true,calls,forbidden,errors},null,2));console.log('PASS R23 browser',checks.length,'checks, actual RTC both directions, external requests 0');
}catch(e){await writeFile('test-results/r23/browser-failure.json',JSON.stringify({error:e.message,errors,signals,calls,forbidden},null,2));throw e;}finally{await browser?.close();}
