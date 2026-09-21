
-- DUELVANTA Legal contract model V1
-- Aligns marketplace contract formation with the individual attorney answers received 2026-09-21.
-- No Production/Stripe activation is performed by this migration.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

-- Buyer account classification: one account-level declaration, snapshotted per offer/contract.
create table if not exists dv_market_private.market_buyer_profiles (
  buyer_id uuid primary key references auth.users(id) on delete cascade,
  buyer_type text not null check (buyer_type in ('consumer','business')),
  declaration_version text not null default 'buyer-profile-v1',
  declared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table dv_market_private.market_buyer_profiles enable row level security;
revoke all on table dv_market_private.market_buyer_profiles from public, anon, authenticated;

create or replace function public.get_my_market_buyer_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,dv_market_private
as $$
declare v_uid uuid:=auth.uid();v_row dv_market_private.market_buyer_profiles%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_row from dv_market_private.market_buyer_profiles where buyer_id=v_uid;
  if not found then return jsonb_build_object('configured',false); end if;
  return jsonb_build_object(
    'configured',true,'buyer_type',v_row.buyer_type,
    'declaration_version',v_row.declaration_version,
    'declared_at',v_row.declared_at,'updated_at',v_row.updated_at
  );
end
$$;
revoke all on function public.get_my_market_buyer_profile() from public,anon;
grant execute on function public.get_my_market_buyer_profile() to authenticated;

create or replace function public.set_my_market_buyer_profile(p_buyer_type text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,dv_market_private
as $$
declare v_uid uuid:=auth.uid();v_row dv_market_private.market_buyer_profiles%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_buyer_type not in ('consumer','business') then raise exception 'buyer_type_invalid'; end if;
  insert into dv_market_private.market_buyer_profiles(buyer_id,buyer_type)
  values(v_uid,p_buyer_type)
  on conflict(buyer_id) do update
    set buyer_type=excluded.buyer_type,updated_at=now()
  returning * into v_row;
  return jsonb_build_object(
    'configured',true,'buyer_type',v_row.buyer_type,
    'declaration_version',v_row.declaration_version,
    'declared_at',v_row.declared_at,'updated_at',v_row.updated_at
  );
end
$$;
revoke all on function public.set_my_market_buyer_profile(text) from public,anon;
grant execute on function public.set_my_market_buyer_profile(text) to authenticated;

create or replace function dv_market_private.require_market_buyer_type(p_buyer_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,dv_market_private
as $$
declare v_type text;
begin
  select buyer_type into v_type
  from dv_market_private.market_buyer_profiles
  where buyer_id=p_buyer_id;
  if v_type is null then raise exception 'buyer_profile_required'; end if;
  return v_type;
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
    when p_seller_type='trader' and p_buyer_type='business' then 'b2b'
    when p_seller_type='private' and p_buyer_type='consumer' then 'c2c'
    when p_seller_type='private' and p_buyer_type='business' then 'c2b'
    else null
  end
$$;
revoke all on function dv_market_private.market_contract_classification(text,text) from public,anon,authenticated;

-- Offer snapshots now freeze the buyer account purpose for the specific transaction.
alter table public.market_offers add column if not exists buyer_type_snapshot text;
alter table public.market_offers add column if not exists checkout_request_id uuid;
alter table public.market_offers add column if not exists checkout_hash_snapshot text;
alter table public.market_offers add column if not exists payment_attempt_id uuid;
alter table public.market_offers add column if not exists payment_requested_at timestamptz;
alter table public.market_offers add column if not exists stripe_checkout_session_id text;

alter table public.market_offers drop constraint if exists market_offers_buyer_type_snapshot_check;
alter table public.market_offers add constraint market_offers_buyer_type_snapshot_check
  check (buyer_type_snapshot is null or buyer_type_snapshot in ('consumer','business'));
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

-- Contract snapshots keep the buyer purpose and exact classification.
alter table dv_market_private.market_contract_snapshots add column if not exists buyer_type text;
alter table dv_market_private.market_contract_snapshots add column if not exists withdrawal_eligible boolean not null default false;
alter table dv_market_private.market_contract_snapshots drop constraint if exists market_contract_snapshots_buyer_type_check;
alter table dv_market_private.market_contract_snapshots add constraint market_contract_snapshots_buyer_type_check
  check (buyer_type is null or buyer_type in ('consumer','business'));
alter table dv_market_private.market_contract_snapshots drop constraint if exists market_contract_snapshots_contract_classification_check;
alter table dv_market_private.market_contract_snapshots add constraint market_contract_snapshots_contract_classification_check
  check (contract_classification in ('c2c','c2b','b2c','b2b'));
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
    'shipping_method',v_listing.shipping_method,'shipping_cost',v_shipping,
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
create or replace function public.create_market_offer_v2(
  p_listing_id uuid,p_requested_quantity integer,p_amount numeric,p_message text default null
) returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare l public.market_listings;v_id uuid;v_list_unit numeric;t jsonb;v_buyer_type text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_buyer_type:=dv_market_private.require_market_buyer_type(auth.uid());
  select * into l from public.market_listings where id=p_listing_id and status='active' for update;
  if l.id is null or l.seller_id=auth.uid() then raise exception 'Angebot nicht möglich'; end if;
  if l.pricing_mode='fixed' then raise exception 'Dieses Produkt wird zum Festpreis angeboten'; end if;
  if p_requested_quantity is null or p_requested_quantity not between 1 and 1000 then raise exception 'Ungültige Menge'; end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
  if (l.product_kind='sealed' and (p_requested_quantity<l.minimum_purchase_quantity or p_requested_quantity>l.quantity_available))
     or (l.product_kind<>'sealed' and p_requested_quantity<>1) then raise exception 'Gewünschte Menge ist nicht verfügbar'; end if;
  if p_amount::text in ('NaN','Infinity','-Infinity') or coalesce(round(p_amount,2),0)<=0 then raise exception 'Ungültige Angebotssumme'; end if;
  v_list_unit:=l.asking_price;
  if l.product_kind='sealed' then
    for t in select value from jsonb_array_elements(coalesce(l.quantity_pricing,'[]'::jsonb)) order by (value->>'min_quantity')::int loop
      if p_requested_quantity >= (t->>'min_quantity')::int then v_list_unit:=(t->>'unit_price')::numeric; end if;
    end loop;
  end if;
  insert into public.market_offers(
    listing_id,buyer_id,seller_id,offer_type,amount,currency,message,requested_quantity,
    unit_price_snapshot,listed_unit_price_snapshot,listed_total_snapshot,buyer_type_snapshot
  ) values(
    l.id,auth.uid(),l.seller_id,'price',round(p_amount,2),'EUR',
    nullif(left(trim(coalesce(p_message,'')),500),''),p_requested_quantity,
    round(p_amount/p_requested_quantity,2),round(v_list_unit,2),round(v_list_unit*p_requested_quantity,2),v_buyer_type
  ) returning id into v_id;
  update public.market_offers set listing_snapshot=jsonb_build_object(
    'card_name',l.card_name,'product_kind',l.product_kind,'sealed_category',l.sealed_category,
    'language',l.language,'set_name',l.set_name,'base_unit_price',l.asking_price,
    'shipping_method',l.shipping_method,'shipping_cost',l.shipping_cost
  ) where id=v_id;
  return v_id;
end
$$;

-- Negotiated price: seller acceptance is now the contract-forming event.
create or replace function public.respond_to_market_offer(p_offer_id uuid,p_action text)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare o public.market_offers;l public.market_listings;v_qty integer;v_left integer;v_deal_id uuid;
begin
  if auth.uid() is null or p_action not in ('accepted','declined') then raise exception 'Nicht erlaubt'; end if;
  perform public.expire_market_offer_reservations_v1();
  select * into o from public.market_offers where id=p_offer_id;
  if o.id is null or o.seller_id<>auth.uid() or o.offer_type<>'price' then raise exception 'Angebot nicht verfügbar'; end if;
  select * into l from public.market_listings where id=o.listing_id for update;
  select * into o from public.market_offers where id=p_offer_id for update;
  if o.status=p_action then return; end if;
  if o.status='accepted' and exists(select 1 from public.market_deals d where d.offer_id=o.id) then return; end if;
  if o.status<>'pending' then raise exception 'Angebot ist nicht verfügbar'; end if;
  if p_action='declined' then
    update public.market_offers set status='declined',responded_at=now(),updated_at=now() where id=o.id;
    return;
  end if;
  if l.active_until is not null and l.active_until<=now() then raise exception 'Angebot abgelaufen'; end if;
  if l.pricing_mode='fixed' then raise exception 'Dieses Listing wird inzwischen zum Festpreis angeboten'; end if;
  if l.status<>'active' or l.seller_id<>auth.uid() then raise exception 'Listing ist nicht aktiv'; end if;
  if o.buyer_type_snapshot not in ('consumer','business') then raise exception 'buyer_profile_required'; end if;
  v_qty:=case when l.product_kind='sealed' then coalesce(o.requested_quantity,1) else 1 end;
  if v_qty<1 or v_qty>l.quantity_available then raise exception 'Menge nicht mehr verfügbar'; end if;
  v_left:=l.quantity_available-v_qty;

  update public.market_offers
  set status='accepted',responded_at=now(),reserved_quantity=null,reservation_expires_at=null,updated_at=now()
  where id=o.id;

  update public.market_offers
  set status='declined',responded_at=now(),updated_at=now()
  where listing_id=o.listing_id and id<>o.id and offer_type='price' and status='pending'
    and requested_quantity>v_left;

  update public.market_listings
  set quantity_available=v_left,status=case when v_left=0 then 'reserved' else 'active' end,
      accepted_offer_id=o.id,deal_price=o.amount,deal_buyer_id=o.buyer_id,updated_at=now()
  where id=l.id;

  insert into public.market_deals(
    listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,
    shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,
    package_contents,weight_grams,length_mm,width_mm,height_mm
  ) values(
    l.id,o.id,o.seller_id,o.buyer_id,round(o.amount,2),'EUR','accepted',now(),
    l.shipping_method,l.shipping_cost,l.shipping_note,l.product_kind,l.sealed_category,v_qty,
    l.package_contents,case when l.weight_grams is null then null else l.weight_grams*v_qty end,
    l.length_mm,l.width_mm,l.height_mm
  ) returning id into v_deal_id;

  if v_deal_id is null then raise exception 'offer_contract_creation_failed'; end if;
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
    order by o.reservation_expires_at,o.id
  loop
    select listing_id into v_listing_id from public.market_offers where id=v_offer_id;
    if v_listing_id is null then continue; end if;
    select * into v_listing from public.market_listings where id=v_listing_id for update;
    select * into v_offer from public.market_offers where id=v_offer_id for update;
    if not found or v_offer.reservation_expires_at is null or v_offer.reservation_expires_at>now()
       or exists(select 1 from public.market_deals d where d.offer_id=v_offer.id) then continue; end if;
    v_restore:=greatest(coalesce(v_offer.reserved_quantity,v_offer.requested_quantity,1),1);
    update public.market_offers set status='expired',reserved_quantity=0,reservation_expires_at=null,updated_at=now()
    where id=v_offer.id;
    if v_listing.id is not null then
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
  select card_name into v_title from public.market_listings where id=new.listing_id;
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
  v_seller:=dv_market_private.market_checkout_seller_party(new.seller_id);
  if new.offer_id is not null then select * into v_offer from public.market_offers where id=new.offer_id; end if;
  v_buyer_type:=coalesce(v_offer.buyer_type_snapshot,dv_market_private.require_market_buyer_type(new.buyer_id));
  v_type:=dv_market_private.market_contract_classification(v_seller->>'seller_type',v_buyer_type);
  if v_type is null then raise exception 'contract_classification_invalid'; end if;
  v_product:=dv_market_private.market_checkout_product_snapshot(v_listing);
  v_shipping_label:=case new.shipping_method
    when 'standard_letter' then 'Standardbrief' when 'tracked_letter' then 'Brief mit Tracking'
    when 'parcel' then 'Paket mit Tracking' when 'pickup' then 'Abholung' else 'Individuell / nach Absprache' end;
  v_unit:=round(v_goods/v_qty,2);v_shipping:=round(new.shipping_cost,2);v_total:=round(v_goods+v_shipping,2);
  v_payment_text:=case when new.payment_provider='stripe_connect'
    then 'Stripe Connect – Vertragsschluss mit Erstellung der automatischen Zahlungsaufforderung.'
    else 'Zahlung nach Vertragsschluss; in der Beta keine integrierte Onlinezahlung oder Auszahlung.' end;
  v_text:=format(
    E'DUELVANTA BESTELLBESTÄTIGUNG\\nDokumentversion: checkout-contract-v2\\nOrder: %s\\nVertragsschluss: %s\\nVertragstyp: %s\\nKäuferprofil: %s\\nVerkäuferrolle: %s\\nVertragspartner: %s\\nAnschrift: %s, %s %s, %s\\nProdukt: %s\\nMenge: %s\\nStückpreis: %s EUR\\nWarenwert: %s EUR\\nVersand (%s): %s EUR\\nGesamtpreis: %s EUR\\nZahlungsabwicklung: %s\\nPlattformrolle: Benjamin Fritz – DUELVANTA vermittelt den Vertrag; DUELVANTA ist nicht Verkäufer der Ware.',
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
set search_path=pg_catalog,public,dv_market_private
as $$
declare
  v_uid uuid:=auth.uid();v_existing public.market_offers%rowtype;v_listing public.market_listings%rowtype;
  v_review jsonb;v_config dv_market_private.market_payment_configuration%rowtype;v_account dv_market_private.market_stripe_accounts%rowtype;
  v_buyer_type text;v_qty integer;v_left integer;v_total_cents integer;v_fee_cents integer;v_attempt uuid:=gen_random_uuid();
  v_offer uuid;v_deal public.market_deals;v_attempt_row dv_market_private.market_payment_attempts%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_request_id is null or p_expected_updated_at is null then raise exception 'fixed_checkout_request_invalid'; end if;
  perform public.expire_market_offer_reservations_v1();
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,45));

  select * into v_existing from public.market_offers
  where buyer_id=v_uid and offer_type='fixed_price' and checkout_request_id=p_request_id;
  if found then
    if v_existing.listing_id<>p_listing_id or v_existing.requested_quantity<>p_quantity then raise exception 'fixed_checkout_request_reused'; end if;
    if v_existing.status='accepted' then
      select * into v_deal from public.market_deals where offer_id=v_existing.id;
      select * into v_attempt_row from dv_market_private.market_payment_attempts where id=v_existing.payment_attempt_id;
      if v_deal.id is null or v_attempt_row.id is null then raise exception 'fixed_checkout_acceptance_incomplete'; end if;
      return jsonb_build_object(
        'replayed',true,'accepted',true,'offer_id',v_existing.id,'payment_attempt_id',v_existing.payment_attempt_id,
        'stripe_checkout_session_id',v_existing.stripe_checkout_session_id,'stripe_account_id',v_attempt_row.stripe_account_id,
        'order_id',v_deal.order_id,'live_mode',p_live_mode
      );
    end if;
    if v_existing.status='pending' and v_existing.reservation_expires_at>now() then
      select * into v_config from dv_market_private.market_payment_configuration where singleton;
      select * into v_account from dv_market_private.market_stripe_accounts where seller_id=v_existing.seller_id;
      v_total_cents:=round((coalesce(v_existing.amount,0)+coalesce((v_existing.listing_snapshot->>'shipping_cost')::numeric,0))*100)::integer;
      v_fee_cents:=least(v_total_cents,round(v_total_cents*v_config.platform_fee_bps/10000.0)::integer+v_config.platform_fee_fixed_cents);
      return jsonb_build_object(
        'replayed',true,'accepted',false,'offer_id',v_existing.id,'payment_attempt_id',v_existing.payment_attempt_id,
        'stripe_account_id',v_account.stripe_account_id,'amount_due_cents',v_total_cents,'platform_fee_cents',v_fee_cents,
        'live_mode',p_live_mode
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
  if lower(trim(coalesce(p_checkout_hash,'')))<>(v_review->>'checkout_hash') then raise exception 'checkout_review_changed'; end if;
  if (v_review->>'listing_updated_at')::timestamptz is distinct from p_expected_updated_at then raise exception 'checkout_review_changed'; end if;
  v_buyer_type:=v_review->>'buyer_type';

  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' or v_listing.updated_at is distinct from p_expected_updated_at then raise exception 'listing_not_available'; end if;
  v_qty:=case when v_listing.product_kind='sealed' then p_quantity else 1 end;
  if v_qty<1 or v_qty>v_listing.quantity_available then raise exception 'checkout_quantity_unavailable'; end if;
  select * into v_account from dv_market_private.market_stripe_accounts where seller_id=v_listing.seller_id;
  if not found or v_account.live_mode is distinct from p_live_mode or v_account.onboarding_status<>'ready' or not v_account.charges_enabled then
    raise exception 'stripe_seller_not_ready';
  end if;

  v_left:=v_listing.quantity_available-v_qty;
  update public.market_listings
  set quantity_available=v_left,status=case when v_left=0 then 'reserved' else 'active' end,updated_at=now()
  where id=v_listing.id;

  insert into public.market_offers(
    listing_id,buyer_id,seller_id,offer_type,amount,currency,status,requested_quantity,
    unit_price_snapshot,listed_unit_price_snapshot,listed_total_snapshot,listing_snapshot,
    reserved_quantity,reservation_expires_at,buyer_type_snapshot,checkout_request_id,checkout_hash_snapshot,payment_attempt_id
  ) values(
    v_listing.id,v_uid,v_listing.seller_id,'fixed_price',(v_review->>'goods_total')::numeric,'EUR','pending',v_qty,
    (v_review->>'unit_price')::numeric,(v_review->>'unit_price')::numeric,(v_review->>'goods_total')::numeric,
    jsonb_build_object(
      'card_name',v_review->'product'->>'title','product_kind',v_listing.product_kind,'sealed_category',v_listing.sealed_category,
      'language',v_listing.language,'set_name',v_listing.set_name,'base_unit_price',(v_review->>'unit_price')::numeric,
      'shipping_method',v_listing.shipping_method,'shipping_cost',(v_review->>'shipping_cost')::numeric,
      'total_price',(v_review->>'total_price')::numeric
    ),
    v_qty,now()+interval '15 minutes',v_buyer_type,p_request_id,lower(p_checkout_hash),v_attempt
  ) returning id into v_offer;

  v_total_cents:=round((v_review->>'total_price')::numeric*100)::integer;
  v_fee_cents:=least(v_total_cents,round(v_total_cents*v_config.platform_fee_bps/10000.0)::integer+v_config.platform_fee_fixed_cents);
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
declare o public.market_offers;l public.market_listings;v_restore integer;
begin
  select * into o from public.market_offers where id=p_offer_id for update;
  if not found or o.offer_type<>'fixed_price' then return false; end if;
  if o.status<>'pending' then return false; end if;
  select * into l from public.market_listings where id=o.listing_id for update;
  v_restore:=greatest(coalesce(o.reserved_quantity,o.requested_quantity,1),1);
  update public.market_offers
  set status='expired',message=left(coalesce(p_reason,'payment_request_failed'),500),
      reserved_quantity=0,reservation_expires_at=null,updated_at=now()
  where id=o.id;
  if l.id is not null then
    update public.market_listings
    set quantity_available=least(stock_quantity,quantity_available+v_restore),
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
set search_path=pg_catalog,public,dv_market_private
as $$
declare
  o public.market_offers;l public.market_listings;d public.market_deals;s dv_market_private.market_stripe_accounts%rowtype;
  c dv_market_private.market_payment_configuration%rowtype;snap dv_market_private.market_contract_snapshots%rowtype;
  v_total integer;v_fee integer;v_prefix text:=case when p_live_mode then 'cs_live_' else 'cs_test_' end;
begin
  if p_offer_id is null or p_attempt_id is null or p_payment_requested_at is null then raise exception 'fixed_acceptance_invalid'; end if;
  if p_session_id is null or position(v_prefix in p_session_id)<>1 then raise exception 'stripe_session_invalid'; end if;
  if p_payment_requested_at<now()-interval '15 minutes' or p_payment_requested_at>now()+interval '2 minutes' then raise exception 'payment_request_timestamp_invalid'; end if;
  select * into o from public.market_offers where id=p_offer_id for update;
  if not found or o.offer_type<>'fixed_price' or o.payment_attempt_id<>p_attempt_id then raise exception 'fixed_offer_not_found'; end if;
  if o.status='accepted' then
    select * into d from public.market_deals where offer_id=o.id;
    select * into snap from dv_market_private.market_contract_snapshots where deal_id=d.id;
    if d.id is null or snap.id is null or o.stripe_checkout_session_id<>p_session_id then raise exception 'fixed_acceptance_conflict'; end if;
    return jsonb_build_object('replayed',true,'deal_id',d.id,'order_id',d.order_id,'contract_snapshot_id',snap.id,'contract_classification',snap.contract_classification);
  end if;
  if o.status<>'pending' or o.reservation_expires_at is null or o.reservation_expires_at<=now() then raise exception 'fixed_offer_expired'; end if;
  select * into l from public.market_listings where id=o.listing_id for update;
  if not found then raise exception 'listing_not_available'; end if;
  select * into s from dv_market_private.market_stripe_accounts where seller_id=o.seller_id;
  if not found or s.live_mode is distinct from p_live_mode or s.onboarding_status<>'ready' or not s.charges_enabled then raise exception 'stripe_seller_not_ready'; end if;
  select * into c from dv_market_private.market_payment_configuration where singleton;
  if p_live_mode then
    if not c.live_mode then raise exception 'stripe_live_database_disabled'; end if;
  else
    if c.live_mode or not c.sandbox_enabled then raise exception 'stripe_sandbox_disabled'; end if;
  end if;

  perform set_config('dv_market.offer_checkout_authorized',o.id::text,true);
  update public.market_offers
  set status='accepted',responded_at=p_payment_requested_at,payment_requested_at=p_payment_requested_at,
      stripe_checkout_session_id=p_session_id,reservation_expires_at=null,updated_at=now()
  where id=o.id;

  insert into public.market_deals(
    listing_id,offer_id,seller_id,buyer_id,amount,currency,status,accepted_at,
    shipping_method,shipping_cost,shipping_note,product_kind,sealed_category,item_quantity,
    package_contents,weight_grams,length_mm,width_mm,height_mm,checkout_request_id,
    payment_provider,payment_status
  ) values(
    l.id,o.id,o.seller_id,o.buyer_id,round(o.amount,2),'EUR','accepted',p_payment_requested_at,
    l.shipping_method,l.shipping_cost,l.shipping_note,l.product_kind,l.sealed_category,greatest(coalesce(o.requested_quantity,1),1),
    l.package_contents,case when l.weight_grams is null then null else l.weight_grams*greatest(coalesce(o.requested_quantity,1),1) end,
    l.length_mm,l.width_mm,l.height_mm,o.checkout_request_id,'stripe_connect','pending'
  ) returning * into d;

  -- AFTER INSERT order attachment updates market_deals.order_id; reload the post-trigger row before payment evidence.
  select * into d from public.market_deals where id=d.id;
  if d.order_id is null then raise exception 'fixed_order_attachment_missing'; end if;

  select * into snap from dv_market_private.market_contract_snapshots where deal_id=d.id;
  if not found then raise exception 'checkout_snapshot_missing'; end if;
  v_total:=round(snap.total_price*100)::integer;
  v_fee:=least(v_total,round(v_total*c.platform_fee_bps/10000.0)::integer+c.platform_fee_fixed_cents);

  insert into dv_market_private.market_payment_attempts(
    id,order_id,buyer_id,seller_id,stripe_account_id,idempotency_key,state,currency,
    amount_due_cents,platform_fee_cents,stripe_checkout_session_id,prepared_at,updated_at
  ) values(
    p_attempt_id,d.order_id,o.buyer_id,o.seller_id,s.stripe_account_id,o.checkout_request_id,'session_created','EUR',
    v_total,v_fee,p_session_id,p_payment_requested_at,now()
  );

  insert into dv_market_private.market_payment_allocations(attempt_id,contract_snapshot_id,gross_cents,platform_fee_cents)
  values(p_attempt_id,snap.id,v_total,v_fee);

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

-- Electronic withdrawal function (§ 356a BGB): separate declaration/evidence, no automatic cancellation/refund.
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
  content_sha256 bytea not null
);
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
    'seller_id',s.seller_id,'seller_name',coalesce(s.seller_party->>'business_name',s.seller_party->>'legal_name'),
    'product_title',s.product_snapshot->>'title','contract_formed_at',s.contract_formed_at,
    'total_price',s.total_price,'currency',s.currency,
    'already_submitted',exists(select 1 from dv_market_private.market_withdrawals w where w.contract_snapshot_id=s.id and w.buyer_id=v_uid)
  ) order by s.contract_formed_at desc,s.id),'[]'::jsonb) into v_result
  from dv_market_private.market_contract_snapshots s
  where s.buyer_id=v_uid and s.contract_classification='b2c' and s.withdrawal_eligible;
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
declare v_uid uuid:=auth.uid();s dv_market_private.market_contract_snapshots%rowtype;v_id uuid;
  v_name text:=trim(coalesce(p_consumer_name,''));v_email text:=lower(trim(coalesce(p_confirmation_email,'')));
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if char_length(v_name) not between 2 and 160 then raise exception 'withdrawal_name_invalid'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'withdrawal_email_invalid'; end if;
  delete from dv_market_private.market_withdrawal_drafts where buyer_id=v_uid and expires_at<=now();
  select * into s from dv_market_private.market_contract_snapshots
  where id=p_contract_snapshot_id and buyer_id=v_uid and contract_classification='b2c' and withdrawal_eligible;
  if not found then raise exception 'withdrawal_contract_not_eligible'; end if;
  insert into dv_market_private.market_withdrawal_drafts(
    contract_snapshot_id,buyer_id,seller_id,consumer_name,confirmation_email
  ) values(s.id,v_uid,s.seller_id,v_name,v_email) returning id into v_id;
  return jsonb_build_object(
    'draft_id',v_id,'contract_snapshot_id',s.id,'order_id',s.order_id,
    'consumer_name',v_name,'confirmation_email',v_email,
    'seller_name',coalesce(s.seller_party->>'business_name',s.seller_party->>'legal_name'),
    'product_title',s.product_snapshot->>'title','expires_at',now()+interval '15 minutes'
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
  v_text text;v_submitted timestamptz:=now();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into w from dv_market_private.market_withdrawals where draft_id=p_draft_id;
  if found then
    if w.buyer_id<>v_uid then raise exception 'withdrawal_access_denied'; end if;
    return jsonb_build_object('replayed',true,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
      'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email);
  end if;
  select * into d from dv_market_private.market_withdrawal_drafts where id=p_draft_id and buyer_id=v_uid for update;
  if not found or d.expires_at<=now() then raise exception 'withdrawal_draft_expired'; end if;
  select * into s from dv_market_private.market_contract_snapshots
  where id=d.contract_snapshot_id and buyer_id=v_uid and contract_classification='b2c' and withdrawal_eligible;
  if not found then raise exception 'withdrawal_contract_not_eligible'; end if;
  v_text:=format(
    E'Widerrufserklärung\\nName: %s\\nVertrag: %s\\nOrder: %s\\nProdukt: %s\\nErklärung: Hiermit widerrufe ich den oben bezeichneten Vertrag.\\nEingang: %s',
    d.consumer_name,s.id,s.order_id,coalesce(s.product_snapshot->>'title','DUELVANTA Produkt'),
    to_char(v_submitted at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
  insert into dv_market_private.market_withdrawals(
    draft_id,contract_snapshot_id,order_id,deal_id,buyer_id,seller_id,consumer_name,
    confirmation_email,declaration_text,submitted_at,content_sha256
  ) values(
    d.id,s.id,s.order_id,s.deal_id,v_uid,s.seller_id,d.consumer_name,d.confirmation_email,
    v_text,v_submitted,digest(convert_to(v_text,'UTF8'),'sha256')
  ) returning * into w;

  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,recipient_email,message_kind,payload,dedupe_key
  ) values(
    s.id,'buyer',v_uid,d.confirmation_email,'withdrawal_receipt',
    jsonb_build_object('withdrawal_id',w.id,'contract_snapshot_id',s.id,'order_id',s.order_id,
      'product_title',s.product_snapshot->>'title','consumer_name',d.consumer_name,
      'submitted_at',v_submitted,'declaration_text',v_text),
    'withdrawal_receipt:'||w.id::text
  ) on conflict(dedupe_key) do nothing;

  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,recipient_email,message_kind,payload,dedupe_key
  ) values(
    s.id,'seller',s.seller_id,s.seller_party->>'public_email','withdrawal_notice',
    jsonb_build_object('withdrawal_id',w.id,'contract_snapshot_id',s.id,'order_id',s.order_id,
      'product_title',s.product_snapshot->>'title','consumer_name',d.consumer_name,
      'submitted_at',v_submitted,'declaration_text',v_text),
    'withdrawal_notice:'||w.id::text
  ) on conflict(dedupe_key) do nothing;

  delete from dv_market_private.market_withdrawal_drafts where id=d.id;
  return jsonb_build_object('replayed',false,'withdrawal_id',w.id,'submitted_at',w.submitted_at,
    'contract_snapshot_id',w.contract_snapshot_id,'confirmation_email',w.confirmation_email,
    'receipt_sha256',encode(w.content_sha256,'hex'));
end
$$;
revoke all on function public.confirm_market_withdrawal_v1(uuid) from public,anon;
grant execute on function public.confirm_market_withdrawal_v1(uuid) to authenticated;

-- Account erasure may drop the current buyer profile; contract snapshots keep transaction-time classification.
create or replace function dv_market_private.delete_market_buyer_profile_for_erasure(p_uid uuid)
returns void language sql security definer set search_path=pg_catalog,dv_market_private as $$
  delete from dv_market_private.market_buyer_profiles where buyer_id=p_uid
$$;
revoke all on function dv_market_private.delete_market_buyer_profile_for_erasure(uuid) from public,anon,authenticated;
grant execute on function dv_market_private.delete_market_buyer_profile_for_erasure(uuid) to service_role;
