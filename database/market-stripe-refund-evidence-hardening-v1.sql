-- DUELVANTA Stripe refund evidence hardening V1
-- Repairs mutable provider refund references only for an already-applied, fully refunded
-- Stripe Connect test event. Immutable provider/tax ledgers are never rewritten.
-- No payment or refund is initiated here.

create or replace function public.reconcile_market_stripe_refund_evidence(
  p_event_id text,p_account_id text,p_charge_id text,p_refund_id text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare
  a dv_market_private.market_payment_attempts%rowtype;
  e dv_market_private.market_stripe_events%rowtype;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_account_id !~ '^acct_[A-Za-z0-9]+$'
     or p_charge_id !~ '^ch_[A-Za-z0-9]+$'
     or p_refund_id !~ '^re_[A-Za-z0-9]+$' then
    raise exception 'stripe_refund_evidence_invalid';
  end if;

  select * into e
  from dv_market_private.market_stripe_events
  where stripe_event_id=p_event_id
    and event_type='charge.refunded'
    and stripe_account_id=p_account_id
    and object_id=p_charge_id
    and not live_mode
    and processing_status='applied'
  for update;
  if not found then raise exception 'stripe_refund_event_not_reconcilable'; end if;

  if nullif(e.normalized_data->>'refund_id','') is not null
     and e.normalized_data->>'refund_id'<>p_refund_id then
    raise exception 'stripe_refund_event_reference_mismatch';
  end if;

  select * into a
  from dv_market_private.market_payment_attempts
  where stripe_account_id=p_account_id
    and stripe_charge_id=p_charge_id
    and state='refunded'
    and paid_cents>0
    and refunded_cents=paid_cents
  for update;
  if not found then raise exception 'stripe_refund_attempt_not_reconcilable'; end if;

  if exists(
    select 1 from public.market_orders
    where id=a.order_id and provider_refund_ref is not null and provider_refund_ref<>p_refund_id
  ) then raise exception 'stripe_order_refund_reference_mismatch'; end if;

  if exists(
    select 1 from dv_market_private.market_refund_requests
    where attempt_id=a.id and stripe_refund_id is not null and stripe_refund_id<>p_refund_id
  ) then raise exception 'stripe_refund_request_reference_mismatch'; end if;

  if exists(
    select 1 from dv_market_private.market_tax_events
    where event_key like 'stripe-refund:'||p_event_id||':%'
      and source_reference is not null and source_reference<>p_refund_id
  ) then raise exception 'stripe_tax_refund_reference_mismatch'; end if;

  -- market_stripe_events and market_tax_events are immutable audit evidence.
  -- Keep the original signed event and PStTG correction untouched; attach the
  -- provider refund reference only to the mutable operational records.
  update public.market_orders
  set provider_refund_ref=p_refund_id,updated_at=now()
  where id=a.order_id and payment_status='refunded' and refund_status='refunded';
  if not found then raise exception 'stripe_refunded_order_not_found'; end if;

  update dv_market_private.market_refund_requests
  set stripe_refund_id=p_refund_id,updated_at=now()
  where attempt_id=a.id and status='succeeded';
  if not found then raise exception 'stripe_refund_request_not_found'; end if;

  return jsonb_build_object('event_id',p_event_id,'status','reconciled','refund_id',p_refund_id);
end
$$;

revoke all on function public.reconcile_market_stripe_refund_evidence(text,text,text,text) from public, anon, authenticated;
grant execute on function public.reconcile_market_stripe_refund_evidence(text,text,text,text) to service_role;
