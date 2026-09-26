// Synthetic, isolated only. --native requires the localhost-only PG17 harness.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native'),lock=process.argv.includes('--trade-lock');
let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,lock,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`67000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C,EMPTY,HIST,OWNER]=[1,2,3,4,5,6].map(uid),M=uid(10),N=uid(11),WAIT=uid(12),DRAW=uid(13),PERIOD=uid(20),ORDER=uid(21);
const schemas=['public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private','auth'];
const qi=s=>'"'+s.replaceAll('"','""')+'"';
const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal1',session_id:uid(100+Number(u?.slice(-2)||0))})]);await db.exec('set role '+role)};
const exported=()=>scalar('select public.export_my_duelvanta_data() v');
const clean=p=>{const {export_version,generated_at,scope_note,scanner,battle,...rest}=structuredClone(p);delete rest.marketplace.pickup_messages;return rest};
const auditRows=()=>db.query('select * from dv_market_private.user_data_export_events order by id').then(x=>x.rows);
let tables,sequences;
const snapshot=async()=>{
 const result={};
 for(const t of tables.filter(x=>x.name!=='dv_market_private.user_data_export_events'))result[t.name]=await scalar(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) v from ${t.name} t`);
 for(const t of sequences)result[t.name]=await scalar(`select jsonb_build_object('last_value',last_value,'is_called',is_called) v from ${t.name}`);
 return result;
};
const successfulExport=async (u,role='authenticated')=>{
 await db.exec('reset role');const before=await snapshot(),events=await auditRows();
 await claim(u,role);const p=await exported();await db.exec('reset role');
 assert.deepEqual(await snapshot(),before,'no domain row or sequence changes');
 const after=await auditRows();assert.equal(after.length,events.length+1,'exactly one audit event');
 for(const e of events)assert.deepEqual(after.find(x=>x.id===e.id),e,'old audit events immutable');
 const added=after.find(x=>!events.some(e=>e.id===x.id));
 assert.equal(added.export_version,'duelvanta-data-export-v3');
 assert.equal(added.export_format,'application/json');
 assert.equal(await scalar("select user_id_hash=extensions.digest($2,'sha256') and content_sha256=extensions.digest($3::jsonb::text,'sha256') v from dv_market_private.user_data_export_events where id=$1",[added.id,u,JSON.stringify(p)]),true);
 return p;
};
try{
 await securitySchemaFixture(db);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'info@duelvanta.de',now())",[OWNER]);
 await db.query("insert into public.profiles(id,email,role,account_status) values($1,'info@duelvanta.de','owner','beta')",[OWNER]);
 for(const f of ['database/auth-privileged-step-up-v1.sql','database/security-privilege-mfa-hardening-v1.sql','database/security-readiness-v1.sql'])await db.exec(await read(f));
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
 let baselineCatalog=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const oldExport=await scalar("select pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure) v");
 const exportAcl=await scalar("select proacl::text v from pg_proc where oid='public.export_my_duelvanta_data()'::regprocedure");
 const pickup=await scalar("select pg_get_functiondef('dv_market_private.pickup_messages_for_export(uuid)'::regprocedure) v");
 assert.ok(oldExport.includes('duelvanta-data-export-v1'));assert.ok(!oldExport.includes('pickup_messages_for_export'));
 pass('actual hardened V1 baseline and overwritten Pickup entry reproduced');

 for(const u of [A,B,C,EMPTY,HIST]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[u,`synthetic-${u.slice(-2)}@example.invalid`]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,'player','active','18_plus')",[u,`synthetic-${u.slice(-2)}@example.invalid`]);
  await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal1')",[uid(100+Number(u.slice(-2))),u]);
 }
 // Raw fixture inserts in the disposable database only; no application providers.
 await db.query("insert into public.collection_folders(id,user_id,name) values($1,$2,'own binder'),($3,$4,'FOREIGN_BINDER_CANARY')",[uid(30),A,uid(31),B]);
 await db.query("insert into public.collection_items(id,user_id,tcg,card_name,folder_id) values($1,$2,'pokemon','own card',$3),($4,$5,'pokemon','FOREIGN_CARD_CANARY',$6)",[uid(32),A,uid(30),uid(33),B,uid(31)]);
 await db.query("update public.profiles set data_processing_restricted_at='2026-09-01' where id=$1",[HIST]);
 await db.query("insert into dv_v16_private.credit_period(id,starts_at,ends_at,credit_limit,prior_credits,reserved_credits,active) values($1,'2020-01-01','2020-02-01',1000,100,40,false)",[PERIOD]);
 for(const [i,u] of [A,B,HIST].entries()){
  await db.query("insert into dv_v16_private.weekly_usage values($1,'2020-01-06',2,1)",[u]);
  await db.query("insert into dv_v16_private.scan_reservation(user_id,request_id,period_id,week_start,image_sha256,tcg,kind,credits,reserved_at) values($1,$2,$3,'2020-01-06',$4,'pokemon','raw',10,'2020-01-07')",[u,uid(40+i),PERIOD,String(i+1).repeat(64)]);
 }
 for(const [i,u] of [A,B].entries()){
  await db.query("insert into dv_v16_private.openai_weekly_usage values($1,'2026-09-21',1,1),($1,'2026-09-14',3,0)",[u]);
  await db.query("insert into dv_v16_private.openai_scan_reservation(user_id,request_id,week_start,image_sha256,tcg,kind,reserved_eur_micros,estimated_cost_eur_micros,estimated_cost_usd_micros,input_tokens,output_tokens,settled_at,reserved_at) values($1,$2,'2026-09-21',$3,'pokemon','raw',500000,1234,1400,100,20,'2026-09-22','2026-09-21'),($1,$4,'2026-09-14',$5,'one_piece','slab',500000,null,null,null,null,null,'2026-09-15')",[u,uid(50+i),String(i+4).repeat(64),uid(60+i),String(i+6).repeat(64)]);
 }
 await db.exec("update dv_v16_private.openai_scan_policy set accounting_key_sha256=repeat('a',64)");
 await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,mode,visibility,host_ready,guest_ready,host_result,guest_result,winner_id,invite_code,title,host_display_name,guest_display_name,moderator_id,moderation_note) values($1,$2,$3,'pokemon','completed','ranked','private',true,false,'host','host',$2,'INVITE_SECRET_CANARY','TITLE_CANARY','HOST_NAME_CANARY','GUEST_NAME_CANARY',$4,'STAFF_NOTE_CANARY')",[M,A,B,C]);
 await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status) values($1,$2,$3,'one_piece','live'),($4,$5,null,'pokemon','waiting'),($6,$3,$5,'pokemon','completed')",[N,B,C,WAIT,A,DRAW]);
 await db.query("update public.battle_matches set host_result='draw',guest_result='draw' where id=$1",[DRAW]);
 await db.query("insert into public.battle_rating_events(match_id,tcg,host_id,guest_id,host_before,host_after,guest_before,guest_after,host_delta,guest_delta,result) values($1,'pokemon',$2,$3,1000,1016,1900,1884,16,-16,'host')",[M,A,B]);
 await db.query("insert into public.battle_ratings(user_id,tcg,rating,games,wins,losses,draws) values($1,'pokemon',1016,1,1,0,0),($2,'pokemon',1884,1,0,1,0)",[A,B]);
 await db.query("insert into public.battle_signals(match_id,sender_id,signal_type,payload) values($1,$2,'offer','{\"sdp\":\"SDP_TOKEN_CANARY\",\"ip\":\"IP_CANARY\"}'),($1,$3,'answer','{\"sdp\":\"FOREIGN_SIGNAL_CANARY\"}')",[M,A,B]);
 await db.query("insert into public.battle_reports(match_id,reporter_id,reported_user_id,category,details,reviewer_id,reviewer_note) values($1,$2,$3,'other','REPORT_CANARY',$4,'JUDGE_CANARY')",[M,A,B,C]);
 await db.query("insert into battle_spectator_private.links(match_id,secret_hash,enabled) values($1,repeat('b',64),true) on conflict(match_id) do update set secret_hash=excluded.secret_hash,enabled=true",[N]);
 await db.query("insert into battle_spectator_private.grants(match_id,user_id,generation) values($1,$2,$3),($4,$5,$6)",[N,A,uid(71),M,C,uid(72)]);
 await db.query("insert into battle_spectator_private.presence(match_id,user_id,session_id,tab_id,expires_at) values($1,$2,$3,$4,'2020-01-01'),($5,$6,$7,$8,'2030-01-01')",[N,A,uid(101),uid(73),M,C,uid(103),uid(74)]);
 await db.query("insert into battle_spectator_media_private.consents(match_id,user_id,consent_version,granted) values($1,$2,'spectator-media-v1-2026-09',false),($1,$3,'spectator-media-v1-2026-09',true)",[M,A,B]);
 // Restore synthetic historical swap rows (new swaps are deliberately retired).
 // This fixture-only import is finished before any export or guard assertions.
 await db.exec('set session_replication_role=replica');
 await db.query("insert into dv_market_private.market_swap_threads(id,party_a_id,party_b_id,fulfillment_mode) values($1,$2,$3,'pickup')",[ORDER,A,B]);
 await db.query("insert into dv_market_private.market_pickup_messages(context_type,context_id,sender_id,body) values('swap',$1,$2,'Own pickup message'),('swap',$1,$3,'Existing counterpart pickup answer')",[ORDER,A,B]);
 await db.exec('set session_replication_role=origin');
 // P0-05 closes new trade even during replica imports. Load historical fixtures
 // first, then apply the unchanged lock candidate ONLY to this disposable DB.
 if(lock){
  for(const f of ['database/market-production-trade-lock-v1.sql','database/market-production-trade-lock-readiness-v1.sql'])await db.exec(await read(f));
  assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,true);
  baselineCatalog=(await db.query(securityQuery)).rows[0].jsonb_agg;
 }
 await claim(A);const oldA=await exported();await db.exec('reset role');
 const expectedPickup=await scalar('select dv_market_private.pickup_messages_for_export($1) v',[A]);
 assert.equal(expectedPickup.length,2);assert.equal(oldA.marketplace.pickup_messages,undefined);

 const candidate=await read('database/account-data-export-collect-battle-v1.sql');
 await db.exec(candidate);const firstDefinition=await scalar("select pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure) v");
 await db.exec(candidate);assert.equal(await scalar("select pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure) v"),firstDefinition);
 assert.equal(await scalar("select pg_get_functiondef('dv_market_private.pickup_messages_for_export(uuid)'::regprocedure) v"),pickup);
 assert.equal(await scalar("select proacl::text v from pg_proc where oid='public.export_my_duelvanta_data()'::regprocedure"),exportAcl,'existing public export permissions unchanged');
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,false,'old contract rejects changed implementation');
 const afterCatalog=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const changed=afterCatalog.filter(x=>!baselineCatalog.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1]).sort();
 assert.deepEqual(changed,['dv_market_private.collect_battle_export_for_caller()','public.export_my_duelvanta_data()']);
 assert.equal(baselineCatalog.filter(x=>!afterCatalog.some(y=>y[0]===x[0]&&y[1]===x[1])).length,0);
 pass('candidate reapplication; exactly two function changes; Pickup/ACL/RLS/holds/erasure unchanged');
 await db.exec(await read('database/account-data-export'+(lock?'-trade-lock':'')+'-readiness-v1.sql'));
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
 pass('matching security and legal readiness passes; stale contract fails closed');
 if(process.argv.includes('--processing-markers')){
  assert.ok(lock,'G1 requires P0-05/T2 base');
  await db.exec(await read('database/account-processing-markers-v1.sql'));
  await db.exec(await read('database/account-processing-markers-readiness-v1.sql'));
  assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
  pass('G1 installed before complete T2 export/audit regression');
 }

 tables=(await db.query("select quote_ident(n.nspname)||'.'||quote_ident(c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1) and c.relkind='r' order by 1",[schemas])).rows;
 sequences=(await db.query("select quote_ident(n.nspname)||'.'||quote_ident(c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1) and c.relkind='S' order by 1",[schemas])).rows;
 report.guardedTables=tables.length;report.checkedSequences=sequences.length;
 report.columns=(await db.query("select n.nspname schema,c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) type from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where c.relkind='r' and a.attnum>0 and not a.attisdropped and (n.nspname in ('dv_v16_private','battle_spectator_private','battle_spectator_media_private') or (n.nspname='public' and (c.relname like 'battle_%' or c.relname in ('staff_permissions','staff_applications','admin_audit_log')))) order by 1,2,a.attnum")).rows;
 const inventory=JSON.parse(await read('database/account-data-export-collect-battle-fields-v1.json'));
 assert.deepEqual(inventory.fields.map(({schema,table_name,column_name,type})=>({schema,table_name,column_name,type})),report.columns,'every actual field must have a reviewed decision');
 assert.ok(inventory.fields.every(x=>x.owner&&x.reason&&['AUFNAHME','FILTER/ABLEITUNG','EIGENE PROJEKTION','AUSSCHLUSS','REST/AUSSCHLUSS'].includes(x.status)));
 pass('196 field decisions cover the actual 25-table scanner/BATTLE/staff schema');
 // Before-statement guards also catch writes matching zero rows, beyond hash comparison.
 await db.exec(`create schema t2_test_guard;
 create function t2_test_guard.reject_write() returns trigger language plpgsql as $$begin raise exception 'T2_UNEXPECTED_WRITE %.% %',tg_table_schema,tg_table_name,tg_op;end$$;`);
 for(const t of tables)await db.exec(`create trigger t2_reject_write before ${t.name==='dv_market_private.user_data_export_events'?'update or delete or truncate':'insert or update or delete or truncate'} on ${t.name} for each statement execute function t2_test_guard.reject_write()`);
 await assert.rejects(()=>db.exec('update dv_v16_private.openai_monthly_cost set successful_scans=successful_scans where false'),/T2_UNEXPECTED_WRITE/);
 pass('all persistent fixture tables guarded against unexpected DML including zero-row writes');

 const a=await successfulExport(A),b=await successfulExport(B);
 assert.equal(a.export_version,'duelvanta-data-export-v3');assert.deepEqual(clean(a),clean(oldA));
 assert.deepEqual(a.marketplace.pickup_messages,expectedPickup);
 assert.ok(!JSON.stringify(a.marketplace.pickup_messages).includes(B));
 pass('existing payload and withdrawals retained; Pickup restored via unchanged helper only');
 assert.equal(a.scanner.openai_reservations.length,2);assert.equal(b.scanner.openai_reservations.length,2);
 assert.deepEqual(a.scanner.openai_weekly_usage.map(x=>x.week_start),['2026-09-14','2026-09-21']);
 assert.equal(a.scanner.openai_reservations[0].settled_at,null);assert.equal(a.scanner.openai_reservations[1].input_tokens,100);
 assert.equal(a.scanner.historical_reservations[0].credits,10);
 assert.ok(!JSON.stringify(a.scanner).includes(uid(51)));assert.ok(!JSON.stringify(b.scanner).includes(uid(50)));
 pass('two-user current settled/unsettled and historical scanner ownership');
 const am=a.battle.matches.find(x=>x.match_id===M),bm=b.battle.matches.find(x=>x.match_id===M);
 assert.equal(am.participant_role,'host');assert.equal(am.my_ready,true);assert.equal(am.my_reported_result,'self');assert.equal(am.my_outcome,'won');
 assert.equal(bm.participant_role,'guest');assert.equal(bm.my_ready,false);assert.equal(bm.my_reported_result,'opponent');assert.equal(bm.my_outcome,'lost');
 assert.ok(!a.battle.matches.some(x=>x.match_id===N));assert.equal(a.battle.matches.find(x=>x.match_id===WAIT).my_outcome,null);
 assert.equal(a.battle.matches.find(x=>x.match_id===DRAW).my_outcome,'draw');
 assert.equal(a.battle.rating_events[0].rating_before,1000);assert.equal(b.battle.rating_events[0].rating_before,1900);
 assert.equal(a.battle.ratings[0].rating,1016);assert.equal(b.battle.ratings[0].rating,1884);
 pass('host/guest self projection; no opponent ratings; waiting/draw and foreign match boundaries');
 assert.equal(a.battle.signal_metadata.length,1);assert.equal(a.battle.signal_metadata[0].signal_type,'offer');
 assert.deepEqual(a.battle.spectator_grants,[{match_id:N}]);assert.equal(a.battle.spectator_presence.length,1);
 assert.equal(a.battle.media_consents[0].granted,false);assert.equal(b.battle.media_consents[0].granted,true);
 pass('own signal metadata, expired presence, grants and withdrawn consent; no cleanup/admission calls');
 const added=JSON.stringify(a);
 for(const secret of [B,C,uid(101),uid(73),uid(71),'a'.repeat(64),'b'.repeat(64),'INVITE_SECRET_CANARY','TITLE_CANARY','HOST_NAME_CANARY','GUEST_NAME_CANARY','STAFF_NOTE_CANARY','SDP_TOKEN_CANARY','IP_CANARY','REPORT_CANARY','JUDGE_CANARY','FOREIGN_SIGNAL_CANARY'])assert.ok(!added.includes(secret),secret);
 const forbidden=['user_id','host_id','guest_id','winner_id','moderator_id','session_id','tab_id','invite_code','secret_hash','accounting_key_sha256','payload','generation','epoch','moderation_note','reviewer_note','reports','staff','judge'];
 const checkKeys=o=>{if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){assert.ok(!forbidden.includes(k),k);checkKeys(v)}};
 checkKeys({scanner:a.scanner,battle:a.battle});
 const expectedKeys={
  openai_reservations:'request_id week_start image_sha256 tcg kind reserved_eur_micros eur_per_usd_micros estimated_cost_eur_micros estimated_cost_usd_micros input_tokens output_tokens settled_at reserved_at',
  openai_weekly_usage:'week_start raw_used slab_used',historical_reservations:'request_id week_start image_sha256 tcg kind credits reserved_at',historical_weekly_usage:'week_start raw_used slab_used',
  matches:'match_id tcg mode visibility language status started_at completed_at created_at updated_at participant_role my_ready my_reported_result my_outcome',
  ratings:'tcg rating games wins losses draws updated_at',rating_events:'event_id match_id tcg created_at rating_before rating_after rating_delta my_outcome',
  signal_metadata:'signal_id match_id signal_type created_at',spectator_grants:'match_id',spectator_presence:'match_id expires_at',media_consents:'match_id consent_version granted updated_at'
 };
 for(const [key,rows] of Object.entries({...a.scanner,...a.battle}))for(const row of rows)assert.deepEqual(Object.keys(row).sort(),expectedKeys[key].split(' ').sort(),key+' exact field allowlist');
 assert.ok(!JSON.stringify(a).includes('FOREIGN_BINDER_CANARY'));assert.ok(!JSON.stringify(a).includes('FOREIGN_CARD_CANARY'));
 pass('secret/session/signal/report/staff canaries absent; explicit extension keys and collection isolation');
 const again=await successfulExport(A);assert.deepEqual({...again,generated_at:null},{...a,generated_at:null});
 const e=await successfulExport(EMPTY);for(const x of Object.values(e.scanner))assert.deepEqual(x,[]);for(const x of Object.values(e.battle))assert.deepEqual(x,[]);
 const h=await successfulExport(HIST);assert.deepEqual(h.scanner.openai_reservations,[]);assert.equal(h.scanner.historical_reservations.length,1);assert.equal(h.scanner.historical_weekly_usage.length,1);
 pass('repeatable output, empty account and historical-only account; one hash-bound audit event per call');
 const owner=await successfulExport(OWNER);assert.ok(Object.values(owner.scanner).every(x=>x.length===0));assert.ok(Object.values(owner.battle).every(x=>x.length===0));
 pass('Owner role does not broaden export ownership');
 // Preserve the existing RPC ACL: service_role has EXECUTE but still needs a
 // subject. This T2 change does not redesign existing session/authorization rules.
 const service=await successfulExport(A,'service_role');assert.deepEqual(service.scanner,a.scanner);assert.deepEqual(service.battle,a.battle);
 for(const [u,role] of [[null,'authenticated'],[A,'anon'],[null,'service_role']]){
  await db.exec('reset role');const before=await snapshot(),events=await auditRows();await claim(u,role);
  await assert.rejects(exported,/authentication_required|permission denied/,`caller ${role} ${u}`);await db.exec('reset role');
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await auditRows(),events);
 }
 await claim(A);await assert.rejects(()=>db.query('select dv_market_private.collect_battle_export_for_caller()'),/permission denied/);
 await assert.rejects(()=>db.query('select * from dv_v16_private.openai_scan_reservation'),/permission denied/);
 await assert.rejects(()=>db.query('select public.export_my_duelvanta_data($1::uuid)',[B]),/does not exist/);
 await db.exec('reset role');pass('missing subject/anon denied; existing service ACL remains subject-bound; no owner argument or private access');
 // Added columns must not leak through a future schema extension.
 await db.exec("alter table dv_v16_private.openai_scan_reservation add column future_secret text default 'FUTURE_SECRET_CANARY';alter table public.battle_matches add column future_private_data text default 'FUTURE_BATTLE_CANARY'");
 const future=await successfulExport(A);assert.ok(!JSON.stringify(future).includes('FUTURE_'));
 pass('future scanner/match columns excluded by projection');
 await db.exec('alter table dv_v16_private.openai_scan_reservation drop column future_secret;alter table public.battle_matches drop column future_private_data');
 report.passed=true;
}catch(e){report.error=e.message;console.error(e);process.exitCode=1}
finally{await db.close();await mkdir('test-results',{recursive:true});await writeFile(`test-results/account-data-export-${native?'native':'pglite'}${lock?'-lock':''}${process.argv.includes('--processing-markers')?'-g1':''}.json`,JSON.stringify(report,null,2));}
