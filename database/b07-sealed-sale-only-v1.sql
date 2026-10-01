-- B07: Sealed products are sale-only. C2C swap remains limited to card listings.

alter table public.market_listings
  drop constraint if exists market_listings_sealed_sale_only_ck;

alter table public.market_listings
  add constraint market_listings_sealed_sale_only_ck
  check (product_kind is distinct from 'sealed' or listing_type = 'sale');

comment on constraint market_listings_sealed_sale_only_ck on public.market_listings is
  'Sealed listings cannot be trade or sale_or_trade; sealed products are sale-only.';
