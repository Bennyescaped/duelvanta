import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [migration,checkoutApi,checkoutUi,offerUi,retiredOfferCheckout,orders,profile,profileHtml,dispatcher,tradeHtml,tradeSealed]=await Promise.all([
  'supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',
  'api/market-stripe-checkout.js','trade-checkout.js','trade-offer-details.js','trade-offer-checkout.js',
  'trade-orders.js','profile.js','profile.html','api/compliance-message-dispatch.js','trade.html','trade-sealed.js'
].map(read));
const must=(source,text,message)=>assert.ok(source.includes(text),message);
const mustNot=(source,text,message)=>assert.ok(!source.includes(text),message);
const fn=(source,name)=>{
  const start=source.indexOf('create or replace function '+name+'(');
  assert.notEqual(start,-1,'missing function '+name);
  const end=source.indexOf('\n$$;',start);
  assert.notEqual(end,-1,'unterminated function '+name);
  return source.slice(start,end+4);
};

for(const retired of ['market_buyer_profiles','get_my_market_buyer_profile','set_my_market_buyer_profile','delete_market_buyer_profile_for_erasure',"'business'","'b2b'","'c2b'"])
  mustNot(migration,retired,'retired buyer route remains in unapplied draft: '+retired);
must(migration,'require_trade_eligibility(p_buyer_id,true)','existing private-buyer declaration is not required');
for(const kind of ['b2c','c2c'])must(migration,"'"+kind+"'",'contract classification missing '+kind);
const buyerGuard=fn(migration,'dv_market_private.require_market_buyer_type');
for(const field of ['p.id=p_buyer_id','account_status','safety_restricted','account_closure_requested_at','data_processing_restricted_at'])
  must(buyerGuard,field,'actual buyer account boundary missing: '+field);
must(buyerGuard,"return 'consumer'",'private-buyer guard must return only consumer');
mustNot(migration,'schema_version','unreviewed migration must not publish a schema readiness marker');
mustNot(migration,'create or replace function dv_market_private.require_trade_eligibility','existing age/country/private checks must not be replaced');
mustNot(migration,'update dv_market_private.market_contract_snapshots','historical contract evidence must not be rewritten');
for(const name of ['public.respond_to_market_offer','public.accept_fixed_price_market_offer_v1']){
 const body=fn(migration,name);
 must(body,'require_market_buyer_type(o.buyer_id)','seller/service path must validate the actual buyer');
 must(body,"buyer_type_snapshot is distinct from 'consumer'",'NULL or incompatible offer snapshot must fail closed');
}
must(fn(migration,'public.prepare_fixed_price_market_offer_v1'),'require_market_buyer_type(v_uid)','fixed buyer path lost eligibility check');
must(fn(migration,'dv_market_private.capture_market_contract_snapshot'),'require_market_buyer_type(new.buyer_id)','new evidence must validate the actual buyer');

must(migration,"offer_type in ('price','fixed_price')",'fixed-price buyer offer type missing');
must(migration,'prepare_fixed_price_market_offer_v1','fixed-price buyer offer preparation missing');
must(migration,'accept_fixed_price_market_offer_v1','fixed-price payment-request acceptance missing');
must(fn(migration,'public.accept_fixed_price_market_offer_v1'),"'accepted',p_payment_requested_at",'fixed contract is not timestamped at payment request');
must(fn(migration,'public.accept_fixed_price_market_offer_v1'),'select * into d from public.market_deals where id=d.id','fixed acceptance does not reload the order attached by the AFTER trigger');
const fixedPrepare=fn(migration,'public.prepare_fixed_price_market_offer_v1');
for(const frozen of ['contract_review_snapshot','checkout_hash_snapshot','stripe_account_id_snapshot','payment_live_mode_snapshot','amount_due_cents_snapshot','platform_fee_cents_snapshot'])
  must(fixedPrepare,frozen,'fixed prepare does not freeze '+frozen);
must(fixedPrepare,"lower(trim(p_checkout_hash)) is distinct from v_existing.checkout_hash_snapshot",'fixed request-key replay is not bound to the original review hash');
must(fixedPrepare,"contract_review_snapshot->>'listing_updated_at'",'fixed request-key replay is not bound to the original listing version');
must(fn(migration,'public.review_market_checkout'),"'fulfillment_snapshot'",'fixed review does not freeze fulfillment dimensions/packaging');
const fixedAccept=fn(migration,'public.accept_fixed_price_market_offer_v1');
for(const frozen of ['contract_review_snapshot','checkout_hash_snapshot','stripe_account_id_snapshot','payment_live_mode_snapshot','amount_due_cents_snapshot','platform_fee_cents_snapshot'])
  must(fixedAccept,frozen,'fixed acceptance is not bound to '+frozen);
