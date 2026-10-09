-- T3/D3 closed subset. Offline candidate; no live authorization.
-- No pre-Hold report/dispute exception: V81 result B remains HARD STOP.
-- Preserve existing function identities, ACL, session helpers and read paths.
begin;
do $d3$
declare sig text; f record; body text; guard text; lookup text; check_case text; exemption text;
begin
 foreach sig in array array[
  'public.join_battle_as_moderator(uuid)',
  'public.set_battle_moderation_pause(uuid,boolean,text)',
  'public.leave_battle_moderation(uuid,text)',
  'public.resolve_battle_dispute(uuid,text,text)',
  'public.moderate_battle_report(uuid,text,text)',
  'public.review_battle_report(uuid,text,text)',
  'public.review_staff_application(uuid,text,text)',
  'public.set_staff_role(uuid,text,text)',
  'public.set_staff_permission(uuid,text,boolean)',
  'dv_v16_private.update_openai_scan_policy_for_caller(boolean,integer,integer,integer)'
 ] loop
  select p.oid,p.prosrc,l.lanname,pg_get_functiondef(p.oid) definition into strict f
   from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(sig);
  if f.lanname<>'plpgsql' then raise exception 'unexpected_d3_language: %',sig; end if;
  if position('-- D3 closed mutation boundary v1' in f.prosrc)>0 then continue; end if;
  body:=f.prosrc; lookup:=''; check_case:=''; exemption:='false';
  if sig like 'public.%battle%moderator%' or sig like 'public.%battle_moderation%' or sig like 'public.resolve_battle_dispute%' then
   lookup:='select array[m.host_id,m.guest_id] into d3_targets from public.battle_matches m where m.id=p_match_id;';
   check_case:='perform 1 from public.battle_matches m where m.id=p_match_id and array[m.host_id,m.guest_id] is not distinct from d3_targets for update; if not found then raise exception ''d3_case_changed_or_missing'' using errcode=''42501''; end if;';
  elsif sig like 'public.%battle_report%' then
   lookup:='select array[r.reported_user_id] into d3_targets from public.battle_reports r where r.id=p_report_id;';
   check_case:='perform 1 from public.battle_reports r where r.id=p_report_id and array[r.reported_user_id] is not distinct from d3_targets for update; if not found then raise exception ''d3_case_changed_or_missing'' using errcode=''42501''; end if;';
  elsif sig like 'public.review_staff_application%' then
   lookup:='select array[a.applicant_id] into d3_targets from public.staff_applications a where a.id=p_application_id;';
   check_case:='perform 1 from public.staff_applications a where a.id=p_application_id and array[a.applicant_id] is not distinct from d3_targets for update; if not found then raise exception ''d3_case_changed_or_missing'' using errcode=''42501''; end if;';
  elsif sig like 'public.set_staff_%' then
   lookup:='d3_targets:=array[p_user_id];';
   if sig like 'public.set_staff_permission%' then
    exemption:='p_enabled is false and public.is_duelvanta_owner(auth.uid()) and d3_profile.role in (''admin'',''moderator'',''judge'') and exists(select 1 from public.staff_permissions where user_id=p_user_id and permission=p_permission)';
   else
    exemption:='p_role=''player'' and public.is_duelvanta_owner(auth.uid()) and d3_profile.role in (''admin'',''moderator'',''judge'')';
   end if;
  end if;
  if sig='public.review_battle_report(uuid,text,text)' then
   if position('reviewed_at=now(),' in body)=0 then raise exception 'unexpected_review_body'; end if;
   body:=replace(body,'elsif p_action in (''resolve'',''dismiss'',''warning'',''restrict'') then if p_action=''restrict'' then update public.profiles set safety_restricted=true,updated_at=now() where id=v_report.reported_user_id; end if;',
    'elsif p_action in (''warning'',''restrict'') then raise exception ''review_action_disabled'' using errcode=''42501''; elsif p_action in (''resolve'',''dismiss'') then if not public.has_staff_permission(''reports_review'',v_uid) then raise exception ''reports_review permission required''; end if; if public.is_duelvanta_owner(v_report.reported_user_id) then raise exception ''Owner cannot be targeted by moderation actions''; end if; if v_report.status not in (''open'',''reviewing'') then raise exception ''report_already_closed''; end if;');
   body:=replace(body,'reviewed_at=now(),','');
   body:=replace(body,'resolution_action=case when p_action in (''warning'',''restrict'') then p_action else ''none'' end','resolution_action=''none''');
   if position('review_action_disabled' in body)=0 or position('set safety_restricted=true' in body)>0 then raise exception 'unexpected_review_branch'; end if;
  end if;
  -- Profile locks precede case locks, consistent with G1/D2 Closure ordering.
  -- Lock the existing actor/targets, never a caller-supplied bypass identity.
  -- NO KEY UPDATE conflicts with the real marker UPDATE (KEY SHARE would not).
  -- Under repeatable read a concurrently changed profile raises serialization
  -- failure; it cannot authorize from an old visible marker value.
  guard:=format($guard$
declare d3_targets uuid[]:=array[]::uuid[]; d3_profile record; d3_actor_found boolean:=false;
begin
 -- D3 closed mutation boundary v1
 perform public.require_duelvanta_privileged_session();
 %s
 for d3_profile in select id,data_processing_restricted_at,role from public.profiles
   where id=auth.uid() or id=any(d3_targets) order by id for no key update loop
  if d3_profile.id=auth.uid() then
   d3_actor_found:=true;
   if d3_profile.data_processing_restricted_at is not null then
    raise exception 'staff_actor_processing_hold' using errcode='42501';
   end if;
  end if;
  if d3_profile.id=any(d3_targets) and d3_profile.data_processing_restricted_at is not null and not coalesce((%s),false) then
   raise exception 'staff_target_processing_hold' using errcode='42501';
  end if;
 end loop;
 if not d3_actor_found then raise exception 'not_authenticated' using errcode='42501'; end if;
 -- Recheck the unchanged real session gate after waiting on actor/profile locks.
 perform public.require_duelvanta_privileged_session();
 %s
 %s;
end
$guard$,lookup,exemption,check_case,rtrim(body,E' \n\t;'));
  execute replace(f.definition,f.prosrc,guard);
 end loop;
end $d3$;
commit;
