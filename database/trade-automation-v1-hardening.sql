-- DUELVANTA TRADE automation V1 hardening
-- 1) Pin SECURITY DEFINER search paths.
-- 2) Link future accepted-offer notifications to the resulting DUELVANTA Order.
-- No existing notifications, deals or orders are backfilled or modified.

alter function public.emit_market_offer_notification() set search_path = '';
alter function public.emit_market_purchase_notification() set search_path = '';
alter function public.emit_market_order_status_notification() set search_path = '';
alter function public.get_my_market_notifications(integer) set search_path = '';
alter function public.mark_market_notification_read(uuid) set search_path = '';
alter function public.mark_all_market_notifications_read() set search_path = '';
alter function public.get_my_trade_actions() set search_path = '';

create or replace function public.link_offer_notification_to_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.offer_id is null or new.order_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.order_id is not distinct from new.order_id then
    return new;
  end if;

  update public.market_notifications
  set order_id = new.order_id
  where dedupe_key = 'offer_accepted:' || new.offer_id::text
    and recipient_id = new.buyer_id
    and order_id is null;

  return new;
end;
$$;

revoke all on function public.link_offer_notification_to_order() from public, anon, authenticated;
grant execute on function public.link_offer_notification_to_order() to service_role;

drop trigger if exists trg_link_offer_notification_to_order on public.market_deals;
create trigger trg_link_offer_notification_to_order
after insert or update of order_id on public.market_deals
for each row execute function public.link_offer_notification_to_order();
