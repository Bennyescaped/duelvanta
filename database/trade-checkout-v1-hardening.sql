-- Apply after trade-checkout-v1.sql. No existing purchases are rewritten.
CREATE OR REPLACE FUNCTION public.recalculate_market_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.market_orders;
  v_count int:=0; v_sub numeric:=0; v_sep numeric:=0; v_auto_cost numeric:=0; v_weight int:=0;
  v_method text:='custom'; v_review boolean:=false; v_custom boolean:=false; v_methods int:=0;
  v_missing_sealed_data boolean:=false; v_package_too_large boolean:=false; v_same_shape boolean:=false;
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null then return; end if;
  if o.status not in ('open','in_progress') then return; end if;
  select count(*),coalesce(sum(i.item_amount),0),coalesce(sum(i.individual_shipping_cost),0),coalesce(max(i.individual_shipping_cost),0),
         coalesce(sum(coalesce(i.weight_grams,0)),0),coalesce(bool_or(i.shipping_method='custom'),false),count(distinct i.shipping_method),
         coalesce(bool_or(d.product_kind='sealed' and (d.weight_grams is null or d.length_mm is null or d.width_mm is null or d.height_mm is null)),false),
         coalesce(bool_or(d.product_kind='sealed' and (d.length_mm>1200 or d.width_mm>600 or d.height_mm>600)),false)
  into v_count,v_sub,v_sep,v_auto_cost,v_weight,v_custom,v_methods,v_missing_sealed_data,v_package_too_large
  from public.market_order_items i join public.market_deals d on d.id=i.deal_id
  where i.order_id=p_order_id and d.status<>'cancelled';
  if v_count=0 then
    update public.market_orders set status='cancelled',item_count=0,subtotal=0,separate_shipping_sum=0,shipping_cost=0,total_amount=0,shipping_savings=0,cancelled_at=coalesce(cancelled_at,now()),updated_at=now() where id=p_order_id;
    return;
  end if;
  if o.fulfillment_group='pickup' then
    v_method:='pickup';v_auto_cost:=0;v_review:=false;
  else
    select case max(case i.shipping_method when 'standard_letter' then 1 when 'tracked_letter' then 2 when 'parcel' then 3 when 'custom' then 4 else 0 end)
      when 1 then 'standard_letter' when 2 then 'tracked_letter' when 3 then 'parcel' else 'custom' end
    into v_method from public.market_order_items i join public.market_deals d on d.id=i.deal_id
    where i.order_id=p_order_id and d.status<>'cancelled';
    -- No seller parcel capacity/tariff exists yet: dimensions alone cannot price a bundle.
    v_review:=v_custom or v_count>1 or exists(
      select 1 from public.market_order_items i join public.market_deals d on d.id=i.deal_id
      where i.order_id=p_order_id and d.status<>'cancelled' and i.quantity>1
    );
  end if;
  v_same_shape:=(o.item_count=v_count and o.subtotal=v_sub and o.separate_shipping_sum=v_sep and o.total_weight_grams=v_weight);
  update public.market_orders set
    item_count=v_count,subtotal=round(v_sub,2),separate_shipping_sum=round(v_sep,2),total_weight_grams=v_weight,
    shipping_method=case when shipping_quote_status='confirmed' and v_same_shape then shipping_method else v_method end,
    shipping_cost=case when shipping_quote_status='confirmed' and v_same_shape then shipping_cost else round(v_auto_cost,2) end,
    shipping_quote_status=case when shipping_quote_status='confirmed' and v_same_shape then 'confirmed' when v_review then 'review_required' else 'auto' end,
    shipping_note=case when shipping_quote_status='confirmed' and v_same_shape then shipping_note else case when v_review then 'Combined Shipping muss vom Verkäufer geprüft werden.' else null end end,
    total_amount=round(v_sub+(case when shipping_quote_status='confirmed' and v_same_shape then shipping_cost else v_auto_cost end),2),
    shipping_savings=round(v_sep-(case when shipping_quote_status='confirmed' and v_same_shape then shipping_cost else v_auto_cost end),2),
    payment_status=case when payment_provider='stripe_connect' and paid_amount>0 and paid_amount<round(v_sub+(case when shipping_quote_status='confirmed' and v_same_shape then shipping_cost else v_auto_cost end),2) then 'balance_due' else payment_status end,
    updated_at=now()
  where id=p_order_id;
end $function$;

