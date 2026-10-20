-- B1 candidate only. Apply after the complete D4 chain; no live authorization.
begin;
lock table public.profiles in share row exclusive mode;
create table if not exists dv_market_private.battle_safety_causes (
 id uuid primary key default gen_random_uuid(),
 target_id uuid not null,
 kind text not null check(kind in ('b1','legacy_unknown')),
 report_id uuid,
 actor_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 reason text,
 check (kind <> 'b1' or (report_id is not null and actor_id is not null))
);
-- References are immutable identifiers, not new Auth deletion blockers/cascades.
create table if not exists dv_market_private.battle_safety_releases (
 cause_id uuid primary key references dv_market_private.battle_safety_causes(id),
 actor_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(trim(reason)) between 1 and 1000)
);
create index if not exists battle_safety_causes_target on dv_market_private.battle_safety_causes(target_id);
alter table dv_market_private.battle_safety_causes enable row level security;
alter table dv_market_private.battle_safety_releases enable row level security;
revoke all on dv_market_private.battle_safety_causes,dv_market_private.battle_safety_releases from public,anon,authenticated,service_role;

create or replace function dv_market_private.b1_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'safety_evidence_immutable' using errcode='42501'; end $$;
drop trigger if exists b1_immutable on dv_market_private.battle_safety_causes;
create trigger b1_immutable before update or delete on dv_market_private.battle_safety_causes
for each row execute function dv_market_private.b1_immutable();
drop trigger if exists b1_immutable on dv_market_private.battle_safety_releases;
create trigger b1_immutable before update or delete on dv_market_private.battle_safety_releases
for each row execute function dv_market_private.b1_immutable();

create or replace function dv_market_private.b1_has_cause(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from dv_market_private.battle_safety_causes c
 where c.target_id=p_target and not exists(select 1 from dv_market_private.battle_safety_releases r where r.cause_id=c.id));
$$;
create or replace function dv_market_private.b1_data_rights_blocked(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 -- No implemented cancellation exists. Any request on a surviving account is
 -- conservatively unresolved/inconsistent for this operation, including failed.
 select exists(select 1 from public.profiles p where p.id=p_target and
 (p.data_processing_restricted_at is not null or p.account_closure_requested_at is not null))
 or exists(select 1 from dv_market_private.account_deletion_requests d where d.user_id=p_target);
$$;

-- Once-only bootstrap; reapplication must not turn new, known B1 into legacy.
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='b1_safety_projection') then
  insert into dv_market_private.battle_safety_causes(target_id,kind,reason)
  select id,'legacy_unknown','Pre-existing safety flag; no inferred report attribution'
  from public.profiles where safety_restricted;
 end if;
end $$;

create or replace function dv_market_private.b1_project_safety() returns trigger
language plpgsql security definer set search_path='' as $$
declare required boolean;
begin
 -- A processing-only marker is not itself a new Safety sanction. Preserve
 -- D3's existing read rights; markers still independently block any release.
 required:=exists(select 1 from dv_market_private.account_deletion_requests where user_id=new.id)
   or dv_market_private.b1_has_cause(new.id);
 -- An unexplained true write is retained conservatively, never relabelled B1.
 if new.safety_restricted and not required then
  insert into dv_market_private.battle_safety_causes(target_id,kind,reason)
  values(new.id,'legacy_unknown','Unattributed safety write');
  required:=true;
 end if;
 new.safety_restricted:=required;
 return new;
end $$;
drop trigger if exists b1_safety_projection on public.profiles;
create trigger b1_safety_projection before insert or update of safety_restricted,data_processing_restricted_at,account_closure_requested_at
on public.profiles for each row execute function dv_market_private.b1_project_safety();

