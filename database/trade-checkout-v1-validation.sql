CREATE OR REPLACE FUNCTION public.begin_market_deal(p_deal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.market_deals;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select * into d from public.market_deals where id=p_deal_id for update;
 if d.id is null or auth.uid() not in (d.seller_id,d.buyer_id) then raise exception 'Nicht erlaubt'; end if;
 if d.order_id is not null then raise exception 'Dieser Kauf wird über ORDERS verwaltet'; end if;
 if d.status<>'accepted' then raise exception 'Deal kann nicht gestartet werden'; end if;
 if d.payment_provider='stripe_connect' and d.payment_status<>'paid' then raise exception 'Zahlung ist noch nicht bestätigt'; end if;
 update public.market_deals
 set status='in_progress',started_at=coalesce(started_at,now()),
     fulfillment_status=case when payment_status in ('paid','not_required') then 'ready_to_ship' else fulfillment_status end,
     updated_at=now()
 where id=d.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.cancel_market_deal(p_deal_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.market_deals;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 select * into d from public.market_deals where id=p_deal_id for update;
 if d.id is null or auth.uid() not in (d.seller_id,d.buyer_id) then raise exception 'Nicht erlaubt'; end if;
 if d.order_id is not null then raise exception 'Dieser Kauf wird über ORDERS verwaltet'; end if;
 if d.status<>'accepted' then raise exception 'Nur ein noch nicht gestarteter Deal kann direkt abgebrochen werden'; end if;
 if d.payment_status='paid' then raise exception 'Bezahlter Deal kann nicht direkt abgebrochen werden. Bitte Problem melden.'; end if;
 update public.market_deals set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=nullif(left(trim(coalesce(p_reason,'')),500),''),updated_at=now() where id=d.id;
 update public.market_listings set status='active',accepted_offer_id=null,deal_price=null,deal_buyer_id=null,updated_at=now() where id=d.listing_id and status='reserved';
end $function$
;
CREATE OR REPLACE FUNCTION public.open_market_deal_dispute(p_deal_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.market_deals; reason_clean text;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
 reason_clean:=nullif(left(trim(coalesce(p_reason,'')),1000),''); if reason_clean is null then raise exception 'Bitte Grund angeben'; end if;
 select * into d from public.market_deals where id=p_deal_id for update;
 if d.id is null or auth.uid() not in (d.seller_id,d.buyer_id) then raise exception 'Nicht erlaubt'; end if;
 if d.order_id is not null then raise exception 'Dieser Kauf wird über ORDERS verwaltet'; end if;
 if d.status not in ('accepted','in_progress') then raise exception 'Dieser Deal kann nicht gemeldet werden'; end if;
 update public.market_deals set status='disputed',disputed_at=now(),disputed_by=auth.uid(),dispute_reason=reason_clean,updated_at=now() where id=d.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.buy_market_listing_v1(p_listing_id uuid, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.market_listings;
  d public.market_deals;
  v_qty integer;
  v_left integer;
  v_unit numeric;
  v_total numeric;
  t jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into l from public.market_listings where id=p_listing_id and status='active' for update;
  if l.id is null then raise exception 'Produkt ist nicht mehr verfügbar'; end if;
  if l.seller_id=auth.uid() then raise exception 'Eigene Produkte können nicht gekauft werden'; end if;
  if l.listing_type not in ('sale','sale_or_trade') or l.pricing_mode<>'fixed' then raise exception 'Dieses Produkt ist kein Festpreisangebot'; end if;
  if l.asking_price is null or l.asking_price<=0 then raise exception 'Ungültiger Festpreis'; end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Das Angebot ist abgelaufen'; end if;

  v_qty:=case when l.product_kind='sealed' then p_quantity else 1 end;
  if p_quantity is null or p_quantity<>v_qty or v_qty<1 then raise exception 'Ungültige Menge'; end if;
  if l.product_kind='sealed' and (v_qty<l.minimum_purchase_quantity or v_qty>l.quantity_available) then raise exception 'Gewünschte Menge ist nicht mehr verfügbar'; end if;
  if l.product_kind<>'sealed' and (p_quantity<>1 or l.quantity_available<1) then raise exception 'Produkt ist nicht mehr verfügbar'; end if;

  v_unit:=l.asking_price;
  if l.product_kind='sealed' then
    for t in select value from jsonb_array_elements(coalesce(l.quantity_pricing,'[]'::jsonb)) order by (value->>'min_quantity')::int loop
      if v_qty >= (t->>'min_quantity')::int then v_unit:=(t->>'unit_price')::numeric; end if;
    end loop;
  end if;
  if v_unit is null or v_unit<=0 or v_unit::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültiger Stückpreis'; end if;
  v_unit:=round(v_unit,2);
  v_total:=round(v_unit*v_qty,2);
  v_left:=l.quantity_available-v_qty;

  update public.market_listings
  set quantity_available=v_left,
      status=case when v_left=0 then 'reserved' else 'active' end,
      deal_price=v_total,
      deal_buyer_id=auth.uid(),
      updated_at=now()
  where id=l.id;

  update public.market_offers
  set status='declined',responded_at=now(),updated_at=now()
  where listing_id=l.id and status='pending' and requested_quantity>v_left;

  insert into public.market_deals(
    listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,
    shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,
    package_contents,weight_grams,length_mm,width_mm,height_mm
  ) values(
    l.id,null,l.seller_id,auth.uid(),v_total,'EUR','accepted',now(),
    l.shipping_method,l.shipping_cost,l.shipping_note,l.product_kind,l.sealed_category,v_qty,
    l.package_contents,case when l.weight_grams is null then null else l.weight_grams*v_qty end,
    l.length_mm,l.width_mm,l.height_mm
  ) returning * into d;

  select * into d from public.market_deals where id=d.id;
  return jsonb_build_object(
    'deal_id',d.id,'order_id',d.order_id,'quantity',v_qty,
    'unit_price',round(v_unit,2),'item_total',v_total,'remaining_quantity',v_left
  );
end $function$
;
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
  if l.pricing_mode='fixed' then raise exception 'Dieses Produkt wird zum Festpreis angeboten'; end if;
  if p_requested_quantity is null or p_requested_quantity not between 1 and 1000 then raise exception 'Ungültige Menge'; end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
  if (l.product_kind='sealed' and (p_requested_quantity<l.minimum_purchase_quantity or p_requested_quantity>l.quantity_available))
     or (l.product_kind<>'sealed' and p_requested_quantity<>1) then
    raise exception 'Gewünschte Menge ist nicht verfügbar';
  end if;
  if p_amount::text in ('NaN','Infinity','-Infinity') or coalesce(round(p_amount,2),0)<=0 then raise exception 'Ungültige Angebotssumme'; end if;

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
CREATE OR REPLACE FUNCTION public.create_sealed_market_listing_draft_v3(p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; p public.profiles; t jsonb; v_last int:=0;
begin
  if p_asking_price::text in ('NaN','Infinity','-Infinity') or p_shipping_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültiger Preis'; end if;
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_tcg not in ('pokemon','one_piece','other') or p_sealed_category not in ('booster','display','promo_pack','etb_collection','deck','tin','box','case','other') or p_sealed_condition not in ('factory_sealed','sealed_minor_wear','sealed_damage','opened_case_sealed_units') then raise exception 'Ungültige Produktdaten'; end if;
  if nullif(trim(coalesce(p_product_name,'')),'') is null then raise exception 'Produktname fehlt'; end if;
  if p_listing_type not in ('sale','trade','sale_or_trade') or p_pricing_mode not in ('fixed','negotiable') or (p_listing_type in ('sale','sale_or_trade') and coalesce(p_asking_price,0)<=0) then raise exception 'Ungültige Preis- oder Angebotsdaten'; end if;
  if p_listing_type='trade' then p_pricing_mode:='negotiable'; end if;
  if coalesce(p_stock_quantity,0) not between 1 and 1000 or coalesce(p_minimum_purchase_quantity,0) not between 1 and p_stock_quantity then raise exception 'Ungültige Menge'; end if;
  if jsonb_typeof(coalesce(p_quantity_pricing,'[]'))<>'array' or jsonb_array_length(coalesce(p_quantity_pricing,'[]'))>5 then raise exception 'Ungültige Mengenpreise'; end if;
  for t in select value from jsonb_array_elements(coalesce(p_quantity_pricing,'[]')) loop
    if coalesce((t->>'min_quantity')::int,0)<=p_minimum_purchase_quantity or (t->>'min_quantity')::int>p_stock_quantity or coalesce((t->>'unit_price')::numeric,0)<=0 or (t->>'unit_price')::numeric>=p_asking_price or (t->>'min_quantity')::int<=v_last then raise exception 'Ungültige Mengenpreisstaffel'; end if;
    v_last:=(t->>'min_quantity')::int;
  end loop;
  select * into p from public.profiles where id=auth.uid();
  insert into public.market_listings(
    seller_id,collection_item_id,listing_type,pricing_mode,status,asking_price,tcg,card_name,set_name,language,condition,
    seller_note,seller_display_name,seller_founder_number,product_kind,sealed_category,sealed_condition,bundle_quantity,
    stock_quantity,quantity_available,minimum_purchase_quantity,quantity_pricing,package_contents,units_per_container,
    weight_grams,length_mm,width_mm,height_mm,shipping_method,shipping_cost,shipping_note
  ) values(
    auth.uid(),null,p_listing_type,p_pricing_mode,'draft',p_asking_price,p_tcg,left(trim(p_product_name),180),
    nullif(left(trim(coalesce(p_set_code,'')),120),''),nullif(left(trim(coalesce(p_language,'')),40),''),'sealed',
    nullif(left(trim(coalesce(p_seller_note,'')),800),''),coalesce(p.display_name,p.username,'DUELVANTA Member'),p.founder_number,
    'sealed',p_sealed_category,p_sealed_condition,p_stock_quantity,p_stock_quantity,p_stock_quantity,p_minimum_purchase_quantity,
    coalesce(p_quantity_pricing,'[]'),nullif(left(trim(coalesce(p_package_contents,'')),240),''),p_units_per_container,
    p_weight_grams,p_length_mm,p_width_mm,p_height_mm,p_shipping_method,coalesce(p_shipping_cost,0),
    nullif(left(trim(coalesce(p_shipping_note,'')),240),'')
  ) returning id into v_id;
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.edit_my_market_listing_v3(p_listing_id uuid, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text DEFAULT NULL::text)
 RETURNS market_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.market_listings;
begin
  if p_asking_price::text in ('NaN','Infinity','-Infinity') or p_shipping_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültiger Preis'; end if;
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_listing_type not in ('sale','trade','sale_or_trade') then raise exception 'Ungültige Angebotsart'; end if;
  if p_pricing_mode not in ('fixed','negotiable') then raise exception 'Ungültige Preisart'; end if;
  if p_listing_type in ('sale','sale_or_trade') and (p_asking_price is null or p_asking_price<=0) then raise exception 'Verkaufsangebote benötigen einen positiven Preis'; end if;
  if p_shipping_method not in ('standard_letter','tracked_letter','parcel','pickup','custom') then raise exception 'Ungültige Versandart'; end if;
  if p_shipping_cost is null or p_shipping_cost<0 or p_shipping_cost>500 then raise exception 'Ungültige Versandkosten'; end if;
  if p_shipping_method='pickup' and p_shipping_cost<>0 then raise exception 'Abholung muss 0 € Versandkosten haben'; end if;
  if p_shipping_method='custom' and nullif(trim(coalesce(p_shipping_note,'')),'') is null then raise exception 'Bitte Versandhinweis für individuelle Versandart angeben'; end if;
  if p_listing_type='trade' then p_pricing_mode:='negotiable'; end if;

  update public.market_listings set
    listing_type=p_listing_type,pricing_mode=p_pricing_mode,asking_price=p_asking_price,
    seller_note=nullif(trim(p_seller_note),''),shipping_method=p_shipping_method,
    shipping_cost=round(p_shipping_cost,2),shipping_note=nullif(left(trim(coalesce(p_shipping_note,'')),240),''),updated_at=now()
  where id=p_listing_id and seller_id=auth.uid() and product_kind in ('single','graded') and status in ('active','paused')
  returning * into v_row;
  if v_row.id is null then raise exception 'Anzeige nicht gefunden oder nicht bearbeitbar'; end if;
  if p_pricing_mode='fixed' then
    update public.market_offers set status='declined',responded_at=now(),updated_at=now()
    where listing_id=p_listing_id and status='pending';
  end if;
  return v_row;
end $function$
;
CREATE OR REPLACE FUNCTION public.edit_my_sealed_market_listing_v3(p_listing_id uuid, p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)
 RETURNS market_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.market_listings; v_sold int; v_images int; t jsonb; v_last int:=0;
begin
  if p_asking_price::text in ('NaN','Infinity','-Infinity') or p_shipping_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültiger Preis'; end if;
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_row from public.market_listings where id=p_listing_id and seller_id=auth.uid() and product_kind='sealed' and status in ('active','paused') for update;
  if v_row.id is null then raise exception 'Angebot nicht gefunden oder nicht bearbeitbar'; end if;
  v_sold:=v_row.stock_quantity-v_row.quantity_available;
  if p_stock_quantity<v_sold or p_stock_quantity not between 1 and 1000 or p_minimum_purchase_quantity not between 1 and p_stock_quantity then raise exception 'Ungültige Menge'; end if;
  if p_tcg not in ('pokemon','one_piece','other') or p_sealed_category not in ('booster','display','promo_pack','etb_collection','deck','tin','box','case','other') or p_sealed_condition not in ('factory_sealed','sealed_minor_wear','sealed_damage','opened_case_sealed_units') then raise exception 'Ungültige Produktdaten'; end if;
  if nullif(trim(coalesce(p_product_name,'')),'') is null or p_listing_type not in ('sale','trade','sale_or_trade') or p_pricing_mode not in ('fixed','negotiable') or (p_listing_type in ('sale','sale_or_trade') and coalesce(p_asking_price,0)<=0) then raise exception 'Ungültige Angebotsdaten'; end if;
  if p_listing_type='trade' then p_pricing_mode:='negotiable'; end if;
  select count(*) into v_images from public.market_listing_images where listing_id=p_listing_id;
  if v_images < (case when p_sealed_category='case' then 3 else 1 end) then raise exception 'Für diese Produktart fehlen echte Produktfotos'; end if;
  for t in select value from jsonb_array_elements(coalesce(p_quantity_pricing,'[]')) loop
    if coalesce((t->>'min_quantity')::int,0)<=p_minimum_purchase_quantity or (t->>'min_quantity')::int>p_stock_quantity or coalesce((t->>'unit_price')::numeric,0)<=0 or (t->>'unit_price')::numeric>=p_asking_price or (t->>'min_quantity')::int<=v_last then raise exception 'Ungültige Mengenpreisstaffel'; end if;
    v_last:=(t->>'min_quantity')::int;
  end loop;
  update public.market_listings set
    tcg=p_tcg,card_name=left(trim(p_product_name),180),set_name=nullif(left(trim(coalesce(p_set_code,'')),120),''),
    language=nullif(left(trim(coalesce(p_language,'')),40),''),sealed_category=p_sealed_category,sealed_condition=p_sealed_condition,
    bundle_quantity=p_stock_quantity,stock_quantity=p_stock_quantity,quantity_available=p_stock_quantity-v_sold,
    minimum_purchase_quantity=p_minimum_purchase_quantity,quantity_pricing=coalesce(p_quantity_pricing,'[]'),
    package_contents=nullif(left(trim(coalesce(p_package_contents,'')),240),''),units_per_container=p_units_per_container,
    weight_grams=p_weight_grams,length_mm=p_length_mm,width_mm=p_width_mm,height_mm=p_height_mm,
    listing_type=p_listing_type,pricing_mode=p_pricing_mode,asking_price=p_asking_price,
    seller_note=nullif(left(trim(coalesce(p_seller_note,'')),800),''),shipping_method=p_shipping_method,
    shipping_cost=coalesce(p_shipping_cost,0),shipping_note=nullif(left(trim(coalesce(p_shipping_note,'')),240),''),updated_at=now()
  where id=p_listing_id returning * into v_row;
  if p_pricing_mode='fixed' then
    update public.market_offers set status='declined',responded_at=now(),updated_at=now()
    where listing_id=p_listing_id and status='pending';
  end if;
  return v_row;
end $function$
;
