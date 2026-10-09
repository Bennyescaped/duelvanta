// Native disposable replay of byte-bound Staging units. Never a Supabase apply client.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {securitySchemaFixture} from './helpers/security-schema-fixture.mjs';
import {loadProductionUpgradeSources} from './helpers/production-upgrade-fixture.mjs';
import {target,baseline,precondition,verifySources} from './tcg-i3-m6-p6-production-native-test.mjs';
import {DIR,OUT,build,remaining,sha,json,writeJSON,readonly,fingerprint} from './helpers/tcg-i3-m6-p7-migration-package.mjs';

const read=p=>readFile(p,'utf8');
const constraintsSQL="select conname,pg_get_constraintdef(oid) definition from pg_constraint where conname in ('collection_items_tcg_check','market_listings_tcg_check') order by conname";
const lockSQL="select to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()')::text function,(select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') triggers";
const rootsSQL='select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal';
async function legacy(db){
 await securitySchemaFixture(db);
 for(const n of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1'])await db.exec(await read('database/'+n+'.sql'));
 await db.exec('set search_path=pg_catalog,public');
}
async function checkpoint(db,unit){
 const lock=(await readonly(db,lockSQL))[0];assert.deepEqual(lock,{function:null,triggers:0});
 const constraints=await readonly(db,constraintsSQL);assert.equal(constraints.length,2);assert.doesNotMatch(constraints[1].definition,/magic/i);
 const objects=(await readonly(db,"select to_regclass('dv_collect_private.tcg_games')::text games,to_regclass('dv_collect_private.tcg_catalog_releases')::text release,to_regclass('dv_collect_private.tcg_magic_on_demand_beta')::text beta,to_regclass('supabase_migrations.schema_migrations')::text history"))[0];
 assert.equal(objects.history,null,'STOP_TRACKING_MODEL_UNSAFE real/fake Supabase history');
 assert.equal(Boolean(objects.games),unit.order>=14);assert.equal(Boolean(objects.release),unit.order>=16);assert.equal(Boolean(objects.beta),unit.order===17);
 const readiness=(await readonly(db,rootsSQL))[0];
 if(unit.order>=15){assert.deepEqual(readiness.security,{revision:'privilege-mfa-v1',compatible:true,...(unit.order===17?{tcg_beta_contract:'magic-on-demand-collect-beta/1'}:{})});assert.deepEqual(readiness.legal,{revision:'trade-legal-contract-model-v1.2',compatible:true,...(unit.order===17?{tcg_beta_contract:'magic-on-demand-collect-beta/1'}:{})});}
 if(unit.order<17)assert.doesNotMatch(constraints[0].definition,/magic/i);else assert.match(constraints[0].definition,/magic/i);
 const protected_functions=unit.order===13?await precondition(db):null;
 return {order:unit.order,migration_name:unit.migration_name,read_only:true,lock,constraints,objects,readiness,protected_functions,catalog_sha256:await fingerprint(db)};
}
async function finalState(db){
 const tcg={games:await readonly(db,'select * from dv_collect_private.tcg_games order by game_key'),providers:await readonly(db,'select * from dv_collect_private.tcg_providers order by provider_key'),bindings:await readonly(db,'select * from dv_collect_private.tcg_provider_bindings order by game_key,provider_key,provider_version'),
  rpcs:await readonly(db,"select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p where p.oid in ('public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure) order by 1"),
  release:(await readonly(db,"select game_key,provider_key,provider_version,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'"))[0]};
 const capabilities=createRequire(import.meta.url)('../tcg-v1-registry.js').get('magic').capabilities;
 for(const k of ['scanner','marketplace','pricing','battle'])assert.notEqual(capabilities[k].status,'ready');
 return {readiness:(await readonly(db,rootsSQL))[0],lock:(await readonly(db,lockSQL))[0],constraints:await readonly(db,constraintsSQL),tcg,beta:await readonly(db,'select * from dv_collect_private.tcg_magic_on_demand_beta'),capabilities};
}
function trackingNegativeCases(units){
 const first={migration_name:units[0].migration_name,query_sha256:units[0].query_sha256,status:'APPLIED_SIMULATED'};
 const invalid={duplicate:[first,first],missing_prefix:[{...first,migration_name:units[1].migration_name}],wrong_hash:[{...first,query_sha256:'0'.repeat(64)}],unknown_commit:[{...first,status:'UNKNOWN'}],unexpected_name:[{...first,migration_name:'unexpected'}]};
 for(const value of Object.values(invalid))assert.throws(()=>remaining(units,value),/STOP_TRACKING_MODEL_UNSAFE/);
 return Object.keys(invalid).map(name=>({name,rejected:true,units_executed:0}));
}
async function replay(manifest,mode,reference){
 const db=await target();const result={mode,checkpoints:[],executed:[],ledger:[],passed:false};
 const ledgerFile=OUT+'/'+mode+'-simulated-ledger.json';
 try{
  result.version=db.version;await legacy(db);
  const before=await fingerprint(db);result.precheck=(await readonly(db,await read(DIR+'/precheck.sql')))[0];assert.equal(result.precheck.PRECHECK_PASS,true,'FAIL_STAGING_PACKAGE_REPLAY precheck');assert.equal(await fingerprint(db),before);
  await writeJSON(ledgerFile,result.ledger);
  const runUnit=async unit=>{
   assert.equal(remaining(manifest.units,result.ledger)[0]?.migration_name,unit.migration_name,'STOP_TRACKING_MODEL_UNSAFE');
   if(unit.order===14)await precondition(db);
   const bytes=await readFile(DIR+'/'+unit.query_path);assert.equal(sha(bytes),unit.query_sha256,'STOP_STAGING_PACKAGE_SOURCE_MISMATCH');assert.equal(bytes.length,unit.query_bytes);
   const response=await db.exec(bytes.toString('utf8')),results=Array.isArray(response)?response:[response];
   assert.equal(results[0].command,'BEGIN','STOP_TRANSACTION_UNIT_INVALID');assert.equal(results.at(-1).command,'COMMIT','STOP_TRANSACTION_UNIT_INVALID');
   assert.equal(results.filter(r=>r.command==='BEGIN').length,1);assert.equal(results.filter(r=>r.command==='COMMIT').length,1);
   result.executed.push(unit.migration_name);result.checkpoints.push(await checkpoint(db,unit));
   result.ledger.push({migration_name:unit.migration_name,query_sha256:unit.query_sha256,status:'APPLIED_SIMULATED'});
   await writeJSON(ledgerFile,result.ledger);console.log('PASS P7',mode,unit.order,unit.migration_name);
  };
  if(mode==='resume'){
   for(const unit of manifest.units.slice(0,8))await runUnit(unit);
   const committed=await fingerprint(db);let injected;
   try{throw new Error('P7_SIMULATED_INTERRUPTION_BETWEEN_UNITS');}catch(e){injected=e.message;}
   assert.equal(injected,'P7_SIMULATED_INTERRUPTION_BETWEEN_UNITS');result.ledger=await json(ledgerFile);
   const pending=remaining(manifest.units,result.ledger);assert.equal(pending[0].order,9);assert.equal(pending.length,9);
   result.interruption={injected,after_order:8,completed_state:'SIMULATED_APPLIED',persisted_prefix_count:result.ledger.length,resume_first_order:9,read_only_checkpoint_matches:committed===await fingerprint(db),supabase_history_writes:0};
   assert.equal(result.interruption.read_only_checkpoint_matches,true);
   for(const unit of pending)await runUnit(unit);
  }else for(const unit of manifest.units)await runUnit(unit);
  assert.deepEqual(result.executed,manifest.units.map(u=>u.migration_name),'STOP_TRACKING_MODEL_UNSAFE repeated/missing units');assert.equal(new Set(result.executed).size,17);assert.equal(remaining(manifest.units,await json(ledgerFile)).length,0);
  const finalBefore=await fingerprint(db);result.postcheck=(await readonly(db,await read(DIR+'/postcheck.sql')))[0];assert.equal(result.postcheck.POSTCHECK_PASS,true,'FAIL_STAGING_PACKAGE_REPLAY postcheck');for(const k of ['scanner_closed','pricing_closed','battle_closed'])assert.equal(result.postcheck[k],true);assert.equal(await fingerprint(db),finalBefore);
  result.final_state=await finalState(db);for(const key of Object.keys(result.final_state))assert.deepEqual(result.final_state[key],reference[key],'FAIL_EXISTING_REGRESSION P6-R3 '+key);
  result.final_catalog_sha256=finalBefore;result.final_state_sha256=sha(JSON.stringify(result.final_state));result.p6_r3_semantics_identical=true;
  // A fresh-install precheck must reject a completed package, preventing blind reapply.
  result.completed_precheck=(await readonly(db,await read(DIR+'/precheck.sql')))[0];assert.equal(result.completed_precheck.PRECHECK_PASS,false);
  result.attestations=db.attestations();result.passed=true;return result;
 }finally{await db.close();await writeJSON(OUT+'/'+mode+'-replay.json',result);}
}
async function wrongTarget(){
 const pack=await loadProductionUpgradeSources(),db=await target();
 try{const b=await baseline(db,pack);const before=await fingerprint(db);const precheck=(await readonly(db,await read(DIR+'/precheck.sql')))[0];assert.equal(precheck.PRECHECK_PASS,false,'STOP_WRONG_TARGET_GUARD_FAILED');assert.equal(precheck.evidence.collect_schema_present,false);assert.equal(precheck.evidence.legacy_readiness_bodies_match,false);const after=await fingerprint(db);assert.equal(after,before);
  return {passed:true,baseline:b.report,precheck,staging_units_executed:0,before_sha256:before,after_sha256:after,attestations:db.attestations()};
 }finally{await db.close();}
}
async function main(){
 await mkdir(OUT,{recursive:true});
 const report={contract:'m6-p7-staging-target-migration-package/1',passed:false,engine:'native-PG17',postgres_major:17,target_project:'xhmjxrcskfhbovhitdej',package_target:'PREVIEW_STAGING',native_acceptance:false,
  io:Object.fromEntries(['supabase_production_queries','supabase_staging_queries','production_mutations','staging_mutations','supabase_history_writes','provider_live_requests','user_data_reads','real_beta_changes','real_migrations','merges','manual_deploys'].map(k=>[k,0]))};
 try{
  assert.ok(process.argv.includes('--native'));report.sources=await verifySources();const manifest=await build();report.manifest_sha256=sha(await readFile(DIR+'/manifest.json'));
  report.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
  const r3=await json('test-results/tcg-i3-m6-p6-r3/native-report.json'),r4=await json('test-results/tcg-i3-m6-p6-r4/native-report.json'),r1=await json('test-results/tcg-i3-m6-p6-r5-r1/generator-report.json');
  for(const r of [r3,r4,r1]){assert.equal(r.passed,true,'FAIL_EXISTING_REGRESSION');assert.deepEqual(r.ci,report.ci,'FAIL_EXISTING_REGRESSION stale evidence');}
  assert.equal(r3.cases.length,13);assert.equal(r4.cases.length,10);for(const r of [r3,r4])assert.ok(r.cases.every(c=>c.status==='PASS'),'FAIL_EXISTING_REGRESSION');assert.equal(r1.committed_bytes_checked,true);assert.equal(r1.production72_generator_run1_run2_identical,true);
  report.fresh_regressions={p6_r3:sha(await readFile('test-results/tcg-i3-m6-p6-r3/native-report.json')),p6_r4:sha(await readFile('test-results/tcg-i3-m6-p6-r4/native-report.json')),p6_r5_r1:sha(await readFile('test-results/tcg-i3-m6-p6-r5-r1/generator-report.json'))};
  report.wrong_target=await wrongTarget();console.log('PASS P7 wrong-target Production72 rejected; zero staging units');
  report.tracking_negative_cases=trackingNegativeCases(manifest.units);
  report.full=await replay(manifest,'full',r3.cases[7].evidence);report.resume=await replay(manifest,'resume',r3.cases[7].evidence);
  assert.deepEqual(report.resume.final_state,report.full.final_state);assert.equal(report.resume.final_catalog_sha256,report.full.final_catalog_sha256);assert.deepEqual(report.resume.checkpoints,report.full.checkpoints);
  report.status='M6_STAGING_MIGRATION_PACKAGE_READY';report.package_native_pg17_replay='PASS';report.precheck='PASS';report.postcheck='PASS';report.wrong_target_guard='PASS';report.resume_rehearsal='PASS';report.tracking_contract='PASS';
  Object.assign(report,{migration_versions_assigned:false,real_apply_authorized:false,beta_activation_authorized:false,production_package_created:false});
  await build();await verifySources();await writeFile(OUT+'/package-manifest.json',await readFile(DIR+'/manifest.json'));await cp(DIR,OUT+'/package',{recursive:true});report.native_acceptance=true;report.passed=true;
 }catch(e){report.error={message:e.message,stack:e.stack,code:e.code};console.error(e);process.exitCode=1;}
 finally{const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io.forbidden_external_io_attempts=io.attempts.slice();report.io.local_pg_connections=io.local_pg_connections;if(io.attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}await writeJSON(OUT+'/native-replay.json',report);}
}
if(process.argv.includes('--static')){await build();console.log('PASS P7 static preflight');}else await main();
