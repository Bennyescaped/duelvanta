// D1: disposable full-stack SQL + optional real Chromium with SQL-backed transport.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {signalSecurityQuery} from './generate-security-readiness.mjs';
const epochHold=process.argv.includes('--spectator-epoch-hold');const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,liveApplied:false,cases:[],races:[],browser:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`75000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C,O]=[1,2,3,4].map(uid),sid=u=>u?.replace('75000000','75100000');let seq=100;
const scalar=async(s,a=[],c=db)=>(await c.query(s,a)).rows[0].v;
async function claim(u,role='authenticated',extra={},c=db){await c.query('reset role');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,session_id:sid(u),...extra})]);await c.query('set role '+role)}
const owner=()=>claim(null,'postgres');
async function tx(fn){await db.exec('begin');try{await fn()}finally{await db.exec('rollback');await owner()}}
async function deny(sql,args=[],pattern=/spectator_battle_access_required/){await db.exec('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}}
const link='select public.set_battle_spectator_link($1,$2) v',consent='select public.set_battle_spectator_media_consent($1,$2) v';
const tables=['auth.sessions','public.profiles','public.battle_matches','battle_spectator_private.links','battle_spectator_private.grants','battle_spectator_private.presence','battle_spectator_media_private.consents','battle_spectator_media_private.epochs','battle_spectator_media_private.revocations'];
async function snap(){await owner();const out={};for(const t of tables)out[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return out}
async function hold(u,s){await owner();if(s==='processing')await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);if(s==='closure'){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)])).accepted,true)}await owner()}
async function match(u=A,visibility='private',status='live'){await owner();const m=uid(seq++);await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,visibility) values($1,$2,$3,'pokemon',$4,$5)",[m,u,u===A?B:A,status,visibility]);return m}
async function setup(u=A,withViewer=true){const m=await match(u),other=u===A?B:A,tab=uid(seq++);await claim(u);const l=await scalar(link,[m,true]);await scalar(consent,[m,true]);await claim(other);const e=await scalar(consent,[m,true]);assert.equal(e.media_open,true);if(withViewer){await claim(C);await db.query('select public.join_battle_spectator($1,$2,$3)',[m,tab,l.code]);}await owner();await db.query('delete from battle_spectator_media_private.revocations where match_id=$1',[m]);return{m,other,tab,epoch:e.epoch}}
const queue=async m=>{await owner();return(await db.query('select * from battle_spectator_media_private.revocations where match_id=$1 order by id',[m])).rows};
async function checkWithdrawal(f,sql,u){await claim(u);const held=await scalar('select data_processing_restricted_at is not null v from public.profiles where id=$1',[u]);const result=await scalar(sql,[f.m,false]);assert.equal(result.withdrawn,true);const q=await queue(f.m);assert.equal(q.length,1);assert.equal(q[0].epoch,f.epoch);assert.equal(q[0].reason,epochHold&&held?'processing_hold':sql===link?'generation_changed':'player_withdrawal');assert.equal(await scalar('select media_open v from battle_spectator_media_private.epochs where match_id=$1',[f.m]),false);const before=await snap();await claim(u);assert.equal((await scalar(sql,[f.m,false])).withdrawn,false);assert.deepEqual(await snap(),before,'replay is state-identical');return before}
async function browserScenario(browser,u,s,guest=false){
 const f=await setup(guest?(u===A?B:A):u);await hold(u,s);const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),calls=[],errors=[];
 await page.route('**/*',r=>r.abort());page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('sqlBridge',async(type,arg)=>{await claim(u);if(type==='profile')return{data:(await db.query('select * from public.profiles where id=$1',[u])).rows[0]};if(type==='matches')return{data:(await db.query("select id,host_id,guest_id,visibility,status,title from public.battle_matches where host_id=$1 or guest_id=$1",[u])).rows};if(type==='rpc'){calls.push(arg);assert.ok(['set_battle_spectator_link','set_battle_spectator_media_consent'].includes(arg.name));assert.equal(arg.args.p_enabled??arg.args.p_granted,false);await db.exec('savepoint browser');try{const data=await scalar(arg.name.endsWith('_link')?link:consent,[arg.args.p_match_id,false]);await db.exec('release savepoint browser');return{data}}catch(e){await db.exec('rollback to savepoint browser;release savepoint browser');return{error:{message:e.message}}}}throw Error(type)});
 const html=(await read('battle.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');await page.setContent(html);await page.addStyleTag({content:await read('battle.css')});
 await page.addScriptTag({content:`window.__dvAppDb={auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(u)}}}}})},from(table){return{select(){return{eq(){return{single:()=>sqlBridge('profile')}},or(){return{in:()=>sqlBridge('matches')}}}}}},rpc:(name,args)=>sqlBridge('rpc',{name,args})};document.getElementById('app').classList.remove('hidden');`});
 await page.addScriptTag({content:await read('battle-safety.js')});
 const allowed=await page.evaluate(async uid=>window.DV_BATTLE_SAFETY.init(window.__dvAppDb,{id:uid}),u);assert.equal(allowed,s!=='closure');
 await page.addScriptTag({content:await read('battle-spectator-withdrawal.js')});
 if(s==='normal'){await page.waitForTimeout(100);assert.equal(await page.locator('#spectatorWithdrawal').isVisible(),false)}
 else{
  const panel=page.locator('#spectatorWithdrawal');await panel.waitFor({state:'visible'});
  const b=panel.getByRole('button',{name:'Eigenes Media-Consent zurückziehen'});await b.click();await page.waitForFunction(()=>document.querySelector('[data-withdrawal-message]').textContent==='Zurückgenommen.');
  await b.click();await page.waitForFunction(()=>document.querySelector('[data-withdrawal-message]').textContent.includes('Kein bestehender'));
  if(guest)assert.equal(await panel.getByRole('button',{name:'Privaten Zuschauerlink deaktivieren'}).count(),0);
  else{await panel.getByRole('button',{name:'Privaten Zuschauerlink deaktivieren'}).click();await page.waitForFunction(()=>document.querySelector('[data-withdrawal-message]').textContent==='Zurückgenommen.');}
  assert.equal(await page.evaluate(()=>document.getElementById('battleShell').contains(document.getElementById('spectatorWithdrawal'))),false);
  if(s==='closure')assert.equal(await page.locator('#battleShell').isVisible(),false);
 }
 assert.deepEqual(errors,[]);report.browser.push({user:u,state:s,guest,calls,arenaReleased:false});await context.close();
}
async function domScenario(u,state,guest=false){
 const f=await setup(guest?(u===A?B:A):u);await hold(u,state);
 const {window,document}=parseHTML(await read('battle.html'));const calls=[];let loaded=false;
 const transport={auth:{getSession:async()=>({data:{session:{user:{id:u}}}})},from(table){return{select(){return{eq(){return{async single(){await claim(u);loaded=true;return{data:(await db.query('select * from public.profiles where id=$1',[u])).rows[0]}}}},or(){return{async in(){await claim(u);return{data:(await db.query('select id,host_id,guest_id,visibility,status,title from public.battle_matches where host_id=$1 or guest_id=$1',[u])).rows}}}}}}}},async rpc(name,args){calls.push({name,args});await claim(u);return{data:await scalar(name.endsWith('_link')?link:consent,[args.p_match_id,args.p_enabled??args.p_granted])}}};
 window.__dvAppDb=transport;
 const ctx=vm.createContext({window,document,setTimeout});
 vm.runInContext(await read('battle-safety.js'),ctx);assert.equal(await window.DV_BATTLE_SAFETY.init(transport,{id:u}),state!=='closure');
 vm.runInContext(await read('battle-spectator-withdrawal.js'),ctx);
 const root=document.getElementById('spectatorWithdrawal');
 for(let i=0;i<100;i++){if(loaded&&(state==='normal'||root.querySelector('[data-withdrawal-list]').children.length))break;await new Promise(r=>setTimeout(r,1))}
 if(state==='normal')assert.equal(root.hidden,true);
 else{
  assert.equal(root.hidden,false);assert.equal(document.getElementById('battleShell').contains(root),false);
  if(state==='closure')assert.equal(document.getElementById('battleShell').classList.contains('hidden'),true);
  const buttons=[...root.querySelector('[data-withdrawal-list]').querySelectorAll('button')];assert.equal(buttons.length,guest?1:2);
  for(const b of buttons){await b.onclick();assert.equal(root.querySelector('[data-withdrawal-message]').textContent,'Zurückgenommen.');await b.onclick();assert.match(root.querySelector('[data-withdrawal-message]').textContent,/Kein bestehender/)}
  assert.ok(calls.every(c=>(c.args.p_enabled??c.args.p_granted)===false));
 }
 report.dom??=[];report.dom.push({user:u,state,guest,calls});
}
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[O,'info@duelvanta.de','owner'],[A,'d1-a@example.invalid','player'],[B,'d1-b@example.invalid','player'],[C,'d1-c@example.invalid','player']]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);await db.query("insert into public.profiles(id,email,role,account_status,age_band,conduct_accepted_at,conduct_version) values($1,$2,$3,'beta','18_plus',now(),'battle-v1-2026-09')",[u,email,role]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(u),u])}
 await db.query("update public.profiles set account_status='active' where id=$1",[B]);
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1','battle-player-processing-hold-v1','battle-player-processing-hold-readiness-v1','battle-signal-processing-hold-v1','battle-signal-processing-hold-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 const before=(await db.query(signalSecurityQuery)).rows[0].jsonb_agg;
 const metadataSQL="select p.oid,p.proname,p.proacl::text,p.proconfig,p.prosecdef,pg_get_userbyid(p.proowner) owner from pg_proc p where p.oid in('public.set_battle_spectator_link(uuid,boolean)'::regprocedure,'public.set_battle_spectator_media_consent(uuid,boolean)'::regprocedure) order by p.oid";
 const metadata=(await db.query(metadataSQL)).rows;
 const candidate=await read('database/battle-spectator-withdrawal-v1.sql');await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(signalSecurityQuery)).rows[0].jsonb_agg;
 assert.equal(after.length,before.length);assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1].split('(')[0]),['public.set_battle_spectator_link','public.set_battle_spectator_media_consent']);assert.deepEqual((await db.query(metadataSQL)).rows,metadata);
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,false);await db.exec(await read('database/battle-spectator-withdrawal-readiness-v1.sql'));assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
 pass('exactly two existing setter bodies; same signatures/ACL/Definer/owners; all other functions, RLS, tables, triggers and general status/eligibility unchanged; idempotent readiness');
 if(epochHold){await db.exec(await read('database/battle-spectator-epoch-processing-hold-v1.sql'));await db.exec(await read('database/battle-spectator-epoch-processing-hold-readiness-v1.sql'));}
 if(process.argv.includes('--staff-hold')){
  if(!process.argv.includes('--spectator-epoch-hold'))throw Error('D3 regression requires D2');
  await db.exec(await read('database/staff-processing-hold-v1.sql'));
  await db.exec(await read('database/staff-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--publication-hold')){
  if(!process.argv.includes('--staff-hold'))throw Error('D4 requires closed D3');
  await db.exec(await read('database/publication-processing-hold-v1.sql'));
  await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 if(process.argv.includes('--b1-safety')){await db.exec(await read('database/battle-safety-sanctions-v1.sql'));await db.exec(await read('database/battle-safety-sanctions-readiness-v1.sql'));}
 if(process.argv.includes('--c-withdrawal')){await db.exec(await read('database/account-deletion-withdrawal-v1.sql'));await db.exec(await read('database/account-deletion-withdrawal-readiness-v1.sql'));}
 if(process.argv.includes('--l1-erasure')){await db.exec(await read('database/account-erasure-l1-v1.sql'));await db.exec(await read('database/account-erasure-l1-readiness-v1.sql'));}


 }
 await db.exec('update battle_spectator_media_private.config set media_enabled=true');
 for(const u of [A,B])for(const s of ['normal','processing','closure']){
  for(const sql of [link,consent])await tx(async()=>{const f=await setup(u);await hold(u,s);await claim(u);if(s!=='normal'){await deny(sql,[f.m,true]);for(const rpc of ['get_battle_spectator_status','get_battle_spectator_media_status','get_battle_spectator_media_publisher_admission'])await deny(`select public.${rpc}($1)`,[f.m]);}else{assert.ok(await scalar(sql,[f.m,true]));await claim(f.other);f.epoch=(await scalar('select public.get_battle_spectator_media_status($1) v',[f.m])).epoch;await owner();await db.query('delete from battle_spectator_media_private.revocations where match_id=$1',[f.m])}
   const original=await snap();const post=await checkWithdrawal(f,sql,u);assert.equal(post['public.battle_matches'][0].status,'live');assert.deepEqual(post['auth.sessions'],original['auth.sessions']);assert.deepEqual(post['public.profiles'],original['public.profiles']);assert.deepEqual(post['battle_spectator_media_private.consents'].filter(x=>x.user_id!==u),original['battle_spectator_media_private.consents'].filter(x=>x.user_id!==u));assert.equal(post['battle_spectator_private.presence'].length,sql===link?0:1);assert.equal(post['battle_spectator_private.grants'].length,sql===link?0:1);
   await claim(C);await deny('select public.reserve_battle_spectator_media_viewer($1,$2)',[f.m,f.tab],sql===link?/spectator_media_presence_required/:/spectator_media_closed/);
   await claim(null,'service_role');const q=(await db.query('select * from public.get_pending_battle_spectator_media_revocations()')).rows;assert.equal(q.length,1);assert.equal(await scalar('select public.complete_battle_spectator_media_revocation($1) v',[q[0].id]),true);assert.equal(await scalar('select public.complete_battle_spectator_media_revocation($1) v',[q[0].id]),false);
  });
  await tx(async()=>{const f=await setup(u===A?B:A);await hold(u,s);await claim(u);await deny(link,[f.m,false],/spectator_link_host_only/);await checkWithdrawal(f,consent,u)});
  await tx(async()=>{const m=await match(u);await hold(u,s);const old=await snap();await claim(u);if(s!=='normal')for(const sql of [link,consent])await deny(sql,[m,true]);for(let i=0;i<2;i++)for(const sql of [link,consent])assert.equal((await scalar(sql,[m,false])).withdrawn,false);assert.deepEqual(await snap(),old)});
  pass(`${u===A?'A':'B'} ${s}: true boundary, host/guest false, other consent preserved, immediate old-epoch queue, replay/missing no-op, no Auth/Match deletion, viewer denial, unchanged service completion`);
 }
 for(const u of [A,B])await tx(async()=>{
  const f=await setup(u);await hold(u,'processing');await hold(C,'processing');const baseline=await snap();
  await claim(C);for(const sql of [link,consent])await deny(sql,[f.m,false],/spectator_link_host_only|spectator_media_player_only/);
  for(const extra of [{session_id:null},{session_id:uid(9999)},{session_id:sid(C)},{session_id:'bad'},{is_anonymous:true}]){await claim(u,'authenticated',extra);for(const sql of [link,consent])await deny(sql,[f.m,false],/spectator_session_unavailable|spectator_not_authenticated/)}
  await owner();await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sid(u)]);await claim(u);await deny(consent,[f.m,false],/spectator_session_unavailable/);await owner();await db.query('update auth.sessions set not_after=null where id=$1',[sid(u)]);
  for(const role of ['anon','service_role','authenticated']){await claim(u,role);if(role!=='authenticated')for(const sql of [link,consent])await deny(sql,[f.m,false],/permission denied|spectator_not_authenticated/);for(const table of ['battle_spectator_private.links','battle_spectator_media_private.consents','battle_spectator_media_private.epochs','battle_spectator_media_private.revocations'])await deny(`delete from ${table}`,[],/permission denied/);for(const sql of ["update battle_spectator_private.links set enabled=false","insert into battle_spectator_private.links(match_id,enabled) values($1,false)","update battle_spectator_media_private.consents set granted=false","insert into battle_spectator_media_private.consents(match_id,user_id,consent_version,granted) values($1,auth.uid(),'x',false)"]){await deny(sql,sql.includes('$1')?[f.m]:[],/permission denied/)}await deny("select battle_spectator_media_private.close_epoch($1,'player_withdrawal')",[f.m],/permission denied/);if(role!=='service_role')await deny('select * from public.get_pending_battle_spectator_media_revocations()',[],/permission denied/)}
  await claim(u,'postgres',{role:'service_role'});await deny(consent,[f.m,false],/spectator_not_authenticated/);
  await claim(C,'postgres',{role:'authenticated'});await deny(consent,[f.m,false],/spectator_media_player_only/);
  assert.deepEqual(await snap(),baseline);
  await claim(u,'postgres',{role:'authenticated'});assert.equal((await scalar(consent,[f.m,false])).withdrawn,true,'definer owner does not gain another actor; valid own session still works');
  pass(`${u===A?'A':'B'} foreign, missing/fake/foreign/expired/anonymous sessions, anon/service/private DML and privileged execution contexts`);
 });
 for(const u of [A,B])for(const s of ['normal','processing','closure'])await tx(async()=>{
  const f=await setup(u);await hold(u,s);
  for(const status of ['waiting','ready','live','dispute','completed','cancelled']){await owner();await db.query('update public.battle_matches set status=$1 where id=$2',[status,f.m]);await claim(u);for(const sql of [link,consent]){const allowed=(sql===link?['waiting','ready','live','dispute']:['waiting','ready','live']).includes(status);if(allowed)await scalar(sql,[f.m,false]);else await deny(sql,[f.m,false],/spectator_link_host_only|spectator_media_player_only/)}}
  await owner();await db.query("update public.battle_matches set status='live',visibility='public' where id=$1",[f.m]);await claim(u);await deny(link,[f.m,false],/spectator_link_host_only/);
 });pass('A/B all three states: existing status boundaries, dispute distinction, completed/cancelled and public-link denial');
 await tx(async()=>{const f=await setup();await claim(A);await deny(link,[f.m,null],/spectator_link_host_only/);await deny(consent,[f.m,null],/spectator_media_invalid_consent/);await deny(link,[uid(999999),false],/spectator_link_host_only/);await deny(consent,[uid(999999),false],/spectator_media_player_only/);await hold(O,'processing');await claim(O);await deny(consent,[f.m,false],/spectator_media_player_only/)});pass('NULL/missing match rejected and staff ownership grants no foreign withdrawal');
 for(const field of ["safety_restricted=true","account_status='suspended'","age_band=null","conduct_accepted_at=null"])await tx(async()=>{const f=await setup();await owner();await db.exec('update public.profiles set '+field+" where id='"+A+"'");await claim(A);for(const sql of [link,consent])await deny(sql,[f.m,false])});pass('no general non-Hold Safety/account/age/conduct exception');
 await tx(async()=>{const f=await setup();await owner();await db.query('update battle_spectator_private.links set enabled=false,secret_hash=null where match_id=$1',[f.m]);await hold(A,'processing');await claim(A);assert.equal((await scalar(link,[f.m,false])).withdrawn,false);assert.equal((await queue(f.m))[0].epoch,f.epoch);const after=await snap();await claim(A);await scalar(link,[f.m,false]);assert.deepEqual(await snap(),after)});pass('legacy disabled-link/open-epoch cleanup queues the necessary old epoch once, without polling');
 await tx(async()=>{const m=await match();await claim(A);await scalar(link,[m,true]);await scalar(consent,[m,true]);await owner();const epoch=await scalar('select epoch v from battle_spectator_media_private.epochs where match_id=$1',[m]);await db.query('delete from battle_spectator_media_private.revocations where match_id=$1',[m]);await hold(A,'closure');await claim(A);assert.equal((await scalar(consent,[m,false])).withdrawn,true);assert.equal((await queue(m)).length,0);assert.equal(await scalar('select epoch v from battle_spectator_media_private.epochs where match_id=$1',[m]),epoch)});pass('existing consent with closed epoch withdraws without unnecessary rotation/queue');
 for(const u of [A,B])for(const state of ['normal','processing','closure'])await tx(()=>domScenario(u,state));
 for(const u of [A,B])await tx(()=>domScenario(u,'closure',true));
 pass('eight actual HTML/Safety/withdrawal-module DOM + SQL scenarios: reachable own false, guest host-link absent, no status calls, no Arena release');
 if(process.argv.includes('--browser')){const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});try{for(const u of [A,B])for(const s of ['normal','processing','closure'])await tx(()=>browserScenario(browser,u,s));for(const u of [A,B])await tx(()=>browserScenario(browser,u,'closure',true))}finally{await browser.close()}pass('eight real Chromium / SQL-backed scenarios: normal hidden, A/B Hold/Closure host+guest withdrawal reachable outside Safety-hidden Arena, explicit false only, replay message')}
 if(native){
  // Setter races need no viewer tabs; keep the existing spectator tab limit intact.
  const observer=await db.connect();

  async function race(c,sql,args,release,label,expected){const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;const p=c.query(sql,args).then(r=>({ok:true,value:r.rows[0]?.v}),e=>({ok:false,error:e.message}));let waiting=false;for(let i=0;i<100;i++){if((await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid])).rows[0].n){waiting=true;break}await new Promise(r=>setTimeout(r,20))}assert.equal(waiting,true,label+' must actually block');await release();const result=await p;expected(result);report.races.push({label,blocked:true,result});}
  for(const u of [A,B])for(const sql of [link,consent]){
   const f=await setup(u,false),c=await db.connect();await db.exec('begin');await hold(u,'processing');await claim(u,'authenticated',{},c);
   await race(c,sql,[f.m,true],()=>db.exec('commit'),'Hold vs true '+u+' '+(sql===link?'link':'consent'),r=>{assert.equal(r.ok,false);assert.match(r.error,/spectator_battle_access_required/)});
   await claim(u);await db.exec('begin');assert.equal((await scalar(sql,[f.m,false])).withdrawn,true);
   await race(c,sql,[f.m,false],()=>db.exec('commit'),'duplicate false '+u+' '+(sql===link?'link':'consent'),r=>{assert.equal(r.ok,true);assert.equal(r.value.withdrawn,false)});
   assert.equal((await queue(f.m)).length,1);await owner();await db.query('update public.profiles set data_processing_restricted_at=null where id=$1',[u]);
  }
  for(const u of [A,B]){
   const f=await setup(u,false),c=await db.connect();await hold(u,'processing');await hold(f.other,'processing');await claim(u);await db.exec('begin');await scalar(consent,[f.m,false]);await claim(f.other,'authenticated',{},c);
   await race(c,consent,[f.m,false],()=>db.exec('commit'),'host/guest simultaneous consent false '+u,r=>{assert.equal(r.ok,true);assert.equal(r.value.withdrawn,true)});assert.equal((await queue(f.m)).length,1);
   await owner();await db.query('update public.profiles set data_processing_restricted_at=null where id=any($1::uuid[])',[[u,f.other]]);
   const status=await setup(u,false);await db.exec('begin');await owner();await db.query("update public.battle_matches set status='completed' where id=$1",[status.m]);await claim(u,'authenticated',{},c);
   await race(c,consent,[status.m,false],()=>db.exec('commit'),'status change vs false '+u,r=>{assert.equal(r.ok,false);assert.match(r.error,/spectator_media_player_only/)});
  }
  for(const u of [A,B]){
   const f=await setup(u,false),c=await db.connect();await db.exec('begin');await hold(u,'processing');await claim(u,'authenticated',{},c);
   await race(c,consent,[f.m,false],()=>db.exec('commit'),'Hold vs false '+u,r=>{assert.equal(r.ok,true);assert.equal(r.value.withdrawn,true)});
   await owner();await db.query('update public.profiles set data_processing_restricted_at=null where id=$1',[u]);
   const f2=await setup(u,false);await owner();await db.exec('begin');await db.query('select id from public.battle_matches where id=$1 for update',[f2.m]);
   await race(c,link,[f2.m,false],async()=>{await observer.query('delete from auth.sessions where id=$1',[sid(u)]);await db.exec('commit')},'session revoked while setter waits '+u,r=>{assert.equal(r.ok,false);assert.match(r.error,/spectator_session_unavailable/)});
   await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(u),u]);
  }
  pass('native PG17 actual blocking-lock races: A/B Hold-vs-true, duplicate link/consent false, host/guest concurrent false, completed status-vs-false');
 }
 await owner();assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);report.passed=true;
}catch(e){report.error={message:e.message,detail:e.detail,where:e.where,stack:e.stack};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback');await owner()}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/battle-spectator-withdrawal-${native?'native':'wasm'}${epochHold?'-d2':''}.json`,JSON.stringify(report,null,2))}