CREATE OR REPLACE FUNCTION public.attach_market_deal_to_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order uuid; v_group text; v_title text; v_num text;
begin
  if new.order_id is not null then return new; end if;
  v_group:=case when new.shipping_method='pickup' then 'pickup' else 'shipping' end;
  perform pg_advisory_xact_lock(hashtextextended(new.seller_id::text||':'||new.buyer_id::text||':'||v_group, 42));
  select id into v_order from public.market_orders
   where seller_id=new.seller_id and buyer_id=new.buyer_id and fulfillment_group=v_group
     and status in ('open','in_progress') and shipped_at is null and payment_provider='manual_beta' and payment_status='not_required' and paid_amount=0
   order by created_at desc limit 1 for update;
  if v_order is null then
    v_num:='DV-'||to_char(now(),'YYMMDD')||'-'||lpad(nextval('public.market_order_number_seq')::text,6,'0');
    insert into public.market_orders(order_number,seller_id,buyer_id,fulfillment_group,shipping_method,shipping_cost,shipping_quote_status)
    values(v_num,new.seller_id,new.buyer_id,v_group,new.shipping_method,new.shipping_cost,'auto') returning id into v_order;
  end if;
  select card_name into v_title from public.market_listings where id=new.listing_id;
  insert into public.market_order_items(order_id,deal_id,listing_id,item_title,product_kind,sealed_category,quantity,item_amount,individual_shipping_cost,shipping_method,weight_grams)
  values(v_order,new.id,new.listing_id,coalesce(v_title,'DUELVANTA Produkt'),coalesce(new.product_kind,'single'),new.sealed_category,coalesce(new.item_quantity,1),coalesce(new.amount,0),coalesce(new.shipping_cost,0),new.shipping_method,new.weight_grams)
  on conflict(deal_id) do nothing;
  update public.market_deals set order_id=v_order where id=new.id;
  perform public.recalculate_market_order(v_order);
  return new;
end $function$;

-- A retry must not create a second purchase.
alter table public.market_deals add column if not exists checkout_request_id uuid;
create unique index if not exists market_deals_checkout_request_uq
  on public.market_deals(buyer_id,checkout_request_id) where checkout_request_id is not null;
alter table public.market_offers add column if not exists listing_snapshot jsonb;

create or replace function public.buy_market_listing_v2(
  p_listing_id uuid,p_quantity integer,p_request_id uuid,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare l public.market_listings; d public.market_deals; result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_request_id is null or p_expected_updated_at is null or p_quantity is null or p_quantity not between 1 and 1000 then raise exception 'Ungültige Kaufanfrage'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_id::text,43));
  select * into d from public.market_deals where buyer_id=auth.uid() and checkout_request_id=p_request_id;
  if d.id is not null then
    if d.listing_id<>p_listing_id or d.item_quantity<>p_quantity then raise exception 'Diese Kaufanfrage wurde bereits verwendet'; end if;
    return jsonb_build_object('deal_id',d.id,'order_id',d.order_id,'quantity',d.item_quantity,'item_total',d.amount,'replayed',true);
  end if;
  select * into l from public.market_listings where id=p_listing_id for update;
  if l.id is null or l.status<>'active' then raise exception 'Produkt nicht mehr verfügbar'; end if;
  if l.updated_at is distinct from p_expected_updated_at then raise exception 'Angebot wurde geändert. Bitte Menge, Preis und Versand erneut prüfen.'; end if;
  if exists(select 1 from public.profiles where id in (auth.uid(),l.seller_id) and (account_status='suspended' or safety_restricted)) then raise exception 'Kauf für diesen Account nicht verfügbar'; end if;
  if l.asking_price::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültiger Festpreis'; end if;
  result:=public.buy_market_listing_v1(p_listing_id,p_quantity);
  update public.market_deals set checkout_request_id=p_request_id where id=(result->>'deal_id')::uuid;
  return result;
end $$;
-- Internal legacy implementation; only the checked/idempotent entrypoint is exposed.
revoke all on function public.buy_market_listing_v1(uuid,integer) from public,anon,authenticated;
revoke all on function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) from public,anon;
grant execute on function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) to authenticated;

