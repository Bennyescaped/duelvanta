// Static regression for private default addresses + seller shipping profiles.
// No network, no Supabase connection and no user data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../database/trade-shipping-profiles-v1.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../database/trade-shipping-profiles-v1-hardening.sql',import.meta.url),'utf8');
const safety=await readFile(new URL('../database/trade-shipping-profiles-v1-safety.sql',import.meta.url),'utf8');
const trade=await readFile(new URL('../trade-shipping-profiles.js',import.meta.url),'utf8');
const tradeHtml=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const profile=await readFile(new URL('../profile.js',import.meta.url),'utf8');
const profileHtml=await readFile(new URL('../profile.html',import.meta.url),'utf8');

const must=(source,needle,label)=>assert.ok(source.includes(needle),label+': '+needle);
for(const table of ['market_default_shipping_addresses','market_shipping_profiles','market_shipping_profile_rules']){
  must(migration,`alter table public.${table} enable row level security`,'RLS missing');
  must(migration,`revoke all on table public.${table} from public, anon, authenticated`,'direct client table access must stay closed');
}
for(const rpc of ['get_my_default_shipping_address','upsert_my_default_shipping_address','delete_my_default_shipping_address','get_my_market_shipping_profiles','upsert_my_market_shipping_profile','delete_my_market_shipping_profile'])must(migration,`grant execute on function public.${rpc}`,'authenticated RPC missing');
for(const fn of ['seed_market_order_default_shipping_address','sync_market_order_address_to_default','recalc_market_order_after_address_change'])must(migration,`revoke all on function public.${fn}`,'internal trigger exposed');
must(migration,"set search_path = ''",'SECURITY DEFINER search path must be pinned');
must(migration,"shipping_quote_status=case when v_review then 'review_required' else 'auto' end",'safe automatic/manual fallback missing');
must(migration,"p.destination_country_code=v_country",'country-aware tariff matching missing');
must(migration,"r.max_units is null or v_units<=r.max_units",'unit capacity matching missing');
must(migration,"r.max_weight_grams is null",'weight capacity matching missing');
must(hardening,"if tg_op='DELETE'",'address trigger hardening missing');
must(safety,'validate_market_shipping_profile_rule','shipping profile rule safety trigger missing');
must(safety,"v_scope in ('all','sealed')",'sealed/all safety scope missing');
must(safety,'Max. Produkte und Max. Gewicht','sealed/all rules must require units and weight');
must(safety,"exists(select 1 from public.market_order_shipping_addresses",'seller shipping action must wait for buyer address');
must(tradeHtml,'trade-shipping-profiles.js?v=1.1','shipping profile module cache version not loaded');
for(const rpc of ['get_my_market_shipping_profiles','upsert_my_market_shipping_profile','delete_my_market_shipping_profile'])must(trade,`db.rpc('${rpc}'`,'TRADE RPC wiring missing');
must(trade,"scope!=='cards'",'frontend sealed/all safety validation missing');
must(trade,"version:'1.1'",'shipping profile module version mismatch');
assert.ok(!trade.includes('createClient('),'TRADE shipping module must reuse existing Supabase client');
for(const rpc of ['get_my_default_shipping_address','upsert_my_default_shipping_address','delete_my_default_shipping_address'])must(profile,`db.rpc('${rpc}'`,'profile address RPC wiring missing');
must(profileHtml,'Private Standard-Lieferadresse','private address UI missing');
assert.ok(!profileHtml.includes('name="publicShippingAddress"'),'address must not be public-profile metadata');

console.log('PASS: private address + seller shipping profile contract, RLS, RPC isolation, sealed safety and auto/manual fallback');
