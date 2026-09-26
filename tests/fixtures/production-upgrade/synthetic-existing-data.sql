-- Synthetic legacy state only. Aggregated shape from read-only Production inventory.
-- Trigger suppression is confined to fixture hydration; FKs are checked explicitly after it.
begin;
set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case when i=1 then 'info@duelvanta.de' else 'p001-'||i||'@invalid.example' end,now()
from generate_series(1,17) i;
insert into public.profiles(id,email,role,account_status)
select id,email,case when email='info@duelvanta.de' then 'owner' else 'player' end,'active' from auth.users;
insert into public.collection_items(user_id,tcg,card_name)
select '10000000-0000-4000-8000-000000000002','pokemon','SYNTHETIC P0-01 card '||i from generate_series(1,53)i;
insert into public.market_listings(id,seller_id,tcg,card_name,status,product_kind,sealed_category,sealed_condition,shipping_method,stock_quantity,quantity_available)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000002','pokemon','SYNTHETIC P0-01 listing '||i,
 case when i=1 then 'sold' when i=2 then 'reserved' else 'withdrawn' end,
 case when i in(3,4) then 'single' else 'sealed' end,
 case when i in(3,4) then null else 'booster' end,
 case when i in(3,4) then null else 'factory_sealed' end,'parcel',10,0 from generate_series(1,8)i;
insert into public.market_offers(id,listing_id,buyer_id,seller_id,offer_type,status,amount)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','price','accepted',10 from generate_series(1,3)i;
insert into public.market_orders(id,order_number,seller_id,buyer_id,status,shipping_method,subtotal,total_amount,completed_at,shipped_at,received_at)
select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'SYNTHETIC-P001-'||i,
 '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
 case when i<=5 then 'completed' else 'open' end,'parcel',10,10,
 case when i<=5 then now()-interval '1 day' end,
 case when i<=5 then now()-interval '3 days' end,
 case when i<=5 then now()-interval '1 day' end from generate_series(1,7)i;
insert into public.market_deals(id,listing_id,seller_id,buyer_id,status,shipping_method,order_id,offer_id,amount,completed_at)
select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad((1+(i-1)%8)::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
 case when i<=7 then 'completed' else 'accepted' end,'parcel',
 ('40000000-0000-4000-8000-'||lpad((case when i<=7 then 1+(i-1)%5 else i-2 end)::text,12,'0'))::uuid,
 case when i<=3 then ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid end,10,
 case when i<=7 then now()-interval '1 day' end from generate_series(1,9)i;
insert into public.market_order_items(order_id,deal_id,listing_id,item_title,shipping_method,item_amount)
select order_id,id,listing_id,'SYNTHETIC P0-01 item','parcel',10 from public.market_deals;
insert into public.market_order_cases(order_id,case_type,reason,opened_by,status)
select '40000000-0000-4000-8000-000000000001',case when i<=2 then 'problem' else 'cancellation' end,
 'SYNTHETIC P0-01 historical case','10000000-0000-4000-8000-000000000003',case when i<=2 then 'withdrawn' else 'declined' end
from generate_series(1,4)i;
insert into public.market_notifications(recipient_id,kind,title,body,dedupe_key,order_id)
select '10000000-0000-4000-8000-000000000003',x.kind,'SYNTHETIC P0-01 notice','Synthetic migration preservation fixture',
 'p001-notice-'||x.kind||'-'||i,'40000000-0000-4000-8000-000000000001'
from (values ('purchase',5),('order_received',2),('problem_response',2),('cancellation_requested',2),('order_shipped',2),('problem_opened',2),('cancellation_declined',2),('problem_withdrawn',2))x(kind,n)
cross join lateral generate_series(1,x.n)i;
insert into public.collection_folders(user_id,name) select '10000000-0000-4000-8000-000000000002','SYNTHETIC P0-01 folder '||i from generate_series(1,5)i;
insert into public.battle_matches(host_id,guest_id,tcg,mode,status,completed_at)
select '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','pokemon',
 case when i=1 then 'ranked' else 'casual' end,case when i=1 then 'cancelled' else 'completed' end,now()-interval '2 days'
from generate_series(1,4)i;
commit;
