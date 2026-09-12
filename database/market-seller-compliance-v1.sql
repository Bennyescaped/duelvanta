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
  tax_identifier_required_for_activation boolean not null default true,
  seller_terms_version text not null default 'seller-beta-2026-09',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into dv_market_private.marketplace_compliance_policy(singleton, seller_onboarding_enforced)
values (true, false)
on conflict (singleton) do nothing;

create table if not exists dv_market_private.seller_review_actions (
  id bigint generated always as identity primary key,
  seller_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('approve','reject','suspend')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists seller_review_actions_seller_idx
  on dv_market_private.seller_review_actions(seller_id, created_at desc);

revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.is_market_owner_caller()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and coalesce(p.account_status, 'active') = 'active'
  )
$$;

revoke all on function dv_market_private.is_market_owner_caller() from public, anon, authenticated;

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

create or replace function public.save_my_market_seller_legal_profile(
  p_legal_first_name text,
  p_legal_last_name text,
  p_date_of_birth date,
  p_street_line1 text,
  p_street_line2 text,
  p_postal_code text,
  p_city text,
  p_country_code text,
  p_tax_residence_country_code text,
  p_business_name text default null,
  p_legal_form text default null,
  p_representative_name text default null,
  p_public_email text default null,
  p_public_phone text default null,
  p_register_name text default null,
  p_register_number text default null,
  p_register_court text default null,
  p_vat_id_present boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.market_seller_accounts%rowtype;
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_tax_country text := upper(trim(coalesce(p_tax_residence_country_code, '')));
  v_email text := lower(trim(coalesce(p_public_email, '')));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_account
  from public.market_seller_accounts
  where seller_id = v_uid;

  if not found or v_account.seller_type not in ('private','trader') then
    raise exception 'seller_type_required';
  end if;
  if v_account.onboarding_status = 'suspended' then
    raise exception 'seller_account_suspended';
  end if;
  if nullif(trim(coalesce(p_legal_first_name, '')), '') is null
     or nullif(trim(coalesce(p_legal_last_name, '')), '') is null
     or nullif(trim(coalesce(p_street_line1, '')), '') is null
     or nullif(trim(coalesce(p_postal_code, '')), '') is null
     or nullif(trim(coalesce(p_city, '')), '') is null then
    raise exception 'seller_legal_profile_incomplete';
  end if;
  if p_date_of_birth is null
     or p_date_of_birth > current_date - interval '18 years'
     or p_date_of_birth < current_date - interval '120 years' then
    raise exception 'seller_must_be_adult';
  end if;
  if v_country !~ '^[A-Z]{2}$' or v_tax_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country_code';
  end if;
  if length(trim(p_legal_first_name)) > 100
     or length(trim(p_legal_last_name)) > 100
     or length(trim(p_street_line1)) > 160
     or length(trim(coalesce(p_street_line2, ''))) > 160
     or length(trim(p_postal_code)) > 20
     or length(trim(p_city)) > 120 then
    raise exception 'seller_legal_profile_value_too_long';
  end if;

  if v_account.seller_type = 'trader' then
    if nullif(trim(coalesce(p_business_name, '')), '') is null
       or nullif(trim(coalesce(p_legal_form, '')), '') is null
       or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
       or length(regexp_replace(coalesce(p_public_phone, ''), '[^0-9+]', '', 'g')) < 6 then
      raise exception 'trader_public_profile_incomplete';
    end if;
    if (nullif(trim(coalesce(p_register_name, '')), '') is not null
        or nullif(trim(coalesce(p_register_number, '')), '') is not null)
       and (nullif(trim(coalesce(p_register_name, '')), '') is null
            or nullif(trim(coalesce(p_register_number, '')), '') is null) then
      raise exception 'trader_register_incomplete';
    end if;
  end if;

  insert into dv_market_private.seller_legal_profiles(
    seller_id, legal_first_name, legal_last_name, date_of_birth,
    business_name, legal_form, representative_name,
    street_line1, street_line2, postal_code, city, country_code,
    public_email, public_phone, register_name, register_number, register_court,
    tax_residence_country_code, vat_id_present, updated_at
  ) values (
    v_uid, trim(p_legal_first_name), trim(p_legal_last_name), p_date_of_birth,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_business_name,'')),'') else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_legal_form,'')),'') else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_representative_name,'')),'') else null end,
    trim(p_street_line1), nullif(trim(coalesce(p_street_line2,'')),''), trim(p_postal_code), trim(p_city), v_country,
    case when v_account.seller_type='trader' then v_email else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_public_phone,'')),'') else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_register_name,'')),'') else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_register_number,'')),'') else null end,
    case when v_account.seller_type='trader' then nullif(trim(coalesce(p_register_court,'')),'') else null end,
    v_tax_country,
    case when v_account.seller_type='trader' then coalesce(p_vat_id_present,false) else false end,
    now()
  )
  on conflict (seller_id) do update set
    legal_first_name=excluded.legal_first_name,
    legal_last_name=excluded.legal_last_name,
    date_of_birth=excluded.date_of_birth,
    business_name=excluded.business_name,
    legal_form=excluded.legal_form,
    representative_name=excluded.representative_name,
    street_line1=excluded.street_line1,
    street_line2=excluded.street_line2,
    postal_code=excluded.postal_code,
    city=excluded.city,
    country_code=excluded.country_code,
    public_email=excluded.public_email,
    public_phone=excluded.public_phone,
    register_name=excluded.register_name,
    register_number=excluded.register_number,
    register_court=excluded.register_court,
    tax_residence_country_code=excluded.tax_residence_country_code,
    vat_id_present=excluded.vat_id_present,
    updated_at=now();

  update public.market_seller_accounts
  set trader_display_name=case when seller_type='trader' then nullif(trim(coalesce(p_business_name,'')),'') else null end,
      country_code=v_country,
      onboarding_status='draft',
      submitted_at=null,
      verified_at=null,
      updated_at=now()
  where seller_id=v_uid;

  return public.get_my_market_seller_onboarding();
