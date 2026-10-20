import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {database} from '../helpers/tcg-i3-magic-fixture.mjs';
import {history72} from './author.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
let db;try{
db=await database(true);await history72(db);
const lock=async()=>(await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) source_md5 from pg_proc p where p.proname='reject_new_trade_while_locked_v1' order by 1")).rows;
const before=await lock();await db.exec(await readFile(root+'database/local-candidates/magic-collect-admission-r9/candidate.sql','utf8'));
const r={version:db.version,trade_lock_before:before,trade_lock_after:await lock()};assert.deepEqual(r.trade_lock_before,r.trade_lock_after);
r.relations=(await db.query("select c.oid::regclass::text relation,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relacl::text acl from pg_class c where c.oid in ('dv_collect_private.magic_collect_admission_v1'::regclass,'dv_collect_private.magic_collect_admission_audit_v1'::regclass,'dv_collect_private.tcg_magic_on_demand_beta'::regclass) order by 1")).rows;
r.rights=(await db.query("select t,role,priv,has_table_privilege(role,t,priv) allowed from unnest(array['dv_collect_private.magic_collect_admission_v1','dv_collect_private.magic_collect_admission_audit_v1','dv_collect_private.tcg_magic_on_demand_beta']) t cross join unnest(array['anon','authenticated','service_role']) role cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) priv order by 1,2,3")).rows;
r.functions=(await db.query("select n.nspname||'.'||p.proname name,pg_get_function_identity_arguments(p.oid) args,md5(p.prosrc) body_md5,p.proacl::text acl,p.prosecdef definer,p.proconfig config,p.provolatile volatility,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('magic_collect_admitted_v1','magic_collect_admission_audit_v1','magic_collect_admission_schema_v1','get_magic_on_demand_collection_beta_v1','save_my_tcg_collection_item_v1','tcg_require_collection_release_v1','get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1') order by 1")).rows;
r.policies=(await db.query("select polrelid::regclass::text relation,polname,polcmd,polroles::regrole[]::text[],pg_get_expr(polqual,polrelid) using_expression,pg_get_expr(polwithcheck,polrelid) check_expression from pg_policy where polrelid in ('public.collection_items'::regclass,'dv_collect_private.magic_collect_admission_v1'::regclass,'dv_collect_private.magic_collect_admission_audit_v1'::regclass) order by 1,2")).rows;
r.triggers=(await db.query("select tgrelid::regclass::text relation,tgname,pg_get_triggerdef(oid) definition,tgenabled from pg_trigger where not tgisinternal and tgrelid in ('public.collection_items'::regclass,'dv_collect_private.magic_collect_admission_v1'::regclass) order by 1,2")).rows;
r.release=(await db.query("select game_key,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows;
r.flags=(await db.query("select game_key,available,collection_ready,marketplace_ready from dv_collect_private.tcg_games where game_key='magic'")).rows;
r.beta=(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows;
r.members=(await db.query('select count(*)::int n from dv_collect_private.magic_collect_admission_v1')).rows[0].n;assert.equal(r.members,0);assert.equal(r.beta[0].enabled,false);
await writeFile(root+'test-results/tcg-i3-m6-r9/catalog-acl-rls.json',JSON.stringify(r,null,2)+'\n');
}finally{if(db)await db.close();}
