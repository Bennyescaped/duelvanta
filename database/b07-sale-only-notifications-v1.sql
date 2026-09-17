-- V22: preserve order chat notifications; stop generating swap notifications.
begin;
create or replace function public.sync_my_trade_notifications_v2()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer := 0;
  v_rows integer := 0;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Pickup chat messages for orders.
  insert into public.market_notifications(
    recipient_id, kind, title, body, order_id, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'pickup_message',
    'NEUE ABHOL-CHAT-NACHRICHT',
    coalesce(o.order_number, 'DUELVANTA Order'),
    o.id,
    'pickup_order',
    o.id,
    'pickup_message:' || m.id::text || ':' || v_uid::text,
    m.created_at
  from dv_market_private.market_pickup_messages m
  join public.market_orders o on m.context_type = 'order' and m.context_id = o.id
  where m.sender_id <> v_uid
    and m.sender_id in (o.buyer_id, o.seller_id)
    and v_uid in (o.buyer_id, o.seller_id)
    and m.created_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  return v_total;
end;
$$;
revoke all on function public.sync_my_trade_notifications_v2() from public,anon;
grant execute on function public.sync_my_trade_notifications_v2() to authenticated;
commit;
