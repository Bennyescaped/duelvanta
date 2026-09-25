import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {baselineChecks,snapshotOriginal,unchangedOriginal,foreignKeys,beforeUpgradeAbort,finalChecks,assertReviewedActionsSource} from './helpers/production-upgrade-checks.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const native=process.argv.includes('--native');
let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase();}
else{const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}});}
const report={source_head:process.env.P001_HEAD_SHA||'local candidate',runner_sha:process.env.GITHUB_SHA||null,started_at:new Date().toISOString(),engine:native?'native-postgresql17':'pglite-pg18',scenario:process.argv.includes('--empty')?'empty':'synthetic-existing',status:'RUNNING',steps:[]};
const manifest=JSON.parse(await read('database/production-upgrade-manifest-v1.json'));
const historyBytes=await readFile(new URL('../'+manifest.baseline.source,import.meta.url));assert.equal(createHash('sha256').update(historyBytes).digest('hex'),manifest.baseline.sha256);
const history=JSON.parse(gunzipSync(historyBytes));assert.equal(history.length,72);assert.equal(history.at(-1).version,manifest.baseline.last_version);
let stage='bootstrap';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create schema extensions;create publication supabase_realtime;
 create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),email_confirmed_at timestamptz,encrypted_password text);
 create table auth.sessions(id uuid primary key,user_id uuid not null,factor_id uuid,aal text,not_after timestamptz);
 create table auth.mfa_factors(id uuid primary key,user_id uuid not null,status text not null);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(auth.jwt()->>'sub',''),nullif(current_setting('request.jwt.claim.sub',true),''))::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to postgres,anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to postgres,anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to postgres,anon,authenticated,service_role;
 set search_path=public,extensions;`);
 for(const h of history){stage='baseline '+h.version+' '+h.name; await db.exec(h.statements.join('\n'));}
 console.log('BASELINE SQL PASS',history.length);
 const catResults=await db.exec(await read('tests/fixtures/production-upgrade/catalog-readonly.sql'));
 const localCatalog=Array.isArray(catResults)?catResults.find(x=>x.rows?.[0]?.catalog)?.rows[0].catalog:catResults.rows[0].catalog;
 await mkdir('test-results',{recursive:true});await writeFile('test-results/production-baseline-catalog.json',JSON.stringify(localCatalog,null,2));
 const counts=(await db.query(`select n.nspname,count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_v16_private') and c.relkind='r' group by 1`)).rows;console.log(counts);
 const fs=(await db.query(`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) definition_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_v16_private') order by 1,2,3`)).rows;
 await mkdir('test-results',{recursive:true});await writeFile('test-results/production-baseline-functions.json',JSON.stringify(fs,null,2));
 report.baseline=await baselineChecks(db,localCatalog,fs,native);
 if(!process.argv.includes('--baseline-only')){
 stage='synthetic legacy fixture';if(!process.argv.includes('--empty'))await db.exec(await read('tests/fixtures/production-upgrade/synthetic-existing-data.sql'));
 report.before_fks=await foreignKeys(db);const before=await snapshotOriginal(db,localCatalog);
 report.abort=await beforeUpgradeAbort(db,before);await assertReviewedActionsSource();
 const plan=JSON.parse(await read('database/production-upgrade-manifest-v1.json'));
 for(const step of plan.steps){
  stage=step.history_name||step.path;
  let sql;
  if(step.history_version){const bytes=await readFile(new URL('../'+step.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),step.archive_sha256);const source=JSON.parse(gunzipSync(bytes));sql=source.find(x=>x.version===step.history_version).statements.join('\n');}
  else sql=await read(step.path);
  assert.equal(createHash('sha256').update(sql).digest('hex'),step.sha256);
  if(step.line_ranges)sql=step.line_ranges.map(([a,b])=>sql.split('\n').slice(a-1,b).join('\n')).join('\n');
  if(step.execute_prefix_bytes)sql=Buffer.from(sql).subarray(0,step.execute_prefix_bytes).toString('utf8');
  const at=Date.now();await db.exec(sql);report.steps.push({id:step.id,source:stage,sha256:step.sha256,duration_ms:Date.now()-at});console.log('APPLIED',step.id,stage);
 }
 await db.exec('set search_path=pg_catalog,public');
 const readiness=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];
 report.readiness=readiness;report.integrity=await finalChecks(db,before,process.argv.includes('--empty'));
 console.log('READINESS',readiness);
 await writeFile('test-results/production-upgrade-functions.json',JSON.stringify((await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosrc,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private')")).rows,null,2));
 const actual=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const expected=JSON.parse((await read('database/security-readiness-v1.sql')).match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]);
 const map=a=>new Map(a.map(([kind,name,hash])=>[kind+':'+name,hash]));const am=map(actual),em=map(expected);
 const diff=[...new Set([...am.keys(),...em.keys()])].filter(k=>am.get(k)!==em.get(k)).map(key=>({key,actual:am.get(key),expected:em.get(key)}));
 await writeFile('test-results/production-upgrade-readiness-diff.json',JSON.stringify(diff,null,2));
 console.log('READINESS DIFF',diff.length,diff.map(x=>x.key));
 assert.equal(readiness.security.compatible,true,'Security readiness must pass unchanged');assert.equal(readiness.legal.compatible,true,'Legal readiness must pass unchanged');
 if(process.argv.includes('--trade-lock')){stage='P0-05 lock';const {testProductionTradeLock}=await import('./helpers/production-trade-lock-checks.mjs');report.trade_lock=await testProductionTradeLock(db);}
 report.status='PASS';console.log(process.argv.includes('--trade-lock')?'P0-05 REHEARSAL COMPLETE':'P0-01 REHEARSAL COMPLETE');
 }
} catch(e){report.status='FAIL';report.failed_stage=stage;report.error=e.message;console.error('FAILED',stage,e.message,e.detail||'',e.where||'',e.hint||'',e.position||'');process.exitCode=1;}
finally{await db.close();report.cleanup='isolated database closed/deleted';report.finished_at=new Date().toISOString();await mkdir('test-results',{recursive:true});await writeFile('test-results/'+(process.argv.includes('--trade-lock')?'production-trade-lock-':'production-upgrade-')+report.scenario+'-'+(native?'native':'wasm')+'.json',JSON.stringify(report,null,2));}
