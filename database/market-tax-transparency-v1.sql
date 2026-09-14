-- DUELVANTA Marketplace PStTG/DAC7 evidence ledger V1.
-- REVIEW ONLY: apply after market-seller-compliance-v1.sql and
-- market-checkout-compliance-v1.sql. No existing contract is backfilled and
-- no live Supabase data is changed by committing this file.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

alter table public.market_seller_accounts
  add column if not exists psttg_subject_type text not null default 'unclassified'
  check (psttg_subject_type in ('unclassified','natural_person','legal_entity'));

comment on column public.market_seller_accounts.psttg_subject_type is
  'PStTG subject type. Never infer natural person versus legal entity from private/trader seller classification.';

create table if not exists dv_market_private.market_tax_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 8 and 200),
  event_type text not null check (event_type in (
    'contract_formed','remuneration_paid_or_credited','remuneration_correction'
  )),
  seller_id uuid not null references auth.users(id) on delete restrict,
  deal_id uuid not null references public.market_deals(id) on delete restrict,
  contract_snapshot_id uuid not null references dv_market_private.market_contract_snapshots(id) on delete restrict,
  correction_of uuid references dv_market_private.market_tax_events(id) on delete restrict,
  occurred_at timestamptz not null,
  reporting_year integer not null check (reporting_year between 2023 and 2100),
  reporting_quarter integer not null check (reporting_quarter between 1 and 4),
  currency text not null check (currency = 'EUR'),
  gross_consideration_delta numeric(14,2) not null default 0,
  platform_fee_delta numeric(14,2) not null default 0,
  commission_delta numeric(14,2) not null default 0,
  withheld_tax_delta numeric(14,2) not null default 0,
  remuneration_delta numeric(14,2) not null default 0,
  activity_count_delta integer not null default 0 check (activity_count_delta between -1 and 1),
  source_type text not null check (source_type in (
    'contract_snapshot','manual_verified','payment_provider','system_correction'
  )),
  source_reference text,
  evidence jsonb not null default '{}'::jsonb,
  evidence_sha256 bytea not null,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  check (
    (event_type='contract_formed' and correction_of is null
      and gross_consideration_delta=0 and platform_fee_delta=0 and commission_delta=0
      and withheld_tax_delta=0 and remuneration_delta=0 and activity_count_delta=0)
    or
    (event_type='remuneration_paid_or_credited' and correction_of is null
      and gross_consideration_delta>0 and platform_fee_delta>=0 and commission_delta>=0
      and withheld_tax_delta>=0 and remuneration_delta>=0 and activity_count_delta=1)
    or
    (event_type='remuneration_correction' and correction_of is not null
      and gross_consideration_delta<0 and platform_fee_delta<=0 and commission_delta<=0
      and withheld_tax_delta<=0 and remuneration_delta<=0 and activity_count_delta in (-1,0))
  ),
  check (round(gross_consideration_delta-platform_fee_delta-commission_delta-withheld_tax_delta,2)=remuneration_delta)
);

comment on table dv_market_private.market_tax_events is
  'Append-only PStTG/DAC7 evidence. Contract formation is not treated as paid or credited remuneration under manual_beta.';

create unique index if not exists market_tax_events_one_remuneration_per_contract_idx
  on dv_market_private.market_tax_events(contract_snapshot_id)
  where event_type='remuneration_paid_or_credited';
create index if not exists market_tax_events_seller_period_idx
  on dv_market_private.market_tax_events(seller_id,reporting_year,reporting_quarter,occurred_at,id);
create index if not exists market_tax_events_correction_idx
  on dv_market_private.market_tax_events(correction_of)
  where correction_of is not null;

