-- DUELVANTA B07 / L07-01 private C2C swap flow.
-- REVIEW/STAGING ONLY. Apply after:
--   market-seller-compliance-v1.sql
--   b07-l07-01-eligibility-guard-v1.sql
--   b07-l07-01-order-lifecycle-v1.sql
-- This migration creates no payment, payout, refund, fee, wallet, DAC7/PStTG
-- reporting event or tax-accounting effect. Euro values are immutable technical
-- reference snapshots only and remain unclassified pending external tax review.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.market_swap_threads (
  id uuid primary key default gen_random_uuid(),
  party_a_id uuid not null references auth.users(id) on delete restrict,
  party_b_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'negotiating'
    check (status in ('negotiating','bound','completed','withdrawn','declined','disputed')),
  current_revision_id uuid,
  bound_revision_id uuid,
  binding_at timestamptz,
  shipping_due_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (party_a_id <> party_b_id),
  check ((status in ('bound','completed','disputed')) = (binding_at is not null))
);

create index if not exists market_swap_threads_party_a_idx
  on dv_market_private.market_swap_threads(party_a_id,updated_at desc);
create index if not exists market_swap_threads_party_b_idx
  on dv_market_private.market_swap_threads(party_b_id,updated_at desc);

create table if not exists dv_market_private.market_swap_revisions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  content_sha256 bytea not null,
  created_at timestamptz not null default now(),
  unique(thread_id,revision_no)
);

