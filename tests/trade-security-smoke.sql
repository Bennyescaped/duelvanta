-- Read-only production smoke checks. No test users, impersonation or purchase rows.
begin read only;
do $$
declare f text; call_sql text; blocked boolean;
begin
  if auth.uid() is not null then raise exception 'Run without an end-user JWT'; end if;
  foreach f in array array[
    'public.buy_market_listing_v2(uuid,integer,uuid,timestamp with time zone)',
    'public.get_my_market_offers_v2()',
    'public.confirm_market_order_received(uuid)',
    'public.create_market_offer_v2(uuid,integer,numeric,text)',
    'public.get_my_market_notifications(integer)',
    'public.get_my_trade_actions()',
    'public.mark_market_notification_read(uuid)',
    'public.mark_all_market_notifications_read()',
    'public.get_my_default_shipping_address()',
    'public.upsert_my_default_shipping_address(text,text,text,text,text,text)',
    'public.delete_my_default_shipping_address()',
    'public.get_my_market_shipping_profiles()',
    'public.upsert_my_market_shipping_profile(uuid,text,text,text,text,text,boolean,jsonb)',
    'public.delete_my_market_shipping_profile(uuid)'
  ] loop
    if has_function_privilege('anon',f,'execute') or not has_function_privilege('authenticated',f,'execute') then raise exception 'Unexpected API privileges: %',f; end if;
  end loop;
  foreach f in array array[
    'public.buy_market_listing_v1(uuid,integer)','public.recalculate_market_order(uuid)','public.attach_market_deal_to_order()',
    'public.emit_market_offer_notification()','public.emit_market_purchase_notification()','public.emit_market_order_status_notification()',
    'public.link_offer_notification_to_order()','public.seed_market_order_default_shipping_address()',
    'public.sync_market_order_address_to_default()','public.recalc_market_order_after_address_change()',
    'public.validate_market_shipping_profile_rule()'
  ] loop
    if has_function_privilege('anon',f,'execute') or has_function_privilege('authenticated',f,'execute') then raise exception 'Internal helper exposed: %',f; end if;
  end loop;
  if exists(select 1 from pg_class where oid in (
    'public.market_listings'::regclass,'public.market_offers'::regclass,'public.market_deals'::regclass,'public.market_orders'::regclass,
    'public.market_order_items'::regclass,'public.market_notifications'::regclass,'public.market_default_shipping_addresses'::regclass,
    'public.market_shipping_profiles'::regclass,'public.market_shipping_profile_rules'::regclass
  ) and not relrowsecurity) then raise exception 'Marketplace RLS disabled'; end if;
  foreach f in array array['public.market_notifications','public.market_default_shipping_addresses','public.market_shipping_profiles','public.market_shipping_profile_rules'] loop
    if has_table_privilege('anon',f,'select') or has_table_privilege('anon',f,'insert') or has_table_privilege('anon',f,'update') or has_table_privilege('anon',f,'delete')
       or has_table_privilege('authenticated',f,'select') or has_table_privilege('authenticated',f,'insert') or has_table_privilege('authenticated',f,'update') or has_table_privilege('authenticated',f,'delete') then raise exception 'Sensitive table must remain RPC-only: %',f; end if;
  end loop;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('street_line1','street_line2','postal_code','city','country_code','shipping_address')) then raise exception 'Private shipping address leaked into public profile table'; end if;
  if (select count(*) from storage.buckets where id in ('collection-cards','market-listing-images') and not public)<>2 then raise exception 'Expected private buckets missing or public'; end if;
  foreach call_sql in array array[
    'select public.buy_market_listing_v2(null,1,null,now())','select public.create_market_offer_v2(null,1,1,null)',
    'select public.confirm_market_order_received(null)','select public.confirm_market_order_complete(null)',
    'select public.begin_market_deal(null)','select public.cancel_market_deal(null,null)','select public.open_market_deal_dispute(null,null)',
    'select public.get_my_market_notifications(5)','select public.get_my_trade_actions()','select public.mark_market_notification_read(null)',
    'select public.mark_all_market_notifications_read()','select public.get_my_default_shipping_address()',
    'select public.delete_my_default_shipping_address()','select public.get_my_market_shipping_profiles()',
    'select public.delete_my_market_shipping_profile(null)'
  ] loop
    blocked:=false;
    begin execute call_sql; exception when raise_exception then if sqlerrm='Nicht angemeldet' then blocked:=true; else raise; end if; end;
    if not blocked then raise exception 'Missing authentication guard: %',call_sql; end if;
  end loop;
  if public.get_my_market_offers_v2()<>'[]'::jsonb then raise exception 'Unauthenticated offers leaked'; end if;
  if exists(select 1 from public.market_listings where quantity_available<0 or quantity_available>stock_quantity) then raise exception 'Invalid inventory'; end if;
  if exists(select 1 from public.market_deals where checkout_request_id is not null group by buyer_id,checkout_request_id having count(*)>1) then raise exception 'Duplicate checkout request'; end if;
  if exists(select 1 from public.market_shipping_profile_rules where max_units is null and max_weight_grams is null) then raise exception 'Unsafe empty shipping rule'; end if;
  if exists(
    select 1 from public.market_shipping_profile_rules r join public.market_shipping_profiles p on p.id=r.profile_id
    where p.product_scope in ('all','sealed') and (r.max_units is null or r.max_weight_grams is null)
  ) then raise exception 'Unsafe Sealed/All shipping rule'; end if;
end $$;
rollback;
select 'PASS: checkout, automation, private addresses, shipping profiles, sealed rule safety, RLS, auth guards and inventory invariants' as smoke_result;
