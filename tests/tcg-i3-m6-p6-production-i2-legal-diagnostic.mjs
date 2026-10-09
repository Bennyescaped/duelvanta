// Native PG17 forensic capture only. No authored target generation or SQL repair.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {target,baseline,upgrade,closure,precondition,ready,lock,absent,verifySources} from './tcg-i3-m6-p6-production-native-test.mjs';
import {loadProductionUpgradeSources} from './helpers/production-upgrade-fixture.mjs';
import {baseline as historicalI2Baseline} from './helpers/tcg-i2-fixture.mjs';
import {queries,contracts} from './generate-tcg-i2-readiness.mjs';

export const OUT='test-results/tcg-i3-m6-p6-r5';
const I2='database/tcg-i2-canonical-integration-v1.sql',TARGET='database/tcg-i2-readiness-v1.sql',L1='database/account-erasure-l1-readiness-v1.sql';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+Buffer.byteLength(b)+'\0').update(b).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const order=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const bind=async p=>{const b=await readFile(new URL('../'+p,import.meta.url));const git_blob=blob(b);assert.equal(execFileSync('git',['rev-parse','HEAD:'+p],{encoding:'utf8'}).trim(),git_blob,'UNEXPECTED_SOURCE_DRIFT '+p);return {path:p,sha256:sha(b),git_blob};};
export function extract(source,name){
 const start=source.indexOf('create or replace function public.'+name+'()');assert.ok(start>=0);
 const next=source.indexOf('create or replace function ',start+1);const part=source.slice(start,next<0?undefined:next);
 const m=part.match(/begin ([\s\S]*?) into actual;[\s\S]*?\$catalog\$([\s\S]*?)\$catalog\$/);assert.ok(m,'exact authored query/target unavailable');
 const expected=JSON.parse(m[2]);assert.ok(expected.length>0);return {query:m[1],expected};
}
function maps(rows){const m=new Map();for(const [kind,name,hash] of rows){const k=kind+':'+name;assert.ok(!m.has(k),'duplicate catalog key '+k);m.set(k,{kind,name,hash});}return m;}
export function diff(expected,actual){
 const e=maps(expected),a=maps(actual),missing_entries=[],unexpected_entries=[],changed_entries=[];
 for(const key of [...e.keys()].sort(order)){const x=e.get(key),v=a.get(key);if(!v)missing_entries.push({kind:x.kind,name:x.name,expected_hash:x.hash});else if(x.hash!==v.hash)changed_entries.push({kind:x.kind,name:x.name,expected_hash:x.hash,actual_hash:v.hash});}
 for(const key of [...a.keys()].sort(order))if(!e.has(key)){const x=a.get(key);unexpected_entries.push({kind:x.kind,name:x.name,actual_hash:x.hash});}
 return {expected_count:e.size,actual_count:a.size,missing_entries,unexpected_entries,changed_entries};
}
const count=d=>d.missing_entries.length+d.unexpected_entries.length+d.changed_entries.length;
export function structuralQuery(query){
 const suffix='select jsonb_agg(jsonb_build_array(kind,name,md5(value::text)) order by kind collate "C",name collate "C") from checks';
 assert.ok(query.endsWith(suffix),'STOP_READINESS_PROJECTION_MISMATCH');
 return query.slice(0,-suffix.length)+'select kind,name,value,md5(value::text) hash from checks order by kind collate "C",name collate "C"';
}
async function capture(db,query){const rows=(await db.query(structuralQuery(query))).rows;const catalog=(await db.query(query)).rows[0].jsonb_agg;assert.deepEqual(rows.map(r=>[r.kind,r.name,r.hash]),catalog);return {catalog,structures:rows};}
const byKey=c=>new Map(c.structures.map(r=>[r.kind+':'+r.name,r]));
function components(value){
 const m=new Map();if(!value)return m;
 for(const k of Object.keys(value).sort(order)){
  const v=value[k];if(Array.isArray(v)&&v.every(x=>Array.isArray(x))){for(const row of v){const n=k==='browser_privileges'?2:k==='column_privileges'?3:1;const key=k+':'+JSON.stringify(row.slice(0,n));assert.ok(!m.has(key));m.set(key,row);}}
  else m.set(k,v);
 }
 return m;
}
function differences(actual,expected){const a=components(actual),e=components(expected);return [...new Set([...a.keys(),...e.keys()])].sort(order).filter(k=>!equal(a.get(k),e.get(k))).map(k=>({component:k,actual:a.get(k)??null,expected:e.get(k)??null}));}
async function extraFunction(db,entry){
 if(entry.kind!=='function')return null;
 const n=entry.name.slice(0,entry.name.indexOf('('));return (await db.query("select p.oid::regprocedure::text signature,pg_get_function_identity_arguments(p.oid) identity_arguments,pg_get_function_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,md5(p.prosrc) body_md5,p.prosrc body,pg_get_function_result(p.oid) result,p.prosecdef security_definer,p.provolatile volatility,p.proconfig config,l.lanname language,pg_get_userbyid(p.proowner) owner,p.proisstrict strict,p.proleakproof leakproof,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname||'.'||p.proname=$1 order by p.oid::regprocedure::text collate \"C\"",[n])).rows;
}
async function main(){
 const r={contract:'production-i2-legal-forensic/1',status:'BLOCKED_I2_LEGAL_DIAGNOSTIC_HARNESS',passed:false,engine:'native-PG17',postgres_major:17,runtime_learned_expectations:0,product_sql_changed:false,readiness_sql_changed:false,real_apply_authorized:false,dual_baseline_pass:false,io:Object.fromEntries(['production_database_queries','staging_database_queries','production_mutations','staging_mutations','provider_live_requests','user_data_rows_read','real_beta_changes','real_migrations','merges','manual_deploys'].map(k=>[k,0]))};let db,fixture;
 try{
  assert.ok(process.argv.includes('--native'),'--native mandatory before database connection');
  r.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
  r.r4_source_hashes=await verifySources();
  const paths=[I2,TARGET,L1,'tests/generate-tcg-i2-readiness.mjs','tests/helpers/legal-readiness-catalog.mjs','tests/helpers/tcg-i2-fixture.mjs','tests/helpers/publication-hold-fixture.mjs','tests/helpers/security-schema-fixture.mjs','tests/helpers/legal-schema-fixture.mjs','tests/helpers/production-upgrade-fixture.mjs'];r.sources=[];for(const p of paths)r.sources.push(await bind(p));
  const targetContract=extract(await read(TARGET),'get_market_legal_schema_readiness_v1');
  const l1Contract=extract(await read(L1),'get_market_legal_schema_readiness_v1');
  const authoredQueries=await queries(),old=await contracts();assert.equal(targetContract.query,authoredQueries[1],'exact I2 authoring query binding');assert.equal(l1Contract.query,old[1].query);assert.deepEqual(l1Contract.expected,old[1].expected);
  r.expected={source:r.sources.find(s=>s.path===TARGET),entry_count:targetContract.expected.length,catalog:targetContract.expected};
  r.query_sha256={I2:sha(targetContract.query),L1:sha(l1Contract.query)};
  const pack=await loadProductionUpgradeSources();db=await target();r.version=db.version;r.connection={host:'127.0.0.1',current_user:'postgres',database:db.name,disposable:true,production_staging_connection:false};
  const b=await baseline(db,pack);r.production_72=b.report;r.U001_U060=await upgrade(db,pack,b.catalog);r.closure=await closure(db);r.precondition=await precondition(db);
  r.pre_i2_readiness=await ready(db);r.pre_i2_lock=await lock(db);r.pre_i2_foundation=await absent(db);
  r.pre_i2=await capture(db,l1Contract.query);r.pre_i2_diff=diff(l1Contract.expected,r.pre_i2.catalog);assert.equal(count(r.pre_i2_diff),0,'STOP_DIAGNOSTIC_INCONSISTENT_BASELINE');
  // Attribution also includes existing tables first added to the I2 inventory (e.g. collection_items).
  // The identical metadata projection is safe on absent foundation objects; unnamed missing-function rows are not map keys.
  r.production_pre_attribution={structures:(await db.query(structuralQuery(targetContract.query))).rows.filter(x=>x.name!==null)};
  await db.exec(await read(I2));r.post_i2=await capture(db,targetContract.query);r.diff=diff(targetContract.expected,r.post_i2.catalog);assert.ok(count(r.diff)>0,'Run824 mismatch not reproduced');
  // Separate immutable historical authoring fixture, never used to learn a replacement target.
  fixture=await target();r.fixture_connection={database:fixture.name,host:'127.0.0.1',current_user:'postgres',disposable:true};assert.notEqual(db.name,fixture.name);
  await historicalI2Baseline(fixture);r.fixture_pre_i2=await capture(fixture,l1Contract.query);
  r.fixture_pre_i2_control=diff(l1Contract.expected,r.fixture_pre_i2.catalog);assert.equal(count(r.fixture_pre_i2_control),0,'historical fixture L1 authored target mismatch');
  r.fixture_pre_attribution={structures:(await fixture.query(structuralQuery(targetContract.query))).rows.filter(x=>x.name!==null)};
  await fixture.exec(await read(I2));r.fixture_post_i2=await capture(fixture,targetContract.query);r.fixture_expected_diff=diff(targetContract.expected,r.fixture_post_i2.catalog);
  const pm=byKey(r.production_pre_attribution),am=byKey(r.post_i2),fm=byKey(r.fixture_post_i2),fpm=byKey(r.fixture_pre_attribution),details=[];
  const delta=await read(I2);
  for(const entry of [...r.diff.missing_entries,...r.diff.unexpected_entries,...r.diff.changed_entries].sort((a,b)=>order(a.kind+':'+a.name,b.kind+':'+b.name))){
   const key=entry.kind+':'+entry.name,p=pm.get(key),a=am.get(key),f=fm.get(key),fp=fpm.get(key);
   const structural_differences=differences(a?.value,f?.value);
   const expectedBound=f&&f.hash===entry.expected_hash;
   const baselineOnly=expectedBound&&structural_differences.length>0&&structural_differences.every(x=>{
    const pc=components(p?.value),fc=components(fp?.value);return equal(pc.get(x.component)??null,x.actual)&&equal(fc.get(x.component)??null,x.expected);
   });
   const changedByI2=!equal(p?.value,a?.value);const object=entry.kind==='function'?entry.name.slice(0,entry.name.indexOf('(')):entry.name;
   const mentioned=delta.includes(object);let attribution='UNEXPECTED_SOURCE_DRIFT';
   if(baselineOnly)attribution='BASELINE_VARIANT_EXPOSED';else if(changedByI2&&mentioned)attribution='DIRECT_I2_DELTA';
   details.push({...entry,actual_structure:a||null,expected_structure:f||null,production_pre_i2_structure:p||null,synthetic_pre_i2_structure:fp||null,actual_function_metadata:await extraFunction(db,entry),expected_function_metadata:await extraFunction(fixture,entry),structural_differences,expected_origin:expectedBound?'EXPECTED_FROM_SYNTHETIC_I2_FIXTURE':'UNRESOLVED',expected_source_bindings:r.sources.filter(s=>/fixture|generate-tcg-i2-readiness/.test(s.path)),actual_origin:'EXPECTED_FROM_PRODUCTION72_CLOSURE',actual_source_bindings:{history:r.production_72.history_sha256,closure:r.closure.checkpoints.map(x=>x.sources),sources:r.r4_source_hashes},mutation_attribution:attribution,I2_mutates_catalog_entry:changedByI2,I2_source_mentions_object:mentioned,attribution_proof:baselineOnly?'Every post-I2 differing structural component equals its unchanged pre-I2 Production vs historical-fixture component. Historical fixture hash equals authored expected hash.':changedByI2&&mentioned?'Entry changed across exact I2 delta and source names object; intendedness is not inferred.':'No conclusive attribution; no repair or engine blame inferred.'});
  }
  r.details=details;
  r.root_cause=count(r.fixture_expected_diff)===0&&details.length&&details.every(d=>d.mutation_attribution==='BASELINE_VARIANT_EXPOSED')?'PRODUCTION_I2_AUTHORED_TARGET_BASELINE_MISMATCH':'UNRESOLVED_I2_LEGAL_MISMATCH';
  await db.exec(await read(TARGET));r.negative_readiness=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];assert.equal(r.negative_readiness.security.compatible,true);assert.equal(r.negative_readiness.legal.compatible,false);
  r.post_i2_lock=await lock(db);r.pre_i2_legal_diff_count=0;r.post_i2_missing_count=r.diff.missing_entries.length;r.post_i2_unexpected_count=r.diff.unexpected_entries.length;r.post_i2_changed_count=r.diff.changed_entries.length;
  r.M4_executed=false;r.M6_executed=false;r.authoring_executed=false;await verifySources();
  r.passed=r.root_cause!=='UNRESOLVED_I2_LEGAL_MISMATCH';r.status=r.passed?'M6_PRODUCTION_I2_LEGAL_ROOT_CAUSE_IDENTIFIED':'UNRESOLVED_I2_LEGAL_MISMATCH';
  console.log(JSON.stringify({status:r.status,pre_diff:0,expected_count:r.diff.expected_count,actual_count:r.diff.actual_count,missing:r.post_i2_missing_count,unexpected:r.post_i2_unexpected_count,changed:r.post_i2_changed_count,root_cause:r.root_cause,entries:details.map(d=>({kind:d.kind,name:d.name,attribution:d.mutation_attribution,components:d.structural_differences.map(x=>x.component)}))}));
 }catch(e){r.error={message:e.message,code:e.code,stack:e.stack};console.error(e);process.exitCode=1;}
 finally{
  for(const x of [fixture,db])if(x)try{await x.close();}catch(e){r.cleanup_error=e.message;r.passed=false;r.status='BLOCKED_I2_LEGAL_DIAGNOSTIC_HARNESS';process.exitCode=1;}
  const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];r.io.forbidden_external_io_attempts=io.attempts.slice();r.io.local_pg_connections=io.local_pg_connections;
  if(io.attempts.length){r.passed=false;r.status='BLOCKED_I2_LEGAL_DIAGNOSTIC_HARNESS';process.exitCode=1;}
  await mkdir(OUT,{recursive:true});await writeFile(OUT+'/legal-diff.json',JSON.stringify(r,null,2)+'\n');
 }
}
if(process.argv[1]?.endsWith('tcg-i3-m6-p6-production-i2-legal-diagnostic.mjs'))await main();
