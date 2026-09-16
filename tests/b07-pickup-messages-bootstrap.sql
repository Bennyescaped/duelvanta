\set ON_ERROR_STOP on

create table if not exists public.market_orders(
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id),
  buyer_id uuid not null references auth.users(id),
  fulfillment_group text not null,
  status text not null default 'open'
);
