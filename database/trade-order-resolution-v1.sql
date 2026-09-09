-- DUELVANTA TRADE order resolution V1
-- Order-level cancellation requests, structured problem cases and refund preparation.
-- No integrated refund/payment is executed by this migration.
-- Existing orders/deals are not backfilled or rewritten.

alter table public.market_orders
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancel_reason text,
  add column if not exists refund_status text not null default 'not_required',
  add column if not exists refund_amount numeric(12,2),
  add column if not exists provider_refund_ref text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='market_orders_refund_status_check') then
    alter table public.market_orders add constraint market_orders_refund_status_check
      check (refund_status in ('not_required','external_payment_unknown','provider_required','pending','refunded','failed'));
  end if;
  if not exists(select 1 from pg_constraint where conname='market_orders_refund_amount_check') then
    alter table public.market_orders add constraint market_orders_refund_amount_check
      check (refund_amount is null or refund_amount>=0);
  end if;
end $$;

alter table public.market_offers add column if not exists cancelled_at timestamptz;
alter table public.market_offers drop constraint if exists market_offers_status_check;
alter table public.market_offers add constraint market_offers_status_check
  check (status in ('pending','accepted','declined','withdrawn','expired','cancelled'));

alter table public.market_notifications drop constraint if exists market_notifications_kind_check;
alter table public.market_notifications add constraint market_notifications_kind_check
  check (kind in (
    'purchase','offer_received','offer_accepted','order_shipped','order_received',
    'cancellation_requested','cancellation_accepted','cancellation_declined','cancellation_withdrawn',
    'problem_opened','problem_withdrawn'
  ));

create table if not exists public.market_order_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.market_orders(id) on delete cascade,
  case_type text not null check (case_type in ('cancellation','problem')),
  status text not null default 'open' check (status in ('open','accepted','accepted_refund_pending','declined','withdrawn','resolved','closed')),
  category text,
  reason text not null check (char_length(trim(reason)) between 3 and 1200),
  opened_by uuid not null references auth.users(id) on delete restrict,
  responded_by uuid references auth.users(id) on delete set null,
  response_note text,
  responded_at timestamptz,
  refund_state text not null default 'not_required' check (refund_state in ('not_required','external_payment_unknown','provider_required','pending','refunded','failed')),
  refund_amount numeric(12,2) check (refund_amount is null or refund_amount>=0),
  provider_refund_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_order_cases enable row level security;
revoke all on table public.market_order_cases from public, anon, authenticated;
create index if not exists market_order_cases_order_idx on public.market_order_cases(order_id,created_at desc);
create unique index if not exists market_order_cases_one_active_cancel_idx
  on public.market_order_cases(order_id)
  where case_type='cancellation' and status in ('open','accepted_refund_pending');
create unique index if not exists market_order_cases_one_active_problem_idx
  on public.market_order_cases(order_id)
  where case_type='problem' and status='open';

