// Static contract regression for the production TRADE automation module and SQL.
// No network, no Supabase connection and no user data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const automation=await readFile(new URL('../trade-automation.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../database/trade-automation-v1.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../database/trade-automation-v1-hardening.sql',import.meta.url),'utf8');

const must=(source,needle,label)=>assert.ok(source.includes(needle),label+': '+needle);

for(const kind of ['purchase','offer_received','offer_accepted','order_shipped','order_received'])must(migration,`'${kind}'`,'notification kind missing');
for(const type of ['offer_review','add_address','shipping_quote','ship_order','confirm_received'])must(migration,`'${type}'`,'required-action type missing');
for(const trigger of ['trg_market_offer_notifications','trg_market_purchase_notification','trg_market_order_status_notifications'])must(migration,trigger,'notification trigger missing');
must(hardening,'trg_link_offer_notification_to_order','accepted-offer order-link trigger missing');
must(migration,'revoke all on table public.market_notifications from public, anon, authenticated','notification table must stay RPC-only');
for(const rpc of ['get_my_market_notifications','get_my_trade_actions','mark_market_notification_read','mark_all_market_notifications_read']){
  must(migration,`grant execute on function public.${rpc}`,'authenticated RPC grant missing');
  must(automation,`db.rpc('${rpc}'`,'frontend RPC wiring missing');
}
for(const fn of ['emit_market_offer_notification','emit_market_purchase_notification','emit_market_order_status_notification','link_offer_notification_to_order']){
  const source=fn==='link_offer_notification_to_order'?hardening:migration;
  must(source,`revoke all on function public.${fn}`,'internal trigger function must not be client-callable');
}
for(const fn of ['emit_market_offer_notification','emit_market_purchase_notification','emit_market_order_status_notification','get_my_market_notifications','mark_market_notification_read','mark_all_market_notifications_read','get_my_trade_actions','link_offer_notification_to_order'])must(hardening,`alter function public.${fn}`,'hardening missing function');
must(hardening,"set search_path = ''",'SECURITY DEFINER search_path hardening missing');
must(automation,"if(item?.order_id)return openOrder(item.order_id)",'notification/action should prefer direct order routing');
must(automation,"if(item?.offer_id)return openOffer()",'offer fallback routing missing');
assert.ok(!automation.includes('createClient('),'automation module must reuse the existing Supabase client');

console.log('PASS: TRADE automation contract, RPC wiring, event coverage, order routing and hardening');
