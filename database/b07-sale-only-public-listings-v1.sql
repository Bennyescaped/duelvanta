-- V22: public read model excludes retired trade-only listings.
-- DUELVANTA B07 / L07-01 public listing/share read model.
-- REVIEW/STAGING ONLY. No private seller, address, contact or payment data is exposed.
-- Public visibility is limited to currently active listings with available stock.

create or replace function public.get_public_market_listing_v1(p_listing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'listing_id',l.id,
    'listing_type',l.listing_type,
    'pricing_mode',l.pricing_mode,
    'asking_price',l.asking_price,
    'currency',l.currency,
    'tcg',l.tcg,
    'card_name',l.card_name,
    'set_name',l.set_name,
    'card_number',l.card_number,
    'language',l.language,
    'variant',l.variant,
    'condition',l.condition,
    'grading_company',l.grading_company,
    'grade',l.grade,
    'product_kind',l.product_kind,
    'sealed_category',l.sealed_category,
    'sealed_condition',l.sealed_condition,
    'bundle_quantity',l.bundle_quantity,
    'package_contents',l.package_contents,
    'shipping_method',l.shipping_method,
    'shipping_cost',l.shipping_cost,
    'quantity_available',l.quantity_available,
    'published_at',l.published_at,
    'active_until',l.active_until
  )
  from public.market_listings l
  where l.id=p_listing_id
    and l.status='active'
    and l.listing_type in ('sale','sale_or_trade')
    and coalesce(l.quantity_available,1)>0
    and (l.active_until is null or l.active_until>now())
  limit 1
$$;

revoke all on function public.get_public_market_listing_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_public_market_listing_v1(uuid) to anon,authenticated;

comment on function public.get_public_market_listing_v1(uuid) is
  'Release-1 share read model. Deliberately excludes seller identity, nickname, notes, storage path, contact, address and transaction data.';

notify pgrst,'reload schema';
