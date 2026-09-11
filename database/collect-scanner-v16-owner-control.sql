-- DUELVANTA Scanner V16 OpenAI-only quota and Owner controls.
-- The historical provider-neutral/Ximilar credit ledger remains untouched and
-- is deliberately not read by any function in this migration.
begin;

create table if not exists dv_v16_private.openai_scan_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  raw_weekly_limit integer not null default 50 check (raw_weekly_limit between 0 and 50),
  slab_weekly_limit integer not null default 10 check (slab_weekly_limit between 0 and 10),
  monthly_budget_eur_micros bigint not null default 25000000
    check (monthly_budget_eur_micros between 0 and 250000000),
  -- Full 400k input context at $0.75/M plus <=1400 output at $4.50/M:
  -- <=$0.3063. At the pinned valuation rate this is below the EUR 0.50 hold.
  reservation_eur_micros bigint not null default 500000
    check (reservation_eur_micros between 1 and 1000000),
  accounting_key_sha256 text check (accounting_key_sha256 ~ '^[a-f0-9]{64}$'),
  eur_per_usd_micros integer not null default 862664 check (eur_per_usd_micros between 1 and 1000000),
  fx_date date not null default '2026-09-11',
  tracking_started_at timestamptz not null default now(),
  legacy_unclassified_attempts integer not null default 0
);
insert into dv_v16_private.openai_scan_policy(singleton, enabled, raw_weekly_limit, slab_weekly_limit, monthly_budget_eur_micros,legacy_unclassified_attempts)
select true, true, 50, 10, 25000000,count(*) from dv_v16_private.scan_reservation
on conflict (singleton) do nothing;

create table if not exists dv_v16_private.openai_weekly_usage (
  user_id uuid not null,
  week_start date not null,
  raw_used integer not null default 0 check (raw_used >= 0),
  slab_used integer not null default 0 check (slab_used >= 0),
  primary key (user_id, week_start)
);
create table if not exists dv_v16_private.openai_scan_reservation (
  user_id uuid not null,
  request_id uuid not null,
  week_start date not null,
  image_sha256 text not null check (image_sha256 ~ '^[a-f0-9]{64}$'),
  tcg text not null check (tcg in ('pokemon','one_piece')),
  kind text not null check (kind in ('raw','slab')),
  reserved_eur_micros bigint not null check (reserved_eur_micros > 0),
  eur_per_usd_micros integer not null default 862664,
  estimated_cost_eur_micros bigint check (estimated_cost_eur_micros between 0 and reserved_eur_micros),
  estimated_cost_usd_micros bigint check (estimated_cost_usd_micros >= 0),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  settled_at timestamptz,
  reserved_at timestamptz not null default now(),
  primary key (user_id, request_id),
  unique (user_id, week_start, image_sha256, tcg, kind)
);

