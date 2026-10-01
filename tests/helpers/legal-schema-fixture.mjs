// Data-free, reviewed 2026-09-22 Staging catalog. Only disposable local test databases.
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const qi=s=>'"'+s.replaceAll('"','""')+'"';
export async function legalSchemaFixture(db){
 const b=JSON.parse(gunzipSync(await readFile(new URL('../../evidence/legal-step6-preflight-20260922/staging-application-schema.json.gz',import.meta.url))));
 const a=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/legal-readiness/staging-catalog-boundaries.json.gz',import.meta.url))));
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;create schema dv_market_private;
 create table auth.users(id uuid primary key,email text);create extension pgcrypto with schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 set check_function_bodies=off;`);
 for(const s of b.sequences)await db.exec(`create sequence ${qi(s.schema)}.${qi(s.name)}`);
 for(const cols of Map.groupBy(b.columns,c=>c.schema+'.'+c.table).values()){
  const c=cols[0],fields=cols.sort((a,b)=>a.position-b.position).map(c=>`${qi(c.name)} ${c.type}${c.generated?' generated always as ('+c.default+') stored':c.default?' default '+c.default:''}${c.notnull?' not null':''}`);
  await db.exec(`create table ${qi(c.schema)}.${qi(c.table)}(${fields.join(',')})`);
 }
 for(const c of [...b.constraints.filter(c=>c.type!=='f'),...b.constraints.filter(c=>c.type==='f')])await db.exec(`alter table ${c.table} add constraint ${qi(c.name)} ${c.definition}`);
 for(const i of a.indexes)await db.exec(i.indexdef.replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ').replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS '));
 await db.exec(await readFile(new URL('../fixtures/legal-readiness/reviewed-baseline-indexes.sql',import.meta.url),'utf8'));
 for(const f of b.functions)await db.exec(f.definition);
 for(const t of b.triggers.filter(t=>!t.definition.includes('battle_spectator_private.')))await db.exec(t.definition);
 for(const t of a.rls){
  await db.exec(`alter table ${t.table} ${t.rls?'enable':'disable'} row level security`);
  for(const acl of t.acl||[]){const [grantee,rights]=acl.split('=');if(!['anon','authenticated','service_role',''].includes(grantee))continue;
   const map={r:'select',a:'insert',w:'update',d:'delete',D:'truncate',x:'references',t:'trigger'};
   const grants=[...rights.split('/')[0]].map(c=>map[c]).filter(Boolean);
   if(grants.length)await db.exec(`grant ${grants.join(',')} on ${t.table} to ${grantee||'public'}`);
  }
 }
 for(const f of b.functions){
  const sig=f.identity.startsWith(f.schema+'.')?f.identity:`${f.schema}.${f.identity}`;
  await db.exec(`revoke all on function ${sig} from public,anon,authenticated,service_role`);
  if(f.acl===null)await db.exec(`grant execute on function ${sig} to public`);
  for(const acl of f.acl||[]){const [grantee,rights]=acl.split('=');if(['anon','authenticated','service_role',''].includes(grantee)&&rights.includes('X'))await db.exec(`grant execute on function ${sig} to ${grantee||'public'}`)}
 }
 await db.exec(`grant usage on schema public,auth to anon,authenticated,service_role;
 create policy offers_read_participants on public.market_offers for select to authenticated using (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
 create policy offers_delete_buyer on public.market_offers for delete to authenticated using (buyer_id=(select auth.uid()) and status='pending');
 set check_function_bodies=on;`);
 await db.exec(await readFile(new URL('../fixtures/legal-readiness/reviewed-default-privileges.sql',import.meta.url),'utf8'));
}
