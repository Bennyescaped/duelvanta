-- DUELVANTA B07 / L07-01 C2C completion compatibility fix.
-- REVIEW/STAGING ONLY. Apply after b07-l07-01-c2c-swap-v1-problems.sql.
-- Real staging market_offers has no reservation_expires_at column.
-- Conservatively keep a fully-reserved listing non-final while any accepted offer without a deal still exists.

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
        where o.listing_id=l.id and o.status='accepted'
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