create table if not exists dv_v16_private.openai_monthly_cost (
  period_start date primary key,
  settled_eur_micros bigint not null default 0 check (settled_eur_micros >= 0),
  reserved_eur_micros bigint not null default 0 check (reserved_eur_micros >= 0),
  estimated_usd_micros bigint not null default 0 check (estimated_usd_micros >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  successful_scans integer not null default 0 check (successful_scans >= 0)
);
-- Each historical import has a stable provenance ID. Reapplying the migration
-- must neither overwrite newer usage nor add this same batch twice.
create table if not exists dv_v16_private.openai_cost_import (
  source_id text primary key,
  period_start date not null,
  estimated_eur_micros bigint not null check (estimated_eur_micros>=0),
  estimated_usd_micros bigint not null check (estimated_usd_micros>=0),
  successful_scans integer not null check (successful_scans>=0),
  source_note text not null
);
-- Known minimum only; not a complete provider billing history. Currency values
-- use the fixed ECB valuation from 2026-09-11: 1 EUR = 1.1592 USD.
-- https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
with imported as (
  insert into dv_v16_private.openai_cost_import
    (source_id,period_start,estimated_eur_micros,estimated_usd_micros,successful_scans,source_note)
  values ('pilot-2026-09-11-10-requests','2026-09-01',26601,30835,10,
    'OPENAI-RESULTS-2026-09-11.md: 10 completed requests, 26793 total tokens, USD 0.03083475 estimated. Later scans not included.')
  on conflict (source_id) do nothing returning *
)
insert into dv_v16_private.openai_monthly_cost
  (period_start,settled_eur_micros,estimated_usd_micros,successful_scans)
select period_start,estimated_eur_micros,estimated_usd_micros,successful_scans from imported
on conflict (period_start) do update set
  settled_eur_micros=dv_v16_private.openai_monthly_cost.settled_eur_micros+excluded.settled_eur_micros,
  estimated_usd_micros=dv_v16_private.openai_monthly_cost.estimated_usd_micros+excluded.estimated_usd_micros,
  successful_scans=dv_v16_private.openai_monthly_cost.successful_scans+excluded.successful_scans;
alter table dv_v16_private.openai_scan_policy enable row level security;
alter table dv_v16_private.openai_weekly_usage enable row level security;
alter table dv_v16_private.openai_scan_reservation enable row level security;
alter table dv_v16_private.openai_monthly_cost enable row level security;
alter table dv_v16_private.openai_cost_import enable row level security;
revoke all on dv_v16_private.openai_scan_policy, dv_v16_private.openai_weekly_usage,
  dv_v16_private.openai_scan_reservation, dv_v16_private.openai_monthly_cost,
  dv_v16_private.openai_cost_import from public, anon, authenticated;

create or replace function dv_v16_private.is_owner_caller()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    and exists (select 1 from public.profiles p where p.id=auth.uid()
      and p.role = 'owner' and p.account_status = 'active')
$$;

-- Both reservation and settlement need the server credential in addition to
-- the verified user's JWT. A browser must not be able to reserve the shared
-- budget or submit fabricated costs directly through PostgREST.
create or replace function dv_v16_private.require_openai_server()
returns void language plpgsql security definer set search_path='' as $$
declare v_expected text;
  v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_key text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'authentication required';
  end if;
  v_key:=coalesce(v_headers->>'x-dv-accounting-key','');
  select accounting_key_sha256 into v_expected from dv_v16_private.openai_scan_policy where singleton;
  if length(v_key)<32 or v_expected is null or
    encode(sha256(convert_to(v_key,'UTF8')),'hex')<>v_expected then
    raise exception 'server accounting authorization required';
  end if;
end $$;

create or replace function dv_v16_private.openai_scan_budget_for_caller()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.openai_scan_policy%rowtype;
  u dv_v16_private.openai_weekly_usage%rowtype;
  w date:=dv_v16_private.week_start_at(now());
  m date:=(date_trunc('month',now() at time zone 'Europe/Berlin'))::date;
  c dv_v16_private.openai_monthly_cost%rowtype;
  v_enabled boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  select * into p from dv_v16_private.openai_scan_policy where singleton;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('active','beta')) then raise exception 'active account required'; end if;
  select * into u from dv_v16_private.openai_weekly_usage where user_id=auth.uid() and week_start=w;
  select * into c from dv_v16_private.openai_monthly_cost where period_start=m;
  v_enabled:=coalesce(p.enabled,false) and p.accounting_key_sha256 is not null and
    coalesce(c.settled_eur_micros,0)+coalesce(c.reserved_eur_micros,0)+p.reservation_eur_micros<=p.monthly_budget_eur_micros;
  return jsonb_build_object('provider','openai','enabled',v_enabled,
    'remaining',case when v_enabled then greatest(0,p.raw_weekly_limit-coalesce(u.raw_used,0)) else 0 end,
    'slabRemaining',case when v_enabled then greatest(0,p.slab_weekly_limit-coalesce(u.slab_used,0)) else 0 end,
    'rawLimit',p.raw_weekly_limit,'slabLimit',p.slab_weekly_limit,
    'resetsAt',(w+7)::timestamp at time zone 'Europe/Berlin',
    'monthlyBudgetEurMicros',p.monthly_budget_eur_micros,
    'monthlyCommittedEurMicros',coalesce(c.settled_eur_micros,0)+coalesce(c.reserved_eur_micros,0),
    'monthlyRemainingEurMicros',greatest(0,p.monthly_budget_eur_micros-coalesce(c.settled_eur_micros,0)-coalesce(c.reserved_eur_micros,0)),
    'budgetResetsAt',(m+interval '1 month')::timestamp at time zone 'Europe/Berlin');
end $$;

