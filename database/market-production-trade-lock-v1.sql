-- DUELVANTA production TRADE hard lock V1.
-- PRODUCTION RELEASE MIGRATION ONLY. DO NOT APPLY TO STAGING/PREVIEW.
-- Apply LAST after the Marketplace schema/functions for a beta release where TRADE
-- must remain closed. This blocks creation/negotiation/purchase entry points while
-- preserving existing order/problem/receipt lifecycles, data rights and necessary existing-order admin/service work.
-- Static, transactional lock: no client flag, JWT claim or service-role bypass.
-- Apply the separately generated market-production-trade-lock-readiness-v1.sql
-- in the SAME release transaction before exposing the locked application.
--
-- Reopening TRADE requires an explicit later reviewed unlock migration. Do not grant
-- these privileges ad hoc.

begin;

-- Browser roles must not bypass the UI lock through direct table writes.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public.market_listings',
    'public.market_offers',
    'public.market_deals',
    'public.market_orders',
    'public.market_order_items',
    'public.market_listing_images',
    'public.market_seller_stats'
  ] loop
    if to_regclass(v_table) is not null then
      if exists(select 1 from pg_roles where rolname='anon') then
        execute format('revoke insert, update, delete on table %s from anon',v_table);
      end if;
      if exists(select 1 from pg_roles where rolname='authenticated') then
        execute format('revoke insert, update, delete on table %s from authenticated',v_table);
      end if;
    end if;
  end loop;
end
$$;

-- Block only entry points that can create or negotiate new Marketplace commerce.
-- Existing orders may still be shipped, received, disputed/cancelled and completed so
-- a lock never strands an already existing transaction.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname ~ '^(add_my_market_listing_image|buy_market_listing(_v[0-9]+)?|checkout_accepted_market_offer(_v[0-9]+)?|create_market_offer(_v[0-9]+)?|create_sealed_market_listing_draft(_v[0-9]+)?|edit_my_market_listing(_v[0-9]+)?|edit_my_sealed_market_listing(_v[0-9]+)?|publish_my_sealed_market_listing|register_my_market_listing_image|renew_my_market_listing)$'
  loop
    execute format('revoke all on function %s from public',f.signature);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on function %s from anon',f.signature);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on function %s from authenticated',f.signature);
    end if;
    if exists(select 1 from pg_roles where rolname='service_role') then
      execute format('revoke all on function %s from service_role',f.signature);
    end if;
  end loop;
end
$$;

-- The guards protect the physical writes as well as SECURITY DEFINER callers.
-- No role/JWT/GUC exemption. DELETE and non-commercial lifecycle UPDATE remain.
create or replace function dv_market_private.reject_new_trade_while_locked_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare n jsonb:=to_jsonb(new);o jsonb; k text;
begin
  if tg_op='INSERT' then raise exception 'production_trade_locked' using errcode='P0001'; end if;
  o:=to_jsonb(old);
  -- No replacement of parties, product, contract, quantity or agreed goods price.
  foreach k in array array['id','seller_id','buyer_id','listing_id','offer_id','deal_id','order_id',
    'amount','currency','item_quantity','quantity','item_amount','requested_quantity','offer_type',
    'contract_review_snapshot','checkout_hash_snapshot','offer_review_hash'] loop
    if n->k is distinct from o->k then raise exception 'production_trade_locked' using errcode='P0001'; end if;
  end loop;
  if tg_table_name='market_listings' then
    -- Return of reserved inventory during cancellation/expiry is necessary. It cannot
    -- create a purchase: every offer/deal/order/item INSERT remains independently locked.
    if (n->>'quantity_available')::integer < (o->>'quantity_available')::integer
       or (n->>'status' in ('active','reserved') and n->>'status' is distinct from o->>'status'
           and not (o->>'status'='reserved' and n->>'status'='active'
             and (n->>'quantity_available')::integer >= (o->>'quantity_available')::integer)) then
      raise exception 'production_trade_locked' using errcode='P0001';
    end if;
    foreach k in array array['asking_price','stock_quantity','pricing_mode','listing_type','product_kind',
      'card_name','set_name','quantity_pricing','minimum_purchase_quantity','active_until'] loop
      if n->k is distinct from o->k then raise exception 'production_trade_locked' using errcode='P0001'; end if;
    end loop;
  elsif tg_table_name='market_offers' then
    if (n->>'status' in ('pending','accepted','reserved') and n->>'status' is distinct from o->>'status')
       or coalesce((n->>'reserved_quantity')::integer,0)>coalesce((o->>'reserved_quantity')::integer,0)
       or (n->>'reservation_expires_at' is not null and (o->>'reservation_expires_at' is null
         or (n->>'reservation_expires_at')::timestamptz > (o->>'reservation_expires_at')::timestamptz)) then
      raise exception 'production_trade_locked' using errcode='P0001';
    end if;
  elsif tg_table_name in ('market_orders','market_deals') then
    if o->>'status' in ('completed','cancelled') and n->>'status' is distinct from o->>'status' then
      raise exception 'production_trade_locked' using errcode='P0001';
    end if;
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.reject_new_trade_while_locked_v1() from public,anon,authenticated,service_role;

