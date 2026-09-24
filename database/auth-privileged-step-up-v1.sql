-- Step 9A review-only candidate. Supersedes the unapplied B06 rename-wrapper draft.
-- Apply in disposable tests first; no live authorization is implied.
-- Human administrative actions never accept a service_role/MFA bypass.
begin;
create or replace function public.has_duelvanta_privileged_session()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare j jsonb:=auth.jwt(); u uuid:=auth.uid(); sid uuid;
begin
  if u is null or j->>'role' is distinct from 'authenticated'
     or j->>'aal' is distinct from 'aal2' or coalesce((j->>'is_anonymous')::boolean,false) then return false; end if;
  sid:=nullif(j->>'session_id','')::uuid;
  return exists(select 1 from auth.sessions s
    join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
    join public.profiles p on p.id=s.user_id
    where s.id=sid and s.user_id=u and s.aal::text='aal2'
      and (s.not_after is null or s.not_after>statement_timestamp())
      and f.status::text='verified'
      and p.account_status in ('active','beta') and not coalesce(p.safety_restricted,false)
      and p.role in ('owner','admin','moderator','judge'));
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.has_duelvanta_privileged_session() from public,anon,authenticated,service_role;
grant execute on function public.has_duelvanta_privileged_session() to authenticated;

create or replace function public.require_duelvanta_privileged_session()
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if auth.jwt()->>'role' is distinct from 'authenticated' then raise exception 'human_session_required' using errcode='42501'; end if;
  if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_step_up_required' using errcode='42501'; end if;
  if not public.has_duelvanta_privileged_session() then raise exception 'privileged_session_required' using errcode='42501'; end if;
end $$;
revoke all on function public.require_duelvanta_privileged_session() from public,anon,authenticated,service_role;
grant execute on function public.require_duelvanta_privileged_session() to authenticated;

-- Preserve OIDs, signatures, business authorization and grants: no reachable private cores.
-- The explicit list is reviewed against the versioned baseline, not discovered by name at runtime.
do $patch$
declare sig text; f record; body text;
begin
  foreach sig in array array[
    'public.join_battle_as_moderator(uuid)', 'public.leave_battle_moderation(uuid,text)',
    'public.moderate_battle_report(uuid,text,text)', 'public.review_battle_report(uuid,text,text)',
    'public.review_staff_application(uuid,text,text)', 'public.set_battle_moderation_pause(uuid,boolean,text)',
    'public.set_staff_permission(uuid,text,boolean)', 'public.set_staff_role(uuid,text,text)'
  ] loop
    select p.oid,p.prosrc,l.lanname,pg_get_functiondef(p.oid) definition into strict f
      from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(sig);
    if f.lanname<>'plpgsql' then raise exception 'unexpected_privileged_function_language: %',sig; end if;
    if position('perform public.require_duelvanta_privileged_session();' in f.prosrc)=0 then
      body:=regexp_replace(f.prosrc,'\mbegin\M','begin perform public.require_duelvanta_privileged_session();','i');
      if body=f.prosrc then raise exception 'privileged_body_not_patchable: %',sig; end if;
      execute replace(f.definition,f.prosrc,body);
    end if;
    execute format('revoke all on function %s from public,anon,authenticated,service_role',sig);
    execute format('grant execute on function %s to authenticated',sig);
  end loop;
  -- If the older, unapplied draft was installed elsewhere, fail closed on its alternate names.
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'dv_core_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $patch$;
commit;
