// Real PostgreSQL 17 proof for Legal Step 5 withdrawal evidence; isolated CI database only.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDatabase} from './helpers/f3-native-db.mjs';

const migrationPath='supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql';
const migration=await readFile(new URL('../'+migrationPath,import.meta.url),'utf8');
const start=migration.indexOf('-- Electronic withdrawal declaration:');
const end=migration.indexOf('-- Keep withdrawal evidence in the existing own-data export',start);
assert.ok(start>=0&&end>start,'withdrawal SQL section missing');
const withdrawalSql=migration.slice(start,end);
const report={commit:process.env.F3_HEAD_SHA||process.env.GITHUB_SHA,migrationPath,migrationSha256:createHash('sha256').update(migration).digest('hex'),cases:[],passed:false};

const SELLER='84000000-0000-4000-8000-000000000001';
const BUYER='84000000-0000-4000-8000-000000000002';
const OTHER='84000000-0000-4000-8000-000000000003';
const ORDER='85000000-0000-4000-8000-000000000001';
const DEAL='86000000-0000-4000-8000-000000000001';
const SNAP='87000000-0000-4000-8000-000000000001';
const SNAP_C2C='87000000-0000-4000-8000-000000000002';
const SNAP_INELIGIBLE='87000000-0000-4000-8000-000000000003';
const SNAP_NO_RECIPIENT='87000000-0000-4000-8000-000000000004';

const db=await createDatabase();
const parse=value=>typeof value==='string'?JSON.parse(value):value;
async function role(client,kind,uid){
  await client.query('reset role');
  await client.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
  await client.query('set role '+kind);
}
async function rpc(client,sql,params){
  const row=(await client.query(sql,params)).rows[0];
  return parse(row.value);
}