create or replace function dv_v16_private.reserve_openai_for_caller(
  p_request_id uuid,p_image_sha256 text,p_tcg text,p_kind text default 'raw'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.openai_scan_policy%rowtype;
  u dv_v16_private.openai_weekly_usage%rowtype;
  w date:=dv_v16_private.week_start_at(now());
  m date:=(date_trunc('month',now() at time zone 'Europe/Berlin'))::date;
  c dv_v16_private.openai_monthly_cost%rowtype;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  if p_request_id is null or p_image_sha256 is null or p_image_sha256 !~ '^[a-f0-9]{64}$'
    or p_tcg is null or p_kind is null
    or p_tcg not in ('pokemon','one_piece') or p_kind not in ('raw','slab') then raise exception 'invalid reservation'; end if;
  select * into p from dv_v16_private.openai_scan_policy where singleton for update;
  if not found or not p.enabled or p.accounting_key_sha256 is null then return jsonb_build_object('allowed',false,'reason','closed'); end if;
  perform dv_v16_private.require_openai_server();
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('active','beta')) then raise exception 'active account required'; end if;
  insert into dv_v16_private.openai_monthly_cost(period_start) values(m) on conflict do nothing;
  select * into c from dv_v16_private.openai_monthly_cost where period_start=m for update;
  if c.settled_eur_micros+c.reserved_eur_micros+p.reservation_eur_micros > p.monthly_budget_eur_micros then
    return jsonb_build_object('allowed',false,'reason','monthly_budget');
  end if;
  if exists(select 1 from dv_v16_private.openai_scan_reservation where user_id=auth.uid()
    and (request_id=p_request_id or (week_start=w and image_sha256=p_image_sha256 and tcg=p_tcg and kind=p_kind))) then
    return jsonb_build_object('allowed',false,'reason','duplicate');
  end if;
  insert into dv_v16_private.openai_weekly_usage(user_id,week_start) values(auth.uid(),w) on conflict do nothing;
  select * into u from dv_v16_private.openai_weekly_usage where user_id=auth.uid() and week_start=w for update;
  if (p_kind='raw' and u.raw_used>=p.raw_weekly_limit) or (p_kind='slab' and u.slab_used>=p.slab_weekly_limit) then
    return jsonb_build_object('allowed',false,'reason','weekly_limit');
  end if;
  insert into dv_v16_private.openai_scan_reservation(user_id,request_id,week_start,image_sha256,tcg,kind,reserved_eur_micros,eur_per_usd_micros)
  values(auth.uid(),p_request_id,w,p_image_sha256,p_tcg,p_kind,p.reservation_eur_micros,p.eur_per_usd_micros);
  update dv_v16_private.openai_monthly_cost set reserved_eur_micros=reserved_eur_micros+p.reservation_eur_micros
  where period_start=m;
  update dv_v16_private.openai_weekly_usage
  set raw_used=raw_used+case when p_kind='raw' then 1 else 0 end,
      slab_used=slab_used+case when p_kind='slab' then 1 else 0 end
  where user_id=auth.uid() and week_start=w;
  return dv_v16_private.openai_scan_budget_for_caller()||jsonb_build_object('allowed',true,'eurPerUsdMicros',p.eur_per_usd_micros);
end $$;

