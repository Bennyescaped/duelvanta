// P4: disposable native PG17 only. No production operator entry or schema fork.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const out='test-results/tcg-i3-m6-p4',sha=b=>createHash('sha256').update(b).digest('hex');
const sources=[
 ['database/tcg-i3-magic-on-demand-v1.sql','b13bfde57c7647e2fd1471886ef870a65e5b6bf9608c0c4da869133f2f1303af'],
 ['database/tcg-i3-magic-on-demand-readiness-v1.sql','5f31e1fe864175b449bed520186a9c2ed73b46d7308c6f06ac9b6e9d764e0324']
];
const payloadHash='10637648e9ca2281665d4971f0c334d87ac6a79be4ab5fa19731a554c12d4808';
const fixtureHash='960df122f5c68b0a63284c75dd8e20efce8aa4bd9f208d10ac6ac2d7c734a5aa';
const names=['PRE_M6_BASELINE','ATOMIC_M6_SCHEMA_APPLY','BETA_DEFAULT_OFF','POST_APPLY_SCHEMA_READINESS','ACTIVATION_PRECHECK_PASS','ACTIVATION_REHEARSAL','EXACT_UGIN_SAVE','UGIN_SQL_READBACK_RLS','BINDER_MOVE','KILL_SWITCH_WITH_ITEM','POST_KILL_BEHAVIOR','SECURITY_DRIFT_FAIL_CLOSED','LEGAL_DRIFT_FAIL_CLOSED','PROVIDER_OR_RELEASE_DRIFT_FAIL_CLOSED','ATOMIC_APPLY_ROLLBACK','BOTH_LOCK_DIRECTIONS','PARITY_AND_CLOSED_CAPABILITIES'];
const caseNames=names.map((n,i)=>'P4_'+String(i+1).padStart(2,'0')+' '+n);

// Client host is attested by the harness, not confused with Docker's server IP.
// No write fragment admits a hosted/project database or an unknown environment.
const TARGET_PREDICATE=String.raw`current_setting('server_version_num')::integer / 10000=17
 and current_user='postgres' and current_database() ~ '^tcg_m4_[0-9a-f]{32}$'
 and current_setting('duelvanta.p4_environment',true)='DISPOSABLE_PG17'
 and current_setting('duelvanta.p4_client_host',true)='127.0.0.1'
 and current_setting('duelvanta.p4_disposable',true)='true'
 and current_setting('duelvanta.p4_production_staging_connection',true)='false'`;
const TARGET_GUARD_SQL=`DO $target$ BEGIN IF NOT coalesce((${TARGET_PREDICATE}),false)
 THEN RAISE EXCEPTION 'p4_target_not_attested'; END IF; END $target$;`;
// SELECT only. The same query is executed directly and inside both write guards.
const PRECHECK_SQL=String.raw`WITH checks AS (SELECT
 coalesce((`+TARGET_PREDICATE+String.raw`),false) AS target,
 public.get_security_schema_readiness_v1() AS security_readiness,
 public.get_market_legal_schema_readiness_v1() AS legal_readiness,
 exists(select 1 from dv_collect_private.tcg_games where game_key='magic'
   and registry_version='1' and not available and not collection_ready and not marketplace_ready) AS foundation,
 exists(select 1 from dv_collect_private.tcg_provider_bindings
   where (game_key,provider_key,provider_version)=('magic','scryfall','1'))
 and exists(select 1 from dv_collect_private.tcg_providers where provider_key='scryfall' and display_name='Scryfall') AS provider,
 exists(select 1 from dv_collect_private.tcg_catalog_releases
   where (game_key,provider_key,provider_version)=('magic','scryfall','1')
     and activation_contract='magic-collect-catalog-v1'
     and scope_sha256='a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa'
     and descriptor_sha256='52d7223aa087a90bca1464a8e67b2fe8ae58b272c8c7993803bbad83394d1909'
     and state='foundation' and schema_phase='persistence' and release_generation=0
     and snapshot_id is null and source_terms_review_ref is null and attribution_review_ref is null) AS release,
 (select count(*)=1 and coalesce(bool_and(game_key='magic' and contract='magic-on-demand-collect-beta/1'
   and provider_key='scryfall' and provider_version='1'
   and enabled::text=current_setting('duelvanta.p4_expected_enabled',true)),false)
   from dv_collect_private.tcg_magic_on_demand_beta) AS beta,
 exists(select 1 from pg_constraint where conrelid='public.market_listings'::regclass
   and conname='market_listings_tcg_check' and contype='c' and convalidated
   and position('magic' in lower(pg_get_constraintdef(oid)))=0) AS marketplace,
 to_regprocedure('dv_collect_private.tcg_magic_on_demand_schema_v1()') is not null
 and to_regprocedure('public.get_magic_on_demand_collection_beta_v1()') is not null
 and to_regprocedure('public.save_my_tcg_collection_item_v1(uuid,text,jsonb)') is not null
 and to_regprocedure('public.dv_collect_move_card(uuid,uuid,integer,smallint)') is not null AS rpcs
), validated AS (SELECT *,
 coalesce((security_readiness->>'compatible')::boolean,false)
   and security_readiness->>'revision'='privilege-mfa-v1'
   and security_readiness->>'tcg_beta_contract'='magic-on-demand-collect-beta/1' AS security,
 coalesce((legal_readiness->>'compatible')::boolean,false)
   and legal_readiness->>'revision'='trade-legal-contract-model-v1.2'
   and legal_readiness->>'tcg_beta_contract'='magic-on-demand-collect-beta/1' AS legal
 FROM checks)
SELECT to_jsonb(v)||jsonb_build_object('ready',coalesce(target and foundation and provider and release
 and beta and marketplace and rpcs and security and legal,false)) AS v FROM validated v`;
