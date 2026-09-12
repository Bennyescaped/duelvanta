-- DUELVANTA Marketplace seller compliance foundation.
-- REVIEW ONLY: keep outside production until the complete onboarding UI and
-- isolated database regression have been accepted.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists public.market_seller_accounts (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  seller_type text not null default 'unclassified'
    check (seller_type in ('unclassified','private','trader')),
  onboarding_status text not null default 'draft'
    check (onboarding_status in ('legacy_beta','draft','pending_review','active','rejected','suspended')),
  trader_display_name text,
  country_code text,
  terms_version text,
  terms_accepted_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  check (seller_type = 'trader' or trader_display_name is null)
);

comment on table public.market_seller_accounts is
  'Safe seller classification and workflow state. Tax, birth, identity and bank data must never be added here.';

create index if not exists market_seller_accounts_status_idx
  on public.market_seller_accounts(onboarding_status, seller_type);

alter table public.market_seller_accounts enable row level security;
revoke all on table public.market_seller_accounts from public, anon, authenticated;
grant select on table public.market_seller_accounts to authenticated;

drop policy if exists market_seller_accounts_read_safe on public.market_seller_accounts;
create policy market_seller_accounts_read_safe
  on public.market_seller_accounts
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and seller_id = (select auth.uid())
  );

create table if not exists dv_market_private.seller_legal_profiles (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  legal_first_name text,
  legal_last_name text,
  date_of_birth date,
  business_name text,
  legal_form text,
  representative_name text,
  street_line1 text,
  street_line2 text,
  postal_code text,
  city text,
  country_code text,
  public_email text,
  public_phone text,
  register_name text,
  register_number text,
  register_court text,
  tax_residence_country_code text,
  vat_id_present boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  check (tax_residence_country_code is null or tax_residence_country_code ~ '^[A-Z]{2}$')
);

comment on table dv_market_private.seller_legal_profiles is
  'Private onboarding source. Browser roles have no table access. Public trader disclosure is emitted only by a restricted RPC after activation.';

create table if not exists dv_market_private.seller_tax_identifiers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  identifier_kind text not null
    check (identifier_kind in ('tin','vat_id','business_registration')),
  issuing_country_code text not null check (issuing_country_code ~ '^[A-Z]{2}$'),
  identifier_ciphertext bytea not null,
  identifier_hash bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, identifier_kind, issuing_country_code)
);

comment on table dv_market_private.seller_tax_identifiers is
  'Encrypted tax identifiers only. Plaintext identifiers must never be written to this table or exposed to browser roles.';

create index if not exists seller_tax_identifiers_seller_idx
  on dv_market_private.seller_tax_identifiers(seller_id);

create table if not exists dv_market_private.seller_declarations (
  id bigint generated always as identity primary key,
  seller_id uuid not null references auth.users(id) on delete cascade,
  declaration_kind text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (seller_id, declaration_kind, document_version)
);

create index if not exists seller_declarations_seller_idx
  on dv_market_private.seller_declarations(seller_id, declaration_kind, accepted_at desc);

create table if not exists dv_market_private.seller_account_audit (
  id bigint generated always as identity primary key,
  seller_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid,
  old_seller_type text,
  new_seller_type text,
  old_status text,
  new_status text,
  changed_at timestamptz not null default now()
);

create index if not exists seller_account_audit_seller_idx
  on dv_market_private.seller_account_audit(seller_id, changed_at desc);

create table if not exists dv_market_private.marketplace_compliance_policy (
  singleton boolean primary key default true check (singleton),
  seller_onboarding_enforced boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into dv_market_private.marketplace_compliance_policy(singleton, seller_onboarding_enforced)
values (true, false)
on conflict (singleton) do nothing;

revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.audit_market_seller_account()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  insert into dv_market_private.seller_account_audit(
    seller_id, actor_id, old_seller_type, new_seller_type, old_status, new_status
  ) values (
    new.seller_id,
    auth.uid(),
    case when tg_op = 'INSERT' then null else old.seller_type end,
    new.seller_type,
    case when tg_op = 'INSERT' then null else old.onboarding_status end,
    new.onboarding_status
  );
  return new;
end
$$;

revoke all on function dv_market_private.audit_market_seller_account() from public, anon, authenticated;

drop trigger if exists market_seller_account_audit_trigger on public.market_seller_accounts;
create trigger market_seller_account_audit_trigger
after insert or update of seller_type, onboarding_status
on public.market_seller_accounts
for each row execute function dv_market_private.audit_market_seller_account();

create or replace function public.set_my_market_seller_type(p_seller_type text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_seller_type, '')));
  v_existing public.market_seller_accounts%rowtype;
  v_row public.market_seller_accounts%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_type not in ('private','trader') then
    raise exception 'invalid_seller_type';
  end if;

  select * into v_existing
  from public.market_seller_accounts
  where seller_id = v_uid;

  if found and v_existing.onboarding_status = 'suspended' then
    raise exception 'seller_account_suspended';
  end if;

  insert into public.market_seller_accounts(seller_id, seller_type, onboarding_status)
  values (v_uid, v_type, 'draft')
  on conflict (seller_id) do update
    set seller_type = excluded.seller_type,
        trader_display_name = case
          when excluded.seller_type = 'trader'
            then market_seller_accounts.trader_display_name
          else null
        end,
        onboarding_status = case
          when market_seller_accounts.seller_type = excluded.seller_type
               and market_seller_accounts.onboarding_status = 'active'
            then 'active'
          else 'draft'
        end,
        submitted_at = case
          when market_seller_accounts.seller_type = excluded.seller_type
               and market_seller_accounts.onboarding_status = 'active'
            then market_seller_accounts.submitted_at
          else null
        end,
        verified_at = case
          when market_seller_accounts.seller_type = excluded.seller_type
               and market_seller_accounts.onboarding_status = 'active'
            then market_seller_accounts.verified_at
          else null
        end,
        suspended_at = null,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'seller_id', v_row.seller_id,
    'seller_type', v_row.seller_type,
    'onboarding_status', v_row.onboarding_status,
    'trader_display_name', v_row.trader_display_name,
    'country_code', v_row.country_code,
    'terms_version', v_row.terms_version,
    'terms_accepted_at', v_row.terms_accepted_at,
    'submitted_at', v_row.submitted_at,
    'verified_at', v_row.verified_at
  );