create or replace function public.finalize_market_order_cancellation(
  p_order_id uuid,
  p_cancelled_by uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.market_orders;
  r record;
  v_reason text:=nullif(left(trim(coalesce(p_reason,'')),1000),'');
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null then raise exception 'Order nicht gefunden'; end if;
  if o.shipped_at is not null or o.status not in ('open','in_progress') then
    raise exception 'Order kann nicht mehr direkt storniert werden';
  end if;
  if o.payment_provider<>'manual_beta' and o.paid_amount>0 then
    raise exception 'Bezahlte Order benötigt zuerst eine serverseitige Erstattung';
  end if;

  update public.market_orders set
    status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancelled_by=p_cancelled_by,
    cancel_reason=v_reason,refund_status=case when payment_provider='manual_beta' then 'external_payment_unknown' else 'not_required' end,
    updated_at=now()
  where id=o.id;

  for r in
    select d.listing_id,sum(d.item_quantity)::integer as qty,
           bool_or(d.offer_id is not null) as has_offer
    from public.market_deals d
    where d.order_id=o.id and d.status in ('accepted','in_progress')
    group by d.listing_id
  loop
    update public.market_listings l set
      quantity_available=least(l.stock_quantity,l.quantity_available+r.qty),
      status=case when l.status='reserved' then 'active' else l.status end,
      accepted_offer_id=case when exists(
        select 1 from public.market_deals d2 where d2.order_id=o.id and d2.listing_id=l.id and d2.offer_id=l.accepted_offer_id
      ) then null else l.accepted_offer_id end,
      deal_price=case when exists(
        select 1 from public.market_deals d2 where d2.order_id=o.id and d2.listing_id=l.id and d2.buyer_id=l.deal_buyer_id
      ) then null else l.deal_price end,
      deal_buyer_id=case when exists(
        select 1 from public.market_deals d2 where d2.order_id=o.id and d2.listing_id=l.id and d2.buyer_id=l.deal_buyer_id
      ) then null else l.deal_buyer_id end,
      updated_at=now()
    where l.id=r.listing_id;
  end loop;

  update public.market_offers mo set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
  where mo.id in (select d.offer_id from public.market_deals d where d.order_id=o.id and d.offer_id is not null)
    and mo.status='accepted';

  update public.market_deals set
    status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancelled_by=p_cancelled_by,
    cancel_reason=v_reason,updated_at=now()
  where order_id=o.id and status in ('accepted','in_progress');
end;
$$;
revoke all on function public.finalize_market_order_cancellation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_market_order_cancellation(uuid,uuid,text) to service_role;

create or replace function public.get_my_market_order_cases()
returns table(
  case_id uuid,order_id uuid,order_number text,case_type text,status text,category text,reason text,
  response_note text,opened_by uuid,opened_by_me boolean,can_respond boolean,can_withdraw boolean,
  refund_state text,refund_amount numeric,created_at timestamptz,responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  return query
  select c.id,c.order_id,o.order_number,c.case_type,c.status,c.category,c.reason,c.response_note,c.opened_by,
         c.opened_by=auth.uid(),
         c.status='open' and c.case_type='cancellation' and c.opened_by<>auth.uid(),
         c.status='open' and c.opened_by=auth.uid(),
         c.refund_state,c.refund_amount,c.created_at,c.responded_at
  from public.market_order_cases c
  join public.market_orders o on o.id=c.order_id
  where auth.uid() in (o.seller_id,o.buyer_id)
  order by c.created_at desc;
end;
$$;
revoke all on function public.get_my_market_order_cases() from public, anon;
grant execute on function public.get_my_market_order_cases() to authenticated;

create or replace function public.request_market_order_cancellation(p_order_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.market_orders;v_reason text;v_case uuid;v_other uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Stornogrund angeben'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt'; end if;
  if o.shipped_at is not null or o.status not in ('open','in_progress') then raise exception 'Nach Versand bitte einen Problemfall melden'; end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and status in ('open','accepted_refund_pending')) then
    raise exception 'Für diese Order ist bereits ein Vorgang offen';
  end if;
  v_other:=case when auth.uid()=o.seller_id then o.buyer_id else o.seller_id end;
  insert into public.market_order_cases(order_id,case_type,status,reason,opened_by,refund_state,refund_amount)
  values(o.id,'cancellation','open',v_reason,auth.uid(),
    case when o.payment_provider='manual_beta' then 'external_payment_unknown' when o.paid_amount>0 then 'provider_required' else 'not_required' end,
    case when o.paid_amount>0 then o.total_amount else null end)
  returning id into v_case;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'cancellation_requested','STORNO ANGEFRAGT',o.order_number||' · '||left(v_reason,220),o.id,'cancel_request:'||v_case::text)
  on conflict(dedupe_key) do nothing;
  return v_case;
end;
$$;
revoke all on function public.request_market_order_cancellation(uuid,text) from public, anon;
grant execute on function public.request_market_order_cancellation(uuid,text) to authenticated;

create or replace function public.respond_market_order_cancellation(p_case_id uuid,p_accept boolean,p_note text default null)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  c public.market_order_cases;o public.market_orders;v_other uuid;v_note text:=nullif(left(trim(coalesce(p_note,'')),800),'');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into c from public.market_order_cases where id=p_case_id and case_type='cancellation' for update;
  if c.id is null or c.status<>'open' then raise exception 'Stornoanfrage ist nicht mehr offen'; end if;
  select * into o from public.market_orders where id=c.order_id for update;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) or auth.uid()=c.opened_by then raise exception 'Nicht erlaubt'; end if;
  if o.shipped_at is not null then raise exception 'Order wurde inzwischen versendet'; end if;
  v_other:=c.opened_by;
  if not coalesce(p_accept,false) then
    update public.market_order_cases set status='declined',responded_by=auth.uid(),response_note=v_note,responded_at=now(),updated_at=now() where id=c.id;
    insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
    values(v_other,'cancellation_declined','STORNO ABGELEHNT',o.order_number||coalesce(' · '||v_note,''),o.id,'cancel_declined:'||c.id::text)
    on conflict(dedupe_key) do nothing;
    return 'declined';
  end if;

  if o.payment_provider<>'manual_beta' and o.paid_amount>0 then
    update public.market_order_cases set status='accepted_refund_pending',refund_state='provider_required',refund_amount=o.total_amount,
      responded_by=auth.uid(),response_note=v_note,responded_at=now(),updated_at=now() where id=c.id;
    update public.market_orders set status='disputed',refund_status='provider_required',refund_amount=o.total_amount,
      disputed_at=coalesce(disputed_at,now()),disputed_by=c.opened_by,dispute_reason='Storno akzeptiert · Erstattung ausstehend',updated_at=now() where id=o.id;
    update public.market_deals set status='disputed',payout_status=case when payment_provider='stripe_connect' then 'blocked' else payout_status end,
      disputed_at=coalesce(disputed_at,now()),disputed_by=c.opened_by,dispute_reason='Storno akzeptiert · Erstattung ausstehend',updated_at=now()
      where order_id=o.id and status in ('accepted','in_progress');
    insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
    values(v_other,'cancellation_accepted','STORNO AKZEPTIERT · ERSTATTUNG AUSSTEHEND',o.order_number,o.id,'cancel_accepted_refund:'||c.id::text)
    on conflict(dedupe_key) do nothing;
    return 'refund_required';
  end if;

  perform public.finalize_market_order_cancellation(o.id,auth.uid(),coalesce(v_note,c.reason));
  update public.market_order_cases set status='accepted',refund_state=case when o.payment_provider='manual_beta' then 'external_payment_unknown' else 'not_required' end,
    responded_by=auth.uid(),response_note=v_note,responded_at=now(),updated_at=now() where id=c.id;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'cancellation_accepted','ORDER STORNIERT',o.order_number||' · Bestand wurde zurückgebucht.',o.id,'cancel_accepted:'||c.id::text)
  on conflict(dedupe_key) do nothing;
  return 'cancelled';
