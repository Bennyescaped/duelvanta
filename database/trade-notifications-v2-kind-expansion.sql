-- Extend notification kinds for TRADE notifications v2.
alter table public.market_notifications
  drop constraint if exists market_notifications_kind_check;

alter table public.market_notifications
  add constraint market_notifications_kind_check check (kind in (
    'purchase',
    'offer_received',
    'offer_accepted',
    'order_shipped',
    'order_received',
    'cancellation_requested',
    'cancellation_accepted',
    'cancellation_declined',
    'cancellation_withdrawn',
    'problem_opened',
    'problem_response',
    'problem_withdrawn',
    'swap_proposed',
    'swap_revised',
    'swap_confirmed',
    'swap_bound',
    'swap_shipped',
    'swap_received',
    'swap_pickup_code',
    'swap_pickup_confirmed',
    'swap_completed',
    'swap_problem_opened',
    'swap_problem_response',
    'swap_problem_closed',
    'pickup_message'
  ));