create table if not exists dv_market_private.market_swap_revision_items (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  revision_id uuid not null references dv_market_private.market_swap_revisions(id) on delete restrict,
  party_side text not null check (party_side in ('a','b')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  quantity integer not null default 1 check (quantity = 1),
  item_snapshot jsonb not null,
  reference_value_eur numeric(14,2),
  reference_value_source text not null
    check (reference_value_source in ('listing_market_price_snapshot','unavailable')),
  item_sha256 bytea not null,
  created_at timestamptz not null default now(),
  unique(revision_id,listing_id)
);

create index if not exists market_swap_revision_items_revision_idx
  on dv_market_private.market_swap_revision_items(revision_id,party_side,listing_id);

create table if not exists dv_market_private.market_swap_confirmations (
  revision_id uuid not null references dv_market_private.market_swap_revisions(id) on delete restrict,
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  content_sha256 bytea not null,
  confirmed_at timestamptz not null default now(),
  primary key(revision_id,user_id)
);

create table if not exists dv_market_private.market_swap_reservations (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  revision_id uuid not null references dv_market_private.market_swap_revisions(id) on delete restrict,
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check (quantity = 1),
  reserved_at timestamptz not null,
  unique(thread_id,listing_id)
);

create table if not exists dv_market_private.market_swap_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  revision_id uuid not null references dv_market_private.market_swap_revisions(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  direction text not null default 'given_goods' check (direction='given_goods'),
  item_count integer not null check (item_count between 1 and 20),
  currency text not null default 'EUR' check (currency='EUR'),
  reference_value_eur numeric(14,2),
  valuation_method text not null default 'sum_listing_market_price_snapshots'
    check (valuation_method='sum_listing_market_price_snapshots'),
  valuation_status text not null
    check (valuation_status in ('reference_only_unapproved','incomplete_reference')),
  source_snapshot jsonb not null,
  source_snapshot_sha256 bytea not null,
  captured_at timestamptz not null,
  psttg_evaluation_status text not null default 'external_review_required'
    check (psttg_evaluation_status='external_review_required'),
  psttg_event_created_by_b07 boolean not null default false check (psttg_event_created_by_b07=false),
  created_at timestamptz not null default now(),
  unique(thread_id,owner_id)
);

comment on table dv_market_private.market_swap_value_snapshots is
  'Immutable C2C goods-value evidence only. No tax classification, remuneration booking or PStTG reporting event is created by B07.';

create table if not exists dv_market_private.market_swap_shipping_addresses (
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  recipient_name text not null,
  street_line1 text not null,
  street_line2 text,
  postal_code text not null,
  city text not null,
  country_code text not null check (country_code='DE'),
  captured_at timestamptz not null,
  content_sha256 bytea not null,
  primary key(thread_id,user_id)
);

comment on table dv_market_private.market_swap_shipping_addresses is
  'Immutable shipment destination snapshot captured only when both parties bind the exact final swap revision.';

create table if not exists dv_market_private.market_swap_fulfillments (
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  receiver_id uuid not null references auth.users(id) on delete restrict,
  shipping_due_at timestamptz not null,
  goods_reference_value_eur numeric(14,2),
  tracking_required boolean not null,
  carrier text,
  tracking_code text,
  shipped_at timestamptz,
  received_at timestamptz,
  receiver_confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(thread_id,sender_id),
  check (sender_id <> receiver_id),
  check ((received_at is null and receiver_confirmed_at is null) or
         (received_at is not null and receiver_confirmed_at is not null))
);

alter table dv_market_private.market_swap_threads enable row level security;
alter table dv_market_private.market_swap_revisions enable row level security;
alter table dv_market_private.market_swap_revision_items enable row level security;
alter table dv_market_private.market_swap_confirmations enable row level security;
alter table dv_market_private.market_swap_reservations enable row level security;
alter table dv_market_private.market_swap_value_snapshots enable row level security;
alter table dv_market_private.market_swap_shipping_addresses enable row level security;
alter table dv_market_private.market_swap_fulfillments enable row level security;

revoke all on table dv_market_private.market_swap_threads from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_revisions from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_revision_items from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_confirmations from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_reservations from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_value_snapshots from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_shipping_addresses from public,anon,authenticated;
revoke all on table dv_market_private.market_swap_fulfillments from public,anon,authenticated;

create or replace function dv_market_private.block_market_swap_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'market_swap_evidence_is_immutable';
end
$$;
revoke all on function dv_market_private.block_market_swap_evidence_mutation() from public,anon,authenticated;


drop trigger if exists market_swap_revisions_immutable on dv_market_private.market_swap_revisions;
create trigger market_swap_revisions_immutable
before update or delete on dv_market_private.market_swap_revisions
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

drop trigger if exists market_swap_revision_items_immutable on dv_market_private.market_swap_revision_items;
create trigger market_swap_revision_items_immutable
before update or delete on dv_market_private.market_swap_revision_items
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

drop trigger if exists market_swap_confirmations_immutable on dv_market_private.market_swap_confirmations;
create trigger market_swap_confirmations_immutable
before update or delete on dv_market_private.market_swap_confirmations
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

drop trigger if exists market_swap_reservations_immutable on dv_market_private.market_swap_reservations;
create trigger market_swap_reservations_immutable
before update or delete on dv_market_private.market_swap_reservations
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

drop trigger if exists market_swap_value_snapshots_immutable on dv_market_private.market_swap_value_snapshots;
create trigger market_swap_value_snapshots_immutable
before update or delete on dv_market_private.market_swap_value_snapshots
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

drop trigger if exists market_swap_shipping_addresses_immutable on dv_market_private.market_swap_shipping_addresses;
create trigger market_swap_shipping_addresses_immutable
before update or delete on dv_market_private.market_swap_shipping_addresses
for each row execute function dv_market_private.block_market_swap_evidence_mutation();

create or replace function dv_market_private.require_private_c2c_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_account public.market_seller_accounts%rowtype;
begin
  perform dv_market_private.require_trade_eligibility(p_user_id,false);
  select * into v_account
  from public.market_seller_accounts
  where seller_id=p_user_id;
  if not found
     or v_account.seller_type<>'private'
     or v_account.onboarding_status<>'active'
     or v_account.country_code<>'DE' then
    raise exception 'c2c_private_seller_required';
  end if;
end
$$;
revoke all on function dv_market_private.require_private_c2c_user(uuid) from public,anon,authenticated;
