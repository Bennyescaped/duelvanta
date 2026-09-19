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
create or replace function public.get_my_market_notifications(p_limit integer default 40)
returns table(
  notification_id uuid,
  kind text,
  title text,
  body text,
  order_id uuid,
  offer_id uuid,
  listing_id uuid,
  context_type text,
  context_id uuid,
  dedupe_key text,
  is_unread boolean,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  return query
  select n.id, n.kind, n.title, n.body, n.order_id, n.offer_id, n.listing_id,
         n.context_type, n.context_id, n.dedupe_key,
         n.read_at is null, n.read_at, n.created_at
  from public.market_notifications n
  where n.recipient_id = auth.uid()
    and coalesce(n.context_type,'') not in ('swap','swap_case','pickup_swap')
    and n.kind not like 'swap_%'
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

revoke all on function public.get_my_market_notifications(integer) from public, anon;
grant execute on function public.get_my_market_notifications(integer) to authenticated;

commit;
