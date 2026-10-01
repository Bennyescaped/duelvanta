-- DUELVANTA B07 / L07-01: negotiated-price 2-hour reservation and buyer checkout.
-- REVIEW/STAGING MIGRATION ONLY. Apply after checkout hardening + checkout compliance.
-- Seller acceptance is NOT contract formation and creates no deal/order/payment.

alter table public.market_offers add column if not exists reserved_quantity integer;
alter table public.market_offers add column if not exists reservation_expires_at timestamptz;
create index if not exists market_offers_active_reservation_idx
  on public.market_offers(listing_id,reservation_expires_at)
  where status='accepted' and reservation_expires_at is not null;

create or replace function public.expire_market_offer_reservations_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer_id uuid;
  v_listing_id uuid;
  v_offer public.market_offers%rowtype;
  v_listing public.market_listings%rowtype;
  v_count integer := 0;
  v_restore integer;
begin
  for v_offer_id in
    select o.id from public.market_offers o
    where o.status='accepted'
      and o.reservation_expires_at is not null
      and o.reservation_expires_at<=now()
      and not exists(select 1 from public.market_deals d where d.offer_id=o.id)
    order by o.reservation_expires_at,o.id
  loop
    select o.listing_id into v_listing_id from public.market_offers o where o.id=v_offer_id;
    if v_listing_id is null then continue; end if;
    -- Keep lock order identical to checkout/respond: listing first, offer second.
    select * into v_listing from public.market_listings where id=v_listing_id for update;
    select * into v_offer from public.market_offers where id=v_offer_id for update;
    if not found or v_offer.status<>'accepted' or v_offer.reservation_expires_at is null
       or v_offer.reservation_expires_at>now()
       or exists(select 1 from public.market_deals d where d.offer_id=v_offer.id) then
      continue;
    end if;

    update public.market_offers
    set status='expired',reserved_quantity=0,reservation_expires_at=null,updated_at=now()
    where id=v_offer.id;

    if v_listing.id is not null then
      v_restore:=greatest(coalesce(v_offer.reserved_quantity,v_offer.requested_quantity,1),1);
      update public.market_listings
      set quantity_available=least(stock_quantity,quantity_available+v_restore),
          status=case when status='reserved' then 'active' else status end,
          accepted_offer_id=case when accepted_offer_id=v_offer.id then null else accepted_offer_id end,
          deal_price=case when deal_buyer_id=v_offer.buyer_id then null else deal_price end,
          deal_buyer_id=case when deal_buyer_id=v_offer.buyer_id then null else deal_buyer_id end,
          updated_at=now()
      where id=v_offer.listing_id;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;
revoke all on function public.expire_market_offer_reservations_v1() from public, anon;
grant execute on function public.expire_market_offer_reservations_v1() to authenticated;

create or replace function dv_market_private.guard_listing_during_offer_reservation_b07()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
begin
  if exists(
    select 1 from public.market_offers o
    where o.listing_id=old.id and o.status='accepted'
      and o.reservation_expires_at>now()
      and not exists(select 1 from public.market_deals d where d.offer_id=o.id)
  ) and (
    new.asking_price is distinct from old.asking_price
    or new.pricing_mode is distinct from old.pricing_mode
    or new.listing_type is distinct from old.listing_type
    or new.shipping_method is distinct from old.shipping_method
    or new.shipping_cost is distinct from old.shipping_cost
    or new.shipping_note is distinct from old.shipping_note
    or new.seller_note is distinct from old.seller_note
    or new.status not in ('active','reserved')
  ) then
    raise exception 'listing_locked_by_offer_reservation';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.guard_listing_during_offer_reservation_b07() from public, anon, authenticated;
drop trigger if exists b07_guard_listing_offer_reservation on public.market_listings;
create trigger b07_guard_listing_offer_reservation
before update on public.market_listings
for each row execute function dv_market_private.guard_listing_during_offer_reservation_b07();

create or replace function dv_market_private.guard_reserved_offer_deal_insert_b07()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_offer_id uuid;
  v_authorized text := current_setting('dv_market.offer_checkout_authorized',true);
