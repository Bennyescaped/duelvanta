-- DUELVANTA B07 / L07-01 safe alignment: Release-1 eligibility, DE-only and anti-circumvention.
-- REVIEW/STAGING MIGRATION ONLY. Do not apply to production from this branch.
-- No payment, payout, refund, fee or legal-terms activation is performed here.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.trade_user_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date not null,
  residence_country_code text not null check (residence_country_code = 'DE'),
  private_buyer_confirmed boolean not null default false,
  confirmed_at timestamptz not null default now(),
  buyer_confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (date_of_birth >= date '1900-01-01')
);

revoke all on table dv_market_private.trade_user_eligibility from public, anon, authenticated;

-- Existing German seller onboarding already contains an adult DOB. Reuse that protected
-- evidence for general TRADE eligibility, but never infer the separate private-buyer declaration.
insert into dv_market_private.trade_user_eligibility(
  user_id,date_of_birth,residence_country_code,private_buyer_confirmed,confirmed_at,buyer_confirmed_at,updated_at
)
select p.seller_id,p.date_of_birth,'DE',false,coalesce(a.terms_accepted_at,a.created_at,now()),null,now()
from dv_market_private.seller_legal_profiles p
join public.market_seller_accounts a on a.seller_id=p.seller_id
where p.country_code='DE'
  and p.date_of_birth <= current_date - interval '18 years'
  and p.date_of_birth >= current_date - interval '120 years'
on conflict(user_id) do nothing;

create or replace function public.get_my_market_trade_eligibility()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_row dv_market_private.trade_user_eligibility%rowtype;
  v_adult boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from dv_market_private.trade_user_eligibility where user_id=v_uid;
  if v_row.user_id is not null then
    v_adult := v_row.date_of_birth <= current_date - interval '18 years'
      and v_row.date_of_birth >= current_date - interval '120 years';
  end if;
  return jsonb_build_object(
    'eligible',coalesce(v_adult and v_row.residence_country_code='DE',false),
    'buyer_eligible',coalesce(v_adult and v_row.residence_country_code='DE' and v_row.private_buyer_confirmed,false),
    'residence_country_code',v_row.residence_country_code,
    'private_buyer_confirmed',coalesce(v_row.private_buyer_confirmed,false),
    'confirmed_at',v_row.confirmed_at,
    'buyer_confirmed_at',v_row.buyer_confirmed_at
  );
end
$$;
revoke all on function public.get_my_market_trade_eligibility() from public, anon;
grant execute on function public.get_my_market_trade_eligibility() to authenticated;

