\set ON_ERROR_STOP on

-- Disposable-CI fixture for the production TRADE hard lock.
-- The main B07 bootstrap already provides anon/authenticated and core marketplace tables.

grant select,insert,update,delete on public.market_listings to authenticated;
grant select,insert,update,delete on public.market_offers to authenticated;
grant select,insert,update,delete on public.market_deals to authenticated;

create table if not exists public.market_orders(
  id uuid primary key default gen_random_uuid()
);
grant select,insert,update,delete on public.market_orders to authenticated;

create table if not exists public.market_listing_images(
  id uuid primary key default gen_random_uuid()
);
grant select,insert,update,delete on public.market_listing_images to authenticated;

create table if not exists public.market_seller_stats(
  seller_id uuid primary key
);
grant select,insert,update,delete on public.market_seller_stats to authenticated;

create or replace function public.buy_market_listing_v99(p_listing_id uuid)
returns void language sql as $$select$$;
create or replace function public.create_market_offer_v99(p_listing_id uuid)
returns void language sql as $$select$$;
create or replace function public.edit_my_market_listing_v99(p_listing_id uuid)
returns void language sql as $$select$$;
create or replace function public.respond_to_market_offer(p_offer_id uuid,p_action text)
returns void language sql as $$select$$;
create or replace function public.confirm_market_order_received(p_order_id uuid)
returns void language sql as $$select$$;
create or replace function public.get_my_market_orders()
returns setof uuid language sql stable as $$select null::uuid where false$$;

grant execute on function public.buy_market_listing_v99(uuid) to authenticated;
grant execute on function public.create_market_offer_v99(uuid) to authenticated;
grant execute on function public.edit_my_market_listing_v99(uuid) to authenticated;
grant execute on function public.respond_to_market_offer(uuid,text) to authenticated;
grant execute on function public.confirm_market_order_received(uuid) to authenticated;
grant execute on function public.get_my_market_orders() to authenticated;
