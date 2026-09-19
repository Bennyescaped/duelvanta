-- DUELVANTA TRADE notifications v2
-- Durable, idempotent notification backfill/sync for C2C swaps, swap problems and pickup chats.

alter table public.market_notifications
  add column if not exists context_type text,
  add column if not exists context_id uuid;

create index if not exists market_notifications_recipient_context_idx
  on public.market_notifications(recipient_id, context_type, context_id, created_at desc);

drop function if exists public.get_my_market_notifications(integer);
create function public.get_my_market_notifications(p_limit integer default 40)
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
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

revoke all on function public.get_my_market_notifications(integer) from public, anon;
grant execute on function public.get_my_market_notifications(integer) to authenticated;

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

  -- New or revised swap proposal from the other party.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    case when r.revision_no = 1 then 'swap_proposed' else 'swap_revised' end,
    case when r.revision_no = 1 then 'NEUER TAUSCHVORSCHLAG' else 'TAUSCHVORSCHLAG GEÄNDERT' end,
    'C2C-Tausch · Revision ' || r.revision_no::text || ' · ' ||
      case when coalesce(r.fulfillment_mode, t.fulfillment_mode) = 'pickup' then 'Persönliche Abholung' else 'Versand' end,
    'swap',
    t.id,
    'swap_revision:' || r.id::text || ':' || v_uid::text,
    r.created_at
  from dv_market_private.market_swap_revisions r
  join dv_market_private.market_swap_threads t on t.id = r.thread_id
  where r.proposed_by <> v_uid
    and v_uid in (t.party_a_id, t.party_b_id)
    and r.created_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Counterparty confirmed the current revision.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_confirmed',
    'TAUSCHSTAND BESTÄTIGT',
    'Die Gegenseite hat Revision ' || r.revision_no::text || ' bestätigt.',
    'swap',
    t.id,
    'swap_confirm:' || c.revision_id::text || ':' || c.user_id::text || ':' || v_uid::text,
    c.confirmed_at
  from dv_market_private.market_swap_confirmations c
  join dv_market_private.market_swap_threads t on t.id = c.thread_id
  join dv_market_private.market_swap_revisions r on r.id = c.revision_id
  where c.user_id <> v_uid
    and v_uid in (t.party_a_id, t.party_b_id)
    and c.confirmed_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Binding after both confirmations.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_bound',
    'TAUSCH VERBINDLICH',
    'Beide Seiten haben denselben finalen Tauschstand bestätigt.',
    'swap',
    t.id,
    'swap_bound:' || t.id::text || ':' || v_uid::text,
    t.binding_at
  from dv_market_private.market_swap_threads t
  where t.binding_at is not null
    and v_uid in (t.party_a_id, t.party_b_id)
    and t.binding_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Counterparty shipped its side of a swap.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_shipped',
    'TAUSCH VERSENDET',
    case
      when nullif(f.tracking_code, '') is not null then coalesce(nullif(f.carrier, ''), 'Versanddienst') || ' · Tracking hinterlegt'
      else 'Die Gegenseite hat den Versand bestätigt.'
    end,
    'swap',
    f.thread_id,
    'swap_shipped:' || f.thread_id::text || ':' || f.sender_id::text || ':' || v_uid::text,
    f.shipped_at
  from dv_market_private.market_swap_fulfillments f
  join dv_market_private.market_swap_threads t on t.id = f.thread_id
  where f.receiver_id = v_uid
    and f.sender_id <> v_uid
    and f.shipped_at is not null
    and f.shipped_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Counterparty confirmed receipt of the user's shipment.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_received',
    'TAUSCH-ERHALT BESTÄTIGT',
    'Die Gegenseite hat den Erhalt deiner Tauschsendung bestätigt.',
    'swap',
    f.thread_id,
    'swap_received:' || f.thread_id::text || ':' || f.sender_id::text || ':' || v_uid::text,
    f.receiver_confirmed_at
  from dv_market_private.market_swap_fulfillments f
  join dv_market_private.market_swap_threads t on t.id = f.thread_id
  where f.sender_id = v_uid
    and f.receiver_confirmed_at is not null
    and f.receiver_confirmed_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Pickup handover code created by the other party.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_pickup_code',
    'ÜBERGABECODE BEREIT',
    'Die Gegenseite hat einen einmaligen Übergabecode für den Tausch erzeugt.',
    'swap',
    h.thread_id,
    'swap_pickup_code:' || h.thread_id::text || ':' || h.generated_at::text || ':' || v_uid::text,
    h.generated_at
  from dv_market_private.market_swap_pickup_handovers h
  join dv_market_private.market_swap_threads t on t.id = h.thread_id
  where h.generated_by <> v_uid
    and v_uid in (t.party_a_id, t.party_b_id)
    and h.generated_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Pickup confirmed by the other party.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_pickup_confirmed',
    'TAUSCH-ÜBERGABE BESTÄTIGT',
    'Die persönliche Übergabe wurde von der Gegenseite bestätigt.',
    'swap',
    h.thread_id,
    'swap_pickup_confirmed:' || h.thread_id::text || ':' || v_uid::text,
    coalesce(h.confirmed_at, h.consumed_at)
  from dv_market_private.market_swap_pickup_handovers h
  join dv_market_private.market_swap_threads t on t.id = h.thread_id
  where h.generated_by = v_uid
    and coalesce(h.confirmed_at, h.consumed_at) is not null
    and coalesce(h.confirmed_at, h.consumed_at) >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Swap completed.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_completed',
    'TAUSCH ABGESCHLOSSEN',
    'Der C2C-Tausch ist vollständig abgeschlossen.',
    'swap',
    t.id,
    'swap_completed:' || t.id::text || ':' || v_uid::text,
    t.completed_at
  from dv_market_private.market_swap_threads t
  where t.completed_at is not null
    and v_uid in (t.party_a_id, t.party_b_id)
    and t.completed_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- New swap problem opened by the other party.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_problem_opened',
    'TAUSCH-PROBLEM GEMELDET',
    upper(c.category) || ' · ' || left(c.reason, 180),
    'swap_case',
    c.id,
    'swap_problem_opened:' || c.id::text || ':' || v_uid::text,
    c.created_at
  from dv_market_private.market_swap_cases c
  join dv_market_private.market_swap_threads t on t.id = c.thread_id
  where c.opened_by <> v_uid
    and v_uid in (t.party_a_id, t.party_b_id)
    and c.created_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Response to a problem opened by the user.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_problem_response',
    'ANTWORT AUF TAUSCH-PROBLEM',
    left(c.response_note, 180),
    'swap_case',
    c.id,
    'swap_problem_response:' || c.id::text || ':' || v_uid::text,
    c.responded_at
  from dv_market_private.market_swap_cases c
  join dv_market_private.market_swap_threads t on t.id = c.thread_id
  where c.opened_by = v_uid
    and c.responded_by is not null
    and c.responded_by <> v_uid
    and c.responded_at is not null
    and c.responded_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  -- Problem withdrawn/resolved; notify the counterparty.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'swap_problem_closed',
    'TAUSCH-PROBLEM ABGESCHLOSSEN',
    coalesce(nullif(c.resolution_note, ''), 'Der Problemfall wurde geschlossen.'),
    'swap_case',
    c.id,
    'swap_problem_closed:' || c.id::text || ':' || v_uid::text,
    c.resolved_at
  from dv_market_private.market_swap_cases c
  join dv_market_private.market_swap_threads t on t.id = c.thread_id
  where c.opened_by <> v_uid
    and v_uid in (t.party_a_id, t.party_b_id)
    and c.status <> 'open'
    and c.resolved_at is not null
    and c.resolved_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

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

  -- Pickup chat messages for swaps.
  insert into public.market_notifications(
    recipient_id, kind, title, body, context_type, context_id, dedupe_key, created_at
  )
  select
    v_uid,
    'pickup_message',
    'NEUE ABHOL-CHAT-NACHRICHT',
    'C2C-Tausch · persönliche Übergabe',
    'pickup_swap',
    t.id,
    'pickup_message:' || m.id::text || ':' || v_uid::text,
    m.created_at
  from dv_market_private.market_pickup_messages m
  join dv_market_private.market_swap_threads t on m.context_type = 'swap' and m.context_id = t.id
  where m.sender_id <> v_uid
    and m.sender_id in (t.party_a_id, t.party_b_id)
    and v_uid in (t.party_a_id, t.party_b_id)
    and m.created_at >= now() - interval '90 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  return v_total;
end;
$$;

revoke all on function public.sync_my_trade_notifications_v2() from public, anon;
grant execute on function public.sync_my_trade_notifications_v2() to authenticated;

-- Keep notification storage RPC-only.
revoke all on table public.market_notifications from public, anon, authenticated;
