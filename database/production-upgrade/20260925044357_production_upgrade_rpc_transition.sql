-- P0-01 candidate only; no Production authorization.
-- Must run in the SAME transaction as b07-l07-01-release1-shipping-close-v1.sql.
-- Its expanded TABLE return type cannot replace the earlier lifecycle signature.
-- RESTRICT intentionally fails on any unexpected catalog dependency. Never CASCADE.
drop function public.get_my_market_order_b07_status() restrict;
