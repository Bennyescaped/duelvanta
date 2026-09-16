// Static regression for order cancellation, problem cases, B07 lifecycle and private C2C swap preparation.
// No network, no Supabase connection and no user data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../database/trade-order-resolution-v1.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../database/trade-order-resolution-v1-hardening.sql',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('../database/b07-l07-01-order-lifecycle-v1.sql',import.meta.url),'utf8');
const lifecycleHardening=await readFile(new URL('../database/b07-l07-01-order-lifecycle-v1-hardening.sql',import.meta.url),'utf8');
const swapMigration=[
  await readFile(new URL('../database/b07-l07-01-c2c-swap-v1-schema.sql',import.meta.url),'utf8'),
  await readFile(new URL('../database/b07-l07-01-c2c-swap-v1-binding.sql',import.meta.url),'utf8'),
  await readFile(new URL('../database/b07-l07-01-c2c-swap-v1-fulfillment.sql',import.meta.url),'utf8')
].join('\n');
const ui=await readFile(new URL('../trade-order-resolution.js',import.meta.url),'utf8');
const lifecycleUi=await readFile(new URL('../trade-b07-order-lifecycle.js',import.meta.url),'utf8');
const trackingServer=await readFile(new URL('../market-tracking-aftership.js',import.meta.url),'utf8');
const swapUi=await readFile(new URL('../trade-c2c-swap.js',import.meta.url),'utf8');
const mock=await readFile(new URL('./trade-ui-mock.js',import.meta.url),'utf8');
const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const must=(source,needle,label)=>assert.ok(source.includes(needle),label+': '+needle);
const mustNot=(source,needle,label)=>assert.ok(!source.includes(needle),label+': '+needle);

must(migration,'create table if not exists public.market_order_cases','order case table missing');
must(migration,'alter table public.market_order_cases enable row level security','order case RLS missing');
must(migration,'revoke all on table public.market_order_cases from public, anon, authenticated','order cases must stay RPC-only');
for(const rpc of ['get_my_market_order_cases','request_market_order_cancellation','respond_market_order_cancellation','withdraw_market_order_cancellation','open_market_order_problem_v2','withdraw_market_order_problem'])must(migration,`grant execute on function public.${rpc}`,'authenticated resolution RPC missing');
must(hardening,'grant execute on function public.respond_market_order_problem','problem response RPC missing');
must(migration,'revoke all on function public.finalize_market_order_cancellation','cancellation finalizer must be internal');
must(migration,"case when l.status='reserved' then 'active' else l.status end",'cancelled inventory must not reactivate paused/withdrawn listings');
must(migration,'quantity_available=least(l.stock_quantity,l.quantity_available+r.qty)','inventory restoration bound missing');
must(migration,"c.case_type='cancellation' and c.status in ('open','accepted_refund_pending')",'shipping cancellation guard missing');
must(migration,"refund_status=case when payment_provider='manual_beta' then 'external_payment_unknown'",'manual beta refund truthfulness missing');
must(migration,"status='accepted_refund_pending'",'provider refund preparation missing');
must(migration,"if o.shipped_at is null or o.status not in ('shipped','received')",'problem-vs-cancellation phase separation missing');
for(const kind of ['cancellation_requested','cancellation_accepted','cancellation_declined','cancellation_withdrawn','problem_opened','problem_withdrawn'])must(migration,`'${kind}'`,'resolution notification kind missing');
must(hardening,"'problem_response'",'problem response notification missing');
must(hardening,"'STORNO PRÜFEN'",'cancellation required action missing');
must(hardening,"'PROBLEM PRÜFEN'",'problem required action missing');
for(const rpc of ['request_market_order_cancellation','respond_market_order_cancellation','withdraw_market_order_cancellation','open_market_order_problem_v2','respond_market_order_problem','withdraw_market_order_problem'])must(ui,`db.rpc('${rpc}'`,'resolution UI RPC wiring missing');
assert.ok(!ui.includes('createClient('),'resolution module must reuse the existing Supabase client');
assert.ok(!ui.includes('In der aktuellen Beta verarbeitet DUELVANTA keine Zahlung'),'resolution UI must not deny integrated provider payments');
assert.ok(!ui.includes('bis eine spätere sichere Zahlungsintegration'),'resolution UI must describe the existing provider refund path');
must(ui,'bestehende Provider-Erstattung','provider refund status copy missing');
must(ui,'bestehende serverseitige Refundpfad','cancellation provider path copy missing');
must(ui,'Er löst selbst <b>keine Erstattung</b> aus.','problem flow must not promise an automatic refund');
must(html,'trade-order-resolution.js?v=1.1','resolution module cache version not updated');

