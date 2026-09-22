
-- DUELVANTA Legal contract model V1
-- Aligns marketplace contract formation with the individual attorney answers received 2026-09-21.
-- No Production/Stripe activation is performed by this migration.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

-- Release 1 reuses the existing private-buyer declaration; no second buyer profile.
-- This draft remains unapplied. No legal schema readiness marker is emitted.
-- Existing eligibility RPCs and confirmations are not replaced or auto-confirmed.
create or replace function dv_market_private.require_market_buyer_type(p_buyer_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
begin
  perform dv_market_private.require_trade_eligibility(p_buyer_id,true);
  -- Check the actual buyer also when called by a seller or the payment service.
  if not exists (
    select 1 from public.profiles p
    where p.id=p_buyer_id
      and coalesce(p.account_status,'active') in ('active','beta')
      and not coalesce(p.safety_restricted,false)
      and p.account_closure_requested_at is null
      and p.data_processing_restricted_at is null
  ) then raise exception 'trade_account_restricted'; end if;
  return 'consumer';
end
$$;
revoke all on function dv_market_private.require_market_buyer_type(uuid) from public,anon,authenticated;

create or replace function dv_market_private.market_contract_classification(p_seller_type text,p_buyer_type text)
returns text
language sql
immutable
set search_path=''
as $$
  select case
    when p_seller_type='trader' and p_buyer_type='consumer' then 'b2c'
    when p_seller_type='private' and p_buyer_type='consumer' then 'c2c'
    else null
  end
$$;
revoke all on function dv_market_private.market_contract_classification(text,text) from public,anon,authenticated;

-- New offer snapshots record the existing private-buyer scope; legacy NULLs are not backfilled.
alter table public.market_offers add column if not exists buyer_type_snapshot text;
alter table public.market_offers add column if not exists checkout_request_id uuid;
alter table public.market_offers add column if not exists checkout_hash_snapshot text;
alter table public.market_offers add column if not exists payment_attempt_id uuid;
alter table public.market_offers add column if not exists payment_requested_at timestamptz;
alter table public.market_offers add column if not exists stripe_checkout_session_id text;
alter table public.market_offers add column if not exists stripe_account_id_snapshot text;
alter table public.market_offers add column if not exists payment_live_mode_snapshot boolean;
alter table public.market_offers add column if not exists amount_due_cents_snapshot integer;
alter table public.market_offers add column if not exists platform_fee_cents_snapshot integer;
alter table public.market_offers add column if not exists contract_review_snapshot jsonb;
alter table public.market_offers add column if not exists offer_review_hash text;

alter table public.market_offers drop constraint if exists market_offers_buyer_type_snapshot_check;
alter table public.market_offers add constraint market_offers_buyer_type_snapshot_check
  check (buyer_type_snapshot is null or buyer_type_snapshot = 'consumer');
alter table public.market_offers drop constraint if exists market_offers_offer_type_check;
alter table public.market_offers add constraint market_offers_offer_type_check
  check (offer_type in ('price','fixed_price'));
create unique index if not exists market_fixed_offer_request_key_idx
  on public.market_offers(buyer_id,checkout_request_id)
  where offer_type='fixed_price' and checkout_request_id is not null;
create unique index if not exists market_fixed_offer_attempt_idx
  on public.market_offers(payment_attempt_id)
  where offer_type='fixed_price' and payment_attempt_id is not null;
create unique index if not exists market_fixed_offer_session_idx
  on public.market_offers(stripe_checkout_session_id)
  where offer_type='fixed_price' and stripe_checkout_session_id is not null;

-- Preserve existing contract evidence; new snapshots support only the existing C2C/B2C scope.
alter table dv_market_private.market_contract_snapshots add column if not exists buyer_type text;
alter table dv_market_private.market_contract_snapshots add column if not exists withdrawal_eligible boolean not null default false;
alter table dv_market_private.market_contract_snapshots drop constraint if exists market_contract_snapshots_buyer_type_check;
alter table dv_market_private.market_contract_snapshots add constraint market_contract_snapshots_buyer_type_check
  check (buyer_type is null or buyer_type = 'consumer');
alter table dv_market_private.market_contract_snapshots drop constraint if exists market_contract_snapshots_contract_classification_check;
alter table dv_market_private.market_contract_snapshots add constraint market_contract_snapshots_contract_classification_check
  check (contract_classification in ('c2c','b2c'));
alter table dv_market_private.market_contract_snapshots drop constraint if exists market_contract_snapshots_payment_provider_check;
alter table dv_market_private.market_contract_snapshots add constraint market_contract_snapshots_payment_provider_check
  check (payment_provider in ('manual_beta','stripe_connect'));

-- Sale-only guard accepts monetary fixed-price buyer offers as well as negotiated price offers.
create or replace function dv_market_private.enforce_sale_only_offer()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.offer_type not in ('price','fixed_price') or exists(
    select 1 from public.market_listings where id=new.listing_id and listing_type='trade'
  ) then
    if tg_op='UPDATE' and new.status in ('withdrawn','declined','expired','cancelled') then return new;end if;
    raise exception 'market_swaps_retired' using errcode='23514';
  end if;
  return new;
end
$$;

create or replace function dv_market_private.enforce_sale_only_deal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(select 1 from public.market_listings where id=new.listing_id and listing_type='trade')
    or exists(select 1 from public.market_offers where id=new.offer_id and offer_type not in ('price','fixed_price')) then
    raise exception 'market_swaps_retired' using errcode='23514';
  end if;
  return new;
end
$$;

-- Fixed-price offers are internal buyer offers and must not create seller action notifications.
create or replace function public.emit_market_offer_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_title text;v_qty integer;
begin
  if new.offer_type is distinct from 'price' then return new; end if;
  select card_name into v_title from public.market_listings where id=new.listing_id;
  v_title:=coalesce(v_title,new.listing_snapshot->>'card_name','DUELVANTA Produkt');
  v_qty:=greatest(coalesce(new.requested_quantity,1),1);
  if tg_op='INSERT' and new.status='pending' then
    insert into public.market_notifications(recipient_id,kind,title,body,offer_id,listing_id,dedupe_key)
    values(new.seller_id,'offer_received','NEUES ANGEBOT',
      v_qty::text||' × '||v_title||' · '||round(new.amount,2)::text||' €',
      new.id,new.listing_id,'offer_received:'||new.id::text)
    on conflict(dedupe_key) do nothing;
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='accepted' then
    insert into public.market_notifications(recipient_id,kind,title,body,offer_id,listing_id,dedupe_key)
    values(new.buyer_id,'offer_accepted','ANGEBOT ANGENOMMEN',
      v_qty::text||' × '||v_title||' · '||round(new.amount,2)::text||' €',
      new.id,new.listing_id,'offer_accepted:'||new.id::text)
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
end
$$;

-- Review: buyer click is the offer. Fixed-price contract follows only after Stripe payment request creation.
create or replace function public.review_market_checkout(p_listing_id uuid,p_quantity integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare
  v_uid uuid:=auth.uid();v_listing public.market_listings%rowtype;v_seller jsonb;v_product jsonb;
  v_buyer_type text;v_class text;v_unit numeric;v_goods numeric;v_shipping numeric;v_review jsonb;v_tier jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_buyer_type:=dv_market_private.require_market_buyer_type(v_uid);
  if p_quantity is null or p_quantity not between 1 and 1000 then raise exception 'checkout_quantity_invalid'; end if;
  select * into v_listing from public.market_listings where id=p_listing_id;
  if not found or v_listing.status<>'active' then raise exception 'listing_not_available'; end if;
  if v_listing.seller_id=v_uid then raise exception 'own_listing_checkout_forbidden'; end if;
  if v_listing.listing_type not in ('sale','sale_or_trade') or v_listing.pricing_mode<>'fixed' then raise exception 'fixed_price_checkout_required'; end if;
  if v_listing.active_until is not null and v_listing.active_until<=now() then raise exception 'listing_expired'; end if;
  if (v_listing.product_kind='sealed' and (p_quantity<v_listing.minimum_purchase_quantity or p_quantity>v_listing.quantity_available))
     or (v_listing.product_kind<>'sealed' and (p_quantity<>1 or v_listing.quantity_available<1)) then raise exception 'checkout_quantity_unavailable'; end if;
  if v_listing.asking_price is null or v_listing.asking_price<=0
     or v_listing.asking_price::text in ('NaN','Infinity','-Infinity') then raise exception 'checkout_price_invalid'; end if;
  if v_listing.shipping_cost is null or v_listing.shipping_cost<0 or v_listing.shipping_cost>500 or v_listing.shipping_method is null then
    raise exception 'checkout_shipping_incomplete';
  end if;
  v_unit:=v_listing.asking_price;
  if v_listing.product_kind='sealed' then
    for v_tier in select value from jsonb_array_elements(coalesce(v_listing.quantity_pricing,'[]'::jsonb))
      order by (value->>'min_quantity')::integer
    loop
      if p_quantity >= (v_tier->>'min_quantity')::integer then v_unit:=(v_tier->>'unit_price')::numeric; end if;
    end loop;
  end if;
  if v_unit is null or v_unit<=0 or v_unit::text in ('NaN','Infinity','-Infinity') then raise exception 'checkout_price_invalid'; end if;
  v_unit:=round(v_unit,2);v_goods:=round(v_unit*p_quantity,2);v_shipping:=round(v_listing.shipping_cost,2);
  v_seller:=dv_market_private.market_checkout_seller_party(v_listing.seller_id);
  v_product:=dv_market_private.market_checkout_product_snapshot(v_listing);
  v_class:=dv_market_private.market_contract_classification(v_seller->>'seller_type',v_buyer_type);
  if v_class is null then raise exception 'contract_classification_invalid'; end if;
  v_review:=jsonb_build_object(
    'snapshot_version','checkout-contract-v2','listing_id',v_listing.id,'listing_updated_at',v_listing.updated_at,
    'seller_id',v_listing.seller_id,'seller_type',v_seller->>'seller_type','buyer_type',v_buyer_type,
    'contract_classification',v_class,'seller_party',v_seller,
    'platform_operator',jsonb_build_object(
      'role','Marketplace-Vermittler','name','Benjamin Fritz – DUELVANTA',
      'street_line1','Landhausstraße 12','postal_code','75399','city','Unterreichenbach',
      'country_code','DE','email','info@duelvanta.de'),
    'product',v_product,'quantity',p_quantity,'unit_price',v_unit,'goods_total',v_goods,
    'shipping_method',v_listing.shipping_method,'shipping_cost',v_shipping,'shipping_note',v_listing.shipping_note,
    'fulfillment_snapshot',jsonb_strip_nulls(jsonb_build_object(
      'product_kind',v_listing.product_kind,'sealed_category',v_listing.sealed_category,'package_contents',v_listing.package_contents,
      'weight_grams',v_listing.weight_grams,'length_mm',v_listing.length_mm,'width_mm',v_listing.width_mm,'height_mm',v_listing.height_mm)),
    'total_price',round(v_goods+v_shipping,2),'currency','EUR','payment_provider','stripe_connect',
    'payment_notice','Dein Klick gibt ein verbindliches Kaufangebot ab. Der Vertrag entsteht erst, wenn DUELVANTA unmittelbar die Stripe-Zahlungsaufforderung für den Verkäufer erzeugt.'
  );
  return v_review||jsonb_build_object('checkout_hash',encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex'));
end
$$;

-- Retire legacy browser entrypoints that would form contracts at the obsolete buyer-checkout time.
revoke all on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.checkout_accepted_market_offer_v1(uuid,uuid,text) from public,anon,authenticated;

-- Price proposals freeze buyer status when the buyer makes the binding offer.
-- Negotiated price offer review: freezes buyer-facing contract information before binding.
create or replace function public.review_market_price_offer_v1(p_listing_id uuid,p_requested_quantity integer,p_amount numeric)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dv_market_private,extensions as $$
declare l public.market_listings;v_buyer text;v_seller jsonb;v_product jsonb;v_class text;v_list numeric;v_goods numeric;v_ship numeric;v_review jsonb;t jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 v_buyer:=dv_market_private.require_market_buyer_type(auth.uid());
 select * into l from public.market_listings where id=p_listing_id;
 if not found or l.status<>'active' or l.seller_id=auth.uid() then raise exception 'offer_not_available'; end if;
 if l.listing_type not in ('sale','sale_or_trade') or l.pricing_mode='fixed' then raise exception 'negotiated_offer_required'; end if;
 if l.active_until is not null and l.active_until<=now() then raise exception 'offer_expired'; end if;
 if p_requested_quantity is null or p_requested_quantity not between 1 and 1000 then raise exception 'offer_quantity_invalid'; end if;
 if (l.product_kind='sealed' and (p_requested_quantity<l.minimum_purchase_quantity or p_requested_quantity>l.quantity_available))
    or (l.product_kind<>'sealed' and (p_requested_quantity<>1 or l.quantity_available<1)) then raise exception 'offer_quantity_unavailable'; end if;
 if p_amount::text in ('NaN','Infinity','-Infinity') or coalesce(round(p_amount,2),0)<=0 then raise exception 'offer_amount_invalid'; end if;
 if l.shipping_cost is null or l.shipping_cost<0 or l.shipping_cost>500 or l.shipping_method is null then raise exception 'offer_shipping_incomplete'; end if;
 v_list:=l.asking_price;
 if l.product_kind='sealed' then for t in select value from jsonb_array_elements(coalesce(l.quantity_pricing,'[]'::jsonb)) order by (value->>'min_quantity')::int loop
   if p_requested_quantity >= (t->>'min_quantity')::int then v_list:=(t->>'unit_price')::numeric; end if;
 end loop; end if;
 if v_list is null or v_list<=0 then raise exception 'offer_list_price_invalid'; end if;
 v_goods:=round(p_amount,2);v_ship:=round(l.shipping_cost,2);
 v_seller:=dv_market_private.market_checkout_seller_party(l.seller_id);v_product:=dv_market_private.market_checkout_product_snapshot(l);
 v_class:=dv_market_private.market_contract_classification(v_seller->>'seller_type',v_buyer);if v_class is null then raise exception 'contract_classification_invalid'; end if;
 v_review:=jsonb_build_object(
   'snapshot_version','price-offer-contract-v1','listing_id',l.id,'listing_updated_at',l.updated_at,'seller_id',l.seller_id,
   'seller_type',v_seller->>'seller_type','buyer_type',v_buyer,'contract_classification',v_class,'seller_party',v_seller,'product',v_product,
   'quantity',p_requested_quantity,'offer_unit_price',round(v_goods/p_requested_quantity,2),'offered_goods_total',v_goods,
   'listed_unit_price',round(v_list,2),'listed_goods_total',round(v_list*p_requested_quantity,2),
   'shipping_method',l.shipping_method,'shipping_cost',v_ship,'shipping_note',l.shipping_note,'total_price',round(v_goods+v_ship,2),'currency','EUR',
   'fulfillment_snapshot',jsonb_strip_nulls(jsonb_build_object('product_kind',l.product_kind,'sealed_category',l.sealed_category,'package_contents',l.package_contents,'unit_weight_grams',l.weight_grams,'length_mm',l.length_mm,'width_mm',l.width_mm,'height_mm',l.height_mm)),
   'offer_notice','Mit dem Senden gibst du ein verbindliches Kaufangebot ab. Der Vertrag entsteht erst, wenn der Verkäufer dieses Angebot annimmt. Die Zahlung erfolgt danach über die Order.'
 );
 return v_review||jsonb_build_object('offer_review_hash',encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex'));
end
$$;
revoke all on function public.review_market_price_offer_v1(uuid,integer,numeric) from public,anon;
grant execute on function public.review_market_price_offer_v1(uuid,integer,numeric) to authenticated;

revoke all on function public.create_market_offer_v2(uuid,integer,numeric,text) from public,anon,authenticated;

create or replace function public.create_market_offer_v3(p_listing_id uuid,p_requested_quantity integer,p_amount numeric,p_message text,p_expected_updated_at timestamptz,p_offer_review_hash text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
declare l public.market_listings;v_id uuid;v_review jsonb;v_hash text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if p_expected_updated_at is null or nullif(lower(trim(coalesce(p_offer_review_hash,''))),'') is null then raise exception 'offer_review_required'; end if;
 select * into l from public.market_listings where id=p_listing_id for update;if not found then raise exception 'offer_not_available'; end if;
 v_review:=public.review_market_price_offer_v1(p_listing_id,p_requested_quantity,p_amount);v_hash:=v_review->>'offer_review_hash';
 if l.updated_at is distinct from p_expected_updated_at or (v_review->>'listing_updated_at')::timestamptz is distinct from p_expected_updated_at or lower(trim(p_offer_review_hash))<>v_hash then raise exception 'offer_review_changed'; end if;
 insert into public.market_offers(listing_id,buyer_id,seller_id,offer_type,amount,currency,message,requested_quantity,unit_price_snapshot,listed_unit_price_snapshot,listed_total_snapshot,buyer_type_snapshot,listing_snapshot,contract_review_snapshot,offer_review_hash)
 values(l.id,auth.uid(),l.seller_id,'price',(v_review->>'offered_goods_total')::numeric,'EUR',nullif(left(trim(coalesce(p_message,'')),500),''),p_requested_quantity,
   (v_review->>'offer_unit_price')::numeric,(v_review->>'listed_unit_price')::numeric,(v_review->>'listed_goods_total')::numeric,v_review->>'buyer_type',
   jsonb_build_object('card_name',v_review->'product'->>'title','product_kind',v_review->'fulfillment_snapshot'->>'product_kind','sealed_category',v_review->'fulfillment_snapshot'->>'sealed_category','language',v_review->'product'->>'language','set_name',v_review->'product'->>'set_name','base_unit_price',l.asking_price,'shipping_method',v_review->>'shipping_method','shipping_cost',(v_review->>'shipping_cost')::numeric),
   v_review-'offer_review_hash',v_hash) returning id into v_id;
 return v_id;
end
$$;
revoke all on function public.create_market_offer_v3(uuid,integer,numeric,text,timestamptz,text) from public,anon;
grant execute on function public.create_market_offer_v3(uuid,integer,numeric,text,timestamptz,text) to authenticated;

create or replace function public.get_my_market_offers_v2() returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'listing_id',o.listing_id,'seller_id',o.seller_id,'buyer_id',o.buyer_id,'status',o.status,'amount',o.amount,'message',o.message,'requested_quantity',o.requested_quantity,'unit_price_snapshot',o.unit_price_snapshot,'listed_unit_price_snapshot',o.listed_unit_price_snapshot,'listed_total_snapshot',o.listed_total_snapshot,'created_at',o.created_at,
 'listing_snapshot',coalesce(o.listing_snapshot,jsonb_build_object('card_name',l.card_name,'product_kind',l.product_kind,'sealed_category',l.sealed_category,'language',l.language,'set_name',l.set_name,'base_unit_price',l.asking_price,'shipping_method',l.shipping_method,'shipping_cost',l.shipping_cost)),
 'contract_review_snapshot',o.contract_review_snapshot,'offer_review_hash',o.offer_review_hash,'historical_price',o.listed_total_snapshot is not null,'order_id',d.order_id,'order_number',ord.order_number,
 'other_name',case when auth.uid()=o.seller_id then coalesce(pb.display_name,pb.username) else coalesce(ps.display_name,ps.username) end,'other_username',case when auth.uid()=o.seller_id then pb.username else ps.username end) order by o.created_at desc),'[]'::jsonb)
from public.market_offers o join public.market_listings l on l.id=o.listing_id left join public.market_deals d on d.offer_id=o.id left join public.market_orders ord on ord.id=d.order_id
left join public.profiles pb on pb.id=o.buyer_id left join public.profiles ps on ps.id=o.seller_id
where auth.uid() in (o.seller_id,o.buyer_id) and o.offer_type='price' and l.listing_type<>'trade';
$$;
revoke all on function public.get_my_market_offers_v2() from public,anon;
grant execute on function public.get_my_market_offers_v2() to authenticated;

-- Negotiated price: seller acceptance is the single contract-forming event using the buyer's frozen review.
create or replace function public.respond_to_market_offer(p_offer_id uuid,p_action text)
returns void language plpgsql security definer set search_path=pg_catalog,public,dv_market_private,extensions as $$
declare o public.market_offers;l public.market_listings;v_qty integer;v_left integer;v_deal_id uuid;v_review jsonb;v_f jsonb;v_at timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or p_action not in ('accepted','declined') then raise exception 'Nicht erlaubt'; end if;
 perform public.expire_market_offer_reservations_v1();select * into o from public.market_offers where id=p_offer_id;
 if o.id is null or o.seller_id<>auth.uid() or o.offer_type<>'price' then raise exception 'Angebot nicht verfügbar'; end if;
 select * into l from public.market_listings where id=o.listing_id for update;select * into o from public.market_offers where id=p_offer_id for update;
 if o.status=p_action then return; end if;if o.status='accepted' and exists(select 1 from public.market_deals d where d.offer_id=o.id) then return; end if;
 if o.status<>'pending' then raise exception 'Angebot ist nicht verfügbar'; end if;
 if p_action='declined' then update public.market_offers set status='declined',responded_at=v_at,updated_at=v_at where id=o.id;return;end if;
 if l.status<>'active' or l.seller_id<>auth.uid() then raise exception 'Listing ist nicht aktiv'; end if;
 perform dv_market_private.require_market_buyer_type(o.buyer_id);if o.buyer_type_snapshot is distinct from 'consumer' then raise exception 'buyer_snapshot_invalid'; end if;
 v_review:=o.contract_review_snapshot;
 if v_review is null or jsonb_typeof(v_review)<>'object' or v_review->>'snapshot_version'<>'price-offer-contract-v1' or o.offer_review_hash is null
    or encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex')<>o.offer_review_hash then raise exception 'offer_contract_snapshot_invalid'; end if;
 if (v_review->>'listing_id')::uuid<>o.listing_id or (v_review->>'seller_id')::uuid<>o.seller_id or v_review->>'buyer_type'<>'consumer' or v_review->>'currency'<>'EUR'
    or round((v_review->>'offered_goods_total')::numeric,2)<>round(o.amount,2) or (v_review->>'quantity')::integer<>coalesce(o.requested_quantity,1) then raise exception 'offer_contract_snapshot_mismatch'; end if;
 v_qty:=(v_review->>'quantity')::integer;if v_qty<1 or v_qty>l.quantity_available then raise exception 'Menge nicht mehr verfügbar'; end if;v_left:=l.quantity_available-v_qty;v_f:=coalesce(v_review->'fulfillment_snapshot','{}'::jsonb);
 update public.market_offers set status='accepted',responded_at=v_at,reserved_quantity=null,reservation_expires_at=null,updated_at=v_at where id=o.id;
 update public.market_offers set status='declined',responded_at=v_at,updated_at=v_at where listing_id=o.listing_id and id<>o.id and offer_type='price' and status='pending' and requested_quantity>v_left;
 update public.market_listings set quantity_available=v_left,status=case when v_left=0 then 'reserved' else 'active' end,accepted_offer_id=o.id,deal_price=(v_review->>'offered_goods_total')::numeric,deal_buyer_id=o.buyer_id,updated_at=v_at where id=l.id;
 insert into public.market_deals(listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,package_contents,weight_grams,length_mm,width_mm,height_mm)
 values(l.id,o.id,o.seller_id,o.buyer_id,(v_review->>'offered_goods_total')::numeric,'EUR','accepted',v_at,v_review->>'shipping_method',(v_review->>'shipping_cost')::numeric,v_review->>'shipping_note',
   v_f->>'product_kind',v_f->>'sealed_category',v_qty,v_f->>'package_contents',case when nullif(v_f->>'unit_weight_grams','') is null then null else (v_f->>'unit_weight_grams')::integer*v_qty end,
   nullif(v_f->>'length_mm','')::integer,nullif(v_f->>'width_mm','')::integer,nullif(v_f->>'height_mm','')::integer)
 on conflict (offer_id) do nothing returning id into v_deal_id;
 if v_deal_id is null then select id into v_deal_id from public.market_deals where offer_id=o.id;end if;if v_deal_id is null then raise exception 'offer_contract_creation_failed'; end if;
end
$$;

-- Cleanup: pending fixed-price offers are short technical reservations only.
create or replace function public.expire_market_offer_reservations_v1()
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare v_offer_id uuid;v_listing_id uuid;v_offer public.market_offers;v_listing public.market_listings;v_count integer:=0;v_restore integer;
begin
  for v_offer_id in
    select o.id from public.market_offers o
    where (
      (o.offer_type='fixed_price' and o.status='pending')
      or (o.offer_type='price' and o.status='accepted' and not exists(select 1 from public.market_deals d where d.offer_id=o.id))
    )
    and o.reservation_expires_at is not null and o.reservation_expires_at<=now()
    order by o.listing_id,o.id
  loop
    select listing_id into v_listing_id from public.market_offers where id=v_offer_id;
    if v_listing_id is null then continue; end if;
    select * into v_listing from public.market_listings where id=v_listing_id for update;
    select * into v_offer from public.market_offers where id=v_offer_id for update;
    if not found or not ((v_offer.offer_type='fixed_price' and v_offer.status='pending')
       or (v_offer.offer_type='price' and v_offer.status='accepted'))
       or v_offer.reservation_expires_at is null or v_offer.reservation_expires_at>now()
       or exists(select 1 from public.market_deals d where d.offer_id=v_offer.id) then continue; end if;
    v_restore:=v_offer.reserved_quantity;
    if v_listing.id is null or v_restore is null or v_restore<=0
       or v_listing.quantity_available+v_restore>v_listing.stock_quantity then
      raise exception 'market_reservation_inventory_inconsistent';
    end if;
    update public.market_offers set status='expired',reserved_quantity=0,reservation_expires_at=null,updated_at=now()
    where id=v_offer.id;
    if v_listing.id is not null then
      update public.market_listings
      set quantity_available=quantity_available+v_restore,
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

-- Reservations are server-managed. Retain only the legacy unreserved price-offer deletion.
revoke insert, update, delete, truncate on public.market_offers from public, anon, authenticated, service_role;
grant delete on public.market_offers to authenticated;
drop policy if exists offers_delete_buyer on public.market_offers;
create policy offers_delete_buyer on public.market_offers for delete to authenticated
using (buyer_id=(select auth.uid()) and status='pending' and offer_type='price'
  and coalesce(reserved_quantity,0)=0 and reservation_expires_at is null);
drop policy if exists offers_delete_unreserved_only on public.market_offers;
create policy offers_delete_unreserved_only on public.market_offers as restrictive for delete to authenticated
using (offer_type='price' and status='pending' and coalesce(reserved_quantity,0)=0 and reservation_expires_at is null);

-- Also reject privileged/cascading removal of a live reservation; cleanup must run first.
create or replace function dv_market_private.protect_market_reservation_delete()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if coalesce(old.reserved_quantity,0)>0 or old.reservation_expires_at is not null then
    raise exception 'market_reservation_requires_release';
  end if;
  return old;
end
$$;
revoke all on function dv_market_private.protect_market_reservation_delete() from public,anon,authenticated,service_role;
drop trigger if exists market_reservation_delete_guard on public.market_offers;
create trigger market_reservation_delete_guard before delete on public.market_offers
for each row execute function dv_market_private.protect_market_reservation_delete();

-- Orders created by Stripe-forming fixed-price acceptance are never merged into an older manual-beta order.

create or replace function public.attach_market_deal_to_order()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare v_order uuid;v_group text;v_title text;v_num text;
begin
  if new.order_id is not null then return new; end if;
  v_group:=case when new.shipping_method='pickup' then 'pickup' else 'shipping' end;
  perform pg_advisory_xact_lock(hashtextextended(new.seller_id::text||':'||new.buyer_id::text||':'||v_group,42));
  if new.payment_provider='manual_beta' and new.payment_status='not_required' then
    select id into v_order from public.market_orders
    where seller_id=new.seller_id and buyer_id=new.buyer_id and fulfillment_group=v_group
      and status in ('open','in_progress') and shipped_at is null
      and payment_provider='manual_beta' and payment_status='not_required' and paid_amount=0
    order by created_at desc limit 1 for update;
  end if;
  if v_order is null then
    v_num:='DV-'||to_char(now(),'YYMMDD')||'-'||lpad(nextval('public.market_order_number_seq')::text,6,'0');
    insert into public.market_orders(
      order_number,seller_id,buyer_id,fulfillment_group,shipping_method,shipping_cost,shipping_quote_status,
      payment_provider,payment_status,paid_amount
    ) values(
      v_num,new.seller_id,new.buyer_id,v_group,new.shipping_method,new.shipping_cost,'auto',
      new.payment_provider,new.payment_status,0
    ) returning id into v_order;
  end if;
  select coalesce(o.contract_review_snapshot->'product'->>'title',l.card_name)
  into v_title
  from public.market_listings l
  left join public.market_offers o on o.id=new.offer_id
  where l.id=new.listing_id;
  insert into public.market_order_items(order_id,deal_id,listing_id,item_title,product_kind,sealed_category,quantity,item_amount,individual_shipping_cost,shipping_method,weight_grams)
  values(v_order,new.id,new.listing_id,coalesce(v_title,'DUELVANTA Produkt'),coalesce(new.product_kind,'single'),new.sealed_category,coalesce(new.item_quantity,1),coalesce(new.amount,0),coalesce(new.shipping_cost,0),new.shipping_method,new.weight_grams)
  on conflict(deal_id) do nothing;
  update public.market_deals set order_id=v_order where id=new.id;
  perform public.recalculate_market_order(v_order);
  return new;
end
$$;

-- Snapshot V2 freezes seller + buyer roles and the true contract-forming event.
create or replace function dv_market_private.capture_market_contract_snapshot()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare
  v_listing public.market_listings%rowtype;v_order public.market_orders%rowtype;v_offer public.market_offers%rowtype;
  v_seller jsonb;v_product jsonb;v_buyer_type text;v_type text;
  v_qty integer:=greatest(coalesce(new.item_quantity,1),1);v_unit numeric;v_goods numeric:=round(new.amount,2);
  v_shipping numeric;v_total numeric;v_shipping_label text;v_payment_text text;v_text text;v_snapshot uuid;
begin
  if new.order_id is null or exists(select 1 from dv_market_private.market_contract_snapshots where deal_id=new.id) then return new; end if;
  select * into v_listing from public.market_listings where id=new.listing_id;
  select * into v_order from public.market_orders where id=new.order_id;
  if not found then raise exception 'checkout_order_missing'; end if;
  if new.currency<>'EUR' or v_goods<=0 then raise exception 'checkout_amount_invalid'; end if;
  if new.shipping_cost is null or new.shipping_cost<0 or new.shipping_cost>500 or new.shipping_method is null then raise exception 'checkout_shipping_incomplete'; end if;
  if new.offer_id is not null then select * into v_offer from public.market_offers where id=new.offer_id; end if;
  v_buyer_type:=dv_market_private.require_market_buyer_type(new.buyer_id);
  if new.offer_id is not null and v_offer.buyer_type_snapshot is distinct from v_buyer_type then raise exception 'buyer_snapshot_invalid'; end if;
  if v_offer.offer_type='price' then
    if v_offer.contract_review_snapshot is null or v_offer.contract_review_snapshot->>'snapshot_version'<>'price-offer-contract-v1' or v_offer.offer_review_hash is null
       or encode(digest(convert_to(v_offer.contract_review_snapshot::text,'UTF8'),'sha256'),'hex')<>v_offer.offer_review_hash then raise exception 'offer_contract_snapshot_invalid'; end if;
    v_seller:=v_offer.contract_review_snapshot->'seller_party';v_product:=v_offer.contract_review_snapshot->'product';v_type:=v_offer.contract_review_snapshot->>'contract_classification';
    if v_type not in ('c2c','b2c') or (v_offer.contract_review_snapshot->>'quantity')::integer<>v_qty or round((v_offer.contract_review_snapshot->>'offered_goods_total')::numeric,2)<>v_goods
       or v_offer.contract_review_snapshot->>'shipping_method' is distinct from new.shipping_method or round((v_offer.contract_review_snapshot->>'shipping_cost')::numeric,2)<>round(new.shipping_cost,2)
       or v_offer.contract_review_snapshot->>'currency' is distinct from new.currency then raise exception 'offer_contract_snapshot_mismatch'; end if;
  elsif v_offer.offer_type='fixed_price' then
    if v_offer.contract_review_snapshot is null or v_offer.contract_review_snapshot->>'snapshot_version'<>'checkout-contract-v2' or v_offer.checkout_hash_snapshot is null
       or encode(digest(convert_to(v_offer.contract_review_snapshot::text,'UTF8'),'sha256'),'hex')<>v_offer.checkout_hash_snapshot then raise exception 'fixed_checkout_snapshot_invalid'; end if;
    v_seller:=v_offer.contract_review_snapshot->'seller_party';v_product:=v_offer.contract_review_snapshot->'product';v_type:=v_offer.contract_review_snapshot->>'contract_classification';
    if v_type not in ('c2c','b2c') or (v_offer.contract_review_snapshot->>'quantity')::integer<>v_qty
       or round((v_offer.contract_review_snapshot->>'goods_total')::numeric,2)<>v_goods
       or v_offer.contract_review_snapshot->>'shipping_method' is distinct from new.shipping_method
       or round((v_offer.contract_review_snapshot->>'shipping_cost')::numeric,2)<>round(new.shipping_cost,2)
       or v_offer.contract_review_snapshot->>'currency' is distinct from new.currency
       or v_offer.contract_review_snapshot->>'payment_provider'<>'stripe_connect' then raise exception 'fixed_contract_snapshot_mismatch'; end if;
  else
    v_seller:=dv_market_private.market_checkout_seller_party(new.seller_id);v_type:=dv_market_private.market_contract_classification(v_seller->>'seller_type',v_buyer_type);
    if v_type is null then raise exception 'contract_classification_invalid'; end if;v_product:=dv_market_private.market_checkout_product_snapshot(v_listing);
  end if;
  v_shipping_label:=case new.shipping_method
    when 'standard_letter' then 'Standardbrief' when 'tracked_letter' then 'Brief mit Tracking'
    when 'parcel' then 'Paket mit Tracking' when 'pickup' then 'Abholung' else 'Individuell / nach Absprache' end;
  v_unit:=round(v_goods/v_qty,2);v_shipping:=round(new.shipping_cost,2);v_total:=round(v_goods+v_shipping,2);
  v_payment_text:=case when new.payment_provider='stripe_connect'
    then 'Stripe Connect – Vertragsschluss mit Erstellung der automatischen Zahlungsaufforderung.'
    else 'Zahlung nach Vertragsschluss; in der Beta keine integrierte Onlinezahlung oder Auszahlung.' end;
  v_text:=format(
    E'DUELVANTA BESTELLBESTÄTIGUNG\\nDokumentversion: checkout-contract-v2\\nOrder: %s\\nVertragsschluss: %s\\nVertragstyp: %s\\nKäuferstatus: %s\\nVerkäuferrolle: %s\\nVertragspartner: %s\\nAnschrift: %s, %s %s, %s\\nProdukt: %s\\nMenge: %s\\nStückpreis: %s EUR\\nWarenwert: %s EUR\\nVersand (%s): %s EUR\\nGesamtpreis: %s EUR\\nZahlungsabwicklung: %s\\nPlattformrolle: Benjamin Fritz – DUELVANTA vermittelt den Vertrag; DUELVANTA ist nicht Verkäufer der Ware.',
    v_order.order_number,to_char(coalesce(new.accepted_at,now()) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    upper(v_type),v_buyer_type,v_seller->>'role_label',coalesce(v_seller->>'business_name',v_seller->>'legal_name'),
    v_seller->>'street_line1',v_seller->>'postal_code',v_seller->>'city',v_seller->>'country_code',
    v_product->>'title',v_qty,to_char(v_unit,'FM999999990.00'),to_char(v_goods,'FM999999990.00'),
    v_shipping_label,to_char(v_shipping,'FM999999990.00'),to_char(v_total,'FM999999990.00'),v_payment_text
  );
  insert into dv_market_private.market_contract_snapshots(
    deal_id,order_id,listing_id,offer_id,seller_id,buyer_id,seller_type,buyer_type,contract_classification,
    seller_party,platform_operator,product_snapshot,quantity,unit_price,goods_total,
    shipping_method,shipping_cost,total_price,currency,payment_provider,contract_formed_at,
    snapshot_version,withdrawal_eligible,confirmation_text,content_sha256
  ) values(
    new.id,new.order_id,new.listing_id,new.offer_id,new.seller_id,new.buyer_id,v_seller->>'seller_type',v_buyer_type,v_type,
    v_seller,jsonb_build_object('role','Marketplace-Vermittler','name','Benjamin Fritz – DUELVANTA',
      'street_line1','Landhausstraße 12','postal_code','75399','city','Unterreichenbach','country_code','DE','email','info@duelvanta.de'),
    v_product,v_qty,v_unit,v_goods,new.shipping_method,v_shipping,v_total,'EUR',new.payment_provider,coalesce(new.accepted_at,now()),
    'checkout-contract-v2',v_type='b2c',v_text,digest(convert_to(v_text,'UTF8'),'sha256')
  ) returning id into v_snapshot;
  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,message_kind,payload,dedupe_key
  ) values(
    v_snapshot,'buyer',new.buyer_id,'order_confirmation',
    jsonb_build_object('snapshot_id',v_snapshot,'order_id',new.order_id,'order_number',v_order.order_number,
      'document_sha256',(select encode(content_sha256,'hex') from dv_market_private.market_contract_snapshots where id=v_snapshot)),
    'order_confirmation:'||v_snapshot::text
  ) on conflict(dedupe_key) do nothing;
  return new;
end
$$;

-- Fixed-price buyer offer: short reservation while Stripe creates the payment request.

create or replace function public.prepare_fixed_price_market_offer_v1(
  p_listing_id uuid,p_quantity integer,p_request_id uuid,p_expected_updated_at timestamptz,p_checkout_hash text,p_live_mode boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare
  v_uid uuid:=auth.uid();v_existing public.market_offers%rowtype;v_listing public.market_listings%rowtype;
  v_review jsonb;v_config dv_market_private.market_payment_configuration%rowtype;v_account dv_market_private.market_stripe_accounts%rowtype;
  v_buyer_type text;v_qty integer;v_left integer;v_total_cents integer;v_fee_cents integer;v_attempt uuid:=gen_random_uuid();
  v_offer uuid;v_deal public.market_deals;v_attempt_row dv_market_private.market_payment_attempts%rowtype;v_hash text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_request_id is null or p_expected_updated_at is null or nullif(lower(trim(coalesce(p_checkout_hash,''))),'') is null then
    raise exception 'fixed_checkout_request_invalid';
  end if;
  v_buyer_type:=dv_market_private.require_market_buyer_type(v_uid);
  perform public.expire_market_offer_reservations_v1();
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,45));

  select * into v_existing from public.market_offers
  where buyer_id=v_uid and offer_type='fixed_price' and checkout_request_id=p_request_id;
  if found then
    if v_existing.listing_id<>p_listing_id or v_existing.requested_quantity<>p_quantity
       or lower(trim(p_checkout_hash)) is distinct from v_existing.checkout_hash_snapshot
       or (v_existing.contract_review_snapshot->>'listing_updated_at')::timestamptz is distinct from p_expected_updated_at then
      raise exception 'fixed_checkout_request_reused';
    end if;
    if v_existing.payment_live_mode_snapshot is distinct from p_live_mode
       or v_existing.stripe_account_id_snapshot is null
       or v_existing.amount_due_cents_snapshot is null or v_existing.amount_due_cents_snapshot<=0
       or v_existing.platform_fee_cents_snapshot is null
       or v_existing.platform_fee_cents_snapshot<0
       or v_existing.platform_fee_cents_snapshot>v_existing.amount_due_cents_snapshot
       or v_existing.contract_review_snapshot is null
       or v_existing.contract_review_snapshot->>'snapshot_version'<>'checkout-contract-v2'
       or v_existing.checkout_hash_snapshot is null then
      raise exception 'fixed_checkout_snapshot_invalid';
    end if;
    v_hash:=encode(digest(convert_to(v_existing.contract_review_snapshot::text,'UTF8'),'sha256'),'hex');
    if v_hash<>v_existing.checkout_hash_snapshot
       or (v_existing.contract_review_snapshot->>'listing_id')::uuid<>v_existing.listing_id
       or (v_existing.contract_review_snapshot->>'seller_id')::uuid<>v_existing.seller_id
       or (v_existing.contract_review_snapshot->>'quantity')::integer<>v_existing.requested_quantity
       or v_existing.contract_review_snapshot->>'buyer_type'<>'consumer'
       or v_existing.contract_review_snapshot->>'contract_classification' not in ('c2c','b2c')
       or jsonb_typeof(v_existing.contract_review_snapshot->'seller_party')<>'object'
       or jsonb_typeof(v_existing.contract_review_snapshot->'product')<>'object'
       or jsonb_typeof(v_existing.contract_review_snapshot->'fulfillment_snapshot')<>'object'
       or nullif(v_existing.contract_review_snapshot->'fulfillment_snapshot'->>'product_kind','') is null
       or v_existing.contract_review_snapshot->>'currency'<>'EUR'
       or v_existing.contract_review_snapshot->>'payment_provider'<>'stripe_connect'
       or round((v_existing.contract_review_snapshot->>'goods_total')::numeric,2)<>round(v_existing.amount,2)
       or round((v_existing.contract_review_snapshot->>'total_price')::numeric*100)::integer<>v_existing.amount_due_cents_snapshot then
      raise exception 'fixed_checkout_snapshot_invalid';
    end if;

    if v_existing.status='accepted' then
      select * into v_deal from public.market_deals where offer_id=v_existing.id;
      select * into v_attempt_row from dv_market_private.market_payment_attempts where id=v_existing.payment_attempt_id;
      if v_deal.id is null or v_attempt_row.id is null
         or v_attempt_row.stripe_account_id<>v_existing.stripe_account_id_snapshot
         or v_attempt_row.amount_due_cents<>v_existing.amount_due_cents_snapshot
         or v_attempt_row.platform_fee_cents<>v_existing.platform_fee_cents_snapshot
         or v_attempt_row.currency<>'EUR' then raise exception 'fixed_checkout_acceptance_incomplete'; end if;
      return jsonb_build_object(
        'replayed',true,'accepted',true,'offer_id',v_existing.id,'payment_attempt_id',v_existing.payment_attempt_id,
        'stripe_checkout_session_id',v_existing.stripe_checkout_session_id,'stripe_account_id',v_existing.stripe_account_id_snapshot,
        'amount_due_cents',v_existing.amount_due_cents_snapshot,'platform_fee_cents',v_existing.platform_fee_cents_snapshot,
        'currency','EUR','order_id',v_deal.order_id,'live_mode',v_existing.payment_live_mode_snapshot
      );
    end if;

    if v_existing.status='pending' and v_existing.reservation_expires_at>now() then
      select * into v_config from dv_market_private.market_payment_configuration where singleton;
      if not found then raise exception 'stripe_payment_configuration_missing'; end if;
      if p_live_mode then
        if not v_config.live_mode then raise exception 'stripe_live_database_disabled'; end if;
      else
        if v_config.live_mode or not v_config.sandbox_enabled then raise exception 'stripe_sandbox_disabled'; end if;
      end if;
      select * into v_account from dv_market_private.market_stripe_accounts where seller_id=v_existing.seller_id;
      if not found or v_account.stripe_account_id<>v_existing.stripe_account_id_snapshot
         or v_account.live_mode is distinct from p_live_mode
         or v_account.onboarding_status<>'ready' or not v_account.charges_enabled then
        raise exception 'stripe_seller_not_ready';
      end if;
      return jsonb_build_object(
        'replayed',true,'accepted',false,'offer_id',v_existing.id,'payment_attempt_id',v_existing.payment_attempt_id,
        'stripe_account_id',v_existing.stripe_account_id_snapshot,'amount_due_cents',v_existing.amount_due_cents_snapshot,
        'platform_fee_cents',v_existing.platform_fee_cents_snapshot,'currency','EUR','live_mode',v_existing.payment_live_mode_snapshot
      );
    end if;
    raise exception 'fixed_checkout_request_expired';
  end if;

  select * into v_config from dv_market_private.market_payment_configuration where singleton for update;
  if not found then raise exception 'stripe_payment_configuration_missing'; end if;
  if p_live_mode then
    if not v_config.live_mode then raise exception 'stripe_live_database_disabled'; end if;
  else
    if v_config.live_mode or not v_config.sandbox_enabled then raise exception 'stripe_sandbox_disabled'; end if;
  end if;

  v_review:=public.review_market_checkout(p_listing_id,p_quantity);
  if lower(trim(p_checkout_hash))<>(v_review->>'checkout_hash')
     or (v_review->>'listing_updated_at')::timestamptz is distinct from p_expected_updated_at then
    raise exception 'checkout_review_changed';
  end if;
  v_buyer_type:=v_review->>'buyer_type';

  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' or v_listing.updated_at is distinct from p_expected_updated_at then
    raise exception 'listing_not_available';
  end if;
  v_qty:=case when v_listing.product_kind='sealed' then p_quantity else 1 end;
  if v_qty<1 or v_qty>v_listing.quantity_available then raise exception 'checkout_quantity_unavailable'; end if;

  select * into v_account from dv_market_private.market_stripe_accounts where seller_id=v_listing.seller_id;
  if not found or v_account.live_mode is distinct from p_live_mode
     or v_account.onboarding_status<>'ready' or not v_account.charges_enabled then
    raise exception 'stripe_seller_not_ready';
  end if;

  v_total_cents:=round((v_review->>'total_price')::numeric*100)::integer;
  v_fee_cents:=least(v_total_cents,round(v_total_cents*v_config.platform_fee_bps/10000.0)::integer+v_config.platform_fee_fixed_cents);
  if v_total_cents<=0 or v_fee_cents<0 or v_fee_cents>v_total_cents then raise exception 'fixed_checkout_amount_invalid'; end if;

  v_left:=v_listing.quantity_available-v_qty;
  update public.market_listings
  set quantity_available=v_left,status=case when v_left=0 then 'reserved' else 'active' end,updated_at=now()
  where id=v_listing.id;

  insert into public.market_offers(
    listing_id,buyer_id,seller_id,offer_type,amount,currency,status,requested_quantity,
    unit_price_snapshot,listed_unit_price_snapshot,listed_total_snapshot,listing_snapshot,contract_review_snapshot,
    reserved_quantity,reservation_expires_at,buyer_type_snapshot,checkout_request_id,checkout_hash_snapshot,payment_attempt_id,
    stripe_account_id_snapshot,payment_live_mode_snapshot,amount_due_cents_snapshot,platform_fee_cents_snapshot
  ) values(
    v_listing.id,v_uid,v_listing.seller_id,'fixed_price',(v_review->>'goods_total')::numeric,'EUR','pending',v_qty,
    (v_review->>'unit_price')::numeric,(v_review->>'unit_price')::numeric,(v_review->>'goods_total')::numeric,
    jsonb_build_object(
      'card_name',v_review->'product'->>'title','product_kind',v_listing.product_kind,'sealed_category',v_listing.sealed_category,
      'language',v_listing.language,'set_name',v_listing.set_name,'base_unit_price',(v_review->>'unit_price')::numeric,
      'shipping_method',v_review->>'shipping_method','shipping_cost',(v_review->>'shipping_cost')::numeric,
      'total_price',(v_review->>'total_price')::numeric
    ),
    v_review-'checkout_hash',v_qty,now()+interval '15 minutes',v_buyer_type,p_request_id,lower(p_checkout_hash),v_attempt,
    v_account.stripe_account_id,p_live_mode,v_total_cents,v_fee_cents
  ) returning id into v_offer;

  return jsonb_build_object(
    'replayed',false,'accepted',false,'offer_id',v_offer,'payment_attempt_id',v_attempt,
    'stripe_account_id',v_account.stripe_account_id,'amount_due_cents',v_total_cents,'platform_fee_cents',v_fee_cents,
    'currency','EUR','live_mode',p_live_mode
  );
end
$$;
revoke all on function public.prepare_fixed_price_market_offer_v1(uuid,integer,uuid,timestamptz,text,boolean) from public,anon;
grant execute on function public.prepare_fixed_price_market_offer_v1(uuid,integer,uuid,timestamptz,text,boolean) to authenticated;

create or replace function public.release_fixed_price_market_offer_v1(p_offer_id uuid,p_reason text default 'payment_request_failed')
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare o public.market_offers;l public.market_listings;v_restore integer;v_listing_id uuid;
begin
  select listing_id into v_listing_id from public.market_offers where id=p_offer_id;
  if not found then return false; end if;
  select * into l from public.market_listings where id=v_listing_id for update;
  select * into o from public.market_offers where id=p_offer_id for update;
  if not found or o.offer_type<>'fixed_price' or o.status<>'pending'
     or exists(select 1 from public.market_deals where offer_id=o.id) then return false; end if;
  v_restore:=o.reserved_quantity;
  if l.id is null or o.listing_id is distinct from l.id or v_restore is null or v_restore<=0
     or l.quantity_available+v_restore>l.stock_quantity then
    raise exception 'market_reservation_inventory_inconsistent';
  end if;
  update public.market_offers
  set status='expired',message=left(coalesce(p_reason,'payment_request_failed'),500),
      reserved_quantity=0,reservation_expires_at=null,updated_at=now()
  where id=o.id;
  if l.id is not null then
    update public.market_listings
    set quantity_available=quantity_available+v_restore,
        status=case when status='reserved' then 'active' else status end,updated_at=now()
    where id=l.id;
  end if;
  return true;
end
$$;
revoke all on function public.release_fixed_price_market_offer_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.release_fixed_price_market_offer_v1(uuid,text) to service_role;


create or replace function public.accept_fixed_price_market_offer_v1(
  p_offer_id uuid,p_attempt_id uuid,p_session_id text,p_payment_requested_at timestamptz,p_live_mode boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare
  o public.market_offers;l public.market_listings;d public.market_deals;s dv_market_private.market_stripe_accounts%rowtype;
  c dv_market_private.market_payment_configuration%rowtype;snap dv_market_private.market_contract_snapshots%rowtype;
  v_total integer;v_fee integer;v_prefix text:=case when p_live_mode then 'cs_live_' else 'cs_test_' end;
  v_review jsonb;v_f jsonb;v_hash text;v_qty integer;v_listing_id uuid;
begin
  if p_offer_id is null or p_attempt_id is null or p_payment_requested_at is null then raise exception 'fixed_acceptance_invalid'; end if;
  if p_session_id is null or position(v_prefix in p_session_id)<>1 then raise exception 'stripe_session_invalid'; end if;
  if p_payment_requested_at<now()-interval '15 minutes' or p_payment_requested_at>now()+interval '2 minutes' then
    raise exception 'payment_request_timestamp_invalid';
  end if;

  select listing_id into v_listing_id from public.market_offers where id=p_offer_id;
  select * into l from public.market_listings where id=v_listing_id for update;
  if not found then raise exception 'listing_not_available'; end if;
  select * into o from public.market_offers where id=p_offer_id for update;
  if not found or o.listing_id is distinct from l.id or o.offer_type<>'fixed_price' or o.payment_attempt_id<>p_attempt_id then raise exception 'fixed_offer_not_found'; end if;

  if o.payment_live_mode_snapshot is distinct from p_live_mode
     or o.stripe_account_id_snapshot is null
     or o.amount_due_cents_snapshot is null or o.amount_due_cents_snapshot<=0
     or o.platform_fee_cents_snapshot is null or o.platform_fee_cents_snapshot<0
     or o.platform_fee_cents_snapshot>o.amount_due_cents_snapshot
     or o.contract_review_snapshot is null or o.contract_review_snapshot->>'snapshot_version'<>'checkout-contract-v2'
     or o.checkout_hash_snapshot is null then raise exception 'fixed_checkout_snapshot_invalid'; end if;
  v_review:=o.contract_review_snapshot;
  v_hash:=encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex');
  if v_hash<>o.checkout_hash_snapshot
     or (v_review->>'listing_id')::uuid<>o.listing_id
     or (v_review->>'seller_id')::uuid<>o.seller_id
     or (v_review->>'quantity')::integer<>o.requested_quantity
     or v_review->>'buyer_type'<>'consumer'
     or v_review->>'contract_classification' not in ('c2c','b2c')
     or jsonb_typeof(v_review->'seller_party')<>'object'
     or jsonb_typeof(v_review->'product')<>'object'
     or jsonb_typeof(v_review->'fulfillment_snapshot')<>'object'
     or nullif(v_review->'fulfillment_snapshot'->>'product_kind','') is null
     or v_review->>'currency'<>'EUR'
     or v_review->>'payment_provider'<>'stripe_connect'
     or round((v_review->>'goods_total')::numeric,2)<>round(o.amount,2)
     or round((v_review->>'total_price')::numeric*100)::integer<>o.amount_due_cents_snapshot then
    raise exception 'fixed_checkout_snapshot_invalid';
  end if;

  if o.status='accepted' then
    select * into d from public.market_deals where offer_id=o.id;
    select * into snap from dv_market_private.market_contract_snapshots where deal_id=d.id;
    if d.id is null or snap.id is null or o.stripe_checkout_session_id<>p_session_id then raise exception 'fixed_acceptance_conflict'; end if;
    return jsonb_build_object('replayed',true,'deal_id',d.id,'order_id',d.order_id,'contract_snapshot_id',snap.id,'contract_classification',snap.contract_classification);
  end if;
  if o.status<>'pending' or o.reservation_expires_at is null or o.reservation_expires_at<=now() then raise exception 'fixed_offer_expired'; end if;

  perform dv_market_private.require_market_buyer_type(o.buyer_id);
  if o.buyer_type_snapshot is distinct from 'consumer' then raise exception 'buyer_snapshot_invalid'; end if;

  if o.reserved_quantity is distinct from o.requested_quantity or o.reserved_quantity<=0 then
    raise exception 'market_reservation_inventory_inconsistent';
  end if;
  select * into s from dv_market_private.market_stripe_accounts where seller_id=o.seller_id;
  if not found or s.stripe_account_id<>o.stripe_account_id_snapshot
     or s.live_mode is distinct from p_live_mode or s.onboarding_status<>'ready' or not s.charges_enabled then
    raise exception 'stripe_seller_not_ready';
  end if;
  select * into c from dv_market_private.market_payment_configuration where singleton;
  if not found then raise exception 'stripe_payment_configuration_missing'; end if;
  if p_live_mode then
    if not c.live_mode then raise exception 'stripe_live_database_disabled'; end if;
  else
    if c.live_mode or not c.sandbox_enabled then raise exception 'stripe_sandbox_disabled'; end if;
  end if;

  v_total:=round((v_review->>'total_price')::numeric*100)::integer;
  v_fee:=o.platform_fee_cents_snapshot;
  if v_total<>o.amount_due_cents_snapshot then raise exception 'fixed_checkout_amount_mismatch'; end if;
  v_qty:=greatest(coalesce(o.requested_quantity,1),1);
  v_f:=coalesce(v_review->'fulfillment_snapshot','{}'::jsonb);

  perform set_config('dv_market.offer_checkout_authorized',o.id::text,true);
  update public.market_offers
  set status='accepted',responded_at=p_payment_requested_at,payment_requested_at=p_payment_requested_at,
      stripe_checkout_session_id=p_session_id,reserved_quantity=0,reservation_expires_at=null,updated_at=now()
  where id=o.id;

  insert into public.market_deals(
    listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,
    shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,
    package_contents,weight_grams,length_mm,width_mm,height_mm,checkout_request_id,
    payment_provider,payment_status
  ) values(
    l.id,o.id,o.seller_id,o.buyer_id,(v_review->>'goods_total')::numeric,'EUR','accepted',p_payment_requested_at,
    v_review->>'shipping_method',(v_review->>'shipping_cost')::numeric,v_review->>'shipping_note',
    coalesce(v_f->>'product_kind',l.product_kind),v_f->>'sealed_category',v_qty,
    v_f->>'package_contents',
    case when nullif(v_f->>'weight_grams','') is null then null else (v_f->>'weight_grams')::integer*v_qty end,
    nullif(v_f->>'length_mm','')::integer,nullif(v_f->>'width_mm','')::integer,nullif(v_f->>'height_mm','')::integer,
    o.checkout_request_id,'stripe_connect','pending'
  ) on conflict (offer_id) do nothing
  returning * into d;

  if d.id is null then select * into d from public.market_deals where offer_id=o.id; end if;
  if d.id is null then raise exception 'fixed_contract_creation_failed'; end if;

  -- AFTER INSERT order attachment updates market_deals.order_id; reload the post-trigger row before payment evidence.
  select * into d from public.market_deals where id=d.id;
  if d.order_id is null then raise exception 'fixed_order_attachment_missing'; end if;

  select * into snap from dv_market_private.market_contract_snapshots where deal_id=d.id;
  if not found then raise exception 'checkout_snapshot_missing'; end if;
  if round(snap.total_price*100)::integer<>v_total
     or snap.seller_party is distinct from v_review->'seller_party'
     or snap.product_snapshot is distinct from v_review->'product'
     or snap.contract_classification is distinct from v_review->>'contract_classification' then
    raise exception 'fixed_contract_snapshot_mismatch';
  end if;

  insert into dv_market_private.market_payment_attempts(
    id,order_id,buyer_id,seller_id,stripe_account_id,idempotency_key,state,currency,
    amount_due_cents,platform_fee_cents,stripe_checkout_session_id,prepared_at,updated_at
  ) values(
    p_attempt_id,d.order_id,o.buyer_id,o.seller_id,o.stripe_account_id_snapshot,o.checkout_request_id,'session_created','EUR',
    v_total,v_fee,p_session_id,p_payment_requested_at,now()
  ) on conflict (id) do nothing;

  select * into s from dv_market_private.market_stripe_accounts where seller_id=o.seller_id;
  if not exists(
    select 1 from dv_market_private.market_payment_attempts a
    where a.id=p_attempt_id and a.order_id=d.order_id and a.stripe_account_id=o.stripe_account_id_snapshot
      and a.amount_due_cents=v_total and a.platform_fee_cents=v_fee and a.stripe_checkout_session_id=p_session_id
  ) then raise exception 'fixed_payment_attempt_conflict'; end if;

  insert into dv_market_private.market_payment_allocations(attempt_id,contract_snapshot_id,gross_cents,platform_fee_cents)
  values(p_attempt_id,snap.id,v_total,v_fee)
  on conflict (attempt_id,contract_snapshot_id) do nothing;

  update public.market_orders
  set payment_provider='stripe_connect',payment_status='pending',paid_amount=0,updated_at=now()
  where id=d.order_id;

  return jsonb_build_object(
    'replayed',false,'deal_id',d.id,'order_id',d.order_id,'contract_snapshot_id',snap.id,
    'contract_classification',snap.contract_classification,'confirmation_sha256',encode(snap.content_sha256,'hex')
  );
end
$$;
revoke all on function public.accept_fixed_price_market_offer_v1(uuid,uuid,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.accept_fixed_price_market_offer_v1(uuid,uuid,text,timestamptz,boolean) to service_role;

-- Electronic withdrawal declaration: immutable B2C marketplace evidence only; no automatic cancellation, refund, payout correction or return flow.
create table if not exists dv_market_private.market_withdrawal_drafts (
  id uuid primary key default gen_random_uuid(),
  contract_snapshot_id uuid not null references dv_market_private.market_contract_snapshots(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete restrict,
  consumer_name text not null,
  confirmation_email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '15 minutes')
);
create table if not exists dv_market_private.market_withdrawals (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique,
  contract_snapshot_id uuid not null references dv_market_private.market_contract_snapshots(id) on delete restrict,
  order_id uuid not null references public.market_orders(id) on delete restrict,
  deal_id uuid not null references public.market_deals(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  contract_domain text not null default 'marketplace_b2c' check (contract_domain='marketplace_b2c'),
  consumer_name text not null,
  confirmation_email text not null,
  declaration_text text not null,
  submitted_at timestamptz not null default now(),
  evidence_snapshot jsonb not null,
  content_sha256 bytea not null
);
create unique index if not exists market_withdrawal_drafts_contract_buyer_uq
  on dv_market_private.market_withdrawal_drafts(contract_snapshot_id,buyer_id);
create unique index if not exists market_withdrawals_contract_snapshot_uq
  on dv_market_private.market_withdrawals(contract_snapshot_id);
alter table dv_market_private.market_withdrawal_drafts enable row level security;
alter table dv_market_private.market_withdrawals enable row level security;
revoke all on table dv_market_private.market_withdrawal_drafts,dv_market_private.market_withdrawals from public,anon,authenticated;

create or replace function dv_market_private.block_market_withdrawal_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'market_withdrawal_is_immutable';end
$$;
revoke all on function dv_market_private.block_market_withdrawal_mutation() from public,anon,authenticated;
drop trigger if exists market_withdrawals_immutable on dv_market_private.market_withdrawals;
create trigger market_withdrawals_immutable before update or delete on dv_market_private.market_withdrawals
for each row execute function dv_market_private.block_market_withdrawal_mutation();

alter table dv_market_private.marketplace_message_outbox drop constraint if exists marketplace_message_outbox_message_kind_check;
alter table dv_market_private.marketplace_message_outbox add constraint marketplace_message_outbox_message_kind_check
  check (message_kind in (
    'notice_received','notice_decided','seller_statement_of_reasons','appeal_received','appeal_decided',
    'order_confirmation','withdrawal_receipt','withdrawal_notice'
  ));

create or replace function public.get_my_market_withdrawable_contracts()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_snapshot_id',s.id,'order_id',s.order_id,'deal_id',s.deal_id,
    'seller_id',s.seller_id,'seller_name',coalesce(nullif(s.seller_party->>'business_name',''),s.seller_party->>'legal_name'),
    'product_title',s.product_snapshot->>'title','contract_formed_at',s.contract_formed_at,
    'total_price',s.total_price,'currency',s.currency,
    'already_submitted',exists(select 1 from dv_market_private.market_withdrawals w where w.contract_snapshot_id=s.id and w.buyer_id=v_uid)
  ) order by s.contract_formed_at desc,s.id),'[]'::jsonb) into v_result
  from dv_market_private.market_contract_snapshots s
  where s.buyer_id=v_uid
    and s.contract_classification='b2c'
    and s.withdrawal_eligible
    and s.seller_type='trader'
    and s.buyer_type='consumer'
    and nullif(trim(s.seller_party->>'public_email'),'') is not null;
  return v_result;
end
$$;
revoke all on function public.get_my_market_withdrawable_contracts() from public,anon;
grant execute on function public.get_my_market_withdrawable_contracts() to authenticated;

create or replace function public.prepare_market_withdrawal_v1(
  p_contract_snapshot_id uuid,p_consumer_name text,p_confirmation_email text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare v_uid uuid:=auth.uid();s dv_market_private.market_contract_snapshots%rowtype;v_id uuid;v_expires timestamptz;
  v_name text:=trim(coalesce(p_consumer_name,''));v_email text:=lower(trim(coalesce(p_confirmation_email,'')));
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if char_length(v_name) not between 2 and 160 then raise exception 'withdrawal_name_invalid'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'withdrawal_email_invalid'; end if;
  delete from dv_market_private.market_withdrawal_drafts where buyer_id=v_uid and expires_at<=now();
  select * into s from dv_market_private.market_contract_snapshots
  where id=p_contract_snapshot_id
    and buyer_id=v_uid
    and contract_classification='b2c'
    and withdrawal_eligible
    and seller_type='trader'
    and buyer_type='consumer'
    and nullif(trim(seller_party->>'public_email'),'') is not null;
  if not found then raise exception 'withdrawal_contract_not_eligible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
  if exists(select 1 from dv_market_private.market_withdrawals where contract_snapshot_id=s.id and buyer_id=v_uid) then
    raise exception 'withdrawal_already_submitted';
  end if;
  insert into dv_market_private.market_withdrawal_drafts(
    contract_snapshot_id,buyer_id,seller_id,consumer_name,confirmation_email
  ) values(s.id,v_uid,s.seller_id,v_name,v_email)
  on conflict (contract_snapshot_id,buyer_id) do update set
    seller_id=excluded.seller_id,
    consumer_name=excluded.consumer_name,
    confirmation_email=excluded.confirmation_email,
    created_at=now(),
    expires_at=now()+interval '15 minutes'
  returning id,expires_at into v_id,v_expires;
  return jsonb_build_object(
    'draft_id',v_id,'contract_snapshot_id',s.id,'order_id',s.order_id,'deal_id',s.deal_id,
    'consumer_name',v_name,'confirmation_email',v_email,
    'seller_name',coalesce(nullif(s.seller_party->>'business_name',''),s.seller_party->>'legal_name'),
    'product_title',s.product_snapshot->>'title','contract_formed_at',s.contract_formed_at,
    'total_price',s.total_price,'currency',s.currency,'expires_at',v_expires
  );
end
$$;
revoke all on function public.prepare_market_withdrawal_v1(uuid,text,text) from public,anon;
grant execute on function public.prepare_market_withdrawal_v1(uuid,text,text) to authenticated;

create or replace function public.confirm_market_withdrawal_v1(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare v_uid uuid:=auth.uid();d dv_market_private.market_withdrawal_drafts%rowtype;
  s dv_market_private.market_contract_snapshots%rowtype;w dv_market_private.market_withdrawals%rowtype;
  v_contract_id uuid;v_text text;v_evidence jsonb;v_submitted timestamptz:=clock_timestamp();
  v_seller_email text;v_seller_name text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into w from dv_market_private.market_withdrawals where draft_id=p_draft_id;
  if found then
    if w.buyer_id<>v_uid then raise exception 'withdrawal_access_denied'; end if;
    return jsonb_build_object('replayed',true,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
      'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email,
      'receipt_sha256',encode(w.content_sha256,'hex'));
  end if;
  select contract_snapshot_id into v_contract_id
  from dv_market_private.market_withdrawal_drafts where id=p_draft_id and buyer_id=v_uid;
  if not found then raise exception 'withdrawal_draft_expired'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_contract_id::text,0));
  select * into d from dv_market_private.market_withdrawal_drafts where id=p_draft_id and buyer_id=v_uid for update;
  if not found then
    select * into w from dv_market_private.market_withdrawals where draft_id=p_draft_id;
    if found then
      return jsonb_build_object('replayed',true,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
        'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email,
        'receipt_sha256',encode(w.content_sha256,'hex'));
    end if;
    raise exception 'withdrawal_draft_expired';
  end if;
  if d.expires_at<=now() then raise exception 'withdrawal_draft_expired'; end if;
  select * into w from dv_market_private.market_withdrawals
  where contract_snapshot_id=d.contract_snapshot_id and buyer_id=v_uid;
  if found then
    delete from dv_market_private.market_withdrawal_drafts where id=d.id;
    return jsonb_build_object('replayed',true,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
      'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email,
      'receipt_sha256',encode(w.content_sha256,'hex'));
  end if;
  select * into s from dv_market_private.market_contract_snapshots
  where id=d.contract_snapshot_id
    and buyer_id=v_uid
    and contract_classification='b2c'
    and withdrawal_eligible
    and seller_type='trader'
    and buyer_type='consumer'
    and nullif(trim(seller_party->>'public_email'),'') is not null;
  if not found then raise exception 'withdrawal_contract_not_eligible'; end if;
  if s.seller_id<>d.seller_id then raise exception 'withdrawal_snapshot_mismatch'; end if;
  v_seller_email:=lower(trim(s.seller_party->>'public_email'));
  v_seller_name:=coalesce(nullif(s.seller_party->>'business_name',''),s.seller_party->>'legal_name');
  v_text:=format(
    E'Widerrufserklärung\nName: %s\nVertrag: %s\nOrder: %s\nProdukt: %s\nErklärung: Hiermit widerrufe ich den oben bezeichneten Vertrag.\nEingang: %s',
    d.consumer_name,s.id,s.order_id,coalesce(s.product_snapshot->>'title','DUELVANTA Produkt'),
    to_char(v_submitted at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
  v_evidence:=jsonb_build_object(
    'contract_domain','marketplace_b2c','contract_snapshot_id',s.id,'order_id',s.order_id,'deal_id',s.deal_id,
    'buyer_id',v_uid,'seller_id',s.seller_id,'seller_recipient_email',v_seller_email,
    'consumer_name',d.consumer_name,'confirmation_email',d.confirmation_email,
    'declaration_text',v_text,'submitted_at',v_submitted
  );
  insert into dv_market_private.market_withdrawals(
    draft_id,contract_snapshot_id,order_id,deal_id,buyer_id,seller_id,contract_domain,consumer_name,
    confirmation_email,declaration_text,submitted_at,evidence_snapshot,content_sha256
  ) values(
    d.id,s.id,s.order_id,s.deal_id,v_uid,s.seller_id,'marketplace_b2c',d.consumer_name,d.confirmation_email,
    v_text,v_submitted,v_evidence,digest(convert_to(v_evidence::text,'UTF8'),'sha256')
  ) returning * into w;
  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,recipient_email,message_kind,payload,dedupe_key
  ) values(
    s.id,'buyer',v_uid,d.confirmation_email,'withdrawal_receipt',
    jsonb_build_object('withdrawal_id',w.id,'contract_domain','marketplace_b2c','contract_snapshot_id',s.id,'order_id',s.order_id,
      'product_title',s.product_snapshot->>'title','consumer_name',d.consumer_name,
      'submitted_at',v_submitted,'declaration_text',v_text,'evidence_sha256',encode(w.content_sha256,'hex')),
    'withdrawal_receipt:'||s.id::text
  ) on conflict(dedupe_key) do nothing;
  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,recipient_email,message_kind,payload,dedupe_key
  ) values(
    s.id,'seller',s.seller_id,v_seller_email,'withdrawal_notice',
    jsonb_build_object('withdrawal_id',w.id,'contract_domain','marketplace_b2c','contract_snapshot_id',s.id,'order_id',s.order_id,
      'product_title',s.product_snapshot->>'title','seller_name',v_seller_name,'consumer_name',d.consumer_name,
      'submitted_at',v_submitted,'declaration_text',v_text,'evidence_sha256',encode(w.content_sha256,'hex')),
    'withdrawal_notice:'||s.id::text
  ) on conflict(dedupe_key) do nothing;
  delete from dv_market_private.market_withdrawal_drafts where id=d.id;
  return jsonb_build_object('replayed',false,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
    'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email,
    'receipt_sha256',encode(w.content_sha256,'hex'));
end
$$;
revoke all on function public.confirm_market_withdrawal_v1(uuid) from public,anon;
grant execute on function public.confirm_market_withdrawal_v1(uuid) to authenticated;

-- Keep withdrawal evidence in the existing own-data export without creating a new retention period.
create or replace function public.export_my_duelvanta_data()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private,extensions as $$
declare v_uid uuid:=auth.uid();v_payload jsonb;v_profile jsonb;v_seller jsonb;v_legal jsonb;v_tax jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
  select to_jsonb(s) into v_seller from public.market_seller_accounts s where s.seller_id=v_uid;
  select to_jsonb(l) into v_legal from dv_market_private.seller_legal_profiles l where l.seller_id=v_uid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'identifier_kind',t.identifier_kind,'issuing_country_code',t.issuing_country_code,
    'created_at',t.created_at,'updated_at',t.updated_at
  )),'[]'::jsonb) into v_tax from dv_market_private.seller_tax_identifiers t where t.seller_id=v_uid;

  v_payload:=jsonb_build_object(
    'export_version','duelvanta-data-export-v1','generated_at',now(),
    'account',coalesce(v_profile,'{}'::jsonb),
    'collection',jsonb_build_object(
      'folders',dv_market_private.json_rows(format('select * from public.collection_folders where user_id=%L order by created_at,id',v_uid)),
      'items',dv_market_private.json_rows(format('select * from public.collection_items where user_id=%L order by created_at,id',v_uid))
    ),
    'marketplace',jsonb_build_object(
      'seller_account',coalesce(v_seller,'null'::jsonb),
      'seller_legal_profile',coalesce(v_legal,'null'::jsonb),
      'tax_identifier_references',v_tax,
      'seller_declarations',dv_market_private.json_rows(format('select declaration_kind,document_version,accepted_at,withdrawn_at from dv_market_private.seller_declarations where seller_id=%L order by accepted_at,id',v_uid)),
      'listings',dv_market_private.json_rows(format('select to_jsonb(l)-array[''seller_id'',''deal_buyer_id''] row_data from public.market_listings l where seller_id=%L order by created_at,id',v_uid)),
      'offers',dv_market_private.json_rows(format('select to_jsonb(o)-array[''seller_id'',''buyer_id''] row_data from public.market_offers o where seller_id=%L or buyer_id=%L order by created_at,id',v_uid,v_uid)),
      'orders',dv_market_private.json_rows(format('select to_jsonb(o)-array[''seller_id'',''buyer_id'',''provider_payment_ref'',''provider_payout_ref'',''provider_refund_ref''] row_data from public.market_orders o where seller_id=%L or buyer_id=%L order by created_at,id',v_uid,v_uid)),
      'deals',dv_market_private.json_rows(format('select to_jsonb(d)-array[''seller_id'',''buyer_id'',''provider_payment_ref'',''provider_payout_ref''] row_data from public.market_deals d where seller_id=%L or buyer_id=%L order by accepted_at,id',v_uid,v_uid)),
      'default_shipping_address',dv_market_private.json_rows(format('select * from public.market_default_shipping_addresses where user_id=%L',v_uid)),
      'shipping_profiles',dv_market_private.json_rows(format('select * from public.market_shipping_profiles where seller_id=%L order by created_at,id',v_uid)),
      'contract_documents',dv_market_private.json_rows(format('select id,order_id,deal_id,contract_classification,seller_party,platform_operator,product_snapshot,quantity,unit_price,goods_total,shipping_method,shipping_cost,total_price,currency,payment_provider,contract_formed_at,snapshot_version,confirmation_format,confirmation_text,encode(content_sha256,''hex'') content_sha256 from dv_market_private.market_contract_snapshots where seller_id=%L or buyer_id=%L order by contract_formed_at,id',v_uid,v_uid)),
      'withdrawals',dv_market_private.json_rows(format('select id,contract_snapshot_id,order_id,deal_id,contract_domain,consumer_name,confirmation_email,declaration_text,submitted_at,encode(content_sha256,''hex'') content_sha256 from dv_market_private.market_withdrawals where buyer_id=%L or seller_id=%L order by submitted_at,id',v_uid,v_uid)),
      'payment_attempts',case when to_regclass('dv_market_private.market_payment_attempts') is null then '[]'::jsonb else dv_market_private.json_rows(format('select id,order_id,state,currency,amount_due_cents,platform_fee_cents,seller_net_cents,paid_cents,refunded_cents,prepared_at,paid_at,updated_at from dv_market_private.market_payment_attempts where seller_id=%L or buyer_id=%L order by prepared_at,id',v_uid,v_uid)) end,
      'financial_documents',case when to_regclass('dv_market_private.market_financial_documents') is null then '[]'::jsonb else dv_market_private.json_rows(format('select d.id,d.attempt_id,d.document_kind,d.document_status,d.issuer_role,d.authorization_version,d.currency,d.net_cents,d.tax_cents,d.gross_cents,d.tax_treatment,encode(d.content_sha256,''hex'') content_sha256,d.issued_at,d.created_at from dv_market_private.market_financial_documents d join dv_market_private.market_payment_attempts a on a.id=d.attempt_id where a.seller_id=%L or a.buyer_id=%L order by d.created_at,d.id',v_uid,v_uid)) end,
      'tax_events',dv_market_private.json_rows(format('select event_type,occurred_at,reporting_year,reporting_quarter,currency,gross_consideration_delta,platform_fee_delta,commission_delta,withheld_tax_delta,remuneration_delta,activity_count_delta,source_type,created_at from dv_market_private.market_tax_events where seller_id=%L order by occurred_at,id',v_uid)),
      'my_notices',dv_market_private.json_rows(format('select case_reference,listing_id,category,explanation,alleged_legal_basis,exact_url,status,decision_action,decision_basis_kind,decision_reference,decision_reason,decision_scope,decision_duration,automated_means_used,submitted_at,decided_at from dv_market_private.listing_notices where reporter_user_id=%L order by submitted_at,id',v_uid)),
      'my_appeals',dv_market_private.json_rows(format('select a.id,n.case_reference,a.appellant_kind,a.grounds,a.status,a.decision_reason,a.submitted_at,a.decided_at from dv_market_private.listing_notice_appeals a join dv_market_private.listing_notices n on n.id=a.notice_id where a.appellant_user_id=%L order by a.submitted_at,a.id',v_uid))
    ),
    'scope_note','Enthält eigene Daten und Vertragsdokumente. Fremde interne Kennungen, Zustellprotokolle und verschlüsselte Steuerwerte sind ausgeschlossen.'
  );
  insert into dv_market_private.user_data_export_events(user_id_hash,export_format,export_version,content_sha256)
  values(digest(v_uid::text,'sha256'),'application/json','duelvanta-data-export-v1',digest(v_payload::text,'sha256'));
  return v_payload;
