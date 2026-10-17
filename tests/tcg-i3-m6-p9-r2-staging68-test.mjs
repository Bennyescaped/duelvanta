// Native-only generation, exact live binding, additive package, replay and resume gates.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {generate,LIVE,OUT,PACKAGE,OUTPUTS,FIXTURE,read,sha,prefix,legacy,rootState,ROOTS_SQL,indexes} from './generate-tcg-staging68-readiness.mjs';
import {target,baseline} from './tcg-i3-m6-p6-production-native-test.mjs';
import {loadProductionUpgradeSources} from './helpers/production-upgrade-fixture.mjs';
import {remaining,fingerprint,readonly,statements} from './helpers/tcg-i3-m6-p7-migration-package.mjs';
const OLD='database/target-upgrades/staging-m6-v1';
const oldReadiness=['database/tcg-i2-readiness-staging-v1.sql','database/tcg-i3-magic-readiness-staging-v1.sql','database/tcg-i3-magic-on-demand-readiness-staging-v1.sql'];
const writeJSON=async(p,x)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(x,null,2)+'\n');};
function precheck(){const quote=s=>"'"+s.replaceAll("'","''")+"'";
 const signatures=LIVE.roots.root_signatures.map(x=>`('${x.name}','${x.body_md5}')`).join(',');
 return `-- NOT_AUTO_APPLY. History68 must be checked externally; no history writes or user data.
with observed as materialized (
 select current_setting('server_version_num')::int/10000 postgres_major,
 to_regclass('dv_collect_private.tcg_games') is not null i2_present,
 to_regclass('dv_collect_private.tcg_catalog_releases') is null m4_absent,
 to_regclass('dv_collect_private.tcg_magic_on_demand_beta') is null beta_absent,
 to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()') is null production_lock_absent,
 (select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') production_lock_triggers,
 (select jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready) order by c.relname collate "C") from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=to_regclass('public.collection_items')) indexes,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.collection_items') and conname='collection_items_tcg_check') collection_constraint,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.market_listings') and conname='market_listings_tcg_check') marketplace_constraint,
 (select count(*)=2 from (values ${signatures}) e(name,body) join pg_proc p on p.oid=to_regprocedure('public.'||e.name||'()') where md5(p.prosrc)=e.body and p.provolatile='s' and p.prosecdef) old_unit15_bodies_match
), roots as materialized (
 select x.security::jsonb security,x.legal::jsonb legal from xmltable('/table/row' passing query_to_xml(case when (select old_unit15_bodies_match from observed) then 'select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal' else 'select null::jsonb security,null::jsonb legal' end,true,false,'') columns security text path 'security/text()',legal text path 'legal/text()') x
), checks as (
 select o.*,r.security,r.legal,coalesce(o.postgres_major=17 and o.i2_present and o.m4_absent and o.beta_absent and o.production_lock_absent and o.production_lock_triggers=0 and o.old_unit15_bodies_match
 and o.indexes=${quote(JSON.stringify(LIVE.indexes))}::jsonb
 and o.collection_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text])))'
 and o.marketplace_constraint=o.collection_constraint
 and r.security='{"revision":"privilege-mfa-v1","compatible":true}'::jsonb
 and r.legal='{"revision":"trade-legal-contract-model-v1.2","compatible":false}'::jsonb,false) precheck_pass
 from observed o cross join roots r
) select precheck_pass as "PRECHECK_PASS",to_jsonb(checks)-'precheck_pass' evidence from checks;
`;}
async function packageFiles(g){
 const files={...g.files},oldManifest=JSON.parse(await read(OLD+'/manifest.json'));
 const names=['dv_staging_m6r2_01_i2_readiness_reconcile','dv_staging_m6r2_02_tcg_i3_magic_persistence','dv_staging_m6r2_03_tcg_i3_magic_on_demand'];
 const groups=[[OUTPUTS[0]],['database/tcg-i3-magic-persistence-v1.sql',OUTPUTS[1]],['database/tcg-i3-magic-on-demand-v1.sql',OUTPUTS[2]]];
 const units=[];
 for(let i=0;i<3;i++){
  const paths=groups[i],sources=[];for(const p of paths)sources.push(Buffer.from(files[p]??await read(p)));
  const bytes=Buffer.concat(sources),sql=bytes.toString(),ss=statements(sql);
  assert.equal(ss[0],'BEGIN');assert.equal(ss.at(-1),'COMMIT');assert.deepEqual(ss.filter(x=>/^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|END|ABORT)\b/.test(x)),['BEGIN','COMMIT']);
  const query_path='migration-units/'+names[i]+'.sql';files[PACKAGE+'/'+query_path]=sql;
  units.push({order:i+1,migration_name:names[i],query_path,source_paths:paths,source_sha256:sources.map(sha),query_sha256:sha(bytes),query_bytes:bytes.length,version:null,applied:false,supabase_history_version:null,reapply_safe:'not_proven',real_apply_authorized:false,transaction_contract:{begin_count:1,commit_count:1,mode:i?'ATOMIC_SPLIT_SOURCE_CONCATENATION':'COMPLETE_READINESS_TRANSACTION',concatenation_separator_bytes:0},expected_precondition:i?'CONFIRMED_ORDERED_PREFIX_AND_PREVIOUS_CHECKPOINT_PASS':'REAL_HISTORY68_STOP_STATE_PRECHECK_PASS',expected_postcondition:['I2_TRUE_TRUE','M4_FOUNDATION_PERSISTENCE','M6_OFF_POSTCHECK_PASS'][i],...(i?{delta_sha256:sha(sources[0]),readiness_sha256:sha(sources[1]),combined_sha256:sha(bytes),combined_bytes:bytes.length}:{})});
 }
 const applied=LIVE.history.slice(53);assert.equal(applied.length,15);assert.deepEqual(applied.map(x=>x.name),oldManifest.units.slice(0,15).map(x=>x.migration_name));
 const supersession={target_project_ref:LIVE.project_ref,already_real_applied:applied,do_not_reapply:applied.map(x=>x.name),superseded_not_applied:oldManifest.units.slice(15).map(x=>x.migration_name),status:'SUPERSEDED_DO_NOT_APPLY',replacement_package:'staging-m6-r2-v1',history_repair_required:false,history_deletion_forbidden:true,unit15_remains_registered:true};
 files[PACKAGE+'/supersession.json']=JSON.stringify(supersession,null,2)+'\n';files[PACKAGE+'/precheck.sql']=precheck();
 let post=await read(OLD+'/postcheck.sql');const original=[...post.matchAll(/\('public\.(get_(?:security|market_legal)_schema_readiness_v1)\(\)', '([a-f0-9]{32})'\)/g)];assert.equal(original.length,2);
 for(const m of original){const body=g.report.root_bodies.find(x=>x.proname===m[1]);assert.ok(body);post=post.replace(m[2],body.body);}files[PACKAGE+'/postcheck.sql']=post;
 files[PACKAGE+'/README.md']='# Staging68 reconciliation – NOT_AUTO_APPLY\n\nTarget: xhmjxrcskfhbovhitdej only. Starts at real History68 after P7 Units01–15, not a fresh install. Production apply forbidden. No real apply authorization.\n\nApply only under a later explicit operator authorization: exact external history68 prefix and project check, read-only precheck, then the three byte-bound units in manifest order. Before and after each unit use real list_migrations; bind actual version/name externally to package SHA/bytes, then require the read-only checkpoint. Versions remain null until observed. Never invent timestamps, repair history, or reapply an already confirmed prefix.\n\nTimeout/uncertain return: no blind retry; reconcile real history and schema; classify CONFIRMED_APPLIED, conclusively CONFIRMED_NOT_APPLIED, or AMBIGUOUS_STOP. History does not store query SHA; external receipts are mandatory.\n\nP7 Units01–15 remain registered and must not be reapplied. Old P7 Units16/17 are SUPERSEDED_DO_NOT_APPLY on this target. The replacement is readiness-only I2 reconciliation, then common M4+new readiness, then common M6+new readiness. M4/M6 each form one BEGIN/COMMIT unit. Beta stays OFF. No Production package, deployment, merge, or activation.\n\nAfter Unit01 require Security/Legal true. After Unit02 require true/true and magic/scryfall/1 foundation/persistence with snapshot_id NULL and Beta absent. After Unit03 run exact postcheck.sql; Beta exactly one disabled Magic row, Collection Magic allowed, Marketplace/Scanner/Pricing/Battle closed, Production lock absent. Supabase ledger is authoritative; simulated test ledger is never a replacement.\n';
 const metadata={};for(const [p,v] of Object.entries(files).filter(([p])=>p.startsWith(PACKAGE+'/')))metadata[p.slice(PACKAGE.length+1)]={sha256:sha(v),bytes:Buffer.byteLength(v)};
 const manifest={target_environment:'preview_staging',target_project_ref:LIVE.project_ref,target_contract:'duelvanta-staging-m6-r2-v1',package_mode:'NOT_AUTO_APPLY',source_head:LIVE.publishing_head,required_history_count:68,required_original_prefix_count:53,required_history:LIVE.history,required_p7_applied_prefix:applied,required_absent_names:[...supersession.superseded_not_applied,...names],root_cause:'STAGING68_I2_AUTHORED_TARGET_BASELINE_MISMATCH',baseline_fixture:{path:FIXTURE,sha256:sha(await readFile(FIXTURE)),indexes:LIVE.indexes},live_inventory_binding:{security_entries:502,legal_entries:320,sha256:sha(JSON.stringify(LIVE.inventories)),entry_by_entry_comparison_required:true},tracking_mode:'target_bound_supabase_migration',tracking_contract:{authority:'REAL_SUPABASE_MIGRATION_LEDGER',original_prefix_immutable:true,history_query_before_each_unit:true,history_query_after_each_unit:true,external_version_name_query_sha_binding_required:true,unknown_commit:'STOP_NO_BLIND_RETRY',resume:'EXACT_UNIQUE_ORDERED_CONFIRMED_PREFIX_ONLY'},production_apply_forbidden:true,beta_activation_included:false,beta_activation_authorized:false,real_apply_authorized:false,history_repair_required:false,unit15_remains_registered:true,units,files:metadata};
 files[PACKAGE+'/manifest.json']=JSON.stringify(manifest,null,2)+'\n';return {files,manifest};
}
async function replay(pack,interruptAfter){const db=await target(),ledger=[],done=[],checkpoints=[];try{
 await prefix(db,{unit15:true});await rootState(db,true,false);const before=await fingerprint(db);const pre=(await readonly(db,pack.files[PACKAGE+'/precheck.sql']))[0];assert.equal(pre.PRECHECK_PASS,true,'FAIL_RECONCILIATION_NATIVE_REPLAY precheck');assert.equal(before,await fingerprint(db));
 const ledgerPath=OUT+'/resume-'+interruptAfter+'-ledger.json';let recovered=[];
 for(const unit of pack.manifest.units){
  assert.equal(remaining(pack.manifest.units,recovered)[0].migration_name,unit.migration_name,'STOP_PACKAGE_TRACKING_UNSAFE');
  const sql=pack.files[PACKAGE+'/'+unit.query_path];assert.equal(sha(sql),unit.query_sha256);assert.equal(Buffer.byteLength(sql),unit.query_bytes);
  const raw=await db.exec(sql),results=Array.isArray(raw)?raw:[raw];assert.equal(results.filter(x=>x.command==='BEGIN').length,1);assert.equal(results.filter(x=>x.command==='COMMIT').length,1);
  done.push(unit.migration_name);const roots=await rootState(db,true,true,unit.order===3);assert.deepEqual(await indexes(db),LIVE.indexes);
  const lock=(await db.query("select to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()')::text function,(select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') triggers")).rows[0];assert.deepEqual(lock,{function:null,triggers:0});
  let release=null,beta=null;if(unit.order>=2){release=(await db.query("select game_key,provider_key,provider_version,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows;assert.deepEqual(release,[{game_key:'magic',provider_key:'scryfall',provider_version:'1',state:'foundation',schema_phase:'persistence',snapshot_id:null}]);}if(unit.order===2)assert.equal((await db.query("select to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text beta")).rows[0].beta,null);if(unit.order===3){beta=(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows;assert.deepEqual(beta,[{game_key:'magic',contract:'magic-on-demand-collect-beta/1',provider_key:'scryfall',provider_version:'1',enabled:false}]);}
  checkpoints.push({order:unit.order,roots,release,beta,lock,catalog_sha256:await fingerprint(db)});ledger.push({migration_name:unit.migration_name,query_sha256:unit.query_sha256,status:'APPLIED_SIMULATED'});await writeJSON(ledgerPath,ledger);recovered=JSON.parse(await read(ledgerPath));
  if(unit.order===interruptAfter){const state=await fingerprint(db);let error;try{throw Error('SIMULATED_BETWEEN_UNITS_INTERRUPTION');}catch(e){error=e.message;}assert.equal(error,'SIMULATED_BETWEEN_UNITS_INTERRUPTION');recovered=JSON.parse(await read(ledgerPath));assert.equal(recovered.length,interruptAfter);assert.equal(remaining(pack.manifest.units,recovered)[0].order,interruptAfter+1);assert.equal(await fingerprint(db),state);}
 }
 assert.deepEqual(done,pack.manifest.units.map(u=>u.migration_name));assert.equal(new Set(done).size,3);assert.equal(remaining(pack.manifest.units,recovered).length,0);
 const post=(await readonly(db,pack.files[PACKAGE+'/postcheck.sql']))[0];assert.equal(post.POSTCHECK_PASS,true,'FAIL_RECONCILIATION_NATIVE_REPLAY postcheck');for(const k of ['scanner_closed','pricing_closed','battle_closed'])assert.equal(post[k],true);
 const capabilities=createRequire(import.meta.url)('../tcg-v1-registry.js').get('magic').capabilities;for(const k of ['scanner','marketplace','pricing','battle'])assert.notEqual(capabilities[k].status,'ready');
 assert.equal((await readonly(db,pack.files[PACKAGE+'/precheck.sql']))[0].PRECHECK_PASS,false);
 return {interrupt_after:interruptAfter,ledger:recovered,executed:done,checkpoints,postcheck:post,capabilities,final_catalog_sha256:await fingerprint(db),passed:true};
 }finally{await db.close();}}
async function wrongTargets(pack){const results=[];for(const mode of ['INDEXLESS_POST_UNIT15','PRODUCTION72','REAL_LIKE_STAGING53']){const db=await target();try{if(mode==='INDEXLESS_POST_UNIT15')await prefix(db,{withIndexes:false,unit15:true});else if(mode==='PRODUCTION72')await baseline(db,await loadProductionUpgradeSources());else await legacy(db,true);const before=await fingerprint(db);const pre=(await readonly(db,pack.files[PACKAGE+'/precheck.sql']))[0];assert.equal(pre.PRECHECK_PASS,false,'STOP_PACKAGE_TRACKING_UNSAFE wrong target '+mode);assert.equal(await fingerprint(db),before);results.push({mode,precheck:pre,units_executed:0,passed:true});}finally{await db.close();}}return results;}
export async function main(){await mkdir(OUT,{recursive:true});const report={contract:'staging68-reconciliation/1',passed:false,engine:'native-PG17',real_apply_authorized:false,beta_activation_authorized:false,real_staging_writes:0,production_queries:0,production_writes:0,history_writes:0,apply_migration_calls:0};try{
 assert.ok(process.argv.includes('--native'));report.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
 const p7=JSON.parse(await read('test-results/tcg-i3-m6-p7/native-replay.json'));assert.equal(p7.passed,true,'FAIL_EXISTING_REGRESSION');assert.deepEqual(p7.ci,report.ci);report.regression_p7_sha256=sha(await readFile('test-results/tcg-i3-m6-p7/native-replay.json'));
 const a=await generate(),b=await generate();assert.notEqual(a.report.database,b.report.database);report.generation=[a.report,b.report];const one=await packageFiles(a),two=await packageFiles(b);report.outputs=[];
 for(const [p,sql] of Object.entries(one.files)){assert.equal(sql,two.files[p],'STOP_STAGING68_GENERATOR_NONDETERMINISTIC '+p);report.outputs.push({path:p,run1_sha256:sha(sql),run2_sha256:sha(two.files[p]),bytes:Buffer.byteLength(sql)});await mkdir(dirname(OUT+'/generated/'+p),{recursive:true});await writeFile(OUT+'/generated/'+p,sql);}
 let committed=false;try{await access(OUTPUTS[0]);committed=true;}catch{}report.committed_bytes_checked=committed;if(committed)for(const [p,sql] of Object.entries(one.files))assert.equal(await read(p),sql,'STOP_PACKAGE_TRACKING_UNSAFE committed bytes '+p);
 for(const mode of [0,1,2]){const r=await replay(one,mode);(report.replays??=[]).push(r);}for(const r of report.replays.slice(1)){assert.equal(r.final_catalog_sha256,report.replays[0].final_catalog_sha256);assert.deepEqual(r.checkpoints,report.replays[0].checkpoints);assert.deepEqual(r.postcheck,report.replays[0].postcheck);}
 report.wrong_targets=await wrongTargets(one);const unit=one.manifest.units[0],item={migration_name:unit.migration_name,query_sha256:unit.query_sha256,status:'APPLIED_SIMULATED'};for(const invalid of [[item,item],[{...item,query_sha256:'0'.repeat(64)}],[{...item,status:'UNKNOWN'}],[{...item,migration_name:one.manifest.units[1].migration_name}]])assert.throws(()=>remaining(one.manifest.units,invalid));report.tracking_negative_cases=4;
 report.manifest=one.manifest;report.passed=true;report.status=committed?'M6_STAGING68_RECONCILIATION_PACKAGE_READY':'M6_STAGING68_READINESS_GENERATOR_CANDIDATE_PASS';
 }catch(e){report.status=/STOP_|FAIL_/.test(e.message)?e.message.split(' ')[0]:'FAIL_RECONCILIATION_NATIVE_REPLAY';report.error={message:e.message,stack:e.stack,code:e.code};process.exitCode=1;console.error(e);}finally{const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.forbidden_external_io_attempts=io.attempts.slice();if(io.attempts.length){report.passed=false;process.exitCode=1;}await writeJSON(OUT+'/native-replay.json',report);console.log(JSON.stringify({status:report.status,passed:report.passed}));}}
if(process.argv[1]?.endsWith('tcg-i3-m6-p9-r2-staging68-test.mjs'))await main();
