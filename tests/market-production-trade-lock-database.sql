\set ON_ERROR_STOP on

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public.market_listings',
    'public.market_offers',
    'public.market_deals',
    'public.market_orders',
    'public.market_listing_images',
    'public.market_seller_stats'
  ] loop
    if has_table_privilege('authenticated',v_table,'INSERT')
       or has_table_privilege('authenticated',v_table,'UPDATE')
       or has_table_privilege('authenticated',v_table,'DELETE') then
      raise exception 'production_trade_lock_failed_table:%',v_table;
    end if;
    if not has_table_privilege('authenticated',v_table,'SELECT') then
      raise exception 'production_trade_lock_removed_read:%',v_table;
    end if;
  end loop;

  if has_function_privilege('authenticated','public.buy_market_listing_v99(uuid)','EXECUTE') then
    raise exception 'production_trade_lock_failed_buy';
  end if;
  if has_function_privilege('authenticated','public.create_market_offer_v99(uuid)','EXECUTE') then
    raise exception 'production_trade_lock_failed_offer';
  end if;
  if has_function_privilege('authenticated','public.edit_my_market_listing_v99(uuid)','EXECUTE') then
    raise exception 'production_trade_lock_failed_listing_edit';
  end if;
  if has_function_privilege('authenticated','public.respond_to_market_offer(uuid,text)','EXECUTE') then
    raise exception 'production_trade_lock_failed_offer_response';
  end if;

  -- Existing-transaction completion and read paths intentionally remain usable.
  if not has_function_privilege('authenticated','public.confirm_market_order_received(uuid)','EXECUTE') then
    raise exception 'production_trade_lock_stranded_existing_order';
  end if;
  if not has_function_privilege('authenticated','public.get_my_market_orders()','EXECUTE') then
    raise exception 'production_trade_lock_removed_order_read';
  end if;
end
$$;

select 'PASS: production TRADE hard lock blocks new commerce entry points without stranding existing order/read lifecycles' as result;
