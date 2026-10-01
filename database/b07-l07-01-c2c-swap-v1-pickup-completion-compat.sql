-- DUELVANTA B07 / L07-01 C2C pickup completion compatibility fix.
-- REVIEW/STAGING ONLY. Apply after b07-l07-01-c2c-swap-v1-pickup.sql.
-- Real staging market_offers has no reservation_expires_at column.

create or replace function public.confirm_market_swap_pickup_v1(p_thread_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare
  v_uid uuid:=auth.uid();v_thread dv_market_private.market_swap_threads%rowtype;v_h dv_market_private.market_swap_pickup_handovers%rowtype;
  v_now timestamptz:=now();v_code text:=upper(trim(coalesce(p_code,'')));
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=p_thread_id for update;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if v_thread.status<>'bound' or v_thread.fulfillment_mode<>'pickup' then raise exception 'swap_pickup_not_available';end if;
  select * into v_h from dv_market_private.market_swap_pickup_handovers where thread_id=v_thread.id for update;
  if not found or v_h.consumed_at is not null or v_h.expires_at<=v_now then raise exception 'swap_pickup_code_expired';end if;
  if v_h.generated_by=v_uid then raise exception 'swap_pickup_requires_other_party';end if;
  if v_h.attempt_count>=8 then raise exception 'pickup_code_attempt_limit';end if;
  if extensions.digest(pg_catalog.convert_to(v_code,'UTF8'),'sha256')<>v_h.code_hash then
    update dv_market_private.market_swap_pickup_handovers set attempt_count=attempt_count+1,last_attempt_at=v_now,updated_at=v_now where thread_id=v_thread.id;
    return jsonb_build_object('ok',false,'error','pickup_code_invalid');
  end if;
  update dv_market_private.market_swap_pickup_handovers set confirmed_by=v_uid,confirmed_at=v_now,consumed_at=v_now,last_attempt_at=v_now,attempt_count=attempt_count+1,updated_at=v_now where thread_id=v_thread.id;
  update dv_market_private.market_swap_threads set status='completed',completed_at=v_now,updated_at=v_now where id=v_thread.id;
  update public.market_listings l set status='sold',ended_at=coalesce(l.ended_at,v_now),updated_at=v_now
  where l.quantity_available=0
    and exists(select 1 from dv_market_private.market_swap_reservations r where r.thread_id=v_thread.id and r.listing_id=l.id)
    and not exists(select 1 from public.market_deals d where d.listing_id=l.id and d.status not in ('completed','cancelled'))
    and not exists(select 1 from public.market_offers o where o.listing_id=l.id and o.status='accepted' and not exists(select 1 from public.market_deals d2 where d2.offer_id=o.id))
    and not exists(select 1 from dv_market_private.market_swap_reservations r2 join dv_market_private.market_swap_threads t2 on t2.id=r2.thread_id where r2.listing_id=l.id and r2.thread_id<>v_thread.id and t2.status='bound');
  return jsonb_build_object('ok',true,'completed_at',v_now,'confirmation_mode','pickup_bilateral_handover');
end
$$;
revoke all on function public.confirm_market_swap_pickup_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_market_swap_pickup_v1(uuid,text) to authenticated;

notify pgrst,'reload schema';