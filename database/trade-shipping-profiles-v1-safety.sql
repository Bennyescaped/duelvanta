-- DUELVANTA TRADE shipping profiles V1 safety
-- Sealed/all-product auto shipping needs both unit and weight capacity.
-- Seller shipping review is not surfaced before the buyer has an address.
-- No existing rows are rewritten.

create or replace function public.validate_market_shipping_profile_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_scope text;
begin
  select p.product_scope into v_scope
  from public.market_shipping_profiles p
  where p.id=new.profile_id;

  if v_scope is null then raise exception 'Versandprofil nicht gefunden'; end if;
  if v_scope in ('all','sealed') and (new.max_units is null or new.max_weight_grams is null) then
    raise exception 'Für Sealed oder Alle Produkte braucht jede Tarifregel Max. Produkte und Max. Gewicht';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_market_shipping_profile_rule() from public, anon, authenticated;
grant execute on function public.validate_market_shipping_profile_rule() to service_role;

drop trigger if exists trg_validate_market_shipping_profile_rule on public.market_shipping_profile_rules;
create trigger trg_validate_market_shipping_profile_rule
before insert or update of profile_id,max_units,max_weight_grams
on public.market_shipping_profile_rules
for each row execute function public.validate_market_shipping_profile_rule();

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
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

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
    left join public.market_listings ml on ml.id=mo.listing_id
    where mo.seller_id=auth.uid() and mo.status='pending'

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
    where o.buyer_id=auth.uid()
      and o.fulfillment_group='shipping'
      and o.status in ('open','in_progress')
      and not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id)

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
    where o.seller_id=auth.uid()
      and o.status in ('open','in_progress')
      and o.shipping_quote_status='review_required'
      and (
        o.fulfillment_group='pickup'
        or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id)
      )

    union all

    select
      'ship:' || o.id::text,
      'ship_order'::text,
      40,
      case when o.fulfillment_group='pickup' then 'ÜBERGABE BESTÄTIGEN' else 'ORDER VERSENDEN' end::text,
      o.order_number::text,
      o.item_count::integer,
      o.total_amount::numeric,
      o.id,
      null::uuid,
      o.created_at
    from public.market_orders o
    where o.seller_id=auth.uid()
      and o.status in ('open','in_progress')
      and o.shipping_quote_status<>'review_required'
      and o.payment_status in ('not_required','paid')
      and (
        o.fulfillment_group='pickup'
        or exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id)
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
    where o.buyer_id=auth.uid()
      and o.status='shipped'
      and o.shipped_at is not null
      and not exists(select 1 from public.market_deals d where d.order_id=o.id and d.status='disputed')
  ) actions
  order by actions.priority,actions.created_at desc;
end;
$$;

revoke all on function public.get_my_trade_actions() from public, anon;
grant execute on function public.get_my_trade_actions() to authenticated;
