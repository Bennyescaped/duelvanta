// Full empty Staging application schema + exact unapplied migration, never a live connection.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {legalSchemaFixture} from './helpers/legal-schema-fixture.mjs';
const native=process.argv.includes('--native');
let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else {const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const migration=await readFile(new URL('../supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',import.meta.url),'utf8');
const report={native,commit:process.env.GITHUB_SHA,migrationSha256:createHash('sha256').update(migration).digest('hex'),cases:[],passed:false};
const probe=async()=>(await db.query('select public.get_market_legal_schema_readiness_v1() v')).rows[0].v;
const expect=async(value,name)=>{const r=await probe();assert.equal(r.compatible,value,name);assert.equal(r.revision,'trade-legal-contract-model-v1.2');report.cases.push({name,compatible:r.compatible,passed:true})};
try{
 await legalSchemaFixture(db);
 await assert.rejects(probe,e=>e.code==='42883');
 await db.exec(migration.slice(migration.indexOf('-- BEGIN GENERATED LEGAL CATALOG READINESS')));
 await expect(false,'baseline without candidate');
 await db.exec(migration);
 // Diagnostic shows only object names when the reviewed catalog differs, no application data.
 const r=await probe();
 if(!r.compatible){
  await db.exec('set search_path=pg_catalog,public');
  const sql=migration.slice(migration.indexOf('with required_tables')).split(' into actual;')[0];
  const actual=(await db.query(sql)).rows[0].jsonb_agg;
  const expected=JSON.parse(migration.split('$catalog$')[1]);
  console.error('Catalog counts/order:',{actual:actual.length,expected:expected.length,ordered:JSON.stringify(actual)===JSON.stringify(expected)});
  console.error('Catalog differences:',expected.filter(e=>!actual.some(a=>JSON.stringify(a)===JSON.stringify(e))).map(e=>e.slice(0,2)));
 }
 await expect(true,'complete exact candidate');
 await db.exec('begin read only;set local role authenticated');await expect(true,'authenticated read-only transaction');await db.exec('rollback');
 await db.exec('set role anon');await assert.rejects(probe,e=>e.code==='42501');await db.exec('reset role');
 const corruptions=[
 ['required nullability','alter table dv_market_private.market_withdrawals alter column evidence_snapshot drop not null'],
 ['missing column','alter table public.market_offers rename column checkout_hash_snapshot to missing_hash'],
 ['missing rpc','alter function public.review_market_price_offer_v1(uuid,integer,numeric) rename to broken_review'],
 ['wrong function body',`create or replace function public.release_fixed_price_market_offer_v1(p_offer_id uuid,p_reason text default 'payment_request_failed') returns boolean language sql security definer as $$select true$$`],
 ['wrong signature','alter function public.prepare_market_withdrawal_v1(uuid,text,text) rename to missing_prepare'],
 ['missing uniqueness','drop index public.market_fixed_offer_request_key_idx'],
 ['disabled immutable contract trigger','alter table dv_market_private.market_contract_snapshots disable trigger user'],
 ['disabled immutable withdrawal trigger','alter table dv_market_private.market_withdrawals disable trigger user'],
 ['disabled reservation guard','alter table public.market_offers disable trigger market_reservation_delete_guard'],
 ['disabled rls','alter table dv_market_private.market_withdrawals disable row level security'],
 ['browser private schema access','grant usage on schema dv_market_private to authenticated'],
 ['browser private table access','grant select on dv_market_private.market_contract_snapshots to authenticated'],
 ['browser column mutation','grant update(reserved_quantity) on public.market_offers to authenticated'],
 ['backend direct mutation','grant delete on public.market_offers to service_role'],
 ['retired rpc exposed','grant execute on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) to authenticated'],
 ['new rpc revoked','revoke execute on function public.confirm_market_withdrawal_v1(uuid) from authenticated'],
 ['missing reservation state constraint','alter table public.market_offers drop constraint market_fixed_reservation_state_check'],
 ['weakened delete policy','drop policy offers_delete_unreserved_only on public.market_offers'],
 ['foreign key missing','alter table dv_market_private.market_withdrawals drop constraint market_withdrawals_contract_snapshot_id_fkey'],
 ['outbox check missing','alter table dv_market_private.marketplace_message_outbox drop constraint marketplace_message_outbox_message_kind_check']
 ];
 for(const [name,sql] of corruptions){await db.exec('begin');try{await db.exec(sql);await expect(false,name)}finally{await db.exec('rollback')}await expect(true,name+' restored')}
 report.passed=true;console.log('PASS: catalog readiness',native?'PostgreSQL17':'PGlite',report.cases.length,'checks; full migration rehearsal and corruption fail-closed');
}catch(e){report.failure={message:e.message,code:e.code};console.error(report.failure);throw e}
finally{await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/trade-legal-schema-readiness.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await db.close()}