create table if not exists dv_market_private.market_tax_exports (
  id uuid primary key default gen_random_uuid(),
  reporting_year integer not null check (reporting_year between 2023 and 2100),
  reporting_quarter integer check (reporting_quarter between 1 and 4),
  export_format text not null check (export_format in ('json','csv')),
  export_kind text not null check (export_kind in ('annual','quarterly')),
  export_status text not null default 'review_evidence' check (export_status='review_evidence'),
  law_profile text not null default 'PStTG-DE-v1-2026-09-13',
  generated_at timestamptz not null default now(),
  generated_by uuid,
  source_event_count integer not null check (source_event_count>=0),
  row_count integer not null check (row_count>=0),
  payload_text text not null,
  payload_sha256 bytea not null,
  check ((export_kind='annual' and reporting_quarter is null) or
         (export_kind='quarterly' and reporting_quarter is not null))
);

create table if not exists dv_market_private.market_tax_export_rows (
  id bigint generated always as identity primary key,
  export_id uuid not null references dv_market_private.market_tax_exports(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  reporting_quarter integer not null check (reporting_quarter between 1 and 4),
  row_payload jsonb not null,
  row_sha256 bytea not null,
  unique(export_id,seller_id,reporting_quarter)
);

alter table dv_market_private.market_tax_events enable row level security;
alter table dv_market_private.market_tax_exports enable row level security;
alter table dv_market_private.market_tax_export_rows enable row level security;

revoke all on table dv_market_private.market_tax_events from public, anon, authenticated;
revoke all on table dv_market_private.market_tax_exports from public, anon, authenticated;
revoke all on table dv_market_private.market_tax_export_rows from public, anon, authenticated;
revoke all on sequence dv_market_private.market_tax_export_rows_id_seq from public, anon, authenticated;

create or replace function dv_market_private.block_market_tax_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'market_tax_evidence_is_immutable';
end
$$;

revoke all on function dv_market_private.block_market_tax_evidence_mutation() from public, anon, authenticated;

drop trigger if exists market_tax_events_immutable on dv_market_private.market_tax_events;
create trigger market_tax_events_immutable
before update or delete on dv_market_private.market_tax_events
for each row execute function dv_market_private.block_market_tax_evidence_mutation();

drop trigger if exists market_tax_exports_immutable on dv_market_private.market_tax_exports;
create trigger market_tax_exports_immutable
before update or delete on dv_market_private.market_tax_exports
for each row execute function dv_market_private.block_market_tax_evidence_mutation();

drop trigger if exists market_tax_export_rows_immutable on dv_market_private.market_tax_export_rows;
create trigger market_tax_export_rows_immutable
before update or delete on dv_market_private.market_tax_export_rows
for each row execute function dv_market_private.block_market_tax_evidence_mutation();

create or replace function dv_market_private.capture_market_tax_contract_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private, extensions
as $$
declare
  v_evidence jsonb;
  v_local timestamp;
begin
  v_local:=new.contract_formed_at at time zone 'Europe/Berlin';
  v_evidence:=jsonb_build_object(
    'snapshot_id',new.id,'deal_id',new.deal_id,'order_id',new.order_id,
    'seller_id',new.seller_id,'contract_formed_at',new.contract_formed_at,
    'currency',new.currency,'payment_provider',new.payment_provider,
    'goods_total',new.goods_total,'shipping_cost',new.shipping_cost,
    'total_price',new.total_price,'confirmation_sha256',encode(new.content_sha256,'hex'),
    'counted_as_remuneration',false
  );
  insert into dv_market_private.market_tax_events(
    event_key,event_type,seller_id,deal_id,contract_snapshot_id,occurred_at,
    reporting_year,reporting_quarter,currency,source_type,source_reference,
    evidence,evidence_sha256
  ) values (
    'contract:'||new.id::text,'contract_formed',new.seller_id,new.deal_id,new.id,new.contract_formed_at,
    extract(year from v_local)::integer,extract(quarter from v_local)::integer,new.currency,
    'contract_snapshot',new.id::text,v_evidence,extensions.digest(v_evidence::text,'sha256')
  ) on conflict (event_key) do nothing;
  return new;
end
$$;

revoke all on function dv_market_private.capture_market_tax_contract_event() from public, anon, authenticated;
drop trigger if exists market_contract_snapshot_tax_event on dv_market_private.market_contract_snapshots;
create trigger market_contract_snapshot_tax_event
after insert on dv_market_private.market_contract_snapshots
for each row execute function dv_market_private.capture_market_tax_contract_event();

create or replace function public.record_market_tax_remuneration(
  p_contract_snapshot_id uuid,
  p_event_key text,
  p_occurred_at timestamptz,
  p_gross_consideration numeric,
  p_platform_fee numeric default 0,
  p_commission numeric default 0,
  p_withheld_tax numeric default 0,
  p_source_type text default 'payment_provider',
  p_source_reference text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private, extensions
as $$
declare
  v_snapshot dv_market_private.market_contract_snapshots%rowtype;
  v_event dv_market_private.market_tax_events%rowtype;
  v_local timestamp;
  v_gross numeric:=round(coalesce(p_gross_consideration,0),2);
  v_fee numeric:=round(coalesce(p_platform_fee,0),2);
  v_commission numeric:=round(coalesce(p_commission,0),2);
  v_tax numeric:=round(coalesce(p_withheld_tax,0),2);
  v_net numeric;
  v_evidence jsonb:=coalesce(p_evidence,'{}'::jsonb);
begin
  if p_contract_snapshot_id is null or p_occurred_at is null
     or char_length(trim(coalesce(p_event_key,''))) not between 8 and 200 then
    raise exception 'tax_event_input_invalid';
  end if;
  if p_source_type not in ('manual_verified','payment_provider') then
    raise exception 'tax_event_source_invalid';
  end if;
  if v_gross<=0 or v_fee<0 or v_commission<0 or v_tax<0
     or v_gross<v_fee+v_commission+v_tax then
    raise exception 'tax_event_amount_invalid';
  end if;
  select * into v_snapshot from dv_market_private.market_contract_snapshots
  where id=p_contract_snapshot_id;
  if not found then raise exception 'contract_snapshot_not_found'; end if;
  if v_snapshot.currency<>'EUR' then raise exception 'tax_event_currency_unsupported'; end if;
  v_net:=round(v_gross-v_fee-v_commission-v_tax,2);
  v_local:=p_occurred_at at time zone 'Europe/Berlin';
  v_evidence:=v_evidence||jsonb_build_object(
    'contract_snapshot_id',v_snapshot.id,'deal_id',v_snapshot.deal_id,
    'source_reference',nullif(trim(coalesce(p_source_reference,'')),''),
    'recorded_gross',v_gross,'recorded_remuneration',v_net
  );

  insert into dv_market_private.market_tax_events(
    event_key,event_type,seller_id,deal_id,contract_snapshot_id,occurred_at,
    reporting_year,reporting_quarter,currency,gross_consideration_delta,
    platform_fee_delta,commission_delta,withheld_tax_delta,remuneration_delta,
    activity_count_delta,source_type,source_reference,evidence,evidence_sha256,recorded_by
  ) values (
    trim(p_event_key),'remuneration_paid_or_credited',v_snapshot.seller_id,v_snapshot.deal_id,
    v_snapshot.id,p_occurred_at,extract(year from v_local)::integer,
    extract(quarter from v_local)::integer,'EUR',v_gross,v_fee,v_commission,v_tax,v_net,1,
    p_source_type,nullif(left(trim(coalesce(p_source_reference,'')),500),''),
    v_evidence,extensions.digest(v_evidence::text,'sha256'),auth.uid()
  ) returning * into v_event;

  return jsonb_build_object('event_id',v_event.id,'event_type',v_event.event_type,
    'reporting_year',v_event.reporting_year,'reporting_quarter',v_event.reporting_quarter,
    'remuneration',v_event.remuneration_delta,'activity_count_delta',1);
exception when unique_violation then
  select * into v_event from dv_market_private.market_tax_events where event_key=trim(p_event_key);
  if v_event.contract_snapshot_id=p_contract_snapshot_id
     and v_event.event_type='remuneration_paid_or_credited'
     and v_event.gross_consideration_delta=v_gross
     and v_event.platform_fee_delta=v_fee
     and v_event.commission_delta=v_commission
     and v_event.withheld_tax_delta=v_tax
     and v_event.occurred_at=p_occurred_at then
    return jsonb_build_object('event_id',v_event.id,'event_type',v_event.event_type,
      'reporting_year',v_event.reporting_year,'reporting_quarter',v_event.reporting_quarter,
      'remuneration',v_event.remuneration_delta,'activity_count_delta',1,'replayed',true);
  end if;
  raise exception 'tax_event_idempotency_conflict';
end
$$;

revoke all on function public.record_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,text,text,jsonb) to service_role;

create or replace function public.correct_market_tax_remuneration(
  p_original_event_id uuid,
  p_event_key text,
  p_occurred_at timestamptz,
  p_gross_reversal numeric,
  p_platform_fee_reversal numeric default 0,
  p_commission_reversal numeric default 0,
  p_withheld_tax_reversal numeric default 0,
  p_void_activity boolean default false,
  p_source_reference text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private, extensions
as $$
declare
  v_original dv_market_private.market_tax_events%rowtype;
  v_event dv_market_private.market_tax_events%rowtype;
  v_gross numeric:=round(coalesce(p_gross_reversal,0),2);
  v_fee numeric:=round(coalesce(p_platform_fee_reversal,0),2);
  v_commission numeric:=round(coalesce(p_commission_reversal,0),2);
  v_tax numeric:=round(coalesce(p_withheld_tax_reversal,0),2);
  v_net numeric;
  v_used record;
  v_evidence jsonb:=coalesce(p_evidence,'{}'::jsonb);
begin
  if p_original_event_id is null or p_occurred_at is null
     or char_length(trim(coalesce(p_event_key,''))) not between 8 and 200 then
    raise exception 'tax_correction_input_invalid';
  end if;
  select * into v_original from dv_market_private.market_tax_events
  where id=p_original_event_id and event_type='remuneration_paid_or_credited' for update;
  if not found then raise exception 'tax_original_event_not_found'; end if;
  if p_occurred_at<v_original.occurred_at then raise exception 'tax_correction_time_invalid'; end if;
  if v_gross<=0 or v_fee<0 or v_commission<0 or v_tax<0
     or v_gross<v_fee+v_commission+v_tax then raise exception 'tax_correction_amount_invalid'; end if;

  select coalesce(-sum(gross_consideration_delta),0) gross,
         coalesce(-sum(platform_fee_delta),0) fee,
         coalesce(-sum(commission_delta),0) commission,
         coalesce(-sum(withheld_tax_delta),0) tax,
         coalesce(-sum(remuneration_delta),0) net,
         coalesce(-sum(activity_count_delta),0) voided
  into v_used
  from dv_market_private.market_tax_events where correction_of=v_original.id;

  v_net:=round(v_gross-v_fee-v_commission-v_tax,2);
  if v_used.gross+v_gross>v_original.gross_consideration_delta
     or v_used.fee+v_fee>v_original.platform_fee_delta
     or v_used.commission+v_commission>v_original.commission_delta
     or v_used.tax+v_tax>v_original.withheld_tax_delta
     or v_used.net+v_net>v_original.remuneration_delta then
    raise exception 'tax_correction_exceeds_original';
  end if;
  if coalesce(p_void_activity,false) and (
       v_used.voided<>0
       or v_used.gross+v_gross<>v_original.gross_consideration_delta
       or v_used.fee+v_fee<>v_original.platform_fee_delta
       or v_used.commission+v_commission<>v_original.commission_delta
       or v_used.tax+v_tax<>v_original.withheld_tax_delta
       or v_used.net+v_net<>v_original.remuneration_delta
     ) then raise exception 'tax_activity_void_requires_full_reversal'; end if;

  v_evidence:=v_evidence||jsonb_build_object(
    'original_event_id',v_original.id,'contract_snapshot_id',v_original.contract_snapshot_id,
    'source_reference',nullif(trim(coalesce(p_source_reference,'')),''),
    'void_activity',coalesce(p_void_activity,false)
  );
  insert into dv_market_private.market_tax_events(
    event_key,event_type,seller_id,deal_id,contract_snapshot_id,correction_of,occurred_at,
    reporting_year,reporting_quarter,currency,gross_consideration_delta,
    platform_fee_delta,commission_delta,withheld_tax_delta,remuneration_delta,
    activity_count_delta,source_type,source_reference,evidence,evidence_sha256,recorded_by
  ) values (
    trim(p_event_key),'remuneration_correction',v_original.seller_id,v_original.deal_id,
    v_original.contract_snapshot_id,v_original.id,p_occurred_at,
    v_original.reporting_year,v_original.reporting_quarter,v_original.currency,
    -v_gross,-v_fee,-v_commission,-v_tax,-v_net,
    case when coalesce(p_void_activity,false) then -1 else 0 end,
    'system_correction',nullif(left(trim(coalesce(p_source_reference,'')),500),''),
    v_evidence,extensions.digest(v_evidence::text,'sha256'),auth.uid()
  ) returning * into v_event;
  return jsonb_build_object('event_id',v_event.id,'event_type',v_event.event_type,
    'reporting_year',v_event.reporting_year,'reporting_quarter',v_event.reporting_quarter,
    'remuneration',v_event.remuneration_delta,'activity_count_delta',v_event.activity_count_delta);
exception when unique_violation then
  select * into v_event from dv_market_private.market_tax_events where event_key=trim(p_event_key);
  if v_event.correction_of=p_original_event_id and v_event.event_type='remuneration_correction'
     and v_event.gross_consideration_delta=-v_gross and v_event.platform_fee_delta=-v_fee
     and v_event.commission_delta=-v_commission and v_event.withheld_tax_delta=-v_tax
     and v_event.occurred_at=p_occurred_at then
    return jsonb_build_object('event_id',v_event.id,'event_type',v_event.event_type,
      'reporting_year',v_event.reporting_year,'reporting_quarter',v_event.reporting_quarter,
      'remuneration',v_event.remuneration_delta,'activity_count_delta',v_event.activity_count_delta,'replayed',true);
  end if;
  raise exception 'tax_event_idempotency_conflict';
end
$$;

revoke all on function public.correct_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.correct_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text,jsonb) to service_role;

create or replace function dv_market_private.market_tax_export_dataset(
  p_reporting_year integer,
  p_reporting_quarter integer default null
)
returns table(seller_id uuid, reporting_quarter integer, row_payload jsonb)
language sql
stable
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
with seller_source as (
  select distinct e.seller_id
  from dv_market_private.market_tax_events e
  where e.reporting_year=p_reporting_year
), quarters as (
  select s.seller_id,q.reporting_quarter
  from seller_source s cross join generate_series(1,4) q(reporting_quarter)
  where p_reporting_quarter is null or q.reporting_quarter=p_reporting_quarter
), annual as (
  select e.seller_id,
    count(*) filter(where e.event_type='contract_formed')::integer contract_count,
    coalesce(sum(e.activity_count_delta),0)::integer activity_count,
    round(coalesce(sum(e.gross_consideration_delta),0),2) gross_consideration,
    round(coalesce(sum(e.platform_fee_delta),0),2) platform_fees,
    round(coalesce(sum(e.commission_delta),0),2) commissions,
    round(coalesce(sum(e.withheld_tax_delta),0),2) withheld_taxes,
    round(coalesce(sum(e.remuneration_delta),0),2) remuneration
  from dv_market_private.market_tax_events e where e.reporting_year=p_reporting_year group by e.seller_id
), quarter_totals as (
  select e.seller_id,e.reporting_quarter,
    count(*) filter(where e.event_type='contract_formed')::integer contract_count,
    coalesce(sum(e.activity_count_delta),0)::integer activity_count,
    round(coalesce(sum(e.gross_consideration_delta),0),2) gross_consideration,
    round(coalesce(sum(e.platform_fee_delta),0),2) platform_fees,
    round(coalesce(sum(e.commission_delta),0),2) commissions,
    round(coalesce(sum(e.withheld_tax_delta),0),2) withheld_taxes,
    round(coalesce(sum(e.remuneration_delta),0),2) remuneration
  from dv_market_private.market_tax_events e where e.reporting_year=p_reporting_year
  group by e.seller_id,e.reporting_quarter
), identity_source as (
  select a.seller_id,a.seller_type,a.psttg_subject_type,
    l.legal_first_name,l.legal_last_name,l.date_of_birth,l.business_name,l.legal_form,
    l.representative_name,l.street_line1,l.street_line2,l.postal_code,l.city,l.country_code,
    l.tax_residence_country_code,l.vat_id_present,l.register_name,l.register_number,l.register_court,
    coalesce((select jsonb_agg(jsonb_build_object('reference_id',t.id,'kind',t.identifier_kind,
      'issuing_country_code',t.issuing_country_code) order by t.identifier_kind,t.issuing_country_code)
      from dv_market_private.seller_tax_identifiers t where t.seller_id=a.seller_id),'[]'::jsonb) tax_identifier_references
  from public.market_seller_accounts a
  left join dv_market_private.seller_legal_profiles l on l.seller_id=a.seller_id
)
select q.seller_id,q.reporting_quarter,
  jsonb_strip_nulls(jsonb_build_object(
    'seller_id',q.seller_id,'reporting_year',p_reporting_year,'reporting_quarter',q.reporting_quarter,
    'seller_type',i.seller_type,'psttg_subject_type',i.psttg_subject_type,
    'identity',jsonb_build_object(
      'legal_first_name',i.legal_first_name,'legal_last_name',i.legal_last_name,'date_of_birth',i.date_of_birth,
      'business_name',i.business_name,'legal_form',i.legal_form,'representative_name',i.representative_name,
      'street_line1',i.street_line1,'street_line2',i.street_line2,'postal_code',i.postal_code,
      'city',i.city,'country_code',i.country_code,'tax_residence_country_code',i.tax_residence_country_code,
      'vat_id_present',i.vat_id_present,'register_name',i.register_name,'register_number',i.register_number,
      'register_court',i.register_court,'tax_identifier_references',i.tax_identifier_references,
      'tax_identifiers_remain_encrypted',true
    ),
    'identity_data_ready',case
      when i.psttg_subject_type='natural_person' then
        nullif(trim(i.legal_first_name),'') is not null and nullif(trim(i.legal_last_name),'') is not null
        and i.date_of_birth is not null and nullif(trim(i.street_line1),'') is not null
        and nullif(trim(i.postal_code),'') is not null and nullif(trim(i.city),'') is not null
        and nullif(trim(i.country_code),'') is not null and jsonb_array_length(i.tax_identifier_references)>0
      when i.psttg_subject_type='legal_entity' then
        nullif(trim(i.business_name),'') is not null and nullif(trim(i.street_line1),'') is not null
        and nullif(trim(i.postal_code),'') is not null and nullif(trim(i.city),'') is not null
        and nullif(trim(i.country_code),'') is not null and jsonb_array_length(i.tax_identifier_references)>0
      else false end,
    'quarter',jsonb_build_object(
      'contract_count',coalesce(t.contract_count,0),'activity_count',coalesce(t.activity_count,0),
      'gross_consideration',coalesce(t.gross_consideration,0),'platform_fees',coalesce(t.platform_fees,0),
      'commissions',coalesce(t.commissions,0),'withheld_taxes',coalesce(t.withheld_taxes,0),
      'remuneration',coalesce(t.remuneration,0),'currency','EUR'
    ),
    'annual',jsonb_build_object(
      'contract_count',coalesce(y.contract_count,0),'activity_count',coalesce(y.activity_count,0),
      'gross_consideration',coalesce(y.gross_consideration,0),'platform_fees',coalesce(y.platform_fees,0),
      'commissions',coalesce(y.commissions,0),'withheld_taxes',coalesce(y.withheld_taxes,0),
      'remuneration',coalesce(y.remuneration,0),'currency','EUR'
    ),
    'goods_threshold',jsonb_build_object(
      'less_than_30_activities',coalesce(y.activity_count,0)<30,
      'less_than_2000_eur_remuneration',coalesce(y.remuneration,0)<2000,
      'exempt_only_if_both_true',coalesce(y.activity_count,0)<30 and coalesce(y.remuneration,0)<2000,
      'threshold_result',case when coalesce(y.activity_count,0)<30 and coalesce(y.remuneration,0)<2000
        then 'exempt_below_both_thresholds' else 'reportable_threshold_met' end,
      'exactly_30_activities',coalesce(y.activity_count,0)=30,
      'exactly_2000_eur_remuneration',coalesce(y.remuneration,0)=2000
    )
  )) row_payload
from quarters q
join annual y on y.seller_id=q.seller_id
left join quarter_totals t on t.seller_id=q.seller_id and t.reporting_quarter=q.reporting_quarter
left join identity_source i on i.seller_id=q.seller_id
order by q.seller_id,q.reporting_quarter
$$;

revoke all on function dv_market_private.market_tax_export_dataset(integer,integer) from public, anon, authenticated;

create or replace function dv_market_private.market_tax_csv_field(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$select '"'||replace(replace(replace(coalesce(p_value,''),'"','""'),E'\r',' '),E'\n',' ')||'"'$$;

revoke all on function dv_market_private.market_tax_csv_field(text) from public, anon, authenticated;

create or replace function public.generate_market_tax_export(
  p_reporting_year integer,
  p_reporting_quarter integer default null,
  p_format text default 'json'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private, extensions
as $$
declare
  v_format text:=lower(trim(coalesce(p_format,'')));
  v_kind text;
  v_payload text;
  v_export_id uuid;
  v_rows integer;
  v_events integer;
begin
  if p_reporting_year not between 2023 and 2100
     or (p_reporting_quarter is not null and p_reporting_quarter not between 1 and 4)
     or v_format not in ('json','csv') then raise exception 'tax_export_input_invalid'; end if;
  v_kind:=case when p_reporting_quarter is null then 'annual' else 'quarterly' end;

  create temporary table if not exists pg_temp.dv_market_tax_export_work(
    seller_id uuid,reporting_quarter integer,row_payload jsonb
  ) on commit drop;
  truncate pg_temp.dv_market_tax_export_work;
  insert into pg_temp.dv_market_tax_export_work
  select * from dv_market_private.market_tax_export_dataset(p_reporting_year,p_reporting_quarter);
  select count(*) into v_rows from pg_temp.dv_market_tax_export_work;
  select count(*) into v_events from dv_market_private.market_tax_events
  where reporting_year=p_reporting_year
    and (p_reporting_quarter is null or reporting_quarter=p_reporting_quarter);

  if v_format='json' then
    select jsonb_pretty(jsonb_build_object(
      'schema_version','duelvanta-psttg-evidence-v1','export_status','review_evidence_not_bzst_submission',
      'reporting_year',p_reporting_year,'reporting_quarter',p_reporting_quarter,
      'threshold_rule','freigestellt nur bei weniger als 30 Tätigkeiten UND weniger als 2.000 EUR Vergütung',
      'rows',coalesce(jsonb_agg(row_payload order by seller_id,reporting_quarter),'[]'::jsonb)
    )) into v_payload from pg_temp.dv_market_tax_export_work;
  else
    select 'seller_id,reporting_year,reporting_quarter,psttg_subject_type,seller_type,identity_data_ready,legal_name,business_name,country_code,tax_identifier_references,quarter_activity_count,quarter_remuneration_eur,quarter_platform_fees_eur,quarter_commissions_eur,quarter_withheld_taxes_eur,annual_activity_count,annual_remuneration_eur,threshold_result,exactly_30_activities,exactly_2000_eur_remuneration'||E'\n'||
      coalesce(string_agg(
        dv_market_private.market_tax_csv_field(row_payload->>'seller_id')||','||
        dv_market_private.market_tax_csv_field(row_payload->>'reporting_year')||','||
        dv_market_private.market_tax_csv_field(row_payload->>'reporting_quarter')||','||
        dv_market_private.market_tax_csv_field(row_payload->>'psttg_subject_type')||','||
        dv_market_private.market_tax_csv_field(row_payload->>'seller_type')||','||
        dv_market_private.market_tax_csv_field(row_payload->>'identity_data_ready')||','||
        dv_market_private.market_tax_csv_field(concat_ws(' ',row_payload#>>'{identity,legal_first_name}',row_payload#>>'{identity,legal_last_name}'))||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{identity,business_name}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{identity,country_code}')||','||
        dv_market_private.market_tax_csv_field((row_payload#>'{identity,tax_identifier_references}')::text)||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{quarter,activity_count}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{quarter,remuneration}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{quarter,platform_fees}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{quarter,commissions}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{quarter,withheld_taxes}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{annual,activity_count}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{annual,remuneration}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{goods_threshold,threshold_result}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{goods_threshold,exactly_30_activities}')||','||
        dv_market_private.market_tax_csv_field(row_payload#>>'{goods_threshold,exactly_2000_eur_remuneration}'),
        E'\n' order by seller_id,reporting_quarter
      ),'') into v_payload from pg_temp.dv_market_tax_export_work;
  end if;

  insert into dv_market_private.market_tax_exports(
    reporting_year,reporting_quarter,export_format,export_kind,generated_by,
    source_event_count,row_count,payload_text,payload_sha256
  ) values (
    p_reporting_year,p_reporting_quarter,v_format,v_kind,auth.uid(),v_events,v_rows,
    v_payload,extensions.digest(convert_to(v_payload,'UTF8'),'sha256')
  ) returning id into v_export_id;

  insert into dv_market_private.market_tax_export_rows(export_id,seller_id,reporting_quarter,row_payload,row_sha256)
  select v_export_id,seller_id,reporting_quarter,row_payload,extensions.digest(row_payload::text,'sha256')
  from pg_temp.dv_market_tax_export_work order by seller_id,reporting_quarter;

  return jsonb_build_object(
    'export_id',v_export_id,'export_kind',v_kind,'format',v_format,
    'reporting_year',p_reporting_year,'reporting_quarter',p_reporting_quarter,
    'row_count',v_rows,'source_event_count',v_events,
    'sha256',encode(extensions.digest(convert_to(v_payload,'UTF8'),'sha256'),'hex'),
    'status','review_evidence_not_bzst_submission','payload',v_payload
  );
end
$$;

revoke all on function public.generate_market_tax_export(integer,integer,text) from public, anon, authenticated;
grant execute on function public.generate_market_tax_export(integer,integer,text) to service_role;

create or replace function public.get_market_tax_export(p_export_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_export dv_market_private.market_tax_exports%rowtype;
begin
  select * into v_export from dv_market_private.market_tax_exports where id=p_export_id;
  if not found then raise exception 'tax_export_not_found'; end if;
  return jsonb_build_object(
    'export_id',v_export.id,'export_kind',v_export.export_kind,'format',v_export.export_format,
    'reporting_year',v_export.reporting_year,'reporting_quarter',v_export.reporting_quarter,
    'generated_at',v_export.generated_at,'row_count',v_export.row_count,
    'source_event_count',v_export.source_event_count,'sha256',encode(v_export.payload_sha256,'hex'),
    'status','review_evidence_not_bzst_submission','payload',v_export.payload_text
  );
end
$$;

revoke all on function public.get_market_tax_export(uuid) from public, anon, authenticated;
grant execute on function public.get_market_tax_export(uuid) to service_role;

revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;
