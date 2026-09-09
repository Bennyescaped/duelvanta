-- DUELVANTA TRADE order resolution V1 hardening
-- Add counterparty statements for open problem cases and keep action state precise.

alter table public.market_notifications drop constraint if exists market_notifications_kind_check;
alter table public.market_notifications add constraint market_notifications_kind_check
  check (kind in (
    'purchase','offer_received','offer_accepted','order_shipped','order_received',
    'cancellation_requested','cancellation_accepted','cancellation_declined','cancellation_withdrawn',
    'problem_opened','problem_response','problem_withdrawn'
  ));

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
         c.status='open' and c.opened_by<>auth.uid() and (c.case_type='cancellation' or (c.case_type='problem' and c.responded_at is null)),
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

create or replace function public.respond_market_order_problem(p_case_id uuid,p_note text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.market_order_cases;o public.market_orders;v_note text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_note:=nullif(left(trim(coalesce(p_note,'')),1000),'');
  if v_note is null or char_length(v_note)<3 then raise exception 'Bitte Stellungnahme eingeben'; end if;
  select * into c from public.market_order_cases where id=p_case_id and case_type='problem' for update;
  if c.id is null or c.status<>'open' then raise exception 'Problemfall ist nicht mehr offen'; end if;
  select * into o from public.market_orders where id=c.order_id;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) or auth.uid()=c.opened_by then raise exception 'Nicht erlaubt'; end if;
  if c.responded_at is not null then raise exception 'Stellungnahme wurde bereits abgegeben'; end if;
  update public.market_order_cases set response_note=v_note,responded_by=auth.uid(),responded_at=now(),updated_at=now() where id=c.id;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(c.opened_by,'problem_response','STELLUNGNAHME ZUM PROBLEM',o.order_number||' · '||left(v_note,220),o.id,'problem_response:'||c.id::text)
  on conflict(dedupe_key) do nothing;
end;
$$;
revoke all on function public.respond_market_order_problem(uuid,text) from public, anon;
grant execute on function public.respond_market_order_problem(uuid,text) to authenticated;

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
