// Additive History70 package authoring and native replay; simulated ledger only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {generate,LIVE,COLLECTION,OUT,PACKAGE,OUTPUTS,FIXTURE,P7,R2,read,sha,reconstruct,history70Gate,phaseState,rootState,bootstrapQuery,securityIndexesQuery} from './generate-tcg-staging70-readiness.mjs';
import {target} from './tcg-i3-m6-p6-production-native-test.mjs';
import {remaining,fingerprint,readonly,statements} from './helpers/tcg-i3-m6-p7-migration-package.mjs';
const writeJSON=async(p,x)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(x,null,2)+'\n');};
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const json=x=>quote(JSON.stringify(x))+'::jsonb';
export function precheck(){
 const bodies=LIVE.state.roots.map(x=>`('${x.name}','${x.body}')`).join(',');
 return `-- NOT_AUTO_APPLY. Exact real History70 stop-state only. History checked externally.
with observed as materialized (
 select current_setting('server_version_num')::int/10000 postgres_major,
 to_regclass('dv_collect_private.tcg_games') is not null i2_present,
 to_regclass('dv_collect_private.tcg_catalog_releases') is not null m4_present,
 to_regclass('dv_collect_private.tcg_magic_on_demand_beta') is null beta_absent,
 to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()') is null production_lock_absent,
 (select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') production_lock_triggers,
 (select to_jsonb(b) from (${bootstrapQuery('tcg_catalog_schema_readiness_v1')}) b) bootstrap,
 (select count(*)=2 from (values ${bodies}) e(name,body) join pg_proc p on p.oid=to_regprocedure('public.'||e.name||'()') where md5(p.prosrc)=e.body and p.provolatile='s' and p.prosecdef) old_r2_m4_bodies_match,
 (select jsonb_agg(to_jsonb(x) order by x.name collate "C") from (${securityIndexesQuery}) x) security_indexes,
 (select jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready) order by c.relname collate "C") from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=to_regclass('public.collection_items')) collection_indexes,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.collection_items') and conname='collection_items_tcg_check') collection_constraint,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.market_listings') and conname='market_listings_tcg_check') marketplace_constraint
), guarded as materialized (
 select x.helper::jsonb helper,x.security::jsonb security,x.legal::jsonb legal,x.release::jsonb release
 from xmltable('/table/row' passing query_to_xml(case when (select m4_present and old_r2_m4_bodies_match and bootstrap=${json(LIVE.bootstrap)} from observed) then
 'select dv_collect_private.tcg_catalog_schema_readiness_v1() helper,public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal,(select jsonb_agg(jsonb_build_object(''game_key'',game_key,''provider_key'',provider_key,''provider_version'',provider_version,''state'',state,''schema_phase'',schema_phase,''snapshot_id'',snapshot_id)) from dv_collect_private.tcg_catalog_releases where game_key=''magic'') release'
 else 'select null::jsonb helper,null::jsonb security,null::jsonb legal,null::jsonb release' end,true,false,'') columns helper text path 'helper/text()',security text path 'security/text()',legal text path 'legal/text()',release text path 'release/text()') x
), expected as (
 select 'security' kind,value entry from jsonb_array_elements(${json(LIVE.old_targets[0])})
 union all select 'legal',value from jsonb_array_elements(${json(LIVE.old_targets[1])})
), actual as (
 select 'security' kind,value entry from guarded g cross join lateral jsonb_array_elements(g.helper->'security_inventory')
 union all select 'legal',value from guarded g cross join lateral jsonb_array_elements(g.helper->'legal_inventory')
), compared as (
 select coalesce(e.kind,a.kind) kind,e.entry expected,a.entry actual from expected e full join actual a on e.kind=a.kind and e.entry->>0=a.entry->>0 and e.entry->>1=a.entry->>1
), diffs as (
 select kind,count(expected)::int expected_count,count(actual)::int actual_count,
 coalesce(jsonb_agg(expected order by expected) filter(where actual is null),'[]'::jsonb) missing,
 coalesce(jsonb_agg(actual order by actual) filter(where expected is null),'[]'::jsonb) unexpected,
 coalesce(jsonb_agg(jsonb_build_object('expected',expected,'actual',actual) order by expected) filter(where actual is not null and expected is not null and actual<>expected),'[]'::jsonb) changed
 from compared group by kind
), checks as (
 select o.*,g.security,g.legal,g.release,g.helper->>'state' helper_state,
 (select to_jsonb(d)-'kind' from diffs d where kind='security') security_diff,
 (select to_jsonb(d)-'kind' from diffs d where kind='legal') legal_diff,
 coalesce(o.postgres_major=17 and o.i2_present and o.m4_present and o.beta_absent and o.production_lock_absent and o.production_lock_triggers=0 and o.old_r2_m4_bodies_match
 and o.bootstrap=${json(LIVE.bootstrap)} and o.security_indexes=${json(LIVE.indexes)} and o.collection_indexes=${json(COLLECTION.indexes)}
 and o.collection_constraint=${quote(LIVE.state.collection_constraint)} and o.marketplace_constraint=o.collection_constraint
 and g.security=${json(LIVE.state.security)} and g.legal=${json(LIVE.state.legal)} and g.release=${json(LIVE.state.release)} and g.helper->>'state'='foundation'
 and g.helper->'security_inventory'=${json(LIVE.helper.security_inventory)} and g.helper->'legal_inventory'=${json(LIVE.helper.legal_inventory)}
 and (select to_jsonb(d)-'kind' from diffs d where kind='security')=${json(LIVE.old_diff.security)}
 and (select to_jsonb(d)-'kind' from diffs d where kind='legal')=${json(LIVE.old_diff.legal)},false) precheck_pass
 from observed o cross join guarded g
) select precheck_pass as "PRECHECK_PASS",to_jsonb(checks)-'precheck_pass' evidence from checks;
`;}
export async function packageFiles(g){
 const files={...g.files},p7=JSON.parse(await read(P7+'/manifest.json')),r2=JSON.parse(await read(R2+'/manifest.json'));
 const names=['dv_staging_m6r3_01_m4_readiness_reconcile','dv_staging_m6r3_02_tcg_i3_magic_on_demand'],groups=[[OUTPUTS[0]],['database/tcg-i3-magic-on-demand-v1.sql',OUTPUTS[1]]],units=[];
 for(const [i,paths] of groups.entries()){
  const sources=[];for(const p of paths)sources.push(Buffer.from(files[p]??await read(p)));const bytes=Buffer.concat(sources),sql=bytes.toString(),ss=statements(sql);
  assert.equal(ss[0],'BEGIN');assert.equal(ss.at(-1),'COMMIT');assert.deepEqual(ss.filter(x=>/^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|END|ABORT)\b/.test(x)),['BEGIN','COMMIT']);
  const query_path='migration-units/'+names[i]+'.sql';files[PACKAGE+'/'+query_path]=sql;
  units.push({order:i+1,migration_name:names[i],query_path,source_paths:paths,source_sha256:sources.map(sha),query_sha256:sha(bytes),query_bytes:bytes.length,version:null,applied:false,supabase_history_version:null,reapply_safe:'not_proven',real_apply_authorized:false,expected_history_count_before:70+i,expected_history_count_after:71+i,transaction_contract:{begin_count:1,commit_count:1,mode:i?'ATOMIC_SPLIT_SOURCE_CONCATENATION':'STANDALONE_READINESS_ONLY',concatenation_separator_bytes:0},expected_precondition:i?'CONFIRMED_R3_UNIT01_PREFIX_AND_CHECKPOINT_PASS':'EXACT_HISTORY70_AND_PRECHECK_PASS',expected_postcondition:i?'M6_OFF_POSTCHECK_PASS':'M4_TRUE_TRUE_BETA_ABSENT_NO_PRODUCT_CHANGE',...(i?{delta_sha256:sha(sources[0]),readiness_sha256:sha(sources[1]),combined_sha256:sha(bytes),combined_bytes:bytes.length}:{})});
 }
 assert.equal(LIVE.history.length,70);assert.deepEqual(LIVE.history.slice(0,68),r2.required_history);assert.deepEqual(LIVE.history.slice(68),[{version:'20261012145314',name:r2.units[0].migration_name},{version:'20261012145433',name:r2.units[1].migration_name}]);
 const superseded=[...p7.units.slice(15).map(u=>u.migration_name),r2.units[2].migration_name];
 const supersession={target_project_ref:LIVE.project_ref,confirmed_applied_do_not_reapply:LIVE.history.slice(53).map(x=>({...x,status:'CONFIRMED_APPLIED_DO_NOT_REAPPLY'})),superseded_not_applied:superseded.map(name=>({name,status:'SUPERSEDED_NOT_APPLIED',apply:'SUPERSEDED_DO_NOT_APPLY'})),replacement_package:'staging-m6-r3-v1',history_repair_required:false,history_deletion_forbidden:true,r2_unit02_remains_registered:true};
 files[PACKAGE+'/supersession.json']=JSON.stringify(supersession,null,2)+'\n';files[PACKAGE+'/precheck.sql']=precheck();
 let post=await read(R2+'/postcheck.sql');const matches=[...post.matchAll(/\('public\.(get_(?:security|market_legal)_schema_readiness_v1)\(\)', '([a-f0-9]{32})'\)/g)];assert.equal(matches.length,2);for(const m of matches)post=post.replace(m[2],g.report.root_bodies.find(x=>x.name===m[1]).body);files[PACKAGE+'/postcheck.sql']=post;
 for(const p of ['precheck.sql','postcheck.sql']){const s=statements(files[PACKAGE+'/'+p]);assert.equal(s.length,1);assert.match(s[0],/^WITH /);assert.doesNotMatch(s[0],/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|LOCK|CALL|DO|COPY|MERGE)\b/);}
 files[PACKAGE+'/README.md']='# Staging70 reconciliation – NOT_AUTO_APPLY\n\nTarget xhmjxrcskfhbovhitdej only. This is not a fresh installation. Requires exact real History70 after committed R2 Unit02; all original history remains registered and immutable. No real apply authorization. Production access/apply, Beta activation, history repairs, reapply of confirmed units, merge and deployment are excluded.\n\nRoot cause: STAGING70_M4_SECURITY_AUTHORED_TARGET_BASELINE_MISMATCH. Ten legacy security index entries are present in the live baseline but absent from the old target. Legal inventory is exact; false is solely the Security dependency.\n\nUnder a later explicit operator authorization: verify project, full version/name prefix and absent names; run exact precheck.sql. For each unit, list_migrations before, verify exact prefix and exact query SHA/bytes, apply once, list_migrations after, bind actual version/name externally to query SHA/bytes, require read-only checkpoint before continuing. Unit01 standalone replaces only the two M4 public readinessroots and ACLs; it does not rerun M4. Require true/true, unchanged foundation/persistence/snapshot NULL and Beta absent. Unit02 is the separator-free common M6 delta plus native Staging70 readiness; require exact postcheck.sql PASS, one Magic Beta row enabled=false, Collection Magic allowed, Marketplace/Scanner/Pricing/Battle closed and Production lock absent. Expected future history counts 71 then72; versions remain null until observed.\n\nP7 Units01–15 and R2 Units01–02 are CONFIRMED_APPLIED_DO_NOT_REAPPLY. P7 Units16/17 and R2 Unit03 are SUPERSEDED_DO_NOT_APPLY. Never execute an old suffix on this target.\n\nAmbiguous return/timeout/connector error: no blind retry or next write. Read real migrationhistory, exact name and full prefix, then schema checkpoint and terminal evidence. Classify CONFIRMED_APPLIED, CONFIRMED_NOT_APPLIED or AMBIGUOUS_STOP. The real ledger plus external hash-bound receipts is authoritative. Only a unique ordered confirmed prefix may be skipped. A simulated ledger never substitutes for real history. No idempotency claim; reapply_safe=not_proven.\n';
 const metadata={};for(const [p,v] of Object.entries(files).filter(([p])=>p.startsWith(PACKAGE+'/')))metadata[p.slice(PACKAGE.length+1)]={sha256:sha(v),bytes:Buffer.byteLength(v)};
 const manifest={target_environment:'preview_staging',target_project_ref:LIVE.project_ref,target_contract:'duelvanta-staging-m6-r3-v1',package_mode:'NOT_AUTO_APPLY',source_head:LIVE.source_head,required_history_count:70,required_original_prefix_count:53,required_history:LIVE.history,required_absent_names:[...superseded,...names],root_cause:'STAGING70_M4_SECURITY_AUTHORED_TARGET_BASELINE_MISMATCH',legal_false_cause:'SECURITY_DEPENDENCY_ONLY',baseline_fixtures:[{path:'tests/fixtures/tcg-i3-m6/staging68-legacy-collection-indexes.sql',sha256:sha(await readFile('tests/fixtures/tcg-i3-m6/staging68-legacy-collection-indexes.sql')),indexes:COLLECTION.indexes},{path:FIXTURE,sha256:sha(await readFile(FIXTURE)),indexes:LIVE.indexes}],live_inventory_binding:{security_entries:2951,legal_entries:340,entry_by_entry_comparison_required:true,bootstrap:LIVE.bootstrap},tracking_mode:'target_bound_supabase_migration',tracking_contract:{authority:'REAL_SUPABASE_MIGRATION_LEDGER',original_prefix_immutable:true,history_query_before_each_unit:true,history_query_after_each_unit:true,external_version_name_query_sha_binding_required:true,unknown_commit:'STOP_NO_BLIND_RETRY',resume:'EXACT_UNIQUE_ORDERED_CONFIRMED_PREFIX_ONLY'},production_apply_forbidden:true,production_package_created:false,beta_activation_included:false,beta_activation_authorized:false,real_apply_authorized:false,migration_versions_assigned:false,history_repair_required:false,units,files:metadata};
 files[PACKAGE+'/manifest.json']=JSON.stringify(manifest,null,2)+'\n';return {files,manifest};
}
async function replay(pack,interrupt){const db=await target(),ledger=[],executed=[],checkpoints=[];try{
 await reconstruct(db);const initial=await history70Gate(db),pre=(await readonly(db,pack.files[PACKAGE+'/precheck.sql']))[0];assert.equal(pre.PRECHECK_PASS,true,'FAIL_STAGING70_NATIVE_REPLAY precheck');
 const ledgerPath=OUT+'/resume-'+interrupt+'-ledger.json';let recovered=[];
 for(const unit of pack.manifest.units){assert.equal(remaining(pack.manifest.units,recovered)[0].migration_name,unit.migration_name,'STOP_PACKAGE_TRACKING_UNSAFE');const sql=pack.files[PACKAGE+'/'+unit.query_path];assert.equal(sha(sql),unit.query_sha256);assert.equal(Buffer.byteLength(sql),unit.query_bytes);const raw=await db.exec(sql),r=Array.isArray(raw)?raw:[raw];assert.equal(r.filter(x=>x.command==='BEGIN').length,1);assert.equal(r.filter(x=>x.command==='COMMIT').length,1);
  executed.push(unit.migration_name);checkpoints.push({order:unit.order,roots:await rootState(db,true,true,unit.order===2),state:await phaseState(db,unit.order===2),catalog_sha256:await fingerprint(db)});
  ledger.push({migration_name:unit.migration_name,query_sha256:unit.query_sha256,status:'APPLIED_SIMULATED'});await writeJSON(ledgerPath,ledger);recovered=JSON.parse(await read(ledgerPath));
  if(interrupt&&unit.order===1){const before=await fingerprint(db);let caught=false;try{throw Error('SIMULATED_BETWEEN_UNITS_INTERRUPTION');}catch(e){assert.equal(e.message,'SIMULATED_BETWEEN_UNITS_INTERRUPTION');caught=true;}assert.equal(caught,true);recovered=JSON.parse(await read(ledgerPath));assert.equal(remaining(pack.manifest.units,recovered)[0].order,2);assert.equal(await fingerprint(db),before);}
 }
 assert.deepEqual(executed,pack.manifest.units.map(x=>x.migration_name));assert.equal(new Set(executed).size,2);assert.equal(remaining(pack.manifest.units,recovered).length,0);const post=(await readonly(db,pack.files[PACKAGE+'/postcheck.sql']))[0];assert.equal(post.POSTCHECK_PASS,true,'FAIL_STAGING70_NATIVE_REPLAY postcheck');for(const k of ['scanner_closed','pricing_closed','battle_closed'])assert.equal(post[k],true);
 const capabilities=createRequire(import.meta.url)('../tcg-v1-registry.js').get('magic').capabilities;for(const k of ['scanner','marketplace','pricing','battle'])assert.notEqual(capabilities[k].status,'ready');
 return {initial,precheck:pre,interrupt_after:interrupt?1:null,ledger:recovered,executed,checkpoints,postcheck:post,capabilities,final_catalog_sha256:await fingerprint(db),passed:true};
 }finally{await db.close();}}
