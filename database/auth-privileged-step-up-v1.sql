-- Step 9A review-only candidate. Supersedes the unapplied B06 rename-wrapper draft.
-- Apply in disposable tests first; no live authorization is implied.
-- Human administrative actions never accept a service_role/MFA bypass.
begin;
-- Step 9B: project-local immutable operator binding. Data is provisioned by the
-- database administrator from the verified operator account, never browser input.
create table if not exists dv_v16_private.operator_identity_v1 (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table dv_v16_private.operator_identity_v1 enable row level security;
revoke all on dv_v16_private.operator_identity_v1 from public,anon,authenticated,service_role;
-- No update on reapplication: email reassignment must never transfer ownership.
insert into dv_v16_private.operator_identity_v1(singleton,user_id)
select true,u.id from auth.users u join public.profiles p on p.id=u.id
where lower(u.email)='info@duelvanta.de' and u.email_confirmed_at is not null
  and p.role='owner' and p.account_status in ('active','beta')
  and not coalesce(p.safety_restricted,false)
on conflict (singleton) do nothing;

create or replace function public.is_duelvanta_owner(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $owner$
  select exists(select 1 from dv_v16_private.operator_identity_v1 b
    join auth.users u on u.id=b.user_id
    where b.singleton and b.user_id=p_uid
      and lower(u.email)='info@duelvanta.de' and u.email_confirmed_at is not null);
$owner$;

create or replace function public.protect_duelvanta_owner_profile()
returns trigger language plpgsql security definer set search_path='' as $owner$
declare bound_uid uuid;
begin
  select user_id into bound_uid from dv_v16_private.operator_identity_v1 where singleton;
  if old.id=bound_uid then
    if new.id is distinct from old.id or new.role is distinct from 'owner'
       or lower(new.email) is distinct from 'info@duelvanta.de'
       or new.account_status not in ('active','beta') then
      raise exception 'DUELVANTA owner identity is protected';
    end if;
  end if;
  if new.role='owner' and new.id is distinct from bound_uid then
    raise exception 'Owner role is reserved';
  end if;
  return new;
end $owner$;

create or replace function public.prevent_duelvanta_owner_delete()
returns trigger language plpgsql security definer set search_path='' as $owner$
begin
  if exists(select 1 from dv_v16_private.operator_identity_v1 where singleton and user_id=old.id)
    then raise exception 'DUELVANTA owner cannot be deleted'; end if;
  return old;
end $owner$;

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
