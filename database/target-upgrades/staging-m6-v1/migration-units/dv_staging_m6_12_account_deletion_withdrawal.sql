-- C candidate only, after B1. No live authorization. No historical backfill.
begin;
lock table public.profiles in share row exclusive mode;
create table if not exists dv_market_private.c_request_origins (
 request_id uuid primary key references dv_market_private.account_deletion_requests(id),
 user_id uuid not null, marker_clearable boolean not null
);
create table if not exists dv_market_private.c_marker_owner (
 user_id uuid primary key, request_id uuid not null references dv_market_private.c_request_origins(request_id)
);
create table if not exists dv_market_private.c_attempts (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references dv_market_private.account_deletion_requests(id),
 token uuid not null, unique(request_id,token)
);
create table if not exists dv_market_private.c_prepare_entries (
 attempt_id uuid primary key references dv_market_private.c_attempts(id),
 entry_xid xid8 not null default pg_current_xact_id()
);
create table if not exists dv_market_private.c_withdrawal_challenges (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references dv_market_private.account_deletion_requests(id),
 user_id uuid not null, session_id uuid not null, issued_at timestamptz not null default clock_timestamp()
);
create table if not exists dv_market_private.c_withdrawal_receipts (
 request_id uuid primary key references dv_market_private.c_request_origins(request_id),
 id uuid not null unique default gen_random_uuid(), user_id uuid not null,
 challenge_id uuid not null references dv_market_private.c_withdrawal_challenges(id),
 session_id uuid not null, withdrawn_at timestamptz not null default clock_timestamp()
);
-- Append-only evidence. Marker ownership is invalidated on unrelated marker changes.
do $$declare t text;begin
 foreach t in array array['c_request_origins','c_marker_owner','c_attempts','c_prepare_entries','c_withdrawal_challenges','c_withdrawal_receipts'] loop
 execute format('alter table dv_market_private.%I enable row level security',t);
 execute format('revoke all on dv_market_private.%I from public,anon,authenticated,service_role',t);
 if t<>'c_marker_owner' then
 execute format('drop trigger if exists c_immutable on dv_market_private.%I',t);
 execute format('create trigger c_immutable before update or delete on dv_market_private.%I for each row execute function dv_market_private.block_data_rights_audit_mutation()',t);
 end if;
 end loop;
end $$;
create or replace function dv_market_private.c_unresolved(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from dv_market_private.account_deletion_requests r where r.user_id=p_user
 and not exists(select 1 from dv_market_private.c_withdrawal_receipts w where w.request_id=r.id and w.user_id=r.user_id and r.status='cancelled'));
$$;
create or replace function dv_market_private.c_invalidate_marker_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.data_processing_restricted_at is distinct from old.data_processing_restricted_at
 or new.account_closure_requested_at is distinct from old.account_closure_requested_at then
 delete from dv_market_private.c_marker_owner where user_id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists c_invalidate_marker_owner on public.profiles;
