-- DUELVANTA TRADE shipping profiles V1
-- Private reusable buyer address + seller-defined shipping/tariff rules.
-- Existing orders/listings are not backfilled or rewritten.

create table if not exists public.market_default_shipping_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recipient_name text not null,
  street_line1 text not null,
  street_line2 text,
  postal_code text not null,
  city text not null,
  country_code text not null check (country_code in ('DE','AT','CH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_default_shipping_addresses enable row level security;
revoke all on table public.market_default_shipping_addresses from public, anon, authenticated;

create table if not exists public.market_shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  destination_country_code text not null check (destination_country_code in ('DE','AT','CH')),
  shipping_method text not null check (shipping_method in ('standard_letter','tracked_letter','parcel','custom')),
  carrier_label text,
  product_scope text not null default 'all' check (product_scope in ('all','cards','sealed')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_shipping_profile_rules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.market_shipping_profiles(id) on delete cascade,
  sort_order integer not null check (sort_order between 1 and 20),
  max_units integer check (max_units is null or max_units between 1 and 1000),
  max_weight_grams integer check (max_weight_grams is null or max_weight_grams between 1 and 100000),
  max_length_mm integer check (max_length_mm is null or max_length_mm between 1 and 2000),
  max_width_mm integer check (max_width_mm is null or max_width_mm between 1 and 2000),
  max_height_mm integer check (max_height_mm is null or max_height_mm between 1 and 2000),
  shipping_cost numeric(10,2) not null check (shipping_cost between 0 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_units is not null or max_weight_grams is not null),
  unique(profile_id, sort_order)
);

alter table public.market_shipping_profiles enable row level security;
alter table public.market_shipping_profile_rules enable row level security;
revoke all on table public.market_shipping_profiles from public, anon, authenticated;
revoke all on table public.market_shipping_profile_rules from public, anon, authenticated;

create index if not exists market_shipping_profiles_seller_idx
  on public.market_shipping_profiles(seller_id, destination_country_code, is_active);
create index if not exists market_shipping_profile_rules_profile_idx
  on public.market_shipping_profile_rules(profile_id, sort_order);

alter table public.market_orders
  add column if not exists shipping_profile_id uuid references public.market_shipping_profiles(id) on delete set null,
  add column if not exists shipping_profile_rule_id uuid references public.market_shipping_profile_rules(id) on delete set null,
  add column if not exists shipping_quote_country_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='market_orders_shipping_quote_country_check'
  ) then
    alter table public.market_orders
      add constraint market_orders_shipping_quote_country_check
      check (shipping_quote_country_code is null or shipping_quote_country_code in ('DE','AT','CH'));
  end if;
end $$;

create or replace function public.get_my_default_shipping_address()
returns table(
  recipient_name text,
  street_line1 text,
  street_line2 text,
  postal_code text,
  city text,
  country_code text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  return query
  select a.recipient_name,a.street_line1,a.street_line2,a.postal_code,a.city,a.country_code,a.updated_at
  from public.market_default_shipping_addresses a
  where a.user_id=auth.uid();
end;
$$;

revoke all on function public.get_my_default_shipping_address() from public, anon;
grant execute on function public.get_my_default_shipping_address() to authenticated;

create or replace function public.upsert_my_default_shipping_address(
  p_recipient_name text,
  p_street_line1 text,
  p_postal_code text,
  p_city text,
  p_country_code text,
  p_street_line2 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_country text:=upper(trim(coalesce(p_country_code,'')));
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  if nullif(trim(coalesce(p_recipient_name,'')),'') is null
     or nullif(trim(coalesce(p_street_line1,'')),'') is null
     or nullif(trim(coalesce(p_postal_code,'')),'') is null
     or nullif(trim(coalesce(p_city,'')),'') is null then
    raise exception 'Bitte vollständige Lieferadresse angeben';
  end if;
  if v_country not in ('DE','AT','CH') then raise exception 'Lieferland derzeit nicht unterstützt'; end if;

  insert into public.market_default_shipping_addresses(
    user_id,recipient_name,street_line1,street_line2,postal_code,city,country_code
  ) values(
    v_uid,left(trim(p_recipient_name),120),left(trim(p_street_line1),160),
    nullif(left(trim(coalesce(p_street_line2,'')),160),''),left(trim(p_postal_code),20),
    left(trim(p_city),120),v_country
  )
  on conflict(user_id) do update set
    recipient_name=excluded.recipient_name,
    street_line1=excluded.street_line1,
    street_line2=excluded.street_line2,
    postal_code=excluded.postal_code,
    city=excluded.city,
    country_code=excluded.country_code,
    updated_at=now();
end;
$$;

revoke all on function public.upsert_my_default_shipping_address(text,text,text,text,text,text) from public, anon;
grant execute on function public.upsert_my_default_shipping_address(text,text,text,text,text,text) to authenticated;

create or replace function public.delete_my_default_shipping_address()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.market_default_shipping_addresses where user_id=auth.uid();
end;
$$;

revoke all on function public.delete_my_default_shipping_address() from public, anon;
grant execute on function public.delete_my_default_shipping_address() to authenticated;

create or replace function public.seed_market_order_default_shipping_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fulfillment_group='shipping' then
    insert into public.market_order_shipping_addresses(
      order_id,buyer_id,recipient_name,street_line1,street_line2,postal_code,city,country_code
    )
    select new.id,new.buyer_id,a.recipient_name,a.street_line1,a.street_line2,a.postal_code,a.city,a.country_code
    from public.market_default_shipping_addresses a
    where a.user_id=new.buyer_id
    on conflict(order_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.seed_market_order_default_shipping_address() from public, anon, authenticated;
grant execute on function public.seed_market_order_default_shipping_address() to service_role;

drop trigger if exists trg_seed_market_order_default_shipping_address on public.market_orders;
create trigger trg_seed_market_order_default_shipping_address
after insert on public.market_orders
for each row execute function public.seed_market_order_default_shipping_address();

create or replace function public.sync_market_order_address_to_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid()=new.buyer_id then
    insert into public.market_default_shipping_addresses(
      user_id,recipient_name,street_line1,street_line2,postal_code,city,country_code
    ) values(
      new.buyer_id,new.recipient_name,new.street_line1,new.street_line2,new.postal_code,new.city,new.country_code
    )
    on conflict(user_id) do update set
      recipient_name=excluded.recipient_name,
      street_line1=excluded.street_line1,
      street_line2=excluded.street_line2,
      postal_code=excluded.postal_code,
      city=excluded.city,
      country_code=excluded.country_code,
      updated_at=now();
  end if;
  return new;
end;
$$;

revoke all on function public.sync_market_order_address_to_default() from public, anon, authenticated;
grant execute on function public.sync_market_order_address_to_default() to service_role;

drop trigger if exists trg_sync_market_order_address_to_default on public.market_order_shipping_addresses;
create trigger trg_sync_market_order_address_to_default
after insert or update of recipient_name,street_line1,street_line2,postal_code,city,country_code
on public.market_order_shipping_addresses
for each row execute function public.sync_market_order_address_to_default();

create or replace function public.get_my_market_shipping_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select coalesce(jsonb_agg(q.profile order by q.created_at,q.name),'[]'::jsonb)
  into v_result
  from (
    select p.created_at,p.name,
      jsonb_build_object(
        'id',p.id,
        'name',p.name,
        'destination_country_code',p.destination_country_code,
        'shipping_method',p.shipping_method,
        'carrier_label',p.carrier_label,
        'product_scope',p.product_scope,
        'is_active',p.is_active,
        'rules',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',r.id,
            'sort_order',r.sort_order,
            'max_units',r.max_units,
            'max_weight_grams',r.max_weight_grams,
            'max_length_mm',r.max_length_mm,
            'max_width_mm',r.max_width_mm,
            'max_height_mm',r.max_height_mm,
            'shipping_cost',r.shipping_cost
          ) order by r.sort_order)
          from public.market_shipping_profile_rules r where r.profile_id=p.id
        ),'[]'::jsonb)
      ) as profile
    from public.market_shipping_profiles p
    where p.seller_id=auth.uid()
  ) q;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke all on function public.get_my_market_shipping_profiles() from public, anon;
