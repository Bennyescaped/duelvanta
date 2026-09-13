import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}});
const BUYER='81000000-0000-4000-8000-000000000001';
const PRIVATE='81000000-0000-4000-8000-000000000002';
const TRADER='81000000-0000-4000-8000-000000000003';
const migrations=await Promise.all([
  'database/market-seller-compliance-v1.sql','database/market-notice-action-v1.sql',
  'database/market-checkout-compliance-v1.sql','database/market-tax-transparency-v1.sql'
].map(name=>readFile(new URL('../'+name,import.meta.url),'utf8')));
const claim=async(uid,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);set role ${role};`);
const json=value=>typeof value==='string'?JSON.parse(value):value;

try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id),role text,account_status text,safety_restricted boolean default false);
    create table public.market_listings(
      id uuid primary key,seller_id uuid not null references auth.users(id),status text not null,listing_type text,pricing_mode text,
      asking_price numeric,quantity_available int,minimum_purchase_quantity int,quantity_pricing jsonb default '[]',active_until timestamptz,
      shipping_method text,shipping_cost numeric,tcg text,card_name text,set_name text,card_number text,language text,variant text,condition text,
      grading_company text,grade text,product_kind text,sealed_category text,sealed_condition text,package_contents text,units_per_container int,
      seller_note text,updated_at timestamptz not null default now()
    );
    create table public.market_offers(id uuid primary key,seller_id uuid,buyer_id uuid,listing_id uuid,status text);
    create table public.market_orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,payment_provider text default 'manual_beta');
    create table public.market_deals(
      id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.market_listings(id),offer_id uuid references public.market_offers(id),
      order_id uuid references public.market_orders(id),seller_id uuid not null,buyer_id uuid not null,amount numeric,currency text,status text,
      accepted_at timestamptz,shipping_method text,shipping_cost numeric,product_kind text,sealed_category text,item_quantity int
    );
    create function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into auth.users(id,email) values('${BUYER}','buyer@example.test'),('${PRIVATE}','private@example.test'),('${TRADER}','trader@example.test');
    insert into public.profiles(id,role,account_status) values('${BUYER}','player','active'),('${PRIVATE}','player','active'),('${TRADER}','player','active');
  `);
  for(const migration of migrations)await db.exec(migration);
  await db.exec(`
    insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,terms_version,verified_at,trader_display_name,psttg_subject_type)
    values('${PRIVATE}','private','active','seller-v1',now(),null,'natural_person'),
          ('${TRADER}','trader','active','seller-v1',now(),'Card GmbH','legal_entity');
    insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,business_name,legal_form,street_line1,postal_code,city,country_code,tax_residence_country_code,public_email,register_name,register_number)
    values('${PRIVATE}','Private','Seller','1990-01-01',null,null,'Privatweg 1','75100','Teststadt','DE','DE',null,null,null),
          ('${TRADER}','Trade','Representative','1980-01-01','Card GmbH','GmbH','Shopweg 2','75200','Handelsstadt','DE','DE','shop@example.test','Handelsregister','HRB 123');
    insert into dv_market_private.seller_tax_identifiers(seller_id,identifier_kind,issuing_country_code,identifier_ciphertext,identifier_hash)
    values('${PRIVATE}','tin','DE',decode('010203','hex'),digest('private-tax-test','sha256')),
          ('${TRADER}','tin','DE',decode('040506','hex'),digest('trader-tax-test','sha256'));
  `);

  // Two private contracts and 31 trader contracts. Contract events alone must never count as remuneration.
  await db.exec(`
    do $$declare v_seller uuid;v_count integer;v_i integer;v_listing uuid;v_order uuid;begin
      foreach v_seller in array array['${PRIVATE}'::uuid,'${TRADER}'::uuid] loop
        v_count:=case when v_seller='${PRIVATE}'::uuid then 2 else 31 end;
        for v_i in 1..v_count loop
          v_listing:=gen_random_uuid();v_order:=gen_random_uuid();
          insert into public.market_listings(id,seller_id,status,listing_type,pricing_mode,asking_price,quantity_available,minimum_purchase_quantity,quantity_pricing,shipping_method,shipping_cost,tcg,card_name,set_name,language,condition,product_kind,updated_at)
          values(v_listing,v_seller,'active','sale','fixed',100,1,1,'[]','tracked_letter',0,'pokemon','Tax Test Card','Set','Deutsch','mint','single','2026-01-10T10:00:00Z');
          insert into public.market_orders(id,order_number,seller_id,buyer_id) values(v_order,'DV-TAX-'||left(v_listing::text,8),v_seller,'${BUYER}');
          insert into public.market_deals(listing_id,order_id,seller_id,buyer_id,amount,currency,status,accepted_at,shipping_method,shipping_cost,product_kind,item_quantity)
          values(v_listing,v_order,v_seller,'${BUYER}',100,'EUR','accepted','2026-01-10T10:00:00Z','tracked_letter',0,'single',1);
        end loop;
      end loop;
    end$$;
  `);
  assert.equal(Number((await db.query(`select count(*) count from dv_market_private.market_tax_events where event_type='contract_formed'`)).rows[0].count),33);
  assert.equal(Number((await db.query(`select sum(activity_count_delta) count from dv_market_private.market_tax_events`)).rows[0].count),0);

  await claim(BUYER);
  await assert.rejects(()=>db.query(`select id from dv_market_private.market_contract_snapshots limit 1`),/permission denied/);
  await assert.rejects(()=>db.query(`select public.generate_market_tax_export(2026,null,'json')`),/permission denied/);
  await assert.rejects(()=>db.query(`select public.record_market_tax_remuneration('00000000-0000-0000-0000-000000000000','browser-event','2026-01-01',1)`),/permission denied/);

  await db.exec('reset role;');
  const privateSnapshots=(await db.query(`select id from dv_market_private.market_contract_snapshots where seller_id='${PRIVATE}' order by id`)).rows;
  const traderSnapshots=(await db.query(`select id from dv_market_private.market_contract_snapshots where seller_id='${TRADER}' order by id`)).rows;
  await claim(null,'service_role');
  const p1=json((await db.query(`select public.record_market_tax_remuneration('${privateSnapshots[0].id}','pay-private-1','2026-02-01T10:00:00Z',1000) value`)).rows[0].value);
  await db.query(`select public.record_market_tax_remuneration('${privateSnapshots[1].id}','pay-private-2','2026-04-01T10:00:00Z',1100)`);
  const replay=json((await db.query(`select public.record_market_tax_remuneration('${privateSnapshots[0].id}','pay-private-1','2026-02-01T10:00:00Z',1000) value`)).rows[0].value);
  assert.equal(replay.replayed,true);
  await db.query(`select public.correct_market_tax_remuneration('${p1.event_id}','correct-private-1','2027-01-05T10:00:00Z',100,0,0,0,false,'verified partial refund')`);
  let traderOriginal,traderSecond;
  for(let i=0;i<traderSnapshots.length;i++){
    const paid=json((await db.query(`select public.record_market_tax_remuneration('${traderSnapshots[i].id}','pay-trader-${String(i+1).padStart(2,'0')}','2026-03-01T10:00:00Z',10) value`)).rows[0].value);
    if(i===0)traderOriginal=paid;
    if(i===1)traderSecond=paid;
  }
  await db.query(`select public.correct_market_tax_remuneration('${traderOriginal.event_id}','void-trader-01','2026-05-01T10:00:00Z',10,0,0,0,true,'verified full reversal')`);
  await assert.rejects(()=>db.query(`select public.correct_market_tax_remuneration('${p1.event_id}','over-correction','2027-02-01T10:00:00Z',1001)`),/tax_correction_exceeds_original/);

  await db.exec('reset role;');
  const correctionPeriod=(await db.query(`select reporting_year,reporting_quarter from dv_market_private.market_tax_events where event_key='correct-private-1'`)).rows[0];
  assert.deepEqual(correctionPeriod,{reporting_year:2026,reporting_quarter:1});

  await claim(null,'service_role');
  const annual=json((await db.query(`select public.generate_market_tax_export(2026,null,'json') value`)).rows[0].value);
  assert.equal(annual.status,'review_evidence_not_bzst_submission');assert.equal(annual.row_count,8);assert.match(annual.sha256,/^[a-f0-9]{64}$/);
  const payload=JSON.parse(annual.payload);
  const privateQ1=payload.rows.find(row=>row.seller_id===PRIVATE&&Number(row.reporting_quarter)===1);
  const traderQ1=payload.rows.find(row=>row.seller_id===TRADER&&Number(row.reporting_quarter)===1);
  assert.equal(Number(privateQ1.annual.activity_count),2);assert.equal(Number(privateQ1.annual.remuneration),2000);
  assert.equal(privateQ1.goods_threshold.exactly_2000_eur_remuneration,true);assert.equal(privateQ1.goods_threshold.threshold_result,'reportable_threshold_met');
  assert.equal(Number(traderQ1.annual.activity_count),30);assert.equal(Number(traderQ1.annual.remuneration),300);
  assert.equal(traderQ1.goods_threshold.exactly_30_activities,true);assert.equal(traderQ1.goods_threshold.threshold_result,'reportable_threshold_met');
  assert.equal(privateQ1.identity_data_ready,true);assert.equal(traderQ1.identity_data_ready,true);
  assert.equal(privateQ1.identity.tax_identifiers_remain_encrypted,true);
  assert.ok(!annual.payload.includes('private-tax-test')&&!annual.payload.includes('trader-tax-test'));

  await db.query(`select public.correct_market_tax_remuneration('${traderSecond.event_id}','void-trader-02','2026-06-01T10:00:00Z',10,0,0,0,true,'verified second reversal')`);
  const below=json((await db.query(`select public.generate_market_tax_export(2026,null,'json') value`)).rows[0].value);
  const belowPayload=JSON.parse(below.payload);
  const traderBelow=belowPayload.rows.find(row=>row.seller_id===TRADER&&Number(row.reporting_quarter)===1);
  assert.equal(Number(traderBelow.annual.activity_count),29);assert.equal(Number(traderBelow.annual.remuneration),290);
  assert.equal(traderBelow.goods_threshold.threshold_result,'exempt_below_both_thresholds');

  const csv=json((await db.query(`select public.generate_market_tax_export(2026,1,'csv') value`)).rows[0].value);
  assert.equal(csv.row_count,2);assert.match(csv.payload,/seller_id,reporting_year,reporting_quarter/);assert.match(csv.payload,/exactly_30_activities/);
  await db.exec('reset role;');
  const stored=(await db.query(`select encode(payload_sha256,'hex') sha,payload_text from dv_market_private.market_tax_exports where id='${annual.export_id}'`)).rows[0];
  assert.equal(stored.sha,annual.sha256);assert.equal(stored.payload_text,annual.payload);
  await claim(null,'service_role');
  const fetched=json((await db.query(`select public.get_market_tax_export('${annual.export_id}') value`)).rows[0].value);
  assert.equal(fetched.sha256,annual.sha256);assert.equal(fetched.payload,annual.payload);
  await db.exec('reset role;');
  await assert.rejects(()=>db.query(`update dv_market_private.market_tax_events set evidence='{}'`),/market_tax_evidence_is_immutable/);
  await assert.rejects(()=>db.query(`delete from dv_market_private.market_tax_exports`),/market_tax_evidence_is_immutable/);

  console.log('PASS: tax ledger separates contracts from remuneration, preserves corrections and exports exact PStTG boundaries');
}finally{await db.close()}
