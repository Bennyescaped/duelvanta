// Native-only deterministic authoring; never rewrites R9 sources.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {database} from '../helpers/tcg-i3-magic-fixture.mjs';
import {renderRoots} from '../r9/author.mjs';
import {bootstrapQuery} from '../generate-tcg-staging70-readiness.mjs';
import {root,base,history73} from './fixture.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');let db;
try{
 assert.ok(process.argv.includes('--native'));db=await database(true);const history=await history73(db);
 const prefix=await readFile(base+'operations.sql','utf8');await db.exec(prefix);
 const bootstrap=(await db.query(bootstrapQuery('magic_collect_admission_schema_v1'))).rows[0];
 const inventory=(await db.query('select dv_collect_private.magic_collect_admission_schema_v1() v')).rows[0].v;
 const suffix=renderRoots(bootstrap,inventory)+'commit;\n';await db.exec(suffix);
 for(const f of ['get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1'])assert.equal((await db.query('select public.'+f+'() v')).rows[0].v.compatible,true);
 const unit=prefix+suffix;await mkdir(base+'migration-units',{recursive:true});await writeFile(base+'migration-units/dv_staging_m6r5_01_magic_operations.sql',unit);
 await writeFile(base+'inventories.json',JSON.stringify({bootstrap,inventory},null,2)+'\n');
 const oldPost=await readFile(root+'database/target-upgrades/staging-m6-r4-v1/postcheck.sql','utf8');
 await writeFile(base+'precheck.sql',`-- NOT_AUTO_APPLY. Read-only exact History73 baseline.\nwith baseline as (${oldPost.trim().replace(/;$/,'')}) select coalesce(baseline."POSTCHECK_PASS" and (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)='${JSON.stringify(history)}'::jsonb and to_regclass('dv_collect_private.magic_transport_policy_v1') is null and not exists(select 1 from supabase_migrations.schema_migrations where name='dv_staging_m6r5_01_magic_operations'),false) as "PRECHECK_PASS" from baseline;\n`);
 const post=`-- NOT_AUTO_APPLY. Read-only.\nwith checks as (select
 (select to_jsonb(t) from (${bootstrapQuery('magic_collect_admission_schema_v1')}) t)='${JSON.stringify(bootstrap)}'::jsonb trusted_helper,
 current_setting('server_version_num')::int/10000=17 pg17,
 (select count(*)=74 from supabase_migrations.schema_migrations) history74,
 (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from (select version,name from supabase_migrations.schema_migrations order by version limit 73) h)='${JSON.stringify(history)}'::jsonb history73_prefix_exact,
 (select count(*)=1 from supabase_migrations.schema_migrations where name='dv_staging_m6r5_01_magic_operations' and version>'20261014192812') single_r5,
 dv_collect_private.magic_collect_admission_schema_v1()='${JSON.stringify(inventory)}'::jsonb exact_inventory,
 (public.get_security_schema_readiness_v1()->>'compatible')::boolean security_compatible,
 (public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean legal_compatible,
 (select count(*)=1 and bool_and(not enabled) from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic') beta_off,
 (select count(*)=1 and bool_and(not enabled and global_limit=0 and user_limit=0 and window_seconds=60 and authorization_ref='') from dv_collect_private.magic_transport_policy_v1) policy_off_zero,
 not exists(select 1 from dv_collect_private.magic_collect_admission_v1) empty_admission,
 not exists(select 1 from dv_collect_private.magic_collect_admission_audit_v1) empty_audit,
 not exists(select 1 from dv_collect_private.magic_operator_receipts_v1) empty_operator_receipts,
 not exists(select 1 from dv_collect_private.magic_transport_usage_v1) empty_usage,
 not exists(select 1 from dv_collect_private.magic_transport_reservations_v1) empty_reservations,
 (select not available and not collection_ready and not marketplace_ready from dv_collect_private.tcg_games where game_key='magic') capabilities_closed,
 (select state='foundation' and snapshot_id is null from dv_collect_private.tcg_catalog_releases where game_key='magic') foundation_only
 ) select coalesce((select bool_and(value='true'::jsonb) from jsonb_each(to_jsonb(checks))),false) as "POSTCHECK_PASS",to_jsonb(checks) evidence from checks;\n`;
 await writeFile(base+'postcheck.sql',post);
 await writeFile(base+'supersession.json',JSON.stringify({mode:'forward-only',required_applied_r4:'20261014192812',reapply_r4:false,history_before:73,history_after:74},null,2)+'\n');
 const files=[];for(const path of ['README.md','operations.sql','inventories.json','precheck.sql','postcheck.sql','supersession.json','migration-units/dv_staging_m6r5_01_magic_operations.sql']){const b=await readFile(base+path);files.push({path,bytes:b.length,sha256:sha(b)});}
 const manifest={contract:'staging-m6-r5/1',package_mode:'NOT_AUTO_APPLY',real_apply_authorized:false,beta_activation_authorized:false,target_project_ref:'xhmjxrcskfhbovhitdej',source_head:'a5b589bb7f08fa0a26f62fbae6f85dc7e23a48ff',source_tree:'81e715467bc1e6cc5f010d7b6cacc9f332c55628',postgres_major:17,required_history_count:73,expected_history_count:74,required_history:history,history_identity_sha256:sha(JSON.stringify(history)),units:[{order:1,name:'dv_staging_m6r5_01_magic_operations',version:null,query_path:'migration-units/dv_staging_m6r5_01_magic_operations.sql',query_sha256:sha(unit),query_bytes:Buffer.byteLength(unit)}],execution_order:['verify target/history/hashes','read-only precheck PASS','separate operator authorization','apply Unit01 once via migration registrar','History74 prefix check','read-only postcheck PASS'],files};
 await writeFile(base+'manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({passed:true,postgres:db.version,unit_bytes:Buffer.byteLength(unit),unit_sha256:sha(unit),history:history.length}));
}finally{if(db){await db.exec('rollback');await db.close();}}