end;
$$;
revoke all on function public.respond_market_order_cancellation(uuid,boolean,text) from public, anon;
grant execute on function public.respond_market_order_cancellation(uuid,boolean,text) to authenticated;

create or replace function public.withdraw_market_order_cancellation(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.market_order_cases;o public.market_orders;v_other uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into c from public.market_order_cases where id=p_case_id and case_type='cancellation' for update;
  if c.id is null or c.status<>'open' or c.opened_by<>auth.uid() then raise exception 'Stornoanfrage kann nicht zurückgezogen werden'; end if;
  select * into o from public.market_orders where id=c.order_id;
  v_other:=case when c.opened_by=o.seller_id then o.buyer_id else o.seller_id end;
  update public.market_order_cases set status='withdrawn',responded_by=auth.uid(),responded_at=now(),updated_at=now() where id=c.id;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'cancellation_withdrawn','STORNOANFRAGE ZURÜCKGEZOGEN',o.order_number,o.id,'cancel_withdrawn:'||c.id::text)
  on conflict(dedupe_key) do nothing;
end;
$$;
revoke all on function public.withdraw_market_order_cancellation(uuid) from public, anon;
grant execute on function public.withdraw_market_order_cancellation(uuid) to authenticated;

create or replace function public.open_market_order_problem_v2(p_order_id uuid,p_category text,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;v_reason text;v_cat text;v_case uuid;v_other uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');
  v_cat:=lower(trim(coalesce(p_category,'other')));
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Problem beschreiben'; end if;
  if v_cat not in ('shipping','not_received','damaged','not_as_described','payment','other') then raise exception 'Ungültige Problemkategorie'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt'; end if;
  if o.shipped_at is null or o.status not in ('shipped','received') then raise exception 'Vor Versand bitte eine Stornoanfrage verwenden'; end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and case_type='problem' and status='open') then raise exception 'Für diese Order ist bereits ein Problem offen'; end if;
  v_other:=case when auth.uid()=o.seller_id then o.buyer_id else o.seller_id end;
  insert into public.market_order_cases(order_id,case_type,status,category,reason,opened_by,refund_state,refund_amount)
  values(o.id,'problem','open',v_cat,v_reason,auth.uid(),
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then 'provider_required' else 'not_required' end,
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then o.total_amount else null end)
  returning id into v_case;
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
end;
$$;
revoke all on function public.open_market_order_problem_v2(uuid,text,text) from public, anon;
grant execute on function public.open_market_order_problem_v2(uuid,text,text) to authenticated;

