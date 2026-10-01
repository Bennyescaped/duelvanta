-- Prevent the v2 rollout from turning historical TRADE activity into unread noise.
create table if not exists public.market_notification_sync_state (
  version text primary key,
  cutover_at timestamptz not null default now()
);

insert into public.market_notification_sync_state(version, cutover_at)
values ('v2', now())
on conflict (version) do nothing;

revoke all on table public.market_notification_sync_state from public, anon, authenticated;

create or replace function public.normalize_market_notification_v2_read_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutover timestamptz;
begin
  if new.kind = any(array[
    'swap_proposed','swap_revised','swap_confirmed','swap_bound','swap_shipped','swap_received',
    'swap_pickup_code','swap_pickup_confirmed','swap_completed','swap_problem_opened',
    'swap_problem_response','swap_problem_closed','pickup_message'
  ]::text[]) and new.read_at is null then
    select s.cutover_at into v_cutover
    from public.market_notification_sync_state s
    where s.version = 'v2';
    if v_cutover is not null and new.created_at < v_cutover then
      new.read_at := new.created_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_market_notification_v2_read_state() from public, anon, authenticated;

drop trigger if exists trg_market_notification_v2_read_state on public.market_notifications;
create trigger trg_market_notification_v2_read_state
before insert on public.market_notifications
for each row execute function public.normalize_market_notification_v2_read_state();

update public.market_notifications n
set read_at = n.created_at
from public.market_notification_sync_state s
where s.version = 'v2'
  and n.read_at is null
  and n.created_at < s.cutover_at
  and n.kind = any(array[
    'swap_proposed','swap_revised','swap_confirmed','swap_bound','swap_shipped','swap_received',
    'swap_pickup_code','swap_pickup_confirmed','swap_completed','swap_problem_opened',
    'swap_problem_response','swap_problem_closed','pickup_message'
  ]::text[]);
