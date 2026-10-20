import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {database} from '../helpers/tcg-i3-magic-fixture.mjs';
import {reconstruct,history70Gate,bootstrapQuery} from '../generate-tcg-staging70-readiness.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'database/local-candidates/magic-collect-admission-r9/';
const read=p=>readFile(p,'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const report={engine:'native-PG17',synthetic_only:true,real_operations:0};let db;
export async function history72(db){
 await reconstruct(db);await history70Gate(db);
 const base=root+'database/target-upgrades/staging-m6-r3-v1/';
 assert.equal((await db.query(await read(base+'precheck.sql'))).rows[0].PRECHECK_PASS,true);
 const manifest=JSON.parse(await read(base+'manifest.json'));
 for(const u of manifest.units){const b=await readFile(base+u.query_path);assert.equal(sha(b),u.query_sha256);assert.equal(b.length,u.query_bytes);await db.exec(b.toString());}
 assert.equal((await db.query(await read(base+'postcheck.sql'))).rows[0].POSTCHECK_PASS,true);
}
const roots=['get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1'];
export function renderRoots(bootstrap,inventory){return roots.map((name,i)=>`create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $bridge$
declare a jsonb;b jsonb;expected jsonb;compatible boolean:=false;begin
select jsonb_build_object('body',md5(p.prosrc),'owner',r.rolname,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef,'acl',p.proacl::text) into b from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='magic_collect_admission_schema_v1';
if b is distinct from $bootstrap$${JSON.stringify(bootstrap)}$bootstrap$::jsonb then return jsonb_build_object('revision','${i?'trade-legal-contract-model-v1.2':'privilege-mfa-v1'}','compatible',false,'tcg_beta_contract','magic-on-demand-collect-beta/1');end if;
a:=dv_collect_private.magic_collect_admission_schema_v1();expected:=$target$${JSON.stringify(inventory[i?'legal_inventory':'security_inventory'])}$target$::jsonb;
compatible:=coalesce(a->'${i?'legal_inventory':'security_inventory'}'=expected,false)${i?" and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)":''};
return jsonb_build_object('revision','${i?'trade-legal-contract-model-v1.2':'privilege-mfa-v1'}','compatible',compatible,'tcg_beta_contract','magic-on-demand-collect-beta/1');
exception when others then return jsonb_build_object('revision','${i?'trade-legal-contract-model-v1.2':'privilege-mfa-v1'}','compatible',false,'tcg_beta_contract','magic-on-demand-collect-beta/1');end$bridge$;
revoke all on function public.${name}() from public,anon,authenticated,service_role;
grant execute on function public.${name}() to authenticated;
`).join('');}
if(process.argv[1]?.endsWith('/author.mjs')){
try{
 db=await database(true);report.version=db.version;await history72(db);
 const before=(await db.query('select dv_collect_private.tcg_magic_on_demand_schema_v1() v')).rows[0].v;
 const admission=await read(dir+'admission.sql'),helper=await read(dir+'inventory-helper.sql');
 await db.exec(admission+helper);
 const bootstrap=(await db.query(bootstrapQuery('magic_collect_admission_schema_v1'))).rows[0];
 const inventory=(await db.query('select dv_collect_private.magic_collect_admission_schema_v1() v')).rows[0].v;
 const suffix=renderRoots(bootstrap,inventory)+'commit;\n';await db.exec(suffix);
 for(const name of roots)assert.equal((await db.query('select public.'+name+'() v')).rows[0].v.compatible,true);
 const full=admission+helper+suffix;await writeFile(dir+'candidate.sql',full);
 await writeFile(dir+'inventories.json',JSON.stringify({before,after:inventory,bootstrap},null,2)+'\n');
 report.sha256=sha(full);report.bytes=Buffer.byteLength(full);report.inventory_counts={before:[before.security_inventory.length,before.legal_inventory.length],after:[inventory.security_inventory.length,inventory.legal_inventory.length]};
 await db.close();db=await database(true);await history72(db);await db.exec(full);
 const actual=(await db.query('select dv_collect_private.magic_collect_admission_schema_v1() v')).rows[0].v;
 assert.deepEqual(actual,inventory);const b2=(await db.query(bootstrapQuery('magic_collect_admission_schema_v1'))).rows[0];assert.equal(admission+helper+renderRoots(b2,actual)+'commit;\n',full);
 report.independent_reconstruction_byte_identical=true;report.passed=true;
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e);}
finally{if(db){await db.exec('rollback');await db.close();}await mkdir(root+'test-results/tcg-i3-m6-r9',{recursive:true});await writeFile(root+'test-results/tcg-i3-m6-r9/author.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}