create trigger c_invalidate_marker_owner after update on public.profiles
for each row execute function dv_market_private.c_invalidate_marker_owner();
create or replace function dv_market_private.c_register_request(p_request uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Called only inside the existing request function, before its marker write.
 insert into dv_market_private.c_request_origins(request_id,user_id,marker_clearable)
 select p_request,p_user,p.data_processing_restricted_at is null and p.account_closure_requested_at is null
 from public.profiles p where p.id=p_user;
end $$;
create or replace function dv_market_private.c_own_markers(p_request uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into dv_market_private.c_marker_owner(user_id,request_id) values(p_user,p_request)
 on conflict(user_id) do update set request_id=excluded.request_id;
end $$;
-- No old row becomes trusted merely by installing this candidate.
do $$declare f record;body text;anchor text;begin
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='public.request_my_account_deletion(text,uuid)'::regprocedure;
 if position('c_register_request' in f.prosrc)=0 then
 if position('-- B1 request serialization' in f.prosrc)=0 then raise exception 'unexpected_c_request_baseline';end if;
 anchor:='  update public.profiles set account_closure_requested_at=now(),data_processing_restricted_at=now(),';
 if position(anchor in f.prosrc)=0 then raise exception 'unexpected_c_request_marker_anchor';end if;
 body:=replace(f.prosrc,anchor,E'  perform dv_market_private.c_register_request(v_request,v_uid);\n'||anchor);
 anchor:='  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)';
 body:=replace(body,anchor,E'  perform dv_market_private.c_own_markers(v_request,v_uid);\n'||anchor);
 execute replace(f.definition,f.prosrc,body);
 end if;
 -- B1 ignores only cancelled + immutable trusted receipt, never status alone.
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='dv_market_private.b1_data_rights_blocked(uuid)'::regprocedure;
 body:=replace(f.prosrc,'exists(select 1 from dv_market_private.account_deletion_requests d where d.user_id=p_target)','dv_market_private.c_unresolved(p_target)');
 execute replace(f.definition,f.prosrc,body);
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='dv_market_private.b1_project_safety()'::regprocedure;
 body:=replace(f.prosrc,'exists(select 1 from dv_market_private.account_deletion_requests where user_id=new.id)','dv_market_private.c_unresolved(new.id)');
 execute replace(f.definition,f.prosrc,body);
end $$;

create or replace function dv_market_private.c_session() returns uuid
language plpgsql security definer set search_path='' as $$
declare s auth.sessions%rowtype;need_mfa boolean;begin
 if auth.uid() is null or auth.jwt()->>'role' is distinct from 'authenticated'
 or current_setting('role',true) is distinct from 'authenticated' then
 raise exception 'c_self_authenticated_required' using errcode='42501';end if;
 select * into s from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() for share;
 if not found or (s.not_after is not null and s.not_after<=clock_timestamp()) then raise exception 'c_session_invalid' using errcode='42501';end if;
 select exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
 or exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin','moderator','judge')) into need_mfa;
 if need_mfa and (auth.jwt()->>'aal' is distinct from 'aal2' or s.aal is distinct from 'aal2'
 or not exists(select 1 from auth.mfa_factors where id=s.factor_id and user_id=auth.uid() and status='verified')) then
 raise exception 'c_mfa_required' using errcode='42501';end if;
 return s.id;
end $$;
create or replace function public.get_my_account_deletion_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform dv_market_private.c_session();
 return (select coalesce(jsonb_agg(jsonb_build_object('request_id',r.id,'status',r.status,'receipt_id',w.id) order by r.requested_at,r.id),'[]'::jsonb)
 from dv_market_private.account_deletion_requests r left join dv_market_private.c_withdrawal_receipts w on w.request_id=r.id
 where r.user_id=auth.uid());
end $$;
create or replace function public.begin_my_account_deletion_withdrawal(p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s uuid;challenge uuid;begin
 s:=dv_market_private.c_session();
 if not exists(select 1 from dv_market_private.account_deletion_requests where id=p_request_id and user_id=auth.uid()) then raise exception 'c_request_not_owned' using errcode='42501';end if;
 insert into dv_market_private.c_withdrawal_challenges(request_id,user_id,session_id) values(p_request_id,auth.uid(),s) returning id into challenge;
 return challenge;
end $$;
create or replace function public.withdraw_my_account_deletion(p_request_id uuid,p_challenge_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s uuid;r dv_market_private.account_deletion_requests%rowtype;w dv_market_private.c_withdrawal_receipts%rowtype;begin
 s:=dv_market_private.c_session();
 if not exists(select 1 from dv_market_private.c_withdrawal_challenges c join auth.sessions a on a.id=s
 where c.id=p_challenge_id and c.request_id=p_request_id and c.user_id=auth.uid()
 and c.session_id<>a.id and a.created_at>c.issued_at) then raise exception 'c_renewed_auth_required' using errcode='42501';end if;
 -- All C/B1 writers lock/touch this row first. Old RR snapshots serialize/fail.
 perform 1 from public.profiles where id=auth.uid() for no key update;
 if not found then raise exception 'c_profile_missing';end if;
 select * into r from dv_market_private.account_deletion_requests where id=p_request_id and user_id=auth.uid() for update;
 if not found then raise exception 'c_request_not_owned' using errcode='42501';end if;
 select * into w from dv_market_private.c_withdrawal_receipts where request_id=r.id and user_id=auth.uid();
 if found then return jsonb_build_object('request_id',r.id,'receipt_id',w.id,'withdrawn',true,'replayed',true);end if;
 if r.status not in ('requested','processing','failed') or not exists(
 select 1 from dv_market_private.c_request_origins o join dv_market_private.c_marker_owner m on m.request_id=o.request_id and m.user_id=o.user_id
 where o.request_id=r.id and o.user_id=auth.uid() and o.marker_clearable) then raise exception 'c_provenance_unresolved';end if;
 if exists(select 1 from dv_market_private.account_deletion_requests x where x.user_id=auth.uid() and x.id<>r.id
 and not exists(select 1 from dv_market_private.c_withdrawal_receipts q where q.request_id=x.id and q.user_id=x.user_id and x.status='cancelled'))
 or exists(select 1 from dv_market_private.c_prepare_entries e join dv_market_private.c_attempts a on a.id=e.attempt_id
 join dv_market_private.account_deletion_requests x on x.id=a.request_id where x.user_id=auth.uid()) then
 raise exception 'c_prepare_or_history_unresolved';end if;
 insert into dv_market_private.c_withdrawal_receipts(request_id,user_id,challenge_id,session_id)
 values(r.id,auth.uid(),p_challenge_id,s) returning * into w;
 update dv_market_private.account_deletion_requests set status='cancelled',lock_token=null,locked_at=null where id=r.id;
 -- Exact C ownership proved above. No other column or external state reset.
 update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null,
 safety_restricted=dv_market_private.b1_has_cause(auth.uid()),updated_at=now() where id=auth.uid();
 insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
 values(auth.uid(),r.id,'deletion_withdrawn',jsonb_build_object('receipt_id',w.id,'challenge_id',p_challenge_id));
 return jsonb_build_object('request_id',r.id,'receipt_id',w.id,'withdrawn',true,'replayed',false);
end $$;

create or replace function public.claim_account_deletion_requests(p_limit integer,p_lock_token uuid)
returns table(request_id uuid,user_id uuid,storage_manifest jsonb,delivery_lock_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
declare x record;r dv_market_private.account_deletion_requests%rowtype;n integer:=0;begin
 if p_lock_token is null then raise exception 'lock_token_required';end if;
 -- Existing D policy, unchanged. Withdrawal never calls this worker function.
 update dv_market_private.account_deletion_holds set released_at=now()
 where released_at is null and not manual_review_required and retain_until is not null and retain_until<=now();
 for x in select d.id,d.user_id from dv_market_private.account_deletion_requests d
 where d.status in ('requested','failed','processing','retained') order by d.user_id,d.requested_at,d.id loop
 perform 1 from public.profiles p where p.id=x.user_id for no key update skip locked;
 if not found then continue;end if;
 select * into r from dv_market_private.account_deletion_requests d where d.id=x.id and
 (d.status in ('requested','failed') or (d.status='processing' and d.locked_at<now()-interval '15 minutes')
 or (d.status='retained' and not exists(select 1 from dv_market_private.account_deletion_holds h where h.request_id=d.id and h.released_at is null))) for update skip locked;
 if not found or exists(select 1 from dv_market_private.c_withdrawal_receipts w where w.request_id=x.id) then continue;end if;
 -- Never reissue an old token for the same request, including a lost response retry.
 if exists(select 1 from dv_market_private.c_attempts a where a.request_id=r.id and a.token=p_lock_token) then continue;end if;
 insert into dv_market_private.c_attempts(request_id,token) values(r.id,p_lock_token);
 update dv_market_private.account_deletion_requests d set status='processing',lock_token=p_lock_token,locked_at=now(),processing_started_at=coalesce(d.processing_started_at,now()) where d.id=r.id;
 update public.profiles p set updated_at=now() where p.id=r.user_id;
 request_id:=r.id;user_id:=r.user_id;storage_manifest:=r.storage_manifest;delivery_lock_token:=p_lock_token;return next;
 n:=n+1;if n>=least(greatest(coalesce(p_limit,1),1),20) then exit;end if;
 end loop;
end $$;
create or replace function dv_market_private.c_lock_attempt(p_request uuid,p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid;a uuid;begin
 select user_id into u from dv_market_private.account_deletion_requests where id=p_request;
 perform 1 from public.profiles where id=u for no key update;
 if not found then raise exception 'c_worker_profile_missing';end if;
 perform 1 from dv_market_private.account_deletion_requests where id=p_request and status='processing' and lock_token=p_token for update;
 if not found or exists(select 1 from dv_market_private.c_withdrawal_receipts where request_id=p_request) then raise exception 'deletion_request_lock_invalid';end if;
 select id into a from dv_market_private.c_attempts where request_id=p_request and token=p_token;
 if not found then raise exception 'c_worker_attempt_invalid';end if;
 return a;
end $$;
create or replace function public.enter_account_deletion_prepare(p_request_id uuid,p_lock_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a uuid;begin
 a:=dv_market_private.c_lock_attempt(p_request_id,p_lock_token);
 insert into dv_market_private.c_prepare_entries(attempt_id) values(a) on conflict do nothing;
 update public.profiles set updated_at=now() where id=(select user_id from dv_market_private.account_deletion_requests where id=p_request_id);
 return a;
end $$;
create or replace function dv_market_private.c_assert_committed_prepare(p_request uuid,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a uuid;begin
 a:=dv_market_private.c_lock_attempt(p_request,p_token);
 if not exists(select 1 from dv_market_private.c_prepare_entries where attempt_id=a and entry_xid<>pg_current_xact_id()) then
 raise exception 'c_prepare_entry_must_be_committed';end if;
end $$;
-- Gate in the existing body, not a second exposed or callable erasure core.
-- D4/username/FK integration findings L1/L2 are intentionally unchanged.
do $$declare f record;body text;begin
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc where oid='public.prepare_account_deletion_data(uuid,uuid)'::regprocedure;
 if position('c_assert_committed_prepare' in f.prosrc)=0 then
 if position('pickup_messages' in f.prosrc)=0 then raise exception 'unexpected_c_prepare_baseline';end if;
 body:=regexp_replace(f.prosrc,'\mbegin\M',E'begin\n perform dv_market_private.c_assert_committed_prepare(p_request_id,p_lock_token);','i');
 execute replace(f.definition,f.prosrc,body);
 end if;
end $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='dv_market_private' and p.proname like 'c_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on function public.get_my_account_deletion_requests(),public.begin_my_account_deletion_withdrawal(uuid),public.withdraw_my_account_deletion(uuid,uuid),public.enter_account_deletion_prepare(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_account_deletion_requests(),public.begin_my_account_deletion_withdrawal(uuid),public.withdraw_my_account_deletion(uuid,uuid) to authenticated;
grant execute on function public.enter_account_deletion_prepare(uuid,uuid) to service_role;
commit;