do $$
declare t text;
begin
  foreach t in array array['market_listings','market_offers','market_deals','market_orders','market_order_items','market_listing_images'] loop
    -- Required relations MUST exist: an incomplete installation must not report success.
    execute format('lock table public.%I in access exclusive mode',t);
    execute format('drop trigger if exists a00_production_trade_lock_v1 on public.%I',t);
    execute format('create trigger a00_production_trade_lock_v1 before insert or update on public.%I for each row execute function dv_market_private.reject_new_trade_while_locked_v1()',t);
    execute format('alter table public.%I enable always trigger a00_production_trade_lock_v1',t);
  end loop;
  -- Swap creation is already retired; retain the hard boundary for privileged callers.
  foreach t in array array['market_swap_threads','market_swap_revisions','market_swap_confirmations','market_swap_revision_items','market_swap_reservations'] loop
    execute format('lock table dv_market_private.%I in access exclusive mode',t);
    execute format('drop trigger if exists a00_production_trade_lock_v1 on dv_market_private.%I',t);
    execute format('create trigger a00_production_trade_lock_v1 before insert on dv_market_private.%I for each row execute function dv_market_private.reject_new_trade_while_locked_v1()',t);
    execute format('alter table dv_market_private.%I enable always trigger a00_production_trade_lock_v1',t);
  end loop;
end
$$;

-- Preserve accepted fixed-price retries (existing contract/payment recovery), but
-- reject both fresh and previously prepared, not-yet-accepted requests BEFORE Stripe.
-- Exact insertion anchors fail closed on source drift. Reapplication is idempotent.
do $lock_patch$
declare f record; definition text;
begin
  for f in select * from (values
    ('public.prepare_fixed_price_market_offer_v1(uuid,integer,uuid,timestamptz,text,boolean)',
     '  v_buyer_type:=dv_market_private.require_market_buyer_type(v_uid);',
     $guard$  -- production_trade_lock_fixed_prepare_v1
  if not exists(select 1 from public.market_offers lock_offer join public.market_deals lock_deal on lock_deal.offer_id=lock_offer.id
    join public.market_orders lock_order on lock_order.id=lock_deal.order_id
    where lock_offer.buyer_id=v_uid and lock_offer.checkout_request_id=p_request_id and lock_offer.status='accepted') then
    raise exception 'production_trade_locked' using errcode='P0001';
  end if;
$guard$),
    ('public.accept_fixed_price_market_offer_v1(uuid,uuid,text,timestamptz,boolean)',
     '  if p_offer_id is null or p_attempt_id is null or p_payment_requested_at is null then',
     $guard$  -- production_trade_lock_fixed_accept_v1
  if not exists(select 1 from public.market_offers lock_offer join public.market_deals lock_deal on lock_deal.offer_id=lock_offer.id
    join public.market_orders lock_order on lock_order.id=lock_deal.order_id where lock_offer.id=p_offer_id and lock_offer.status='accepted') then
    raise exception 'production_trade_locked' using errcode='P0001';
  end if;
$guard$)
  ) x(signature,anchor,patch) loop
    if to_regprocedure(f.signature) is null then raise exception 'production_trade_lock_missing_function:%',f.signature; end if;
    definition:=pg_get_functiondef(to_regprocedure(f.signature));
    if position(f.patch in definition)>0 then continue; end if;
    if position(f.anchor in definition)=0 or
       (length(definition)-length(replace(definition,f.anchor,'')))/length(f.anchor)<>1 then
      raise exception 'production_trade_lock_source_drift:%',f.signature;
    end if;
    execute replace(definition,f.anchor,f.patch||f.anchor);
  end loop;
end
$lock_patch$;

commit;
