-- DUELVANTA Marketplace checkout compliance V1.
-- REVIEW ONLY: apply after market-seller-compliance-v1.sql,
-- market-notice-action-v1.sql and trade-checkout-v1-hardening.sql.
-- No existing deal/order is backfilled or rewritten.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.market_contract_snapshots (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.market_deals(id) on delete restrict,
  order_id uuid not null references public.market_orders(id) on delete restrict,
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  offer_id uuid references public.market_offers(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_type text not null check (seller_type in ('private','trader')),
  contract_classification text not null check (contract_classification in ('c2c','b2c')),
  seller_party jsonb not null,
  platform_operator jsonb not null,
  product_snapshot jsonb not null,
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(12,2) not null check (unit_price > 0),
  goods_total numeric(12,2) not null check (goods_total > 0),
  shipping_method text not null,
  shipping_cost numeric(12,2) not null check (shipping_cost between 0 and 500),
  total_price numeric(12,2) not null check (total_price > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_provider text not null default 'manual_beta' check (payment_provider = 'manual_beta'),
  contract_formed_at timestamptz not null,
  snapshot_version text not null default 'checkout-contract-v1',
  confirmation_format text not null default 'text/plain; charset=utf-8',
  confirmation_text text not null,
  content_sha256 bytea not null,
  created_at timestamptz not null default now(),
  check (round(goods_total + shipping_cost, 2) = total_price)
);

comment on table dv_market_private.market_contract_snapshots is
  'Immutable contract evidence per accepted deal. Combined Shipping changes never rewrite this original checkout record.';

create index if not exists market_contract_snapshots_order_idx
  on dv_market_private.market_contract_snapshots(order_id, contract_formed_at, id);
create index if not exists market_contract_snapshots_buyer_idx
  on dv_market_private.market_contract_snapshots(buyer_id, contract_formed_at desc);
create index if not exists market_contract_snapshots_seller_idx
  on dv_market_private.market_contract_snapshots(seller_id, contract_formed_at desc);

revoke all on table dv_market_private.market_contract_snapshots from public, anon, authenticated;
alter table dv_market_private.market_contract_snapshots enable row level security;

create or replace function dv_market_private.block_market_contract_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'market_contract_snapshot_is_immutable';
end
$$;

revoke all on function dv_market_private.block_market_contract_snapshot_mutation() from public, anon, authenticated;
drop trigger if exists market_contract_snapshots_immutable on dv_market_private.market_contract_snapshots;
create trigger market_contract_snapshots_immutable
before update or delete on dv_market_private.market_contract_snapshots
for each row execute function dv_market_private.block_market_contract_snapshot_mutation();

create or replace function dv_market_private.market_checkout_seller_party(p_seller_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_account public.market_seller_accounts%rowtype;
  v_legal dv_market_private.seller_legal_profiles%rowtype;
begin
  select * into v_account
  from public.market_seller_accounts
  where seller_id=p_seller_id
    and onboarding_status='active'
    and seller_type in ('private','trader');
  if not found then raise exception 'seller_checkout_not_ready'; end if;

  select * into v_legal
  from dv_market_private.seller_legal_profiles
  where seller_id=p_seller_id;
  if not found
     or nullif(trim(concat_ws(' ',v_legal.legal_first_name,v_legal.legal_last_name)),'') is null
     or nullif(trim(v_legal.street_line1),'') is null
     or nullif(trim(v_legal.postal_code),'') is null
     or nullif(trim(v_legal.city),'') is null
     or nullif(trim(v_legal.country_code),'') is null then
    raise exception 'seller_contract_party_incomplete';
  end if;
  if v_account.seller_type='trader'
     and (nullif(trim(v_legal.business_name),'') is null or nullif(trim(v_legal.public_email),'') is null) then
    raise exception 'trader_contract_party_incomplete';
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'seller_id',v_account.seller_id,
    'seller_type',v_account.seller_type,
    'role_label',case when v_account.seller_type='trader' then 'Gewerblicher Verkäufer' else 'Privater Verkäufer' end,
    'legal_name',trim(concat_ws(' ',v_legal.legal_first_name,v_legal.legal_last_name)),
    'business_name',case when v_account.seller_type='trader' then v_legal.business_name else null end,
    'legal_form',case when v_account.seller_type='trader' then v_legal.legal_form else null end,
    'representative_name',case when v_account.seller_type='trader' then v_legal.representative_name else null end,
    'street_line1',v_legal.street_line1,'street_line2',v_legal.street_line2,
    'postal_code',v_legal.postal_code,'city',v_legal.city,'country_code',v_legal.country_code,
    'public_email',case when v_account.seller_type='trader' then v_legal.public_email else null end,
    'public_phone',case when v_account.seller_type='trader' then v_legal.public_phone else null end,
    'register_name',case when v_account.seller_type='trader' then v_legal.register_name else null end,
    'register_number',case when v_account.seller_type='trader' then v_legal.register_number else null end,
    'register_court',case when v_account.seller_type='trader' then v_legal.register_court else null end,
    'seller_terms_version',v_account.terms_version,
    'seller_verified_at',v_account.verified_at,
    'classification_updated_at',v_account.updated_at,
    'legal_profile_updated_at',v_legal.updated_at
  ));
end
$$;

revoke all on function dv_market_private.market_checkout_seller_party(uuid) from public, anon, authenticated;

create or replace function dv_market_private.market_checkout_product_snapshot(p_listing public.market_listings)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'listing_id',p_listing.id,'product_kind',p_listing.product_kind,'tcg',p_listing.tcg,
    'title',p_listing.card_name,'set_name',p_listing.set_name,'card_number',p_listing.card_number,
    'language',p_listing.language,'variant',p_listing.variant,'condition',p_listing.condition,
    'grading_company',p_listing.grading_company,'grade',p_listing.grade,
    'sealed_category',p_listing.sealed_category,'sealed_condition',p_listing.sealed_condition,
    'package_contents',p_listing.package_contents,'units_per_container',p_listing.units_per_container,
    'seller_note',p_listing.seller_note,'listing_updated_at',p_listing.updated_at
  ))
