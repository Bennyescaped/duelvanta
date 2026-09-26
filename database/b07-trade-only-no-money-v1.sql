-- DUELVANTA B07: pure trade listings never carry a purchase price or price offer.
-- Staging/review migration only. No production activation.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

-- Existing staging rows were verified compliant before adding this invariant.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='market_listings_trade_only_no_money_ck'
      and conrelid='public.market_listings'::regclass
  ) then
    alter table public.market_listings
      add constraint market_listings_trade_only_no_money_ck
      check (
        listing_type <> 'trade'
        or (
          asking_price is null
          and pricing_mode = 'negotiable'
          and coalesce(quantity_pricing,'[]'::jsonb) = '[]'::jsonb
        )
      );
  end if;
end
$$;

create or replace function dv_market_private.block_money_offer_for_trade_only_listing()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_listing_type text;
begin
  select l.listing_type into v_listing_type
  from public.market_listings l
  where l.id=new.listing_id;

  if v_listing_type='trade' then
    raise exception 'trade_only_listing_price_offer_forbidden';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.block_money_offer_for_trade_only_listing() from public, anon, authenticated;

drop trigger if exists market_offers_block_trade_only_money on public.market_offers;
create trigger market_offers_block_trade_only_money
before insert or update of listing_id,offer_type,amount on public.market_offers
for each row execute function dv_market_private.block_money_offer_for_trade_only_listing();

notify pgrst,'reload schema';
