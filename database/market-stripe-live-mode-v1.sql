-- DUELVANTA B03: explicit, default-off Stripe live mode.
-- REVIEW ONLY. Apply after market-stripe-connect-sandbox-v1.sql,
-- market-stripe-event-ordering-hardening-v1.sql and refund evidence hardening.
-- This migration does not enable sandbox or live payments by itself.

alter table dv_market_private.market_payment_configuration
  drop constraint if exists market_payment_configuration_live_mode_check;
alter table dv_market_private.market_payment_configuration
  add constraint market_payment_configuration_mode_check check (not (sandbox_enabled and live_mode));

alter table dv_market_private.market_stripe_accounts
  drop constraint if exists market_stripe_accounts_live_mode_check;
alter table dv_market_private.market_stripe_events
  drop constraint if exists market_stripe_events_live_mode_check;

alter table dv_market_private.market_stripe_onboarding_requests
  add column if not exists live_mode boolean not null default false;
alter table dv_market_private.market_payment_attempts
  add column if not exists live_mode boolean not null default false;

-- Keep sandbox and live connected accounts isolated for the same seller.
alter table dv_market_private.market_stripe_accounts
  drop constraint if exists market_stripe_accounts_pkey;
alter table dv_market_private.market_stripe_accounts
  add constraint market_stripe_accounts_pkey primary key(seller_id,live_mode);
drop index if exists dv_market_private.market_stripe_onboarding_one_open_idx;
create unique index market_stripe_onboarding_one_open_idx
  on dv_market_private.market_stripe_onboarding_requests(seller_id,live_mode)
  where state in ('prepared','account_created','link_created');

