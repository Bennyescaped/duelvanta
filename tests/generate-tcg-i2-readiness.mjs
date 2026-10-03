// Authored cumulative target only. Historical contracts are negative baselines.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {baseline,install} from './helpers/tcg-i2-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
export const tables=['tcg_games','tcg_providers','tcg_provider_bindings','tcg_languages','tcg_sets','tcg_cards','tcg_card_variants','tcg_sealed_products','tcg_provider_refs','collection_item_catalog_links','listing_catalog_links'].map(x=>'dv_collect_private.'+x);
export const functions=['tcg_validate_link_v1','tcg_clear_stale_link_v1','tcg_own_links_v1','tcg_set_own_link_v1'].map(x=>'dv_collect_private.'+x).concat(['public.get_my_tcg_catalog_links_v1','public.set_my_collection_catalog_link_v1','public.set_my_listing_catalog_link_v1']);
export async function contracts(){const source=await read('database/account-erasure-l1-readiness-v1.sql');const parts=[...source.matchAll(/begin ([\s\S]*?) into actual;[\s\S]*?\$catalog\$([\s\S]*?)\$catalog\$/g)];assert.equal(parts.length,2);return parts.map(p=>({query:p[1],expected:JSON.parse(p[2])}));}
export async function queries(){const [security,legal]=await contracts();const add=names=>names.map(n=>"('"+n+"')").join(',');
 const sq=security.query.replace(' ) select jsonb_agg',`\n union all select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and t.tgname in ('tcg_validate_link','tcg_clear_stale_link')
 union all select 'seed','dv_collect_private.tcg_games',coalesce(jsonb_agg(to_jsonb(g) order by game_key collate "C"),'[]'::jsonb) from dv_collect_private.tcg_games g
 union all select 'seed','dv_collect_private.tcg_providers',coalesce(jsonb_agg(to_jsonb(g) order by provider_key collate "C"),'[]'::jsonb) from dv_collect_private.tcg_providers g
 union all select 'seed','dv_collect_private.tcg_provider_bindings',coalesce(jsonb_agg(to_jsonb(g) order by game_key collate "C",provider_key collate "C",provider_version collate "C"),'[]'::jsonb) from dv_collect_private.tcg_provider_bindings g
 union all select 'seed','dv_collect_private.tcg_languages',coalesce(jsonb_agg(to_jsonb(g) order by language_code collate "C"),'[]'::jsonb) from dv_collect_private.tcg_languages g
 ) select jsonb_agg`);
 assert.notEqual(sq,security.query);
 const lq=legal.query.replace('),\n required_functions',','+add([...tables,'public.collection_items'])+'),\n required_functions').replace('),\n checks as',','+add(functions)+'),\n checks as');assert.notEqual(lq,legal.query);
 return[sq,lq];}
const map=rows=>new Map(rows.map(([kind,name,hash])=>[kind+':'+name,hash]));
export function unchangedContract(before,after,allowed){const m=map(after);for(const [key,hash] of map(before)){assert.ok(m.has(key),'protected source removed: '+key);if(!allowed.has(key))assert.equal(m.get(key),hash,'unexpected protected delta: '+key);}}
export async function generate(db){await baseline(db);const old=await contracts();for(const c of old)assert.deepEqual((await db.query(c.query)).rows[0].jsonb_agg,c.expected,'baseline contract not reproducible');
 await install(db,false);const q=await queries(),actual=[];for(const query of q)actual.push((await db.query(query)).rows[0].jsonb_agg);
 const allowed=new Set(['function:public.export_my_duelvanta_data()','function:public.prepare_account_deletion_data(p_request_id uuid, p_lock_token uuid)','table:public.market_listings']);
 for(let i=0;i<2;i++)unchangedContract(old[i].expected,actual[i],allowed);
 const render=(name,query,expected,revision,extra='')=>`create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$\n declare actual jsonb;begin ${query} into actual;\n return jsonb_build_object('revision','${revision}','compatible',coalesce(actual=$catalog$${JSON.stringify(expected)}$catalog$::jsonb,false)${extra});\n exception when others then return jsonb_build_object('revision','${revision}','compatible',false);end$$;\n revoke all on function public.${name}() from public,anon,authenticated,service_role;\n grant execute on function public.${name}() to authenticated;\n`;
 return{sql:'-- I2 R1 OFFLINE authored cumulative target after L1 + tcg-i2-canonical-integration-v1.sql.\n-- No historical contract rewritten. All protected old sources retained.\nbegin;\n'+render('get_security_schema_readiness_v1',q[0],actual[0],'privilege-mfa-v1')+render('get_market_legal_schema_readiness_v1',q[1],actual[1],'trade-legal-contract-model-v1.2'," and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)")+'commit;\n',counts:actual.map(x=>x.length)};}
if(process.argv[1]?.endsWith('generate-tcg-i2-readiness.mjs')){
 const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');const db=new PGlite({extensions:{pgcrypto}});
 try{const result=await generate(db),path=new URL('../database/tcg-i2-readiness-v1.sql',import.meta.url);if(process.argv.includes('--check'))assert.equal(await readFile(path,'utf8'),result.sql,'I2 readiness stale');else await writeFile(path,result.sql);console.log('PASS authored I2 contract',JSON.stringify(result.counts),'PGlite PG18 preparation, NOT native PG17');}finally{await db.close();}
}