create or replace function public.confirm_market_order_received(p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare o public.market_orders;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann den Erhalt bestätigen'; end if;
  if o.status='completed' then return; end if;
  if o.status not in ('shipped','received') or o.shipped_at is null then raise exception 'Order ist noch nicht als versendet markiert'; end if;
  if o.payment_status not in ('not_required','paid') or (o.payment_provider<>'manual_beta' and o.payment_status<>'paid') then raise exception 'Zahlung ist noch offen'; end if;
  if exists(select 1 from public.market_deals where order_id=o.id and status='disputed') then raise exception 'Ein Problem ist noch offen'; end if;
  update public.market_orders set status='completed',received_at=coalesce(received_at,now()),
    buyer_confirmed_at=coalesce(buyer_confirmed_at,now()),seller_confirmed_at=coalesce(seller_confirmed_at,shipped_at),
    completed_at=coalesce(completed_at,now()),updated_at=now() where id=o.id;
  update public.market_deals set status='completed',fulfillment_status='received',
    received_at=coalesce(received_at,now()),buyer_confirmed_at=coalesce(buyer_confirmed_at,now()),
    seller_confirmed_at=coalesce(seller_confirmed_at,shipped_at,o.shipped_at),
    completed_at=coalesce(completed_at,now()),updated_at=now()
    where order_id=o.id and status in ('accepted','in_progress');
  -- Never reactivate a paused/withdrawn listing or mark remaining inventory sold.
  update public.market_listings l set status='sold',ended_at=coalesce(l.ended_at,now()),updated_at=now()
    where l.status='reserved' and l.quantity_available=0
    and exists(select 1 from public.market_deals d where d.order_id=o.id and d.listing_id=l.id and d.status='completed')
    and not exists(select 1 from public.market_deals d where d.listing_id=l.id and d.status not in ('completed','cancelled'));
  update public.market_offers mo set completed_at=coalesce(completed_at,now()),updated_at=now()
    where mo.status='accepted' and exists(select 1 from public.market_deals d where d.order_id=o.id and d.offer_id=mo.id and d.status='completed');
end $$;

-- Compatibility for an old browser: no new seller completion requirement.
create or replace function public.confirm_market_order_complete(p_order_id uuid)
returns text language plpgsql security definer set search_path=public
as $$
declare o public.market_orders;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt'; end if;
  if o.status in ('completed','cancelled','disputed') then return o.status; end if;
  if auth.uid()<>o.buyer_id then raise exception 'Der Käufer bestätigt einmalig den Erhalt. Eine zusätzliche Verkäuferbestätigung entfällt.'; end if;
  perform public.confirm_market_order_received(p_order_id);
  return 'completed';
end $$;

create or replace function public.get_my_market_offers_v2()
returns jsonb language sql stable security definer set search_path=public
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'id',o.id,'listing_id',o.listing_id,'seller_id',o.seller_id,'buyer_id',o.buyer_id,
 'status',o.status,'amount',o.amount,'message',o.message,'requested_quantity',o.requested_quantity,
 'unit_price_snapshot',o.unit_price_snapshot,'listed_unit_price_snapshot',o.listed_unit_price_snapshot,
 'listed_total_snapshot',o.listed_total_snapshot,'created_at',o.created_at,
 'listing_snapshot',coalesce(o.listing_snapshot,jsonb_build_object('card_name',l.card_name,'product_kind',l.product_kind,'sealed_category',l.sealed_category,'language',l.language,'set_name',l.set_name)),
 'historical_price',o.listed_total_snapshot is not null,
 'order_id',d.order_id,'order_number',ord.order_number,
 'other_name',case when auth.uid()=o.seller_id then coalesce(pb.display_name,pb.username) else coalesce(ps.display_name,ps.username) end,
 'other_username',case when auth.uid()=o.seller_id then pb.username else ps.username end
) order by o.created_at desc),'[]'::jsonb)
from public.market_offers o join public.market_listings l on l.id=o.listing_id
left join public.market_deals d on d.offer_id=o.id
left join public.market_orders ord on ord.id=d.order_id
left join public.profiles pb on pb.id=o.buyer_id left join public.profiles ps on ps.id=o.seller_id
where auth.uid() in (o.seller_id,o.buyer_id);
$$;
revoke all on function public.get_my_market_offers_v2() from public,anon;
grant execute on function public.get_my_market_offers_v2() to authenticated;

