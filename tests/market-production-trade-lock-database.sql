\set ON_ERROR_STOP on
-- Catalog assertions accompany real RPC/lifecycle tests in production-trade-lock-checks.mjs.
do $$
declare t text; f record;
begin
  foreach t in array array['market_listings','market_offers','market_deals','market_orders','market_order_items','market_listing_images','market_seller_stats'] loop
    if has_table_privilege('authenticated','public.'||t,'INSERT') or has_table_privilege('authenticated','public.'||t,'UPDATE') or has_table_privilege('authenticated','public.'||t,'DELETE') then
      raise exception 'production_trade_lock_failed_table:%',t;
    end if;
  end loop;
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname ~ '^(buy_market_listing(_v[0-9]+)?|create_market_offer(_v[0-9]+)?|create_sealed_market_listing_draft(_v[0-9]+)?|publish_my_sealed_market_listing|renew_my_market_listing)$'
  loop
    if has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') or has_function_privilege('service_role',f.oid,'EXECUTE') then
      raise exception 'production_trade_lock_failed_rpc:%',f.proname;
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.confirm_market_order_received(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.get_my_market_orders()','EXECUTE')
     or not has_function_privilege('authenticated','public.withdraw_my_market_offer(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.finish_my_market_listing(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.prepare_market_stripe_full_refund(uuid,uuid,text)','EXECUTE') then
    raise exception 'production_trade_lock_stranded_existing_work';
  end if;
end$$;