create or replace function public.confirm_my_market_trade_eligibility(
  p_date_of_birth date,
  p_residence_country_code text,
  p_confirm_private_buyer boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_country text := upper(trim(coalesce(p_residence_country_code,'')));
  v_buyer boolean := coalesce(p_confirm_private_buyer,false);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_date_of_birth is null
     or p_date_of_birth > current_date - interval '18 years'
     or p_date_of_birth < current_date - interval '120 years' then
    raise exception 'trade_must_be_adult';
  end if;
  if v_country <> 'DE' then raise exception 'trade_release1_germany_only'; end if;

  insert into dv_market_private.trade_user_eligibility(
    user_id,date_of_birth,residence_country_code,private_buyer_confirmed,confirmed_at,buyer_confirmed_at,updated_at
  ) values(v_uid,p_date_of_birth,'DE',v_buyer,now(),case when v_buyer then now() else null end,now())
  on conflict(user_id) do update set
    date_of_birth=excluded.date_of_birth,
    residence_country_code='DE',
    private_buyer_confirmed=dv_market_private.trade_user_eligibility.private_buyer_confirmed or excluded.private_buyer_confirmed,
    buyer_confirmed_at=case
      when dv_market_private.trade_user_eligibility.private_buyer_confirmed then dv_market_private.trade_user_eligibility.buyer_confirmed_at
      when excluded.private_buyer_confirmed then now()
      else null
    end,
    updated_at=now();

  return public.get_my_market_trade_eligibility();
end
$$;
revoke all on function public.confirm_my_market_trade_eligibility(date,text,boolean) from public, anon;
grant execute on function public.confirm_my_market_trade_eligibility(date,text,boolean) to authenticated;

create or replace function public.confirm_my_market_private_buyer()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform dv_market_private.require_trade_eligibility(v_uid,false);
  update dv_market_private.trade_user_eligibility
  set private_buyer_confirmed=true,
      buyer_confirmed_at=coalesce(buyer_confirmed_at,now()),
      updated_at=now()
  where user_id=v_uid;
  return public.get_my_market_trade_eligibility();
end
$$;
revoke all on function public.confirm_my_market_private_buyer() from public, anon;
grant execute on function public.confirm_my_market_private_buyer() to authenticated;

create or replace function dv_market_private.require_trade_eligibility(
  p_user_id uuid,
  p_require_private_buyer boolean default false
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_row dv_market_private.trade_user_eligibility%rowtype;
begin
  if p_user_id is null then raise exception 'trade_user_missing'; end if;
  select * into v_row from dv_market_private.trade_user_eligibility where user_id=p_user_id;
  if v_row.user_id is null
     or v_row.residence_country_code <> 'DE'
     or v_row.date_of_birth > current_date - interval '18 years'
     or v_row.date_of_birth < current_date - interval '120 years' then
    raise exception 'trade_eligibility_required';
  end if;
  if p_require_private_buyer and not v_row.private_buyer_confirmed then
    raise exception 'buyer_private_consumer_required';
  end if;
end
$$;
revoke all on function dv_market_private.require_trade_eligibility(uuid,boolean) from public, anon, authenticated;

create or replace function dv_market_private.guard_de_country()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  if upper(coalesce(new.country_code,'')) <> 'DE' then
    raise exception 'release1_germany_only';
  end if;
  new.country_code := 'DE';
  return new;
end
$$;
revoke all on function dv_market_private.guard_de_country() from public, anon, authenticated;

drop trigger if exists b07_guard_seller_country on public.market_seller_accounts;
create trigger b07_guard_seller_country
before insert or update of country_code on public.market_seller_accounts
for each row when (new.country_code is not null)
execute function dv_market_private.guard_de_country();

drop trigger if exists b07_guard_seller_legal_country on dv_market_private.seller_legal_profiles;
create trigger b07_guard_seller_legal_country
before insert or update of country_code on dv_market_private.seller_legal_profiles
for each row execute function dv_market_private.guard_de_country();

drop trigger if exists b07_guard_default_shipping_country on public.market_default_shipping_addresses;
create trigger b07_guard_default_shipping_country
before insert or update of country_code on public.market_default_shipping_addresses
for each row execute function dv_market_private.guard_de_country();

drop trigger if exists b07_guard_order_shipping_country on public.market_order_shipping_addresses;
create trigger b07_guard_order_shipping_country
before insert or update of country_code on public.market_order_shipping_addresses
for each row execute function dv_market_private.guard_de_country();

create or replace function dv_market_private.public_text_is_forbidden(p_text text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case when nullif(trim(coalesce(p_text,'')),'') is null then false else
    p_text ~* '(https?://|www\.)'
    or p_text ~* '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}'
    or p_text ~* '(paypal[[:space:]-]*(friends|freunde)?|iban|bank[[:space:]-]*überweisung|revolut|wise|krypto|crypto|telegram|whatsapp)'
    or p_text ~* '(telefon|handy|mobil|ruf[[:space:]]+mich|call[[:space:]]+me)[^0-9+]{0,12}[+0-9][0-9 /().\-]{6,}'
  end
$$;
revoke all on function dv_market_private.public_text_is_forbidden(text) from public, anon, authenticated;

create or replace function dv_market_private.guard_market_listing_b07()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  if new.status in ('active','reserved') then
    perform dv_market_private.require_trade_eligibility(new.seller_id,false);
  end if;
  if dv_market_private.public_text_is_forbidden(new.seller_note)
     or dv_market_private.public_text_is_forbidden(new.shipping_note) then
    raise exception 'contact_or_external_payment_data_not_allowed';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.guard_market_listing_b07() from public, anon, authenticated;

drop trigger if exists b07_guard_market_listing on public.market_listings;
create trigger b07_guard_market_listing
before insert or update of status,seller_note,shipping_note on public.market_listings
for each row execute function dv_market_private.guard_market_listing_b07();

create or replace function dv_market_private.guard_market_offer_b07()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  perform dv_market_private.require_trade_eligibility(new.buyer_id,true);
  perform dv_market_private.require_trade_eligibility(new.seller_id,false);
  if dv_market_private.public_text_is_forbidden(new.message) then
    raise exception 'contact_or_external_payment_data_not_allowed';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.guard_market_offer_b07() from public, anon, authenticated;

drop trigger if exists b07_guard_market_offer on public.market_offers;
create trigger b07_guard_market_offer
before insert or update of buyer_id,seller_id,message on public.market_offers
for each row execute function dv_market_private.guard_market_offer_b07();

create or replace function dv_market_private.guard_market_deal_eligibility_b07()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  perform dv_market_private.require_trade_eligibility(new.buyer_id,true);
  perform dv_market_private.require_trade_eligibility(new.seller_id,false);
  return new;
end
$$;
revoke all on function dv_market_private.guard_market_deal_eligibility_b07() from public, anon, authenticated;

drop trigger if exists b07_guard_market_deal_eligibility on public.market_deals;
create trigger b07_guard_market_deal_eligibility
before insert or update of buyer_id,seller_id on public.market_deals
for each row execute function dv_market_private.guard_market_deal_eligibility_b07();

comment on table dv_market_private.trade_user_eligibility is
  'B07 Release-1 technical eligibility only: registered authenticated user, 18+, DE residence; private-buyer declaration is separate and only required for buying.';
