import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {DIR,OUT,build,sha,json,writeJSON,remaining} from './helpers/tcg-i3-m6-p7-migration-package.mjs';

const manifest=await build(),r=await json(OUT+'/native-replay.json');
assert.equal(r.passed,true);assert.equal(r.native_acceptance,true);assert.equal(r.engine,'native-PG17');assert.equal(r.postgres_major,17);
assert.equal(r.status,'M6_STAGING_MIGRATION_PACKAGE_READY');assert.equal(r.target_project,manifest.target_project_ref);
const ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};assert.deepEqual(r.ci,ci);
assert.equal(r.manifest_sha256,sha(await readFile(DIR+'/manifest.json')));assert.deepEqual(await readFile(OUT+'/package-manifest.json'),await readFile(DIR+'/manifest.json'));
for(const key of ['package_native_pg17_replay','precheck','postcheck','wrong_target_guard','resume_rehearsal','tracking_contract'])assert.equal(r[key],'PASS');
for(const key of ['migration_versions_assigned','real_apply_authorized','beta_activation_authorized','production_package_created'])assert.equal(r[key],false);
for(const [key,value] of Object.entries(r.io)){if(key==='local_pg_connections')assert.ok(value>=6);else if(key==='forbidden_external_io_attempts')assert.deepEqual(value,[]);else assert.equal(value,0,key);}
assert.equal(r.wrong_target.baseline.history_count,72);assert.equal(r.wrong_target.passed,true);assert.equal(r.wrong_target.precheck.PRECHECK_PASS,false);assert.equal(r.wrong_target.staging_units_executed,0);assert.equal(r.wrong_target.before_sha256,r.wrong_target.after_sha256);
for(const mode of ['full','resume']){
 const v=r[mode];assert.deepEqual(v,await json(OUT+'/'+mode+'-replay.json'));assert.equal(v.passed,true);assert.equal(v.precheck.PRECHECK_PASS,true);assert.equal(v.postcheck.POSTCHECK_PASS,true);assert.equal(v.completed_precheck.PRECHECK_PASS,false);assert.equal(v.p6_r3_semantics_identical,true);
 assert.deepEqual(v.executed,manifest.units.map(u=>u.migration_name));assert.equal(v.checkpoints.length,17);assert.ok(v.checkpoints.every(c=>c.read_only&&c.lock.function===null&&c.lock.triggers===0&&c.objects.history===null));assert.equal(remaining(manifest.units,v.ledger).length,0);assert.deepEqual(v.ledger,await json(OUT+'/'+mode+'-simulated-ledger.json'));
}
assert.equal(r.resume.interruption.after_order,8);assert.equal(r.resume.interruption.persisted_prefix_count,8);assert.equal(r.resume.interruption.resume_first_order,9);assert.equal(r.resume.interruption.read_only_checkpoint_matches,true);
assert.deepEqual(r.resume.final_state,r.full.final_state);assert.deepEqual(r.resume.checkpoints,r.full.checkpoints);assert.equal(r.resume.final_catalog_sha256,r.full.final_catalog_sha256);assert.equal(r.tracking_negative_cases.length,5);assert.ok(r.tracking_negative_cases.every(c=>c.rejected&&c.units_executed===0));
const regressions={p6_r3:'test-results/tcg-i3-m6-p6-r3/native-report.json',p6_r4:'test-results/tcg-i3-m6-p6-r4/native-report.json',p6_r5_r1:'test-results/tcg-i3-m6-p6-r5-r1/generator-report.json'};
for(const [key,path] of Object.entries(regressions)){assert.equal(r.fresh_regressions[key],sha(await readFile(path)));const previous=await json(path);assert.equal(previous.passed,true);assert.deepEqual(previous.ci,ci);}
const files={};for(const p of ['manifest.json',...Object.keys(manifest.files),...manifest.units.map(u=>u.query_path)]){const b=await readFile(DIR+'/'+p);assert.deepEqual(await readFile(OUT+'/package/'+p),b);files[p]={sha256:sha(b),bytes:b.length};}
await writeJSON(OUT+'/evidence-verification.json',{passed:true,status:r.status,ci,report_sha256:sha(await readFile(OUT+'/native-replay.json')),files,unit_count:17,transaction_units_valid:true,source_unit_bytes_identical:true,wrong_target_guard:'PASS',resume_rehearsal:'PASS',tracking_contract:'PASS',fresh_regressions:r.fresh_regressions,real_apply_authorized:false,supabase_history_writes:0});
console.log('PASS P7 migration package evidence verification');
