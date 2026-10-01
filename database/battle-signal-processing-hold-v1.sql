-- G5: new signal INSERTs only. Existing RLS/ACL and Clear/SELECT stay unchanged.
-- Reviewed branch candidate after G4; no live application by this file.
begin;
create or replace function public.guard_battle_signal_processing_hold()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare restricted_at timestamptz;
begin
  -- RLS continues to bind authenticated sender_id to auth.uid() and participation.
  -- Check the actual sender also in privileged INSERT contexts; no role exception.
  select p.data_processing_restricted_at into restricted_at
    from public.profiles p where p.id = new.sender_id for share;
  if restricted_at is not null then
    raise exception using errcode = '42501', message = 'account_data_processing_restricted';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_battle_signal_processing_hold() from public, anon, authenticated, service_role;
drop trigger if exists battle_signal_processing_hold on public.battle_signals;
create trigger battle_signal_processing_hold before insert on public.battle_signals
for each row execute function public.guard_battle_signal_processing_hold();
commit;
