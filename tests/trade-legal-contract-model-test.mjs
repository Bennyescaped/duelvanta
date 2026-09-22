import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [migration,checkoutApi,checkoutUi,offerUi,retiredOfferCheckout,orders,profile,profileHtml,dispatcher,tradeHtml]=await Promise.all([
  'supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',
  'api/market-stripe-checkout.js','trade-checkout.js','trade-offer-details.js','trade-offer-checkout.js',
  'trade-orders.js','profile.js','profile.html','api/compliance-message-dispatch.js','trade.html'
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
must(fn(migration,'public.respond_to_market_offer'),'insert into public.market_deals','seller acceptance does not form negotiated contract');
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

must(checkoutApi,"stripeMode('payments')",'fixed contract path bypasses Stripe payment gate');
must(checkoutApi,'prepare_fixed_price_market_offer_v1','API does not create buyer offer before payment request');
must(checkoutApi,'accept_fixed_price_market_offer_v1','API does not finalize contract after payment request');
must(checkoutApi,'session.created','provider-created payment-request time is not used for acceptance');
must(checkoutApi,'release_fixed_price_market_offer_v1','failed payment request does not release fixed-price offer');
must(checkoutApi,'/expire','failed fixed-price finalization does not expire Stripe Checkout session');

must(checkoutUi,'VERBINDLICHES KAUFANGEBOT','fixed checkout does not explain buyer offer');
must(checkoutUi,'Zahlungspflichtig bestellen','required order button wording missing');
must(checkoutUi,"fetch('/api/market-stripe-checkout'",'fixed checkout does not route through Stripe request API');
mustNot(checkoutUi,"db.rpc('buy_market_listing_v3'",'legacy immediate fixed-price contract RPC is still used by UI');

must(offerUi,'VERTRAG GESCHLOSSEN','accepted price proposal does not show immediate contract');
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

must(tradeHtml,'trade-orders.js?v=1.7','withdrawal order UI cache revision missing');
must(tradeHtml,'trade-offer-details.js?v=2.0','negotiated contract UI cache revision missing');
must(tradeHtml,'trade-checkout.js?v=2.1','fixed contract UI cache revision missing');

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
console.log('PASS: legal-model candidate wiring and schema guard; NOT a legal, staging or production acceptance');