create or replace function dv_market_private.b1_lock_target(p_target uuid,p_owner_only boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p record; found_target boolean:=false; found_actor boolean:=false;
begin
 perform public.require_duelvanta_privileged_session();
 if p_owner_only and not public.is_duelvanta_owner(auth.uid()) then raise exception 'owner_access_required' using errcode='42501'; end if;
 if not public.has_staff_permission('reports_review',auth.uid()) or not public.has_staff_permission('users_restrict',auth.uid()) then
  raise exception 'safety_permissions_required' using errcode='42501';
 end if;
 for p in select id,data_processing_restricted_at,account_closure_requested_at from public.profiles
 where id=auth.uid() or id=p_target order by id for no key update loop
  if p.id=auth.uid() then
   found_actor:=true;
   if p.data_processing_restricted_at is not null or p.account_closure_requested_at is not null then raise exception 'staff_actor_processing_hold' using errcode='42501'; end if;
  end if;
  if p.id=p_target then found_target:=true; end if;
 end loop;
 if not found_actor or not found_target then raise exception 'safety_profile_missing' using errcode='42501'; end if;
 perform public.require_duelvanta_privileged_session();
 if public.is_duelvanta_owner(p_target) then raise exception 'Owner cannot be targeted by moderation actions' using errcode='42501'; end if;
 if dv_market_private.b1_data_rights_blocked(p_target) then raise exception 'safety_target_data_rights_hold' using errcode='42501'; end if;
end $$;

create or replace function dv_market_private.b1_restrict(p_report uuid,p_target uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare cause uuid;
begin
 perform dv_market_private.b1_lock_target(p_target,false);
 if not exists(select 1 from public.battle_reports where id=p_report and reported_user_id=p_target) then raise exception 'd3_case_changed_or_missing'; end if;
 insert into dv_market_private.battle_safety_causes(target_id,kind,report_id,actor_id,reason)
 values(p_target,'b1',p_report,auth.uid(),left(p_note,1000)) returning id into cause;
 update public.profiles set safety_restricted=true,updated_at=now() where id=p_target;
 return cause;
end $$;

-- Patch only the existing allowed restriction branch. D3 wrapper and old
-- review_action_disabled path are retained; no alternate callable core.
do $$declare f record; body text; old_write text:='update public.profiles set safety_restricted=true,updated_at=now() where id=v_r.reported_user_id and not public.is_duelvanta_owner(id);';
begin
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='public.moderate_battle_report(uuid,text,text)'::regprocedure;
 if position('dv_market_private.b1_restrict' in f.prosrc)=0 then
  if position('-- D3 closed mutation boundary v1' in f.prosrc)=0 or position(old_write in f.prosrc)=0 then raise exception 'unexpected_b1_moderate_baseline'; end if;
  body:=replace(f.prosrc,'v_r public.battle_reports%rowtype;','v_r public.battle_reports%rowtype; v_b1 uuid;');
  body:=replace(body,old_write,'v_b1:=dv_market_private.b1_restrict(p_report_id,v_r.reported_user_id,p_note);');
  body:=replace(body,'''note'',left(p_note,1000)','''note'',left(p_note,1000),''sanction_id'',v_b1');
  execute replace(f.definition,f.prosrc,body);
 end if;
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='public.request_my_account_deletion(text,uuid)'::regprocedure;
 if position('-- B1 request serialization' in f.prosrc)=0 then
  body:=regexp_replace(f.prosrc,'\mbegin\M',E'begin\n -- B1 request serialization: before request INSERT and profile markers.\n perform 1 from public.profiles where id=auth.uid() for no key update;','i');
  if body=f.prosrc then raise exception 'unexpected_b1_request_baseline'; end if;
  execute replace(f.definition,f.prosrc,body);
 end if;
end $$;

create or replace function dv_market_private.b1_release(p_cause uuid,p_reason text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c dv_market_private.battle_safety_causes%rowtype; replay boolean; remaining boolean;
begin
 perform public.require_duelvanta_privileged_session();
 if not public.is_duelvanta_owner(auth.uid()) then raise exception 'owner_access_required' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'correction_reason_required'; end if;
 select * into c from dv_market_private.battle_safety_causes where id=p_cause and kind=p_kind;
 if not found then raise exception 'safety_cause_not_found'; end if;
 perform dv_market_private.b1_lock_target(c.target_id,true);
 replay:=exists(select 1 from dv_market_private.battle_safety_releases where cause_id=c.id);
 if not replay then
  if p_kind='legacy_unknown' and exists(select 1 from dv_market_private.battle_safety_causes x
   where x.target_id=c.target_id and x.id<>c.id and not exists(select 1 from dv_market_private.battle_safety_releases r where r.cause_id=x.id)) then
   raise exception 'other_safety_cause_active' using errcode='42501';
  end if;
  insert into dv_market_private.battle_safety_releases(cause_id,actor_id,reason) values(c.id,auth.uid(),trim(p_reason));
  insert into public.admin_audit_log(actor_id,target_user_id,action,details)
  values(auth.uid(),c.target_id,case when p_kind='b1' then 'battle_sanction_released' else 'battle_legacy_safety_reviewed' end,
   jsonb_build_object('sanction_id',c.id,'report_id',c.report_id,'reason',trim(p_reason)));
  remaining:=dv_market_private.b1_has_cause(c.target_id);
  -- Always touch the shared profile row, even when another cause remains:
  -- this also forces stale REPEATABLE READ contenders to serialize/fail.
  update public.profiles set safety_restricted=remaining,updated_at=now() where id=c.target_id;
 end if;
 select safety_restricted into remaining from public.profiles where id=c.target_id;
 return jsonb_build_object('sanction_id',c.id,'replayed',replay,'safety_restricted',remaining);
end $$;
create or replace function public.owner_unrestrict_battle_sanction(p_sanction_id uuid,p_reason text) returns jsonb
language sql security definer set search_path='' as $$select dv_market_private.b1_release(p_sanction_id,p_reason,'b1')$$;
create or replace function public.owner_review_legacy_battle_safety(p_cause_id uuid,p_reason text) returns jsonb
language sql security definer set search_path='' as $$select dv_market_private.b1_release(p_cause_id,p_reason,'legacy_unknown')$$;
create or replace function public.get_owner_battle_safety_causes(p_target_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_duelvanta_privileged_session();
 if not public.is_duelvanta_owner(auth.uid()) then raise exception 'owner_access_required' using errcode='42501'; end if;
 return jsonb_build_object('target_id',p_target_id,'data_rights_blocked',dv_market_private.b1_data_rights_blocked(p_target_id),
 'causes',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('active',r.cause_id is null,'release',to_jsonb(r)) order by c.created_at,c.id),'[]'::jsonb)
 from dv_market_private.battle_safety_causes c left join dv_market_private.battle_safety_releases r on r.cause_id=c.id where c.target_id=p_target_id));
end $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='dv_market_private' and p.proname like 'b1_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on function public.owner_unrestrict_battle_sanction(uuid,text),public.owner_review_legacy_battle_safety(uuid,text),public.get_owner_battle_safety_causes(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owner_unrestrict_battle_sanction(uuid,text),public.owner_review_legacy_battle_safety(uuid,text),public.get_owner_battle_safety_causes(uuid) to authenticated;
commit;
