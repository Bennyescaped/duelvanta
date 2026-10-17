// Build-time authored target; never learns an expected inventory at runtime.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {baseline,install as installI2} from './helpers/tcg-i2-fixture.mjs';
import {queries as m4Queries} from './generate-tcg-i3-magic-readiness.mjs';
import {unchangedContract} from './generate-tcg-i2-readiness.mjs';
export async function queries(){
 const q=await m4Queries();
 const extra=String.raw`
 union all select 'm6_function','public.get_magic_on_demand_collection_beta_v1()',jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',r.rolname)
 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.get_magic_on_demand_collection_beta_v1()'::regprocedure
 union all select 'm6_beta_contract','dv_collect_private.tcg_magic_on_demand_beta',coalesce(jsonb_agg(to_jsonb(b)-'enabled' order by game_key collate "C"),'[]'::jsonb) from dv_collect_private.tcg_magic_on_demand_beta b
 `;
 q[0]=q[0].replace(' ) select jsonb_agg',extra+' ) select jsonb_agg').replace(/\n[ \t]+\n/g,'\n\n');return q;
}
export async function helperSQL(){const [sq,lq]=await queries();return String.raw`create function dv_collect_private.tcg_magic_on_demand_schema_v1() returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $inventory$
 declare s jsonb;l jsonb;begin ${sq} into s;${lq} into l;
 return jsonb_build_object('security_inventory',s,'legal_inventory',l);end$inventory$;
 revoke all on function dv_collect_private.tcg_magic_on_demand_schema_v1() from public,anon,authenticated,service_role;
 `;}
export async function generate(db){
 await baseline(db);await installI2(db);
 for(const p of ['tcg-i3-magic-persistence-v1.sql','tcg-i3-magic-readiness-v1.sql'])await db.exec(await readFile(new URL('../database/'+p,import.meta.url),'utf8'));
 await db.exec('set search_path=pg_catalog,public,dv_collect_private');
 const before=[];for(const query of await m4Queries())before.push((await db.query(query)).rows[0].jsonb_agg);
 await db.exec(await readFile(new URL('../database/tcg-i3-magic-on-demand-v1.sql',import.meta.url),'utf8'));
 const helper=await helperSQL();await db.exec(helper);
 const expected=[];for(const query of await queries())expected.push((await db.query(query)).rows[0].jsonb_agg);
 const allowed=new Set(['table:public.collection_items','function:dv_collect_private.tcg_require_collection_release_v1()','function:public.save_my_tcg_collection_item_v1(p_item_id uuid, p_game_key text, p_item jsonb)','catalog_constraint:public.collection_items.collection_items_tcg_check']);
 for(let i=0;i<2;i++)unchangedContract(before[i],expected[i],allowed);
 const bootstrap=(await db.query(String.raw`select md5(p.prosrc) body,r.rolname owner,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result,p.proconfig config,p.provolatile volatility,p.prosecdef definer,p.proacl::text acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='tcg_magic_on_demand_schema_v1'`)).rows[0];
 assert.equal(bootstrap.owner,'postgres');await db.exec('rollback');
 const render=(name,revision,index)=>String.raw`create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $bridge$
 declare a jsonb;b jsonb;compatible boolean:=false;begin
 select jsonb_build_object('body',md5(p.prosrc),'owner',r.rolname,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef,'acl',p.proacl::text) into b
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='tcg_magic_on_demand_schema_v1';
 if b is distinct from $bootstrap$${JSON.stringify(bootstrap)}$bootstrap$::jsonb then return jsonb_build_object('revision','${revision}','compatible',false,'tcg_beta_contract','magic-on-demand-collect-beta/1');end if;
 a:=dv_collect_private.tcg_magic_on_demand_schema_v1();
 compatible:=coalesce(a->'${index===0?'security_inventory':'legal_inventory'}'=$target$${JSON.stringify(expected[index])}$target$::jsonb,false)${index===1?" and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)":''};
 return jsonb_build_object('revision','${revision}','compatible',compatible,'tcg_beta_contract','magic-on-demand-collect-beta/1');
 exception when others then return jsonb_build_object('revision','${revision}','compatible',false,'tcg_beta_contract','magic-on-demand-collect-beta/1');end$bridge$;
 revoke all on function public.${name}() from public,anon,authenticated,service_role;
 grant execute on function public.${name}() to authenticated;
 `;
 return {sql:'-- M6 additive cumulative authored target. OFF/ON use the same protected schema.\n-- Completes the transaction begun by the M6 delta; does not activate beta.\n'+helper+render('get_security_schema_readiness_v1','privilege-mfa-v1',0)+render('get_market_legal_schema_readiness_v1','trade-legal-contract-model-v1.2',1)+'commit;\n',counts:expected.map(x=>x.length)};
}
if(process.argv[1]?.endsWith('generate-tcg-i3-magic-on-demand-readiness.mjs')){
 const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');const db=new PGlite({extensions:{pgcrypto}});
 try{const r=await generate(db),path=new URL('../database/tcg-i3-magic-on-demand-readiness-v1.sql',import.meta.url);if(process.argv.includes('--check'))assert.equal(await readFile(path,'utf8'),r.sql,'M6 readiness stale');else await writeFile(path,r.sql);console.log('PASS M6 authored targets',JSON.stringify(r.counts),'PGlite authoring only; native acceptance separate');}finally{await db.close();}
}