end
$$;

revoke all on function public.save_my_market_seller_legal_profile(
  text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean
) from public, anon;
grant execute on function public.save_my_market_seller_legal_profile(
  text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean
) to authenticated;

create or replace function public.submit_my_market_seller_onboarding(
  p_accept_seller_terms boolean,
  p_confirm_data_accuracy boolean,
  p_confirm_lawful_goods boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.market_seller_accounts%rowtype;
  v_legal dv_market_private.seller_legal_profiles%rowtype;
  v_terms_version text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not coalesce(p_accept_seller_terms,false)
     or not coalesce(p_confirm_data_accuracy,false)
     or not coalesce(p_confirm_lawful_goods,false) then
    raise exception 'seller_declarations_required';
  end if;

  select * into v_account from public.market_seller_accounts where seller_id=v_uid;
  select * into v_legal from dv_market_private.seller_legal_profiles where seller_id=v_uid;
  select seller_terms_version into v_terms_version
  from dv_market_private.marketplace_compliance_policy where singleton=true;

  if v_account.seller_id is null or v_account.seller_type not in ('private','trader')
     or v_legal.seller_id is null then
    raise exception 'seller_onboarding_incomplete';
  end if;
  if v_account.onboarding_status = 'suspended' then
    raise exception 'seller_account_suspended';
  end if;
  if v_legal.legal_first_name is null or v_legal.legal_last_name is null
     or v_legal.date_of_birth is null or v_legal.street_line1 is null
     or v_legal.postal_code is null or v_legal.city is null
     or v_legal.country_code is null or v_legal.tax_residence_country_code is null then
    raise exception 'seller_onboarding_incomplete';
  end if;
  if v_account.seller_type='trader'
     and (v_legal.business_name is null or v_legal.legal_form is null
          or v_legal.public_email is null or v_legal.public_phone is null) then
    raise exception 'seller_onboarding_incomplete';
  end if;

  insert into dv_market_private.seller_declarations(seller_id,declaration_kind,document_version)
  values
    (v_uid,'seller_terms',v_terms_version),
    (v_uid,'data_accuracy',v_terms_version),
    (v_uid,'lawful_goods',v_terms_version)
  on conflict (seller_id,declaration_kind,document_version)
  do update set accepted_at=now(),withdrawn_at=null;

  update public.market_seller_accounts
  set onboarding_status='pending_review',
      terms_version=v_terms_version,
      terms_accepted_at=now(),
      submitted_at=now(),
      verified_at=null,
      updated_at=now()
  where seller_id=v_uid;

  return public.get_my_market_seller_onboarding();
end
$$;

revoke all on function public.submit_my_market_seller_onboarding(boolean,boolean,boolean) from public, anon;
grant execute on function public.submit_my_market_seller_onboarding(boolean,boolean,boolean) to authenticated;

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
  v_enforced boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select seller_onboarding_enforced into v_enforced
  from dv_market_private.marketplace_compliance_policy
  where singleton = true;

  select * into v_account
  from public.market_seller_accounts
  where seller_id = v_uid;

  if not found then
    return jsonb_build_object(
      'seller_type', 'unclassified',
      'onboarding_status', 'draft',
      'onboarding_enforced', coalesce(v_enforced, false)
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
    'onboarding_enforced', coalesce(v_enforced, false),
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

create or replace function public.get_market_seller_disclosures(p_seller_ids uuid[])
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(cardinality(p_seller_ids), 0) > 100 then
    raise exception 'too_many_sellers';
  end if;

  select coalesce(jsonb_agg(x.disclosure), '[]'::jsonb)
  into v_result
  from (
    select public.get_market_seller_disclosure(ids.seller_id) as disclosure
    from (
      select distinct seller_id
      from unnest(coalesce(p_seller_ids, array[]::uuid[])) as requested(seller_id)
      where seller_id is not null
    ) ids
  ) x
  where x.disclosure is not null;

  return v_result;
end
$$;

revoke all on function public.get_market_seller_disclosures(uuid[]) from public, anon;
grant execute on function public.get_market_seller_disclosures(uuid[]) to authenticated;

create or replace function public.review_market_seller_onboarding(
  p_seller_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_account public.market_seller_accounts%rowtype;
  v_legal dv_market_private.seller_legal_profiles%rowtype;
  v_tax_required boolean := true;
begin
  if not dv_market_private.is_market_owner_caller() then
    raise exception 'owner_access_required';
  end if;
  if p_seller_id is null or v_decision not in ('approve','reject','suspend') then
    raise exception 'invalid_review_decision';
  end if;
  if v_decision in ('reject','suspend') and nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'review_reason_required';
  end if;

  select * into v_account from public.market_seller_accounts
  where seller_id=p_seller_id for update;
  select * into v_legal from dv_market_private.seller_legal_profiles
  where seller_id=p_seller_id;
  select tax_identifier_required_for_activation into v_tax_required
  from dv_market_private.marketplace_compliance_policy where singleton=true;

  if v_account.seller_id is null then raise exception 'seller_account_not_found'; end if;
  if v_decision='approve' then
    if v_account.onboarding_status<>'pending_review' or v_legal.seller_id is null then
      raise exception 'seller_not_ready_for_approval';
    end if;
    if coalesce(v_tax_required,true) and not exists (
      select 1 from dv_market_private.seller_tax_identifiers
      where seller_id=p_seller_id and identifier_kind in ('tin','vat_id')
    ) then
      raise exception 'seller_tax_identifier_required';
    end if;
    update public.market_seller_accounts
    set onboarding_status='active',verified_at=now(),suspended_at=null,updated_at=now()
    where seller_id=p_seller_id;
  elsif v_decision='reject' then
    if v_account.onboarding_status<>'pending_review' then
      raise exception 'seller_not_pending_review';
    end if;
    update public.market_seller_accounts
    set onboarding_status='rejected',verified_at=null,updated_at=now()
    where seller_id=p_seller_id;
  else
    update public.market_seller_accounts
    set onboarding_status='suspended',verified_at=null,suspended_at=now(),updated_at=now()
    where seller_id=p_seller_id;
  end if;

  insert into dv_market_private.seller_review_actions(seller_id,actor_id,action,reason)
  values(p_seller_id,v_actor,v_decision,nullif(left(trim(coalesce(p_reason,'')),1000),''));

  return jsonb_build_object('seller_id',p_seller_id,'decision',v_decision,'status',
    case v_decision when 'approve' then 'active' when 'reject' then 'rejected' else 'suspended' end);
end
$$;

revoke all on function public.review_market_seller_onboarding(uuid,text,text) from public, anon;
grant execute on function public.review_market_seller_onboarding(uuid,text,text) to authenticated;

create or replace function public.set_marketplace_seller_onboarding_enforcement(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_actor uuid := auth.uid();
  v_paused integer := 0;
begin
  if not dv_market_private.is_market_owner_caller() then
    raise exception 'owner_access_required';
  end if;

  update dv_market_private.marketplace_compliance_policy
  set seller_onboarding_enforced=coalesce(p_enabled,false),updated_by=v_actor,updated_at=now()
  where singleton=true;

  if coalesce(p_enabled,false) then
    update public.market_listings l
    set status='paused',updated_at=now()
    where l.status='active'
      and not exists (
        select 1 from public.market_seller_accounts a
        where a.seller_id=l.seller_id and a.onboarding_status='active'
          and a.seller_type in ('private','trader')
      );
    get diagnostics v_paused = row_count;
  end if;

  return jsonb_build_object('seller_onboarding_enforced',coalesce(p_enabled,false),'paused_listings',v_paused);
end
$$;

revoke all on function public.set_marketplace_seller_onboarding_enforcement(boolean) from public, anon;
grant execute on function public.set_marketplace_seller_onboarding_enforcement(boolean) to authenticated;

create or replace function dv_market_private.pause_listings_after_seller_restriction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_enforced boolean := false;
begin
  select seller_onboarding_enforced into v_enforced
  from dv_market_private.marketplace_compliance_policy where singleton=true;
  if coalesce(v_enforced,false)
     and new.onboarding_status<>'active'
     and old.onboarding_status is distinct from new.onboarding_status then
    update public.market_listings
    set status='paused',updated_at=now()
    where seller_id=new.seller_id and status='active';
  end if;
  return new;
end
$$;

revoke all on function dv_market_private.pause_listings_after_seller_restriction() from public, anon, authenticated;

drop trigger if exists pause_listings_after_seller_restriction_trigger on public.market_seller_accounts;
create trigger pause_listings_after_seller_restriction_trigger
after update of onboarding_status on public.market_seller_accounts
for each row execute function dv_market_private.pause_listings_after_seller_restriction();

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
    if tg_op='INSERT' then
      raise exception 'seller_onboarding_required';
    end if;
    new.status := 'paused';
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