$$;

revoke all on function dv_market_private.market_checkout_product_snapshot(public.market_listings) from public, anon, authenticated;

create or replace function public.review_market_checkout(p_listing_id uuid,p_quantity integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_uid uuid:=auth.uid();
  v_listing public.market_listings%rowtype;
  v_seller jsonb;
  v_product jsonb;
  v_unit numeric;
  v_goods numeric;
  v_shipping numeric;
  v_review jsonb;
  v_tier jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_quantity is null or p_quantity not between 1 and 1000 then raise exception 'checkout_quantity_invalid'; end if;
  select * into v_listing from public.market_listings where id=p_listing_id;
  if not found or v_listing.status<>'active' then raise exception 'listing_not_available'; end if;
  if v_listing.seller_id=v_uid then raise exception 'own_listing_checkout_forbidden'; end if;
  if v_listing.listing_type not in ('sale','sale_or_trade') or v_listing.pricing_mode<>'fixed' then
    raise exception 'fixed_price_checkout_required';
  end if;
  if v_listing.active_until is not null and v_listing.active_until<=now() then raise exception 'listing_expired'; end if;
  if (v_listing.product_kind='sealed' and (p_quantity<v_listing.minimum_purchase_quantity or p_quantity>v_listing.quantity_available))
     or (v_listing.product_kind<>'sealed' and (p_quantity<>1 or v_listing.quantity_available<1)) then
    raise exception 'checkout_quantity_unavailable';
  end if;
  if v_listing.asking_price is null or v_listing.asking_price<=0
     or v_listing.asking_price::text in ('NaN','Infinity','-Infinity') then raise exception 'checkout_price_invalid'; end if;
  if v_listing.shipping_cost is null or v_listing.shipping_cost<0 or v_listing.shipping_cost>500
     or v_listing.shipping_method is null then raise exception 'checkout_shipping_incomplete'; end if;

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

  v_review:=jsonb_build_object(
    'snapshot_version','checkout-contract-v1','listing_id',v_listing.id,'listing_updated_at',v_listing.updated_at,
    'seller_id',v_listing.seller_id,'seller_type',v_seller->>'seller_type',
    'contract_classification',case when v_seller->>'seller_type'='trader' then 'b2c' else 'c2c' end,
    'seller_party',v_seller,
    'platform_operator',jsonb_build_object(
      'role','Marketplace-Vermittler','name','Benjamin Fritz – DUELVANTA',
      'street_line1','Landhausstraße 12','postal_code','75399','city','Unterreichenbach',
      'country_code','DE','email','info@duelvanta.de'
    ),
    'product',v_product,'quantity',p_quantity,'unit_price',v_unit,'goods_total',v_goods,
    'shipping_method',v_listing.shipping_method,'shipping_cost',v_shipping,
    'total_price',round(v_goods+v_shipping,2),'currency','EUR','payment_provider','manual_beta',
    'payment_notice','Keine integrierte Onlinezahlung. Die Bestellung begründet dennoch eine Zahlungspflicht gegenüber dem Verkäufer.'
  );
  return v_review || jsonb_build_object(
    'checkout_hash',encode(digest(convert_to(v_review::text,'UTF8'),'sha256'),'hex')
  );
end
$$;

revoke all on function public.review_market_checkout(uuid,integer) from public, anon;
grant execute on function public.review_market_checkout(uuid,integer) to authenticated;

-- Extend the Step-5 outbox into a delivery-safe compliance outbox. It remains
-- private; only the server-side service role can claim or finish deliveries.
alter table dv_market_private.marketplace_message_outbox
  add column if not exists contract_snapshot_id uuid references dv_market_private.market_contract_snapshots(id) on delete restrict,
  add column if not exists dedupe_key text,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists lock_token uuid,
  add column if not exists locked_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table dv_market_private.marketplace_message_outbox alter column notice_id drop not null;
update dv_market_private.marketplace_message_outbox set dedupe_key='legacy:'||id::text where dedupe_key is null;
alter table dv_market_private.marketplace_message_outbox alter column dedupe_key set default ('message:'||gen_random_uuid()::text);
alter table dv_market_private.marketplace_message_outbox alter column dedupe_key set not null;
create unique index if not exists marketplace_message_outbox_dedupe_uq
  on dv_market_private.marketplace_message_outbox(dedupe_key);

alter table dv_market_private.marketplace_message_outbox
  drop constraint if exists marketplace_message_outbox_recipient_kind_check,
  drop constraint if exists marketplace_message_outbox_message_kind_check,
  drop constraint if exists marketplace_message_outbox_source_check;
alter table dv_market_private.marketplace_message_outbox
  add constraint marketplace_message_outbox_recipient_kind_check
    check (recipient_kind in ('reporter','seller','buyer')),
  add constraint marketplace_message_outbox_message_kind_check
    check (message_kind in ('notice_received','notice_decided','seller_statement_of_reasons','appeal_received','appeal_decided','order_confirmation')),
  add constraint marketplace_message_outbox_source_check
    check ((notice_id is not null)::integer + (contract_snapshot_id is not null)::integer = 1);

create index if not exists marketplace_message_outbox_claim_idx
  on dv_market_private.marketplace_message_outbox(delivery_status,next_attempt_at,created_at)
  where delivery_status in ('pending','sending','failed');

create table if not exists dv_market_private.marketplace_message_delivery_events (
  id bigint generated always as identity primary key,
  message_id uuid not null references dv_market_private.marketplace_message_outbox(id) on delete restrict,
  event_type text not null check (event_type in ('claimed','sent','failed')),
  attempt integer not null,
  provider_message_id text,
  error_summary text,
  created_at timestamptz not null default now()
);

alter table dv_market_private.marketplace_message_delivery_events enable row level security;
revoke all on table dv_market_private.marketplace_message_delivery_events from public, anon, authenticated;
revoke all on sequence dv_market_private.marketplace_message_delivery_events_id_seq from public, anon, authenticated;

drop trigger if exists marketplace_message_delivery_events_immutable on dv_market_private.marketplace_message_delivery_events;
create trigger marketplace_message_delivery_events_immutable
before update or delete on dv_market_private.marketplace_message_delivery_events
for each row execute function dv_market_private.block_market_contract_snapshot_mutation();

create or replace function dv_market_private.capture_market_contract_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_listing public.market_listings%rowtype;
  v_order public.market_orders%rowtype;
  v_seller jsonb;
  v_product jsonb;
  v_type text;
  v_qty integer:=greatest(coalesce(new.item_quantity,1),1);
  v_unit numeric;
  v_goods numeric:=round(new.amount,2);
  v_shipping numeric;
  v_total numeric;
  v_text text;
  v_snapshot uuid;
begin
  if new.order_id is null or exists(select 1 from dv_market_private.market_contract_snapshots where deal_id=new.id) then return new; end if;
  select * into v_listing from public.market_listings where id=new.listing_id;
  select * into v_order from public.market_orders where id=new.order_id;
  if not found then raise exception 'checkout_order_missing'; end if;
  if new.currency<>'EUR' or v_goods<=0 then raise exception 'checkout_amount_invalid'; end if;
  if new.shipping_cost is null or new.shipping_cost<0 or new.shipping_cost>500 or new.shipping_method is null then
    raise exception 'checkout_shipping_incomplete';
  end if;
  v_seller:=dv_market_private.market_checkout_seller_party(new.seller_id);
  v_product:=dv_market_private.market_checkout_product_snapshot(v_listing);
  v_type:=case when v_seller->>'seller_type'='trader' then 'b2c' else 'c2c' end;
  v_unit:=round(v_goods/v_qty,2);v_shipping:=round(new.shipping_cost,2);v_total:=round(v_goods+v_shipping,2);
  v_text:=format(
    E'DUELVANTA BESTELLBESTÄTIGUNG\nDokumentversion: checkout-contract-v1\nOrder: %s\nVertragsschluss: %s\nVertragstyp: %s\nVerkäuferrolle: %s\nVertragspartner: %s\nAnschrift: %s, %s %s, %s\nProdukt: %s\nMenge: %s\nStückpreis: %s EUR\nWarenwert: %s EUR\nVersand (%s): %s EUR\nGesamtpreis: %s EUR\nZahlungsabwicklung: manual_beta – keine integrierte Onlinezahlung oder Auszahlung.\nPlattformrolle: Benjamin Fritz – DUELVANTA vermittelt den Vertrag; DUELVANTA ist nicht Verkäufer der Ware.',
    v_order.order_number,to_char(coalesce(new.accepted_at,now()) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),upper(v_type),
    v_seller->>'role_label',coalesce(v_seller->>'business_name',v_seller->>'legal_name'),v_seller->>'street_line1',
    v_seller->>'postal_code',v_seller->>'city',v_seller->>'country_code',v_product->>'title',v_qty,
    to_char(v_unit,'FM999999990.00'),to_char(v_goods,'FM999999990.00'),new.shipping_method,
    to_char(v_shipping,'FM999999990.00'),to_char(v_total,'FM999999990.00')
  );

  insert into dv_market_private.market_contract_snapshots(
    deal_id,order_id,listing_id,offer_id,seller_id,buyer_id,seller_type,contract_classification,
    seller_party,platform_operator,product_snapshot,quantity,unit_price,goods_total,
    shipping_method,shipping_cost,total_price,currency,payment_provider,contract_formed_at,
    confirmation_text,content_sha256
  ) values (
    new.id,new.order_id,new.listing_id,new.offer_id,new.seller_id,new.buyer_id,v_seller->>'seller_type',v_type,
    v_seller,jsonb_build_object('role','Marketplace-Vermittler','name','Benjamin Fritz – DUELVANTA',
      'street_line1','Landhausstraße 12','postal_code','75399','city','Unterreichenbach','country_code','DE','email','info@duelvanta.de'),
    v_product,v_qty,v_unit,v_goods,new.shipping_method,v_shipping,v_total,'EUR','manual_beta',coalesce(new.accepted_at,now()),
    v_text,digest(convert_to(v_text,'UTF8'),'sha256')
  ) returning id into v_snapshot;

  insert into dv_market_private.marketplace_message_outbox(
    contract_snapshot_id,recipient_kind,recipient_user_id,message_kind,payload,dedupe_key
  ) values (
    v_snapshot,'buyer',new.buyer_id,'order_confirmation',
    jsonb_build_object('snapshot_id',v_snapshot,'order_id',new.order_id,'order_number',v_order.order_number,
      'document_sha256',(select encode(content_sha256,'hex') from dv_market_private.market_contract_snapshots where id=v_snapshot)),
    'order_confirmation:'||v_snapshot::text
  ) on conflict(dedupe_key) do nothing;
  return new;
end
$$;

revoke all on function dv_market_private.capture_market_contract_snapshot() from public, anon, authenticated;
drop trigger if exists zz_capture_market_contract_snapshot on public.market_deals;
create trigger zz_capture_market_contract_snapshot
after insert or update of order_id on public.market_deals
for each row execute function dv_market_private.capture_market_contract_snapshot();

create or replace function public.buy_market_listing_v3(
  p_listing_id uuid,p_quantity integer,p_request_id uuid,p_expected_updated_at timestamptz,p_checkout_hash text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_review jsonb;v_result jsonb;v_snapshot dv_market_private.market_contract_snapshots%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_review:=public.review_market_checkout(p_listing_id,p_quantity);
  if nullif(lower(trim(coalesce(p_checkout_hash,''))),'') is null
     or lower(p_checkout_hash)<>(v_review->>'checkout_hash') then
    raise exception 'checkout_review_changed';
  end if;
  v_result:=public.buy_market_listing_v2(p_listing_id,p_quantity,p_request_id,p_expected_updated_at);
  select * into v_snapshot from dv_market_private.market_contract_snapshots
  where deal_id=(v_result->>'deal_id')::uuid;
  if not found then raise exception 'checkout_snapshot_missing'; end if;
  return v_result || jsonb_build_object(
    'contract_snapshot_id',v_snapshot.id,'contract_classification',v_snapshot.contract_classification,
    'confirmation_sha256',encode(v_snapshot.content_sha256,'hex')
  );
end
$$;

revoke all on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) from public, anon;
grant execute on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) to authenticated;
revoke execute on function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) from authenticated;

