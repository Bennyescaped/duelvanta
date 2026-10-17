-- NOT_AUTO_APPLY. Forward-only R13 delta; beta OFF, transport OFF, budgets zero.
begin;
do $$begin
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)
 or not exists(select 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' and not enabled)
 or exists(select 1 from dv_collect_private.magic_collect_admission_v1)
 or exists(select 1 from dv_collect_private.magic_collect_admission_audit_v1)
 then raise exception 'r13_baseline_not_ready';end if;
end$$;
create table dv_collect_private.magic_operator_receipts_v1(
 request_id uuid primary key, request_sha256 text not null check(length(request_sha256)=64),
 operator_ref text not null check(length(btrim(operator_ref)) between 1 and 256),
 subject_hash text not null check(length(subject_hash)=64),
 action text not null check(action in ('admit','revoke')),
 occurred_at timestamptz not null default clock_timestamp(),actor name not null default session_user);
create table dv_collect_private.magic_transport_policy_v1(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 global_limit integer not null default 0 check(global_limit between 0 and 10000),
 user_limit integer not null default 0 check(user_limit between 0 and 1000),
 window_seconds integer not null default 60 check(window_seconds between 1 and 86400),
 authorization_ref text not null default '' check(length(authorization_ref)<=256),
 check(not enabled or length(btrim(authorization_ref))>0));
insert into dv_collect_private.magic_transport_policy_v1(singleton) values(true);
create table dv_collect_private.magic_transport_usage_v1(
 window_start timestamptz not null,window_seconds integer not null check(window_seconds between 1 and 86400),
 subject_hash text not null check(subject_hash='GLOBAL' or length(subject_hash)=64),
 used integer not null check(used between 0 and 10000),primary key(window_start,window_seconds,subject_hash));
create table dv_collect_private.magic_transport_reservations_v1(
 request_id uuid primary key,subject_hash text not null check(length(subject_hash)=64),
 reserved_at timestamptz not null,window_start timestamptz not null,window_seconds integer not null,
 global_limit integer not null,user_limit integer not null,operator_ref text not null,
 contract text not null check(contract='magic-collect-transport/1'));
alter table dv_collect_private.magic_operator_receipts_v1 enable row level security;
alter table dv_collect_private.magic_transport_policy_v1 enable row level security;
alter table dv_collect_private.magic_transport_usage_v1 enable row level security;
alter table dv_collect_private.magic_transport_reservations_v1 enable row level security;
revoke all on dv_collect_private.magic_operator_receipts_v1,dv_collect_private.magic_transport_policy_v1,dv_collect_private.magic_transport_usage_v1,dv_collect_private.magic_transport_reservations_v1 from public,anon,authenticated,service_role;

-- Operator-only, SECURITY INVOKER; R9 admission is the sole membership authority.
create function dv_collect_private.magic_admission_operator_v1(
 p_request_id uuid,p_user_id uuid,p_authorized_users uuid[],p_action text,
 p_starts_at timestamptz,p_expires_at timestamptz,p_contract text,p_operator_ref text,
 p_expected_state text default null,p_dry_run boolean default true
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,dv_collect_private as $op$
declare old_state jsonb;state_hash text;request_hash text;receipt record;
begin
 if current_user<>'postgres' or p_request_id is null or p_user_id is null or p_dry_run is null
 or not coalesce(p_user_id=any(p_authorized_users),false) or p_action is null or p_action not in ('admit','revoke')
 or p_contract is distinct from 'magic-on-demand-collect-beta/1' or p_operator_ref is null
 or length(btrim(p_operator_ref)) not between 1 and 256 or p_starts_at is null or p_expires_at is null
 or not isfinite(p_starts_at) or not isfinite(p_expires_at) or p_expires_at<=p_starts_at
 then raise exception 'operator_request_invalid' using errcode='42501';end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_array(p_user_id,p_action,p_starts_at,p_expires_at,p_contract,p_operator_ref)::text,'UTF8')),'hex');
 if not p_dry_run then perform 1 from public.profiles where id=p_user_id for update;end if;
 select * into receipt from dv_collect_private.magic_operator_receipts_v1 where request_id=p_request_id;
 if found then
  if receipt.request_sha256<>request_hash then raise exception 'operator_request_conflict';end if;
  return jsonb_build_object('status','already_committed','request_id',p_request_id,'mutation',false);
 end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null)
 or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'operator_subject_invalid';end if;
 select to_jsonb(m) into old_state from dv_collect_private.magic_collect_admission_v1 m where user_id=p_user_id;
 state_hash:=encode(sha256(convert_to(coalesce(old_state,'null'::jsonb)::text,'UTF8')),'hex');
 if p_action='admit' then
  if p_expires_at<=clock_timestamp() or not exists(select 1 from public.profiles where id=p_user_id and data_processing_restricted_at is null and account_closure_requested_at is null and account_status not in ('suspended','deleted')) then raise exception 'operator_subject_ineligible';end if;
  if old_state is not null and old_state->>'status'='active' then raise exception 'operator_admission_conflict';end if;
 elsif old_state is null then raise exception 'operator_admission_absent';end if;
 if p_dry_run then return jsonb_build_object('status','validated','expected_state',state_hash,'request_id',p_request_id,'mutation',false);end if;
 if p_expected_state is distinct from state_hash then raise exception 'operator_state_changed';end if;
 if p_action='admit' then
  insert into dv_collect_private.magic_collect_admission_v1(user_id,status,starts_at,expires_at,operator_authorization_ref)
  values(p_user_id,'active',p_starts_at,p_expires_at,p_operator_ref)
  on conflict(user_id) do update set status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null,operator_authorization_ref=excluded.operator_authorization_ref;
 else update dv_collect_private.magic_collect_admission_v1 set status='revoked',revoked_at=coalesce(revoked_at,clock_timestamp()),operator_authorization_ref=p_operator_ref where user_id=p_user_id;end if;
 insert into dv_collect_private.magic_operator_receipts_v1(request_id,request_sha256,operator_ref,subject_hash,action)
 values(p_request_id,request_hash,p_operator_ref,encode(sha256(convert_to(p_user_id::text,'UTF8')),'hex'),p_action);
 return jsonb_build_object('status','committed','request_id',p_request_id,'mutation',true);
