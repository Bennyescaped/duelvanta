import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [sql,checkout,orders,dispatcher]=await Promise.all([
  'database/market-checkout-compliance-v1.sql','trade-checkout.js','trade-orders.js','api/compliance-message-dispatch.js'
].map(read));
const must=(source,text,message)=>assert.ok(source.includes(text),message);

for(const table of ['market_contract_snapshots','marketplace_message_delivery_events'])must(sql,table,'missing compliance table '+table);
for(const table of ['market_contract_snapshots','marketplace_message_delivery_events'])
  must(sql,`alter table dv_market_private.${table} enable row level security`,'private checkout table lacks RLS defense in depth: '+table);
must(sql,'market_contract_snapshot_is_immutable','contract snapshot mutation is not blocked');
must(sql,"contract_classification in ('c2c','b2c')",'C2C/B2C classification is not constrained');
must(sql,'seller_party jsonb not null','contract party snapshot is missing');
must(sql,'product_snapshot jsonb not null','product snapshot is missing');
must(sql,'content_sha256 bytea not null','confirmation integrity hash is missing');
must(sql,'set search_path = pg_catalog, public, dv_market_private, extensions','pgcrypto extension schema is missing from checkout hash functions');
must(sql,"when 'parcel' then 'Paket mit Tracking'",'durable confirmation exposes an internal shipping code');
must(sql,'zz_capture_market_contract_snapshot','accepted offers and direct purchases are not captured by the deal boundary');
must(sql,'buy_market_listing_v3','review-bound checkout entrypoint is missing');
must(sql,'revoke execute on function public.buy_market_listing_v2','legacy checkout can bypass the reviewed entrypoint');
must(sql,'get_my_market_order_contract_documents','durable order document retrieval is missing');
must(sql,'for update skip locked','outbox claim is not concurrency-safe');
must(sql,'delivery_lock_mismatch','outbox completion is not lock-bound');
must(sql,'grant execute on function public.claim_marketplace_message_delivery(integer,uuid) to service_role','browser roles can claim compliance messages');
assert.ok(!/grant execute on function public\.claim_marketplace_message_delivery[^;]+authenticated/.test(sql),'authenticated users must not claim delivery jobs');

must(checkout,'Zahlungspflichtig bestellen','required B2C button wording is missing');
must(checkout,"db.rpc('review_market_checkout'",'checkout review RPC is not wired');
must(checkout,'p_checkout_hash:checkoutReview.checkout_hash','purchase is not bound to the reviewed snapshot');
must(orders,"db.rpc('get_my_market_order_contract_documents'",'confirmation download is not wired');

must(dispatcher,"COMPLIANCE_EMAIL_DELIVERY_ENABLED!=='true'",'real delivery is not default-off');
must(dispatcher,"COMPLIANCE_DISPATCH_SECRET",'dispatcher authentication is missing');
must(dispatcher,"SUPABASE_SERVICE_ROLE_KEY",'dispatcher does not use server-only database authority');
must(dispatcher,"'idempotency-key':row.idempotency_key",'provider send is not idempotent');
assert.ok(!dispatcher.includes('sb_secret_')&&!dispatcher.includes('re_123'),'repository contains a secret-looking dispatcher value');

console.log('PASS: immutable C2C/B2C checkout, durable confirmation and default-off delivery contracts');
