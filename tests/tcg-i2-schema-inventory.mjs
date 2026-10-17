// Complete data-free effective catalog, offline only. PGlite is NOT PG17 evidence.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {baseline,install} from './helpers/tcg-i2-fixture.mjs';
const db=new PGlite({extensions:{pgcrypto}}),schemas="'public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private'";
const sources=['tests/helpers/legal-schema-fixture.mjs','tests/helpers/security-schema-fixture.mjs','tests/helpers/publication-hold-fixture.mjs','tests/helpers/tcg-i2-fixture.mjs','tests/generate-security-readiness.mjs','tests/helpers/legal-readiness-catalog.mjs','database/production-upgrade-manifest-v1.json'];
async function inventory(){const result={};for(const [key,sql] of Object.entries({
 functions:`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in (${schemas}) order by 1,2,3`,
 tables:`select n.nspname schema,c.relname name,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity force,c.relowner::regrole::text owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in (${schemas}) order by 1,2`,
 constraints:`select conrelid::regclass::text table_name,confrelid::regclass::text target,conname name,contype type,pg_get_constraintdef(oid) definition from pg_constraint where connamespace::regnamespace::text in (${schemas}) and contype<>'n' order by 1,3`,
 columns:`select table_schema,table_name,column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema in (${schemas}) order by 1,2,ordinal_position`,
 policies:`select * from pg_policies where schemaname in (${schemas}) order by schemaname,tablename,policyname`,
 triggers:`select tgrelid::regclass::text table_name,tgname name,tgenabled enabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal order by 1,2`
 })){result[key]=(await db.query(sql)).rows;}return result;}
try{await baseline(db);const before=await inventory();await install(db);const after=await inventory();
 const C=createRequire(import.meta.url)('../tcg-v1-contracts.js');assert.deepEqual((await db.query('select language_code,locale from dv_collect_private.tcg_languages order by language_code')).rows,C.languages.filter(x=>C.locales[x]!==null).sort().map(language_code=>({language_code,locale:C.locales[language_code]})));
 const ddl=await readFile(new URL('../database/tcg-i2-canonical-integration-v1.sql',import.meta.url),'utf8');assert.doesNotMatch(ddl,/grant all|drop (?:table|constraint)|alter table public\.[^\n]*(?:drop|add column)/i);assert.doesNotMatch(ddl,/insert into[^;]*\b(?:magic|yugioh|naruto)\b/i);
 const oldFunctions=new Map(before.functions.map(f=>[f.schema+'.'+f.name+'('+f.arguments+')',f]));for(const f of after.functions){const key=f.schema+'.'+f.name+'('+f.arguments+')',old=oldFunctions.get(key);if(!old||['public.export_my_duelvanta_data()','public.prepare_account_deletion_data(p_request_id uuid, p_lock_token uuid)','public.get_security_schema_readiness_v1()','public.get_market_legal_schema_readiness_v1()'].includes(key))continue;assert.deepEqual(f,old,key+' changed outside I2 delta');}
 const sourceInventory=[];for(const path of sources){const bytes=await readFile(new URL('../'+path,import.meta.url));sourceInventory.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
 await mkdir('test-results',{recursive:true});await writeFile('test-results/tcg-i2-effective-schema.json',JSON.stringify({engine:'PGlite-PG18 preparation NOT native PG17',node:process.version,before,after,sourceInventory,static_checks:'PASS'},null,2));console.log('PASS full effective schema/ACL/RLS/FK/function inventory; static scope checks; untouched protected function bodies',before.functions.length,after.functions.length);
}finally{await db.close();}