create or replace function public.get_my_market_order_contract_documents(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.market_orders where id=p_order_id and v_uid in (seller_id,buyer_id)) then
    raise exception 'contract_document_access_denied';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'snapshot_id',s.id,'order_id',s.order_id,'deal_id',s.deal_id,'snapshot_version',s.snapshot_version,
    'contract_classification',s.contract_classification,'seller_type',s.seller_type,
    'seller_party',s.seller_party,'product',s.product_snapshot,'quantity',s.quantity,
    'unit_price',s.unit_price,'goods_total',s.goods_total,'shipping_method',s.shipping_method,
    'shipping_cost',s.shipping_cost,'total_price',s.total_price,'currency',s.currency,
    'payment_provider',s.payment_provider,'contract_formed_at',s.contract_formed_at,
    'confirmation_format',s.confirmation_format,'confirmation_text',s.confirmation_text,
    'content_sha256',encode(s.content_sha256,'hex')
  ) order by s.contract_formed_at,s.id),'[]'::jsonb) into v_result
  from dv_market_private.market_contract_snapshots s where s.order_id=p_order_id;
  return v_result;
end
$$;

revoke all on function public.get_my_market_order_contract_documents(uuid) from public, anon;
grant execute on function public.get_my_market_order_contract_documents(uuid) to authenticated;