grant execute on function public.get_my_market_shipping_profiles() to authenticated;

create or replace function public.upsert_my_market_shipping_profile(
  p_profile_id uuid,
  p_name text,
  p_destination_country_code text,
  p_shipping_method text,
  p_carrier_label text,
  p_product_scope text,
  p_is_active boolean,
  p_rules jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid:=auth.uid();
  v_id uuid;
  v_country text:=upper(trim(coalesce(p_destination_country_code,'')));
  v_rule jsonb;
  v_pos integer:=0;
  v_units integer;
  v_weight integer;
  v_l integer;
  v_w integer;
  v_h integer;
  v_cost numeric;
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'Bitte Profilname angeben'; end if;
  if v_country not in ('DE','AT','CH') then raise exception 'Ungültiges Zielland'; end if;
  if p_shipping_method not in ('standard_letter','tracked_letter','parcel','custom') then raise exception 'Ungültige Versandart'; end if;
  if p_product_scope not in ('all','cards','sealed') then raise exception 'Ungültiger Produktbereich'; end if;
  if p_shipping_method='custom' and nullif(trim(coalesce(p_carrier_label,'')),'') is null then
    raise exception 'Individuelle Versandart bitte benennen';
  end if;
  if p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules) not between 1 and 10 then
    raise exception 'Bitte 1 bis 10 Tarifregeln anlegen';
  end if;

  if p_profile_id is null then
    insert into public.market_shipping_profiles(
      seller_id,name,destination_country_code,shipping_method,carrier_label,product_scope,is_active
    ) values(
      v_uid,left(trim(p_name),80),v_country,p_shipping_method,
      nullif(left(trim(coalesce(p_carrier_label,'')),80),''),p_product_scope,coalesce(p_is_active,true)
    ) returning id into v_id;
  else
    select id into v_id from public.market_shipping_profiles where id=p_profile_id and seller_id=v_uid for update;
    if v_id is null then raise exception 'Versandprofil nicht gefunden'; end if;
    update public.market_shipping_profiles set
      name=left(trim(p_name),80),destination_country_code=v_country,shipping_method=p_shipping_method,
      carrier_label=nullif(left(trim(coalesce(p_carrier_label,'')),80),''),product_scope=p_product_scope,
      is_active=coalesce(p_is_active,true),updated_at=now()
    where id=v_id;
    delete from public.market_shipping_profile_rules where profile_id=v_id;
  end if;

  for v_rule in select value from jsonb_array_elements(p_rules) loop
    v_pos:=v_pos+1;
    begin
      v_units:=nullif(v_rule->>'max_units','')::integer;
      v_weight:=nullif(v_rule->>'max_weight_grams','')::integer;
      v_l:=nullif(v_rule->>'max_length_mm','')::integer;
      v_w:=nullif(v_rule->>'max_width_mm','')::integer;
      v_h:=nullif(v_rule->>'max_height_mm','')::integer;
      v_cost:=(v_rule->>'shipping_cost')::numeric;
    exception when others then
      raise exception 'Ungültige Tarifregel %',v_pos;
    end;
    if v_units is null and v_weight is null then raise exception 'Tarifregel % braucht Maximalmenge oder Maximalgewicht',v_pos; end if;
    if v_units is not null and v_units not between 1 and 1000 then raise exception 'Ungültige Maximalmenge in Regel %',v_pos; end if;
    if v_weight is not null and v_weight not between 1 and 100000 then raise exception 'Ungültiges Maximalgewicht in Regel %',v_pos; end if;
    if v_l is not null and v_l not between 1 and 2000 then raise exception 'Ungültige Länge in Regel %',v_pos; end if;
    if v_w is not null and v_w not between 1 and 2000 then raise exception 'Ungültige Breite in Regel %',v_pos; end if;
    if v_h is not null and v_h not between 1 and 2000 then raise exception 'Ungültige Höhe in Regel %',v_pos; end if;
    if v_cost is null or v_cost<0 or v_cost>500 then raise exception 'Ungültige Versandkosten in Regel %',v_pos; end if;

    insert into public.market_shipping_profile_rules(
      profile_id,sort_order,max_units,max_weight_grams,max_length_mm,max_width_mm,max_height_mm,shipping_cost
    ) values(v_id,v_pos,v_units,v_weight,v_l,v_w,v_h,round(v_cost,2));
  end loop;
  return v_id;
