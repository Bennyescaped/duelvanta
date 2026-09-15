-- DUELVANTA B06 review-only migration.
-- Do not apply to production before the documented rollout/migration block.
begin;

create or replace function public.require_duelvanta_privileged_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt jsonb := auth.jwt();
  v_uid uuid := auth.uid();
  v_session_id uuid;
begin
  -- Trusted server calls remain possible without a user MFA session.
  if coalesce(v_jwt->>'role','') = 'service_role' then
    return;
  end if;
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(v_jwt->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_step_up_required';
  end if;
  begin
    v_session_id := nullif(v_jwt->>'session_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'session_revoked';
  end;
  if v_session_id is null or not exists (
    select 1 from auth.sessions s where s.id = v_session_id and s.user_id = v_uid
  ) then
    raise exception 'session_revoked';
  end if;
end;
$$;
revoke all on function public.require_duelvanta_privileged_session() from public, anon, authenticated;
grant execute on function public.require_duelvanta_privileged_session() to service_role;

-- Keep the existing, already-tested business logic as private cores and place a
-- uniform AAL2 + live-session boundary in front of the public RPC names.
alter function public.join_battle_as_moderator(uuid) rename to dv_core_join_battle_as_moderator;
alter function public.leave_battle_moderation(uuid,text) rename to dv_core_leave_battle_moderation;
alter function public.moderate_battle_report(uuid,text,text) rename to dv_core_moderate_battle_report;
alter function public.review_battle_report(uuid,text,text) rename to dv_core_review_battle_report;
alter function public.review_staff_application(uuid,text,text) rename to dv_core_review_staff_application;
alter function public.set_battle_moderation_pause(uuid,boolean,text) rename to dv_core_set_battle_moderation_pause;
alter function public.set_staff_permission(uuid,text,boolean) rename to dv_core_set_staff_permission;
alter function public.set_staff_role(uuid,text,text) rename to dv_core_set_staff_role;

revoke all on function public.dv_core_join_battle_as_moderator(uuid) from public, anon, authenticated;
revoke all on function public.dv_core_leave_battle_moderation(uuid,text) from public, anon, authenticated;
revoke all on function public.dv_core_moderate_battle_report(uuid,text,text) from public, anon, authenticated;
revoke all on function public.dv_core_review_battle_report(uuid,text,text) from public, anon, authenticated;
revoke all on function public.dv_core_review_staff_application(uuid,text,text) from public, anon, authenticated;
revoke all on function public.dv_core_set_battle_moderation_pause(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.dv_core_set_staff_permission(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.dv_core_set_staff_role(uuid,text,text) from public, anon, authenticated;

create function public.join_battle_as_moderator(p_match_id uuid)
returns uuid language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_join_battle_as_moderator(p_match_id); end $$;
create function public.leave_battle_moderation(p_match_id uuid,p_note text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_leave_battle_moderation(p_match_id,p_note); end $$;
create function public.moderate_battle_report(p_report_id uuid,p_action text,p_note text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_moderate_battle_report(p_report_id,p_action,p_note); end $$;
create function public.review_battle_report(p_report_id uuid,p_action text,p_note text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_review_battle_report(p_report_id,p_action,p_note); end $$;
create function public.review_staff_application(p_application_id uuid,p_decision text,p_note text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_review_staff_application(p_application_id,p_decision,p_note); end $$;
create function public.set_battle_moderation_pause(p_match_id uuid,p_paused boolean,p_note text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_set_battle_moderation_pause(p_match_id,p_paused,p_note); end $$;
create function public.set_staff_permission(p_user_id uuid,p_permission text,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_set_staff_permission(p_user_id,p_permission,p_enabled); end $$;
create function public.set_staff_role(p_user_id uuid,p_role text,p_reason text default null)
returns text language plpgsql security definer set search_path='public' as $$
begin perform public.require_duelvanta_privileged_session(); return public.dv_core_set_staff_role(p_user_id,p_role,p_reason); end $$;

revoke all on function public.join_battle_as_moderator(uuid) from public, anon;
revoke all on function public.leave_battle_moderation(uuid,text) from public, anon;
revoke all on function public.moderate_battle_report(uuid,text,text) from public, anon;
revoke all on function public.review_battle_report(uuid,text,text) from public, anon;
revoke all on function public.review_staff_application(uuid,text,text) from public, anon;
revoke all on function public.set_battle_moderation_pause(uuid,boolean,text) from public, anon;
revoke all on function public.set_staff_permission(uuid,text,boolean) from public, anon;
revoke all on function public.set_staff_role(uuid,text,text) from public, anon;
grant execute on function public.join_battle_as_moderator(uuid),public.leave_battle_moderation(uuid,text),public.moderate_battle_report(uuid,text,text),public.review_battle_report(uuid,text,text),public.review_staff_application(uuid,text,text),public.set_battle_moderation_pause(uuid,boolean,text),public.set_staff_permission(uuid,text,boolean),public.set_staff_role(uuid,text,text) to authenticated, service_role;

-- Advisor hardening: these helpers are internal/self-scoped and do not need an
-- unauthenticated RPC surface. Public read-only profile/leaderboard RPCs remain intentional.
revoke execute on function public.assign_founder_generation_i() from public, anon, authenticated;
revoke execute on function public.guard_profile_username_direct_update() from public, anon, authenticated;
revoke execute on function public.handle_duelvanta_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_duelvanta_owner_delete() from public, anon, authenticated;
revoke execute on function public.protect_duelvanta_owner_profile() from public, anon, authenticated;
revoke execute on function public.has_staff_permission(text,uuid) from public, anon;
revoke execute on function public.is_duelvanta_admin(uuid) from public, anon;
revoke execute on function public.is_duelvanta_owner(uuid) from public, anon;
revoke execute on function public.get_my_battle_history(integer) from public, anon;
revoke execute on function public.get_my_market_deals() from public, anon;
grant execute on function public.has_staff_permission(text,uuid),public.is_duelvanta_admin(uuid),public.is_duelvanta_owner(uuid),public.get_my_battle_history(integer),public.get_my_market_deals() to authenticated, service_role;

commit;
