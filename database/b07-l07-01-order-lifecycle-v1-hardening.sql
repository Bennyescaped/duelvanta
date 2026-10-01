-- DUELVANTA B07 / L07-01 order lifecycle V1 hardening.
-- Apply AFTER b07-l07-01-order-lifecycle-v1.sql. REVIEW/STAGING ONLY.
-- Corrects technical receipt semantics, legacy C2C fallback, pickup attempt limiting and status serialization.
-- No payment, payout, refund, fee or provider-release execution is introduced.

create or replace function dv_market_private.b07_complete_order(p_order_id uuid,p_reason text,p_completed_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare o public.market_orders;
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if not found then raise exception 'Order nicht gefunden';end if;
  if o.status='completed' then return;end if;
  if o.status in ('cancelled','disputed') then raise exception 'Order kann mit offenem Vorgang nicht abgeschlossen werden';end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open') then raise exception 'Ein Problemfall ist noch offen';end if;

  update public.market_orders set
    status='completed',
    received_at=case when p_reason in ('buyer_received_ok','pickup_bilateral_handover') then coalesce(received_at,p_completed_at) else received_at end,
    completed_at=coalesce(completed_at,p_completed_at),
    technical_completed_at=coalesce(technical_completed_at,p_completed_at),
    technical_completion_reason=coalesce(technical_completion_reason,left(p_reason,80)),
    updated_at=now()
  where id=o.id;

  update public.market_deals set
    status='completed',fulfillment_status='received',
    received_at=case when p_reason in ('buyer_received_ok','pickup_bilateral_handover') then coalesce(received_at,p_completed_at) else coalesce(received_at,o.delivery_evidence_at) end,
    seller_confirmed_at=coalesce(seller_confirmed_at,o.shipped_at),
    completed_at=coalesce(completed_at,p_completed_at),updated_at=now()
  where order_id=o.id and status in ('accepted','in_progress');

  update public.market_listings l set status='sold',ended_at=coalesce(l.ended_at,p_completed_at),updated_at=now()
  where l.status='reserved' and l.quantity_available=0
    and exists(select 1 from public.market_deals d where d.order_id=o.id and d.listing_id=l.id and d.status='completed')
    and not exists(select 1 from public.market_deals d where d.listing_id=l.id and d.status not in ('completed','cancelled'));

  update public.market_offers mo set completed_at=coalesce(completed_at,p_completed_at),updated_at=now()
  where mo.status='accepted' and exists(select 1 from public.market_deals d where d.order_id=o.id and d.offer_id=mo.id and d.status='completed');
end
$$;
revoke all on function dv_market_private.b07_complete_order(uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.record_market_order_delivery_evidence_b07(p_order_id uuid,p_delivered_at timestamptz,p_source text,p_reference text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;v_at timestamptz:=coalesce(p_delivered_at,now());
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.fulfillment_group<>'shipping' or o.status not in ('shipped','received') then raise exception 'delivery_evidence_not_applicable';end if;
  if o.tracking_code is null then raise exception 'delivery_evidence_requires_tracking';end if;
  if v_at<o.shipped_at or v_at>now()+interval '5 minutes' then raise exception 'delivery_evidence_time_invalid';end if;
  if nullif(trim(coalesce(p_source,'')),'') is null then raise exception 'delivery_evidence_source_required';end if;
  update public.market_orders set
    delivery_evidence_at=coalesce(delivery_evidence_at,v_at),delivery_evidence_source=coalesce(delivery_evidence_source,left(trim(p_source),80)),
    delivery_evidence_ref=coalesce(delivery_evidence_ref,nullif(left(trim(coalesce(p_reference,'')),160),'')),
    closure_eligible_at=coalesce(closure_eligible_at,v_at+interval '72 hours'),updated_at=now()
  where id=o.id;
end
$$;
revoke all on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text) to service_role;

create or replace function public.confirm_market_pickup_handover_b07(p_order_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare o public.market_orders;h dv_market_private.market_pickup_handovers;v_now timestamptz:=now();v_code text:=upper(trim(coalesce(p_code,'')));
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann die Übergabe abschließen';end if;
  if o.fulfillment_group<>'pickup' or o.status not in ('open','in_progress') then raise exception 'pickup_not_available';end if;
  select * into h from dv_market_private.market_pickup_handovers where order_id=o.id for update;
  if not found or h.consumed_at is not null or h.expires_at<=v_now then raise exception 'pickup_code_expired';end if;
  if h.attempt_count>=8 then raise exception 'pickup_code_attempt_limit';end if;
  if digest(convert_to(v_code,'UTF8'),'sha256')<>h.code_hash then
    update dv_market_private.market_pickup_handovers set attempt_count=attempt_count+1,last_attempt_at=v_now,updated_at=v_now where order_id=o.id;
    return jsonb_build_object('ok',false,'error','pickup_code_invalid');
  end if;
  update dv_market_private.market_pickup_handovers set buyer_confirmed_at=v_now,consumed_at=v_now,last_attempt_at=v_now,attempt_count=attempt_count+1,updated_at=v_now where order_id=o.id;
  update public.market_orders set buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),buyer_received_ok_at=coalesce(buyer_received_ok_at,v_now),pickup_handover_completed_at=v_now,received_at=coalesce(received_at,v_now),updated_at=now() where id=o.id;
  update public.market_deals set buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),seller_confirmed_at=coalesce(seller_confirmed_at,h.seller_confirmed_at),received_at=coalesce(received_at,v_now),updated_at=now() where order_id=o.id and status in ('accepted','in_progress');
  perform dv_market_private.b07_complete_order(o.id,'pickup_bilateral_handover',v_now);
  return jsonb_build_object('ok',true,'completed_at',v_now);
end
$$;
revoke all on function public.confirm_market_pickup_handover_b07(uuid,text) from public,anon;
grant execute on function public.confirm_market_pickup_handover_b07(uuid,text) to authenticated;

create or replace function public.open_market_order_problem_v2(p_order_id uuid,p_category text,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;v_reason text;v_cat text;v_case uuid;v_other uuid;v_c2c boolean:=false;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');v_cat:=lower(trim(coalesce(p_category,'other')));
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Problem beschreiben';end if;
  if v_cat not in ('shipping','not_received','damaged','not_as_described','payment','other') then raise exception 'Ungültige Problemkategorie';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt';end if;
  if o.shipped_at is null or o.status not in ('shipped','received') then raise exception 'Vor Versand bitte eine Stornoanfrage verwenden';end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and case_type='problem' and status='open') then raise exception 'Für diese Order ist bereits ein Problem offen';end if;
  if v_cat='not_received' then
    if auth.uid()<>o.buyer_id then raise exception 'Nicht-Erhalt kann nur der Käufer melden';end if;
    select coalesce(bool_and(case when s.contract_classification is not null then s.contract_classification='c2c' else a.seller_type='private' end),false)
    into v_c2c
    from public.market_deals d
    left join dv_market_private.market_contract_snapshots s on s.deal_id=d.id
    left join public.market_seller_accounts a on a.seller_id=d.seller_id
    where d.order_id=o.id;
    if v_c2c and o.tracking_code is null and now()<o.shipped_at+interval '14 days' then raise exception 'c2c_untracked_not_received_wait_14_days';end if;
  end if;
  v_other:=case when auth.uid()=o.seller_id then o.buyer_id else o.seller_id end;
  insert into public.market_order_cases(order_id,case_type,status,category,reason,opened_by,refund_state,refund_amount,response_due_at,evidence_due_at)
  values(o.id,'problem','open',v_cat,v_reason,auth.uid(),
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then 'provider_required' else 'not_required' end,
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then o.total_amount else null end,
    now()+interval '7 days',now()+interval '7 days') returning id into v_case;
  update public.market_orders set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,
    refund_status=case when payment_provider<>'manual_beta' and paid_amount>0 then 'provider_required' else refund_status end,
    refund_amount=case when payment_provider<>'manual_beta' and paid_amount>0 then total_amount else refund_amount end,updated_at=now()
  where id=o.id;
  update public.market_deals set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,
    payout_status=case when payment_provider='stripe_connect' then 'blocked' else payout_status end,updated_at=now()
  where order_id=o.id and status not in ('cancelled','completed');
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'problem_opened','PROBLEM GEMELDET',o.order_number||' · '||left(v_reason,220),o.id,'problem_opened:'||v_case::text)
  on conflict(dedupe_key) do nothing;
  return v_case;