create or replace function public.claim_marketplace_message_delivery(p_limit integer,p_lock_token uuid)
returns table(
  message_id uuid,message_kind text,recipient_email text,payload jsonb,confirmation_text text,
  idempotency_key text,delivery_lock_token uuid,attempt integer
)
language plpgsql
security definer
set search_path = pg_catalog, dv_market_private, auth
as $$
begin
  if p_lock_token is null or coalesce(p_limit,0) not between 1 and 25 then raise exception 'invalid_delivery_claim'; end if;
  return query
  with candidates as (
    select m.id from dv_market_private.marketplace_message_outbox m
    where m.attempts<8 and m.next_attempt_at<=now()
      and (m.delivery_status in ('pending','failed') or (m.delivery_status='sending' and m.locked_at<now()-interval '15 minutes'))
    order by m.created_at,m.id for update skip locked limit p_limit
  ), claimed as (
    update dv_market_private.marketplace_message_outbox m set
      delivery_status='sending',attempts=m.attempts+1,lock_token=p_lock_token,locked_at=now(),last_error=null,updated_at=now()
    from candidates c where m.id=c.id
    returning m.*
  ), logged as (
    insert into dv_market_private.marketplace_message_delivery_events as e(message_id,event_type,attempt)
    select c.id,'claimed',c.attempts from claimed c returning e.message_id
  )
  select c.id,c.message_kind,coalesce(c.recipient_email,u.email),c.payload,s.confirmation_text,
    c.dedupe_key,c.lock_token,c.attempts
  from claimed c
  left join auth.users u on u.id=c.recipient_user_id
  left join dv_market_private.market_contract_snapshots s on s.id=c.contract_snapshot_id
  where exists(select 1 from logged l where l.message_id=c.id);
