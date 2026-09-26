-- DUELVANTA B07 / L07-01 shipping-deadline hardening.
-- REVIEW/STAGING FIRST. No payment, payout, refund or fee execution.

alter table public.market_orders
  add column if not exists shipping_due_at timestamptz;

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.b07_add_workdays_de(
  p_start timestamptz,
  p_days integer
) returns timestamptz
language plpgsql
stable
set search_path=pg_catalog
as $$
declare
  v_local timestamp without time zone := p_start at time zone 'Europe/Berlin';
  v_count integer := 0;
begin
  if p_start is null or p_days is null or p_days<0 then return null; end if;
  while v_count<p_days loop
    v_local:=v_local+interval '1 day';
    -- Release 1 definition: Werktage are Monday-Saturday; Sunday is excluded.
    if extract(isodow from v_local)<7 then v_count:=v_count+1; end if;
  end loop;
  return v_local at time zone 'Europe/Berlin';
end
$$;
revoke all on function dv_market_private.b07_add_workdays_de(timestamptz,integer)
  from public,anon,authenticated;

create or replace function dv_market_private.b07_set_shipping_due()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare
  v_should_set boolean:=false;
  v_start timestamptz;
begin
  if tg_op='INSERT' then
    v_should_set:=new.fulfillment_group='shipping'
      and new.payment_status='paid'
      and new.shipping_due_at is null;
  else
    v_should_set:=new.fulfillment_group='shipping'
      and new.payment_status='paid'
      and new.shipping_due_at is null
      and (
        old.payment_status is distinct from 'paid'
        or old.fulfillment_group is distinct from 'shipping'
      );
  end if;

  if v_should_set then
    v_start:=coalesce(new.paid_at,now());
    new.shipping_due_at:=dv_market_private.b07_add_workdays_de(v_start,3);
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.b07_set_shipping_due()
  from public,anon,authenticated;

drop trigger if exists b07_set_shipping_due on public.market_orders;
create trigger b07_set_shipping_due
before insert or update of payment_status,fulfillment_group on public.market_orders
for each row execute function dv_market_private.b07_set_shipping_due();
