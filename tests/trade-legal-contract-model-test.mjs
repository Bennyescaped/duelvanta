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

must(migration,'market_buyer_profiles','buyer account classification table missing');
must(migration,"buyer_type in ('consumer','business')",'buyer type constraint missing');
for(const kind of ['b2c','b2b','c2c','c2b'])must(migration,"'"+kind+"'",'contract classification missing '+kind);
must(migration,"offer_type in ('price','fixed_price')",'fixed-price buyer offer type missing');
must(migration,'prepare_fixed_price_market_offer_v1','fixed-price buyer offer preparation missing');
must(migration,'accept_fixed_price_market_offer_v1','fixed-price payment-request acceptance missing');
must(fn(migration,'public.accept_fixed_price_market_offer_v1'),"'accepted',p_payment_requested_at",'fixed contract is not timestamped at payment request');
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

must(profileHtml,'buyerPurchaseType','buyer account purpose selector missing');
must(profile,"get_my_market_buyer_profile",'buyer profile is not loaded');
must(profile,"set_my_market_buyer_profile",'buyer profile is not persisted');

must(orders,'VERTRAG WIDERRUFEN','withdrawal entry button missing');
must(orders,'WIDERRUF BESTÄTIGEN','withdrawal confirmation button missing');
must(orders,"prepare_market_withdrawal_v1",'withdrawal first action missing from UI');
must(orders,"confirm_market_withdrawal_v1",'withdrawal confirmation missing from UI');
must(dispatcher,"withdrawal_receipt",'withdrawal durable-medium receipt renderer missing');
must(dispatcher,"withdrawal_notice",'seller withdrawal renderer missing');

must(tradeHtml,'trade-orders.js?v=1.6','withdrawal order UI cache revision missing');
must(tradeHtml,'trade-offer-details.js?v=2.0','negotiated contract UI cache revision missing');
must(tradeHtml,'trade-checkout.js?v=2.0','fixed contract UI cache revision missing');

console.log('PASS: lawyer-approved contract timing, buyer classification and two-step withdrawal stay wired without automatic refund/cancel');
