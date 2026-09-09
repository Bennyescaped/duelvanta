-- DUELVANTA TRADE shipping profiles V1 hardening
-- Keep the address-change recalculation trigger explicit for INSERT/UPDATE/DELETE.
-- No existing address/order rows are modified.

create or replace function public.recalc_market_order_after_address_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_order uuid;
begin
  if tg_op='DELETE' then
    v_order:=old.order_id;
  else
    v_order:=new.order_id;
  end if;

  if exists(select 1 from public.market_order_items where order_id=v_order) then
    perform public.recalculate_market_order(v_order);
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.recalc_market_order_after_address_change() from public, anon, authenticated;
grant execute on function public.recalc_market_order_after_address_change() to service_role;
