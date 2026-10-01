-- Source-equivalent historical formatting required by unchanged V55 readiness.
-- Body token-equivalence to database/trade-order-lifecycle-payment-hardening-v1.sql is verified in tests.
-- Exact spelling: versioned legal-step6-preflight staging-application-schema.json.gz, get_my_trade_actions.
CREATE OR REPLACE FUNCTION public.get_my_trade_actions()
 RETURNS TABLE(action_key text, action_type text, priority integer, title text, subject text, quantity integer, amount numeric, order_id uuid, offer_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  return query
  select * from (
    select 'offer:'||mo.id::text,'offer_review'::text,10,'ANGEBOT PRÜFEN'::text,coalesce(ml.card_name,mo.listing_snapshot->>'card_name','DUELVANTA Produkt')::text,greatest(coalesce(mo.requested_quantity,1),1)::integer,mo.amount::numeric,null::uuid,mo.id,mo.created_at
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
    where o.buyer_id=auth.uid() and o.fulfillment_group='shipping' and o.status in ('open','in_progress') and not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id)
    union all
    select 'quote:'||o.id::text,'shipping_quote',30,'GESAMTVERSAND FESTLEGEN',o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
    from public.market_orders o
    where o.seller_id=auth.uid() and o.status in ('open','in_progress') and o.shipping_quote_status='review_required'
      and (o.fulfillment_group='pickup' or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id))
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending'))
    union all
    select 'ship:'||o.id::text,'ship_order',40,case when o.fulfillment_group='pickup' then 'ÜBERGABE BESTÄTIGEN' else 'ORDER VERSENDEN' end,o.order_number,o.item_count,o.total_amount,o.id,null::uuid,o.created_at
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
$function$;
revoke all on function public.get_my_trade_actions() from public,anon;
grant execute on function public.get_my_trade_actions() to authenticated;
