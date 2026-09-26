-- DUELVANTA Stripe payment result columns V1.
-- Apply after the base marketplace order schema and before replaying provider events.
-- This patch is additive and does not enable payments, live mode, refunds, messages, or production.

alter table public.market_orders add column if not exists provider_payment_ref text;
alter table public.market_orders add column if not exists paid_at timestamptz;
alter table public.market_orders add column if not exists platform_fee_amount numeric;
alter table public.market_orders add column if not exists seller_net_amount numeric;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='market_orders_platform_fee_nonnegative' and conrelid='public.market_orders'::regclass) then
    alter table public.market_orders add constraint market_orders_platform_fee_nonnegative
      check (platform_fee_amount is null or platform_fee_amount>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='market_orders_seller_net_nonnegative' and conrelid='public.market_orders'::regclass) then
    alter table public.market_orders add constraint market_orders_seller_net_nonnegative
      check (seller_net_amount is null or seller_net_amount>=0);
  end if;
end
$$;
