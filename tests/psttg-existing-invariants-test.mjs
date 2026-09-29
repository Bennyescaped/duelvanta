import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {publicationFixture,A} from './helpers/publication-hold-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const out={native,passed:false,scope:'Existing complete schema and core: installation and pure reader/freshness preserve all table contents, holds, generations, function/ACL/FK/trigger definitions.'};
const scalar=async(s,p=[])=>(await db.query(s,p)).rows[0]?.v;
const quote=x=>'"'+x.replaceAll('"','""')+'"';
try{
 await publicationFixture(db);
 for(const f of ['publication-processing-hold-v1','battle-safety-sanctions-v1','account-deletion-withdrawal-v1','account-erasure-l1-v1'])await db.exec(await read('database/'+f+'.sql'));
 // Realistic synthetic protected tax/seller source payloads. No real IDs/keys.
 await db.query("insert into dv_market_private.seller_tax_identifiers(seller_id,identifier_kind,issuing_country_code,identifier_ciphertext,identifier_hash) values($1,'tin','DE',decode('010203','hex'),sha256('synthetic'))",[A]);
 await db.query("insert into dv_market_private.market_tax_exports(reporting_year,export_format,export_kind,source_event_count,row_count,payload_text,payload_sha256) values(2026,'json','annual',0,0,'synthetic-review',sha256('synthetic-review'))");
 let tables=(await db.query("select c.oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_%' order by 2,3")).rows;
 let functions=(await db.query("select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema')")).rows.map(x=>x.oid);
 const snapshot=async()=>{
  const rows={};for(const t of tables)rows[t.nspname+'.'+t.relname]=await scalar(`select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(x)::text,E'\n' order by to_jsonb(x)::text),''),'UTF8')),'hex') v from ${quote(t.nspname)}.${quote(t.relname)} x`);
  return {rows,functions:(await db.query('select oid,prosrc,proacl::text,proowner,prosecdef,proconfig from pg_proc where oid=any($1::oid[]) order by oid',[functions])).rows,
   relations:(await db.query('select oid,relacl::text,relowner,relrowsecurity,relforcerowsecurity from pg_class where oid=any($1::oid[]) order by oid',[tables.map(x=>x.oid)])).rows,
   constraints:(await db.query('select oid,pg_get_constraintdef(oid) def from pg_constraint where conrelid=any($1::oid[]) order by oid',[tables.map(x=>x.oid)])).rows,
   triggers:(await db.query('select oid,pg_get_triggerdef(oid) def from pg_trigger where tgrelid=any($1::oid[]) order by oid',[tables.map(x=>x.oid)])).rows};
 };
 const before=await snapshot();await db.exec(await read('database/psttg-capture-core-v1.sql'));assert.deepEqual(await snapshot(),before);
 assert.equal(await scalar("select has_schema_privilege('dv_psttg_core_owner','extensions','USAGE') v"),true);
 assert.equal(await scalar("select count(*)::int v from pg_constraint where contype='f' and conrelid in (select oid from pg_class where relname like 'psttg_%') and confrelid='auth.users'::regclass"),0);
 out.existing_tables=tables.length;out.existing_functions=functions.length;out.before_after_hashes=before.rows;
 // Installing the reader leaves every pre-existing core/data function unchanged.
 tables=(await db.query("select c.oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_%' order by 2,3")).rows;
 functions=(await db.query("select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema')")).rows.map(x=>x.oid);
 const coreBefore=await snapshot();await db.exec(await read('database/psttg-removal-evaluation-v1.sql'));assert.deepEqual(await snapshot(),coreBefore);
 const scope=await scalar("select dv_market_private.psttg_ensure_scope('subject',sha256('synthetic-reader-invariant'),null,null) v");
 functions=(await db.query("select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema')")).rows.map(x=>x.oid);
 const readerBefore=await snapshot();
 const result=await scalar("select dv_market_private.evaluate_psttg_removal(array[$1::uuid],jsonb_build_array(jsonb_build_object('kind','record','id',gen_random_uuid(),'version','v1','segments',jsonb_build_array('whole')))) v",[scope]);
 assert.equal(result.core_coverage_complete,false);
 await scalar('select dv_market_private.check_psttg_evaluation_current($1) v',[result.binding]);
 assert.deepEqual(await snapshot(),readerBefore);
 const k5Before=await snapshot();await db.exec(await read('database/psttg-k5-synthetic-control-v1.sql'));assert.deepEqual(await snapshot(),k5Before);
 out.k5_install_preserves_existing=true;
 out.reader_before_after_hashes=readerBefore.rows;
 out.reader_preserves_all_rows_holds_generations_permissions=true;
 out.passed=true;out.tables=tables.length;out.functions=functions.length;
 console.log('PASS existing schema, ACL, FK, trigger and content invariants',tables.length,'tables',functions.length,'functions');
}catch(e){out.failure=e.message;console.error(e.message);process.exitCode=1}
finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/psttg-existing-invariants-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close()}
