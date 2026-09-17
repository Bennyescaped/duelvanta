\set ON_ERROR_STOP on
-- Runs after the preserved historical swap regression, in disposable Postgres only.
alter table public.market_offers add column if not exists offer_type text default 'price';
insert into auth.users(id) values('a9000000-0000-4000-8000-000000000001'),('a9000000-0000-4000-8000-000000000002');
insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,country_code) values
('a9000000-0000-4000-8000-000000000001','private','active','DE'),
('a9000000-0000-4000-8000-000000000002','private','active','DE');
insert into public.market_listings(id,seller_id,listing_type) values
('a9000000-0000-4000-8000-000000000011','a9000000-0000-4000-8000-000000000001','trade'),
('a9000000-0000-4000-8000-000000000012','a9000000-0000-4000-8000-000000000002','sale_or_trade');
insert into dv_market_private.market_swap_threads(id,party_a_id,party_b_id) values
('a9000000-0000-4000-8000-000000000021','a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002');
\ir ../database/b07-sale-only-release-v1.sql
-- Idempotent deployment must not destroy history or relax the lock.
\ir ../database/b07-sale-only-release-v1.sql
begin;
create function pg_temp.denied(sql text, expected text) returns void language plpgsql as $$
begin
  begin execute sql;exception when others then
    if sqlerrm like '%'||expected||'%' then return;end if;
    raise;
  end;
  raise exception 'Expected rejection: %',sql;
end $$;
select pg_temp.denied($q$insert into public.market_listings(seller_id,listing_type) values('a9000000-0000-4000-8000-000000000001','trade')$q$,'market_sale_only');
select pg_temp.denied($q$insert into public.market_listings(seller_id,listing_type) values('a9000000-0000-4000-8000-000000000001','sale_or_trade')$q$,'market_sale_only');
insert into public.market_listings(id,seller_id,listing_type,asking_price) values
('a9000000-0000-4000-8000-000000000013','a9000000-0000-4000-8000-000000000001','sale',10);
select pg_temp.denied($q$update public.market_listings set listing_type='trade' where id='a9000000-0000-4000-8000-000000000013'$q$,'market_sale_only');
-- Historical mixed listing remains purchasable. No silent conversion of old contracts.
update public.market_listings set status='reserved' where id='a9000000-0000-4000-8000-000000000012';
insert into public.market_offers(listing_id,offer_type) values('a9000000-0000-4000-8000-000000000012','price');
select pg_temp.denied($q$insert into public.market_offers(listing_id,offer_type) values('a9000000-0000-4000-8000-000000000013','trade')$q$,'market_swaps_retired');
select pg_temp.denied($q$insert into public.market_offers(listing_id,offer_type) values('a9000000-0000-4000-8000-000000000011','price')$q$,'market_swaps_retired');
select pg_temp.denied($q$insert into dv_market_private.market_swap_threads(party_a_id,party_b_id) values('a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002')$q$,'market_swaps_retired');
select pg_temp.denied($q$insert into dv_market_private.market_swap_revisions(thread_id) values('a9000000-0000-4000-8000-000000000021')$q$,'market_swaps_retired');
select pg_temp.denied($q$insert into dv_market_private.market_swap_confirmations(thread_id) values('a9000000-0000-4000-8000-000000000021')$q$,'market_swaps_retired');
do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.create_market_swap_proposal_v1(uuid,uuid[])'::regprocedure,
    'public.create_market_swap_proposal_v2(uuid,uuid[],text)'::regprocedure,
    'public.propose_market_swap_revision_v1(uuid,uuid[],uuid[])'::regprocedure,
    'public.propose_market_swap_revision_v2(uuid,uuid[],uuid[],text)'::regprocedure,
    'public.confirm_market_swap_revision_v1(uuid,uuid)'::regprocedure
  ] loop
    if has_function_privilege('authenticated',f,'execute') or has_function_privilege('anon',f,'execute') then raise exception 'RPC still executable: %',f;end if;
  end loop;
  if not exists(select 1 from dv_market_private.market_swap_threads where id='a9000000-0000-4000-8000-000000000021') then raise exception 'History lost';end if;
end $$;
insert into public.market_deals(listing_id) values('a9000000-0000-4000-8000-000000000013');
select pg_temp.denied($q$insert into public.market_deals(listing_id) values('a9000000-0000-4000-8000-000000000011')$q$,'market_swaps_retired');
set local role authenticated;
select pg_temp.denied($q$select public.create_market_swap_proposal_v1(null,null)$q$,'permission denied');
select pg_temp.denied($q$select public.create_market_swap_proposal_v2(null,null,'pickup')$q$,'permission denied');
reset role;
rollback;
\echo PASS: sale-only inserts and price offers allowed; swap creation/revision/binding rejected; history preserved.

-- Exercise sale-only notification synchronization and filter BEFORE pagination.
alter table public.market_orders add column if not exists order_number text;
create table if not exists public.market_notifications(
 id uuid primary key default gen_random_uuid(),recipient_id uuid,kind text,title text,body text,
 order_id uuid,offer_id uuid,listing_id uuid,context_type text,context_id uuid,dedupe_key text unique,
 read_at timestamptz,created_at timestamptz default now()
);
\ir ../database/b07-sale-only-notifications-v1.sql
begin;
insert into public.market_orders(id,seller_id,buyer_id,fulfillment_group,order_number) values
('a9000000-0000-4000-8000-000000000031','a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002','pickup','SALE-ONLY-TEST');
insert into dv_market_private.market_pickup_messages(context_type,context_id,sender_id,body) values
('order','a9000000-0000-4000-8000-000000000031','a9000000-0000-4000-8000-000000000002','Sale-only pickup test');
insert into public.market_notifications(recipient_id,kind,title,context_type,created_at) values
('a9000000-0000-4000-8000-000000000001','swap_bound','Historical swap','swap',now()+interval '1 minute');
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.sync_my_trade_notifications_v2();
do $$ begin
 if (select count(*) from public.get_my_market_notifications(1) where context_type='pickup_order')<>1 then raise exception 'Order notification hidden by swap pagination';end if;
 if public.sync_my_trade_notifications_v2()<>0 then raise exception 'Notification sync not idempotent';end if;
end $$;
reset role;
do $$ begin if not exists(select 1 from public.market_notifications where kind='swap_bound') then raise exception 'Historical notification lost';end if;end $$;
rollback;
\echo PASS: order pickup notification retained, swap notification filtered before pagination, historical row preserved.
