// Static contract regression for the production TRADE automation module and SQL.
// No network, no Supabase connection and no user data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const automation=await readFile(new URL('../trade-automation.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../database/trade-automation-v1.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../database/trade-automation-v1-hardening.sql',import.meta.url),'utf8');
const notificationV2=await readFile(new URL('../database/trade-notifications-v2.sql',import.meta.url),'utf8');

const must=(source,needle,label)=>assert.ok(source.includes(needle),label+': '+needle);

for(const kind of ['purchase','offer_received','offer_accepted','order_shipped','order_received'])must(migration,`'${kind}'`,'notification kind missing');
for(const kind of ['swap_proposed','swap_revised','swap_confirmed','swap_bound','swap_shipped','swap_received','swap_completed','swap_problem_opened','swap_problem_response','swap_problem_closed','pickup_message'])must(notificationV2,`'${kind}'`,'v2 notification kind missing');
for(const type of ['offer_review','add_address','shipping_quote','ship_order','confirm_received'])must(migration,`'${type}'`,'required-action type missing');
for(const trigger of ['trg_market_offer_notifications','trg_market_purchase_notification','trg_market_order_status_notifications'])must(migration,trigger,'notification trigger missing');
must(hardening,'trg_link_offer_notification_to_order','accepted-offer order-link trigger missing');
must(migration,'revoke all on table public.market_notifications from public, anon, authenticated','notification table must stay RPC-only');
must(notificationV2,'revoke all on table public.market_notifications from public, anon, authenticated','v2 notification table must stay RPC-only');
for(const rpc of ['get_my_market_notifications','get_my_trade_actions','mark_market_notification_read','mark_all_market_notifications_read']){
  must(migration,`grant execute on function public.${rpc}`,'authenticated RPC grant missing');
  must(automation,`db.rpc('${rpc}'`,'frontend RPC wiring missing');
}
must(notificationV2,'grant execute on function public.sync_my_trade_notifications_v2() to authenticated','v2 sync RPC grant missing');
must(automation,"db.rpc('sync_my_trade_notifications_v2'",'v2 sync frontend wiring missing');
must(automation,"db.rpc('get_my_market_swaps_v1'",'swap state wiring missing');
must(automation,"db.rpc('get_my_market_swap_cases_v1'",'swap problem state wiring missing');
for(const fn of ['emit_market_offer_notification','emit_market_purchase_notification','emit_market_order_status_notification','link_offer_notification_to_order']){
  const source=fn==='link_offer_notification_to_order'?hardening:migration;
  must(source,`revoke all on function public.${fn}`,'internal trigger function must not be client-callable');
}
for(const fn of ['emit_market_offer_notification','emit_market_purchase_notification','emit_market_order_status_notification','get_my_market_notifications','mark_market_notification_read','mark_all_market_notifications_read','get_my_trade_actions'])must(hardening,`alter function public.${fn}`,'hardening missing function');
assert.match(hardening,/create or replace function public\.link_offer_notification_to_order\(\)[\s\S]*?security definer\s+set search_path = ''/,'new trigger function must define its safe search path at creation');
assert.match(notificationV2,/create or replace function public\.sync_my_trade_notifications_v2\(\)[\s\S]*?security definer\s+set search_path = ''/,'v2 sync function must define safe search path');
must(hardening,"set search_path = ''",'SECURITY DEFINER search_path hardening missing');
must(automation,"if(item?.order_id)return openOrder(item.order_id)",'notification/action should prefer direct order routing');
must(automation,"if(item?.offer_id)return openOffer()",'offer fallback routing missing');
must(automation,"if(item?.context_type==='swap')return openSwap()",'swap notification routing missing');
must(automation,"if(item?.context_type==='swap_case')return openSwapCase()",'swap problem notification routing missing');
must(automation,"if(item?.context_type==='pickup_order')return openPickup('order',item.context_id)",'order pickup-chat routing missing');
must(automation,"if(item?.context_type==='pickup_swap')return openPickup('swap',item.context_id)",'swap pickup-chat routing missing');
for(const action of ['swap_confirm','swap_ship','swap_receive','swap_pickup_confirm','swap_problem_response'])must(automation,`action_type:'${action}'`,'swap action integration missing');
assert.ok(!automation.includes('createClient('),'automation module must reuse the existing Supabase client');

console.log('PASS: TRADE automation contract, legacy + C2C notification coverage, action routing and hardening');