async function wrongTargets(pack){const results=[];for(const mode of ['HISTORY68','HISTORY69','HISTORY70_WITHOUT_TEN_INDEXES','HISTORY70_CORRECTED_ROOT']){const db=await target();try{
 await reconstruct(db,{history:mode==='HISTORY68'?68:mode==='HISTORY69'?69:70,securityIndexes:mode!=='HISTORY70_WITHOUT_TEN_INDEXES'});if(mode==='HISTORY70_CORRECTED_ROOT')await db.exec(pack.files[OUTPUTS[0]]);const before=await fingerprint(db),pre=(await readonly(db,pack.files[PACKAGE+'/precheck.sql']))[0];assert.equal(pre.PRECHECK_PASS,false,'STOP_PACKAGE_TRACKING_UNSAFE wrong target '+mode);assert.equal(await fingerprint(db),before);results.push({mode,precheck:pre,units_after_failed_precheck:0,passed:true});
 }finally{await db.close();}}return results;}
export async function main(){await mkdir(OUT,{recursive:true});const report={contract:'staging70-reconciliation/1',passed:false,engine:'native-PG17',real_apply_authorized:false,beta_activation_authorized:false,real_staging_writes:0,production_queries:0,production_writes:0,history_writes:0,apply_migration_calls:0};try{
 assert.ok(process.argv.includes('--native'));report.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
 report.regressions=[];for(const p of ['test-results/tcg-i3-m6-p7/native-replay.json','test-results/tcg-i3-m6-p9-r2/native-replay.json']){const r=JSON.parse(await read(p));assert.equal(r.passed,true,'FAIL_EXISTING_REGRESSION');assert.deepEqual(r.ci,report.ci);report.regressions.push({path:p,sha256:sha(await readFile(p)),passed:true});}
 const a=await generate(),b=await generate();assert.notEqual(a.report.database,b.report.database);report.generation=[a.report,b.report];const one=await packageFiles(a),two=await packageFiles(b);report.outputs=[];assert.deepEqual(Object.keys(one.files),Object.keys(two.files));
 for(const [p,sql] of Object.entries(one.files)){assert.equal(sql,two.files[p],'STOP_STAGING70_GENERATOR_NONDETERMINISTIC '+p);report.outputs.push({path:p,run1_sha256:sha(sql),run2_sha256:sha(two.files[p]),bytes:Buffer.byteLength(sql)});await mkdir(dirname(OUT+'/generated/'+p),{recursive:true});await writeFile(OUT+'/generated/'+p,sql);}
 let committed=false;try{await access(OUTPUTS[0]);committed=true;}catch{}report.committed_bytes_checked=committed;if(committed)for(const [p,sql] of Object.entries(one.files))assert.equal(await read(p),sql,'STOP_PACKAGE_TRACKING_UNSAFE committed bytes '+p);
 report.replays=[await replay(one,false),await replay(one,true)];assert.equal(report.replays[0].final_catalog_sha256,report.replays[1].final_catalog_sha256);assert.deepEqual(report.replays[0].checkpoints,report.replays[1].checkpoints);assert.deepEqual(report.replays[0].postcheck,report.replays[1].postcheck);report.wrong_targets=await wrongTargets(one);
 const u=one.manifest.units[0],item={migration_name:u.migration_name,query_sha256:u.query_sha256,status:'APPLIED_SIMULATED'};for(const bad of [[item,item],[{...item,query_sha256:'0'.repeat(64)}],[{...item,status:'UNKNOWN'}],[{...item,migration_name:one.manifest.units[1].migration_name}]])assert.throws(()=>remaining(one.manifest.units,bad));report.tracking_negative_cases=4;
 report.manifest=one.manifest;report.passed=true;report.status=committed?'M6_STAGING70_RECONCILIATION_PACKAGE_READY':'M6_STAGING70_READINESS_GENERATOR_CANDIDATE_PASS';
 }catch(e){report.status=/STOP_|FAIL_/.test(e.message)?e.message.split(' ')[0]:'FAIL_STAGING70_NATIVE_REPLAY';report.error={message:e.message,stack:e.stack,code:e.code};process.exitCode=1;console.error(e);}finally{const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.forbidden_external_io_attempts=io.attempts.slice();if(io.attempts.length){report.passed=false;process.exitCode=1;}await writeJSON(OUT+'/native-replay.json',report);console.log(JSON.stringify({status:report.status,passed:report.passed}));}}
if(process.argv[1]?.endsWith('tcg-i3-m6-p9-r5-staging70-test.mjs'))await main();
