\set ON_ERROR_STOP on

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists dv_market_private;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end
$$;

create table if not exists auth.users(
  id uuid primary key,
  email text
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(auth.jwt()->>'sub','')
  )::uuid
$$;

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;

create table if not exists public.market_seller_accounts(
  seller_id uuid primary key references auth.users(id),
  seller_type text not null,
  onboarding_status text not null,
  country_code text not null
);

create table if not exists public.market_listings(
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id),
  listing_type text not null,
  status text not null default 'active',
  quantity_available integer not null default 1,
  tcg text,
  card_name text,
  set_name text,
  card_number text,
  language text,
  variant text,
  condition text,
  grading_company text,
  grade numeric,
  asking_price numeric(14,2),
  market_price_snapshot numeric(14,2),
  published_at timestamptz default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_default_shipping_addresses(
  user_id uuid primary key references auth.users(id),
  recipient_name text not null,
  street_line1 text not null,
  street_line2 text,
  postal_code text not null,
  city text not null,
  country_code text not null
);

create table if not exists public.market_deals(
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.market_listings(id),
  status text not null default 'accepted'
);

create table if not exists public.market_offers(
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.market_listings(id),
  status text not null default 'pending',
  reservation_expires_at timestamptz
);

create or replace function dv_market_private.require_trade_eligibility(p_user_id uuid,p_require_buyer boolean)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'trade_user_missing';
  end if;
end
$$;

create or replace function dv_market_private.b07_add_workdays_de(p_start timestamptz,p_days integer)
returns timestamptz
language plpgsql
stable
set search_path=pg_catalog
as $$
declare
  v_local timestamp without time zone:=p_start at time zone 'Europe/Berlin';
  v_count integer:=0;
begin
  if p_start is null or p_days is null or p_days<0 then return null;end if;
  while v_count<p_days loop
    v_local:=v_local+interval '1 day';
    if extract(isodow from v_local)<7 then v_count:=v_count+1;end if;
  end loop;
  return v_local at time zone 'Europe/Berlin';
end
$$;
