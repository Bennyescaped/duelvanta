\set ON_ERROR_STOP on

-- Mirror the actual DUELVANTA staging schema discovered during B07 acceptance.
-- market_offers has no reservation_expires_at column.
alter table public.market_offers drop column if exists reservation_expires_at;
