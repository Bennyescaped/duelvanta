-- DUELVANTA Stripe Connect sandbox foundation V1.
-- REVIEW ONLY: apply after marketplace compliance migrations through
-- account-data-rights-v1.sql. This file does not activate payments or change production.
-- The intended funds flow is a Stripe Connect direct charge on the seller account.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.market_payment_configuration (
  singleton boolean primary key default true check (singleton),
  provider text not null default 'stripe_connect' check (provider='stripe_connect'),
  charge_model text not null default 'direct_charge' check (charge_model='direct_charge'),
  sandbox_enabled boolean not null default false,
  live_mode boolean not null default false check (live_mode=false),
  currency text not null default 'EUR' check (currency='EUR'),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  platform_fee_fixed_cents integer not null default 0 check (platform_fee_fixed_cents between 0 and 100000),
  platform_fee_tax_treatment text not null default 'review_required'
    check (platform_fee_tax_treatment in ('review_required','tax_exempt','reverse_charge','gross_includes_tax')),
  seller_invoice_issuance_enabled boolean not null default false,
  policy_version text not null default 'stripe-connect-sandbox-v1',
  updated_at timestamptz not null default now()
);
insert into dv_market_private.market_payment_configuration(singleton) values(true)
on conflict(singleton) do nothing;

create table if not exists dv_market_private.market_stripe_accounts (
  seller_id uuid primary key references auth.users(id) on delete restrict,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  live_mode boolean not null default false check (live_mode=false),
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started','requirements_due','pending_review','ready','restricted','disabled')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_due_count integer not null default 0 check (requirements_due_count>=0),
  provider_state_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (onboarding_status<>'ready' or (charges_enabled and details_submitted))
);

create table if not exists dv_market_private.market_stripe_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete restrict,
  request_key uuid not null,
  state text not null default 'prepared' check (state in ('prepared','account_created','link_created','completed','failed')),
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(seller_id,request_key)
);
create unique index if not exists market_stripe_onboarding_one_open_idx
  on dv_market_private.market_stripe_onboarding_requests(seller_id)
  where state in ('prepared','account_created','link_created');

create table if not exists dv_market_private.market_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.market_orders(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  stripe_account_id text not null,
  idempotency_key uuid not null,
  state text not null default 'prepared' check (state in (
    'prepared','session_created','processing','paid','failed','expired','refund_pending','partially_refunded','refunded','disputed'
  )),
  currency text not null default 'EUR' check (currency='EUR'),
  amount_due_cents integer not null check (amount_due_cents>0),
  platform_fee_cents integer not null check (platform_fee_cents between 0 and amount_due_cents),
  seller_net_cents integer generated always as (amount_due_cents-platform_fee_cents) stored,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  paid_cents integer not null default 0 check (paid_cents between 0 and amount_due_cents),
  refunded_cents integer not null default 0 check (refunded_cents between 0 and paid_cents),
  prepared_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(buyer_id,idempotency_key),
  unique(order_id,id)
);
create unique index if not exists market_payment_attempts_one_open_idx
  on dv_market_private.market_payment_attempts(order_id)
  where state in ('prepared','session_created','processing','paid','refund_pending','partially_refunded');

create table if not exists dv_market_private.market_payment_allocations (
  attempt_id uuid not null references dv_market_private.market_payment_attempts(id) on delete restrict,
  contract_snapshot_id uuid not null references dv_market_private.market_contract_snapshots(id) on delete restrict,
  gross_cents integer not null check (gross_cents>0),
  platform_fee_cents integer not null check (platform_fee_cents between 0 and gross_cents),
  refunded_cents integer not null default 0 check (refunded_cents between 0 and gross_cents),
  tax_event_id uuid,
  primary key(attempt_id,contract_snapshot_id)
);

create table if not exists dv_market_private.market_stripe_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null,
  stripe_account_id text,
  live_mode boolean not null check (live_mode=false),
  object_id text,
  payload_sha256 bytea not null,
  normalized_data jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received','applied','ignored','rejected')),
  processing_note text,
  provider_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists dv_market_private.market_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.market_orders(id) on delete restrict,
  attempt_id uuid not null references dv_market_private.market_payment_attempts(id) on delete restrict,
  request_key uuid not null unique,
  amount_cents integer not null check (amount_cents>0),
  reason text not null,
  status text not null default 'prepared' check (status in ('prepared','submitted','pending','succeeded','failed')),
  stripe_refund_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dv_market_private.market_invoice_authorizations (
  seller_id uuid primary key references auth.users(id) on delete restrict,
  authorized boolean not null default false,
  authorization_version text,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  check (not authorized or (authorization_version is not null and granted_at is not null and withdrawn_at is null))
);

