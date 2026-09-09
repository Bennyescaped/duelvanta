// Static regression for order cancellation, problem cases and refund preparation.
// No network, no Supabase connection and no user data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../database/trade-order-resolution-v1.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../database/trade-order-resolution-v1-hardening.sql',import.meta.url),'utf8');
const ui=await readFile(new URL('../trade-order-resolution.js',import.meta.url),'utf8');
const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const must=(source,needle,label)=>assert.ok(source.includes(needle),label+': '+needle);

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
must(migration,"status='accepted_refund_pending'",'future provider refund preparation missing');
must(migration,"if o.shipped_at is null or o.status not in ('shipped','received')",'problem-vs-cancellation phase separation missing');
for(const kind of ['cancellation_requested','cancellation_accepted','cancellation_declined','cancellation_withdrawn','problem_opened','problem_withdrawn'])must(migration,`'${kind}'`,'resolution notification kind missing');
must(hardening,"'problem_response'",'problem response notification missing');
must(hardening,"'STORNO PRÜFEN'",'cancellation required action missing');
must(hardening,"'PROBLEM PRÜFEN'",'problem required action missing');
for(const rpc of ['request_market_order_cancellation','respond_market_order_cancellation','withdraw_market_order_cancellation','open_market_order_problem_v2','respond_market_order_problem','withdraw_market_order_problem'])must(ui,`db.rpc('${rpc}'`,'resolution UI RPC wiring missing');
assert.ok(!ui.includes('createClient('),'resolution module must reuse the existing Supabase client');
must(ui,'keine automatische Rückzahlung','UI must not claim automatic refunds');
must(html,'trade-order-resolution.js?v=1.0','resolution module not loaded');

console.log('PASS: order cancellation/problem contract, inventory restoration, refund truthfulness and RPC isolation');
