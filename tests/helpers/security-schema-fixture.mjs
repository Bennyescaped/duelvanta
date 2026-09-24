// Isolated, data-free fixture. Source: versioned 22 Sep baseline plus reviewed migrations.
// 24 Sep catalog restores policies/ACL for adversarial input, NEVER defines the candidate's desired rights.
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {legalSchemaFixture} from './legal-schema-fixture.mjs';
export const read=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const qi=s=>'"'+s.replaceAll('"','""')+'"';
export async function securitySchemaFixture(db){
 await legalSchemaFixture(db);
 await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create or replace function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table auth.mfa_factors(id uuid primary key,user_id uuid not null,status text not null);
 create table auth.sessions(id uuid primary key,user_id uuid not null,factor_id uuid,aal text,not_after timestamptz);
 revoke all on all tables in schema auth from public,anon,authenticated,service_role;`);
 for(const file of ['database/collect-scanner-v16-weekly-quota.sql','database/collect-scanner-v16-owner-control.sql',
 'database/battle-spectator-foundation-v1.sql','database/battle-spectator-media-v1.sql','database/battle-spectator-media-reconciler-v1.sql',
 'supabase/migrations/20260921144947_collect_empty_binder_delete.sql',
 'supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql']){
  await db.exec((await read(file)).replace(/create function /gi,'create or replace function '));
 }
 const c=JSON.parse(gunzipSync(await readFile(new URL('../../evidence/production-readiness-20260924/staging-catalog.json.gz',import.meta.url))));
 for(const p of c.policies.filter(p=>p.schemaname==='public')){
  await db.exec(`drop policy if exists ${qi(p.policyname)} on public.${qi(p.tablename)};
  create policy ${qi(p.policyname)} on public.${qi(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(qi).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''}`);
 }
 const supplement=JSON.parse(await read('evidence/production-readiness-20260924/staging-supplemental.json'))[0].supplemental;
 for(const v of supplement.views)await db.exec(`create view ${qi(v.schema)}.${qi(v.name)} with (security_invoker=true) as ${v.definition}`);
 // Restore identity defaults absent from the older legal-only fixture (existing sequences).
 for(const x of c.columns.filter(x=>['public','dv_market_private'].includes(x.schema)&&x.identity)){
  await db.exec(`drop sequence ${qi(x.schema)}.${qi(x.table+'_'+x.name+'_seq')}; alter table ${qi(x.schema)}.${qi(x.table)} alter column ${qi(x.name)} add generated ${x.identity==='a'?'always':'by default'} as identity (sequence name ${qi(x.schema)}.${qi(x.table+'_'+x.name+'_seq')})`);
 }
 // Restore sequence grants missing from the older legal-only fixture.
 for(const r of c.relations.filter(r=>r.schema==='public'&&r.kind==='S'))await db.exec(`grant all on sequence public.${qi(r.name)} to anon,authenticated,service_role`);
 // Historical Staging has no anon waitlist column grants; exercise the legitimate Production variant too.
 await db.exec('grant insert(email,consent,source) on public.beta_waitlist to anon;');
}