end
$$;
revoke all on function public.open_market_order_problem_v2(uuid,text,text) from public,anon;
grant execute on function public.open_market_order_problem_v2(uuid,text,text) to authenticated;

create or replace function public.get_my_market_order_b07_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'order_id',o.id,'fulfillment_group',o.fulfillment_group,'status',o.status,'subtotal',o.subtotal,
    'tracking_required',(o.subtotal>25 or o.risk_tracking_required),'shipping_due_at',o.shipping_due_at,
    'delivery_evidence_at',o.delivery_evidence_at,'closure_eligible_at',o.closure_eligible_at,'buyer_received_ok_at',o.buyer_received_ok_at,
    'technical_completed_at',o.technical_completed_at,'technical_completion_reason',o.technical_completion_reason,
    'pickup_code_pending',exists(select 1 from dv_market_private.market_pickup_handovers h where h.order_id=o.id and h.consumed_at is null and h.expires_at>now()),
    'pickup_code_expires_at',(select h.expires_at from dv_market_private.market_pickup_handovers h where h.order_id=o.id and h.consumed_at is null and h.expires_at>now()),
    'active_case_due_at',(select case when c.response_due_at is null and c.evidence_due_at is null then null else least(coalesce(c.response_due_at,'infinity'::timestamptz),coalesce(c.evidence_due_at,'infinity'::timestamptz)) end from public.market_order_cases c where c.order_id=o.id and c.status='open' order by c.created_at desc limit 1)
  ) order by o.created_at desc),'[]'::jsonb) into v_result
  from public.market_orders o where auth.uid() in (o.seller_id,o.buyer_id);
  return v_result;
end
$$;
revoke all on function public.get_my_market_order_b07_status() from public,anon;
grant execute on function public.get_my_market_order_b07_status() to authenticated;

notify pgrst,'reload schema';
