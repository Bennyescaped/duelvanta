// Disposable SQL acceptance. PGlite precheck never claims native PG17.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {database,setup,scalar,copyInput,save,uuid} from './helpers/tcg-i3-magic-fixture.mjs';
import {admin,claim,A,B} from './helpers/publication-hold-fixture.mjs';
const native=process.argv.includes('--native'),rows=[];
const report={engine:native?'native-PG17':'PGlite',native_acceptance:false,passed:false,cases:rows};let db;
const enabled=async value=>{await admin(db);await db.query('update dv_collect_private.tcg_magic_on_demand_beta set enabled=$1',[value]);await claim(db,A);};
async function denied(fn,pattern){await db.exec('savepoint denied_case');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint denied_case');await db.exec('release savepoint denied_case');}}
async function check(name,fn){await admin(db);await db.exec('begin');try{await fn();rows.push({name,status:native?'PASS':'PGLITE_PRECHECK_PASS'});console.log('PASS',name);}finally{await db.exec('rollback');await admin(db);}}
const ready=async()=>scalar(db,'select public.get_security_schema_readiness_v1() v');
const beta=async()=>scalar(db,'select public.get_magic_on_demand_collection_beta_v1() v');
// Native only: two independent race participants plus a read-only owner observer.
// Poll actual server lock edges, never infer blocking from elapsed sleep alone.
async function observedBetaLock(waiter,blocker,pending){
 const deadline=Date.now()+6000;let polls=0;
 while(Date.now()<deadline){
  await db.query('select pg_stat_clear_snapshot()');
  const row=(await db.query(`select pid,state,wait_event_type,wait_event,query,
   pg_blocking_pids(pid) blockers,
   (select coalesce(jsonb_agg(jsonb_build_object('locktype',locktype,'mode',mode,'granted',granted,'transactionid',transactionid::text)),'[]'::jsonb) from pg_locks where pid=a.pid and not granted) waiting_locks,
   (select coalesce(jsonb_agg(jsonb_build_object('locktype',locktype,'mode',mode,'granted',granted,'relation',relation::regclass::text)),'[]'::jsonb) from pg_locks where pid=$2 and relation='dv_collect_private.tcg_magic_on_demand_beta'::regclass and granted) blocker_beta_relation_locks
   from pg_stat_activity a where pid=$1`,[waiter,blocker])).rows[0];polls++;
  assert.equal(pending.settled,false,'Race query completed without the required observed block');
  if(row?.state==='active'&&row.wait_event_type==='Lock'&&row.blockers.includes(blocker)&&row.waiting_locks.length&&row.blocker_beta_relation_locks.length){
   return {...row,blocker_pid:blocker,polls,observed_at:new Date().toISOString(),pending_observed:true};
  }
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 throw new Error('Native Magic beta blocking edge not observed within 6000ms');
}
function raceQuery(fn){const state={settled:false};state.result=fn().then(value=>{state.settled=true;return {ok:true,value};},error=>{state.settled=true;return {ok:false,error};});return state;}
async function nativeBetaRace(id){
 assert.equal(native,true);assert.equal(db.native,true);assert.equal(Math.floor(Number(db.version)/10000),17);
 await admin(db);await db.query('update dv_collect_private.tcg_magic_on_demand_beta set enabled=true');
 const before=Number(await scalar(db,"select count(*) v from public.collection_items where tcg='magic'"));
 const a=await db.connect(),b=await db.connect();let pending;
 try{
  const pids=await Promise.all([db,a,b].map(c=>scalar(c,'select pg_backend_pid() v')));assert.equal(new Set(pids).size,3);
  for(const c of [a,b])await c.query("set statement_timeout='10s';set lock_timeout='8s';set idle_in_transaction_session_timeout='15s'");
  await claim(a,A);await admin(b);
  assert.equal(await scalar(a,'select current_user v'),'authenticated');assert.equal(await scalar(a,'select auth.uid() v'),A);
  assert.equal(await scalar(b,'select current_user v'),'postgres');
  await a.query('begin isolation level read committed');await b.query('begin isolation level read committed');
  let item,observed,result;
  if(id==='NATIVE_LOCK_01'){
   item=await save(a,null);assert.ok(item);
   pending=raceQuery(()=>b.query('update dv_collect_private.tcg_magic_on_demand_beta set enabled=false where game_key=\'magic\''));
   observed=await observedBetaLock(pids[2],pids[1],pending);
   assert.match(observed.query,/update dv_collect_private\.tcg_magic_on_demand_beta/);
   assert.equal(await scalar(db,"select enabled v from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic'"),true);
   assert.equal(Number(await scalar(db,"select count(*) v from public.collection_items where tcg='magic'")),before,'Uncommitted save must remain invisible');
   await a.query('commit');result=await pending.result;assert.equal(result.ok,true,result.error?.message);assert.equal(result.value.rowCount,1);await b.query('commit');
   assert.equal(Number(await scalar(db,"select count(*) v from public.collection_items where tcg='magic'")),before+1);
   assert.deepEqual((await db.query('select user_id,tcg from public.collection_items where id=$1',[item])).rows,[{user_id:A,tcg:'magic'}]);
  }else{
   assert.equal(id,'NATIVE_LOCK_02');await b.query("update dv_collect_private.tcg_magic_on_demand_beta set enabled=false where game_key='magic'");
   pending=raceQuery(()=>save(a,null));observed=await observedBetaLock(pids[1],pids[2],pending);
   assert.match(observed.query,/save_my_tcg_collection_item_v1/);
   assert.equal(await scalar(db,"select enabled v from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic'"),true,'Observer cannot see uncommitted disable');
   await b.query('commit');result=await pending.result;assert.equal(result.ok,false);assert.match(result.error.message,/magic_beta_unavailable/);await a.query('rollback');
   assert.equal(Number(await scalar(db,"select count(*) v from public.collection_items where tcg='magic'")),before,'Disabled-beta race must create no item');
  }
  assert.equal(pending.settled,true);assert.equal(await scalar(db,"select enabled v from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic'"),false);
  const evidence={name:id,status:'PASS',pids:{observer:pids[0],authenticated_a:pids[1],owner_b:pids[2]},observed_lock:observed,released_after_commit:true,beta_after:false,write_outcome:id==='NATIVE_LOCK_01'?'committed_before_disable':'rejected_after_disable',new_items:id==='NATIVE_LOCK_01'?1:0,error:id==='NATIVE_LOCK_02'?result.error.message:null};
  rows.push(evidence);console.log('PASS',id,JSON.stringify(evidence));
 }finally{
  // Release the blocker first on either failure path; all query waits are bounded.
  await (id==='NATIVE_LOCK_01'?a:b).query('rollback');if(pending)await pending.result;
  await (id==='NATIVE_LOCK_01'?b:a).query('rollback');
 }
}
try{
 db=await database(native);await setup(db);
 if(native){report.version=db.version;report.postgres_major=Math.floor(Number(db.version)/10000);assert.equal(report.postgres_major,17);assert.match(db.name,/^tcg_m4_[0-9a-f]{32}$/);assert.equal(await scalar(db,'select current_database() v'),db.name);report.connection={host:'127.0.0.1',port:Number(process.env.PGPORT||5432),database:db.name,disposable:true,production_staging_connection:false};}
 assert.equal((await ready()).compatible,true);
 const policiesBefore=(await db.query("select polname,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check_expr from pg_policy where polrelid='public.collection_items'::regclass order by polname")).rows;
 const marketBefore=await scalar(db,"select pg_get_constraintdef(oid) v from pg_constraint where conrelid='public.market_listings'::regclass and conname='market_listings_tcg_check'");
 const canonicalBefore=(await db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) body from pg_proc where oid in ('dv_collect_private.tcg_require_current_catalog_ref_v1()'::regprocedure,'dv_collect_private.tcg_publish_catalog_snapshot_v1(uuid,bigint)'::regprocedure,'public.set_my_collection_catalog_link_v1(uuid,uuid)'::regprocedure,'public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure)")).rows;
 for(const p of ['tcg-i3-magic-on-demand-v1.sql','tcg-i3-magic-on-demand-readiness-v1.sql'])await db.exec(await readFile(new URL('../database/'+p,import.meta.url),'utf8'));
 await check('authored cumulative readiness preserves every existing collection policy and canonical/sidecar/export/erasure function',async()=>{
  assert.equal((await ready()).compatible,true);assert.equal((await scalar(db,'select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
  assert.deepEqual((await db.query("select polname,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check_expr from pg_policy where polrelid='public.collection_items'::regclass order by polname")).rows,policiesBefore);
  assert.deepEqual((await db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) body from pg_proc where oid in ('dv_collect_private.tcg_require_current_catalog_ref_v1()'::regprocedure,'dv_collect_private.tcg_publish_catalog_snapshot_v1(uuid,bigint)'::regprocedure,'public.set_my_collection_catalog_link_v1(uuid,uuid)'::regprocedure,'public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure)")).rows,canonicalBefore);
 });
 await check('Magic writes unavailable by default and no snapshot required by schema',async()=>{await claim(db,A);assert.equal((await beta()).magic_on_demand_collection_beta,false);await denied(()=>save(db,null),/magic_beta_unavailable/);await admin(db);assert.equal(Number(await scalar(db,'select count(*) v from dv_collect_private.tcg_catalog_snapshots')),0);});
 await check('enabled beta create edit delete owns legacy ID without canonical or provider links',async()=>{
  await enabled(true);const id=await save(db,null);assert.ok(id);assert.equal(await scalar(db,'select tcg v from public.collection_items where id=$1',[id]),'magic');await save(db,id,{...copyInput(),quantity:3,notes:'Own copy'});assert.equal(await scalar(db,'select quantity v from public.collection_items where id=$1',[id]),3);
  await admin(db);assert.equal(Number(await scalar(db,'select count(*) v from dv_collect_private.collection_item_catalog_links')),0);assert.equal(Number(await scalar(db,'select count(*) v from dv_collect_private.tcg_provider_refs')),0);await claim(db,A);await db.query('delete from public.collection_items where id=$1',[id]);assert.equal(Number(await scalar(db,'select count(*) v from public.collection_items where id=$1',[id])),0);
 });
 await check('explicit eight languages save including CN; no DE default or OTHER',async()=>{await enabled(true);for(const language of ['EN','DE','FR','IT','ES','JP','KR','CN']){const id=await save(db,null,{...copyInput(),language});assert.equal(await scalar(db,'select language v from public.collection_items where id=$1',[id]),language);}for(const language of [null,'','OTHER','PT'])await denied(()=>save(db,null,{...copyInput(),language}),/collection_item_enum_invalid/);});
 await check('closed RPC rejects user ID, beta boolean and canonical ID from browser',async()=>{await enabled(true);for(const [key,value] of [['user_id',B],['magic_on_demand_collection_beta',true],['card_id',uuid(99)]])await denied(()=>save(db,null,{...copyInput(),[key]:value}),/collection_item_input_invalid/);});
 await check('beta table has RLS and zero anon authenticated service privileges',async()=>{assert.equal(await scalar(db,"select relrowsecurity v from pg_class where oid='dv_collect_private.tcg_magic_on_demand_beta'::regclass"),true);for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar(db,"select has_table_privilege($1,'dv_collect_private.tcg_magic_on_demand_beta',$2) v",[role,privilege]),false);await claim(db,A);await denied(()=>db.exec('update dv_collect_private.tcg_magic_on_demand_beta set enabled=true'),/permission denied/);});
 await check('anon and service_role cannot execute new readiness or save RPC',async()=>{for(const role of ['anon','service_role'])for(const signature of ['public.get_magic_on_demand_collection_beta_v1()','public.save_my_tcg_collection_item_v1(uuid,text,jsonb)'])assert.equal(await scalar(db,'select has_function_privilege($1,$2,$3) v',[role,signature,'EXECUTE']),false);await claim(db,A,'authenticated',{is_anonymous:true});await denied(()=>beta(),/authentication_required/);await denied(()=>save(db,null),/authentication_required/);});
 await check('direct Magic insert remains forbidden even with beta enabled',async()=>{await enabled(true);await denied(()=>db.query("insert into public.collection_items(user_id,tcg,card_name,language) values($1,'magic','Direct','EN')",[A]),/row-level security/);});
 await check('other owner read edit delete denied by RLS and controlled RPC',async()=>{await enabled(true);const id=await save(db,null);await claim(db,B);assert.equal(Number(await scalar(db,'select count(*) v from public.collection_items where id=$1',[id])),0);await denied(()=>save(db,id),/tcg_parent_not_owned/);await db.query('update public.collection_items set quantity=8 where id=$1',[id]);await db.query('delete from public.collection_items where id=$1',[id]);await claim(db,A);assert.equal(await scalar(db,'select quantity v from public.collection_items where id=$1',[id]),1);});
 await check('foreign binder folder rejected',async()=>{await enabled(true);await claim(db,B);const id=uuid(11);await db.query("insert into public.collection_folders(id,user_id,name) values($1,$2,'Foreign')",[id,B]);await claim(db,A);await denied(()=>save(db,null,{...copyInput(),folder_id:id}),/collection_folder_not_owned/);});
 await check('own binder folder works and remains maintainable after beta suspension',async()=>{await enabled(true);const folder=uuid(12);await db.query("insert into public.collection_folders(id,user_id,name) values($1,$2,'Magic Binder')",[folder,A]);const id=await save(db,null,{...copyInput(),folder_id:folder});await enabled(false);await save(db,id,{...copyInput(),folder_id:folder,quantity:2,condition:'LP',purchase_price:2.50,notes:'Suspended maintenance'});assert.equal(await scalar(db,'select folder_id v from public.collection_items where id=$1',[id]),folder);await db.query('update public.collection_items set folder_id=null where id=$1',[id]);assert.equal(await scalar(db,'select folder_id v from public.collection_items where id=$1',[id]),null);await db.query('delete from public.collection_items where id=$1',[id]);});
 await check('existing owner binder move/swap RPC supports Magic including suspended maintenance',async()=>{await enabled(true);const folder=uuid(13);await db.query("insert into public.collection_folders(id,user_id,name) values($1,$2,'Slots')",[folder,A]);const first=await save(db,null,{...copyInput(),folder_id:folder}),second=await save(db,null,{...copyInput(),folder_id:folder});const move=(id,slot)=>scalar(db,'select public.dv_collect_move_card($1,$2,1,$3::smallint) v',[id,folder,slot]);assert.equal((await move(first,1)).moved,true);await move(second,2);await enabled(false);assert.equal((await move(first,2)).swappedItemId,second);assert.equal(await scalar(db,'select binder_slot v from public.collection_items where id=$1',[first]),2);assert.equal(await scalar(db,'select binder_slot v from public.collection_items where id=$1',[second]),1);await claim(db,B);await denied(()=>move(first,3),/binder not found|card not found/);});
 await check('suspension blocks new copies and identity edits including direct UPDATE',async()=>{await enabled(true);const id=await save(db,null);await enabled(false);assert.equal((await beta()).magic_on_demand_collection_beta,false);await denied(()=>save(db,null),/magic_beta_unavailable/);await denied(()=>save(db,id,{...copyInput(),card_name:'Replacement'}),/magic_beta_identity_locked/);await denied(()=>db.query("update public.collection_items set card_number='999' where id=$1",[id]),/magic_beta_identity_locked/);await save(db,id,{...copyInput(),quantity:2});});
 await check('conversion from Pokemon and reassignment of owner forbidden',async()=>{await enabled(true);const id=uuid(21);await db.query("insert into public.collection_items(id,user_id,tcg,card_name) values($1,$2,'pokemon','Legacy')",[id,A]);await denied(()=>save(db,id),/tcg_parent_not_owned/);await denied(()=>db.query("update public.collection_items set tcg='magic',language='EN' where id=$1",[id]),/row-level security/);const magic=await save(db,null);await denied(()=>db.query("update public.collection_items set tcg='pokemon' where id=$1",[magic]),/magic_game_conversion_forbidden/);await denied(()=>db.query('update public.collection_items set user_id=$2 where id=$1',[magic,B]),/tcg_parent_not_owned/);});
 for(const field of ['data_processing_restricted_at','account_closure_requested_at'])await check(field+' prevents Magic create/edit/readiness and direct updates',async()=>{await enabled(true);const id=await save(db,null);await admin(db);await db.query('update public.profiles set '+field+'=clock_timestamp() where id=$1',[A]);await claim(db,A);assert.equal((await beta()).magic_on_demand_collection_beta,false);await denied(()=>save(db,null),/account_data_processing_restricted/);await denied(()=>save(db,id),/account_data_processing_restricted/);await denied(()=>db.query('update public.collection_items set quantity=2 where id=$1',[id]),/account_data_processing_restricted|row-level security/);});
 await check('suspended profile blocks beta creates and edits',async()=>{await enabled(true);const id=await save(db,null);await admin(db);await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);await claim(db,A);await denied(()=>save(db,id),/account_data_processing_restricted/);await denied(()=>save(db,null),/account_data_processing_restricted/);});
 await check('schema drift closes beta writes instead of manufacturing runtime expectations',async()=>{await enabled(true);await admin(db);await db.exec("grant select on dv_collect_private.tcg_magic_on_demand_beta to authenticated");assert.equal((await ready()).compatible,false);await claim(db,A);assert.equal((await beta()).magic_on_demand_collection_beta,false);await denied(()=>save(db,null),/magic_beta_schema_unavailable/);});
 await check('marketplace check byte-identical and Magic listing impossible',async()=>{assert.equal(await scalar(db,"select pg_get_constraintdef(oid) v from pg_constraint where conrelid='public.market_listings'::regclass and conname='market_listings_tcg_check'"),marketBefore);assert.doesNotMatch(marketBefore,/magic/);await enabled(true);await denied(()=>db.query("insert into public.market_listings(seller_id,tcg,card_name) values($1,'magic','Forbidden listing')",[A]),/check constraint|trade|listing/);});
 await check('Pokemon One Piece and Other preserve legacy saves under beta OFF and ON',async()=>{for(const state of [false,true]){await enabled(state);for(const [i,tcg] of ['pokemon','one_piece','other'].entries()){const id=uuid((state?40:30)+i);await db.query("insert into public.collection_items(id,user_id,tcg,card_name,card_number,language,notes) values($1,$2,$3,' Free text ','007A','OTHER','History')",[id,A,tcg]);await db.query("update public.collection_items set quantity=2,notes='Edited legacy' where id=$1",[id]);assert.equal(await scalar(db,'select language v from public.collection_items where id=$1',[id]),'OTHER');await db.query('delete from public.collection_items where id=$1',[id]);}}});
 assert.equal(rows.length,20);
 if(native)for(const id of ['NATIVE_LOCK_01','NATIVE_LOCK_02'])await nativeBetaRace(id);
 const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];assert.deepEqual(io.attempts,[]);
 report.passed=true;report.native_acceptance=native;report.version=native?db.version:null;
}catch(error){report.error={message:error.message,code:error.code};console.error(error);process.exitCode=1;}
finally{if(db)await db.close();const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io={forbidden_external_io_attempts:io.attempts.slice(),local_pg_connections:io.local_pg_connections,provider_live_requests:0,production_mutations:0,staging_mutations:0};if(io.attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}await mkdir('test-results',{recursive:true});await writeFile('test-results/tcg-i3-m6-database'+(native?'-native':'-precheck')+'.json',JSON.stringify(report,null,2)+'\n');}