end
$$;

revoke all on function public.set_my_market_seller_type(text) from public, anon;
grant execute on function public.set_my_market_seller_type(text) to authenticated;

create or replace function public.get_my_market_seller_onboarding()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.market_seller_accounts%rowtype;
  v_legal dv_market_private.seller_legal_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_account
  from public.market_seller_accounts
  where seller_id = v_uid;

  if not found then
    return jsonb_build_object(
      'seller_type', 'unclassified',
      'onboarding_status', 'draft'
    );
  end if;

  select * into v_legal
  from dv_market_private.seller_legal_profiles
  where seller_id = v_uid;

  return jsonb_build_object(
    'seller_type', v_account.seller_type,
    'onboarding_status', v_account.onboarding_status,
    'trader_display_name', v_account.trader_display_name,
    'country_code', v_account.country_code,
    'terms_version', v_account.terms_version,
    'terms_accepted_at', v_account.terms_accepted_at,
    'submitted_at', v_account.submitted_at,
    'verified_at', v_account.verified_at,
    'legal_profile', case when v_legal.seller_id is null then null else jsonb_build_object(
      'legal_first_name', v_legal.legal_first_name,
      'legal_last_name', v_legal.legal_last_name,
      'date_of_birth', v_legal.date_of_birth,
      'business_name', v_legal.business_name,
      'legal_form', v_legal.legal_form,
      'representative_name', v_legal.representative_name,
      'street_line1', v_legal.street_line1,
      'street_line2', v_legal.street_line2,
      'postal_code', v_legal.postal_code,
      'city', v_legal.city,
      'country_code', v_legal.country_code,
      'public_email', v_legal.public_email,
      'public_phone', v_legal.public_phone,
      'register_name', v_legal.register_name,
      'register_number', v_legal.register_number,
      'register_court', v_legal.register_court,
      'tax_residence_country_code', v_legal.tax_residence_country_code,
      'vat_id_present', v_legal.vat_id_present
    ) end
  );
end
$$;

revoke all on function public.get_my_market_seller_onboarding() from public, anon;
grant execute on function public.get_my_market_seller_onboarding() to authenticated;

create or replace function public.get_market_seller_disclosure(p_seller_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.market_seller_accounts%rowtype;
  v_legal dv_market_private.seller_legal_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_account
  from public.market_seller_accounts
  where seller_id = p_seller_id
    and onboarding_status in ('active','legacy_beta');

  if not found then
    return null;
  end if;

  if v_account.seller_type <> 'trader' or v_account.onboarding_status <> 'active' then
    return jsonb_build_object(
      'seller_id', v_account.seller_id,
      'seller_type', v_account.seller_type,
      'onboarding_status', v_account.onboarding_status
    );
  end if;

  select * into v_legal
  from dv_market_private.seller_legal_profiles
  where seller_id = p_seller_id;

  if v_legal.seller_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'seller_id', v_account.seller_id,
    'seller_type', 'trader',
    'onboarding_status', 'active',
    'business_name', v_legal.business_name,
    'legal_name', concat_ws(' ', v_legal.legal_first_name, v_legal.legal_last_name),
    'legal_form', v_legal.legal_form,
    'representative_name', v_legal.representative_name,
    'street_line1', v_legal.street_line1,
    'street_line2', v_legal.street_line2,
    'postal_code', v_legal.postal_code,
    'city', v_legal.city,
    'country_code', v_legal.country_code,
    'public_email', v_legal.public_email,
    'public_phone', v_legal.public_phone,
    'register_name', v_legal.register_name,
    'register_number', v_legal.register_number,
    'register_court', v_legal.register_court
  );
end
$$;

revoke all on function public.get_market_seller_disclosure(uuid) from public, anon;
grant execute on function public.get_market_seller_disclosure(uuid) to authenticated;

create or replace function dv_market_private.guard_market_listing_seller_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_enforced boolean;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select seller_onboarding_enforced into v_enforced
  from dv_market_private.marketplace_compliance_policy
  where singleton = true;

  if not coalesce(v_enforced, false) then
    return new;
  end if;

  if not exists (
    select 1
    from public.market_seller_accounts a
    where a.seller_id = new.seller_id
      and a.onboarding_status = 'active'
      and a.seller_type in ('private','trader')
  ) then
    raise exception 'seller_onboarding_required';
  end if;

  return new;
end
$$;

revoke all on function dv_market_private.guard_market_listing_seller_status() from public, anon, authenticated;

drop trigger if exists market_listing_seller_status_guard on public.market_listings;
create trigger market_listing_seller_status_guard
before insert or update of status, seller_id
on public.market_listings
for each row execute function dv_market_private.guard_market_listing_seller_status();

insert into public.market_seller_accounts(seller_id, seller_type, onboarding_status)
select seller_id, 'unclassified', 'legacy_beta'
from (
  select distinct seller_id from public.market_listings
  union
  select distinct seller_id from public.market_deals
) existing_sellers
where seller_id is not null
on conflict (seller_id) do nothing;

notify pgrst, 'reload schema';
