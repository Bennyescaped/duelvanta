-- DUELVANTA B07 / L07-01 private C2C swap flow: fulfillment + participant read model.
-- REVIEW/STAGING ONLY. Apply after b07-l07-01-c2c-swap-v1-binding.sql.
-- No payment, fee, wallet or PStTG/tax event is created.

create or replace function public.mark_market_swap_shipped_v1(
  p_thread_id uuid,
  p_carrier text default null,
  p_tracking_code text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_fulfillment dv_market_private.market_swap_fulfillments%rowtype;
  v_carrier text:=nullif(left(trim(coalesce(p_carrier,'')),80),'');
  v_code text:=nullif(left(trim(coalesce(p_tracking_code,'')),160),'');
  v_now timestamptz:=now();
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=p_thread_id;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) or v_thread.status<>'bound' then raise exception 'swap_not_shippable';end if;
  select * into v_fulfillment
  from dv_market_private.market_swap_fulfillments
  where thread_id=v_thread.id and sender_id=v_uid for update;
  if not found then raise exception 'swap_fulfillment_not_found';end if;
  if v_fulfillment.shipped_at is not null then
    return jsonb_build_object('shipped_at',v_fulfillment.shipped_at,'replayed',true);
  end if;
  if (v_carrier is null)<>(v_code is null) then raise exception 'swap_tracking_pair_required';end if;
  if v_fulfillment.tracking_required and (v_carrier is null or v_code is null) then raise exception 'tracking_required_for_swap';end if;
  update dv_market_private.market_swap_fulfillments
  set carrier=v_carrier,tracking_code=v_code,shipped_at=v_now,updated_at=v_now
  where thread_id=v_thread.id and sender_id=v_uid;
  return jsonb_build_object('shipped_at',v_now,'shipping_due_at',v_fulfillment.shipping_due_at,
    'tracking_required',v_fulfillment.tracking_required);
end
$$;
revoke all on function public.mark_market_swap_shipped_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.mark_market_swap_shipped_v1(uuid,text,text) to authenticated;

create or replace function public.confirm_market_swap_received_v1(
  p_thread_id uuid,
  p_sender_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_fulfillment dv_market_private.market_swap_fulfillments%rowtype;
  v_now timestamptz:=now();
  v_remaining integer;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=p_thread_id for update;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) or v_thread.status not in ('bound','completed') then raise exception 'swap_not_receivable';end if;
  select * into v_fulfillment
  from dv_market_private.market_swap_fulfillments
  where thread_id=v_thread.id and sender_id=p_sender_id and receiver_id=v_uid for update;
  if not found or v_fulfillment.shipped_at is null then raise exception 'swap_shipment_not_confirmable';end if;
  if v_fulfillment.received_at is null then
    update dv_market_private.market_swap_fulfillments
    set received_at=v_now,receiver_confirmed_at=v_now,updated_at=v_now
    where thread_id=v_thread.id and sender_id=p_sender_id;
  end if;

  select count(*) into v_remaining
  from dv_market_private.market_swap_fulfillments
  where thread_id=v_thread.id and received_at is null;
  if v_remaining=0 and v_thread.status='bound' then
    update dv_market_private.market_swap_threads
    set status='completed',completed_at=v_now,updated_at=v_now
    where id=v_thread.id;

    update public.market_listings l
    set status='sold',ended_at=coalesce(l.ended_at,v_now),updated_at=v_now
    where l.quantity_available=0
      and exists(select 1 from dv_market_private.market_swap_reservations r where r.thread_id=v_thread.id and r.listing_id=l.id)
      and not exists(select 1 from public.market_deals d where d.listing_id=l.id and d.status not in ('completed','cancelled'))
      and not exists(
        select 1 from public.market_offers o
        where o.listing_id=l.id and o.status='accepted' and o.reservation_expires_at>v_now
          and not exists(select 1 from public.market_deals d2 where d2.offer_id=o.id)
      )
      and not exists(
        select 1 from dv_market_private.market_swap_reservations r2
        join dv_market_private.market_swap_threads t2 on t2.id=r2.thread_id
        where r2.listing_id=l.id and r2.thread_id<>v_thread.id and t2.status='bound'
      );
  end if;
  return jsonb_build_object('received_at',coalesce(v_fulfillment.received_at,v_now),
    'swap_completed',(v_remaining=0),'completed_at',case when v_remaining=0 then v_now else null end);
