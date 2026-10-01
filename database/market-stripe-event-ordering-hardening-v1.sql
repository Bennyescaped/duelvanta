-- Apply after market-stripe-connect-sandbox-v1.sql and pgcrypto-digest-schema-hardening-v1.sql on staging.
-- Prevents out-of-order Stripe events from regressing or duplicating terminal payment state.
create or replace function public.apply_market_stripe_event(
  p_event_id text,p_event_type text,p_account_id text,p_live_mode boolean,p_object_id text,
  p_payload_sha256 text,p_provider_created_at timestamptz,p_data jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private,extensions as $$
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
          jsonb_build_object('provider','stripe_connect','charge_model','direct_charge','live_mode',false));
        update dv_market_private.market_payment_allocations set tax_event_id=(v_tax->>'event_id')::uuid where attempt_id=a.id and contract_snapshot_id=r.contract_snapshot_id;
      end loop;
      insert into dv_market_private.market_financial_documents(attempt_id,seller_id,document_kind,document_status,issuer_role,currency,gross_cents,tax_treatment,immutable_snapshot,content_sha256,issued_at)
      values(a.id,a.seller_id,'provider_payment_evidence','issued','payment_provider','EUR',v_amount,'provider_event',
        jsonb_build_object('provider','stripe_connect','event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount,'currency','EUR','live_mode',false),
        digest(convert_to(jsonb_build_object('event_id',p_event_id,'payment_intent_id',p_object_id,'amount_cents',v_amount)::text,'UTF8'),'sha256'),coalesce(p_provider_created_at,now()))
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
          jsonb_build_object('provider','stripe_connect','full_refund',true,'live_mode',false));
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