create or replace function dv_v16_private.settle_openai_for_caller(
  p_request_id uuid,p_input_tokens integer,p_output_tokens integer,
  p_estimated_cost_eur_micros bigint,p_estimated_cost_usd_micros bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r dv_v16_private.openai_scan_reservation%rowtype;
  m date;
  p dv_v16_private.openai_scan_policy%rowtype;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  if p_request_id is null or p_input_tokens is null or p_output_tokens is null
    or p_estimated_cost_eur_micros is null or p_estimated_cost_usd_micros is null
    or p_input_tokens not between 0 and 1000000 or p_output_tokens not between 0 and 100000
    or p_estimated_cost_eur_micros not between 0 and 1000000 or p_estimated_cost_usd_micros not between 0 and 1000000
    then raise exception 'invalid OpenAI settlement'; end if;
  -- Share a consistent lock order with reserve/update to prevent settlement
  -- racing a policy change or a duplicate reservation.
  select * into p from dv_v16_private.openai_scan_policy where singleton for update;
  perform dv_v16_private.require_openai_server();
  select * into r from dv_v16_private.openai_scan_reservation
    where user_id=auth.uid() and request_id=p_request_id for update;
  if not found then raise exception 'reservation not found'; end if;
  m:=(date_trunc('month',r.reserved_at at time zone 'Europe/Berlin'))::date;
  if r.settled_at is not null then return jsonb_build_object('settled',true,'duplicate',true); end if;
  if p_estimated_cost_eur_micros<>ceil(p_estimated_cost_usd_micros::numeric*r.eur_per_usd_micros/1000000) then raise exception 'invalid currency conversion'; end if;
  if p_estimated_cost_eur_micros > r.reserved_eur_micros then raise exception 'cost exceeds reservation'; end if;
  update dv_v16_private.openai_scan_reservation set estimated_cost_eur_micros=p_estimated_cost_eur_micros,
    estimated_cost_usd_micros=p_estimated_cost_usd_micros,input_tokens=p_input_tokens,
    output_tokens=p_output_tokens,settled_at=now() where user_id=auth.uid() and request_id=p_request_id;
  update dv_v16_private.openai_monthly_cost set
    reserved_eur_micros=reserved_eur_micros-r.reserved_eur_micros,
    settled_eur_micros=settled_eur_micros+p_estimated_cost_eur_micros,
    estimated_usd_micros=estimated_usd_micros+p_estimated_cost_usd_micros,
    input_tokens=input_tokens+p_input_tokens,output_tokens=output_tokens+p_output_tokens,
    successful_scans=successful_scans+1 where period_start=m;
  if not found then raise exception 'accounting period missing'; end if;
  return jsonb_build_object('settled',true,'duplicate',false);
end $$;

create or replace function dv_v16_private.owner_openai_scan_settings_for_caller()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.openai_scan_policy%rowtype;
  w date:=dv_v16_private.week_start_at(now());
  m date:=(date_trunc('month',now() at time zone 'Europe/Berlin'))::date;
  v_raw_used bigint:=0; v_slab_used bigint:=0; v_users bigint:=0;
  c dv_v16_private.openai_monthly_cost%rowtype;
begin
  if not dv_v16_private.is_owner_caller() then raise exception 'owner access required'; end if;
  select * into p from dv_v16_private.openai_scan_policy where singleton;
  select coalesce(sum(raw_used),0),coalesce(sum(slab_used),0),count(*)
    into v_raw_used,v_slab_used,v_users from dv_v16_private.openai_weekly_usage where week_start=w;
  select * into c from dv_v16_private.openai_monthly_cost where period_start=m;
  return jsonb_build_object('provider','openai','enabled',coalesce(p.enabled,false),
    'effectiveEnabled',coalesce(p.enabled,false) and p.accounting_key_sha256 is not null and
      coalesce(c.settled_eur_micros,0)+coalesce(c.reserved_eur_micros,0)+p.reservation_eur_micros<=p.monthly_budget_eur_micros,
    'rawLimit',coalesce(p.raw_weekly_limit,0),
    'slabLimit',coalesce(p.slab_weekly_limit,0),'maxRawLimit',50,'maxSlabLimit',10,
    'weekStart',w,'weeklyRawUsed',v_raw_used,'weeklySlabUsed',v_slab_used,'weeklyUsers',v_users,
    'monthlyBudgetEurMicros',p.monthly_budget_eur_micros,'maxMonthlyBudgetEurCents',25000,
    'monthlyEstimatedEurMicros',coalesce(c.settled_eur_micros,0),
    'monthlyReservedEurMicros',coalesce(c.reserved_eur_micros,0),
    'monthlyRemainingEurMicros',greatest(0,p.monthly_budget_eur_micros-coalesce(c.settled_eur_micros,0)-coalesce(c.reserved_eur_micros,0)),
    'monthlyEstimatedUsdMicros',coalesce(c.estimated_usd_micros,0),
    'monthlyInputTokens',coalesce(c.input_tokens,0),'monthlyOutputTokens',coalesce(c.output_tokens,0),
    'monthlySuccessfulScans',coalesce(c.successful_scans,0),'budgetPeriodStart',m,
    'budgetResetsAt',(m+interval '1 month')::timestamp at time zone 'Europe/Berlin',
    'accountingReady',p.accounting_key_sha256 is not null,
    'trackingStartedAt',p.tracking_started_at,'legacyUnclassifiedAttempts',p.legacy_unclassified_attempts,
    'eurPerUsdMicros',p.eur_per_usd_micros,'fxDate',p.fx_date,
    'historicalImportedScans',(select coalesce(sum(successful_scans),0) from dv_v16_private.openai_cost_import where period_start=m));
end $$;

create or replace function dv_v16_private.update_openai_scan_policy_for_caller(
  p_enabled boolean,p_raw_weekly_limit integer,p_slab_weekly_limit integer,p_monthly_budget_eur_cents integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
  if not dv_v16_private.is_owner_caller() then raise exception 'owner access required'; end if;
  if p_enabled is null or p_raw_weekly_limit is null or p_slab_weekly_limit is null or p_monthly_budget_eur_cents is null
    or p_raw_weekly_limit not between 0 and 50 or p_slab_weekly_limit not between 0 and 10
    or p_monthly_budget_eur_cents not between 0 and 25000 then raise exception 'invalid OpenAI scanner policy'; end if;
  select jsonb_build_object('enabled',enabled,'rawLimit',raw_weekly_limit,'slabLimit',slab_weekly_limit,
    'monthlyBudgetEurMicros',monthly_budget_eur_micros)
    into v_before from dv_v16_private.openai_scan_policy where singleton for update;
  update dv_v16_private.openai_scan_policy set enabled=p_enabled,
    raw_weekly_limit=p_raw_weekly_limit,slab_weekly_limit=p_slab_weekly_limit,
    monthly_budget_eur_micros=p_monthly_budget_eur_cents::bigint*10000 where singleton;
  insert into public.admin_audit_log(actor_id,target_user_id,action,details)
  values(auth.uid(),auth.uid(),'scanner_v16_openai_policy_updated',jsonb_build_object(
    'provider','openai','before',v_before,'after',jsonb_build_object(
      'enabled',p_enabled,'rawLimit',p_raw_weekly_limit,'slabLimit',p_slab_weekly_limit,
      'monthlyBudgetEurMicros',p_monthly_budget_eur_cents::bigint*10000)));
  return dv_v16_private.owner_openai_scan_settings_for_caller();
end $$;

create or replace function public.dv_v16_openai_scan_budget() returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.openai_scan_budget_for_caller()$$;
create or replace function public.dv_v16_reserve_openai_scan(
  p_request_id uuid,p_image_sha256 text,p_tcg text,p_kind text default 'raw'
) returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.reserve_openai_for_caller($1,$2,$3,$4)$$;
create or replace function public.dv_v16_settle_openai_scan(
  p_request_id uuid,p_input_tokens integer,p_output_tokens integer,
  p_estimated_cost_eur_micros bigint,p_estimated_cost_usd_micros bigint
) returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.settle_openai_for_caller($1,$2,$3,$4,$5)$$;
create or replace function public.dv_v16_owner_openai_scan_settings() returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.owner_openai_scan_settings_for_caller()$$;
create or replace function public.dv_v16_owner_update_openai_scan_policy(
  p_enabled boolean,p_raw_weekly_limit integer,p_slab_weekly_limit integer,p_monthly_budget_eur_cents integer
) returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.update_openai_scan_policy_for_caller($1,$2,$3,$4)$$;

-- Restrict only this additive feature. Revoking every function in the private
-- schema would silently break the still-deployed older scanner during rollout.
revoke all on function dv_v16_private.is_owner_caller(),dv_v16_private.require_openai_server(),
  dv_v16_private.openai_scan_budget_for_caller(),dv_v16_private.reserve_openai_for_caller(uuid,text,text,text),
  dv_v16_private.settle_openai_for_caller(uuid,integer,integer,bigint,bigint),
  dv_v16_private.owner_openai_scan_settings_for_caller(),
  dv_v16_private.update_openai_scan_policy_for_caller(boolean,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.dv_v16_openai_scan_budget(),public.dv_v16_reserve_openai_scan(uuid,text,text,text),
  public.dv_v16_settle_openai_scan(uuid,integer,integer,bigint,bigint),public.dv_v16_owner_openai_scan_settings(),
  public.dv_v16_owner_update_openai_scan_policy(boolean,integer,integer,integer) from public,anon;
grant execute on function dv_v16_private.is_owner_caller(),dv_v16_private.openai_scan_budget_for_caller(),
  dv_v16_private.reserve_openai_for_caller(uuid,text,text,text),dv_v16_private.owner_openai_scan_settings_for_caller(),
  dv_v16_private.settle_openai_for_caller(uuid,integer,integer,bigint,bigint),
  dv_v16_private.update_openai_scan_policy_for_caller(boolean,integer,integer,integer),public.dv_v16_openai_scan_budget(),
  public.dv_v16_reserve_openai_scan(uuid,text,text,text),public.dv_v16_settle_openai_scan(uuid,integer,integer,bigint,bigint),
  public.dv_v16_owner_openai_scan_settings(),public.dv_v16_owner_update_openai_scan_policy(boolean,integer,integer,integer) to authenticated;
commit;