end
$$;
revoke all on function public.export_my_duelvanta_data() from public, anon;
grant execute on function public.export_my_duelvanta_data() to authenticated;

-- BEGIN GENERATED LEGAL CATALOG READINESS
-- Generated by tests/generate-legal-readiness.mjs from the reviewed empty catalog + candidate.
-- Exact definitions, signatures, RLS, triggers, validated constraints, indexes and effective grants.
-- Any missing/changed component or catalog error closes the guard. No stored readiness state.
create or replace function public.get_market_legal_schema_readiness_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare actual jsonb;
begin
  with required_tables(name) as (values ('dv_market_private.account_data_rights_audit'),('dv_market_private.account_deletion_holds'),('dv_market_private.account_deletion_requests'),('dv_market_private.data_retention_rules'),('dv_market_private.listing_notice_appeals'),('dv_market_private.listing_notice_events'),('dv_market_private.listing_notices'),('dv_market_private.market_contract_snapshots'),('dv_market_private.market_financial_documents'),('dv_market_private.market_invoice_authorizations'),('dv_market_private.market_payment_allocations'),('dv_market_private.market_payment_attempts'),('dv_market_private.market_payment_configuration'),('dv_market_private.market_pickup_handovers'),('dv_market_private.market_pickup_messages'),('dv_market_private.market_refund_requests'),('dv_market_private.market_stripe_accounts'),('dv_market_private.market_stripe_events'),('dv_market_private.market_stripe_onboarding_requests'),('dv_market_private.market_swap_cases'),('dv_market_private.market_swap_confirmations'),('dv_market_private.market_swap_fulfillments'),('dv_market_private.market_swap_pickup_handovers'),('dv_market_private.market_swap_reservations'),('dv_market_private.market_swap_revision_items'),('dv_market_private.market_swap_revisions'),('dv_market_private.market_swap_shipping_addresses'),('dv_market_private.market_swap_threads'),('dv_market_private.market_swap_value_snapshots'),('dv_market_private.market_tax_events'),('dv_market_private.market_tax_export_rows'),('dv_market_private.market_tax_exports'),('dv_market_private.market_withdrawal_drafts'),('dv_market_private.market_withdrawals'),('dv_market_private.marketplace_compliance_policy'),('dv_market_private.marketplace_message_delivery_events'),('dv_market_private.marketplace_message_outbox'),('dv_market_private.seller_account_audit'),('dv_market_private.seller_declarations'),('dv_market_private.seller_legal_profiles'),('dv_market_private.seller_review_actions'),('dv_market_private.seller_tax_identifiers'),('dv_market_private.trade_user_eligibility'),('dv_market_private.user_data_export_events'),('public.market_deal_shipping_addresses'),('public.market_deals'),('public.market_default_shipping_addresses'),('public.market_listing_images'),('public.market_listings'),('public.market_notification_sync_state'),('public.market_notifications'),('public.market_offers'),('public.market_order_cases'),('public.market_order_items'),('public.market_order_payments'),('public.market_order_shipping_access_log'),('public.market_order_shipping_addresses'),('public.market_orders'),('public.market_reviews'),('public.market_seller_accounts'),('public.market_shipping_address_access_log'),('public.market_shipping_profile_rules'),('public.market_shipping_profiles'),('public.profiles')),
 required_functions(name) as (values ('dv_market_private.account_deletion_blockers'),('dv_market_private.audit_market_seller_account'),('dv_market_private.b07_add_workdays_de'),('dv_market_private.b07_complete_order'),('dv_market_private.b07_release1_shipping_windows'),('dv_market_private.b07_set_shipping_due'),('dv_market_private.b07_tracking_complete_order'),('dv_market_private.block_data_rights_audit_mutation'),('dv_market_private.block_market_contract_snapshot_mutation'),('dv_market_private.block_market_payment_evidence_mutation'),('dv_market_private.block_market_swap_evidence_mutation'),('dv_market_private.block_market_tax_evidence_mutation'),('dv_market_private.block_market_withdrawal_mutation'),('dv_market_private.block_money_offer_for_trade_only_listing'),('dv_market_private.block_notice_event_mutation'),('dv_market_private.block_restricted_account_mutation'),('dv_market_private.capture_market_contract_snapshot'),('dv_market_private.capture_market_tax_contract_event'),('dv_market_private.create_market_swap_revision'),('dv_market_private.enforce_sale_only_deal'),('dv_market_private.enforce_sale_only_listing'),('dv_market_private.enforce_sale_only_offer'),('dv_market_private.guard_listing_during_offer_reservation_b07'),('dv_market_private.guard_market_listing_seller_status'),('dv_market_private.guard_reserved_offer_deal_insert_b07'),('dv_market_private.is_market_owner_caller'),('dv_market_private.json_rows'),('dv_market_private.keep_moderated_listing_paused'),('dv_market_private.market_checkout_product_snapshot'),('dv_market_private.market_checkout_seller_party'),('dv_market_private.market_contract_classification'),('dv_market_private.market_tax_csv_field'),('dv_market_private.market_tax_export_dataset'),('dv_market_private.notice_owner_caller'),('dv_market_private.pause_listings_after_seller_restriction'),('dv_market_private.pickup_messages_for_export'),('dv_market_private.protect_market_reservation_delete'),('dv_market_private.reject_retired_swap_write'),('dv_market_private.require_market_buyer_type'),('dv_market_private.require_pickup_message_context'),('dv_market_private.require_private_c2c_user'),('dv_market_private.require_trade_eligibility'),('dv_market_private.user_has_pickup_messages'),('public.accept_fixed_price_market_offer_v1'),('public.add_my_market_listing_image'),('public.advance_market_order_lifecycle_b07'),('public.apply_market_stripe_event'),('public.attach_market_deal_to_order'),('public.begin_market_deal'),('public.bind_market_stripe_checkout_session'),('public.buy_market_listing_v1'),('public.buy_market_listing_v2'),('public.buy_market_listing_v3'),('public.cancel_market_deal'),('public.checkout_accepted_market_offer_v1'),('public.claim_account_deletion_requests'),('public.claim_marketplace_message_delivery'),('public.close_market_swap_thread_v1'),('public.complete_market_deal'),('public.confirm_market_deal_complete'),('public.confirm_market_deal_received'),('public.confirm_market_order_complete'),('public.confirm_market_order_received'),('public.confirm_market_order_shipping'),('public.confirm_market_pickup_handover_b07'),('public.confirm_market_swap_pickup_v1'),('public.confirm_market_swap_received_v1'),('public.confirm_market_swap_revision_v1'),('public.confirm_market_withdrawal_v1'),('public.confirm_my_market_trade_eligibility'),('public.correct_market_tax_remuneration'),('public.create_market_offer_v2'),('public.create_market_offer_v3'),('public.create_market_pickup_handover_code_b07'),('public.create_market_swap_pickup_code_v1'),('public.create_market_swap_proposal_v1'),('public.create_market_swap_proposal_v2'),('public.create_sealed_market_listing_draft'),('public.create_sealed_market_listing_draft_v2'),('public.create_sealed_market_listing_draft_v3'),('public.decide_marketplace_listing_notice'),('public.delete_my_market_shipping_profile'),('public.delete_my_sealed_market_listing_draft'),('public.edit_my_market_listing'),('public.edit_my_market_listing_v2'),('public.edit_my_market_listing_v3'),('public.edit_my_sealed_market_listing'),('public.edit_my_sealed_market_listing_v2'),('public.edit_my_sealed_market_listing_v3'),('public.emit_market_offer_notification'),('public.emit_market_order_status_notification'),('public.emit_market_purchase_notification'),('public.expire_market_listings'),('public.expire_market_offer_reservations_v1'),('public.export_my_duelvanta_data'),('public.finalize_market_order_cancellation'),('public.finish_account_deletion_request'),('public.finish_marketplace_message_delivery'),('public.finish_my_market_listing'),('public.generate_market_tax_export'),('public.get_market_deal_shipping_address'),('public.get_market_listing_image_manifest'),('public.get_market_listing_images'),('public.get_market_order_items'),('public.get_market_order_shipping_address'),('public.get_market_payment_sandbox_status'),('public.get_market_pickup_conversation_v1'),('public.get_market_seller_disclosure'),('public.get_market_seller_disclosures'),('public.get_market_seller_profile'),('public.get_market_tax_export'),('public.get_marketplace_notice_status'),('public.get_my_market_deals'),('public.get_my_market_notifications'),('public.get_my_market_offers_v2'),('public.get_my_market_order_b07_status'),('public.get_my_market_order_cases'),('public.get_my_market_order_contract_documents'),('public.get_my_market_orders'),('public.get_my_market_owner_access'),('public.get_my_market_payment_records'),('public.get_my_market_seller_onboarding'),('public.get_my_market_shipping_profiles'),('public.get_my_market_shipping_status'),('public.get_my_market_swap_cases_v1'),('public.get_my_market_swaps_v1'),('public.get_my_market_trade_eligibility'),('public.get_my_market_withdrawable_contracts'),('public.get_my_marketplace_moderation_cases'),('public.get_owner_market_delivery_reviews_b07'),('public.get_owner_market_seller_reviews'),('public.get_owner_marketplace_notices'),('public.get_public_market_listing_v1'),('public.get_public_market_reviews'),('public.issue_market_financial_document'),('public.list_my_market_pickup_conversations_v1'),('public.mark_all_market_notifications_read'),('public.mark_market_deal_shipped'),('public.mark_market_notification_read'),('public.mark_market_order_shipped'),('public.mark_market_stripe_onboarding_link_created'),('public.mark_market_stripe_refund_submitted'),('public.mark_market_swap_shipped_v1'),('public.normalize_market_listing_product_kind'),('public.normalize_market_notification_v2_read_state'),('public.open_market_deal_dispute'),('public.open_market_order_dispute'),('public.open_market_order_problem_v2'),('public.open_market_swap_problem_v1'),('public.prepare_account_deletion_data'),('public.prepare_fixed_price_market_offer_v1'),('public.prepare_market_stripe_full_refund'),('public.prepare_market_stripe_onboarding'),('public.prepare_market_stripe_payment'),('public.prepare_market_withdrawal_v1'),('public.propose_market_swap_revision_v1'),('public.propose_market_swap_revision_v2'),('public.publish_my_sealed_market_listing'),('public.recalc_market_order_after_address_change'),('public.recalculate_market_order'),('public.reconcile_market_stripe_refund_evidence'),('public.record_market_order_delivery_evidence_b07'),('public.record_market_tax_remuneration'),('public.register_market_stripe_test_account'),('public.register_my_market_listing_image'),('public.release_account_deletion_hold'),('public.release_fixed_price_market_offer_v1'),('public.remove_my_market_listing_image'),('public.renew_my_market_listing'),('public.request_market_order_cancellation'),('public.request_market_order_delivery_review_b07'),('public.request_my_account_deletion'),('public.respond_market_order_cancellation'),('public.respond_market_order_problem'),('public.respond_market_swap_problem_v1'),('public.respond_to_market_offer'),('public.review_market_checkout'),('public.review_market_offer_checkout_v1'),('public.review_market_order_delivery_b07'),('public.review_market_price_offer_v1'),('public.review_market_seller_onboarding'),('public.review_marketplace_notice_appeal'),('public.save_my_market_seller_legal_profile'),('public.seed_market_order_default_shipping_address'),('public.send_market_pickup_message_v1'),('public.set_marketplace_seller_onboarding_enforcement'),('public.set_my_market_seller_type'),('public.submit_market_review'),('public.submit_marketplace_listing_notice'),('public.submit_marketplace_notice_appeal'),('public.submit_my_market_seller_onboarding'),('public.submit_my_marketplace_moderation_appeal'),('public.sync_market_order_address_to_default'),('public.upsert_my_market_order_shipping_address'),('public.upsert_my_market_shipping_address'),('public.upsert_my_market_shipping_profile'),('public.validate_market_shipping_profile_rule'),('public.withdraw_market_order_cancellation'),('public.withdraw_market_order_problem'),('public.withdraw_market_swap_problem_v1'),('public.withdraw_my_market_offer')),
 checks as (
 select 'table' kind,r.name,jsonb_build_object(
 'rls',c.relrowsecurity,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid),x.convalidated,x.condeferrable,x.condeferred) order by x.conname) from pg_constraint x where x.conrelid=c.oid and x.contype<>'n'),
 'indexes',(select jsonb_agg(jsonb_build_array(i.relname,pg_get_indexdef(x.indexrelid),x.indisvalid,x.indisready) order by i.relname) from pg_index x join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid),
 'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
 'browser_privileges',(select jsonb_agg(jsonb_build_array(role,priv,has_table_privilege(role,c.oid,priv)) order by role,priv)
  from unnest(array['anon','authenticated']) role cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) priv),
 'column_privileges',(select jsonb_agg(jsonb_build_array(role,a.attname,priv,has_column_privilege(role,c.oid,a.attnum,priv)) order by role,a.attnum,priv)
  from pg_attribute a cross join unnest(array['anon','authenticated']) role cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) priv
  where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)
 ) value from required_tables r left join pg_class c on c.oid=to_regclass(r.name)
 union all
 select 'function',r.name||'('||pg_get_function_identity_arguments(p.oid)||')',
 jsonb_build_object('body',md5(p.prosrc),'result',pg_get_function_result(p.oid),'definer',p.prosecdef,'volatility',p.provolatile,
 'config',p.proconfig,'language',l.lanname,'kind',p.prokind,
 'grants',(select jsonb_agg(jsonb_build_array(role,has_function_privilege(role,p.oid,'EXECUTE')) order by role) from unnest(array['anon','authenticated','service_role']) role))
 from required_functions r left join pg_proc p on p.pronamespace::regnamespace::text||'.'||p.proname=r.name left join pg_language l on l.oid=p.prolang
 union all
 select 'boundary','private',jsonb_build_object(
 'schema',(select jsonb_agg(jsonb_build_array(role,has_schema_privilege(role,'dv_market_private','USAGE'),has_schema_privilege(role,'dv_market_private','CREATE')) order by role) from unnest(array['anon','authenticated']) role),
 'offer_backend',(select jsonb_agg(jsonb_build_array(priv,has_table_privilege('service_role','public.market_offers',priv)) order by priv) from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) priv),
 'offer_policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,
 (select jsonb_agg(r.rolname order by r.rolname) from pg_roles r where r.oid=any(p.polroles)),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
 from pg_policy p where p.polrelid='public.market_offers'::regclass))
 ) select jsonb_agg(jsonb_build_array(kind,name,md5(value::text)) order by kind,name) from checks into actual;
  return jsonb_build_object('revision','trade-legal-contract-model-v1.2','compatible',
    coalesce(actual=$catalog$[["boundary","private","21aae20a7972c1783f34560b9c804995"],["function","dv_market_private.account_deletion_blockers(p_uid uuid)","3e969eb0475ee9a8bfdd9c89f28d0b7b"],["function","dv_market_private.audit_market_seller_account()","9e7611aa2f1ca465189eff60604d57c7"],["function","dv_market_private.b07_add_workdays_de(p_start timestamp with time zone, p_days integer)","4b5db023087851ac5f7888de74ade17e"],["function","dv_market_private.b07_complete_order(p_order_id uuid, p_reason text, p_completed_at timestamp with time zone)","d0cb60f71c5f8afdefcec8d67fc584be"],["function","dv_market_private.b07_release1_shipping_windows()","62bec6ce5d6baab7bfdf4a8584facff3"],["function","dv_market_private.b07_set_shipping_due()","efe18a014f7e20272cb19e6c88fc6da7"],["function","dv_market_private.b07_tracking_complete_order(p_order_id uuid, p_reason text, p_completed_at timestamp with time zone)","7b456d80765bd780df310f7ffc4701a5"],["function","dv_market_private.block_data_rights_audit_mutation()","c420374324aba40aba7e1e796778eb4c"],["function","dv_market_private.block_market_contract_snapshot_mutation()","68a22cad73da89ad567823b9d62a25ce"],["function","dv_market_private.block_market_payment_evidence_mutation()","ec6574cc36a94e955f6d68a82a70a9ec"],["function","dv_market_private.block_market_swap_evidence_mutation()","42844e4c8d1ccdc5058ec1dfe11bbf24"],["function","dv_market_private.block_market_tax_evidence_mutation()","92b5d43cca8113a73a768139ae422d77"],["function","dv_market_private.block_market_withdrawal_mutation()","1ea9fbbd5e4f6c1b091fb782b59cb438"],["function","dv_market_private.block_money_offer_for_trade_only_listing()","3e6caf844297920728dfa2bd25fb5e21"],["function","dv_market_private.block_notice_event_mutation()","00b2e8204e37aacba94e9b4c78054b3a"],["function","dv_market_private.block_restricted_account_mutation()","a31b5660cf0b3fafe0cfacf7c4adbe92"],["function","dv_market_private.capture_market_contract_snapshot()","b22718e23cd5f5156d4d49dc5e19ca86"],["function","dv_market_private.capture_market_tax_contract_event()","3386365a942372962147836ee9957048"],["function","dv_market_private.create_market_swap_revision(p_thread_id uuid, p_proposed_by uuid, p_party_a_listing_ids uuid[], p_party_b_listing_ids uuid[])","a816e5c91a05a40c48fc17ae62b29300"],["function","dv_market_private.enforce_sale_only_deal()","729170633a6489938e439e34873c2b5e"],["function","dv_market_private.enforce_sale_only_listing()","0919e2cc9ec994459e18998c8befe169"],["function","dv_market_private.enforce_sale_only_offer()","8f43523ef3ae6e189ed8459415be228d"],["function","dv_market_private.guard_listing_during_offer_reservation_b07()","ca8c2c1bbfccd2840d7a83538da71f2a"],["function","dv_market_private.guard_market_listing_seller_status()","3c9eeb9aa4b618ff3e8d467c0efb019e"],["function","dv_market_private.guard_reserved_offer_deal_insert_b07()","5e885eed42fd5077e0df43a9df01300b"],["function","dv_market_private.is_market_owner_caller()","83214b3aafa43f4fe4572b2344fed602"],["function","dv_market_private.json_rows(p_sql text)","09146596b969312fa85a534a677f02c2"],["function","dv_market_private.keep_moderated_listing_paused()","a13ea89f35972cb1a9aba071335cc51f"],["function","dv_market_private.market_checkout_product_snapshot(p_listing market_listings)","d382ebdabbb750f45dfeb88031ff05ec"],["function","dv_market_private.market_checkout_seller_party(p_seller_id uuid)","d04faa689a8acc75ecec3ea17360acb6"],["function","dv_market_private.market_contract_classification(p_seller_type text, p_buyer_type text)","267d5e3764bbb27ab984ac5789affa6a"],["function","dv_market_private.market_tax_csv_field(p_value text)","1f075b443e4fcdbed0d6589913bff3e1"],["function","dv_market_private.market_tax_export_dataset(p_reporting_year integer, p_reporting_quarter integer)","c60023140d3e974bb27c975c22420701"],["function","dv_market_private.notice_owner_caller()","83214b3aafa43f4fe4572b2344fed602"],["function","dv_market_private.pause_listings_after_seller_restriction()","dd4df4996b677c40114c5e695c664699"],["function","dv_market_private.pickup_messages_for_export(p_uid uuid)","2a271a23cb05c3367cf13b5dfc75eedb"],["function","dv_market_private.protect_market_reservation_delete()","7b8c21d81a60c20bab1159ec79966327"],["function","dv_market_private.reject_retired_swap_write()","5b12e97bf99edb477955cc576ac32ac2"],["function","dv_market_private.require_market_buyer_type(p_buyer_id uuid)","cb83300da4517d0eab0432fc05697bd9"],["function","dv_market_private.require_pickup_message_context(p_context_type text, p_context_id uuid, p_user_id uuid, p_for_write boolean)","450dee295141034a0c5a3573e0371ea0"],["function","dv_market_private.require_private_c2c_user(p_user_id uuid)","da02cfd6ce4ddd1dff0f0c8fb9c86785"],["function","dv_market_private.require_trade_eligibility(p_user_id uuid, p_require_private_buyer boolean)","f46d5ebe185a545872fc5f625c038cbb"],["function","dv_market_private.user_has_pickup_messages(p_uid uuid)","1dfe505aa8b5a4b1f1f88c82695889ed"],["function","public.accept_fixed_price_market_offer_v1(p_offer_id uuid, p_attempt_id uuid, p_session_id text, p_payment_requested_at timestamp with time zone, p_live_mode boolean)","88df054edec45e439186b2df5308ff9d"],["function","public.add_my_market_listing_image(p_listing_id uuid, p_storage_path text, p_sort_order integer)","d7a4b57bade8a5131ec133b777f1a4bd"],["function","public.advance_market_order_lifecycle_b07()","c08d4845e763d8842045aceb50ae7d9c"],["function","public.apply_market_stripe_event(p_event_id text, p_event_type text, p_account_id text, p_live_mode boolean, p_object_id text, p_payload_sha256 text, p_provider_created_at timestamp with time zone, p_data jsonb)","446c38099bd6ee10e3d94040a094badf"],["function","public.attach_market_deal_to_order()","d330ba655328ab6b53848e868b8a01e2"],["function","public.begin_market_deal(p_deal_id uuid)","a0454aab3f79beaf941383075e15080b"],["function","public.bind_market_stripe_checkout_session(p_attempt_id uuid, p_session_id text)","c726a8fb407c89e3dbbfa5eb20a07d7d"],["function","public.buy_market_listing_v1(p_listing_id uuid, p_quantity integer)","99eb5aa29461d4f20c8f9f28c8f0e242"],["function","public.buy_market_listing_v2(p_listing_id uuid, p_quantity integer, p_request_id uuid, p_expected_updated_at timestamp with time zone)","00849bd7e3eb2b9b3fb2f8383a4b98ec"],["function","public.buy_market_listing_v3(p_listing_id uuid, p_quantity integer, p_request_id uuid, p_expected_updated_at timestamp with time zone, p_checkout_hash text)","693edf96be8b9a7198a0e0f9e5e2d2c6"],["function","public.cancel_market_deal(p_deal_id uuid, p_reason text)","e9ea8ce22a6dac9648b9b5d45f5022f0"],["function","public.checkout_accepted_market_offer_v1(p_offer_id uuid, p_request_id uuid, p_checkout_hash text)","b8a2bf438013b4b2d2fd50460a77e023"],["function","public.claim_account_deletion_requests(p_limit integer, p_lock_token uuid)","4dc957a2524031be73f5beba556eb565"],["function","public.claim_marketplace_message_delivery(p_limit integer, p_lock_token uuid)","262a43b608ea7f9f736b4d9484712d9e"],["function","public.close_market_swap_thread_v1(p_thread_id uuid, p_action text)","e42618272abfcb5acfef260b21b55f1d"],["function","public.complete_market_deal(p_listing_id uuid)","076da69aaec979a258c8d740d6baac1a"],["function","public.confirm_market_deal_complete(p_deal_id uuid)","b168a1395ea4b8b7aa4aebf773f2b100"],["function","public.confirm_market_deal_received(p_deal_id uuid)","64628a458d11b2ff4d1c6d3b8fe92711"],["function","public.confirm_market_order_complete(p_order_id uuid)","5a03462f4c117e7c7643dd890e21fc4b"],["function","public.confirm_market_order_received(p_order_id uuid)","43606ed55800fd4ab1b4c905cbfcea03"],["function","public.confirm_market_order_shipping(p_order_id uuid, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","7317179c342aa1e999becc78cf8cc560"],["function","public.confirm_market_pickup_handover_b07(p_order_id uuid, p_code text)","6715e974397a72255ec637b526e37770"],["function","public.confirm_market_swap_pickup_v1(p_thread_id uuid, p_code text)","5e619acce9dbc604e096ed77021aa47e"],["function","public.confirm_market_swap_received_v1(p_thread_id uuid, p_sender_id uuid)","31248aea616b32d53c10e3cdd13e1931"],["function","public.confirm_market_swap_revision_v1(p_thread_id uuid, p_revision_id uuid)","5f3a0f443ab77fbe845e43216d43481c"],["function","public.confirm_market_withdrawal_v1(p_draft_id uuid)","286ae67975eaf3b446b028ae5a333842"],["function","public.confirm_my_market_trade_eligibility(p_date_of_birth date, p_residence_country_code text, p_confirm_private_buyer boolean)","75a564284c5aa98b06af526ac9ede6f8"],["function","public.correct_market_tax_remuneration(p_original_event_id uuid, p_event_key text, p_occurred_at timestamp with time zone, p_gross_reversal numeric, p_platform_fee_reversal numeric, p_commission_reversal numeric, p_withheld_tax_reversal numeric, p_void_activity boolean, p_source_reference text, p_evidence jsonb)","11e02cb5c8c7042edbe224b06db91395"],["function","public.create_market_offer_v2(p_listing_id uuid, p_requested_quantity integer, p_amount numeric, p_message text)","8a083c76e91531d3821be47b0a357a3c"],["function","public.create_market_offer_v3(p_listing_id uuid, p_requested_quantity integer, p_amount numeric, p_message text, p_expected_updated_at timestamp with time zone, p_offer_review_hash text)","651642a920b892c1d91c54d38e0e273e"],["function","public.create_market_pickup_handover_code_b07(p_order_id uuid)","85ab8af5027b64596a1c020c08e230a8"],["function","public.create_market_swap_pickup_code_v1(p_thread_id uuid)","38eb6b0ec0131929aaad8e853c5f1eb2"],["function","public.create_market_swap_proposal_v1(p_target_listing_id uuid, p_offered_listing_ids uuid[])","dbad0a056af76f0d41d685c5bde05cbd"],["function","public.create_market_swap_proposal_v2(p_target_listing_id uuid, p_offered_listing_ids uuid[], p_fulfillment_mode text)","df79b8f0695e572438f86392943ca85e"],["function","public.create_sealed_market_listing_draft(p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_bundle_quantity integer, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","ac738e46fdbf8c1dfcb8de916d400924"],["function","public.create_sealed_market_listing_draft_v2(p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","f01ea544a93b4a5443e17d9184933a92"],["function","public.create_sealed_market_listing_draft_v3(p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","806adfbdbfe69c4bd3e3002693cb5b96"],["function","public.decide_marketplace_listing_notice(p_notice_id uuid, p_action text, p_basis_kind text, p_reference text, p_reason text, p_scope text, p_duration text, p_automated_means_used boolean)","d0c5fb693b3f32a353e9455c51c64c15"],["function","public.delete_my_market_shipping_profile(p_profile_id uuid)","89ebc7794375fd2f4d82b1df642cf5be"],["function","public.delete_my_sealed_market_listing_draft(p_listing_id uuid)","17693513d00984d6809713a31895c3dc"],["function","public.edit_my_market_listing(p_listing_id uuid, p_listing_type text, p_asking_price numeric, p_seller_note text)","aea59b937e55b440f2beec48a8ad922d"],["function","public.edit_my_market_listing_v2(p_listing_id uuid, p_listing_type text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","1d3fd50eb6c0bf02f06af01eb7146280"],["function","public.edit_my_market_listing_v3(p_listing_id uuid, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","e5f55463bb6bee9a4dfd598444c09f6a"],["function","public.edit_my_sealed_market_listing(p_listing_id uuid, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_bundle_quantity integer, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","5b91ebc61d6b84668b398e9bc4287a31"],["function","public.edit_my_sealed_market_listing_v2(p_listing_id uuid, p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","956af4a4d9adb11cad14436a482175da"],["function","public.edit_my_sealed_market_listing_v3(p_listing_id uuid, p_tcg text, p_product_name text, p_set_code text, p_language text, p_sealed_category text, p_sealed_condition text, p_stock_quantity integer, p_minimum_purchase_quantity integer, p_quantity_pricing jsonb, p_package_contents text, p_units_per_container integer, p_weight_grams integer, p_length_mm integer, p_width_mm integer, p_height_mm integer, p_listing_type text, p_pricing_mode text, p_asking_price numeric, p_seller_note text, p_shipping_method text, p_shipping_cost numeric, p_shipping_note text)","ca765fb57aa06e7dfca083ca903b5041"],["function","public.emit_market_offer_notification()","5adfebf5333f7f9a2016e7ec58300d55"],["function","public.emit_market_order_status_notification()","5742fcb893ce3d9b36f6bf7589fa85ac"],["function","public.emit_market_purchase_notification()","644ecadaf5a7f868d17314c66f852509"],["function","public.expire_market_listings()","a97ec1b982d02138552c5ffc3f9dc19c"],["function","public.expire_market_offer_reservations_v1()","78e4c0e01375f088f2edb2520bb96bcd"],["function","public.export_my_duelvanta_data()","7aee30292619aa2d4279b255a04102e1"],["function","public.finalize_market_order_cancellation(p_order_id uuid, p_cancelled_by uuid, p_reason text)","4c4977bfa1589b39307a494b7efa8430"],["function","public.finish_account_deletion_request(p_request_id uuid, p_lock_token uuid, p_success boolean, p_error text)","67edcf9bda247766caf74b500361016e"],["function","public.finish_marketplace_message_delivery(p_message_id uuid, p_lock_token uuid, p_success boolean, p_provider_message_id text, p_error text)","57f1e7529884638fe37cc74805ca5b75"],["function","public.finish_my_market_listing(p_listing_id uuid, p_reason text)","27f3648d63ec4d2a59df71a331f31346"],["function","public.generate_market_tax_export(p_reporting_year integer, p_reporting_quarter integer, p_format text)","db7b02d4da34f34bb579bd34bbe5c2de"],["function","public.get_market_deal_shipping_address(p_deal_id uuid)","6f3c8b3d0ee8ea91e265ba4103287589"],["function","public.get_market_listing_image_manifest(p_listing_ids uuid[])","2c96e38160d89bdb667c4e7f54e1a88d"],["function","public.get_market_listing_images(p_listing_id uuid)","3e1b0e90ec628178b74272b13ad73224"],["function","public.get_market_order_items(p_order_id uuid)","d17c25fa1046060a2bab7da90864f7ba"],["function","public.get_market_order_shipping_address(p_order_id uuid)","1ad4614757faecd8a447a7ffae79f62d"],["function","public.get_market_payment_sandbox_status()","b8a127aebbe3ddd023bbea9071cf31ff"],["function","public.get_market_pickup_conversation_v1(p_context_type text, p_context_id uuid)","8d4f2c9f0ab307898daba5a945a34534"],["function","public.get_market_seller_disclosure(p_seller_id uuid)","01ece37c06e344db987f1e046eb4c150"],["function","public.get_market_seller_disclosures(p_seller_ids uuid[])","f2fa1b8f167244a9a468759ae6889bfb"],["function","public.get_market_seller_profile(p_seller_id uuid)","a1d00c47ca166034a64a37deabdf5b18"],["function","public.get_market_tax_export(p_export_id uuid)","ca24665cca1d466c1478cd4d9034c9ca"],["function","public.get_marketplace_notice_status(p_case_reference text, p_access_code text)","17cb604fc9579db0ed0295e748b51d15"],["function","public.get_my_market_deals()","7d26dd22e4184da73cf446e21e6f49f0"],["function","public.get_my_market_notifications(p_limit integer)","764ac87517284855d38f305cb49a9258"],["function","public.get_my_market_offers_v2()","52a52cd5f63c7c9b5181cb67ceae1dc4"],["function","public.get_my_market_order_b07_status()","4b70927c8cc805b121da57ca27cf2650"],["function","public.get_my_market_order_cases()","c391f5f61418eedae28b0bdd676cb603"],["function","public.get_my_market_order_contract_documents(p_order_id uuid)","2fd5c357e3453413be2f9c785f0701f5"],["function","public.get_my_market_orders()","6fe66d87f5b3d333285c5f8a03c972a6"],["function","public.get_my_market_owner_access()","b5e6f96b856caffb2ea1ec9de265b23c"],["function","public.get_my_market_payment_records(p_order_id uuid)","aab6c8e0828df9f57ba2ee912256237b"],["function","public.get_my_market_seller_onboarding()","4692eb1a83efbb47a20b035e96cf1ef0"],["function","public.get_my_market_shipping_profiles()","8ddbeabc9c0fb5377b552138aacdf41f"],["function","public.get_my_market_shipping_status()","5b12e26df6dbea794955aaba8602bbe0"],["function","public.get_my_market_swap_cases_v1()","42cff52565fcc1d7470e4b953846d851"],["function","public.get_my_market_swaps_v1()","96c0c8452bab091783e146c2e4d82b7f"],["function","public.get_my_market_trade_eligibility()","d6ec3ef7bb4fa712daa456b43da74740"],["function","public.get_my_market_withdrawable_contracts()","886e04faddd89f5a85516df008a7e75c"],["function","public.get_my_marketplace_moderation_cases()","1d1da397d23068382370d0db044acdfb"],["function","public.get_owner_market_delivery_reviews_b07(p_status text)","14db1d69d33eb830e45b7c75635553f4"],["function","public.get_owner_market_seller_reviews(p_status text)","d076d3f87cde765d3a0b024bbfa7e70d"],["function","public.get_owner_marketplace_notices(p_status text)","8edb9ef7eac0abb949729de57304d32e"],["function","public.get_public_market_listing_v1(p_listing_id uuid)","86162eee55926788f462c79b89c5d793"],["function","public.get_public_market_reviews(p_seller_id uuid, p_limit integer)","6a9ec1495fe28e3c888654d07cd60b7c"],["function","public.issue_market_financial_document(p_attempt_id uuid, p_document_kind text, p_snapshot jsonb, p_net_cents integer, p_tax_cents integer, p_gross_cents integer)","bf328f273546f22ba267515084663b8d"],["function","public.list_my_market_pickup_conversations_v1()","534e91870dd1715b792f0d435d0c1ac1"],["function","public.mark_all_market_notifications_read()","1f878a0687c3492255cd4b7dc25f2515"],["function","public.mark_market_deal_shipped(p_deal_id uuid, p_carrier text, p_tracking_code text)","7d85e3bcf222f535f709f9bb2cb2fee6"],["function","public.mark_market_notification_read(p_notification_id uuid)","aa076ef0d293933af42e9bd967ca3d10"],["function","public.mark_market_order_shipped(p_order_id uuid, p_carrier text, p_tracking_code text)","a1d2aa59d60ff4c376d492bdea2602bd"],["function","public.mark_market_stripe_onboarding_link_created(p_onboarding_request_id uuid, p_account_id text)","504f028306c18dad11bcc0ac3011dceb"],["function","public.mark_market_stripe_refund_submitted(p_request_id uuid, p_refund_id text)","29b268312d1387d62a7601b47f16986f"],["function","public.mark_market_swap_shipped_v1(p_thread_id uuid, p_carrier text, p_tracking_code text)","8b41922d54b61fe0ec46096d37ad8d05"],["function","public.normalize_market_listing_product_kind()","79e4b770b146212fdd58a484c7837649"],["function","public.normalize_market_notification_v2_read_state()","9f05137bbf2918a4112784b4e0570e25"],["function","public.open_market_deal_dispute(p_deal_id uuid, p_reason text)","d8b6ff9ad8db22f899ccf0b8c045c448"],["function","public.open_market_order_dispute(p_order_id uuid, p_reason text)","f4f05a07421829ae6dbefdc9602ba593"],["function","public.open_market_order_problem_v2(p_order_id uuid, p_category text, p_reason text)","03d7bcad522fd63b326f1072c2b5f0cc"],["function","public.open_market_swap_problem_v1(p_thread_id uuid, p_fulfillment_sender_id uuid, p_category text, p_reason text)","0a267c3cc2f115fd916bfd15deb5ad49"],["function","public.prepare_account_deletion_data(p_request_id uuid, p_lock_token uuid)","dffd9322c9439f9f221c4daa8d340369"],["function","public.prepare_fixed_price_market_offer_v1(p_listing_id uuid, p_quantity integer, p_request_id uuid, p_expected_updated_at timestamp with time zone, p_checkout_hash text, p_live_mode boolean)","4d5d39d2b1c37b743b3c130a24ae625c"],["function","public.prepare_market_stripe_full_refund(p_order_id uuid, p_request_key uuid, p_reason text)","9d741b16000bff76fc17c31cce72c451"],["function","public.prepare_market_stripe_onboarding(p_seller_id uuid, p_request_key uuid)","b217cc7e0c936ece15c87587ab405909"],["function","public.prepare_market_stripe_payment(p_order_id uuid, p_buyer_id uuid, p_idempotency_key uuid)","0b8c1746f74c7291bc30fc342aec5ae0"],["function","public.prepare_market_withdrawal_v1(p_contract_snapshot_id uuid, p_consumer_name text, p_confirmation_email text)","d2f1295b7041136de3e2d3b8a1961c63"],["function","public.propose_market_swap_revision_v1(p_thread_id uuid, p_party_a_listing_ids uuid[], p_party_b_listing_ids uuid[])","aa9e5cc5f8ac85f31a6c8ce522feb39e"],["function","public.propose_market_swap_revision_v2(p_thread_id uuid, p_party_a_listing_ids uuid[], p_party_b_listing_ids uuid[], p_fulfillment_mode text)","53d5f11627968b0e38cdf9ccb7eb3274"],["function","public.publish_my_sealed_market_listing(p_listing_id uuid)","a04bb38d220ec28cb36d15f354ecf144"],["function","public.recalc_market_order_after_address_change()","2b68ab15d6304e29bf997505538d1d01"],["function","public.recalculate_market_order(p_order_id uuid)","adb1c9a7d1844102659a1db691c06f81"],["function","public.reconcile_market_stripe_refund_evidence(p_event_id text, p_account_id text, p_charge_id text, p_refund_id text)","48cbede15e2215a8efd5c7450e4c15a6"],["function","public.record_market_order_delivery_evidence_b07(p_order_id uuid, p_delivered_at timestamp with time zone, p_source text, p_reference text)","883ee986ee8660759aa9d72fb26eae01"],["function","public.record_market_tax_remuneration(p_contract_snapshot_id uuid, p_event_key text, p_occurred_at timestamp with time zone, p_gross_consideration numeric, p_platform_fee numeric, p_commission numeric, p_withheld_tax numeric, p_source_type text, p_source_reference text, p_evidence jsonb)","b769c22fb09b7eaeb2d1d5091801220e"],["function","public.register_market_stripe_test_account(p_onboarding_request_id uuid, p_seller_id uuid, p_account_id text)","7128c57c2e038109571e5f7e289f62d1"],["function","public.register_my_market_listing_image(p_listing_id uuid, p_storage_path text, p_sort_order smallint)","a3fce13bb2b41bf88cfb6574f3915db5"],["function","public.release_account_deletion_hold(p_hold_id uuid, p_reason text)","fe4b86544ca9c46ecc0c0b37442d3fe7"],["function","public.release_fixed_price_market_offer_v1(p_offer_id uuid, p_reason text)","bc2b14a254f89730835ea9143421d6e2"],["function","public.remove_my_market_listing_image(p_image_id uuid)","d8cd64768d80f830a34eb48685586d79"],["function","public.renew_my_market_listing(p_listing_id uuid)","3872af833379c4d1fa5b1d0a5a7a960d"],["function","public.request_market_order_cancellation(p_order_id uuid, p_reason text)","413c3b233f05fc59868a3e2ea076feec"],["function","public.request_market_order_delivery_review_b07(p_order_id uuid)","c365e408c35182150731b971d7d7f02f"],["function","public.request_my_account_deletion(p_confirmation text, p_request_key uuid)","1f507fc0b6b84bbf963823d054fd6436"],["function","public.respond_market_order_cancellation(p_case_id uuid, p_accept boolean, p_note text)","132b593edb4d8b212144a71bd1cf71d1"],["function","public.respond_market_order_problem(p_case_id uuid, p_note text)","70862bb261b69164bcf0a56afd68f50d"],["function","public.respond_market_swap_problem_v1(p_case_id uuid, p_note text)","102bc136bd58feb1e941c43f3face11a"],["function","public.respond_to_market_offer(p_offer_id uuid, p_action text)","9d2b1e6eb69195e20f7dc08b4ae40269"],["function","public.review_market_checkout(p_listing_id uuid, p_quantity integer)","d8c2429e35eb1b7437716e6ff99df179"],["function","public.review_market_offer_checkout_v1(p_offer_id uuid)","302dabc52ccb9ddc9ed31be1a1b9e205"],["function","public.review_market_order_delivery_b07(p_order_id uuid, p_decision text, p_delivered_at timestamp with time zone, p_reference text, p_note text)","0102fb815d981471fcff29152ed2dedf"],["function","public.review_market_price_offer_v1(p_listing_id uuid, p_requested_quantity integer, p_amount numeric)","a99e5f2b3102008a335bcfb5db1e3fc9"],["function","public.review_market_seller_onboarding(p_seller_id uuid, p_decision text, p_reason text)","4cf63fc0a872d2aa69790ef780191a31"],["function","public.review_marketplace_notice_appeal(p_appeal_id uuid, p_outcome text, p_reason text)","f3304f74af53e05dbe7689bca8a8bc5c"],["function","public.save_my_market_seller_legal_profile(p_legal_first_name text, p_legal_last_name text, p_date_of_birth date, p_street_line1 text, p_street_line2 text, p_postal_code text, p_city text, p_country_code text, p_tax_residence_country_code text, p_business_name text, p_legal_form text, p_representative_name text, p_public_email text, p_public_phone text, p_register_name text, p_register_number text, p_register_court text, p_vat_id_present boolean)","971d68bb02a5fef48290330f57e8a7f9"],["function","public.seed_market_order_default_shipping_address()","cd9751897b136d5b8c5669aec94472ff"],["function","public.send_market_pickup_message_v1(p_context_type text, p_context_id uuid, p_body text)","539a999a8d34b01ad78bab178319e51d"],["function","public.set_marketplace_seller_onboarding_enforcement(p_enabled boolean)","31f31f1e0f452f429a665c7d3cbebbb6"],["function","public.set_my_market_seller_type(p_seller_type text)","5016877879847444f8379f078b350e7e"],["function","public.submit_market_review(p_deal_id uuid, p_rating text, p_comment text)","eaaf8e953109919678c974fecf9edc82"],["function","public.submit_marketplace_listing_notice(p_listing_id uuid, p_category text, p_explanation text, p_alleged_legal_basis text, p_reporter_name text, p_reporter_email text, p_exact_url text, p_good_faith_confirmed boolean)","a2f578dd7bd8b6e68c7605324bee90a9"],["function","public.submit_marketplace_notice_appeal(p_case_reference text, p_access_code text, p_grounds text)","daef9f4f4dad356bb31da0400dbc1be3"],["function","public.submit_my_market_seller_onboarding(p_accept_seller_terms boolean, p_confirm_data_accuracy boolean, p_confirm_lawful_goods boolean)","847d227e45908c9b2eb6afe824d6526d"],["function","public.submit_my_marketplace_moderation_appeal(p_notice_id uuid, p_grounds text)","f8c8e8bc507d3be7cf1dd16c0d28f3fb"],["function","public.sync_market_order_address_to_default()","55c3ab7c7e2a5f3df2d663636d7b5699"],["function","public.upsert_my_market_order_shipping_address(p_order_id uuid, p_recipient_name text, p_street_line1 text, p_postal_code text, p_city text, p_country_code text, p_street_line2 text)","d664d9ddef8a7ff0445c7716abe7b646"],["function","public.upsert_my_market_shipping_address(p_deal_id uuid, p_recipient_name text, p_street_line1 text, p_postal_code text, p_city text, p_country_code text, p_street_line2 text)","70bbacc854718435bf0df288d57747d6"],["function","public.upsert_my_market_shipping_profile(p_profile_id uuid, p_name text, p_destination_country_code text, p_shipping_method text, p_carrier_label text, p_product_scope text, p_is_active boolean, p_rules jsonb)","66172a14f4f6c4651f4fd52977fbaacc"],["function","public.validate_market_shipping_profile_rule()","d98badaa1f289cdaaf582df09db73455"],["function","public.withdraw_market_order_cancellation(p_case_id uuid)","3779d6502dd69d215484f5d4bf85b50c"],["function","public.withdraw_market_order_problem(p_case_id uuid, p_note text)","5466e5849ef714a3ea4ba763258a5339"],["function","public.withdraw_market_swap_problem_v1(p_case_id uuid, p_note text)","3cb807509f952e47d34204fc811fb006"],["function","public.withdraw_my_market_offer(p_offer_id uuid)","617c035b226f234111278ca4c10ab61b"],["table","dv_market_private.account_data_rights_audit","8ffb9c134d99e764d958245f450524ed"],["table","dv_market_private.account_deletion_holds","4fa835dd710a2b4fbfddb15800beb23f"],["table","dv_market_private.account_deletion_requests","0efa2d342c72718f45e6ce698b2136ac"],["table","dv_market_private.data_retention_rules","dc5f606c50fb55e211ad89c4f5190623"],["table","dv_market_private.listing_notice_appeals","fa3c8bac662660053a808b09c4baa8a8"],["table","dv_market_private.listing_notice_events","a33c1655737c631be2f55d1de2061215"],["table","dv_market_private.listing_notices","7e56be867e2739e6fd9deb551b5f2ead"],["table","dv_market_private.market_contract_snapshots","7b802539997fa99337ec92963cef3501"],["table","dv_market_private.market_financial_documents","95101440bdcdc7d1a3042d08da065337"],["table","dv_market_private.market_invoice_authorizations","386d4851c5bc336e980644f5d92d394e"],["table","dv_market_private.market_payment_allocations","fbdffe150d1a7b3f70701aed3f81fed0"],["table","dv_market_private.market_payment_attempts","622ea7ccd166fe35bec0e311eeafaf89"],["table","dv_market_private.market_payment_configuration","b7bbaf3afc9dc3d005d83d6b2a83367f"],["table","dv_market_private.market_pickup_handovers","e24f21b24d6c61317d6ad77e18328a84"],["table","dv_market_private.market_pickup_messages","8c6950a5f72d78099e109154845f1dd8"],["table","dv_market_private.market_refund_requests","f951129af285199afeea4826d12fdbb2"],["table","dv_market_private.market_stripe_accounts","26435f86fedbf0fb02f53bca9c377d87"],["table","dv_market_private.market_stripe_events","b779333361c369d7bd775c08a5b77eb6"],["table","dv_market_private.market_stripe_onboarding_requests","ba1b909eb6619c718a641d0b835323f3"],["table","dv_market_private.market_swap_cases","0c9c7c470c94b1e6dbb50fedcfa2639e"],["table","dv_market_private.market_swap_confirmations","eab09357f03a5058319a88e9fc7edc26"],["table","dv_market_private.market_swap_fulfillments","a16adee4ca5fb733953749dd6cab0225"],["table","dv_market_private.market_swap_pickup_handovers","7e4af6fda7f7426745de1e9c8c817a8e"],["table","dv_market_private.market_swap_reservations","e3d6512e8767d357a504de8ef42fb35e"],["table","dv_market_private.market_swap_revision_items","843ead7d66905aa2982bb79101115c1b"],["table","dv_market_private.market_swap_revisions","245b5e7df63250513545e2289dc1c03a"],["table","dv_market_private.market_swap_shipping_addresses","cd67b3f8d11d9698b34c9f8104185333"],["table","dv_market_private.market_swap_threads","c7560b33e72e78676ef45dc28a8403b3"],["table","dv_market_private.market_swap_value_snapshots","7319b389eee9f9e4c25da2148fce6571"],["table","dv_market_private.market_tax_events","5afb92b3bd8ae82227be1ce1d73455bb"],["table","dv_market_private.market_tax_export_rows","af0ef17bf58dcb839869bbff750ab253"],["table","dv_market_private.market_tax_exports","d780aa05ea7fb8748e7e5a56b2b03f09"],["table","dv_market_private.market_withdrawal_drafts","b04194172e04c6dc98ad2268f2e8a535"],["table","dv_market_private.market_withdrawals","5e5363cdec0b3c6af4a91869a171d669"],["table","dv_market_private.marketplace_compliance_policy","213c4591522a7193504b949c9534aa87"],["table","dv_market_private.marketplace_message_delivery_events","7513b1a7adca2c9397723192085415fc"],["table","dv_market_private.marketplace_message_outbox","e7b0e879d33520695fb33cc93513c9bb"],["table","dv_market_private.seller_account_audit","6c952428a3f8b293537d772dfec36b84"],["table","dv_market_private.seller_declarations","b6c0f26a9f74e8b7759cc9c9fb8e8396"],["table","dv_market_private.seller_legal_profiles","ab240204aa14e07c50a8d958319b0b39"],["table","dv_market_private.seller_review_actions","9be412424a4549b94a6a464d986b39ab"],["table","dv_market_private.seller_tax_identifiers","d2535586d7803d1bf9655e1984388b39"],["table","dv_market_private.trade_user_eligibility","d2a13b3f3d4465ddcd5afdeba265a3a5"],["table","dv_market_private.user_data_export_events","0f955d883238dcecf95b5c79bc9ff507"],["table","public.market_deal_shipping_addresses","53f83d375af7bb8e5496665836cec0fb"],["table","public.market_deals","4247d807b9bdc6c618467a4a2ea0fbc2"],["table","public.market_default_shipping_addresses","612d98323a154637102173d6050f0bfa"],["table","public.market_listing_images","c0aec5ee1128187bc4a5db75b25616b0"],["table","public.market_listings","baf4da3b34b3de8241c2e5d6c2222701"],["table","public.market_notification_sync_state","a51ab791bbacede4f16efc5ce415fad6"],["table","public.market_notifications","472b821dc6d999819e29aeca156b3638"],["table","public.market_offers","4c405c34a7b350f00b7cc073a5be0342"],["table","public.market_order_cases","53697ff7fcd897597e207a0af97ae35b"],["table","public.market_order_items","3d06bbf6ad2e049f74110551aef17641"],["table","public.market_order_payments","48833a618cadf2d72fe416a813b9a64f"],["table","public.market_order_shipping_access_log","fb4adf539a3995952bdcb2c734016f4d"],["table","public.market_order_shipping_addresses","dc76e6bce741ff6460a83fbd9b3b6679"],["table","public.market_orders","1121e41ada8f98c1e651c0d4cf4d2a55"],["table","public.market_reviews","9d3b459e08587b4c0c3e3668873d83c0"],["table","public.market_seller_accounts","89fc0aa549cfe51443048cf80ea8104a"],["table","public.market_shipping_address_access_log","462d6e894b8e68464fabc3a3d64f3c43"],["table","public.market_shipping_profile_rules","cb6f8db5c1a5ad297d8e424016b88bc3"],["table","public.market_shipping_profiles","0ab87ddf77e4de52a2627a1d1f95b935"],["table","public.profiles","23b7a7425035327604210bce22af83f6"]]$catalog$::jsonb,false));
exception when others then
  return jsonb_build_object('revision','trade-legal-contract-model-v1.2','compatible',false);
end
$$;
revoke all on function public.get_market_legal_schema_readiness_v1() from public,anon;
grant execute on function public.get_market_legal_schema_readiness_v1() to authenticated;