must(fixedAccept,"on conflict (offer_id) do nothing",'fixed acceptance does not suppress duplicate deal creation');
must(fixedAccept,"on conflict (id) do nothing",'fixed payment evidence is not replay-safe');
must(fixedAccept,"v_review->>'shipping_method'",'fixed acceptance rereads current shipping instead of frozen review');
must(fn(migration,'dv_market_private.capture_market_contract_snapshot'),"elsif v_offer.offer_type='fixed_price'",'fixed contract evidence does not use frozen checkout review');
must(fn(migration,'public.attach_market_deal_to_order'),"o.contract_review_snapshot->'product'->>'title'",'order item title is not bound to frozen contract product');
must(fn(migration,'public.respond_to_market_offer'),'insert into public.market_deals','seller acceptance does not form negotiated contract');
must(migration,'review_market_price_offer_v1','negotiated buyer offer review is missing');
must(migration,'create_market_offer_v3','review-bound negotiated offer writer is missing');
must(migration,'revoke all on function public.create_market_offer_v2(uuid,integer,numeric,text) from public,anon,authenticated','unreviewed negotiated offer writer remains browser-accessible');
for(const frozen of ['contract_review_snapshot','offer_review_hash',"snapshot_version'<>'price-offer-contract-v1'","v_review->>'shipping_method'","on conflict (offer_id) do nothing"])must(fn(migration,'public.respond_to_market_offer'),frozen,'negotiated acceptance is not bound/idempotent: '+frozen);
must(fn(migration,'dv_market_private.capture_market_contract_snapshot'),"v_offer.contract_review_snapshot->'seller_party'",'negotiated evidence rereads current seller instead of frozen party');
must(tradeSealed,"db.rpc('review_market_price_offer_v1'",'price offer UI lacks pre-binding review');
must(tradeSealed,"db.rpc('create_market_offer_v3'",'price offer UI still uses unreviewed writer');
must(tradeSealed,'GESAMTPREIS','price offer UI does not show total price before binding');
mustNot(fn(migration,'public.respond_to_market_offer'),"now()+interval '2 hours'",'negotiated acceptance still creates a two-hour pre-contract reservation');
must(migration,'market_withdrawal_drafts','withdrawal confirmation draft missing');
must(migration,'market_withdrawals','immutable withdrawal receipt missing');
must(migration,'prepare_market_withdrawal_v1','withdrawal first step missing');
must(migration,'confirm_market_withdrawal_v1','withdrawal confirmation step missing');
const confirmWithdrawal=fn(migration,'public.confirm_market_withdrawal_v1');
must(confirmWithdrawal,"'withdrawal_receipt'",'consumer durable-medium receipt is not queued');
must(confirmWithdrawal,"'withdrawal_notice'",'seller withdrawal notice is not queued');
mustNot(confirmWithdrawal,'prepare_market_stripe_full_refund','withdrawal declaration improperly triggers a refund');
mustNot(confirmWithdrawal,'cancel_market','withdrawal declaration improperly triggers cancellation');
const prepareWithdrawal=fn(migration,'public.prepare_market_withdrawal_v1');
const listWithdrawal=fn(migration,'public.get_my_market_withdrawable_contracts');
const withdrawalExport=fn(migration,'public.export_my_duelvanta_data');
for(const source of [prepareWithdrawal,listWithdrawal,confirmWithdrawal]){
  must(source,"contract_classification='b2c'",'withdrawal path must be limited to B2C snapshots');
  must(source,"seller_type='trader'",'withdrawal path must require the trader snapshot');
  must(source,"buyer_type='consumer'",'withdrawal path must require the consumer snapshot');
  must(source,"seller_party->>'public_email'",'withdrawal path must require the frozen trader recipient');
}
must(migration,'market_withdrawals_contract_snapshot_uq','one immutable withdrawal per contract snapshot is not enforced');
must(migration,'market_withdrawal_drafts_contract_buyer_uq','multiple active drafts per buyer/contract remain possible');
must(confirmWithdrawal,'pg_advisory_xact_lock','withdrawal confirmation lacks a contract-scoped concurrency lock');
must(confirmWithdrawal,"where contract_snapshot_id=d.contract_snapshot_id and buyer_id=v_uid",'contract-level replay is not handled');
must(confirmWithdrawal,"'contract_domain','marketplace_b2c'",'marketplace B2C contract domain is not explicit');
must(confirmWithdrawal,"s.id,'seller',s.seller_id,v_seller_email,'withdrawal_notice'",'seller notice does not use the frozen seller recipient');
must(confirmWithdrawal,"'withdrawal_receipt:'||s.id::text",'buyer receipt is not deduplicated per contract');
must(confirmWithdrawal,"'withdrawal_notice:'||s.id::text",'seller notice is not deduplicated per contract');
must(confirmWithdrawal,"'evidence_sha256'",'withdrawal outbox lacks immutable evidence hash');
must(confirmWithdrawal,'evidence_snapshot','withdrawal hash is not bound to an immutable evidence snapshot');
must(withdrawalExport,"'withdrawals'",'withdrawal evidence is missing from own-data export');
must(withdrawalExport,'market_withdrawals','withdrawal export does not use the private evidence table');
mustNot(withdrawalExport,'marketplace_message_outbox','private delivery internals must not leak into own-data export');
mustNot(confirmWithdrawal,'prepare_market_stripe','withdrawal must not initiate Stripe work');
mustNot(confirmWithdrawal,'payment_status','withdrawal must not alter payment status');


