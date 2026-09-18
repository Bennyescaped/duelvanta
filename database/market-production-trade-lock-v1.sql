-- DUELVANTA production TRADE hard lock V1.
-- PRODUCTION RELEASE MIGRATION ONLY. DO NOT APPLY TO STAGING/PREVIEW.
-- Apply LAST after the Marketplace schema/functions for a beta release where TRADE
-- must remain closed. This blocks creation/negotiation/purchase entry points while
-- preserving existing order/problem/receipt lifecycles, data rights and admin/service work.
--
-- Reopening TRADE requires an explicit later reviewed unlock migration. Do not grant
-- these privileges ad hoc.

begin;

-- Browser roles must not bypass the UI lock through direct table writes.
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
    if to_regclass(v_table) is not null then
      if exists(select 1 from pg_roles where rolname='anon') then
        execute format('revoke insert, update, delete on table %s from anon',v_table);
      end if;
      if exists(select 1 from pg_roles where rolname='authenticated') then
        execute format('revoke insert, update, delete on table %s from authenticated',v_table);
      end if;
    end if;
  end loop;
end
$$;

-- Block only entry points that can create or negotiate new Marketplace commerce.
-- Existing orders may still be shipped, received, disputed/cancelled and completed so
-- a lock never strands an already existing transaction.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname ~ '^(add_my_market_listing_image|buy_market_listing(_v[0-9]+)?|checkout_accepted_market_offer(_v[0-9]+)?|create_market_offer(_v[0-9]+)?|create_sealed_market_listing_draft(_v[0-9]+)?|delete_my_sealed_market_listing_draft|edit_my_market_listing(_v[0-9]+)?|edit_my_sealed_market_listing(_v[0-9]+)?|finish_my_market_listing|publish_my_sealed_market_listing|register_my_market_listing_image|remove_my_market_listing_image|renew_my_market_listing|respond_to_market_offer|withdraw_my_market_offer)$'
  loop
    execute format('revoke all on function %s from public',f.signature);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on function %s from anon',f.signature);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on function %s from authenticated',f.signature);
    end if;
  end loop;
end
$$;

commit;