must(lifecycle,"o.subtotal>25 or o.risk_tracking_required",'B07 25 EUR tracking threshold missing');
must(lifecycle,"b07_add_workdays_de(now(),3)",'B07 3-workday shipping deadline missing');
must(lifecycle,"v_at+interval '72 hours'",'B07 72-hour delivery window missing');
must(lifecycle,"now()+interval '7 days'",'B07 case evidence deadline missing');
must(lifecycle,"c2c_untracked_not_received_wait_14_days",'B07 C2C untracked wait missing');
must(lifecycleHardening,"case when s.contract_classification is not null then s.contract_classification='c2c' else a.seller_type='private' end",'legacy C2C fallback missing');
must(lifecycle,'create_market_pickup_handover_code_b07','pickup handover code missing');
must(lifecycleHardening,'pickup_code_attempt_limit','pickup brute-force guard missing');
must(lifecycle,'grant execute on function public.advance_market_order_lifecycle_b07() to service_role','72h lifecycle advance must remain server only');
must(lifecycleHardening,"received_at=case when p_reason in ('buyer_received_ok','pickup_bilateral_handover')",'72h technical completion must not fake buyer receipt');
must(lifecycleUi,'function mutationAddsOrderCard(mutation)','lifecycle render-loop guard missing');
must(lifecycleUi,'if(!mutations.some(mutationAddsOrderCard))return;','lifecycle observer must ignore own decoration mutations');
assert.ok(!lifecycleUi.includes('new MutationObserver(()=>{clearTimeout'),'old recursive lifecycle observer must not return');
must(lifecycleUi,"fetch('/api/tracking/register'",'seller shipping must register trackable orders through server boundary');
must(lifecycleUi,'db.auth.getSession()','tracking registration must authenticate the seller session');
must(lifecycleUi,'Carrier-Status „Zugestellt“','UI must explain the carrier-driven 72h start');
must(lifecycleUi,"version:'1.2'",'B07 lifecycle tracking version mismatch');
mustNot(lifecycleUi,'AFTERSHIP_API_KEY','browser must never contain AfterShip credentials');
must(html,'trade-b07-order-lifecycle.js?v=1.0','B07 lifecycle module missing');

must(trackingServer,"process.env.VERCEL_ENV!=='preview'",'tracking provider must stay preview-only');
must(trackingServer,"MARKET_TRACKING_ENABLED!=='true'",'tracking provider must be default-off');
must(trackingServer,"https://api.aftership.com/tracking/2026-07",'current AfterShip API version missing');
must(trackingServer,"'as-api-key':apiKey",'AfterShip API key must remain server-side');
must(trackingServer,"aftership-hmac-sha256",'AfterShip webhook HMAC verification missing');
must(trackingServer,"x-duelvanta-tracking-secret",'secondary webhook secret missing');
must(trackingServer,"cp?.tag==='Delivered'&&cp?.source==='carrier'",'only carrier-sourced Delivered checkpoints may start 72h');
must(trackingServer,"record_market_order_delivery_evidence_b07",'tracking webhook must feed existing server-only delivery evidence RPC');
mustNot(trackingServer,'recipient_name','tracking provider payload must not include recipient identity');
mustNot(trackingServer,'street_line','tracking provider payload must not include address data');

