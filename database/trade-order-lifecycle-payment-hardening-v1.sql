-- DUELVANTA TRADE order lifecycle payment hardening V1
-- Keeps shipment, receipt actions and completion aligned with the authoritative payment state.
-- No existing order/payment/evidence rows are rewritten.

create or replace function public.mark_market_order_shipped(
  p_order_id uuid,
  p_carrier text default null,
  p_tracking_code text default null
)
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
  if exists(
    select 1 from public.market_order_cases c
    where c.order_id=o.id
      and c.case_type='cancellation'
      and c.status in ('open','accepted_refund_pending')
  ) then raise exception 'Stornoanfrage ist noch offen'; end if;
  if o.shipping_quote_status='review_required' then raise exception 'Combined Shipping muss zuerst bestätigt werden'; end if;
  if o.payment_status not in ('not_required','paid')
     or (o.payment_provider<>'manual_beta' and o.payment_status<>'paid') then
    raise exception 'Versand erst nach vollständiger Zahlung';
  end if;
  if o.fulfillment_group='shipping'
     and not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id) then
    raise exception 'Lieferadresse fehlt';
  end if;

  update public.market_orders
  set status='shipped',
      carrier=case when fulfillment_group='pickup' then 'Abholung' else nullif(left(trim(coalesce(p_carrier,'')),80),'') end,
      tracking_code=case when fulfillment_group='pickup' then null else nullif(left(trim(coalesce(p_tracking_code,'')),160),'') end,
      shipped_at=coalesce(shipped_at,now()),
      updated_at=now()
  where id=o.id;

  update public.market_deals d
  set status=case when d.status='accepted' then 'in_progress' else d.status end,
      fulfillment_status='shipped',
      carrier=case when o.fulfillment_group='pickup' then 'Abholung' else nullif(left(trim(coalesce(p_carrier,'')),80),'') end,
      tracking_code=case when o.fulfillment_group='pickup' then null else nullif(left(trim(coalesce(p_tracking_code,'')),160),'') end,
      shipped_at=coalesce(d.shipped_at,now()),
      updated_at=now()
  where d.order_id=o.id
    and d.status not in ('cancelled','completed','disputed');
end;
$$;

revoke all on function public.mark_market_order_shipped(uuid,text,text) from public, anon;
grant execute on function public.mark_market_order_shipped(uuid,text,text) to authenticated;

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
    select 'problem:'||c.id::text,'problem_response',18,'PROBLEM PRÜFEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,c.created_at
    from public.market_order_cases c join public.market_orders o on o.id=c.order_id
    where c.case_type='problem' and c.status='open' and c.responded_at is null and c.opened_by<>auth.uid() and auth.uid() in (o.seller_id,o.buyer_id)

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
      and o.payment_status in ('not_required','paid')
      and (o.payment_provider='manual_beta' or o.payment_status='paid')
      and (o.fulfillment_group='pickup' or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id))
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending'))

    union all
    select 'received:'||o.id::text,'confirm_received',50,'ERHALT BESTÄTIGEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.buyer_id=auth.uid() and o.status='shipped' and o.shipped_at is not null
      and o.payment_status in ('not_required','paid')
      and (o.payment_provider='manual_beta' or o.payment_status='paid')
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open')
  ) actions(action_key,action_type,priority,title,subject,quantity,amount,order_id,offer_id,created_at)
  order by actions.priority,actions.created_at desc;
end;
$$;

revoke all on function public.get_my_trade_actions() from public, anon;
grant execute on function public.get_my_trade_actions() to authenticated;