end
$$;
revoke all on function public.confirm_market_swap_received_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_market_swap_received_v1(uuid,uuid) to authenticated;

create or replace function public.get_my_market_swaps_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'thread_id',t.id,'status',t.status,'party_a_id',t.party_a_id,'party_b_id',t.party_b_id,
    'party_a',jsonb_build_object('user_id',t.party_a_id,'display_name',pa.display_name,'username',pa.username),
    'party_b',jsonb_build_object('user_id',t.party_b_id,'display_name',pb.display_name,'username',pb.username),
    'current_revision',jsonb_build_object(
      'revision_id',r.id,'revision_no',r.revision_no,'proposed_by',r.proposed_by,
      'content_sha256',case when r.id is null then null else encode(r.content_sha256,'hex') end,
      'created_at',r.created_at,
      'party_a_items',coalesce((select jsonb_agg(ri.item_snapshot order by ri.listing_id)
        from dv_market_private.market_swap_revision_items ri where ri.revision_id=r.id and ri.party_side='a'),'[]'::jsonb),
      'party_b_items',coalesce((select jsonb_agg(ri.item_snapshot order by ri.listing_id)
        from dv_market_private.market_swap_revision_items ri where ri.revision_id=r.id and ri.party_side='b'),'[]'::jsonb)
    ),
    'party_a_confirmed',exists(select 1 from dv_market_private.market_swap_confirmations c where c.revision_id=r.id and c.user_id=t.party_a_id and c.content_sha256=r.content_sha256),
    'party_b_confirmed',exists(select 1 from dv_market_private.market_swap_confirmations c where c.revision_id=r.id and c.user_id=t.party_b_id and c.content_sha256=r.content_sha256),
    'binding_at',t.binding_at,'shipping_due_at',t.shipping_due_at,'completed_at',t.completed_at,'closed_at',t.closed_at,
    'value_snapshots',coalesce((select jsonb_agg(jsonb_build_object(
      'owner_id',v.owner_id,'reference_value_eur',v.reference_value_eur,
      'valuation_method',v.valuation_method,'valuation_status',v.valuation_status,
      'captured_at',v.captured_at,'psttg_evaluation_status',v.psttg_evaluation_status,
      'psttg_event_created_by_b07',v.psttg_event_created_by_b07
    ) order by v.owner_id) from dv_market_private.market_swap_value_snapshots v where v.thread_id=t.id),'[]'::jsonb),
    'fulfillments',coalesce((select jsonb_agg(jsonb_build_object(
      'sender_id',f.sender_id,'receiver_id',f.receiver_id,'shipping_due_at',f.shipping_due_at,
      'goods_reference_value_eur',f.goods_reference_value_eur,'tracking_required',f.tracking_required,
      'carrier',f.carrier,'tracking_code',f.tracking_code,'shipped_at',f.shipped_at,
      'ship_to',case when f.sender_id=v_uid then (select jsonb_build_object(
        'recipient_name',a.recipient_name,'street_line1',a.street_line1,'street_line2',a.street_line2,
        'postal_code',a.postal_code,'city',a.city,'country_code',a.country_code
      ) from dv_market_private.market_swap_shipping_addresses a where a.thread_id=t.id and a.user_id=f.receiver_id) else null end,
      'received_at',f.received_at,'receiver_confirmed_at',f.receiver_confirmed_at,
      'overdue',(f.shipped_at is null and f.shipping_due_at<now())
    ) order by f.sender_id) from dv_market_private.market_swap_fulfillments f where f.thread_id=t.id),'[]'::jsonb)
  ) order by t.updated_at desc,t.id),'[]'::jsonb) into v_result
  from dv_market_private.market_swap_threads t
  left join dv_market_private.market_swap_revisions r on r.id=t.current_revision_id
  left join public.profiles pa on pa.id=t.party_a_id
  left join public.profiles pb on pb.id=t.party_b_id
  where v_uid in (t.party_a_id,t.party_b_id);
  return v_result;
end
$$;
revoke all on function public.get_my_market_swaps_v1() from public,anon,authenticated;
grant execute on function public.get_my_market_swaps_v1() to authenticated;

notify pgrst,'reload schema';