function writeFragment(enable){
 return `BEGIN ISOLATION LEVEL READ COMMITTED;\n${TARGET_GUARD_SQL}\nDO $cutover$ DECLARE r jsonb; BEGIN
 perform 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' for update;
 select v into strict r from (${PRECHECK_SQL}) precheck;
 if r->>'ready' is distinct from 'true' then raise exception 'p4_${enable?'activation':'kill'}_precheck_failed' using detail=r::text; end if;
 if current_setting('duelvanta.p4_expected_enabled',true) is distinct from '${!enable}' then raise exception 'p4_unexpected_beta_state'; end if;
 update dv_collect_private.tcg_magic_on_demand_beta set enabled=${enable} where game_key='magic' and enabled=${!enable};
 if not found then raise exception 'p4_beta_state_changed'; end if;
 END $cutover$;\nCOMMIT;`;
}
const ACTIVATE_SQL=writeFragment(true),KILL_SQL=writeFragment(false);
const fragments={TARGET_GUARD_SQL,PRECHECK_SQL,ACTIVATE_SQL,KILL_SQL};
function operatorPackage(){
 return `-- M6 P4-R1: executed SQL fragments, disposable PG17 only. NICHT FUER REAL APPLY.
-- No real target/baseline/write approval. PRECHECK is the default; explicit target attestation is mandatory.
-- Schema sources remain unchanged; verify their hashes before using the bound checkout.
${sources.map(([p,h])=>'-- '+h+'  '+p).join('\n')}
\\set ON_ERROR_STOP on
\\if :{?p4_action}
\\else
  \\set p4_action PRECHECK
\\endif
\\if :{?p4_client_host}
\\else
  \\set p4_client_host UNATTESTED
\\endif
\\if :{?p4_disposable}
\\else
  \\set p4_disposable false
\\endif
\\if :{?p4_production_staging_connection}
\\else
  \\set p4_production_staging_connection true
\\endif
SELECT set_config('duelvanta.p4_environment','DISPOSABLE_PG17',false),
 set_config('duelvanta.p4_client_host',:'p4_client_host',false),
 set_config('duelvanta.p4_disposable',:'p4_disposable',false),
 set_config('duelvanta.p4_production_staging_connection',:'p4_production_staging_connection',false),
 set_config('duelvanta.p4_expected_enabled',CASE WHEN :'p4_action'='KILL_SWITCH' THEN 'true' ELSE 'false' END,false);
SELECT :'p4_action'='PRECHECK' AS p4_precheck, :'p4_action'='SCHEMA_APPLY' AS p4_schema,
 :'p4_action'='ACTIVATE' AS p4_activate, :'p4_action'='KILL_SWITCH' AS p4_kill
\\gset
\\if :p4_precheck
${PRECHECK_SQL};
\\elif :p4_schema
${TARGET_GUARD_SQL}
-- PRE-M6 admission and atomic source-pair behavior are proven in P4_01/P4_02/P4_15.
-- File 1 rejects incompatible foundation; file 2 completes that same transaction. Beta remains OFF.
\\ir ../../database/tcg-i3-magic-on-demand-v1.sql
\\ir ../../database/tcg-i3-magic-on-demand-readiness-v1.sql
${PRECHECK_SQL};
\\elif :p4_activate
${ACTIVATE_SQL}
\\elif :p4_kill
${KILL_SQL}
\\else
DO $invalid$ BEGIN RAISE EXCEPTION 'p4_unknown_action'; END $invalid$;
\\endif
-- Kill is enabled=false, never schema removal. No item-existence dependency.
-- PRECHECK, target guard, ACTIVATE and KILL are emitted from the executed constants.
`;
}
const json=async p=>JSON.parse(await readFile(p,'utf8'));
async function bindInputs(){
 const bound=[];for(const [path,hash] of sources){const bytes=await readFile(path);assert.equal(sha(bytes),hash,path);bound.push({path,sha256:hash,bytes:bytes.length,sql:bytes.toString('utf8')});}
 const bytes=await readFile('test-results/tcg-i3-m6-p3/browser-payload.json');assert.equal(sha(bytes),payloadHash);
 const payload=JSON.parse(bytes);assert.equal(sha(await readFile('tests/fixtures/tcg-i3-magic/m6-p2-r1-live-response.json')),fixtureHash);assert.equal(payload.fixture_sha256,fixtureHash);
 const keys=['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'].sort();
 assert.deepEqual(payload.rpc.map(c=>c.name),['save_my_tcg_collection_item_v1','save_my_tcg_collection_item_v1','dv_collect_move_card','save_my_tcg_collection_item_v1']);
 for(const c of payload.rpc.filter(x=>x.name==='save_my_tcg_collection_item_v1'))assert.deepEqual(Object.keys(c.args.p_item).sort(),keys);
 const browser=await json('test-results/tcg-i3-m6-p3/browser-report.json');assert.equal(browser.passed,true);assert.equal(browser.payload.sha256,payloadHash);
 const m6=await json('test-results/tcg-i3-m6/native-report.json'),p3=await json('test-results/tcg-i3-m6-p3/native-report.json'),binding=await json('test-results/tcg-i3-m6/binding.json');
 for(const r of [m6,p3]){assert.equal(r.passed,true);assert.equal(r.native_acceptance,true);assert.equal(r.engine,'native-PG17');}
 assert.equal(m6.cases.length,22);assert.equal(p3.cases.length,11);assert.ok([...m6.cases,...p3.cases].every(c=>c.status==='PASS'));assert.equal(p3.browser_payload_sha256,payloadHash);
 return {bound,payload,m6,p3,binding};
}
function verifyLocks(m6){
 const locks=m6.cases.slice(20);assert.deepEqual(locks.map(c=>c.name),['NATIVE_LOCK_01','NATIVE_LOCK_02']);
 for(const c of locks){assert.equal(c.status,'PASS');assert.equal(new Set(Object.values(c.pids)).size,3);assert.ok(Object.values(c.pids).every(Number.isInteger));assert.equal(c.observed_lock.wait_event_type,'Lock');assert.equal(c.observed_lock.state,'active');assert.ok(c.observed_lock.blockers.includes(c.observed_lock.blocker_pid));assert.ok(c.observed_lock.waiting_locks.length);assert.ok(c.observed_lock.blocker_beta_relation_locks.length);assert.equal(c.observed_lock.pending_observed,true);assert.equal(c.released_after_commit,true);assert.equal(c.beta_after,false);}
 assert.equal(locks[0].new_items,1);assert.equal(locks[0].write_outcome,'committed_before_disable');assert.equal(locks[1].new_items,0);assert.equal(locks[1].write_outcome,'rejected_after_disable');assert.match(locks[1].error,/magic_beta_unavailable/);return locks;
}
async function verifyEvidence(){
 const {bound,binding,m6}=await bindInputs(),r=await json(out+'/native-report.json');
 assert.equal(r.passed,true);assert.equal(r.native_acceptance,true);assert.equal(r.engine,'native-PG17');assert.equal(r.postgres_major,17);
 assert.deepEqual(r.cases.map(c=>c.name),caseNames);assert.ok(r.cases.every(c=>c.status==='PASS'));assert.deepEqual(r.ci,binding);
 assert.equal(r.connection.host,'127.0.0.1');assert.equal(r.connection.current_user,'postgres');assert.equal(r.connection.disposable,true);assert.equal(r.connection.production_staging_connection,false);assert.match(r.connection.database,/^tcg_m4_[0-9a-f]{32}$/);
 assert.equal(r.browser_payload_sha256,payloadHash);assert.deepEqual(r.sources,bound.map(({sql,...x})=>x));
 assert.deepEqual(r.fragments,Object.fromEntries(Object.entries(fragments).map(([k,v])=>[k,sha(v)])));
 assert.deepEqual(r.cases[15].evidence.locks,verifyLocks(m6));assert.equal(r.cases[14].evidence.restored,true);
 for(const c of r.cases.slice(11,14)){assert.equal(c.evidence.precheck.ready,false);assert.equal(c.evidence.beta_after,false);assert.equal(c.evidence.before_write_denied,true);}
 assert.deepEqual(r.io.forbidden_external_io_attempts,[]);for(const k of ['provider_live_requests','production_mutations','staging_mutations','real_database_connections'])assert.equal(r.io[k],0);
 const bytes=await readFile(out+'/operator-package-validated.sql');assert.equal(bytes.toString(),operatorPackage());assert.equal(sha(bytes),r.operator_package_sha256);assert.equal(r.real_beta_enabled,false);
 const proof={contract:'m6-p4-evidence/1',passed:true,ci:binding,native_cases:17,m6_cases:22,p3_cases:11,browser_payload_sha256:payloadHash,operator_package_sha256:sha(bytes),new_provider_live_requests:0,production_mutations:0,staging_mutations:0,real_database_connections:0};
 await writeFile(out+'/evidence-verification.json',JSON.stringify(proof,null,2)+'\n');console.log('PASS P4 evidence verification',JSON.stringify(proof));
}
if(process.argv.includes('--verify-evidence')){
 try{await verifyEvidence();}catch(error){console.error(error);process.exitCode=1;}
}else if(process.argv.includes('--static-contract-check')){
 assert.equal(caseNames.length,17);assert.equal(new Set(caseNames).size,17);
 assert.ok(PRECHECK_SQL.startsWith('WITH'));assert.doesNotMatch(PRECHECK_SQL,/\b(insert|update|delete|drop|alter|create)\b/i);
 for(const x of [ACTIVATE_SQL,KILL_SQL]){assert.ok(x.indexOf('precheck_failed')<x.indexOf('update dv_collect_private'));assert.match(x,/for update/);assert.match(x,/COMMIT;$/);assert.doesNotMatch(x,/\bdrop\b/i);}
 assert.ok(operatorPackage().includes(PRECHECK_SQL));assert.ok(operatorPackage().includes(ACTIVATE_SQL));assert.ok(operatorPackage().includes(KILL_SQL));
 console.log('PASS P4 static contracts only; NOT native acceptance');
}else{
 const cases=caseNames.map(name=>({name,status:'NOT_RUN'})),report={contract:'m6-p4-native-activation-rehearsal/1',engine:'native-PG17',passed:false,native_acceptance:false,real_beta_enabled:false,cases};
 let db,currentCase,admin,claim,A,B,scalar,database,setup,phase='target_admission';
 const caseRun=async(i,fn)=>{currentCase=cases[i-1];await attest(db);currentCase.evidence=await fn()||{};currentCase.status='PASS';console.log('PASS',currentCase.name,JSON.stringify(currentCase.evidence));};
 const attest=async target=>{
  assert.equal(target.native,true);assert.equal(Math.floor(Number(target.version)/10000),17);assert.match(target.name,/^tcg_m4_[0-9a-f]{32}$/);assert.equal(process.env.PGHOST,'127.0.0.1');
  await admin(target);const r=(await target.query('select current_database() db,current_user owner')).rows[0];assert.equal(r.db,target.name);assert.equal(r.owner,'postgres');
  await target.query("select set_config('duelvanta.p4_environment','DISPOSABLE_PG17',false),set_config('duelvanta.p4_client_host','127.0.0.1',false),set_config('duelvanta.p4_disposable','true',false),set_config('duelvanta.p4_production_staging_connection','false',false)");
  await target.exec(TARGET_GUARD_SQL);
 };
 const expected=async value=>db.query("select set_config('duelvanta.p4_expected_enabled',$1,false)",[String(value)]);
 const betaState=()=>scalar(db,"select enabled v from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic'");
 const precheck=()=>scalar(db,PRECHECK_SQL);
 const cutover=async on=>{await attest(db);await expected(!on);await db.exec(on?ACTIVATE_SQL:KILL_SQL);assert.equal(await betaState(),on);};
 const denied=async(fn,pattern)=>{await db.exec('begin');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback');}};
 try{
  assert.ok(process.argv.includes('--native'),'P4 requires --native; no PGlite fallback');
  assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'postgres');assert.equal(process.env.PGUSER,'postgres');assert.equal(process.env.GITHUB_ACTIONS,'true','Only the authorized disposable Actions service');assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
  const {bound,payload:p,m6,p3,binding}=await bindInputs();assert.equal(binding.run_id,process.env.GITHUB_RUN_ID);assert.equal(binding.attempt,Number(process.env.GITHUB_RUN_ATTEMPT));assert.equal(binding.event,'pull_request');assert.equal(binding.head,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
  report.ci=binding;report.sources=bound.map(({sql,...x})=>x);report.browser_payload_sha256=payloadHash;report.fixture_sha256=fixtureHash;report.fragments=Object.fromEntries(Object.entries(fragments).map(([k,v])=>[k,sha(v)]));
  ({database,setup,scalar}=await import('./helpers/tcg-i3-magic-fixture.mjs'));({admin,claim,A,B}=await import('./helpers/publication-hold-fixture.mjs'));assert.equal(p.owner,A);
  db=await database(true);await attest(db);phase='existing_M4_fixture';await setup(db);await attest(db);phase='P4_harness';
  report.postgres_major=17;report.version=db.version;report.connection={host:'127.0.0.1',port:Number(process.env.PGPORT||5432),current_user:'postgres',database:db.name,disposable:true,production_staging_connection:false};
  const save=async(args,itemId=args.p_item_id)=>scalar(db,'select public.save_my_tcg_collection_item_v1($1,$2,$3::jsonb) v',[itemId,args.p_game_key,JSON.stringify(args.p_item)]);
  let id;const readback=async()=> (await db.query('select * from public.collection_items where id=$1',[id])).rows[0];
  const readiness=()=>scalar(db,'select public.get_magic_on_demand_collection_beta_v1() v');
  const move=()=>scalar(db,'select public.dv_collect_move_card($1,$2,$3::integer,$4::smallint) v',[id,p.binder_move.p_folder_id,p.binder_move.p_page,p.binder_move.p_slot]);
  const parity=[];
  const closed=async stage=>{
   const require=createRequire(import.meta.url),consumer=require('../tcg-v1-consumers.js'),registry=consumer.registry;
   for(const cap of ['marketplace','scanner','pricing','battle','sealed','grading']){assert.notEqual(registry.get('magic').capabilities[cap].status,'ready');assert.equal(registry.isEnabled('magic',cap,{release:true,environment:true,platform:true,account:true}),false);}
   assert.throws(()=>consumer.adapter('magic','scanner'),/TCG scope unavailable/);
   await claim(db,A);await denied(()=>db.query("insert into public.market_listings(seller_id,tcg,card_name) values($1,'magic','Forbidden P4 listing')",[A]),/check constraint|trade|listing/);
   await admin(db);const market=await scalar(db,"select pg_get_constraintdef(oid) v from pg_constraint where conrelid='public.market_listings'::regclass and conname='market_listings_tcg_check'");assert.doesNotMatch(market,/magic/);
   for(const table of ['tcg_catalog_snapshots','tcg_provider_refs','collection_item_catalog_links'])assert.equal(Number(await scalar(db,'select count(*) v from dv_collect_private.'+table)),0);
   return {stage,marketplace:'CLOSED',scanner:'CLOSED',pricing:'CLOSED',battle:'CLOSED',sealed:'CLOSED',grading:'CLOSED',market_constraint:market,full_catalog_required:false,canonical_snapshot_required:false};
  };
  const legacy=async stage=>{
   await claim(db,A);for(const game of ['pokemon','one_piece']){const item=await scalar(db,"insert into public.collection_items(user_id,tcg,card_name,card_number,language,notes) values($1,$2,' Free text ','007A','OTHER','Legacy') returning id v",[A,game]);await db.query("update public.collection_items set quantity=2,notes='Edited legacy' where id=$1",[item]);assert.deepEqual((await db.query('select tcg,card_name,card_number,language,quantity,notes from public.collection_items where id=$1',[item])).rows[0],{tcg:game,card_name:' Free text ',card_number:'007A',language:'OTHER',quantity:2,notes:'Edited legacy'});await db.query('delete from public.collection_items where id=$1',[item]);}
   parity.push({stage,pokemon:'PASS',one_piece:'PASS',closed:await closed(stage)});
  };
  await caseRun(1,async()=>{
   assert.equal(await scalar(db,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"),null);assert.equal(await scalar(db,"select to_regprocedure('public.get_magic_on_demand_collection_beta_v1()')::text v"),null);
   assert.equal((await scalar(db,'select public.get_security_schema_readiness_v1() v')).compatible,true);assert.equal((await scalar(db,'select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
   const release=(await db.query("select * from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows[0];assert.equal(release.state,'foundation');assert.equal(release.schema_phase,'persistence');
   await claim(db,A);await denied(()=>save(p.rpc[0].args),/tcg_collection_release_unavailable/);await legacy('PRE_M6');return {release,beta_table_absent:true,new_magic_blocked:true};
  });
  await caseRun(2,async()=>{
   assert.match(bound[0].sql,/\nbegin;/i);assert.doesNotMatch(bound[0].sql,/\bcommit\s*;/i);assert.match(bound[1].sql,/\bcommit;\s*$/i);
   const observer=await db.connect();assert.equal(await scalar(observer,'select current_user v'),'postgres');const before=await scalar(observer,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v");assert.equal(before,null);
   phase='M6_SQL_SOURCE';const first=await db.exec(bound[0].sql);const txid=await scalar(db,'select txid_current()::text v');assert.equal(await scalar(observer,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"),null);assert.equal(await scalar(db,'select txid_current()::text v'),txid);
   const second=await db.exec(bound[1].sql);phase='P4_harness';const firstCommands=(Array.isArray(first)?first:[first]).map(x=>x.command),secondCommands=(Array.isArray(second)?second:[second]).map(x=>x.command);assert.ok(!firstCommands.includes('COMMIT'));assert.equal(secondCommands.at(-1),'COMMIT');assert.equal(await scalar(db,'select txid_current_if_assigned()::text v'),null);assert.ok(await scalar(observer,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"));
   return {source_order:sources.map(x=>x[0]),transaction_id:txid,observer_pid:await scalar(observer,'select pg_backend_pid() v'),writer_pid:await scalar(db,'select pg_backend_pid() v'),intermediate_beta_visible:false,first_commands:firstCommands,second_commands:secondCommands,commits:1};
  });
  await caseRun(3,async()=>{
   const rows=(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows;assert.deepEqual(rows,[{game_key:'magic',contract:'magic-on-demand-collect-beta/1',provider_key:'scryfall',provider_version:'1',enabled:false}]);await claim(db,A);assert.equal((await readiness()).magic_on_demand_collection_beta,false);await denied(()=>save(p.rpc[0].args),/magic_beta_unavailable/);await legacy('POST_APPLY_OFF');return {rows,new_user_readiness:false};
  });
  await caseRun(4,async()=>{await expected(false);const r=await precheck();assert.equal(r.security,true);assert.equal(r.legal,true);assert.equal(r.rpcs,true);assert.equal(r.marketplace,true);assert.equal(await scalar(db,"select relrowsecurity v from pg_class where oid='dv_collect_private.tcg_magic_on_demand_beta'::regclass"),true);return r;});
  await caseRun(5,async()=>{
   await expected(false);const r=await precheck();assert.equal(r.ready,true);const rejected_targets=[];
   for(const [key,value] of [['duelvanta.p4_client_host','unknown'],['duelvanta.p4_disposable','false'],['duelvanta.p4_production_staging_connection','true']]){
    await db.query('select set_config($1,$2,false)',[key,value]);try{await assert.rejects(()=>db.exec(ACTIVATE_SQL),/p4_target_not_attested/);}finally{await db.exec('rollback');await attest(db);await expected(false);}assert.equal(await betaState(),false);rejected_targets.push({key,value,denied_before_write:true});
   }
   return {...r,rejected_targets};
  });
  await caseRun(6,async()=>{
   await cutover(true);await claim(db,A);assert.equal((await readiness()).magic_on_demand_collection_beta,true);
   await cutover(false);assert.equal(Number(await scalar(db,"select count(*) v from public.collection_items where tcg='magic'")),0);await claim(db,A);assert.equal((await readiness()).magic_on_demand_collection_beta,false);await cutover(true);await legacy('ACTIVATED_ON');return {enabled:true,eligible_user_ready:true,kill_without_item_pass:true};
  });
  await caseRun(7,async()=>{
   await claim(db,A);await db.query('insert into public.collection_folders(id,user_id,name,binder_pages) values($1,$2,$3,2)',[p.folder_id,A,'M6 P3 Magic Binder']);id=await save(p.rpc[0].args);assert.ok(id);report.native_item_id=id;report.insert_payload=p.rpc[0].args;return {payload_sha256:payloadHash,insert_payload:p.rpc[0].args,item_id:id,id_mapping_reason:'Only subsequent generated-item references are mapped; insert bytes unchanged'};
  });
  await caseRun(8,async()=>{
   await claim(db,A);const row=await readback();for(const [key,value] of Object.entries(p.rpc[0].args.p_item))if(key!=='contract_version')assert.deepEqual(row[key],value,key);assert.equal(row.user_id,A);assert.equal(row.tcg,'magic');assert.equal(row.market_price,null);assert.equal(row.purchase_price,null);for(const k of ['image_url','card_id','catalog_card_id','provider_ref_id'])if(Object.hasOwn(row,k))assert.equal(row[k],null);
   await admin(db);for(const table of ['collection_item_catalog_links','tcg_provider_refs','tcg_catalog_snapshots'])assert.equal(Number(await scalar(db,'select count(*) v from dv_collect_private.'+table)),0);
   await claim(db,B);assert.equal(Number(await scalar(db,'select count(*) v from public.collection_items where id=$1',[id])),0);await denied(()=>save(p.rpc[1].args,id),/collection_folder_not_owned/);assert.equal((await db.query('update public.collection_items set quantity=9 where id=$1 returning id',[id])).rows.length,0);assert.equal((await db.query('delete from public.collection_items where id=$1 returning id',[id])).rows.length,0);await denied(move,/binder not found|card not found/);
   await claim(db,A);assert.deepEqual(await readback(),row);await denied(()=>db.query("insert into public.collection_items(user_id,tcg,card_name,language) values($1,'magic','Direct','EN')",[A]),/row-level security/);return {readback:row,foreign_read_edit_delete_move_blocked:true,direct_magic_insert_blocked:true};
  });
  await caseRun(9,async()=>{await claim(db,A);assert.equal((await move()).moved,true);const row=await readback();assert.equal(row.binder_page,1);assert.equal(row.binder_slot,3);return {archived_operation:p.binder_move,native_item_id:id,page:row.binder_page,slot:row.binder_slot};});
  await caseRun(10,async()=>{await cutover(false);await claim(db,A);assert.equal((await readback()).id,id);await admin(db);assert.ok(await scalar(db,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"));return {enabled:false,item_retained:true,schema_retained:true};});
  await caseRun(11,async()=>{
   await claim(db,A);assert.equal((await readiness()).magic_on_demand_collection_beta,false);await denied(()=>save(p.rpc[0].args),/magic_beta_unavailable/);assert.equal(await save(p.rpc[3].args,id),id);
   assert.deepEqual(await move(),{moved:false,reason:'same_slot'});
   const maintenanceMove=await scalar(db,'select public.dv_collect_move_card($1,$2,1::integer,2::smallint) v',[id,p.binder_move.p_folder_id]);assert.equal(maintenanceMove.moved,true);assert.equal((await readback()).binder_slot,2);
   assert.equal((await move()).moved,true);const row=await readback();for(const [key,value] of Object.entries(p.readback))if(key!=='id')assert.deepEqual(row[key],value,key);await legacy('POST_KILL_OFF');return {new_item:'BLOCKED',existing_edit:'PASS',binder_maintenance:'PASS',same_slot_noop:'PASS',maintenance_move:maintenanceMove,restored_archived_slot:3,readiness:false,readback:row};
  });
  const drift=async(sql,field)=>{
   await expected(false);await db.exec('begin');let r,error;
   try{await db.exec(sql);r=await precheck();assert.equal(r[field],false);assert.equal(r.ready,false);await db.exec('savepoint activation_denied');try{await assert.rejects(()=>db.exec(ACTIVATE_SQL),e=>{error={message:e.message,code:e.code,detail:e.detail};return /p4_activation_precheck_failed/.test(e.message);});}finally{await db.exec('rollback to savepoint activation_denied');await db.exec('release savepoint activation_denied');}assert.equal(await betaState(),false);}
   finally{await db.exec('rollback');}assert.equal(await betaState(),false);assert.equal((await precheck()).ready,true);return {injected_sql:sql,precheck:r,error,before_write_denied:true,beta_after:false,restored:true};
  };
  await caseRun(12,()=>drift('grant select on dv_collect_private.tcg_magic_on_demand_beta to authenticated','security'));
  await caseRun(13,()=>drift('alter table dv_market_private.market_withdrawals alter column evidence_snapshot drop not null','legal'));
  await caseRun(14,()=>drift("update dv_collect_private.tcg_catalog_releases set descriptor_sha256=repeat('0',64) where game_key='magic'",'release'));
  await caseRun(15,async()=>{
   const fresh=await database(true);try{await attest(fresh);await setup(fresh);await attest(fresh);
    const snapshot=async()=>({relations:(await fresh.query("select n.nspname||'.'||c.relname name,c.relkind,c.relrowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_collect_private') order by 1")).rows,functions:(await fresh.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) body,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_collect_private') and p.prokind='f' order by 1")).rows,constraints:(await fresh.query("select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in ('public'::regnamespace,'dv_collect_private'::regnamespace) order by 1,2")).rows});
    const before=await snapshot();await fresh.exec(bound[0].sql);assert.ok(await scalar(fresh,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"));let error;await assert.rejects(()=>fresh.exec("DO $injected$ BEGIN RAISE EXCEPTION 'p4_injected_atomic_failure'; END $injected$;"),e=>{error={message:e.message,code:e.code};return /p4_injected_atomic_failure/.test(e.message);});await fresh.exec('rollback');const after=await snapshot();assert.deepEqual(after,before);assert.equal(await scalar(fresh,"select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text v"),null);assert.equal(await scalar(fresh,"select to_regprocedure('public.get_magic_on_demand_collection_beta_v1()')::text v"),null);assert.equal((await scalar(fresh,'select public.get_security_schema_readiness_v1() v')).compatible,true);
    return {database:fresh.name,before_sha256:sha(JSON.stringify(before)),after_sha256:sha(JSON.stringify(after)),relations:before.relations.length,functions:before.functions.length,constraints:before.constraints.length,error,restored:true,partial_beta:false,partial_rpc:false,partial_magic_constraint:false};
   }finally{await fresh.exec('rollback');await fresh.close();}
  });
  await caseRun(16,async()=>{assert.equal(binding.run_id,process.env.GITHUB_RUN_ID);return {ci:binding,m6_report_sha256:sha(await readFile('test-results/tcg-i3-m6/native-report.json')),locks:verifyLocks(m6),historical_substitution:false};});
  await caseRun(17,async()=>{assert.deepEqual(parity.map(x=>x.stage),['PRE_M6','POST_APPLY_OFF','ACTIVATED_ON','POST_KILL_OFF']);assert.equal(await betaState(),false);return {stages:parity,final:await closed('FINAL_OFF'),no_catalog_dependency:true,no_snapshot_dependency:true};});
  assert.equal(cases.filter(c=>c.status==='PASS').length,17);assert.deepEqual(globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')].attempts,[]);report.passed=true;report.native_acceptance=true;
 }catch(error){if(currentCase)currentCase.status='FAIL';report.error={phase,message:error.message,code:error.code,stack:error.stack};console.error(error);process.exitCode=1;}
 finally{
  if(db)try{await admin(db);await db.exec('rollback');await db.close();}catch(error){report.cleanup_error=error.message;report.passed=false;report.native_acceptance=false;process.exitCode=1;}
  const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io={forbidden_external_io_attempts:io?.attempts.slice()||[],local_pg_connections:io?.local_pg_connections||0,provider_live_requests:0,production_mutations:0,staging_mutations:0,real_database_connections:0};if(report.io.forbidden_external_io_attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}
  await mkdir(out,{recursive:true});if(report.passed){const bytes=operatorPackage();await writeFile(out+'/operator-package-validated.sql',bytes);report.operator_package_sha256=sha(bytes);console.log('PASS P4 native PG17 17/17',report.operator_package_sha256);}
  await writeFile(out+'/native-report.json',JSON.stringify(report,null,2)+'\n');
 }
}
