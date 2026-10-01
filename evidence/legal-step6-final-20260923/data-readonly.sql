begin read only;
select jsonb_build_object(
'payment',(select jsonb_build_object('sandbox_enabled',sandbox_enabled,'live_mode',live_mode,'seller_invoice_issuance_enabled',seller_invoice_issuance_enabled) from dv_market_private.market_payment_configuration where singleton),
'offers',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select offer_type,status,count(*) as count,count(*) filter(where coalesce(reserved_quantity,0)>0) as reserved,count(*) filter(where reservation_expires_at<=now()) as expired from public.market_offers group by offer_type,status)x),
'counts',jsonb_build_object('offers',(select count(*) from public.market_offers),'listings',(select count(*) from public.market_listings),'deals',(select count(*) from public.market_deals),'orders',(select count(*) from public.market_orders),'contract_snapshots',(select count(*) from dv_market_private.market_contract_snapshots)),
'bad_listing_quantity',(select count(*) from public.market_listings where quantity_available<0 or stock_quantity<quantity_available or stock_quantity<0 or quantity_available is null or stock_quantity is null),
'bad_reserved_quantity',(select count(*) from public.market_offers where reserved_quantity<0 or (coalesce(reserved_quantity,0)>0 and (requested_quantity is null or requested_quantity<>reserved_quantity or reservation_expires_at is null))),
'orphan_offers',(select count(*) from public.market_offers o left join public.market_listings l on l.id=o.listing_id where l.id is null),
'expired_without_deal',(select count(*) from public.market_offers o where o.reservation_expires_at<=now() and not exists(select 1 from public.market_deals d where d.offer_id=o.id)),
'reservation_with_deal',(select count(*) from public.market_offers o where coalesce(o.reserved_quantity,0)>0 and exists(select 1 from public.market_deals d where d.offer_id=o.id)),
'over_restore',(select count(*) from (select o.listing_id,sum(o.reserved_quantity) as qty from public.market_offers o where coalesce(o.reserved_quantity,0)>0 and not exists(select 1 from public.market_deals d where d.offer_id=o.id) group by o.listing_id)x join public.market_listings l on l.id=x.listing_id where l.quantity_available+x.qty>l.stock_quantity),
'cleanup',jsonb_build_object('signature',to_regprocedure('public.expire_market_offer_reservations_v1()')::text,'service_execute',has_function_privilege('service_role','public.expire_market_offer_reservations_v1()','EXECUTE'))
) as state;
commit;