create or replace function public.open_market_order_dispute(p_order_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.open_market_order_problem_v2(p_order_id,'other',p_reason);
end;
$$;
revoke all on function public.open_market_order_dispute(uuid,text) from public, anon;
grant execute on function public.open_market_order_dispute(uuid,text) to authenticated;

create or replace function public.withdraw_market_order_problem(p_case_id uuid,p_note text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.market_order_cases;o public.market_orders;v_other uuid;v_note text:=nullif(left(trim(coalesce(p_note,'')),800),'');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into c from public.market_order_cases where id=p_case_id and case_type='problem' for update;
  if c.id is null or c.status<>'open' or c.opened_by<>auth.uid() then raise exception 'Problem kann nicht zurückgezogen werden'; end if;
  select * into o from public.market_orders where id=c.order_id for update;
  if o.id is null or o.status<>'disputed' or o.shipped_at is null then raise exception 'Orderstatus hat sich geändert'; end if;
  v_other:=case when c.opened_by=o.seller_id then o.buyer_id else o.seller_id end;
  update public.market_order_cases set status='withdrawn',response_note=v_note,responded_by=auth.uid(),responded_at=now(),updated_at=now() where id=c.id;
  update public.market_orders set status='shipped',disputed_at=null,disputed_by=null,dispute_reason=null,
    refund_status=case when refund_status='provider_required' then 'not_required' else refund_status end,
    refund_amount=case when refund_status='provider_required' then null else refund_amount end,updated_at=now() where id=o.id;
  update public.market_deals set status='in_progress',disputed_at=null,disputed_by=null,dispute_reason=null,
    payout_status=case when payout_status='blocked' then 'pending' else payout_status end,updated_at=now()
    where order_id=o.id and status='disputed';
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'problem_withdrawn','PROBLEMFALL ZURÜCKGEZOGEN',o.order_number,o.id,'problem_withdrawn:'||c.id::text)
  on conflict(dedupe_key) do nothing;
end;
$$;
revoke all on function public.withdraw_market_order_problem(uuid,text) from public, anon;
grant execute on function public.withdraw_market_order_problem(uuid,text) to authenticated;

-- Open cancellation requests block shipping until accepted, declined or withdrawn.
create or replace function public.mark_market_order_shipped(p_order_id uuid,p_carrier text default null,p_tracking_code text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann den Versand bestätigen'; end if;
  if o.status not in ('open','in_progress') then raise exception 'Order kann nicht versendet werden'; end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending')) then
    raise exception 'Stornoanfrage ist noch offen';
  end if;
  if o.shipping_quote_status='review_required' then raise exception 'Combined Shipping muss zuerst bestätigt werden'; end if;
  if o.payment_status in ('pending','balance_due','failed') then raise exception 'Versand erst nach vollständiger Zahlung'; end if;
  if o.fulfillment_group='shipping' and not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id) then raise exception 'Lieferadresse fehlt'; end if;
  update public.market_orders set status='shipped',carrier=case when fulfillment_group='pickup' then 'Abholung' else nullif(left(trim(coalesce(p_carrier,'')),80),'') end,
    tracking_code=case when fulfillment_group='pickup' then null else nullif(left(trim(coalesce(p_tracking_code,'')),160),'') end,
    shipped_at=coalesce(shipped_at,now()),updated_at=now() where id=o.id;
  update public.market_deals d set status=case when d.status='accepted' then 'in_progress' else d.status end,fulfillment_status='shipped',
    carrier=case when o.fulfillment_group='pickup' then 'Abholung' else nullif(left(trim(coalesce(p_carrier,'')),80),'') end,
    tracking_code=case when o.fulfillment_group='pickup' then null else nullif(left(trim(coalesce(p_tracking_code,'')),160),'') end,
    shipped_at=coalesce(d.shipped_at,now()),updated_at=now()
    where d.order_id=o.id and d.status not in ('cancelled','completed','disputed');
end;
$$;
revoke all on function public.mark_market_order_shipped(uuid,text,text) from public, anon;
grant execute on function public.mark_market_order_shipped(uuid,text,text) to authenticated;

create or replace function public.get_my_trade_actions()
returns table(action_key text,action_type text,priority integer,title text,subject text,quantity integer,amount numeric,order_id uuid,offer_id uuid,created_at timestamptz)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  return query
  select * from (
    select 'offer:'||mo.id::text,'offer_review'::text,10,'ANGEBOT PRÜFEN'::text,
      coalesce(ml.card_name,mo.listing_snapshot->>'card_name','DUELVANTA Produkt')::text,greatest(coalesce(mo.requested_quantity,1),1)::integer,
      mo.amount::numeric,null::uuid,mo.id,mo.created_at
    from public.market_offers mo left join public.market_listings ml on ml.id=mo.listing_id
    where mo.seller_id=auth.uid() and mo.status='pending'

    union all
    select 'cancel-response:'||c.id::text,'cancellation_response',15,'STORNO PRÜFEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,c.created_at
    from public.market_order_cases c join public.market_orders o on o.id=c.order_id
    where c.case_type='cancellation' and c.status='open' and c.opened_by<>auth.uid() and auth.uid() in (o.seller_id,o.buyer_id)

    union all
    select 'problem:'||c.id::text,'problem_open',18,'PROBLEM OFFEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,c.created_at
    from public.market_order_cases c join public.market_orders o on o.id=c.order_id
    where c.case_type='problem' and c.status='open' and c.opened_by<>auth.uid() and auth.uid() in (o.seller_id,o.buyer_id)

    union all
    select 'address:'||o.id::text,'add_address',20,'LIEFERADRESSE HINTERLEGEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.buyer_id=auth.uid() and o.fulfillment_group='shipping' and o.status in ('open','in_progress')
      and not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id)

    union all
    select 'quote:'||o.id::text,'shipping_quote',30,'GESAMTVERSAND FESTLEGEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.seller_id=auth.uid() and o.status in ('open','in_progress') and o.shipping_quote_status='review_required'
      and (o.fulfillment_group='pickup' or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id))
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending'))

    union all
    select 'ship:'||o.id::text,'ship_order',40,case when o.fulfillment_group='pickup' then 'ÜBERGABE BESTÄTIGEN' else 'ORDER VERSENDEN' end,
      o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.seller_id=auth.uid() and o.status in ('open','in_progress') and o.shipping_quote_status<>'review_required'
      and o.payment_status in ('not_required','paid') and (o.fulfillment_group='pickup' or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id))
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending'))

    union all
    select 'received:'||o.id::text,'confirm_received',50,'ERHALT BESTÄTIGEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.buyer_id=auth.uid() and o.status='shipped' and o.shipped_at is not null
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open')
  ) actions
  order by actions.priority,actions.created_at desc;
end;
$$;
revoke all on function public.get_my_trade_actions() from public, anon;
grant execute on function public.get_my_trade_actions() to authenticated;