begin
  select o.id into v_offer_id
  from public.market_offers o
  where o.listing_id=new.listing_id
    and o.buyer_id=new.buyer_id
    and o.seller_id=new.seller_id
    and o.status='accepted'
    and o.reservation_expires_at>now()
    and not exists(select 1 from public.market_deals d where d.offer_id=o.id)
  order by o.responded_at desc nulls last,o.id
  limit 1;
  if v_offer_id is not null and coalesce(v_authorized,'')<>v_offer_id::text then
    raise exception 'offer_reservation_requires_buyer_checkout';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.guard_reserved_offer_deal_insert_b07() from public, anon, authenticated;
drop trigger if exists b07_guard_reserved_offer_deal_insert on public.market_deals;
create trigger b07_guard_reserved_offer_deal_insert
before insert on public.market_deals
for each row execute function dv_market_private.guard_reserved_offer_deal_insert_b07();

create or replace function public.respond_to_market_offer(p_offer_id uuid,p_action text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  o public.market_offers;
  l public.market_listings;
  v_qty integer;
  v_left integer;
begin
  if auth.uid() is null or p_action not in ('accepted','declined') then raise exception 'Nicht erlaubt'; end if;
  perform public.expire_market_offer_reservations_v1();

  select * into o from public.market_offers where id=p_offer_id;
  if o.id is null or o.seller_id<>auth.uid() then raise exception 'Angebot nicht verfügbar'; end if;
  select * into l from public.market_listings where id=o.listing_id for update;
  select * into o from public.market_offers where id=p_offer_id for update;
  if o.status=p_action then return; end if;
  if o.id is null or o.seller_id<>auth.uid() or o.status<>'pending' then raise exception 'Angebot ist nicht verfügbar'; end if;

  if p_action='declined' then
    update public.market_offers set status='declined',responded_at=now(),updated_at=now() where id=o.id;
    return;
  end if;

  if exists(
    select 1 from public.market_offers x
    where x.listing_id=o.listing_id and x.id<>o.id and x.status='accepted'
      and x.reservation_expires_at>now()
      and not exists(select 1 from public.market_deals d where d.offer_id=x.id)
  ) then raise exception 'listing_already_has_offer_reservation'; end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
  if l.pricing_mode='fixed' then raise exception 'Dieses Listing wird inzwischen zum Festpreis angeboten'; end if;
  if l.status<>'active' or l.seller_id<>auth.uid() then raise exception 'Listing ist nicht aktiv'; end if;

  v_qty:=case when l.product_kind='sealed' then coalesce(o.requested_quantity,1) else 1 end;
  if v_qty<1 or v_qty>l.quantity_available then raise exception 'Menge nicht mehr verfügbar'; end if;
  v_left:=l.quantity_available-v_qty;

  update public.market_offers
  set status='accepted',responded_at=now(),reserved_quantity=v_qty,
      reservation_expires_at=now()+interval '2 hours',updated_at=now()
  where id=o.id;
  update public.market_offers
  set status='declined',responded_at=now(),updated_at=now()
  where listing_id=o.listing_id and id<>o.id and status='pending' and requested_quantity>v_left;

  update public.market_listings
  set quantity_available=v_left,
      status=case when v_left=0 then 'reserved' else 'active' end,
      accepted_offer_id=o.id,
      deal_price=o.amount,deal_buyer_id=o.buyer_id,updated_at=now()
  where id=l.id;
  -- Deliberately no market_deals insert here. Contract formation happens only in buyer checkout.
end
$$;
revoke all on function public.respond_to_market_offer(uuid,text) from public, anon;
grant execute on function public.respond_to_market_offer(uuid,text) to authenticated;

create or replace function public.get_my_market_offers_v2()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  perform public.expire_market_offer_reservations_v1();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'listing_id',o.listing_id,'seller_id',o.seller_id,'buyer_id',o.buyer_id,
    'status',o.status,'amount',o.amount,'message',o.message,'requested_quantity',o.requested_quantity,
    'reserved_quantity',o.reserved_quantity,'reservation_expires_at',o.reservation_expires_at,
    'unit_price_snapshot',o.unit_price_snapshot,'listed_unit_price_snapshot',o.listed_unit_price_snapshot,
    'listed_total_snapshot',o.listed_total_snapshot,'created_at',o.created_at,
    'listing_snapshot',coalesce(o.listing_snapshot,jsonb_build_object(
      'card_name',l.card_name,'product_kind',l.product_kind,'sealed_category',l.sealed_category,
      'language',l.language,'set_name',l.set_name,'base_unit_price',l.asking_price,
      'shipping_method',l.shipping_method,'shipping_cost',l.shipping_cost)),
    'historical_price',o.listed_total_snapshot is not null,
    'order_id',d.order_id,'order_number',ord.order_number,
    'other_name',case when auth.uid()=o.seller_id then coalesce(pb.display_name,pb.username) else coalesce(ps.display_name,ps.username) end,
    'other_username',case when auth.uid()=o.seller_id then pb.username else ps.username end
  ) order by o.created_at desc),'[]'::jsonb) into v_result
  from public.market_offers o
  join public.market_listings l on l.id=o.listing_id
  left join public.market_deals d on d.offer_id=o.id
  left join public.market_orders ord on ord.id=d.order_id
  left join public.profiles pb on pb.id=o.buyer_id
  left join public.profiles ps on ps.id=o.seller_id
  where auth.uid() in (o.seller_id,o.buyer_id)
    and o.offer_type='price' and l.listing_type<>'trade';
  return v_result;