for(const table of ['market_swap_threads','market_swap_revisions','market_swap_revision_items','market_swap_confirmations','market_swap_reservations','market_swap_value_snapshots','market_swap_shipping_addresses','market_swap_fulfillments'])must(swapMigration,`dv_market_private.${table}`,'private C2C swap table missing');
must(swapMigration,'alter table dv_market_private.market_swap_threads enable row level security','C2C private-table RLS defense missing');
must(swapMigration,'revoke all on table dv_market_private.market_swap_value_snapshots from public,anon,authenticated','C2C value snapshots must stay RPC-only');
must(swapMigration,"v_account.seller_type<>'private'",'C2C must reject trader accounts');
must(swapMigration,"v_account.onboarding_status<>'active'",'C2C must require active private onboarding');
must(swapMigration,"v_account.country_code<>'DE'",'C2C Germany-only guard missing');
must(swapMigration,'perform dv_market_private.require_trade_eligibility(p_user_id,false)','C2C 18+/DE eligibility guard missing');
must(swapMigration,"v_thread.current_revision_id<>p_revision_id",'only current C2C revision may be confirmed');
must(swapMigration,'content_sha256=v_revision.content_sha256','C2C confirmation must bind exact revision hash');
must(swapMigration,'if v_confirmations<2 then','one-sided C2C confirmation must stay non-binding');
must(swapMigration,"set status='bound'",'bilateral C2C binding transition missing');
must(swapMigration,'v_due_at:=dv_market_private.b07_add_workdays_de(v_bound_at,3)','C2C 3-workday deadline must start at binding');
must(swapMigration,"valuation_method text not null default 'sum_listing_market_price_snapshots'",'C2C reference valuation method missing');
must(swapMigration,"psttg_evaluation_status text not null default 'external_review_required'",'C2C tax review gate missing');
must(swapMigration,'psttg_event_created_by_b07 boolean not null default false check (psttg_event_created_by_b07=false)','C2C PStTG activation must remain impossible in B07');
must(swapMigration,"(v_reference is null or v_reference>25)",'unknown/>25 C2C reference value must require tracking');
must(swapMigration,"raise exception 'tracking_required_for_swap'",'C2C tracking enforcement missing');
must(swapMigration,"raise exception 'swap_shipping_address_required'",'C2C binding must require a German shipping address for both parties');
must(swapMigration,"'ship_to',case when f.sender_id=v_uid",'C2C destination address must only be returned to the sender that needs it');
must(swapMigration,"v_item.updated_at is distinct from (v_item.item_snapshot->>'listing_updated_at')::timestamptz",'changed listings must force a new C2C revision before binding');
must(swapMigration,"raise exception 'bound_swap_cannot_be_unilaterally_closed'",'bound C2C swap must not be unilaterally cancelled');
must(swapMigration,'market_swap_evidence_is_immutable','C2C immutable evidence guard missing');
mustNot(swapMigration,'insert into dv_market_private.market_tax_events','B07 C2C must not create tax ledger events');
mustNot(swapMigration,'record_market_tax_remuneration(','B07 C2C must not book tax remuneration');
mustNot(swapMigration,'platform_fee_collected','B07 C2C must not introduce swap fees');
for(const rpc of ['create_market_swap_proposal_v1','propose_market_swap_revision_v1','confirm_market_swap_revision_v1','close_market_swap_thread_v1','mark_market_swap_shipped_v1','confirm_market_swap_received_v1','get_my_market_swaps_v1'])must(swapUi,`'${rpc}'`,'C2C UI RPC action name missing');
must(swapUi,'db.rpc(name,args)','central C2C action wrapper RPC call missing');
must(swapUi,'TAUSCH VORSCHLAGEN','C2C market CTA missing');
must(swapUi,'FINALEN TAUSCHSTAND BESTÄTIGEN','explicit final C2C confirmation missing');
must(swapUi,'GEGENVORSCHLAG / ÄNDERN','C2C revision flow missing');
must(swapUi,'Keine steuerliche Einordnung; PStTG-Zählung ist hier nicht aktiviert.','C2C reference-value disclaimer missing');
must(swapUi,'An: ${esc(my.ship_to.recipient_name)}','C2C sender must receive the bound destination address');
mustNot(swapUi,'MutationObserver','C2C UI must not add recursive DOM refresh observers');
assert.doesNotThrow(()=>new Function(swapUi),'C2C UI syntax invalid');
must(html,'trade-c2c-swap.js?v=1.0','C2C module missing');
assert.ok(html.indexOf('trade-c2c-swap.js?v=1.0')<html.indexOf('trade-v2.js?v=2.1'),'C2C decorator must load before legacy deal capture');
must(mock,"name==='get_my_market_trade_eligibility'",'browser fixture must explicitly satisfy B07 eligibility');
must(mock,"name==='get_my_market_swaps_v1'",'browser fixture must isolate C2C RPC');

console.log('PASS: order resolution plus B07 carrier tracking/deadlines/pickup and private C2C revision/value-snapshot flow');
