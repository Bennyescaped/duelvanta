// Actual Chromium + actual spectator HTML/JS/runtime guard; RPCs isolated in memory.
// PostgreSQL authorization and concurrent callers are tested separately against PostgreSQL 17.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),out=new URL('test-results/',root);
const read=path=>readFile(new URL(path,root),'utf8');
const hash=text=>createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
for(const [path,sha] of Object.entries({'battle.js':'4f465a801dd5561fa4adae2cc860823bc27ffa3d','battle-webrtc.js':'5d97ae8e195264c6c14c18a33c4cbc5545533c14','site-nav.js':'5981600bd10d8efdd633b2f5e5b2cb9573292ece'}))assert.equal(hash(await read(path)),sha,'protected player/runtime file: '+path);
const spectatorHTML=await read('battle-spectator.html');
assert.ok(!/<(?:video|audio)\b|src="battle(?:-webrtc|-moderation|-ranked)?\.js"/.test(spectatorHTML));
assert.ok(spectatorHTML.indexOf('src="site-nav.js"')<spectatorHTML.indexOf('src="battle-spectator.js"'));
const playerHTML=await read('battle.html');const strippedPlayerHTML=playerHTML.replace('<script src="https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/dist/livekit-client.umd.min.js"></script><script src="battle-spectator-host.js"></script><script src="battle-spectator-media-publisher.js"></script>','');assert.equal(hash(strippedPlayerHTML),'bbb624f6aca3709b0609b7b93be910a29eb29dcb','player HTML only appends isolated spectator addons');
const M='30000000-0000-4000-8000-000000000001',N='30000000-0000-4000-8000-000000000002',P='30000000-0000-4000-8000-000000000003';
const CODE='SP-'+'A'.repeat(64),HOST='10000000-0000-4000-8000-000000000001',GUEST='10000000-0000-4000-8000-000000000002';
const fixture=`(()=>{
 window.rpcCalls=[];window.clientURLs=[];window.pending=[];window.leases=new Set();window.mediaCalls=0;window.authCallbacks=[];window.enabled=false;window.confirm=()=>true;
 window.matches=[{id:'${M}',title:'Öffentliches Match',host_name:'<img src=x onerror=window.injected=1>',guest_name:'Gast',tcg:'pokemon',mode:'ranked',visibility:'public',status:'live',spectator_count:3},
 {id:'${N}',title:'One Piece Match',host_name:'Host',guest_name:'Gast',tcg:'one_piece',mode:'casual',visibility:'public',status:'ready',spectator_count:1},
 {id:'${P}',title:'Privates Match',host_name:'Host',guest_name:'Gast',tcg:'pokemon',mode:'casual',visibility:'private',status:'live',spectator_count:1}];
 const originalSet=setTimeout,originalClear=clearTimeout;window.testTimers=new Map();
 window.setTimeout=(fn,ms,...args)=>{const id=originalSet(()=>{testTimers.delete(id);fn(...args);},ms);testTimers.set(id,{fn:()=>fn(...args),ms});return id;};
 window.clearTimeout=id=>{testTimers.delete(id);originalClear(id);};
 window.fireTimer=ms=>{const item=[...testTimers].find(([,t])=>t.ms===ms);if(!item)throw Error('Missing timer '+ms);clearTimeout(item[0]);item[1].fn();};
 window.testIntervals=[];window.setInterval=(fn,ms)=>{testIntervals.push({fn,ms});return testIntervals.length;};
 const media=()=>{mediaCalls++;throw Error('Media forbidden in spectator fixture');};
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:media},configurable:true});window.RTCPeerConnection=media;
 window.flushPending=()=>{const item=pending.shift();if(!item)throw Error('No pending RPC');item.resolve(item.complete());};
 function complete(name,args){
  if(name==='list_battle_spectator_matches')return {data:matches.filter(m=>m.visibility==='public'&&m.tcg===args.p_tcg),error:null};
  if(name==='get_battle_spectator_status')return {data:{spectator_count:3,link_enabled:enabled},error:null};
  if(name==='get_battle_spectator_media_status')return {data:{media_open:false,my_consent:false},error:null};
  if(name==='set_battle_spectator_media_consent')return {data:{media_open:false,my_consent:!!args.p_granted},error:null};
  if(name==='set_battle_spectator_link'){enabled=args.p_enabled;return {data:{enabled,code:enabled?'${CODE}':null},error:null};}
  const m=matches.find(m=>m.id===(args.p_match_id||'${P}'));
  const key=(args.p_match_id||m?.id)+':'+args.p_tab_id;
  if(name==='leave_battle_spectator'){leases.delete(key);return {data:null,error:null};}
  if(name==='join_battle_spectator'){
   if(window.joinError)return {error:{message:joinError}};
   if(m.visibility==='private'&&args.p_code!=='${CODE}'&&!window.privateGrant)return {error:{message:'spectator_unavailable'}};
   if(m.visibility==='private')window.privateGrant=true;
   leases.add(m.id+':'+args.p_tab_id);
  }else if(name==='heartbeat_battle_spectator'){
   if(window.heartbeatError)return {error:{message:heartbeatError}};
   if(!leases.has(key))return {error:{message:'spectator_presence_expired'}};
  }else throw Error('Unexpected RPC '+name);
  const live=['waiting','ready','live','dispute'].includes(m.status);if(!live)leases.delete(key);
  return {data:{match:{...m},lease_expires_at:live?new Date(Date.now()+75000).toISOString():null,heartbeat_seconds:20},error:null};
 }
 window.testDb={auth:{getSession:async()=>({data:{session:window.loggedOut?null:{user:{id:'viewer'}}},error:null}),onAuthStateChange:fn=>{authCallbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{authCallbacks.forEach(fn=>fn('SIGNED_OUT',null));return {error:null};}},
 from:table=>{if(table!=='profiles')throw Error('Unexpected raw table '+table);const chain={select:()=>chain,eq:()=>chain,single:async()=>({data:{role:'player'}})};return chain;},
 rpc:(name,args)=>{rpcCalls.push({name,args});if(window.holdNext===name){window.holdNext=null;return new Promise(resolve=>pending.push({resolve,complete:()=>complete(name,args)}));}return Promise.resolve(complete(name,args));}};
 window.supabase={createClient:(url)=>{clientURLs.push(url);return testDb;}};
})();`;
const mock=fixture;
const hostHTML=(await read('battle.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('</body>',`<script>${mock}</script><script>var db=testDb,user={id:'${HOST}'},currentMatch={id:'${P}',host_id:'${HOST}',guest_id:'${GUEST}',visibility:'private',status:'live'};window.originalReady=()=>{};document.getElementById('readyBtn').onclick=originalReady;document.getElementById('app').classList.remove('hidden');document.getElementById('arenaView').classList.remove('hidden');</script><script src="battle-spectator-host.js"></script></body>`);
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname.slice(1);if(path==='host-fixture.html'){res.setHeader('Content-Type','text/html');res.end(hostHTML);return;}if(path==='session-guard.js'){res.setHeader('Content-Type','text/javascript');res.end('/* isolated auth fixture */');return;}if(!/^[\w.-]+$/.test(path))throw Error('invalid path');const bytes=await readFile(new URL(path,root));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/html');res.end(bytes);}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const evidence=[];
async function pageFor(path='battle-spectator.html',init,noGuard=false){const page=await browser.newPage({viewport:{width:1280,height:900}});page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));await page.route('**/*',route=>{const url=new URL(route.request().url());if(noGuard&&url.pathname==='/site-nav.js')return route.fulfill({contentType:'text/javascript',body:''});if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:mock});if(url.origin===base)return route.continue();return route.abort();});if(init)await page.addInitScript(init);await page.goto(base+'/'+path);return page;}
const until=(page,fn)=>page.waitForFunction(fn,null,{timeout:5000});
async function clean(page,name){assert.deepEqual(page.errors,[],name+' browser errors');assert.equal(await page.evaluate(()=>mediaCalls),0,name+' no media');evidence.push(name);await page.close();}
try{
 let p=await pageFor('battle-spectator.html',null,true);await until(p,()=>document.getElementById('spMessage').textContent.includes('Umgebungszugang fehlt'));assert.equal(await p.evaluate(()=>rpcCalls.length),0);await clean(p,'missing runtime guard fails closed');
 p=await pageFor();await until(p,()=>document.querySelector('[data-watch]'));
 assert.deepEqual(await p.evaluate(()=>clientURLs),['https://xhmjxrcskfhbovhitdej.supabase.co']);
 await p.click(`[data-watch="${M}"]`);await until(p,()=>!document.getElementById('spView').hidden);
 assert.equal(await p.textContent('#spHost'),'<img src=x onerror=window.injected=1>');assert.equal(await p.evaluate(()=>!!window.injected),false);
 assert.equal(await p.locator('#spHost img,video,audio,#readyBtn,#startMatch,#moderatorControls').count(),0);
 await p.screenshot({path:new URL('battle-spectator-desktop.png',out).pathname,fullPage:true});
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:new URL('battle-spectator-mobile.png',out).pathname,fullPage:true});
 await p.click('#spLeave');await until(p,()=>leases.size===0);await clean(p,'public view, staging routing, escaped names, mobile layout and clean leave');

 p=await pageFor();await until(p,()=>document.querySelector('[data-watch]'));
 await p.evaluate(()=>holdNext='list_battle_spectator_matches');await p.click('#spRefresh');await until(p,()=>pending.length===1);await p.click('[data-spectator-tcg="one_piece"]');await until(p,()=>document.getElementById('spMatches').textContent.includes('One Piece Match'));await p.evaluate(()=>flushPending());
 assert.ok((await p.textContent('#spMatches')).includes('One Piece Match'));assert.ok(!(await p.textContent('#spMatches')).includes('Öffentliches Match'));await clean(p,'out-of-order directory results cannot cross TCG filters');

 p=await pageFor();await until(p,()=>document.querySelector('[data-watch]'));
 await p.evaluate(()=>holdNext='join_battle_spectator');await p.click(`[data-watch="${M}"]`);await until(p,()=>pending.length===1);await p.click('#spLeave');await p.evaluate(()=>flushPending());await until(p,()=>leases.size===0&&rpcCalls.filter(c=>c.name==='leave_battle_spectator').length>=2);assert.equal(await p.locator('#spView').isVisible(),false);await clean(p,'late join after cancel is released and cannot reopen the view');

 p=await pageFor(`battle-spectator.html?match=${P}#spectator=${CODE}`);await until(p,()=>!document.getElementById('spView').hidden);assert.equal(await p.evaluate(()=>location.hash),'');assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await p.evaluate(()=>heartbeatError='spectator_unavailable');await p.click('#spRefreshMatch');await until(p,()=>document.getElementById('spView').hidden);assert.equal(await p.textContent('#spHost'),'');assert.equal(await p.textContent('#spCount'),'—');await clean(p,'private fragment code is cleared; revoked access clears the snapshot');

 p=await pageFor(`battle-spectator.html?match=${M}`);await until(p,()=>!document.getElementById('spView').hidden);await p.evaluate(()=>holdNext='heartbeat_battle_spectator');await p.click('#spRefreshMatch');await until(p,()=>pending.length===1);await p.evaluate(()=>fireTimer(12000));await until(p,()=>document.getElementById('spView').hidden);await p.evaluate(()=>flushPending());await until(p,()=>leases.size===0);await clean(p,'network timeout and late heartbeat fail closed');

 p=await pageFor(`battle-spectator.html?match=${M}`);await until(p,()=>!document.getElementById('spView').hidden);await p.evaluate(()=>fireTimer(70000));await until(p,()=>document.getElementById('spView').hidden);await clean(p,'local stale-data watchdog clears an unconfirmed view');

 p=await pageFor(`battle-spectator.html?match=${M}`);await until(p,()=>!document.getElementById('spView').hidden);await p.evaluate(()=>{matches[0].status='completed';matches[0].result='host';});await p.click('#spRefreshMatch');await until(p,()=>document.getElementById('spResult').textContent.includes('Host gewinnt'));assert.equal(await p.locator('#spRefreshMatch').isVisible(),false);assert.equal(await p.evaluate(()=>leases.size),0);await clean(p,'terminal snapshot stops presence and polling');

 p=await pageFor('battle-spectator.html',()=>window.loggedOut=true);await until(p,()=>!document.getElementById('spLogin').hidden);assert.equal(await p.evaluate(()=>rpcCalls.length),0);await clean(p,'logged-out users cannot create spectator presence');
 p=await pageFor(`battle-spectator.html?match=${M}`,()=>window.joinError='spectator_role_conflict');await until(p,()=>document.getElementById('spMessage').textContent.includes('Spieler oder Judge'));assert.equal(await p.locator('#spView').isVisible(),false);await clean(p,'server role conflict cannot open a player or spectator arena');
 p=await pageFor();await until(p,()=>document.querySelector('[data-watch]'));await p.fill('#spCode','ABC123');await p.locator('#spCodeForm button').click();assert.equal(await p.evaluate(()=>rpcCalls.filter(c=>c.name==='join_battle_spectator').length),0);assert.ok((await p.textContent('#spCodeMessage')).includes('Kein Zuschauerzugang'));assert.equal(await p.getAttribute('#spCode','aria-invalid'),'true');await clean(p,'player code is rejected visibly without a spectator RPC');

 p=await pageFor('host-fixture.html');await until(p,()=>document.getElementById('bspCount').textContent==='3 Zuschauer');await p.click('#bspCreate');await until(p,()=>document.getElementById('bspLink').value.includes('#spectator='));assert.equal(await p.evaluate(()=>document.getElementById('readyBtn').onclick===originalReady),true);
 const privateURL=new URL(await p.inputValue('#bspLink'));assert.equal(privateURL.searchParams.get('match'),P);assert.equal(privateURL.search.includes('SP-'),false);
 await p.click('#bspRevoke');await until(p,()=>document.getElementById('bspMessage').textContent.includes('widerrufen'));assert.equal(await p.inputValue('#bspLink'),'');
 await p.click('#bspCreate');await until(p,()=>!document.getElementById('bspShare').hidden);await p.evaluate(guest=>{user.id=guest;testIntervals.find(x=>x.ms===5000).fn();},GUEST);assert.equal(await p.locator('#bspControls').isVisible(),false);assert.equal(await p.inputValue('#bspLink'),'');
 assert.deepEqual(await p.evaluate(()=>Object.keys(currentMatch).sort()),['guest_id','host_id','id','status','visibility']);await clean(p,'host-only link management is additive and clears secrets on role change');
 await writeFile(new URL('battle-spectator-browser.json',out),JSON.stringify({passed:evidence,rpcMode:'isolated; no real users or provider requests',mediaCalls:0},null,2));
 console.log('PASS:',evidence.length,'spectator browser scenarios; protected player files unchanged');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
