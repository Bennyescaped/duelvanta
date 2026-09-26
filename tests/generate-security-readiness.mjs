// Offline authored target only. Never connects to Supabase. Historical legal migration is immutable.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {catalogQuery} from './helpers/legal-readiness-catalog.mjs';
const schemas="'public','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private','dv_collect_private'";
export const securityQuery=`with checks as (
 select 'relation' k,n.nspname||'.'||c.relname name,jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,
 'rights',(select jsonb_agg(jsonb_build_array(r,v,case when c.relkind='S' then has_sequence_privilege(r,c.oid,v) else has_table_privilege(r,c.oid,v) end) order by r,v)
 from unnest(array['anon','authenticated','service_role']) r cross join lateral unnest(case when c.relkind='S' then array['USAGE','SELECT','UPDATE'] else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] end) v),
 'columns',(select jsonb_agg(jsonb_build_array(r,a.attname,v,has_column_privilege(r,c.oid,a.attnum,v)) order by r,a.attnum,v) from pg_attribute a cross join unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) v where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and c.relkind<>'S'),
 'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles::regrole[]::text[],pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid)) v
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in (${schemas}) and c.relkind in ('r','p','v','m','f','S')
 union all select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_object('body',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'result',pg_get_function_result(p.oid),'language',l.lanname,'volatility',p.provolatile,'strict',p.proisstrict,'rights',(select jsonb_agg(jsonb_build_array(r,has_function_privilege(r,p.oid,'EXECUTE')) order by r) from unnest(array['anon','authenticated','service_role']) r))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname in (${schemas}) and p.proname not in ('get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1')
 union all select 'schema',n.nspname,jsonb_agg(jsonb_build_array(r,has_schema_privilege(r,n.oid,'USAGE'),has_schema_privilege(r,n.oid,'CREATE')) order by r) from pg_namespace n cross join unnest(array['anon','authenticated','service_role']) r where n.nspname in (${schemas}) group by n.oid,n.nspname
 union all select 'defaults',coalesce(n.nspname,'GLOBAL')||'.'||pg_get_userbyid(d.defaclrole)||'.'||d.defaclobjtype::text,jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable) order by coalesce(r.rolname,'PUBLIC'),a.privilege_type)
 from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a left join pg_roles r on r.oid=a.grantee where d.defaclrole='postgres'::regrole and (n.nspname in (${schemas}) or n.oid is null) group by n.nspname,d.defaclrole,d.defaclobjtype
 ) select jsonb_agg(jsonb_build_array(k,name,md5(v::text)) order by k collate "C",name collate "C") from checks`;
async function generate(){
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await securitySchemaFixture(db);
  for(const f of ['database/auth-privileged-step-up-v1.sql','database/security-privilege-mfa-hardening-v1.sql'])await db.exec(await read(f));
  if(process.argv.includes('--trade-lock'))await db.exec(await read('database/market-production-trade-lock-v1.sql'));
  if(process.argv.includes('--data-export'))await db.exec(await read('database/account-data-export-collect-battle-v1.sql'));
  if(process.argv.includes('--processing-markers')){
   if(!process.argv.includes('--data-export')||!process.argv.includes('--trade-lock'))throw Error('G1 requires reviewed P0-05/T2 base');
   await db.exec(await read('database/account-processing-markers-v1.sql'));
  }
  if(process.argv.includes('--closure-privacy')){
   if(!process.argv.includes('--processing-markers'))throw Error('G2 requires G1');
   await db.exec(await read('database/account-closure-privacy-v1.sql'));
  }
  await db.exec('set search_path=pg_catalog,public');
  const tables=(await db.query(`select n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='dv_market_private' or (n.nspname='public' and (c.relname like 'market_%' or c.relname='profiles'))) order by 1`)).rows.map(x=>x.name);
  const funcs=(await db.query(`select distinct n.nspname||'.'||p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' or (n.nspname='public' and p.proname<>'get_market_legal_schema_readiness_v1' and (p.proname like '%market%' or p.proname like '%account_deletion%' or p.proname like '%duelvanta_data%' or p.proname like '%trade_eligibility%')) order by 1`)).rows.map(x=>x.name);
  const legal=catalogQuery(tables,funcs),le=(await db.query(legal)).rows[0].jsonb_agg,se=(await db.query(securityQuery)).rows[0].jsonb_agg;
  function sql(name,query,expected,revision,extra=''){return `create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
 declare actual jsonb;begin ${query} into actual;
 return jsonb_build_object('revision','${revision}','compatible',coalesce(actual=$catalog$${JSON.stringify(expected)}$catalog$::jsonb,false)${extra});
 exception when others then return jsonb_build_object('revision','${revision}','compatible',false);end$$;
 revoke all on function public.${name}() from public,anon,authenticated,service_role;
 grant execute on function public.${name}() to authenticated;\n`;}
  const output='-- Generated OFFLINE from reviewed fixture + explicit Step 9A candidate. No live drift inputs.\n-- Apply after both candidate SQL files. Legal semantics stay v1.2; security contract is separately versioned.\nbegin;\n'+sql('get_security_schema_readiness_v1',securityQuery,se,'privilege-mfa-v1')+sql('get_market_legal_schema_readiness_v1',legal,le,'trade-legal-contract-model-v1.2'," and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)")+'commit;\n';
  const rendered=process.argv.includes('--trade-lock')?output.replace('reviewed fixture + explicit Step 9A candidate','reviewed fixture + Step 9A + explicit P0-05 lock candidate').replace('Apply after both candidate SQL files.','Apply after market-production-trade-lock-v1.sql in the same release transaction.'):output;
  const exportTarget=process.argv.includes('--data-export');
  const baseTarget=exportTarget?rendered.replace('-- Generated OFFLINE', '-- T2 export candidate; generated OFFLINE').replace('-- Apply after', '-- Apply account-data-export-collect-battle-v1.sql before this contract.\n-- Base:'):rendered;
  const g1Target=process.argv.includes('--processing-markers')?baseTarget.replace('-- T2 export candidate;', '-- G1 marker integrity candidate;').replace('-- Base:', '-- Apply account-processing-markers-v1.sql after T2 and before this contract.\n-- Base:'):baseTarget;
  const target=process.argv.includes('--closure-privacy')?g1Target.replace('-- G1 marker integrity candidate;', '-- G2 closure privacy candidate;').replace('-- Base:', '-- Apply account-closure-privacy-v1.sql after G1 and before this contract.\n-- Base:'):g1Target;
  const filename=process.argv.includes('--closure-privacy')?'account-closure-privacy-readiness-v1.sql':process.argv.includes('--processing-markers')?'account-processing-markers-readiness-v1.sql':exportTarget?(process.argv.includes('--trade-lock')?'account-data-export-trade-lock-readiness-v1.sql':'account-data-export-readiness-v1.sql'):(process.argv.includes('--trade-lock')?'market-production-trade-lock-readiness-v1.sql':'security-readiness-v1.sql');
  const path=new URL('../database/'+filename,import.meta.url);
  if(process.argv.includes('--check')){if(target!==await readFile(path,'utf8'))throw Error('Security contract stale; review semantic changes before offline regeneration');}
  else await writeFile(path,target);
  console.log('PASS: authored security readiness contract',se.length,'security checks,',le.length,'legal checks');
 }finally{await db.close()}
}
if(process.argv[1]?.endsWith('generate-security-readiness.mjs'))await generate();