must(checkoutApi,"stripeMode('payments')",'fixed contract path bypasses Stripe payment gate');
must(checkoutApi,'prepare_fixed_price_market_offer_v1','API does not create buyer offer before payment request');
must(checkoutApi,'accept_fixed_price_market_offer_v1','API does not finalize contract after payment request');
must(checkoutApi,'session.created','provider-created payment-request time is not used for acceptance');
mustNot(checkoutApi,'release_fixed_price_market_offer_v1','ambiguous fixed-price outcome must not destructively release the reservation');
must(checkoutApi,'fixed_checkout_outcome_unknown','ambiguous fixed-price outcome is not surfaced as retryable');
must(checkoutApi,'fixed_checkout_payment_recovery_unknown','formed-contract payment recovery is not distinguished');
must(checkoutApi,'contract_formed_payment_retry_required','expired formed-contract payment session has no safe recovery state');
must(checkoutApi,'contract_formed_payment_processing','completed formed-contract payment session is not distinguished from retry');
must(checkoutApi,'fixedSession(','Stripe session response is not amount/metadata-bound before contract formation');
mustNot(checkoutApi,'/expire','ambiguous fixed-price finalization must not expire Stripe Checkout session');

must(checkoutUi,'VERBINDLICHES KAUFANGEBOT','fixed checkout does not explain buyer offer');
must(checkoutUi,'Zahlungspflichtig bestellen','required order button wording missing');
must(checkoutUi,"fetch('/api/market-stripe-checkout'",'fixed checkout does not route through Stripe request API');
mustNot(checkoutUi,"db.rpc('buy_market_listing_v3'",'legacy immediate fixed-price contract RPC is still used by UI');

must(offerUi,'VERTRAG GESCHLOSSEN','accepted price proposal does not show immediate contract');
must(offerUi,'VERTRAGSDATEN DES PREISANGEBOTS','seller does not see frozen terms before acceptance');
must(offerUi,'Dieses ältere Angebot enthält keinen vollständigen Vertrags-Snapshot','legacy pending offers are not fail-closed');
mustNot(offerUi,'data-checkout-offer','accepted price proposal still exposes a second contract checkout');
mustNot(offerUi,'trade-offer-checkout.js','negotiated offer UI still injects retired second checkout');
must(retiredOfferCheckout,'retired:true','legacy offer checkout file is not fail-safe retired');

mustNot(profileHtml,'buyerPurchaseType','duplicate buyer selector must be removed');
mustNot(profileHtml,'Geschäftlich kaufen','business-buyer UI must not be offered');
for(const name of ['get_my_market_buyer_profile','set_my_market_buyer_profile','confirm_my_market_private_buyer','confirm_my_market_trade_eligibility'])
 mustNot(profile,name,'ordinary profile boot must not access/confirm a second buyer status');
must(profileHtml,'profile.js?v=1.5','profile cache revision missing');
must(checkoutUi,'privateBuyerReview','checkout must reject incompatible buyer review data');


must(orders,'VERTRAG WIDERRUFEN','withdrawal entry button missing');
must(orders,'WIDERRUF BESTÄTIGEN','withdrawal confirmation button missing');
must(orders,"prepare_market_withdrawal_v1",'withdrawal first action missing from UI');
must(orders,"confirm_market_withdrawal_v1",'withdrawal confirmation missing from UI');
must(dispatcher,"withdrawal_receipt",'withdrawal durable-medium receipt renderer missing');
must(dispatcher,"withdrawal_notice",'seller withdrawal renderer missing');

must(tradeHtml,'trade-orders.js?v=1.8','withdrawal order UI cache revision missing');
must(tradeHtml,'trade-offer-details.js?v=2.1','negotiated contract UI cache revision missing');
must(tradeHtml,'trade-checkout.js?v=2.2','fixed contract UI cache revision missing');

must(tradeHtml,'trade-legal-readiness.js?v=1.1','missing-schema protection is not loaded in TRADE');
must(profileHtml,'trade-legal-readiness.js?v=1.1','missing-schema protection is not loaded in PROFILE');
assert.ok(tradeHtml.indexOf('src="trade-legal-readiness.js?v=1.1"')<tradeHtml.indexOf('src="trade-release-gate.js'),'schema guard must load before contract handlers');
assert.ok(profileHtml.indexOf('src="trade-legal-readiness.js?v=1.1"')<profileHtml.indexOf('src="profile.js'),'schema guard must load before profile handlers');
await import('./trade-legal-readiness-test.mjs');
await import('./trade-legal-profile-boundary-test.mjs');
await import('./trade-legal-private-buyer-ui-test.mjs');
await import('./trade-legal-order-boundary-test.mjs');
await import('./trade-legal-private-buyer-database-test.mjs');
await import('./trade-legal-private-buyer-browser-test.mjs');
await import('./trade-legal-price-offer-database-test.mjs');
console.log('PASS: legal-model candidate wiring and schema guard; NOT a legal, staging or production acceptance');
