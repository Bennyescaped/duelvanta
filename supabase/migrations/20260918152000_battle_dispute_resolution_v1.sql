-- Judge resolution for BATTLE disputes. Server-authorized, audited and single-shot.
begin;

create or replace function public.resolve_battle_dispute(
  p_match_id uuid,
  p_result text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_match public.battle_matches%rowtype;
  v_winner uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_staff_permission('battle_moderate', v_uid) then
    raise exception 'battle_moderate permission required';
  end if;
  if p_result not in ('host','guest','draw') then
    raise exception 'Invalid dispute result';
  end if;

  select * into v_match from public.battle_matches where id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_uid in (v_match.host_id, coalesce(v_match.guest_id,v_match.host_id)) then
    raise exception 'Players cannot resolve own match';
  end if;
  if v_match.status <> 'dispute' then
    raise exception 'Match is not in dispute';
  end if;
  if v_match.guest_id is null then raise exception 'Match has no opponent'; end if;

  v_winner := case when p_result='host' then v_match.host_id
                   when p_result='guest' then v_match.guest_id
                   else null end;

  update public.battle_matches
     set status='completed',
         winner_id=v_winner,
         completed_at=now(),
         moderation_state='resolved',
         moderator_id=coalesce(moderator_id,v_uid),
         moderator_joined_at=coalesce(moderator_joined_at,now()),
         moderation_note=left(nullif(trim(p_note),''),1000),
         paused_at=null,
         paused_by=null,
         updated_at=now()
   where id=p_match_id;

  insert into public.admin_audit_log(actor_id,action,details)
  values(v_uid,'battle_dispute_resolved',
         jsonb_build_object('match_id',p_match_id,'result',p_result,'note',left(p_note,1000)));

  return 'completed';
end
$function$;

revoke execute on function public.resolve_battle_dispute(uuid,text,text) from public, anon;
grant execute on function public.resolve_battle_dispute(uuid,text,text) to authenticated, service_role;

commit;
