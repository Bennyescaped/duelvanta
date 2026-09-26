\set ON_ERROR_STOP on
-- P0-05 fixture ONLY after the isolated reconstructed Production chain.
-- Synthetic account/provider records; no provider traffic or external configuration.
insert into dv_market_private.trade_user_eligibility(user_id,date_of_birth,residence_country_code,private_buyer_confirmed)
select id,'1990-01-01','DE',true from auth.users;
update public.market_seller_accounts set seller_type='trader',onboarding_status='active',country_code='DE'
where seller_id='10000000-0000-4000-8000-000000000002';
insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,street_line1,postal_code,city,country_code,business_name,public_email)
values('10000000-0000-4000-8000-000000000002','Synthetic','Seller','Test 1','75100','Test','DE','Fixture','seller@invalid.example');
insert into dv_market_private.market_stripe_accounts(seller_id,stripe_account_id,onboarding_status,charges_enabled,details_submitted)
values('10000000-0000-4000-8000-000000000002','acct_P005Fixture','ready',true,true);
update dv_market_private.market_payment_configuration set sandbox_enabled=true;
insert into public.market_listings(id,seller_id,tcg,card_name,status,listing_type,pricing_mode,product_kind,sealed_category,sealed_condition,stock_quantity,quantity_available,asking_price,shipping_method,shipping_cost)
select ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
'10000000-0000-4000-8000-000000000002','pokemon','Synthetic P005','active','sale',case when i<=2 then 'fixed' else 'negotiable' end,'sealed','booster','factory_sealed',10,10,10,'parcel',2
from generate_series(1,4)i;

insert into public.market_listings(id,seller_id,tcg,card_name,status,product_kind,shipping_method) values('60000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','pokemon','Synthetic erasure','withdrawn','single','pickup');