CREATE OR REPLACE FUNCTION public.create_market_offer_v2(p_listing_id uuid, p_requested_quantity integer, p_amount numeric, p_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.market_listings;
  v_id uuid;
  v_list_unit numeric;
  t jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into l from public.market_listings where id=p_listing_id and status='active' for update;
  if l.id is null or l.seller_id=auth.uid() then raise exception 'Angebot nicht möglich'; end if;
  if l.listing_type not in ('sale','sale_or_trade') then raise exception 'Für dieses Produkt ist kein Preisangebot möglich'; end if;
  if l.pricing_mode='fixed' then raise exception 'Dieses Produkt wird zum Festpreis angeboten'; end if;
  if p_requested_quantity is null or p_requested_quantity not between 1 and 1000 then raise exception 'Ungültige Menge'; end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
  if (l.product_kind='sealed' and (p_requested_quantity<l.minimum_purchase_quantity or p_requested_quantity>l.quantity_available))
     or (l.product_kind<>'sealed' and p_requested_quantity<>1) then
    raise exception 'Gewünschte Menge ist nicht verfügbar';
  end if;
  if p_amount::text in ('NaN','Infinity','-Infinity') or coalesce(p_amount,0)<=0 then raise exception 'Ungültige Angebotssumme'; end if;

  v_list_unit:=l.asking_price;
  if l.product_kind='sealed' then
    for t in select value from jsonb_array_elements(coalesce(l.quantity_pricing,'[]'::jsonb)) order by (value->>'min_quantity')::int loop
      if p_requested_quantity >= (t->>'min_quantity')::int then v_list_unit:=(t->>'unit_price')::numeric; end if;
    end loop;
  end if;

  insert into public.market_offers(
    listing_id,buyer_id,seller_id,offer_type,amount,currency,message,requested_quantity,
    unit_price_snapshot,listed_unit_price_snapshot,listed_total_snapshot
  ) values(
    l.id,auth.uid(),l.seller_id,'price',round(p_amount,2),'EUR',nullif(left(trim(coalesce(p_message,'')),500),''),p_requested_quantity,
    round(p_amount/p_requested_quantity,2),round(v_list_unit,2),round(v_list_unit*p_requested_quantity,2)
  ) returning id into v_id;
  update public.market_offers set listing_snapshot=jsonb_build_object(
    'card_name',l.card_name,'product_kind',l.product_kind,'sealed_category',l.sealed_category,
    'language',l.language,'set_name',l.set_name,'base_unit_price',l.asking_price,'shipping_method',l.shipping_method,'shipping_cost',l.shipping_cost
  ) where id=v_id;
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.respond_to_market_offer(p_offer_id uuid, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.market_offers; l public.market_listings; v_qty int; v_left int;
begin
 if auth.uid() is null or p_action is null or p_action not in ('accepted','declined') then raise exception 'Nicht erlaubt'; end if;
 select * into o from public.market_offers where id=p_offer_id;
 if o.id is null or o.seller_id<>auth.uid() then raise exception 'Angebot nicht verfügbar'; end if;
 -- Same lock order as checkout and listing edits.
 select * into l from public.market_listings where id=o.listing_id for update;
 select * into o from public.market_offers where id=p_offer_id for update;
 if o.status=p_action then return; end if;
 if o.id is null or o.seller_id<>auth.uid() or o.status<>'pending' then raise exception 'Angebot ist nicht verfügbar'; end if;
 if p_action='declined' then update public.market_offers set status='declined',responded_at=now(),updated_at=now() where id=o.id; return; end if;
 select * into l from public.market_listings where id=o.listing_id for update;
 if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
 if l.pricing_mode='fixed' then raise exception 'Dieses Listing wird inzwischen zum Festpreis angeboten'; end if;
 if l.status<>'active' or l.seller_id<>auth.uid() then raise exception 'Listing ist nicht aktiv'; end if;
 v_qty:=case when l.product_kind='sealed' then o.requested_quantity else 1 end;
 if v_qty<1 or v_qty>l.quantity_available then raise exception 'Menge nicht mehr verfügbar'; end if;
 v_left:=l.quantity_available-v_qty;
 update public.market_offers set status='accepted',responded_at=now(),updated_at=now() where id=o.id;
 update public.market_offers set status='declined',responded_at=now(),updated_at=now() where listing_id=o.listing_id and id<>o.id and status='pending' and requested_quantity>v_left;
 update public.market_listings set quantity_available=v_left,status=case when v_left=0 then 'reserved' else 'active' end,accepted_offer_id=case when v_left=0 then o.id else accepted_offer_id end,deal_price=o.amount,deal_buyer_id=o.buyer_id,updated_at=now() where id=l.id;
 insert into public.market_deals(listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,package_contents,weight_grams,length_mm,width_mm,height_mm)
 values(o.listing_id,o.id,o.seller_id,o.buyer_id,o.amount,o.currency,'accepted',now(),l.shipping_method,l.shipping_cost,l.shipping_note,l.product_kind,l.sealed_category,v_qty,l.package_contents,case when l.weight_grams is null then null else l.weight_grams*v_qty end,l.length_mm,l.width_mm,l.height_mm) on conflict (offer_id) do nothing;
end $function$
;
