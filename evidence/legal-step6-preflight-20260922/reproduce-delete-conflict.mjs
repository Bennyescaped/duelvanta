// Diagnostic reproduction of an UNFIXED migration blocker; not a passing release regression.
const {PGlite}=await import(process.argv[2]);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',process.argv[2]).href);
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const b=JSON.parse(gunzipSync(fs.readFileSync(new URL('staging-application-schema.json.gz',import.meta.url)))),db=new PGlite({extensions:{pgcrypto}});
const qi=s=>'"'+s.replaceAll('"','""')+'"';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;create schema dv_market_private;create table auth.users(id uuid primary key,email text);create extension pgcrypto with schema extensions;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set check_function_bodies=off;`);
for(const s of b.sequences)await db.exec(`create sequence ${qi(s.schema)}.${qi(s.name)}`);
const tables=Map.groupBy(b.columns,c=>c.schema+'.'+c.table);
for(const cols of tables.values()){
 const c=cols[0],fields=cols.sort((a,b)=>a.position-b.position).map(c=>`${qi(c.name)} ${c.type}${c.generated?' generated always as ('+c.default+') stored':c.default?' default '+c.default:''}${c.notnull?' not null':''}`);
 await db.exec(`create table ${qi(c.schema)}.${qi(c.table)}(${fields.join(',')})`);
}
for(const c of b.constraints.filter(c=>c.type!=='f'))await db.exec(`alter table ${c.table} add constraint ${qi(c.name)} ${c.definition}`);
for(const c of b.constraints.filter(c=>c.type==='f'))await db.exec(`alter table ${c.table} add constraint ${qi(c.name)} ${c.definition}`);
for(const f of b.functions)await db.exec(f.definition);
for(const t of b.triggers.filter(t=>!t.definition.includes('battle_spectator_private.')))await db.exec(t.definition);
await db.exec('set check_function_bodies=on');
console.log('BASELINE REPLAY PASS: empty application tables, constraints, functions, triggers; auth scaffold only. No live data.');
const migration=fs.readFileSync(new URL('../../supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',import.meta.url),'utf8');
try{await db.exec(migration);console.log('FULL MIGRATION EMPTY SCHEMA REHEARSAL PASS')}catch(e){console.log('MIGRATION FAIL',e.message,e.code,e.position);process.exitCode=1}

await db.exec(`
grant usage on schema auth,public to authenticated;
grant select,insert,delete on public.market_offers to authenticated;
alter table public.market_offers enable row level security;
create policy offers_read_participants on public.market_offers for select to authenticated using ((buyer_id=(select auth.uid())) or (seller_id=(select auth.uid())));
create policy offers_delete_buyer on public.market_offers for delete to authenticated using ((buyer_id=(select auth.uid())) and status='pending');
insert into auth.users(id,email) values ('91000000-0000-4000-8000-000000000001','seller@example.test'),('91000000-0000-4000-8000-000000000002','buyer@example.test');
insert into public.market_listings(id,seller_id,tcg,card_name,pricing_mode,stock_quantity,quantity_available,status,shipping_method,shipping_cost)
values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','pokemon','Synthetic reserved item','fixed',1,0,'reserved','parcel',2);
insert into public.market_offers(id,listing_id,buyer_id,seller_id,offer_type,status,amount,requested_quantity,reserved_quantity,reservation_expires_at,checkout_request_id)
values ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','fixed_price','pending',1,1,1,now()+interval '15 minutes','94000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',false);
set role authenticated;
`);
const removed=await db.query("delete from public.market_offers where id='93000000-0000-4000-8000-000000000001' returning id");
await db.exec('reset role');
const after=await db.query("select quantity_available,stock_quantity,status from public.market_listings where id='92000000-0000-4000-8000-000000000001'");
const cleanup=await db.query('select public.expire_market_offer_reservations_v1() expired');
const result={deletedRows:removed.rows.length,listing:after.rows[0],cleanup:cleanup.rows[0],scope:'Local PGlite reconstructed staging application DDL plus exact candidate. Actual DELETE policy and DELETE trigger; synthetic reservation only. No Staging writes.'};
fs.writeFileSync(new URL('delete-conflict-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(removed.rows.length!==1 || after.rows[0].quantity_available!==0 || cleanup.rows[0].expired!==0)throw Error('Expected conflict not reproduced');
console.log('CONFIRMED BLOCKER: authenticated buyer can delete a pending fixed-price reservation; stock remains reserved and expiration cannot recover it.');
await db.close();