end;
$$;

revoke all on function public.upsert_my_market_shipping_profile(uuid,text,text,text,text,text,boolean,jsonb) from public, anon;
grant execute on function public.upsert_my_market_shipping_profile(uuid,text,text,text,text,text,boolean,jsonb) to authenticated;

create or replace function public.delete_my_market_shipping_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.market_shipping_profiles where id=p_profile_id and seller_id=auth.uid();
  if not found then raise exception 'Versandprofil nicht gefunden'; end if;
end;
$$;

revoke all on function public.delete_my_market_shipping_profile(uuid) from public, anon;
grant execute on function public.delete_my_market_shipping_profile(uuid) to authenticated;

create or replace function public.recalculate_market_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.market_orders;
  v_count integer:=0;
  v_units integer:=0;
  v_sub numeric:=0;
  v_sep numeric:=0;
  v_auto_cost numeric:=0;
  v_weight integer:=0;
  v_method text:='custom';
  v_review boolean:=false;
  v_custom boolean:=false;
  v_missing_weight boolean:=false;
  v_has_sealed boolean:=false;
  v_has_cards boolean:=false;
  v_missing_sealed_dims boolean:=false;
  v_max_l integer:=0;
  v_max_w integer:=0;
  v_max_h integer:=0;
  v_same_shape boolean:=false;
  v_keep_confirmed boolean:=false;
  v_combined boolean:=false;
  v_country text;
  v_profile uuid;
  v_rule uuid;
  v_profile_name text;
  v_carrier text;
  v_note text;
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or o.status not in ('open','in_progress') then return; end if;

  select
    count(*)::integer,
    coalesce(sum(i.quantity),0)::integer,
    coalesce(sum(i.item_amount),0),
    coalesce(sum(i.individual_shipping_cost),0),
    coalesce(max(i.individual_shipping_cost),0),
    coalesce(sum(coalesce(i.weight_grams,0)),0)::integer,
    coalesce(bool_or(i.shipping_method='custom'),false),
    coalesce(bool_or(i.weight_grams is null),false),
    coalesce(bool_or(d.product_kind='sealed'),false),
    coalesce(bool_or(d.product_kind in ('single','graded')),false),
    coalesce(bool_or(d.product_kind='sealed' and (d.length_mm is null or d.width_mm is null or d.height_mm is null)),false),
    coalesce(max(case when d.product_kind='sealed' then d.length_mm else 0 end),0),
    coalesce(max(case when d.product_kind='sealed' then d.width_mm else 0 end),0),
    coalesce(max(case when d.product_kind='sealed' then d.height_mm else 0 end),0)
  into v_count,v_units,v_sub,v_sep,v_auto_cost,v_weight,v_custom,v_missing_weight,
       v_has_sealed,v_has_cards,v_missing_sealed_dims,v_max_l,v_max_w,v_max_h
  from public.market_order_items i
  join public.market_deals d on d.id=i.deal_id
  where i.order_id=p_order_id and d.status<>'cancelled';

  if v_count=0 then
    update public.market_orders set
      status='cancelled',item_count=0,subtotal=0,separate_shipping_sum=0,shipping_cost=0,
      total_amount=0,shipping_savings=0,cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
    where id=p_order_id;
    return;
  end if;

  select a.country_code into v_country
  from public.market_order_shipping_addresses a where a.order_id=p_order_id;

  v_same_shape:=(o.item_count=v_count and o.subtotal=v_sub and o.separate_shipping_sum=v_sep and o.total_weight_grams=v_weight);
  v_keep_confirmed:=(o.shipping_quote_status='confirmed' and v_same_shape and
    (o.shipping_quote_country_code is null or o.shipping_quote_country_code is not distinct from v_country));

  if v_keep_confirmed then
    update public.market_orders set
      item_count=v_count,subtotal=round(v_sub,2),separate_shipping_sum=round(v_sep,2),total_weight_grams=v_weight,
      shipping_quote_country_code=coalesce(o.shipping_quote_country_code,v_country),
      total_amount=round(v_sub+o.shipping_cost,2),shipping_savings=round(v_sep-o.shipping_cost,2),updated_at=now()
    where id=p_order_id;
    return;
  end if;

  if o.fulfillment_group='pickup' then
    v_method:='pickup';v_auto_cost:=0;v_review:=false;v_country:=null;
  else
    select case max(case i.shipping_method
      when 'standard_letter' then 1 when 'tracked_letter' then 2 when 'parcel' then 3 when 'custom' then 4 else 0 end)
      when 1 then 'standard_letter' when 2 then 'tracked_letter' when 3 then 'parcel' else 'custom' end
    into v_method
    from public.market_order_items i join public.market_deals d on d.id=i.deal_id
    where i.order_id=p_order_id and d.status<>'cancelled';

    v_combined:=(v_count>1 or v_units>1);
    if not v_combined then
      v_review:=v_custom;
      if v_review then v_note:='Versand nach Absprache muss vom Verkäufer bestätigt werden.'; end if;
    elsif v_custom or v_country is null then
      v_review:=true;
      v_note:='Combined Shipping muss vom Verkäufer geprüft werden.';
    else
      select p.id,r.id,p.shipping_method,r.shipping_cost,p.name,p.carrier_label
      into v_profile,v_rule,v_method,v_auto_cost,v_profile_name,v_carrier
      from public.market_shipping_profiles p
      join public.market_shipping_profile_rules r on r.profile_id=p.id
      where p.seller_id=o.seller_id
        and p.is_active
        and p.destination_country_code=v_country
        and (
          p.product_scope='all'
          or (p.product_scope='cards' and not v_has_sealed)
          or (p.product_scope='sealed' and not v_has_cards)
        )
        and (r.max_units is null or v_units<=r.max_units)
        and (r.max_weight_grams is null or (not v_missing_weight and v_weight<=r.max_weight_grams))
        and (not v_has_sealed or r.max_length_mm is null or (not v_missing_sealed_dims and v_max_l<=r.max_length_mm))
        and (not v_has_sealed or r.max_width_mm is null or (not v_missing_sealed_dims and v_max_w<=r.max_width_mm))
        and (not v_has_sealed or r.max_height_mm is null or (not v_missing_sealed_dims and v_max_h<=r.max_height_mm))
      order by r.shipping_cost asc,p.created_at asc,r.sort_order asc,p.id
      limit 1;

      if v_profile is null then
        v_review:=true;
        v_note:='Keine sichere Versandprofil-Regel passt auf diese Order. Verkäufer prüft den Gesamtversand.';
      else
        v_review:=false;
        v_note:=left('Automatisch nach Versandprofil: '||v_profile_name||coalesce(' · '||nullif(v_carrier,''),''),240);
      end if;
    end if;
  end if;

  update public.market_orders set
    item_count=v_count,
    subtotal=round(v_sub,2),
    separate_shipping_sum=round(v_sep,2),
    total_weight_grams=v_weight,
    shipping_method=v_method,
    shipping_cost=round(v_auto_cost,2),
    shipping_quote_status=case when v_review then 'review_required' else 'auto' end,
    shipping_note=v_note,
    shipping_profile_id=case when v_review then null else v_profile end,
    shipping_profile_rule_id=case when v_review then null else v_rule end,
    shipping_quote_country_code=v_country,
    total_amount=round(v_sub+v_auto_cost,2),
    shipping_savings=round(v_sep-v_auto_cost,2),
    payment_status=case
      when payment_provider='stripe_connect' and paid_amount>0 and paid_amount<round(v_sub+v_auto_cost,2) then 'balance_due'
      else payment_status end,
    updated_at=now()
  where id=p_order_id;