create table if not exists dv_market_private.market_financial_documents (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dv_market_private.market_payment_attempts(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  document_kind text not null check (document_kind in ('seller_goods_invoice','platform_fee_invoice','provider_payment_evidence')),
  document_status text not null default 'review_required' check (document_status in ('review_required','issued','void')),
  issuer_role text not null check (issuer_role in ('seller','platform','payment_provider')),
  authorization_version text,
  currency text not null default 'EUR' check (currency='EUR'),
  net_cents integer,
  tax_cents integer,
  gross_cents integer not null check (gross_cents>=0),
  tax_treatment text not null default 'review_required',
  immutable_snapshot jsonb not null,
  content_sha256 bytea not null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique(attempt_id,document_kind)
);

alter table dv_market_private.market_payment_configuration enable row level security;
alter table dv_market_private.market_stripe_accounts enable row level security;
alter table dv_market_private.market_stripe_onboarding_requests enable row level security;
alter table dv_market_private.market_payment_attempts enable row level security;
alter table dv_market_private.market_payment_allocations enable row level security;
alter table dv_market_private.market_stripe_events enable row level security;
alter table dv_market_private.market_refund_requests enable row level security;
alter table dv_market_private.market_invoice_authorizations enable row level security;
alter table dv_market_private.market_financial_documents enable row level security;
revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.block_market_payment_evidence_mutation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'market_payment_evidence_is_immutable'; end
$$;
revoke all on function dv_market_private.block_market_payment_evidence_mutation() from public, anon, authenticated;
drop trigger if exists market_stripe_events_immutable on dv_market_private.market_stripe_events;
create trigger market_stripe_events_immutable before update or delete on dv_market_private.market_stripe_events
for each row when (old.processing_status in ('applied','ignored','rejected'))
execute function dv_market_private.block_market_payment_evidence_mutation();
drop trigger if exists market_financial_documents_immutable on dv_market_private.market_financial_documents;
create trigger market_financial_documents_immutable before update or delete on dv_market_private.market_financial_documents
for each row when (old.document_status in ('issued','void'))
execute function dv_market_private.block_market_payment_evidence_mutation();

create or replace function public.get_market_payment_sandbox_status()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,dv_market_private as $$
declare c dv_market_private.market_payment_configuration%rowtype;
begin
  select * into c from dv_market_private.market_payment_configuration where singleton;
  return jsonb_build_object('provider','stripe_connect','charge_model','direct_charge',
    'sandbox_enabled',coalesce(c.sandbox_enabled,false),'live_mode',false,
    'notice','Sandbox-Entwurf. Keine echte Zahlung, Auszahlung oder Erstattung wird behauptet.');
end
$$;
revoke all on function public.get_market_payment_sandbox_status() from public, anon;
grant execute on function public.get_market_payment_sandbox_status() to authenticated;

create or replace function public.prepare_market_stripe_onboarding(p_seller_id uuid,p_request_key uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare c dv_market_private.market_payment_configuration%rowtype;r dv_market_private.market_stripe_onboarding_requests%rowtype;
  a dv_market_private.market_stripe_accounts%rowtype;s public.market_seller_accounts%rowtype;
begin
  if p_seller_id is null or p_request_key is null then raise exception 'stripe_onboarding_input_invalid'; end if;
  select * into c from dv_market_private.market_payment_configuration where singleton;
  if not found or not c.sandbox_enabled or c.live_mode then raise exception 'stripe_sandbox_disabled'; end if;
  select * into s from public.market_seller_accounts where seller_id=p_seller_id;
  if not found or s.onboarding_status<>'active' or s.seller_type not in ('private','trader') then raise exception 'seller_onboarding_not_approved'; end if;
  select * into r from dv_market_private.market_stripe_onboarding_requests where seller_id=p_seller_id and request_key=p_request_key;
  select * into a from dv_market_private.market_stripe_accounts where seller_id=p_seller_id;
  if found and a.live_mode then raise exception 'stripe_live_account_forbidden'; end if;
  if r.id is not null then return jsonb_build_object('onboarding_request_id',r.id,'onboarding_state',r.state,
    'stripe_account_id',a.stripe_account_id,'seller_type',s.seller_type,'country_code',s.country_code,'replayed',true,'live_mode',false); end if;
  insert into dv_market_private.market_stripe_onboarding_requests(seller_id,request_key)
  values(p_seller_id,p_request_key) returning * into r;
  return jsonb_build_object('onboarding_request_id',r.id,'onboarding_state',r.state,'stripe_account_id',a.stripe_account_id,
    'seller_type',s.seller_type,'country_code',s.country_code,'replayed',false,'live_mode',false);
end
$$;
revoke all on function public.prepare_market_stripe_onboarding(uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_onboarding(uuid,uuid) to service_role;

create or replace function public.register_market_stripe_test_account(
  p_onboarding_request_id uuid,p_seller_id uuid,p_account_id text
) returns void language plpgsql security definer
set search_path=pg_catalog,dv_market_private as $$
begin
  if p_account_id !~ '^acct_[A-Za-z0-9]+$' then raise exception 'stripe_account_id_invalid'; end if;
  if not exists(select 1 from dv_market_private.market_stripe_onboarding_requests
    where id=p_onboarding_request_id and seller_id=p_seller_id and state in ('prepared','account_created','link_created')) then
    raise exception 'stripe_onboarding_request_invalid';
  end if;
  insert into dv_market_private.market_stripe_accounts(seller_id,stripe_account_id,live_mode,onboarding_status)
  values(p_seller_id,p_account_id,false,'not_started')
  on conflict(seller_id) do update set stripe_account_id=excluded.stripe_account_id,updated_at=now()
  where dv_market_private.market_stripe_accounts.stripe_account_id=excluded.stripe_account_id
    and not dv_market_private.market_stripe_accounts.live_mode;
  if not found then raise exception 'stripe_account_binding_conflict'; end if;
  update dv_market_private.market_stripe_onboarding_requests set state='account_created',stripe_account_id=p_account_id,updated_at=now()
  where id=p_onboarding_request_id;
end
$$;
revoke all on function public.register_market_stripe_test_account(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.register_market_stripe_test_account(uuid,uuid,text) to service_role;

create or replace function public.mark_market_stripe_onboarding_link_created(p_onboarding_request_id uuid,p_account_id text)
returns void language plpgsql security definer set search_path=pg_catalog,dv_market_private as $$
begin
  update dv_market_private.market_stripe_onboarding_requests set state='link_created',updated_at=now()
  where id=p_onboarding_request_id and stripe_account_id=p_account_id and state in ('account_created','link_created');
  if not found then raise exception 'stripe_onboarding_link_conflict'; end if;
end
$$;
revoke all on function public.mark_market_stripe_onboarding_link_created(uuid,text) from public, anon, authenticated;
grant execute on function public.mark_market_stripe_onboarding_link_created(uuid,text) to service_role;

create or replace function public.prepare_market_stripe_payment(
  p_order_id uuid,p_buyer_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare c dv_market_private.market_payment_configuration%rowtype;
  o public.market_orders%rowtype;a dv_market_private.market_payment_attempts%rowtype;
  s dv_market_private.market_stripe_accounts%rowtype;v_total integer;v_fee integer;v_sum integer:=0;
  r record;v_gross integer;v_alloc_fee integer;v_last uuid;
begin
  if p_order_id is null or p_buyer_id is null or p_idempotency_key is null then raise exception 'stripe_payment_input_invalid'; end if;
  select * into c from dv_market_private.market_payment_configuration where singleton for update;
  if not found or not c.sandbox_enabled or c.live_mode then raise exception 'stripe_sandbox_disabled'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.buyer_id<>p_buyer_id then raise exception 'stripe_order_access_denied'; end if;
  if o.status not in ('open','in_progress') or o.shipped_at is not null then raise exception 'stripe_order_not_payable'; end if;
  if o.shipping_quote_status='review_required' then raise exception 'stripe_shipping_review_required'; end if;
  if o.payment_provider not in ('manual_beta','stripe_connect') or coalesce(o.paid_amount,0)>0 then raise exception 'stripe_order_payment_state_invalid'; end if;
  select * into a from dv_market_private.market_payment_attempts where buyer_id=p_buyer_id and idempotency_key=p_idempotency_key;
  if found then
    if a.order_id<>p_order_id then raise exception 'stripe_payment_idempotency_conflict'; end if;
    return jsonb_build_object('attempt_id',a.id,'stripe_account_id',a.stripe_account_id,
      'amount_due_cents',a.amount_due_cents,'platform_fee_cents',a.platform_fee_cents,'replayed',true);
  end if;
  select * into s from dv_market_private.market_stripe_accounts where seller_id=o.seller_id;
  if not found or s.live_mode or s.onboarding_status<>'ready' or not s.charges_enabled then raise exception 'stripe_seller_not_ready'; end if;
  v_total:=round(o.total_amount*100)::integer;
  if v_total<=0 then raise exception 'stripe_order_amount_invalid'; end if;
  v_fee:=least(v_total,round(v_total*c.platform_fee_bps/10000.0)::integer+c.platform_fee_fixed_cents);
  insert into dv_market_private.market_payment_attempts(
    order_id,buyer_id,seller_id,stripe_account_id,idempotency_key,amount_due_cents,platform_fee_cents
  ) values(p_order_id,p_buyer_id,o.seller_id,s.stripe_account_id,p_idempotency_key,v_total,v_fee) returning * into a;

  select s2.id into v_last from dv_market_private.market_contract_snapshots s2
  where s2.order_id=p_order_id order by s2.id desc limit 1;
  for r in select s2.id,round(s2.goods_total*100)::integer goods_cents
    from dv_market_private.market_contract_snapshots s2 where s2.order_id=p_order_id order by s2.id
  loop
    v_gross:=r.goods_cents;
    if r.id=v_last then v_gross:=v_total-v_sum; end if;
    if v_gross<=0 then raise exception 'stripe_payment_allocation_invalid'; end if;
    v_alloc_fee:=case when r.id=v_last then v_fee-coalesce((select sum(platform_fee_cents) from dv_market_private.market_payment_allocations where attempt_id=a.id),0)
      else floor(v_fee*v_gross::numeric/v_total)::integer end;
    insert into dv_market_private.market_payment_allocations(attempt_id,contract_snapshot_id,gross_cents,platform_fee_cents)
    values(a.id,r.id,v_gross,v_alloc_fee);
    v_sum:=v_sum+v_gross;
  end loop;
  if v_last is null or v_sum<>v_total then raise exception 'stripe_payment_allocation_invalid'; end if;
  update public.market_orders set payment_provider='stripe_connect',payment_status='pending',paid_amount=0,updated_at=now() where id=o.id;
  update public.market_deals set payment_provider='stripe_connect',payment_status='pending',updated_at=now() where order_id=o.id;
  return jsonb_build_object('attempt_id',a.id,'stripe_account_id',a.stripe_account_id,
    'amount_due_cents',v_total,'platform_fee_cents',v_fee,'currency','EUR','charge_model','direct_charge','live_mode',false);
end
$$;
revoke all on function public.prepare_market_stripe_payment(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_payment(uuid,uuid,uuid) to service_role;

create or replace function public.bind_market_stripe_checkout_session(
  p_attempt_id uuid,p_session_id text
) returns void language plpgsql security definer
set search_path=pg_catalog,dv_market_private as $$
begin
  if p_session_id !~ '^cs_test_[A-Za-z0-9]+$' then raise exception 'stripe_session_invalid'; end if;
  update dv_market_private.market_payment_attempts set stripe_checkout_session_id=p_session_id,state='session_created',updated_at=now()
  where id=p_attempt_id and state in ('prepared','session_created')
    and (stripe_checkout_session_id is null or stripe_checkout_session_id=p_session_id);
  if not found then raise exception 'stripe_attempt_session_conflict'; end if;
end
$$;
revoke all on function public.bind_market_stripe_checkout_session(uuid,text) from public, anon, authenticated;
grant execute on function public.bind_market_stripe_checkout_session(uuid,text) to service_role;

create or replace function public.apply_market_stripe_event(
  p_event_id text,p_event_type text,p_account_id text,p_live_mode boolean,p_object_id text,
  p_payload_sha256 text,p_provider_created_at timestamptz,p_data jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare a dv_market_private.market_payment_attempts%rowtype;v_status text:='ignored';v_note text:='event_not_actionable';
  v_amount integer:=coalesce((p_data->>'amount_cents')::integer,0);r record;v_tax jsonb;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_live_mode or p_payload_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'stripe_event_invalid'; end if;
  insert into dv_market_private.market_stripe_events(stripe_event_id,event_type,stripe_account_id,live_mode,object_id,payload_sha256,normalized_data,provider_created_at)
  values(p_event_id,p_event_type,p_account_id,false,p_object_id,decode(p_payload_sha256,'hex'),coalesce(p_data,'{}'),p_provider_created_at)
  on conflict(stripe_event_id) do nothing;
  if not found then return jsonb_build_object('event_id',p_event_id,'replayed',true); end if;

  if p_event_type='account.updated' then
    if p_object_id<>p_account_id then raise exception 'stripe_account_event_mismatch'; end if;
    update dv_market_private.market_stripe_accounts set
      charges_enabled=coalesce((p_data->>'charges_enabled')::boolean,false),
      payouts_enabled=coalesce((p_data->>'payouts_enabled')::boolean,false),
      details_submitted=coalesce((p_data->>'details_submitted')::boolean,false),
      requirements_due_count=greatest(coalesce((p_data->>'requirements_due_count')::integer,0),0),
      onboarding_status=case
        when nullif(p_data->>'disabled_reason','') is not null or coalesce((p_data->>'past_due_count')::integer,0)>0 then 'restricted'
        when coalesce((p_data->>'charges_enabled')::boolean,false) and coalesce((p_data->>'details_submitted')::boolean,false) then 'ready'
        when coalesce((p_data->>'requirements_due_count')::integer,0)>0 then 'requirements_due'
        else 'pending_review' end,
      provider_state_updated_at=coalesce(p_provider_created_at,now()),updated_at=now()
    where stripe_account_id=p_account_id and not live_mode;
    if not found then raise exception 'stripe_account_not_registered'; end if;
    update dv_market_private.market_stripe_onboarding_requests set
      state=case
        when coalesce((p_data->>'charges_enabled')::boolean,false) and coalesce((p_data->>'details_submitted')::boolean,false) then 'completed'
        when state='completed' then 'account_created'
        else state end,
      updated_at=now() where stripe_account_id=p_account_id;
    update dv_market_private.market_stripe_events set processing_status='applied',processing_note='seller_account_status_updated',processed_at=now()
      where stripe_event_id=p_event_id;
    return jsonb_build_object('event_id',p_event_id,'status','applied','note','seller_account_status_updated');
  end if;

  select * into a from dv_market_private.market_payment_attempts
  where stripe_account_id=p_account_id and (
    stripe_checkout_session_id=p_object_id or stripe_payment_intent_id=p_object_id or stripe_charge_id=p_object_id
    or id::text=p_data->>'attempt_id') for update;
  if not found then
    update dv_market_private.market_stripe_events set processing_status='ignored',processing_note='attempt_not_found',processed_at=now() where stripe_event_id=p_event_id;
    return jsonb_build_object('event_id',p_event_id,'status','ignored');
  end if;

  if p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') then
    if p_data->>'payment_intent_id' is null then raise exception 'stripe_payment_intent_missing'; end if;
    update dv_market_private.market_payment_attempts set stripe_payment_intent_id=p_data->>'payment_intent_id',
      state=case when p_event_type='checkout.session.completed' then 'processing' else state end,updated_at=now() where id=a.id;
    v_status:='applied';v_note:='session_bound';
  elsif p_event_type='payment_intent.succeeded' then
    if lower(coalesce(p_data->>'currency',''))<>'eur' or v_amount<>a.amount_due_cents then raise exception 'stripe_paid_amount_mismatch'; end if;
    update dv_market_private.market_payment_attempts set stripe_payment_intent_id=p_object_id,
      stripe_charge_id=p_data->>'charge_id',state='paid',paid_cents=v_amount,paid_at=coalesce(p_provider_created_at,now()),updated_at=now() where id=a.id;
    update public.market_orders set payment_status='paid',paid_amount=v_amount/100.0,provider_payment_ref=p_object_id,
      paid_at=coalesce(p_provider_created_at,now()),platform_fee_amount=a.platform_fee_cents/100.0,
      seller_net_amount=(a.amount_due_cents-a.platform_fee_cents)/100.0,updated_at=now() where id=a.order_id;
    update public.market_deals set payment_status='paid',provider_payment_ref=p_object_id,paid_at=coalesce(p_provider_created_at,now()),updated_at=now() where order_id=a.order_id;
    for r in select * from dv_market_private.market_payment_allocations where attempt_id=a.id order by contract_snapshot_id loop
      v_tax:=public.record_market_tax_remuneration(r.contract_snapshot_id,'stripe:'||p_event_id||':'||r.contract_snapshot_id,
        coalesce(p_provider_created_at,now()),r.gross_cents/100.0,r.platform_fee_cents/100.0,0,0,'payment_provider',p_object_id,
        jsonb_build_object('provider','stripe_connect','charge_model','direct_charge','live_mode',false));
      update dv_market_private.market_payment_allocations set tax_event_id=(v_tax->>'event_id')::uuid where attempt_id=a.id and contract_snapshot_id=r.contract_snapshot_id;
    end loop;
    insert into dv_market_private.market_financial_documents(attempt_id,seller_id,document_kind,document_status,issuer_role,currency,gross_cents,tax_treatment,immutable_snapshot,content_sha256,issued_at)
    values(a.id,a.seller_id,'provider_payment_evidence','issued','payment_provider','EUR',v_amount,'provider_event',
      jsonb_build_object('provider','stripe_connect','event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount,'currency','EUR','live_mode',false),
      digest(convert_to(jsonb_build_object('event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount)::text,'UTF8'),'sha256'),coalesce(p_provider_created_at,now()))
    on conflict(attempt_id,document_kind) do nothing;
    v_status:='applied';v_note:='payment_confirmed_by_provider';
  elsif p_event_type='payment_intent.payment_failed' then
    update dv_market_private.market_payment_attempts set state='failed',updated_at=now() where id=a.id and state<>'paid';
    update public.market_orders set payment_status='failed',updated_at=now() where id=a.order_id and payment_status<>'paid';
    v_status:='applied';v_note:='payment_failed_by_provider';
  elsif p_event_type='charge.refunded' then
    if v_amount<>a.paid_cents or a.paid_cents=0 then raise exception 'stripe_partial_refund_requires_review'; end if;
    update dv_market_private.market_payment_attempts set state='refunded',refunded_cents=v_amount,updated_at=now() where id=a.id;
    update public.market_orders set payment_status='refunded',refund_status='refunded',refund_amount=v_amount/100.0,
      provider_refund_ref=p_data->>'refund_id',updated_at=now() where id=a.order_id;
    for r in select x.*,e.id original_tax_event_id from dv_market_private.market_payment_allocations x
      join dv_market_private.market_tax_events e on e.id=x.tax_event_id where x.attempt_id=a.id order by x.contract_snapshot_id
    loop
      perform public.correct_market_tax_remuneration(r.original_tax_event_id,'stripe-refund:'||p_event_id||':'||r.contract_snapshot_id,
        coalesce(p_provider_created_at,now()),r.gross_cents/100.0,r.platform_fee_cents/100.0,0,0,true,p_data->>'refund_id',
        jsonb_build_object('provider','stripe_connect','full_refund',true,'live_mode',false));
      update dv_market_private.market_payment_allocations set refunded_cents=gross_cents where attempt_id=a.id and contract_snapshot_id=r.contract_snapshot_id;
    end loop;
    update dv_market_private.market_refund_requests set status='succeeded',stripe_refund_id=p_data->>'refund_id',updated_at=now()
      where attempt_id=a.id and status in ('prepared','submitted','pending');
    v_status:='applied';v_note:='full_refund_confirmed_by_provider';
  end if;
  update dv_market_private.market_stripe_events set processing_status=v_status,processing_note=v_note,processed_at=now() where stripe_event_id=p_event_id;
  return jsonb_build_object('event_id',p_event_id,'status',v_status,'note',v_note);
end
$$;
revoke all on function public.apply_market_stripe_event(text,text,text,boolean,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_market_stripe_event(text,text,text,boolean,text,text,timestamptz,jsonb) to service_role;

create or replace function public.prepare_market_stripe_full_refund(
  p_order_id uuid,p_request_key uuid,p_reason text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare a dv_market_private.market_payment_attempts%rowtype;r dv_market_private.market_refund_requests%rowtype;
begin
  if p_request_key is null or char_length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'stripe_refund_input_invalid'; end if;
  select * into r from dv_market_private.market_refund_requests where request_key=p_request_key;
  if found then return jsonb_build_object('request_id',r.id,'attempt_id',r.attempt_id,'stripe_account_id',
    (select stripe_account_id from dv_market_private.market_payment_attempts where id=r.attempt_id),'payment_intent_id',
    (select stripe_payment_intent_id from dv_market_private.market_payment_attempts where id=r.attempt_id),'amount_cents',r.amount_cents,'replayed',true); end if;
  select * into a from dv_market_private.market_payment_attempts where order_id=p_order_id and state='paid' for update;
  if not found then raise exception 'stripe_refund_not_available'; end if;
  if not exists(select 1 from public.market_orders where id=p_order_id and refund_status='provider_required') then raise exception 'stripe_refund_not_authorized'; end if;
  insert into dv_market_private.market_refund_requests(order_id,attempt_id,request_key,amount_cents,reason)
  values(p_order_id,a.id,p_request_key,a.paid_cents,left(trim(p_reason),500)) returning * into r;
  update dv_market_private.market_payment_attempts set state='refund_pending',updated_at=now() where id=a.id;
  return jsonb_build_object('request_id',r.id,'attempt_id',a.id,'stripe_account_id',a.stripe_account_id,
    'payment_intent_id',a.stripe_payment_intent_id,'amount_cents',r.amount_cents,'currency','EUR','live_mode',false);
end
$$;
revoke all on function public.prepare_market_stripe_full_refund(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_full_refund(uuid,uuid,text) to service_role;

create or replace function public.mark_market_stripe_refund_submitted(p_request_id uuid,p_refund_id text)
returns void language plpgsql security definer set search_path=pg_catalog,dv_market_private as $$
begin
  if p_refund_id !~ '^re_[A-Za-z0-9]+$' then raise exception 'stripe_refund_id_invalid'; end if;
  update dv_market_private.market_refund_requests set status='submitted',stripe_refund_id=p_refund_id,updated_at=now()
  where id=p_request_id and status in ('prepared','submitted') and (stripe_refund_id is null or stripe_refund_id=p_refund_id);
  if not found then raise exception 'stripe_refund_submission_conflict'; end if;
end
$$;
revoke all on function public.mark_market_stripe_refund_submitted(uuid,text) from public, anon, authenticated;
grant execute on function public.mark_market_stripe_refund_submitted(uuid,text) to service_role;

-- No automatic seller invoice is issued. Issuance in a seller's name requires an
-- active, versioned authorization; platform-fee tax treatment remains configurable.
create or replace function public.issue_market_financial_document(
  p_attempt_id uuid,p_document_kind text,p_snapshot jsonb,p_net_cents integer,p_tax_cents integer,p_gross_cents integer
) returns uuid language plpgsql security definer
set search_path=pg_catalog,dv_market_private as $$
declare a dv_market_private.market_payment_attempts%rowtype;c dv_market_private.market_payment_configuration%rowtype;
  v_auth dv_market_private.market_invoice_authorizations%rowtype;v_id uuid;v_issuer text;v_version text;
begin
  select * into a from dv_market_private.market_payment_attempts where id=p_attempt_id and state in ('paid','refund_pending','refunded');
  if not found then raise exception 'financial_document_payment_not_confirmed'; end if;
  select * into c from dv_market_private.market_payment_configuration where singleton;
  if p_document_kind='seller_goods_invoice' then
    select * into v_auth from dv_market_private.market_invoice_authorizations where seller_id=a.seller_id and authorized;
    if not found or not c.seller_invoice_issuance_enabled then raise exception 'seller_invoice_authorization_required'; end if;
    v_issuer:='seller';v_version:=v_auth.authorization_version;
  elsif p_document_kind='platform_fee_invoice' then
    if c.platform_fee_tax_treatment='review_required' then raise exception 'platform_fee_tax_review_required'; end if;
    v_issuer:='platform';v_version:=c.policy_version;
  else raise exception 'financial_document_kind_invalid'; end if;
  if coalesce(p_net_cents,-1)<0 or coalesce(p_tax_cents,-1)<0 or p_net_cents+p_tax_cents<>p_gross_cents then raise exception 'financial_document_amount_invalid'; end if;
  insert into dv_market_private.market_financial_documents(attempt_id,seller_id,document_kind,document_status,issuer_role,
    authorization_version,net_cents,tax_cents,gross_cents,tax_treatment,immutable_snapshot,content_sha256,issued_at)
  values(a.id,a.seller_id,p_document_kind,'issued',v_issuer,v_version,p_net_cents,p_tax_cents,p_gross_cents,c.platform_fee_tax_treatment,
    p_snapshot,digest(convert_to(p_snapshot::text,'UTF8'),'sha256'),now()) returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.issue_market_financial_document(uuid,text,jsonb,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.issue_market_financial_document(uuid,text,jsonb,integer,integer,integer) to service_role;

create or replace function public.get_my_market_payment_records(p_order_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.market_orders where id=p_order_id and v_uid in (seller_id,buyer_id)) then raise exception 'payment_record_access_denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',a.id,'state',a.state,'currency',a.currency,'amount_due_cents',a.amount_due_cents,
    'platform_fee_cents',case when v_uid=a.seller_id then a.platform_fee_cents else null end,
    'seller_net_cents',case when v_uid=a.seller_id then a.seller_net_cents else null end,
    'paid_cents',a.paid_cents,'refunded_cents',a.refunded_cents,'prepared_at',a.prepared_at,'paid_at',a.paid_at,
    'documents',(select coalesce(jsonb_agg(jsonb_build_object('document_id',d.id,'document_kind',d.document_kind,
      'document_status',d.document_status,'issuer_role',d.issuer_role,'currency',d.currency,'net_cents',d.net_cents,
      'tax_cents',d.tax_cents,'gross_cents',d.gross_cents,'tax_treatment',d.tax_treatment,
      'content_sha256',encode(d.content_sha256,'hex'),'issued_at',d.issued_at) order by d.created_at,d.id),'[]'::jsonb)
      from dv_market_private.market_financial_documents d where d.attempt_id=a.id)
  ) order by a.prepared_at,a.id),'[]'::jsonb) into v_result
  from dv_market_private.market_payment_attempts a where a.order_id=p_order_id;
  return v_result;
end
$$;
revoke all on function public.get_my_market_payment_records(uuid) from public, anon;
grant execute on function public.get_my_market_payment_records(uuid) to authenticated;

create or replace function dv_market_private.account_deletion_blockers(p_uid uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,dv_market_private as $$
  select coalesce(jsonb_agg(blocker order by blocker),'[]'::jsonb) from (
    select 'owner_account_requires_manual_transfer' blocker where exists(select 1 from public.profiles where id=p_uid and role='owner')
    union all select 'active_market_listings' where exists(select 1 from public.market_listings where seller_id=p_uid and status in ('active','reserved'))
    union all select 'open_market_offers' where exists(select 1 from public.market_offers where (seller_id=p_uid or buyer_id=p_uid) and status in ('pending','accepted'))
    union all select 'open_market_orders' where exists(select 1 from public.market_orders where (seller_id=p_uid or buyer_id=p_uid) and status not in ('completed','cancelled'))
    union all select 'open_market_cases' where exists(select 1 from public.market_order_cases c join public.market_orders o on o.id=c.order_id where (o.seller_id=p_uid or o.buyer_id=p_uid) and c.status not in ('resolved','closed','cancelled'))
    union all select 'open_notice_appeals' where exists(select 1 from dv_market_private.listing_notice_appeals where appellant_user_id=p_uid and status in ('submitted','under_review'))
    union all select 'open_payment_processing' where exists(select 1 from dv_market_private.market_payment_attempts where (seller_id=p_uid or buyer_id=p_uid) and state in ('prepared','session_created','processing','refund_pending','disputed'))
  ) b
$$;
revoke all on function dv_market_private.account_deletion_blockers(uuid) from public, anon, authenticated;
