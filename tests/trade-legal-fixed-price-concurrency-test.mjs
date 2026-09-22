// Real PostgreSQL 17 concurrency proof for Legal Step 4; isolated CI database only.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDatabase} from './helpers/f3-native-db.mjs';

const migrationPath='supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql';
const migration=await readFile(new URL('../'+migrationPath,import.meta.url),'utf8');
const fn=name=>{const a=migration.indexOf('create or replace function '+name+'('),b=migration.indexOf('\n$$;',a);assert.ok(a>=0&&b>a,name);return migration.slice(a,b+4)};
const report={commit:process.env.F3_HEAD_SHA||process.env.GITHUB_SHA,migrationPath,migrationSha256:createHash('sha256').update(migration).digest('hex'),cases:[],passed:false};

const db=await createDatabase(),observer=db.client;
const SELLER='81000000-0000-4000-8000-000000000001';
const BUYER1='81000000-0000-4000-8000-000000000002';
const BUYER2='81000000-0000-4000-8000-000000000003';
const LIST_SAME='82000000-0000-4000-8000-000000000001';
const LIST_RACE='82000000-0000-4000-8000-000000000002';
const LIST_ACCEPT='82000000-0000-4000-8000-000000000003';
const REQ_SAME='83000000-0000-4000-8000-000000000001';
const REQ_RACE1='83000000-0000-4000-8000-000000000002';
const REQ_RACE2='83000000-0000-4000-8000-000000000003';
const REQ_ACCEPT='83000000-0000-4000-8000-000000000004';

let c1,c2,c3,c4,c5,c6;
const launch=fn=>{const task={settled:false};task.promise=fn().then(value=>{task.settled=true;return{ok:true,value}},error=>{task.settled=true;return{ok:false,error,code:error.code,message:error.message}});return task};
async function blocked(waiter,holder,task,label){
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){
    const row=(await observer.query(`select pid,wait_event_type,pg_blocking_pids(pid) blockers,
      exists(select 1 from pg_locks l where l.pid=a.pid and not granted) waiting_lock
      from pg_stat_activity a where pid=$1`,[waiter])).rows[0];
    if(row?.blockers.includes(holder)&&row.wait_event_type==='Lock'&&row.waiting_lock)return {...row,label};
    assert.equal(task.settled,false,label+' completed without observed interconnection block');
    await new Promise(r=>setTimeout(r,25));
  }
  assert.fail(label+' blocking edge not observed');
}
async function role(client,kind,uid=null){
  await client.query('reset role');
  await client.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
  await client.query('set role '+kind);
}
const review=async(client,listing,qty)=>{const v=(await client.query('select public.review_market_checkout($1,$2) v',[listing,qty])).rows[0].v;return typeof v==='string'?JSON.parse(v):v};
const prepare=(client,listing,qty,request,r)=>client.query('select public.prepare_fixed_price_market_offer_v1($1,$2,$3,$4,$5,false) v',[listing,qty,request,r.listing_updated_at,r.checkout_hash]);
const accept=(client,offer,attempt,session,at)=>client.query('select public.accept_fixed_price_market_offer_v1($1,$2,$3,$4,false) v',[offer,attempt,session,at]);