end;
$$;

revoke all on function public.recalculate_market_order(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_market_order(uuid) to service_role;

create or replace function public.confirm_market_order_shipping(
  p_order_id uuid,
  p_shipping_method text,
  p_shipping_cost numeric,
  p_shipping_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.market_orders; v_country text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann Combined Shipping bestätigen'; end if;
  if o.shipped_at is not null or o.status in ('completed','cancelled','disputed') then raise exception 'Versand kann nicht mehr geändert werden'; end if;
  if o.fulfillment_group='pickup' then p_shipping_method:='pickup'; p_shipping_cost:=0; end if;
  if p_shipping_method not in ('standard_letter','tracked_letter','parcel','pickup','custom') then raise exception 'Ungültige Versandart'; end if;
  if p_shipping_cost is null or p_shipping_cost<0 or p_shipping_cost>500 then raise exception 'Ungültige Versandkosten'; end if;
  if o.fulfillment_group='shipping' and p_shipping_method='pickup' then raise exception 'Abholung kann nicht mit Versandartikeln kombiniert werden'; end if;
  select a.country_code into v_country from public.market_order_shipping_addresses a where a.order_id=o.id;
  update public.market_orders set
    shipping_method=p_shipping_method,
    shipping_cost=round(p_shipping_cost,2),
    shipping_note=nullif(left(trim(coalesce(p_shipping_note,'')),240),''),
    shipping_quote_status='confirmed',
    shipping_profile_id=null,
    shipping_profile_rule_id=null,
    shipping_quote_country_code=v_country,
    total_amount=round(subtotal+p_shipping_cost,2),
    shipping_savings=round(separate_shipping_sum-p_shipping_cost,2),
    updated_at=now()
  where id=o.id;
end;
$$;

revoke all on function public.confirm_market_order_shipping(uuid,text,numeric,text) from public, anon;
grant execute on function public.confirm_market_order_shipping(uuid,text,numeric,text) to authenticated;

create or replace function public.upsert_my_market_order_shipping_address(
  p_order_id uuid,
  p_recipient_name text,
  p_street_line1 text,
  p_postal_code text,
  p_city text,
  p_country_code text,
  p_street_line2 text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o public.market_orders; v_country text:=upper(trim(coalesce(p_country_code,'')));
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann die Lieferadresse speichern'; end if;
  if o.fulfillment_group='pickup' then raise exception 'Bei Abholung ist keine Lieferadresse nötig'; end if;
  if o.shipped_at is not null or o.status in ('completed','cancelled') then raise exception 'Lieferadresse ist gesperrt'; end if;
  if nullif(trim(coalesce(p_recipient_name,'')),'') is null or nullif(trim(coalesce(p_street_line1,'')),'') is null
     or nullif(trim(coalesce(p_postal_code,'')),'') is null or nullif(trim(coalesce(p_city,'')),'') is null then
    raise exception 'Bitte vollständige Lieferadresse angeben';
  end if;
  if v_country not in ('DE','AT','CH') then raise exception 'Lieferland derzeit nicht unterstützt'; end if;
  insert into public.market_order_shipping_addresses(order_id,buyer_id,recipient_name,street_line1,street_line2,postal_code,city,country_code)
  values(o.id,o.buyer_id,left(trim(p_recipient_name),120),left(trim(p_street_line1),160),nullif(left(trim(coalesce(p_street_line2,'')),160),''),left(trim(p_postal_code),20),left(trim(p_city),120),v_country)
  on conflict(order_id) do update set
    recipient_name=excluded.recipient_name,street_line1=excluded.street_line1,street_line2=excluded.street_line2,
    postal_code=excluded.postal_code,city=excluded.city,country_code=excluded.country_code,updated_at=now();
end;
$$;

revoke all on function public.upsert_my_market_order_shipping_address(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.upsert_my_market_order_shipping_address(uuid,text,text,text,text,text,text) to authenticated;

create or replace function public.recalc_market_order_after_address_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_order uuid:=coalesce(new.order_id,old.order_id);
begin
  if exists(select 1 from public.market_order_items where order_id=v_order) then
    perform public.recalculate_market_order(v_order);
  end if;
  return coalesce(new,old);
end;
$$;

revoke all on function public.recalc_market_order_after_address_change() from public, anon, authenticated;
grant execute on function public.recalc_market_order_after_address_change() to service_role;

drop trigger if exists trg_recalc_market_order_after_address_change on public.market_order_shipping_addresses;
create trigger trg_recalc_market_order_after_address_change
after insert or update of country_code or delete on public.market_order_shipping_addresses
for each row execute function public.recalc_market_order_after_address_change();
