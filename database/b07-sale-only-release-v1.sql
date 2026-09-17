-- V22: additive retirement. Apply only to staging until a separate production release.
-- Historical rows, evidence, RPC bodies and migrations remain intact.
begin;
create or replace function dv_market_private.reject_retired_swap_write()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'market_swaps_retired' using errcode='23514';
end
$$;
revoke all on function dv_market_private.reject_retired_swap_write() from public,anon,authenticated;

-- Covers both proposal versions, private revision helpers and direct privileged writes.
do $$
declare t text;
begin
  foreach t in array array['market_swap_threads','market_swap_revisions','market_swap_confirmations'] loop
    execute format('drop trigger if exists sale_only_no_new_swaps on dv_market_private.%I',t);
    execute format('create trigger sale_only_no_new_swaps before insert on dv_market_private.%I for each row execute function dv_market_private.reject_retired_swap_write()',t);
  end loop;
end
$$;

-- Keep old RPC bodies for evidence, but withdraw user execution of all swap mutations.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'create_market_swap_proposal_v1','create_market_swap_proposal_v2',
      'propose_market_swap_revision_v1','propose_market_swap_revision_v2',
      'confirm_market_swap_revision_v1','create_market_swap_pickup_code_v1',
      'confirm_market_swap_pickup_v1','mark_market_swap_shipped_v1',
      'confirm_market_swap_received_v1','open_market_swap_problem_v1',
      'respond_market_swap_problem_v1','withdraw_market_swap_problem_v1','close_market_swap_thread_v1'
    ]) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end
$$;

create or replace function dv_market_private.enforce_sale_only_listing()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.listing_type is distinct from 'sale' then
    if tg_op='INSERT' then
      raise exception 'market_sale_only' using errcode='23514';
    elsif new.listing_type is distinct from old.listing_type then
      raise exception 'market_sale_only' using errcode='23514';
    elsif new.listing_type='trade' and new.status in ('active','reserved') and new.status is distinct from old.status then
      raise exception 'market_swaps_retired' using errcode='23514';
    end if;
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.enforce_sale_only_listing() from public,anon,authenticated;
drop trigger if exists sale_only_listing on public.market_listings;
create trigger sale_only_listing before insert or update on public.market_listings
for each row execute function dv_market_private.enforce_sale_only_listing();

create or replace function dv_market_private.enforce_sale_only_offer()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.offer_type is distinct from 'price' or exists(
    select 1 from public.market_listings where id=new.listing_id and listing_type='trade'
  ) then
    -- Administrative cancellation/erasure of historical offers remains possible.
    if tg_op='UPDATE' and new.status in ('withdrawn','declined','expired','cancelled') then return new;end if;
    raise exception 'market_swaps_retired' using errcode='23514';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.enforce_sale_only_offer() from public,anon,authenticated;
drop trigger if exists sale_only_offer on public.market_offers;
create trigger sale_only_offer before insert or update of listing_id,offer_type,status on public.market_offers
for each row execute function dv_market_private.enforce_sale_only_offer();

-- Legacy deal creation must not resurrect a swap via an old accepted offer.
create or replace function dv_market_private.enforce_sale_only_deal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.market_listings where id=new.listing_id and listing_type='trade')
    or exists(select 1 from public.market_offers where id=new.offer_id and offer_type is distinct from 'price') then
    raise exception 'market_swaps_retired' using errcode='23514';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.enforce_sale_only_deal() from public,anon,authenticated;
drop trigger if exists sale_only_deal on public.market_deals;
create trigger sale_only_deal before insert on public.market_deals
for each row execute function dv_market_private.enforce_sale_only_deal();

notify pgrst,'reload schema';
commit;
