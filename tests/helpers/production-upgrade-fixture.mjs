// Shared data-free historical replay; candidate, never a real apply entrypoint.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
export const PRODUCTION_BOOTSTRAP=`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create schema extensions;create publication supabase_realtime;
 create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),email_confirmed_at timestamptz,encrypted_password text);
 create table auth.sessions(id uuid primary key,user_id uuid not null,factor_id uuid,aal text,not_after timestamptz,created_at timestamptz default clock_timestamp());
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
 set search_path=public,extensions;`;
export async function loadProductionUpgradeSources(){
 const manifest=JSON.parse(await read('database/production-upgrade-manifest-v1.json'));
 const historyBytes=await readFile(new URL('../../'+manifest.baseline.source,import.meta.url));assert.equal(createHash('sha256').update(historyBytes).digest('hex'),manifest.baseline.sha256);
 const history=JSON.parse(gunzipSync(historyBytes));assert.equal(history.length,72);assert.equal(history.at(-1).version,manifest.baseline.last_version);
 return {manifest,history};
}
export async function reconstructProductionBaseline(db,{history},onStart=()=>{}){
 await db.exec(PRODUCTION_BOOTSTRAP);
 for(const h of history){onStart('baseline '+h.version+' '+h.name);await db.exec(h.statements.join('\n'));}
}
export async function productionUpgradeSQL(step){
 let sql;
 if(step.history_version){const bytes=await readFile(new URL('../../'+step.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),step.archive_sha256);const source=JSON.parse(gunzipSync(bytes));sql=source.find(x=>x.version===step.history_version).statements.join('\n');}
 else sql=await read(step.path);
 assert.equal(createHash('sha256').update(sql).digest('hex'),step.sha256);
 if(step.line_ranges)sql=step.line_ranges.map(([a,b])=>sql.split('\n').slice(a-1,b).join('\n')).join('\n');
 if(step.execute_prefix_bytes)sql=Buffer.from(sql).subarray(0,step.execute_prefix_bytes).toString('utf8');
 return sql;
}
export async function applyProductionUpgrade(db,plan,{onStart=()=>{},onApplied=()=>{}}={}){
 for(const step of plan.steps){
  const stage=step.history_name||step.path;onStart(stage);
  const sql=await productionUpgradeSQL(step);
  const at=Date.now();await db.exec(sql);onApplied({id:step.id,source:stage,sha256:step.sha256,duration_ms:Date.now()-at});
 }
}