end$op$;
revoke all on function dv_collect_private.magic_admission_operator_v1(uuid,uuid,uuid[],text,timestamptz,timestamptz,text,text,text,boolean) from public,anon,authenticated,service_role;

-- Global serialization across all instances. Same lock order as R9: profile,
-- beta, admission, then policy/usage. No refund, no receipt replay, no retry.
create function public.reserve_my_magic_transport_v1(p_request_id uuid) returns jsonb
 language plpgsql volatile security definer set search_path=pg_catalog,public,dv_collect_private as $reserve$
declare u uuid:=auth.uid();b boolean;policy dv_collect_private.magic_transport_policy_v1%rowtype;
 stamp timestamptz;win timestamptz;subject text;g integer;n integer;
begin
 if u is null or p_request_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'transport_denied' using errcode='42501';end if;
 perform 1 from public.profiles where id=u and data_processing_restricted_at is null and account_closure_requested_at is null and account_status not in ('suspended','deleted') for update;
 if not found then raise exception 'transport_denied' using errcode='42501';end if;
 select enabled into b from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' for share;
 if b is distinct from true or not dv_collect_private.magic_collect_admitted_v1(true)
 or not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)
 then raise exception 'transport_denied' using errcode='42501';end if;
 select * into policy from dv_collect_private.magic_transport_policy_v1 where singleton for update;
 if not found or not policy.enabled or policy.global_limit<=0 or policy.user_limit<=0 then raise exception 'transport_denied' using errcode='42501';end if;
 if not dv_collect_private.magic_collect_admitted_v1(false) then raise exception 'transport_denied' using errcode='42501';end if;
 stamp:=clock_timestamp();win:=to_timestamp(floor(extract(epoch from stamp)/policy.window_seconds)*policy.window_seconds);
 subject:=encode(sha256(convert_to(u::text,'UTF8')),'hex');
 if exists(select 1 from dv_collect_private.magic_transport_reservations_v1 where request_id=p_request_id) then raise exception 'transport_denied' using errcode='42501';end if;
 insert into dv_collect_private.magic_transport_usage_v1 values(win,policy.window_seconds,'GLOBAL',0),(win,policy.window_seconds,subject,0) on conflict do nothing;
 select used into g from dv_collect_private.magic_transport_usage_v1 where window_start=win and window_seconds=policy.window_seconds and subject_hash='GLOBAL';
 select used into n from dv_collect_private.magic_transport_usage_v1 where window_start=win and window_seconds=policy.window_seconds and subject_hash=subject;
 if g>=policy.global_limit or n>=policy.user_limit then raise exception 'transport_denied' using errcode='42501';end if;
 update dv_collect_private.magic_transport_usage_v1 set used=used+1 where window_start=win and window_seconds=policy.window_seconds and subject_hash in ('GLOBAL',subject);
 insert into dv_collect_private.magic_transport_reservations_v1 values(p_request_id,subject,stamp,win,policy.window_seconds,policy.global_limit,policy.user_limit,policy.authorization_ref,'magic-collect-transport/1');
 return jsonb_build_object('contract','magic-collect-transport/1','reserved',true,'request_id',p_request_id,'user_id',u,'reserved_at',stamp);
end$reserve$;
revoke all on function public.reserve_my_magic_transport_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_my_magic_transport_v1(uuid) to authenticated;
-- Exact extended readiness inventories and COMMIT are appended by native authoring.
