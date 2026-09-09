-- DUELVANTA TRADE automation V1
-- In-app notifications + derived "AKTION ERFORDERLICH" overview.
-- No existing deals/orders are backfilled or modified.

create table if not exists public.market_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase','offer_received','offer_accepted','order_shipped','order_received')),
  title text not null,
  body text not null,
  order_id uuid references public.market_orders(id) on delete set null,
  offer_id uuid references public.market_offers(id) on delete set null,
  listing_id uuid references public.market_listings(id) on delete set null,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.market_notifications enable row level security;
revoke all on table public.market_notifications from public, anon, authenticated;

create index if not exists market_notifications_recipient_created_idx
  on public.market_notifications(recipient_id, created_at desc);
create index if not exists market_notifications_recipient_unread_idx
  on public.market_notifications(recipient_id, created_at desc)
  where read_at is null;

create or replace function public.emit_market_offer_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_qty integer;
begin
  select card_name into v_title from public.market_listings where id = new.listing_id;
  v_title := coalesce(v_title, new.listing_snapshot->>'card_name', 'DUELVANTA Produkt');
  v_qty := greatest(coalesce(new.requested_quantity, 1), 1);

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.market_notifications(
      recipient_id, kind, title, body, offer_id, listing_id, dedupe_key
    ) values (
      new.seller_id,
      'offer_received',
      'NEUES ANGEBOT',
      v_qty::text || ' × ' || v_title || ' · ' || round(new.amount, 2)::text || ' €',
      new.id,
      new.listing_id,
      'offer_received:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted' then
    insert into public.market_notifications(
      recipient_id, kind, title, body, offer_id, listing_id, dedupe_key
    ) values (
      new.buyer_id,
      'offer_accepted',
      'ANGEBOT ANGENOMMEN',
      v_qty::text || ' × ' || v_title || ' · ' || round(new.amount, 2)::text || ' €',
      new.id,
      new.listing_id,
      'offer_accepted:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.emit_market_offer_notification() from public, anon, authenticated;

drop trigger if exists trg_market_offer_notifications on public.market_offers;
create trigger trg_market_offer_notifications
after insert or update of status on public.market_offers
for each row execute function public.emit_market_offer_notification();

create or replace function public.emit_market_purchase_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer_id uuid;
  v_seller_id uuid;
  v_order_number text;
begin
  select d.offer_id, o.seller_id, o.order_number
    into v_offer_id, v_seller_id, v_order_number
  from public.market_deals d
  join public.market_orders o on o.id = new.order_id
  where d.id = new.deal_id;

  -- Only direct fixed-price purchases create the purchase notification.
  -- Negotiated offers already produce an offer-accepted notification.
  if v_seller_id is not null and v_offer_id is null then
    insert into public.market_notifications(
      recipient_id, kind, title, body, order_id, listing_id, dedupe_key
    ) values (
      v_seller_id,
      'purchase',
      'NEUER KAUF',
      greatest(coalesce(new.quantity, 1), 1)::text || ' × ' || coalesce(new.item_title, 'DUELVANTA Produkt') ||
        case when v_order_number is null then '' else ' · ' || v_order_number end,
      new.order_id,
      new.listing_id,
      'purchase:' || new.deal_id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.emit_market_purchase_notification() from public, anon, authenticated;

drop trigger if exists trg_market_purchase_notification on public.market_order_items;
create trigger trg_market_purchase_notification
after insert on public.market_order_items
for each row execute function public.emit_market_purchase_notification();

create or replace function public.emit_market_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.shipped_at is null and new.shipped_at is not null then
    insert into public.market_notifications(
      recipient_id, kind, title, body, order_id, dedupe_key
    ) values (
      new.buyer_id,
      'order_shipped',
      case when new.fulfillment_group = 'pickup' then 'ÜBERGABE BESTÄTIGT' else 'ORDER VERSENDET' end,
      coalesce(new.order_number, 'DUELVANTA Order') ||
        case when new.tracking_code is null or new.tracking_code = '' then '' else ' · Tracking hinterlegt' end,
      new.id,
      'order_shipped:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  if old.received_at is null and new.received_at is not null then
    insert into public.market_notifications(
      recipient_id, kind, title, body, order_id, dedupe_key
    ) values (
      new.seller_id,
      'order_received',
      'ERHALT BESTÄTIGT',
      coalesce(new.order_number, 'DUELVANTA Order') || ' wurde vom Käufer abgeschlossen.',
      new.id,
      'order_received:' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.emit_market_order_status_notification() from public, anon, authenticated;

drop trigger if exists trg_market_order_status_notifications on public.market_orders;
create trigger trg_market_order_status_notifications
after update of shipped_at, received_at on public.market_orders
for each row execute function public.emit_market_order_status_notification();

create or replace function public.get_my_market_notifications(p_limit integer default 40)
returns table(
  notification_id uuid,
  kind text,
  title text,
  body text,
  order_id uuid,
  offer_id uuid,
  listing_id uuid,
  is_unread boolean,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  return query
  select n.id, n.kind, n.title, n.body, n.order_id, n.offer_id, n.listing_id,
         n.read_at is null, n.read_at, n.created_at
  from public.market_notifications n
  where n.recipient_id = auth.uid()
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

revoke all on function public.get_my_market_notifications(integer) from public, anon;
grant execute on function public.get_my_market_notifications(integer) to authenticated;

create or replace function public.mark_market_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  update public.market_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();
end;
$$;

revoke all on function public.mark_market_notification_read(uuid) from public, anon;
grant execute on function public.mark_market_notification_read(uuid) to authenticated;

create or replace function public.mark_all_market_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  update public.market_notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_all_market_notifications_read() from public, anon;
grant execute on function public.mark_all_market_notifications_read() to authenticated;

create or replace function public.get_my_trade_actions()
returns table(
  action_key text,
  action_type text,
  priority integer,
  title text,
  subject text,
  quantity integer,
  amount numeric,
  order_id uuid,
  offer_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  return query
  select * from (
    select
      'offer:' || mo.id::text as action_key,
      'offer_review'::text as action_type,
      10 as priority,
      'ANGEBOT PRÜFEN'::text as title,
      coalesce(ml.card_name, mo.listing_snapshot->>'card_name', 'DUELVANTA Produkt')::text as subject,
      greatest(coalesce(mo.requested_quantity, 1), 1)::integer as quantity,
      mo.amount::numeric as amount,
      null::uuid as order_id,
      mo.id as offer_id,
      mo.created_at as created_at
    from public.market_offers mo
    left join public.market_listings ml on ml.id = mo.listing_id
    where mo.seller_id = auth.uid()
      and mo.status = 'pending'

    union all

    select
      'address:' || o.id::text,
      'add_address'::text,
      20,
      'LIEFERADRESSE HINTERLEGEN'::text,
      o.order_number::text,
      o.item_count::integer,
      o.total_amount::numeric,
      o.id,
      null::uuid,
      o.created_at
    from public.market_orders o
    where o.buyer_id = auth.uid()
      and o.fulfillment_group = 'shipping'
      and o.status in ('open', 'in_progress')
      and not exists (
        select 1 from public.market_order_shipping_addresses a where a.order_id = o.id
      )

    union all

    select
      'quote:' || o.id::text,
      'shipping_quote'::text,
      30,
      'GESAMTVERSAND FESTLEGEN'::text,
      o.order_number::text,
      o.item_count::integer,
      o.total_amount::numeric,
      o.id,
      null::uuid,
      o.created_at
    from public.market_orders o
    where o.seller_id = auth.uid()
      and o.status in ('open', 'in_progress')
      and o.shipping_quote_status = 'review_required'

    union all

    select
      'ship:' || o.id::text,
      'ship_order'::text,
      40,
      case when o.fulfillment_group = 'pickup' then 'ÜBERGABE BESTÄTIGEN' else 'ORDER VERSENDEN' end::text,
      o.order_number::text,
      o.item_count::integer,
      o.total_amount::numeric,
      o.id,
      null::uuid,
      o.created_at
    from public.market_orders o
    where o.seller_id = auth.uid()
      and o.status in ('open', 'in_progress')
      and o.shipping_quote_status <> 'review_required'
      and o.payment_status in ('not_required', 'paid')
      and (
        o.fulfillment_group = 'pickup'
        or exists (select 1 from public.market_order_shipping_addresses a where a.order_id = o.id)
      )

    union all

    select
      'received:' || o.id::text,
      'confirm_received'::text,
      50,
      'ERHALT BESTÄTIGEN'::text,
      o.order_number::text,
      o.item_count::integer,
      o.total_amount::numeric,
      o.id,
      null::uuid,
      o.created_at
    from public.market_orders o
    where o.buyer_id = auth.uid()
      and o.status = 'shipped'
      and o.shipped_at is not null
      and not exists (
        select 1 from public.market_deals d where d.order_id = o.id and d.status = 'disputed'
      )
  ) actions
  order by actions.priority, actions.created_at desc;
end;
$$;

revoke all on function public.get_my_trade_actions() from public, anon;
grant execute on function public.get_my_trade_actions() to authenticated;