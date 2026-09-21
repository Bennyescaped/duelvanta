import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [sql,legal,checkout,orders,dispatcher]=await Promise.all([
  'database/market-checkout-compliance-v1.sql','supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql','trade-checkout.js','trade-orders.js','api/compliance-message-dispatch.js'
].map(read));
const must=(source,text,message)=>assert.ok(source.includes(text),message);

for(const table of ['market_contract_snapshots','marketplace_message_delivery_events'])must(sql,table,'missing compliance table '+table);
for(const table of ['market_contract_snapshots','marketplace_message_delivery_events'])
  must(sql,`alter table dv_market_private.${table} enable row level security`,'private checkout table lacks RLS defense in depth: '+table);
must(sql,'market_contract_snapshot_is_immutable','contract snapshot mutation is not blocked');
must(legal,"contract_classification in ('c2c','c2b','b2c','b2b')",'buyer-aware contract classification is not constrained');
must(sql,'seller_party jsonb not null','contract party snapshot is missing');
must(sql,'product_snapshot jsonb not null','product snapshot is missing');
must(sql,'content_sha256 bytea not null','confirmation integrity hash is missing');
must(sql,'set search_path = pg_catalog, public, dv_market_private, extensions','pgcrypto extension schema is missing from checkout hash functions');
must(sql,"when 'parcel' then 'Paket mit Tracking'",'durable confirmation exposes an internal shipping code');
must(sql,'zz_capture_market_contract_snapshot','accepted offers and direct purchases are not captured by the deal boundary');
must(legal,'prepare_fixed_price_market_offer_v1','review-bound fixed-price buyer offer entrypoint is missing');
must(legal,'revoke all on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) from public,anon,authenticated','obsolete direct-purchase RPC remains browser-accessible');
must(legal,'revoke all on function public.checkout_accepted_market_offer_v1(uuid,uuid,text) from public,anon,authenticated','obsolete negotiated second-checkout RPC remains browser-accessible');
must(sql,'revoke execute on function public.buy_market_listing_v2','legacy checkout can bypass the reviewed entrypoint');
must(sql,'get_my_market_order_contract_documents','durable order document retrieval is missing');
must(sql,'for update skip locked','outbox claim is not concurrency-safe');
must(sql,'delivery_lock_mismatch','outbox completion is not lock-bound');
must(sql,'grant execute on function public.claim_marketplace_message_delivery(integer,uuid) to service_role','browser roles can claim compliance messages');
assert.ok(!/grant execute on function public\.claim_marketplace_message_delivery[^;]+authenticated/.test(sql),'authenticated users must not claim delivery jobs');

must(checkout,'Zahlungspflichtig bestellen','required B2C button wording is missing');
must(checkout,"db.rpc('review_market_checkout'",'checkout review RPC is not wired');
must(checkout,'checkout_hash:checkoutReview.checkout_hash','fixed buyer offer is not bound to the reviewed snapshot');
assert.ok(!checkout.includes("db.rpc('buy_market_listing_v3'"),'UI still calls obsolete immediate contract RPC');
must(orders,"db.rpc('get_my_market_order_contract_documents'",'confirmation download is not wired');

must(dispatcher,"COMPLIANCE_EMAIL_DELIVERY_ENABLED!=='true'",'real delivery is not default-off');
must(dispatcher,"COMPLIANCE_DISPATCH_SECRET",'dispatcher authentication is missing');
must(dispatcher,"SUPABASE_SERVICE_ROLE_KEY",'dispatcher does not use server-only database authority');
must(dispatcher,"'idempotency-key':row.idempotency_key",'provider send is not idempotent');
assert.ok(!dispatcher.includes('sb_secret_')&&!dispatcher.includes('re_123'),'repository contains a secret-looking dispatcher value');

console.log('PASS: buyer-aware immutable checkout, legacy RPC revocation, durable confirmation and default-off delivery contracts');
