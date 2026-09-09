-- DUELVANTA TRADE shipping profile fallback fix
-- Preserve the current/preliminary shipping method + cost when no automatic
-- seller profile rule matches. Prevents NULL shipping_cost / shipping_method
-- during combined-order recalculation.

create or replace function public.recalculate_market_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.market_orders;
  v_count integer:=0;
  v_units integer:=0;
  v_sub numeric:=0;
  v_sep numeric:=0;
  v_auto_cost numeric:=0;
  v_fallback_cost numeric:=0;
  v_weight integer:=0;
  v_method text:='custom';
  v_fallback_method text:='custom';
  v_review boolean:=false;
  v_custom boolean:=false;
  v_missing_weight boolean:=false;
  v_has_sealed boolean:=false;
  v_has_cards boolean:=false;
  v_missing_sealed_dims boolean:=false;
  v_max_l integer:=0;
  v_max_w integer:=0;
  v_max_h integer:=0;
  v_same_shape boolean:=false;
  v_keep_confirmed boolean:=false;
  v_combined boolean:=false;
  v_country text;
  v_profile uuid;
  v_rule uuid;
  v_candidate_method text;
  v_candidate_cost numeric;
  v_profile_name text;
  v_carrier text;
  v_note text;
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or o.status not in ('open','in_progress') then return; end if;

  select count(*)::integer,
         coalesce(sum(i.quantity),0)::integer,
         coalesce(sum(i.item_amount),0),
         coalesce(sum(i.individual_shipping_cost),0),
         coalesce(max(i.individual_shipping_cost),0),
         coalesce(sum(coalesce(i.weight_grams,0)),0)::integer,
         coalesce(bool_or(i.shipping_method='custom'),false),
         coalesce(bool_or(i.weight_grams is null),false),
         coalesce(bool_or(d.product_kind='sealed'),false),
         coalesce(bool_or(d.product_kind in ('single','graded')),false),
         coalesce(bool_or(d.product_kind='sealed' and (d.length_mm is null or d.width_mm is null or d.height_mm is null)),false),
         coalesce(max(case when d.product_kind='sealed' then d.length_mm else 0 end),0),
         coalesce(max(case when d.product_kind='sealed' then d.width_mm else 0 end),0),
         coalesce(max(case when d.product_kind='sealed' then d.height_mm else 0 end),0)
  into v_count,v_units,v_sub,v_sep,v_auto_cost,v_weight,v_custom,v_missing_weight,
       v_has_sealed,v_has_cards,v_missing_sealed_dims,v_max_l,v_max_w,v_max_h
  from public.market_order_items i
  join public.market_deals d on d.id=i.deal_id
  where i.order_id=p_order_id and d.status<>'cancelled';

  if v_count=0 then
    update public.market_orders
    set status='cancelled',item_count=0,subtotal=0,separate_shipping_sum=0,
        shipping_cost=0,total_amount=0,shipping_savings=0,
        cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
    where id=p_order_id;
    return;
  end if;

  v_fallback_cost:=coalesce(v_auto_cost,0);
  select a.country_code into v_country
  from public.market_order_shipping_addresses a where a.order_id=p_order_id;

  v_same_shape:=(o.item_count=v_count and o.subtotal=v_sub and o.separate_shipping_sum=v_sep and o.total_weight_grams=v_weight);
  v_keep_confirmed:=(o.shipping_quote_status='confirmed' and v_same_shape and (o.shipping_quote_country_code is null or o.shipping_quote_country_code is not distinct from v_country));

  if v_keep_confirmed then
    update public.market_orders
    set item_count=v_count,subtotal=round(v_sub,2),separate_shipping_sum=round(v_sep,2),
        total_weight_grams=v_weight,shipping_quote_country_code=coalesce(o.shipping_quote_country_code,v_country),
        total_amount=round(v_sub+coalesce(o.shipping_cost,0),2),
        shipping_savings=round(v_sep-coalesce(o.shipping_cost,0),2),updated_at=now()
    where id=p_order_id;
    return;
  end if;

  if o.fulfillment_group='pickup' then
    v_method:='pickup';
    v_auto_cost:=0;
    v_review:=false;
    v_country:=null;
  else
    select case max(case i.shipping_method when 'standard_letter' then 1 when 'tracked_letter' then 2 when 'parcel' then 3 when 'custom' then 4 else 0 end)
             when 1 then 'standard_letter' when 2 then 'tracked_letter' when 3 then 'parcel' else 'custom' end
    into v_method
    from public.market_order_items i
    join public.market_deals d on d.id=i.deal_id
    where i.order_id=p_order_id and d.status<>'cancelled';

    v_method:=coalesce(v_method,'custom');
    v_fallback_method:=v_method;
    v_auto_cost:=v_fallback_cost;
    v_combined:=(v_count>1 or v_units>1);

    if not v_combined then
      v_review:=v_custom;
      if v_review then v_note:='Versand nach Absprache muss vom Verkäufer bestätigt werden.'; end if;
    elsif v_custom or v_country is null then
      v_review:=true;
      v_note:='Combined Shipping muss vom Verkäufer geprüft werden.';
    else
      select p.id,r.id,p.shipping_method,r.shipping_cost,p.name,p.carrier_label
      into v_profile,v_rule,v_candidate_method,v_candidate_cost,v_profile_name,v_carrier
      from public.market_shipping_profiles p
      join public.market_shipping_profile_rules r on r.profile_id=p.id
      where p.seller_id=o.seller_id
        and p.is_active
        and p.destination_country_code=v_country
        and (p.product_scope='all' or (p.product_scope='cards' and not v_has_sealed) or (p.product_scope='sealed' and not v_has_cards))
        and (r.max_units is null or v_units<=r.max_units)
        and (r.max_weight_grams is null or (not v_missing_weight and v_weight<=r.max_weight_grams))
        and (not v_has_sealed or r.max_length_mm is null or (not v_missing_sealed_dims and v_max_l<=r.max_length_mm))
        and (not v_has_sealed or r.max_width_mm is null or (not v_missing_sealed_dims and v_max_w<=r.max_width_mm))
        and (not v_has_sealed or r.max_height_mm is null or (not v_missing_sealed_dims and v_max_h<=r.max_height_mm))
      order by r.shipping_cost asc,p.created_at asc,r.sort_order asc,p.id
      limit 1;

      if v_profile is null then
        v_review:=true;
        v_method:=v_fallback_method;
        v_auto_cost:=v_fallback_cost;
        v_note:='Keine sichere Versandprofil-Regel passt auf diese Order. Verkäufer prüft den Gesamtversand.';
      else
        v_review:=false;
        v_method:=coalesce(v_candidate_method,v_fallback_method);
        v_auto_cost:=coalesce(v_candidate_cost,v_fallback_cost);
        v_note:=left('Automatisch nach Versandprofil: '||v_profile_name||coalesce(' · '||nullif(v_carrier,''),''),240);
      end if;
    end if;
  end if;

  v_method:=coalesce(v_method,'custom');
  v_auto_cost:=coalesce(v_auto_cost,0);

  update public.market_orders
  set item_count=v_count,
      subtotal=round(v_sub,2),
      separate_shipping_sum=round(v_sep,2),
      total_weight_grams=v_weight,
      shipping_method=v_method,
      shipping_cost=round(v_auto_cost,2),
      shipping_quote_status=case when v_review then 'review_required' else 'auto' end,
      shipping_note=v_note,
      shipping_profile_id=case when v_review then null else v_profile end,
      shipping_profile_rule_id=case when v_review then null else v_rule end,
      shipping_quote_country_code=v_country,
      total_amount=round(v_sub+v_auto_cost,2),
      shipping_savings=round(v_sep-v_auto_cost,2),
      payment_status=case when payment_provider='stripe_connect' and paid_amount>0 and paid_amount<round(v_sub+v_auto_cost,2) then 'balance_due' else payment_status end,
      updated_at=now()
  where id=p_order_id;
end;
$$;

revoke all on function public.recalculate_market_order(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_market_order(uuid) to service_role;
