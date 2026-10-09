// Package builder/verifier and simulated tracking only. No hosted apply client.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {COMMON,SOURCES,R2} from '../tcg-i3-m6-p6-staging-native-test.mjs';

export const DIR='database/target-upgrades/staging-m6-v1';
export const OUT='test-results/tcg-i3-m6-p7';
export const HEAD='fe808692aa2679f971b94b9b7b552d511f652291';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const json=async p=>JSON.parse(await readFile(p,'utf8'));
export const writeJSON=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const groups=[...COMMON.map(n=>['database/'+n+'.sql']),
 ['database/tcg-i2-canonical-integration-v1.sql'],['database/tcg-i2-readiness-staging-v1.sql'],
 ['database/tcg-i3-magic-persistence-v1.sql','database/tcg-i3-magic-readiness-staging-v1.sql'],
 ['database/tcg-i3-magic-on-demand-v1.sql','database/tcg-i3-magic-on-demand-readiness-staging-v1.sql']];

// Strip comments/quoted bodies before splitting top-level SQL statements.
// Dollar-quoted PL/pgSQL BEGIN/END and strings must not become transaction commands.
export function statements(sql){
 let clean='',i=0;
 while(i<sql.length){
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i);i=end<0?sql.length:end;clean+=' ';continue;}
  if(sql.startsWith('/*',i)){let depth=1;i+=2;while(depth&&i<sql.length){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}assert.equal(depth,0);clean+=' ';continue;}
  const tag=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
  if(tag){const end=sql.indexOf(tag,i+tag.length);assert.ok(end>=0,'unterminated dollar quote');i=end+tag.length;clean+=' QUOTED ';continue;}
  if(sql[i]==="'"||sql[i]==='"'){const quote=sql[i++];let closed=false;while(i<sql.length){if(sql[i]===quote){i++;if(sql[i]===quote){i++;continue;}closed=true;break;}i++;}assert.ok(closed);clean+=' QUOTED ';continue;}
  clean+=sql[i++];
 }
 return clean.split(';').map(x=>x.trim().replace(/\s+/g,' ').toUpperCase()).filter(Boolean);
}
function transaction(sql){const s=statements(sql);assert.equal(s[0],'BEGIN','STOP_TRANSACTION_UNIT_INVALID');assert.equal(s.at(-1),'COMMIT','STOP_TRANSACTION_UNIT_INVALID');assert.deepEqual(s.filter(x=>/^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|END|ABORT)\b/.test(x)),['BEGIN','COMMIT'],'STOP_TRANSACTION_UNIT_INVALID');return {begin_count:1,commit_count:1,statement_count:s.length};}
export async function build(write=false){
 const units=[];
 for(const [index,paths] of groups.entries()){
  const bytes=[];
  for(const p of paths){assert.doesNotMatch(p,/production|trade-lock/);const b=await readFile(p);assert.equal(sha(b),SOURCES[p]||R2[p],'STOP_STAGING_PACKAGE_SOURCE_MISMATCH '+p);bytes.push(b);}
  const query=Buffer.concat(bytes),boundary=transaction(query.toString('utf8'));
  if(paths.length===2){const d=statements(bytes[0].toString()),r=statements(bytes[1].toString());assert.equal(d[0],'BEGIN');assert.ok(!d.includes('COMMIT'));assert.ok(!r.includes('BEGIN'));assert.equal(r.at(-1),'COMMIT');}
  const order=index+1,purpose=paths[0].split('/').at(-1).replace(/-v1\.sql$/,'').replaceAll('-','_');
  const name='dv_staging_m6_'+String(order).padStart(2,'0')+'_'+purpose;
  const file='migration-units/'+name+'.sql';
  const unit={order,migration_name:name,version:null,query_path:file,source_paths:paths,source_sha256:bytes.map(sha),query_sha256:sha(query),query_bytes:query.length,
   transaction_contract:{mode:paths.length===2?'ATOMIC_SPLIT_SOURCE_CONCATENATION':'COMPLETE_SOURCE_TRANSACTION',...boundary,concatenation_separator_bytes:0,outer_transaction_forbidden:true},
   expected_precondition:{completed_units:order-1,previous_migration_name:units.at(-1)?.migration_name||null,production_trade_lock:'ABSENT',gate:order===1?'PRECHECK_PASS':order===14?'P6_R3_I2_PROTECTED_FUNCTION_HASHES':order>=16?'STAGING_READINESS_TRUE_TRUE':'SOURCE_DEFINED_PREREQUISITES'},
   expected_postcondition:{completed_units:order,production_trade_lock:'ABSENT',read_only_checkpoint_required:true,tcg_phase:order<14?'LEGACY':order<16?'I2':order===16?'M4_FOUNDATION_PERSISTENCE':'M6_OFF',readiness:order>=15?'TRUE_TRUE':'LEGACY_PROFILE_MAY_BE_TRANSIENTLY_INCOMPATIBLE',beta:order===17?'EXACTLY_ONE_ROW_OFF':'ABSENT'},
   real_apply_authorized:false,applied:false,supabase_history_version:null,reapply_safe:'not_proven'};
  if(paths.length===2)Object.assign(unit,{delta_sha256:sha(bytes[0]),readiness_sha256:sha(bytes[1]),combined_sha256:sha(query),combined_bytes:query.length});
  if(write){await mkdir(DIR+'/migration-units',{recursive:true});await writeFile(DIR+'/'+file,query);}
  else assert.deepEqual(await readFile(DIR+'/'+file),query,'STOP_STAGING_PACKAGE_SOURCE_MISMATCH '+file);
  units.push(unit);
 }
 assert.equal(units.length,17);
 const files={};for(const p of ['precheck.sql','postcheck.sql','README.md','production-hold.json']){const b=await readFile(DIR+'/'+p);files[p]={sha256:sha(b),bytes:b.length};}
 for(const p of ['precheck.sql','postcheck.sql']){const s=statements(await readFile(DIR+'/'+p,'utf8'));assert.equal(s.length,1);assert.match(s[0],/^WITH /);assert.doesNotMatch(s[0],/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|LOCK|CALL|DO|COPY|MERGE)\b/);}
 const manifest={target_environment:'preview_staging',target_project_ref:'xhmjxrcskfhbovhitdej',target_contract:'duelvanta-staging-m6-v1',source_head:HEAD,
  package_mode:'NOT_AUTO_APPLY',production_project_ref:'enifiaqsnqtbzylnfrpi',production_apply_forbidden:true,beta_activation_included:false,marketplace_magic:'closed',tracking_mode:'target_bound_supabase_migration',
  real_apply_authorized:false,beta_activation_authorized:false,migration_versions_assigned:false,supabase_history_writes:0,
  baseline:{contract:'P5-R1 staging legacy reconstructed by accepted P6-R3 native fixture',staging_registered_migrations:53,production_registered_migrations:72,shared_versions:0,last_staging_version:'20260924113153',last_staging_name:'security_readiness_v1',history_rows_reconstructed:false,prerequisite_track:'tests/tcg-i3-m6-p6-staging-native-test.mjs',runtime_bridge:false,
   p5_r1_target_baseline_sha256:'f37a0507af592aa7b67ebdfc88fe3098aa93bfbb42276432516ac6d000c62bbe',
   p5_r1_migrations_sha256:'0597e7ccf2b40154987aaf4c75f69d5a00cd051063d6f69d5b52a2cfeca6e4cc',
   p6_r5_r1_manifest_sha256:'16f6abf1c5948b57b52ff439463e51e0918204ba9b8900abd73f2b646b3d1401',
   p6_r5_r1_complete_ci_evidence_sha256:'2149399abb08980d7ea67104f5f3a64db902b9339549fff205e714d88f96118d',
   accepted_head:HEAD,accepted_runs:[{run_id:37943257336,number:826,conclusion:'success'},{run_id:37944955150,number:827,conclusion:'success'}]},
  tracking_contract:{new_apply_requires_explicit_authorization:true,fresh_readonly_preflight_before_first_write:true,verify_connection_project_ref:true,after_each_success:'list_migrations read-only; bind actual registered version and exact name to query_sha256 evidence before next unit',unknown_commit_outcome:'STOP; reconcile actual registered history read-only; never blind reapply',resume:'Only an exact, unique, hash-bound ordered completed prefix may be skipped; continue remaining units in order',version_assignment:'null until an explicitly authorized real apply returns actual Supabase history',history_repair_included:false,local_ledger_only:true},
  files,units};
 if(write)await writeJSON(DIR+'/manifest.json',manifest);else assert.deepEqual(await json(DIR+'/manifest.json'),manifest,'STOP_STAGING_PACKAGE_SOURCE_MISMATCH manifest');
 assert.deepEqual((await readdir(DIR+'/migration-units')).sort(),units.map(u=>u.query_path.split('/').at(-1)).sort());
 assert.deepEqual(await json(DIR+'/production-hold.json'),{production_package_created:false,production_real_apply_authorized:false,reason:'U001_U060_CANDIDATE_NOT_AUTHORIZED_FOR_PRODUCTION',production_requires_separate_tracking_and_apply_authorization:true});
 return manifest;
}
export function remaining(units,ledger){
 assert.ok(Array.isArray(ledger)&&ledger.length<=units.length,'STOP_TRACKING_MODEL_UNSAFE');
 const seen=new Set();for(const [i,item] of ledger.entries()){assert.ok(!seen.has(item.migration_name),'STOP_TRACKING_MODEL_UNSAFE duplicate');seen.add(item.migration_name);assert.deepEqual(item,{migration_name:units[i].migration_name,query_sha256:units[i].query_sha256,status:'APPLIED_SIMULATED'},'STOP_TRACKING_MODEL_UNSAFE prefix/hash/status');}
 return units.slice(ledger.length);
}
export async function readonly(db,sql){await db.exec('begin read only');try{return (await db.query(sql)).rows;}finally{await db.exec('rollback');}}
export async function fingerprint(db){
 // System catalog only; omit OIDs, wall clocks, database names and backend IDs.
 const queries={relations:"select n.nspname||'.'||c.relname name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_collect_private','dv_market_private') order by 1",
  functions:"select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) body,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_collect_private','dv_market_private') and p.prokind='f' order by 1",
  constraints:"select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in (select oid from pg_namespace where nspname in ('public','dv_collect_private','dv_market_private')) order by 1,2",
  triggers:"select n.nspname||'.'||c.relname relation,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','dv_collect_private','dv_market_private') order by 1,2",
  indexes:"select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','dv_collect_private','dv_market_private') order by 1,2,3"};
 const result={};for(const [key,sql] of Object.entries(queries))result[key]=await readonly(db,sql);return sha(JSON.stringify(result));
}
if(process.argv[1]?.endsWith('tcg-i3-m6-p7-migration-package.mjs')){await build(process.argv.includes('--build'));console.log('PASS P7 static source/unit/transaction/manifest integrity');}