try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create schema dv_market_private;
    create extension if not exists pgcrypto with schema extensions;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;

    create table public.market_listings(
      id uuid primary key,seller_id uuid not null,status text not null default 'active',listing_type text not null default 'sale',
      pricing_mode text not null default 'fixed',product_kind text not null default 'sealed',sealed_category text,
      minimum_purchase_quantity integer not null default 1,quantity_available integer not null,stock_quantity integer not null,
      active_until timestamptz,asking_price numeric not null,quantity_pricing jsonb not null default '[]'::jsonb,
      shipping_method text not null,shipping_cost numeric not null,shipping_note text,tcg text default 'pokemon',
      card_name text,set_name text,card_number text,language text,variant text,condition text,grading_company text,grade text,
      sealed_condition text,package_contents text,units_per_container integer,seller_note text,weight_grams integer,
      length_mm integer,width_mm integer,height_mm integer,accepted_offer_id uuid,deal_price numeric,deal_buyer_id uuid,
      updated_at timestamptz not null default now()
    );
    create table public.market_offers(
      id uuid primary key default gen_random_uuid(),listing_id uuid,buyer_id uuid,seller_id uuid,offer_type text,
      amount numeric,currency text,status text default 'pending',requested_quantity integer,unit_price_snapshot numeric,
      listed_unit_price_snapshot numeric,listed_total_snapshot numeric,listing_snapshot jsonb,contract_review_snapshot jsonb,
      reserved_quantity integer,reservation_expires_at timestamptz,buyer_type_snapshot text,checkout_request_id uuid,
      checkout_hash_snapshot text,payment_attempt_id uuid,payment_requested_at timestamptz,stripe_checkout_session_id text,
      stripe_account_id_snapshot text,payment_live_mode_snapshot boolean,amount_due_cents_snapshot integer,
      platform_fee_cents_snapshot integer,message text,responded_at timestamptz,updated_at timestamptz default now(),
      unique(buyer_id,checkout_request_id),unique(payment_attempt_id),unique(stripe_checkout_session_id)
    );
    create table public.market_orders(
      id uuid primary key default gen_random_uuid(),payment_provider text default 'manual_beta',
      payment_status text default 'not_required',paid_amount numeric default 0,updated_at timestamptz default now()
    );
    create table public.market_deals(
      id uuid primary key default gen_random_uuid(),listing_id uuid,offer_id uuid unique,order_id uuid,
      seller_id uuid,buyer_id uuid,amount numeric,currency text,status text,accepted_at timestamptz,
      shipping_method text,shipping_cost numeric,shipping_note text,product_kind text,sealed_category text,item_quantity integer,
      package_contents text,weight_grams integer,length_mm integer,width_mm integer,height_mm integer,checkout_request_id uuid,
      payment_provider text default 'manual_beta',payment_status text default 'not_required'
    );

    create table dv_market_private.market_payment_configuration(
      singleton boolean primary key default true,sandbox_enabled boolean not null,live_mode boolean not null,
      platform_fee_bps integer not null,platform_fee_fixed_cents integer not null
    );
    create table dv_market_private.market_stripe_accounts(
      seller_id uuid primary key,stripe_account_id text not null,live_mode boolean not null,
      onboarding_status text not null,charges_enabled boolean not null
    );
    create table dv_market_private.market_contract_snapshots(
      id uuid primary key default gen_random_uuid(),deal_id uuid unique,total_price numeric not null,
      seller_party jsonb not null,product_snapshot jsonb not null,contract_classification text not null,content_sha256 bytea not null
    );
    create table dv_market_private.market_payment_attempts(
      id uuid primary key,order_id uuid not null,buyer_id uuid not null,seller_id uuid not null,stripe_account_id text not null,
      idempotency_key uuid not null,state text not null,currency text not null,amount_due_cents integer not null,
      platform_fee_cents integer not null,stripe_checkout_session_id text unique,prepared_at timestamptz,updated_at timestamptz
    );
    create table dv_market_private.market_payment_allocations(
      attempt_id uuid not null,contract_snapshot_id uuid not null,gross_cents integer not null,platform_fee_cents integer not null,
      primary key(attempt_id,contract_snapshot_id)
    );

    create function dv_market_private.require_market_buyer_type(uuid) returns text language sql stable security definer as $$select 'consumer'::text$$;
    create function dv_market_private.market_contract_classification(text,text) returns text language sql immutable as $$select case when $1='trader' and $2='consumer' then 'b2c' else null end$$;
    create function dv_market_private.market_checkout_seller_party(p uuid) returns jsonb language sql stable security definer as $$
      select jsonb_build_object('seller_id',p,'seller_type','trader','role_label','Gewerblicher Verkäufer','legal_name','Concurrency Seller',
        'business_name','Concurrency Shop','street_line1','Testweg 1','postal_code','75100','city','Teststadt','country_code','DE','public_email','seller@example.test')
    $$;
    create function dv_market_private.market_checkout_product_snapshot(p public.market_listings) returns jsonb language sql stable security definer as $$
      select jsonb_strip_nulls(jsonb_build_object('listing_id',p.id,'product_kind',p.product_kind,'title',p.card_name,'set_name',p.set_name,
        'language',p.language,'sealed_category',p.sealed_category,'package_contents',p.package_contents,'listing_updated_at',p.updated_at))
    $$;
    create function public.expire_market_offer_reservations_v1() returns integer language sql security definer as $$select 0$$;

    create function public.fixture_fixed_contract() returns trigger language plpgsql security definer set search_path=pg_catalog,public,dv_market_private,extensions as $$
    declare o public.market_offers;r jsonb;ord uuid:=gen_random_uuid();snap uuid;
    begin
      select * into o from public.market_offers where id=new.offer_id;r:=o.contract_review_snapshot;
      insert into public.market_orders(id) values(ord);
      update public.market_deals set order_id=ord where id=new.id;
      insert into dv_market_private.market_contract_snapshots(deal_id,total_price,seller_party,product_snapshot,contract_classification,content_sha256)
      values(new.id,(r->>'total_price')::numeric,r->'seller_party',r->'product',r->>'contract_classification',extensions.digest(convert_to(r::text,'UTF8'),'sha256'))
      returning id into snap;
      return new;
    end $$;
    create trigger fixture_fixed_contract after insert on public.market_deals for each row execute function public.fixture_fixed_contract();

    insert into dv_market_private.market_payment_configuration(singleton,sandbox_enabled,live_mode,platform_fee_bps,platform_fee_fixed_cents)
      values(true,true,false,250,30);
    insert into dv_market_private.market_stripe_accounts(seller_id,stripe_account_id,live_mode,onboarding_status,charges_enabled)
      values('81000000-0000-4000-8000-000000000001','acct_ConcurrencySeller',false,'ready',true);
    insert into public.market_listings(id,seller_id,quantity_available,stock_quantity,asking_price,shipping_method,shipping_cost,shipping_note,card_name,set_name,language,sealed_category,package_contents,weight_grams)
      values
      ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',2,2,100,'parcel',5,'Tracked','Same request','Set','DE','display','24 Booster',600),
      ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001',1,1,100,'parcel',5,'Tracked','Inventory race','Set','DE','display','24 Booster',600),
      ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001',1,1,100,'parcel',5,'Tracked','Acceptance race','Set','DE','display','24 Booster',600);
  `);

  await db.exec(fn('public.review_market_checkout'));
  await db.exec(fn('public.prepare_fixed_price_market_offer_v1'));
  await db.exec(fn('public.accept_fixed_price_market_offer_v1'));
  await db.exec(`
    grant execute on function public.review_market_checkout(uuid,integer) to authenticated;
    grant execute on function public.prepare_fixed_price_market_offer_v1(uuid,integer,uuid,timestamptz,text,boolean) to authenticated;
    grant execute on function public.accept_fixed_price_market_offer_v1(uuid,uuid,text,timestamptz,boolean) to service_role;
  `);

  c1=await db.connect();c2=await db.connect();c3=await db.connect();c4=await db.connect();c5=await db.connect();c6=await db.connect();
  const pids={observer:(await observer.query('select pg_backend_pid() pid')).rows[0].pid};
  for(const [name,c] of Object.entries({c1,c2,c3,c4,c5,c6}))pids[name]=(await c.query('select pg_backend_pid() pid')).rows[0].pid;
  assert.equal(new Set(Object.values(pids)).size,7);report.connections=pids;
  report.postgresql=(await observer.query("select version() version,current_setting('transaction_isolation') isolation")).rows[0];

  await role(c1,'authenticated',BUYER1);await role(c2,'authenticated',BUYER1);
  const sameReview=await review(c1,LIST_SAME,1);
  await c1.query('begin');
  await c1.query("select pg_advisory_xact_lock(hashtextextended($1,45))",[BUYER1+':'+REQ_SAME]);
  const firstSame=(await prepare(c1,LIST_SAME,1,REQ_SAME,sameReview)).rows[0].v;
  const sameTask=launch(()=>prepare(c2,LIST_SAME,1,REQ_SAME,sameReview));
  const sameBlock=await blocked(pids.c2,pids.c1,sameTask,'same-request');
  await c1.query('commit');
  const secondSame=await sameTask.promise;assert.equal(secondSame.ok,true);
  const replaySame=secondSame.value.rows[0].v;
  assert.equal(firstSame.replayed,false);assert.equal(replaySame.replayed,true);
  assert.equal(firstSame.offer_id,replaySame.offer_id);assert.equal(firstSame.payment_attempt_id,replaySame.payment_attempt_id);
  assert.equal((await observer.query('select quantity_available from public.market_listings where id=$1',[LIST_SAME])).rows[0].quantity_available,1);
  assert.equal(Number((await observer.query('select count(*) c from public.market_offers where listing_id=$1',[LIST_SAME])).rows[0].c),1);
  const changedReview={...sameReview,checkout_hash:'f'.repeat(64)};
  await assert.rejects(()=>prepare(c2,LIST_SAME,1,REQ_SAME,changedReview),/fixed_checkout_request_reused/);
  report.cases.push({case:'same-request-idempotency',block:sameBlock,offer:firstSame.offer_id,attempt:firstSame.payment_attempt_id,reviewReuseMismatch:'rejected',passed:true});

  await role(c3,'authenticated',BUYER1);await role(c4,'authenticated',BUYER2);
  const raceReview1=await review(c3,LIST_RACE,1),raceReview2=await review(c4,LIST_RACE,1);
  await c3.query('begin');
  const raceWinner=(await prepare(c3,LIST_RACE,1,REQ_RACE1,raceReview1)).rows[0].v;
  const raceTask=launch(()=>prepare(c4,LIST_RACE,1,REQ_RACE2,raceReview2));
  const raceBlock=await blocked(pids.c4,pids.c3,raceTask,'inventory-race');
  await c3.query('commit');
  const raceLoser=await raceTask.promise;assert.equal(raceLoser.ok,false);assert.match(raceLoser.message,/listing_not_available|checkout_quantity_unavailable/);
  assert.equal((await observer.query('select quantity_available from public.market_listings where id=$1',[LIST_RACE])).rows[0].quantity_available,0);
  assert.equal(Number((await observer.query('select count(*) c from public.market_offers where listing_id=$1',[LIST_RACE])).rows[0].c),1);
  report.cases.push({case:'last-unit-no-oversell',block:raceBlock,winner:raceWinner.offer_id,loser:raceLoser.message,passed:true});

  await role(c1,'authenticated',BUYER1);
  const acceptReview=await review(c1,LIST_ACCEPT,1);
  const prepared=(await prepare(c1,LIST_ACCEPT,1,REQ_ACCEPT,acceptReview)).rows[0].v;
  await observer.query("update public.market_listings set asking_price=999,shipping_method='custom',shipping_cost=99,shipping_note='Changed after review',card_name='Changed after review' where id=$1",[LIST_ACCEPT]);
  await observer.query("update dv_market_private.market_payment_configuration set platform_fee_bps=9000,platform_fee_fixed_cents=999 where singleton");
  const session='cs_test_ConcurrencySession',formedAt=new Date().toISOString();
  await role(c5,'service_role');await role(c6,'service_role');
  await c5.query('begin');
  const firstAccept=(await accept(c5,prepared.offer_id,prepared.payment_attempt_id,session,formedAt)).rows[0].v;
  const acceptTask=launch(()=>accept(c6,prepared.offer_id,prepared.payment_attempt_id,session,formedAt));
  const acceptBlock=await blocked(pids.c6,pids.c5,acceptTask,'acceptance-replay');
  await c5.query('commit');
  const secondAccept=await acceptTask.promise;assert.equal(secondAccept.ok,true);
  const replayAccept=secondAccept.value.rows[0].v;assert.equal(firstAccept.replayed,false);assert.equal(replayAccept.replayed,true);
  assert.equal(firstAccept.order_id,replayAccept.order_id);
  assert.equal(Number((await observer.query('select count(*) c from public.market_deals where offer_id=$1',[prepared.offer_id])).rows[0].c),1);
  assert.equal(Number((await observer.query('select count(*) c from public.market_orders')).rows[0].c),1);
  assert.equal(Number((await observer.query('select count(*) c from dv_market_private.market_payment_attempts where id=$1',[prepared.payment_attempt_id])).rows[0].c),1);
  assert.equal(Number((await observer.query('select count(*) c from dv_market_private.market_payment_allocations')).rows[0].c),1);
  const frozen=(await observer.query('select o.amount_due_cents_snapshot,o.platform_fee_cents_snapshot,o.stripe_account_id_snapshot,o.contract_review_snapshot,d.shipping_cost,s.total_price from public.market_offers o join public.market_deals d on d.offer_id=o.id join dv_market_private.market_contract_snapshots s on s.deal_id=d.id where o.id=$1',[prepared.offer_id])).rows[0];
  assert.equal(Number(frozen.amount_due_cents_snapshot),10500);assert.equal(Number(frozen.platform_fee_cents_snapshot),293);
  assert.equal(Number(frozen.shipping_cost),5);assert.equal(Number(frozen.total_price),105);
  assert.equal(frozen.stripe_account_id_snapshot,'acct_ConcurrencySeller');assert.equal(Number(frozen.contract_review_snapshot.total_price),105);
  const payment=(await observer.query('select amount_due_cents,platform_fee_cents,stripe_account_id from dv_market_private.market_payment_attempts where id=$1',[prepared.payment_attempt_id])).rows[0];
  assert.equal(payment.amount_due_cents,10500);assert.equal(payment.platform_fee_cents,293);assert.equal(payment.stripe_account_id,'acct_ConcurrencySeller');
  report.cases.push({case:'service-role-acceptance-replay',block:acceptBlock,offer:prepared.offer_id,order:firstAccept.order_id,passed:true});

  assert.ok(report.cases.every(c=>c.passed&&c.block.waiting_lock));report.passed=true;
  console.log('PASS: fixed-price PostgreSQL concurrency uses separate authenticated/service-role connections; same request replays once, final inventory cannot oversell, acceptance creates one deal/order/payment evidence');
}catch(error){
  report.failure={message:error.message,code:error.code};throw error;
}finally{
  for(const c of [c1,c2,c3,c4,c5,c6])if(c)await c.query('rollback').catch(()=>{});
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await writeFile(new URL('../test-results/trade-fixed-price-postgres.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  await db.close();
}