try{
  await db.exec([
    'create role anon;create role authenticated;create role service_role;',
    'create schema auth;create schema extensions;create schema dv_market_private;',
    'create extension if not exists pgcrypto with schema extensions;',
    "create table auth.users(id uuid primary key,email text);",
    "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    'grant usage on schema public,auth to anon,authenticated,service_role;',
    'grant execute on function auth.uid() to anon,authenticated,service_role;',
    "create table public.market_orders(id uuid primary key,status text,payment_status text,paid_amount numeric);",
    "create table public.market_deals(id uuid primary key);",
    "create table dv_market_private.market_contract_snapshots(id uuid primary key,order_id uuid not null,deal_id uuid not null,seller_id uuid not null,buyer_id uuid not null,seller_type text,buyer_type text,contract_classification text,seller_party jsonb not null,product_snapshot jsonb not null,contract_formed_at timestamptz not null,total_price numeric not null,currency text not null,withdrawal_eligible boolean not null);",
    "create table dv_market_private.marketplace_message_outbox(id uuid primary key default gen_random_uuid(),contract_snapshot_id uuid,recipient_kind text,recipient_user_id uuid,recipient_email text,message_kind text,payload jsonb,dedupe_key text not null unique);"
  ].join('\n'));
  await db.exec(withdrawalSql);

  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[SELLER,'seller-snapshot@example.test',BUYER,'buyer@example.test',OTHER,'other@example.test']);
  await db.query("insert into public.market_orders(id,status,payment_status,paid_amount) values($1,'completed','paid',123.45)",[ORDER]);
  await db.query('insert into public.market_deals(id) values($1)',[DEAL]);
  const traderParty={seller_type:'trader',business_name:'Frozen Händler GmbH',legal_name:'Frozen Händler',public_email:'seller-snapshot@example.test'};
  const privateParty={seller_type:'private',legal_name:'Privater Verkäufer'};
  const product={title:'Frozen Testkarte'};
  const insertSnapshot='insert into dv_market_private.market_contract_snapshots(id,order_id,deal_id,seller_id,buyer_id,seller_type,buyer_type,contract_classification,seller_party,product_snapshot,contract_formed_at,total_price,currency,withdrawal_eligible) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)';
  await db.query(insertSnapshot,[SNAP,ORDER,DEAL,SELLER,BUYER,'trader','consumer','b2c',traderParty,product,'2026-09-22T17:00:00Z',123.45,'EUR',true]);
  await db.query(insertSnapshot,[SNAP_C2C,ORDER,DEAL,SELLER,BUYER,'private','consumer','c2c',privateParty,product,'2026-09-22T17:00:00Z',50,'EUR',false]);
  await db.query(insertSnapshot,[SNAP_INELIGIBLE,ORDER,DEAL,SELLER,BUYER,'trader','consumer','b2c',traderParty,product,'2026-09-22T17:00:00Z',60,'EUR',false]);
  await db.query(insertSnapshot,[SNAP_NO_RECIPIENT,ORDER,DEAL,SELLER,BUYER,'trader','consumer','b2c',{seller_type:'trader',business_name:'Ohne Mail'},product,'2026-09-22T17:00:00Z',70,'EUR',true]);

  await role(db.client,'authenticated',BUYER);
  const list=await rpc(db.client,'select public.get_my_market_withdrawable_contracts() value',[]);
  assert.deepEqual(list.map(item=>item.contract_snapshot_id),[SNAP]);
  await assert.rejects(()=>db.client.query('select public.prepare_market_withdrawal_v1($1,$2,$3)',[SNAP_C2C,'Buyer Test','buyer@example.test']),/withdrawal_contract_not_eligible/);
  await assert.rejects(()=>db.client.query('select public.prepare_market_withdrawal_v1($1,$2,$3)',[SNAP_INELIGIBLE,'Buyer Test','buyer@example.test']),/withdrawal_contract_not_eligible/);
  await assert.rejects(()=>db.client.query('select public.prepare_market_withdrawal_v1($1,$2,$3)',[SNAP_NO_RECIPIENT,'Buyer Test','buyer@example.test']),/withdrawal_contract_not_eligible/);
  report.cases.push('B2C-only eligibility and frozen-recipient requirement');

  await role(db.client,'authenticated',OTHER);
  const foreign=await rpc(db.client,'select public.get_my_market_withdrawable_contracts() value',[]);
  assert.equal(foreign.length,0);
  await assert.rejects(()=>db.client.query('select public.prepare_market_withdrawal_v1($1,$2,$3)',[SNAP,'Other','other@example.test']),/withdrawal_contract_not_eligible/);
  report.cases.push('foreign buyer cannot access or prepare withdrawal');

  await role(db.client,'authenticated',BUYER);
  const prepared=await rpc(db.client,'select public.prepare_market_withdrawal_v1($1,$2,$3) value',[SNAP,'Buyer Test','buyer@example.test']);
  const preparedAgain=await rpc(db.client,'select public.prepare_market_withdrawal_v1($1,$2,$3) value',[SNAP,'Buyer Test','buyer@example.test']);
  assert.equal(prepared.draft_id,preparedAgain.draft_id);
  assert.equal(prepared.seller_name,'Frozen Händler GmbH');
  assert.equal(prepared.product_title,'Frozen Testkarte');
  assert.equal(prepared.order_id,ORDER);
  assert.equal(Number(prepared.total_price),123.45);
  await assert.rejects(()=>db.client.query('select * from dv_market_private.market_withdrawal_drafts'),/permission denied/);
  await assert.rejects(()=>db.client.query('select * from dv_market_private.market_withdrawals'),/permission denied/);
  report.cases.push('single active draft and no browser-table access');

  const c1=await db.connect(),c2=await db.connect();
  await role(c1,'authenticated',BUYER);await role(c2,'authenticated',BUYER);
  const q='select public.confirm_market_withdrawal_v1($1) value';
  const [r1,r2]=await Promise.all([rpc(c1,q,[prepared.draft_id]),rpc(c2,q,[prepared.draft_id])]);
  assert.equal(r1.withdrawal_id,r2.withdrawal_id);
  assert.deepEqual([r1.replayed,r2.replayed].sort(),[false,true]);
  assert.equal(r1.receipt_sha256,r2.receipt_sha256);
  report.cases.push('parallel multi-click replays one immutable declaration');

  await db.exec('reset role;');
  const withdrawal=(await db.query("select *,encode(content_sha256,'hex') hash,encode(extensions.digest(convert_to(evidence_snapshot::text,'UTF8'),'sha256'),'hex') expected_hash from dv_market_private.market_withdrawals where contract_snapshot_id=$1",[SNAP])).rows[0];
  assert.equal(withdrawal.contract_domain,'marketplace_b2c');
  assert.equal(withdrawal.hash,withdrawal.expected_hash);
  assert.equal(withdrawal.evidence_snapshot.seller_recipient_email,'seller-snapshot@example.test');
  assert.equal(Number((await db.query('select count(*) count from dv_market_private.market_withdrawals where contract_snapshot_id=$1',[SNAP])).rows[0].count),1);
  const messages=(await db.query('select recipient_kind,recipient_email,message_kind,dedupe_key,payload from dv_market_private.marketplace_message_outbox where contract_snapshot_id=$1 order by message_kind',[SNAP])).rows;
  assert.equal(messages.length,2);
  assert.deepEqual(messages.map(row=>row.message_kind).sort(),['withdrawal_notice','withdrawal_receipt']);
  assert.equal(messages.find(row=>row.message_kind==='withdrawal_notice').recipient_email,'seller-snapshot@example.test');
  assert.equal(messages.find(row=>row.message_kind==='withdrawal_receipt').recipient_email,'buyer@example.test');
  assert.ok(messages.every(row=>row.payload.evidence_sha256===withdrawal.hash));
  assert.ok(messages.some(row=>row.dedupe_key==='withdrawal_notice:'+SNAP));
  assert.ok(messages.some(row=>row.dedupe_key==='withdrawal_receipt:'+SNAP));
  const order=(await db.query('select status,payment_status,paid_amount from public.market_orders where id=$1',[ORDER])).rows[0];
  assert.deepEqual({status:order.status,payment_status:order.payment_status,paid_amount:Number(order.paid_amount)},{status:'completed',payment_status:'paid',paid_amount:123.45});
  report.cases.push('snapshot recipient, hash and deduplicated outbox; order/payment untouched');

  await role(db.client,'authenticated',BUYER);
  await assert.rejects(()=>db.client.query('select public.prepare_market_withdrawal_v1($1,$2,$3)',[SNAP,'Buyer Test','buyer@example.test']),/withdrawal_already_submitted/);
  await db.exec('reset role;');
  await assert.rejects(()=>db.query("insert into dv_market_private.market_withdrawals(draft_id,contract_snapshot_id,order_id,deal_id,buyer_id,seller_id,contract_domain,consumer_name,confirmation_email,declaration_text,submitted_at,evidence_snapshot,content_sha256) select gen_random_uuid(),contract_snapshot_id,order_id,deal_id,buyer_id,seller_id,contract_domain,consumer_name,confirmation_email,declaration_text,submitted_at,evidence_snapshot,content_sha256 from dv_market_private.market_withdrawals where contract_snapshot_id=$1",[SNAP]),/duplicate key|market_withdrawals_contract_snapshot_uq/);
  await assert.rejects(()=>db.query("update dv_market_private.market_withdrawals set consumer_name='Changed' where contract_snapshot_id=$1",[SNAP]),/market_withdrawal_is_immutable/);
  await assert.rejects(()=>db.query('delete from dv_market_private.market_withdrawals where contract_snapshot_id=$1',[SNAP]),/market_withdrawal_is_immutable/);
  report.cases.push('database uniqueness and immutable evidence backstop');

  report.passed=true;
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await writeFile(new URL('../test-results/trade-withdrawal-postgres.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log('PASS: withdrawal is B2C-snapshot-bound, replay-safe, immutable, deduplicated and separated from order/payment mutation');
}finally{
  await db.close();
}