create or replace function public.prepare_market_stripe_onboarding(p_seller_id uuid,p_request_key uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare c dv_market_private.market_payment_configuration%rowtype;r dv_market_private.market_stripe_onboarding_requests%rowtype;
  a dv_market_private.market_stripe_accounts%rowtype;s public.market_seller_accounts%rowtype;
begin
  if p_seller_id is null or p_request_key is null then raise exception 'stripe_onboarding_input_invalid'; end if;
  select * into c from dv_market_private.market_payment_configuration where singleton;
  if not found or (not c.sandbox_enabled and not c.live_mode) then raise exception 'stripe_provider_disabled'; end if;
  select * into s from public.market_seller_accounts where seller_id=p_seller_id for update;
  if not found or s.onboarding_status<>'active' or s.seller_type not in ('private','trader') then raise exception 'seller_onboarding_not_approved'; end if;
  select * into r from dv_market_private.market_stripe_onboarding_requests
    where seller_id=p_seller_id and request_key=p_request_key and live_mode=c.live_mode;
  if r.id is null then
    select * into r from dv_market_private.market_stripe_onboarding_requests
      where seller_id=p_seller_id and live_mode=c.live_mode and state in ('prepared','account_created','link_created') for update;
  end if;
  select * into a from dv_market_private.market_stripe_accounts where seller_id=p_seller_id and live_mode=c.live_mode;
  if r.id is not null then return jsonb_build_object('onboarding_request_id',r.id,'onboarding_state',r.state,
    'stripe_account_id',a.stripe_account_id,'seller_type',s.seller_type,'country_code',s.country_code,'replayed',true,'live_mode',c.live_mode); end if;
  insert into dv_market_private.market_stripe_onboarding_requests(seller_id,request_key,live_mode)
  values(p_seller_id,p_request_key,c.live_mode) returning * into r;
  return jsonb_build_object('onboarding_request_id',r.id,'onboarding_state',r.state,'stripe_account_id',a.stripe_account_id,
    'seller_type',s.seller_type,'country_code',s.country_code,'replayed',false,'live_mode',c.live_mode);
end
$$;
revoke all on function public.prepare_market_stripe_onboarding(uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_onboarding(uuid,uuid) to service_role;

create or replace function public.register_market_stripe_account(
  p_onboarding_request_id uuid,p_seller_id uuid,p_account_id text,p_live_mode boolean
) returns void language plpgsql security definer
set search_path=pg_catalog,dv_market_private as $$
begin
  if p_account_id !~ '^acct_[A-Za-z0-9]+$' then raise exception 'stripe_account_id_invalid'; end if;
  if not exists(select 1 from dv_market_private.market_stripe_onboarding_requests
    where id=p_onboarding_request_id and seller_id=p_seller_id and live_mode=p_live_mode
      and state in ('prepared','account_created','link_created')) then
    raise exception 'stripe_onboarding_request_invalid';
  end if;
  insert into dv_market_private.market_stripe_accounts(seller_id,stripe_account_id,live_mode,onboarding_status)
  values(p_seller_id,p_account_id,p_live_mode,'not_started')
  on conflict(seller_id,live_mode) do update set stripe_account_id=excluded.stripe_account_id,updated_at=now()
  where dv_market_private.market_stripe_accounts.stripe_account_id=excluded.stripe_account_id;
  if not found then raise exception 'stripe_account_binding_conflict'; end if;
  update dv_market_private.market_stripe_onboarding_requests set state='account_created',stripe_account_id=p_account_id,updated_at=now()
  where id=p_onboarding_request_id and seller_id=p_seller_id and live_mode=p_live_mode;
  if not found then raise exception 'stripe_onboarding_request_invalid'; end if;
end
$$;
revoke all on function public.register_market_stripe_account(uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.register_market_stripe_account(uuid,uuid,text,boolean) to service_role;

-- Preserve the existing sandbox RPC for older sandbox-only callers.
create or replace function public.register_market_stripe_test_account(
  p_onboarding_request_id uuid,p_seller_id uuid,p_account_id text
) returns void language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
  perform public.register_market_stripe_account(p_onboarding_request_id,p_seller_id,p_account_id,false);
end
$$;
revoke all on function public.register_market_stripe_test_account(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.register_market_stripe_test_account(uuid,uuid,text) to service_role;

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
  if not found or (not c.sandbox_enabled and not c.live_mode) then raise exception 'stripe_provider_disabled'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.buyer_id<>p_buyer_id then raise exception 'stripe_order_access_denied'; end if;
  if o.status not in ('open','in_progress') or o.shipped_at is not null then raise exception 'stripe_order_not_payable'; end if;
  if o.shipping_quote_status='review_required' then raise exception 'stripe_shipping_review_required'; end if;
  if o.payment_provider not in ('manual_beta','stripe_connect') or coalesce(o.paid_amount,0)>0 then raise exception 'stripe_order_payment_state_invalid'; end if;
  select * into a from dv_market_private.market_payment_attempts where buyer_id=p_buyer_id and idempotency_key=p_idempotency_key;
  if found then
    if a.order_id<>p_order_id then raise exception 'stripe_payment_idempotency_conflict'; end if;
    if a.live_mode<>c.live_mode then raise exception 'stripe_payment_idempotency_mode_conflict'; end if;
    return jsonb_build_object('attempt_id',a.id,'stripe_account_id',a.stripe_account_id,
      'amount_due_cents',a.amount_due_cents,'platform_fee_cents',a.platform_fee_cents,'replayed',true,'live_mode',a.live_mode);
  end if;
  select * into s from dv_market_private.market_stripe_accounts where seller_id=o.seller_id and live_mode=c.live_mode;
  if not found or s.onboarding_status<>'ready' or not s.charges_enabled then raise exception 'stripe_seller_not_ready'; end if;
  v_total:=round(o.total_amount*100)::integer;
  if v_total<=0 then raise exception 'stripe_order_amount_invalid'; end if;
  v_fee:=least(v_total,round(v_total*c.platform_fee_bps/10000.0)::integer+c.platform_fee_fixed_cents);
  insert into dv_market_private.market_payment_attempts(
    order_id,buyer_id,seller_id,stripe_account_id,idempotency_key,amount_due_cents,platform_fee_cents,live_mode
  ) values(p_order_id,p_buyer_id,o.seller_id,s.stripe_account_id,p_idempotency_key,v_total,v_fee,c.live_mode) returning * into a;

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
    'amount_due_cents',v_total,'platform_fee_cents',v_fee,'currency','EUR','charge_model','direct_charge','live_mode',a.live_mode);
end
$$;
revoke all on function public.prepare_market_stripe_payment(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_payment(uuid,uuid,uuid) to service_role;

create or replace function public.bind_market_stripe_checkout_session(
  p_attempt_id uuid,p_session_id text
) returns void language plpgsql security definer
set search_path=pg_catalog,dv_market_private as $$
declare v_live boolean;
begin
  select live_mode into v_live from dv_market_private.market_payment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'stripe_attempt_session_conflict'; end if;
  if (v_live and p_session_id !~ '^cs_live_[A-Za-z0-9]+$')
     or (not v_live and p_session_id !~ '^cs_test_[A-Za-z0-9]+$') then raise exception 'stripe_session_mode_invalid'; end if;
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
set search_path=pg_catalog,public,dv_market_private,extensions as $$
declare a dv_market_private.market_payment_attempts%rowtype;v_status text:='ignored';v_note text:='event_not_actionable';
  v_amount integer:=coalesce((p_data->>'amount_cents')::integer,0);r record;v_tax jsonb;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_payload_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'stripe_event_invalid'; end if;
  insert into dv_market_private.market_stripe_events(stripe_event_id,event_type,stripe_account_id,live_mode,object_id,payload_sha256,normalized_data,provider_created_at)
  values(p_event_id,p_event_type,p_account_id,p_live_mode,p_object_id,decode(p_payload_sha256,'hex'),coalesce(p_data,'{}'),p_provider_created_at)
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
    where stripe_account_id=p_account_id and live_mode=p_live_mode;
    if not found then raise exception 'stripe_account_not_registered'; end if;
    update dv_market_private.market_stripe_onboarding_requests set
      state=case
        when coalesce((p_data->>'charges_enabled')::boolean,false) and coalesce((p_data->>'details_submitted')::boolean,false) then 'completed'
        when state='completed' then 'account_created'
        else state end,
      updated_at=now() where stripe_account_id=p_account_id and live_mode=p_live_mode;
    update dv_market_private.market_stripe_events set processing_status='applied',processing_note='seller_account_status_updated',processed_at=now()
      where stripe_event_id=p_event_id;
    return jsonb_build_object('event_id',p_event_id,'status','applied','note','seller_account_status_updated');
  end if;

  select * into a from dv_market_private.market_payment_attempts
  where stripe_account_id=p_account_id and live_mode=p_live_mode and (
    (p_data->>'attempt_id' is not null and id::text=p_data->>'attempt_id')
    or (p_data->>'attempt_id' is null and (
      stripe_checkout_session_id=p_object_id or stripe_payment_intent_id=p_object_id or stripe_charge_id=p_object_id
    ))
  ) for update;
  if not found then
    update dv_market_private.market_stripe_events set processing_status='ignored',processing_note='attempt_not_found',processed_at=now() where stripe_event_id=p_event_id;
    return jsonb_build_object('event_id',p_event_id,'status','ignored');
  end if;

  if p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') then
    if p_data->>'payment_intent_id' is null then raise exception 'stripe_payment_intent_missing'; end if;
    if a.stripe_checkout_session_id is null or a.stripe_checkout_session_id<>p_object_id then raise exception 'stripe_checkout_session_mismatch'; end if;
    if a.stripe_payment_intent_id is not null and a.stripe_payment_intent_id<>p_data->>'payment_intent_id' then raise exception 'stripe_payment_intent_mismatch'; end if;
    if a.state in ('paid','refund_pending','partially_refunded','refunded','disputed','failed','expired') then
      v_status:='ignored';v_note:='checkout_state_preserved';
    else
      update dv_market_private.market_payment_attempts set stripe_payment_intent_id=p_data->>'payment_intent_id',
        state=case when p_event_type='checkout.session.completed' then 'processing' else state end,updated_at=now() where id=a.id;
      v_status:='applied';v_note:='session_bound';
    end if;
  elsif p_event_type='payment_intent.succeeded' then
    if lower(coalesce(p_data->>'currency',''))<>'eur' or v_amount<>a.amount_due_cents then raise exception 'stripe_paid_amount_mismatch'; end if;
    if a.stripe_payment_intent_id is not null and a.stripe_payment_intent_id<>p_object_id then raise exception 'stripe_payment_intent_mismatch'; end if;
    if a.stripe_charge_id is not null and a.stripe_charge_id<>p_data->>'charge_id' then raise exception 'stripe_charge_mismatch'; end if;
    if a.state in ('refund_pending','partially_refunded','refunded','disputed') then
      v_status:='ignored';v_note:='post_payment_state_preserved';
    elsif a.state='paid' then
      if a.paid_cents<>v_amount then raise exception 'stripe_paid_amount_mismatch'; end if;
      v_status:='ignored';v_note:='payment_already_confirmed';
    else
      update dv_market_private.market_payment_attempts set stripe_payment_intent_id=p_object_id,
        stripe_charge_id=p_data->>'charge_id',state='paid',paid_cents=v_amount,paid_at=coalesce(p_provider_created_at,now()),updated_at=now() where id=a.id;
      update public.market_orders set payment_status='paid',paid_amount=v_amount/100.0,provider_payment_ref=p_object_id,
        paid_at=coalesce(p_provider_created_at,now()),platform_fee_amount=a.platform_fee_cents/100.0,
        seller_net_amount=(a.amount_due_cents-a.platform_fee_cents)/100.0,updated_at=now() where id=a.order_id;
      update public.market_deals set payment_status='paid',provider_payment_ref=p_object_id,paid_at=coalesce(p_provider_created_at,now()),updated_at=now() where order_id=a.order_id;
      for r in select * from dv_market_private.market_payment_allocations where attempt_id=a.id order by contract_snapshot_id loop
        v_tax:=public.record_market_tax_remuneration(r.contract_snapshot_id,'stripe:'||p_event_id||':'||r.contract_snapshot_id,
          coalesce(p_provider_created_at,now()),r.gross_cents/100.0,r.platform_fee_cents/100.0,0,0,'payment_provider',p_object_id,
          jsonb_build_object('provider','stripe_connect','charge_model','direct_charge','live_mode',p_live_mode));
        update dv_market_private.market_payment_allocations set tax_event_id=(v_tax->>'event_id')::uuid where attempt_id=a.id and contract_snapshot_id=r.contract_snapshot_id;
      end loop;
      insert into dv_market_private.market_financial_documents(attempt_id,seller_id,document_kind,document_status,issuer_role,currency,gross_cents,tax_treatment,immutable_snapshot,content_sha256,issued_at)
      values(a.id,a.seller_id,'provider_payment_evidence','issued','payment_provider','EUR',v_amount,'provider_event',
        jsonb_build_object('provider','stripe_connect','event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount,'currency','EUR','live_mode',p_live_mode),
        digest(convert_to(jsonb_build_object('event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount,'live_mode',p_live_mode)::text,'UTF8'),'sha256'),coalesce(p_provider_created_at,now()))
      on conflict(attempt_id,document_kind) do nothing;
      v_status:='applied';v_note:='payment_confirmed_by_provider';
    end if;
  elsif p_event_type='payment_intent.payment_failed' then
    if a.stripe_payment_intent_id is not null and a.stripe_payment_intent_id<>p_object_id then raise exception 'stripe_payment_intent_mismatch'; end if;
    if a.state in ('paid','refund_pending','partially_refunded','refunded','disputed') then
      v_status:='ignored';v_note:='post_payment_state_preserved';
    else
      update dv_market_private.market_payment_attempts set stripe_payment_intent_id=coalesce(stripe_payment_intent_id,p_object_id),state='failed',updated_at=now() where id=a.id;
      update public.market_orders set payment_status='failed',updated_at=now() where id=a.order_id and payment_status not in ('paid','refunded');
      v_status:='applied';v_note:='payment_failed_by_provider';
    end if;
  elsif p_event_type='charge.refunded' then
    if a.stripe_charge_id is null or a.stripe_charge_id<>p_object_id then raise exception 'stripe_charge_mismatch'; end if;
    if v_amount<>a.paid_cents or a.paid_cents=0 then raise exception 'stripe_partial_refund_requires_review'; end if;
    if a.state='refunded' and a.refunded_cents=v_amount then
      v_status:='ignored';v_note:='refund_already_confirmed';
    else
      update dv_market_private.market_payment_attempts set state='refunded',refunded_cents=v_amount,updated_at=now() where id=a.id;
      update public.market_orders set payment_status='refunded',refund_status='refunded',refund_amount=v_amount/100.0,
        provider_refund_ref=p_data->>'refund_id',updated_at=now() where id=a.order_id;
      for r in select x.*,e.id original_tax_event_id from dv_market_private.market_payment_allocations x
        join dv_market_private.market_tax_events e on e.id=x.tax_event_id where x.attempt_id=a.id order by x.contract_snapshot_id
      loop
        perform public.correct_market_tax_remuneration(r.original_tax_event_id,'stripe-refund:'||p_event_id||':'||r.contract_snapshot_id,
          coalesce(p_provider_created_at,now()),r.gross_cents/100.0,r.platform_fee_cents/100.0,0,0,true,p_data->>'refund_id',
          jsonb_build_object('provider','stripe_connect','full_refund',true,'live_mode',p_live_mode));
        update dv_market_private.market_payment_allocations set refunded_cents=gross_cents where attempt_id=a.id and contract_snapshot_id=r.contract_snapshot_id;
      end loop;
      update dv_market_private.market_refund_requests set status='succeeded',stripe_refund_id=p_data->>'refund_id',updated_at=now()
        where attempt_id=a.id and status in ('prepared','submitted','pending');
      v_status:='applied';v_note:='full_refund_confirmed_by_provider';
    end if;
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
  if found then
    select * into a from dv_market_private.market_payment_attempts where id=r.attempt_id;
    return jsonb_build_object('request_id',r.id,'attempt_id',r.attempt_id,'stripe_account_id',a.stripe_account_id,
      'payment_intent_id',a.stripe_payment_intent_id,'amount_cents',r.amount_cents,'replayed',true,'live_mode',a.live_mode);
  end if;
  select * into a from dv_market_private.market_payment_attempts where order_id=p_order_id and state='paid' for update;
  if not found then raise exception 'stripe_refund_not_available'; end if;
  if not exists(select 1 from public.market_orders where id=p_order_id and refund_status='provider_required') then raise exception 'stripe_refund_not_authorized'; end if;
  insert into dv_market_private.market_refund_requests(order_id,attempt_id,request_key,amount_cents,reason)
  values(p_order_id,a.id,p_request_key,a.paid_cents,left(trim(p_reason),500)) returning * into r;
  update dv_market_private.market_payment_attempts set state='refund_pending',updated_at=now() where id=a.id;
  return jsonb_build_object('request_id',r.id,'attempt_id',a.id,'stripe_account_id',a.stripe_account_id,
    'payment_intent_id',a.stripe_payment_intent_id,'amount_cents',r.amount_cents,'currency','EUR','live_mode',a.live_mode);
end
$$;
revoke all on function public.prepare_market_stripe_full_refund(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.prepare_market_stripe_full_refund(uuid,uuid,text) to service_role;

create or replace function public.reconcile_market_stripe_refund_evidence(
  p_event_id text,p_account_id text,p_charge_id text,p_refund_id text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare a dv_market_private.market_payment_attempts%rowtype;e dv_market_private.market_stripe_events%rowtype;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_account_id !~ '^acct_[A-Za-z0-9]+$'
     or p_charge_id !~ '^ch_[A-Za-z0-9]+$' or p_refund_id !~ '^re_[A-Za-z0-9]+$' then raise exception 'stripe_refund_evidence_invalid'; end if;
  select * into e from dv_market_private.market_stripe_events
  where stripe_event_id=p_event_id and event_type='charge.refunded' and stripe_account_id=p_account_id
    and object_id=p_charge_id and processing_status='applied' for update;
  if not found then raise exception 'stripe_refund_event_not_reconcilable'; end if;
  if nullif(e.normalized_data->>'refund_id','') is not null and e.normalized_data->>'refund_id'<>p_refund_id then
    raise exception 'stripe_refund_event_reference_mismatch'; end if;
  select * into a from dv_market_private.market_payment_attempts
  where stripe_account_id=p_account_id and stripe_charge_id=p_charge_id and live_mode=e.live_mode
    and state='refunded' and paid_cents>0 and refunded_cents=paid_cents for update;
  if not found then raise exception 'stripe_refund_attempt_not_reconcilable'; end if;
  if exists(select 1 from public.market_orders where id=a.order_id and provider_refund_ref is not null and provider_refund_ref<>p_refund_id)
    then raise exception 'stripe_order_refund_reference_mismatch'; end if;
  if exists(select 1 from dv_market_private.market_refund_requests where attempt_id=a.id and stripe_refund_id is not null and stripe_refund_id<>p_refund_id)
    then raise exception 'stripe_refund_request_reference_mismatch'; end if;
  if exists(select 1 from dv_market_private.market_tax_events where event_key like 'stripe-refund:'||p_event_id||':%'
    and source_reference is not null and source_reference<>p_refund_id) then raise exception 'stripe_tax_refund_reference_mismatch'; end if;
  update public.market_orders set provider_refund_ref=p_refund_id,updated_at=now()
    where id=a.order_id and payment_status='refunded' and refund_status='refunded';
  if not found then raise exception 'stripe_refunded_order_not_found'; end if;
  update dv_market_private.market_refund_requests set stripe_refund_id=p_refund_id,updated_at=now()
    where attempt_id=a.id and status='succeeded';
  if not found then raise exception 'stripe_refund_request_not_found'; end if;
  return jsonb_build_object('event_id',p_event_id,'status','reconciled','refund_id',p_refund_id,'live_mode',e.live_mode);
end
$$;
revoke all on function public.reconcile_market_stripe_refund_evidence(text,text,text,text) from public, anon, authenticated;
grant execute on function public.reconcile_market_stripe_refund_evidence(text,text,text,text) to service_role;
