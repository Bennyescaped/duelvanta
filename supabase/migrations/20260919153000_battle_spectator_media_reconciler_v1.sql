-- Narrow service-role bridge for the Spectator Media revocation reconciler.
-- The private schema remains unavailable through the Data API.
begin;

create or replace function public.get_pending_battle_spectator_media_revocations(
  p_limit integer default 25
)
returns table(id bigint, match_id uuid, epoch uuid)
language sql
security definer
set search_path = ''
as $function$
  select r.id, r.match_id, r.epoch
  from battle_spectator_media_private.revocations r
  where r.state = 'pending'
  order by r.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$function$;

create or replace function public.complete_battle_spectator_media_revocation(
  p_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update battle_spectator_media_private.revocations
  set state = 'done'
  where id = p_id
    and state = 'pending';

  return found;
end
$function$;

revoke all on function public.get_pending_battle_spectator_media_revocations(integer) from public, anon, authenticated;
revoke all on function public.complete_battle_spectator_media_revocation(bigint) from public, anon, authenticated;
grant execute on function public.get_pending_battle_spectator_media_revocations(integer) to service_role;
grant execute on function public.complete_battle_spectator_media_revocation(bigint) to service_role;

notify pgrst, 'reload schema';
commit;