end
$$;
revoke all on function public.get_my_market_offers_v2() from public, anon;
grant execute on function public.get_my_market_offers_v2() to authenticated;

create or replace function public.review_market_offer_checkout_v1(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, dv_market_private, extensions
as $$
declare
  v_uid uuid:=auth.uid();
  o public.market_offers;
  l public.market_listings;
  v_seller jsonb;
  v_product jsonb;
  v_qty integer;
  v_goods numeric;
  v_unit numeric;
  v_shipping numeric;
  v_review jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into o from public.market_offers where id=p_offer_id;
  if not found or o.buyer_id<>v_uid then raise exception 'offer_checkout_not_available'; end if;
  if o.status<>'accepted' or o.reservation_expires_at is null or o.reservation_expires_at<=now() then
    raise exception 'offer_reservation_expired';
  end if;
  if exists(select 1 from public.market_deals d where d.offer_id=o.id) then raise exception 'offer_already_checked_out'; end if;
  select * into l from public.market_listings where id=o.listing_id;
  if not found or l.seller_id<>o.seller_id or l.status not in ('active','reserved') then raise exception 'listing_not_available'; end if;

  v_qty:=greatest(coalesce(o.reserved_quantity,o.requested_quantity,1),1);
  v_goods:=round(o.amount,2);
  if v_goods<=0 or v_goods::text in ('NaN','Infinity','-Infinity') then raise exception 'checkout_price_invalid'; end if;
  v_unit:=round(v_goods/v_qty,2);
  if l.shipping_cost is null or l.shipping_cost<0 or l.shipping_cost>500 or l.shipping_method is null then
    raise exception 'checkout_shipping_incomplete';
  end if;
  v_shipping:=round(l.shipping_cost,2);
  v_seller:=dv_market_private.market_checkout_seller_party(l.seller_id);
  v_product:=dv_market_private.market_checkout_product_snapshot(l);

  v_review:=jsonb_build_object(
    'snapshot_version','checkout-contract-v1','offer_id',o.id,'listing_id',l.id,
    'reservation_expires_at',o.reservation_expires_at,'seller_id',l.seller_id,
    'seller_type',v_seller->>'seller_type',
    'contract_classification',case when v_seller->>'seller_type'='trader' then 'b2c' else 'c2c' end,
    'seller_party',v_seller,
    'platform_operator',jsonb_build_object(
      'role','Marketplace-Vermittler','name','Benjamin Fritz – DUELVANTA',
      'street_line1','Landhausstraße 12','postal_code','75399','city','Unterreichenbach',
      'country_code','DE','email','info@duelvanta.de'),
    'product',v_product,'quantity',v_qty,'unit_price',v_unit,'goods_total',v_goods,
    'shipping_method',l.shipping_method,'shipping_cost',v_shipping,
    'total_price',round(v_goods+v_shipping,2),'currency','EUR','payment_provider','manual_beta',
    'payment_notice','Keine integrierte Onlinezahlung. Die Bestellung begründet dennoch eine Zahlungspflicht gegenüber dem Verkäufer.'
  );
  return v_review || jsonb_build_object(
    'checkout_hash',encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex')
  );
end
$$;
revoke all on function public.review_market_offer_checkout_v1(uuid) from public, anon;
grant execute on function public.review_market_offer_checkout_v1(uuid) to authenticated;

create or replace function public.checkout_accepted_market_offer_v1(
  p_offer_id uuid,p_request_id uuid,p_checkout_hash text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  o public.market_offers;
  l public.market_listings;
  d public.market_deals;
  v_review jsonb;
  v_snapshot dv_market_private.market_contract_snapshots%rowtype;
  v_qty integer;
  v_deal_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'checkout_request_invalid'; end if;
  perform public.expire_market_offer_reservations_v1();
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_id::text,44));

  select * into d from public.market_deals where buyer_id=auth.uid() and checkout_request_id=p_request_id;
  if found then
    if d.offer_id<>p_offer_id then raise exception 'checkout_request_reused'; end if;
    select * into v_snapshot from dv_market_private.market_contract_snapshots where deal_id=d.id;
    if not found then raise exception 'checkout_snapshot_missing'; end if;
    return jsonb_build_object('deal_id',d.id,'order_id',d.order_id,'quantity',d.item_quantity,
      'item_total',d.amount,'contract_snapshot_id',v_snapshot.id,
      'contract_classification',v_snapshot.contract_classification,
      'confirmation_sha256',encode(v_snapshot.content_sha256,'hex'),'replayed',true);
  end if;

  select o0.* into o from public.market_offers o0 where o0.id=p_offer_id;
  if not found then raise exception 'offer_checkout_not_available'; end if;
  select * into l from public.market_listings where id=o.listing_id for update;
  select * into o from public.market_offers where id=p_offer_id for update;
  if o.buyer_id<>auth.uid() or o.status<>'accepted' or o.reservation_expires_at is null or o.reservation_expires_at<=now() then
    raise exception 'offer_reservation_expired';
  end if;
  if exists(select 1 from public.market_deals x where x.offer_id=o.id) then raise exception 'offer_already_checked_out'; end if;

  v_review:=public.review_market_offer_checkout_v1(o.id);
  if nullif(lower(trim(coalesce(p_checkout_hash,''))),'') is null
     or lower(p_checkout_hash)<>(v_review->>'checkout_hash') then raise exception 'checkout_review_changed'; end if;
  v_qty:=greatest(coalesce(o.reserved_quantity,o.requested_quantity,1),1);

  perform set_config('dv_market.offer_checkout_authorized',o.id::text,true);
  insert into public.market_deals(
    listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,
    shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,
    package_contents,weight_grams,length_mm,width_mm,height_mm,checkout_request_id
  ) values(
    l.id,o.id,o.seller_id,o.buyer_id,round(o.amount,2),'EUR','accepted',now(),
    l.shipping_method,l.shipping_cost,l.shipping_note,l.product_kind,l.sealed_category,v_qty,
    l.package_contents,case when l.weight_grams is null then null else l.weight_grams*v_qty end,
    l.length_mm,l.width_mm,l.height_mm,p_request_id
  ) returning id into v_deal_id;

  update public.market_offers
  set reserved_quantity=0,reservation_expires_at=null,updated_at=now()
  where id=o.id;

  select * into d from public.market_deals md where md.id=v_deal_id;
  select * into v_snapshot from dv_market_private.market_contract_snapshots where deal_id=v_deal_id;
  if not found then raise exception 'checkout_snapshot_missing'; end if;
  return jsonb_build_object('deal_id',d.id,'order_id',d.order_id,'quantity',d.item_quantity,
    'item_total',d.amount,'contract_snapshot_id',v_snapshot.id,
    'contract_classification',v_snapshot.contract_classification,
    'confirmation_sha256',encode(v_snapshot.content_sha256,'hex'),'replayed',false);
end
$$;
revoke all on function public.checkout_accepted_market_offer_v1(uuid,uuid,text) from public, anon;
grant execute on function public.checkout_accepted_market_offer_v1(uuid,uuid,text) to authenticated;

notify pgrst, 'reload schema';