end
$$;

revoke all on function public.claim_marketplace_message_delivery(integer,uuid) from public, anon, authenticated;
grant execute on function public.claim_marketplace_message_delivery(integer,uuid) to service_role;

create or replace function public.finish_marketplace_message_delivery(
  p_message_id uuid,p_lock_token uuid,p_success boolean,p_provider_message_id text default null,p_error text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, dv_market_private
as $$
declare v_attempt integer;
begin
  update dv_market_private.marketplace_message_outbox set
    delivery_status=case when coalesce(p_success,false) then 'sent' else 'failed' end,
    provider_message_id=case when coalesce(p_success,false) then nullif(left(trim(coalesce(p_provider_message_id,'')),240),'') else provider_message_id end,
    last_error=case when coalesce(p_success,false) then null else left(coalesce(p_error,'delivery_failed'),500) end,
    sent_at=case when coalesce(p_success,false) then now() else sent_at end,
    -- Provider acceptance is recorded as sent_at; delivered_at remains reserved
    -- for a separately verified provider delivery event.
    next_attempt_at=case when coalesce(p_success,false) then next_attempt_at else now()+interval '5 minutes'*least(attempts,12) end,
    lock_token=null,locked_at=null,updated_at=now()
  where id=p_message_id and lock_token=p_lock_token and delivery_status='sending'
  returning attempts into v_attempt;
  if not found then raise exception 'delivery_lock_mismatch'; end if;
  insert into dv_market_private.marketplace_message_delivery_events(message_id,event_type,attempt,provider_message_id,error_summary)
  values(p_message_id,case when coalesce(p_success,false) then 'sent' else 'failed' end,v_attempt,
    case when coalesce(p_success,false) then nullif(left(trim(coalesce(p_provider_message_id,'')),240),'') else null end,
    case when coalesce(p_success,false) then null else left(coalesce(p_error,'delivery_failed'),500) end);
end
$$;

revoke all on function public.finish_marketplace_message_delivery(uuid,uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.finish_marketplace_message_delivery(uuid,uuid,boolean,text,text) to service_role;

notify pgrst, 'reload schema';
