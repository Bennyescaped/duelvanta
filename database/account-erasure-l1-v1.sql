-- L1 branch candidate, after C. No worker activation or live authorization.
begin;
lock table public.profiles in share row exclusive mode;

-- Ephemeral capability: only Prepare writes it, in its own transaction and
-- immediately around its fixed profile UPDATE. No user/service DML or setter.
create table if not exists dv_market_private.l1_profile_reductions (
 transaction_id xid8 not null,
 backend_pid integer not null,
 target_id uuid not null,
 request_id uuid not null references dv_market_private.account_deletion_requests(id),
 attempt_id uuid not null references dv_market_private.c_attempts(id),
 old_profile_hash bytea not null,
 anonymous_email text not null,
 primary key(transaction_id,backend_pid,target_id)
);
alter table dv_market_private.l1_profile_reductions enable row level security;
revoke all on dv_market_private.l1_profile_reductions from public,anon,authenticated,service_role;

-- Read-only predicate, not a capability issuer. The caller cannot supply a
-- request/token or substitute a profile value. Full row comparison also
-- protects columns added later, including markers, safety and username clocks.
create or replace function dv_market_private.l1_profile_reduction_allowed(p_old public.profiles,p_new public.profiles)
returns boolean language sql volatile security definer set search_path='' as $$
 select exists (
  select 1 from dv_market_private.l1_profile_reductions c
  join dv_market_private.account_deletion_requests r on r.id=c.request_id and r.user_id=c.target_id
  join dv_market_private.c_attempts a on a.id=c.attempt_id and a.request_id=r.id and a.token=r.lock_token
  join dv_market_private.c_prepare_entries e on e.attempt_id=a.id and e.entry_xid<>pg_current_xact_id()
  join dv_market_private.c_request_origins o on o.request_id=r.id and o.user_id=r.user_id
  join dv_market_private.c_marker_owner m on m.request_id=r.id and m.user_id=r.user_id
  where c.transaction_id=pg_current_xact_id() and c.backend_pid=pg_backend_pid()
   and c.target_id=p_old.id and p_new.id=p_old.id and r.status='processing'
   and not exists(select 1 from dv_market_private.c_withdrawal_receipts w where w.request_id=r.id)
   and p_old.data_processing_restricted_at is not null and p_old.account_closure_requested_at is not null
   and c.old_profile_hash=pg_catalog.sha256(pg_catalog.convert_to(to_jsonb(p_old)::text,'UTF8'))
   and p_new.display_name='Gelöschtes Mitglied' and p_new.username is null and p_new.avatar_path is null
   and p_new.collection_visibility='private' and p_new.email=c.anonymous_email
   and (to_jsonb(p_new)-array['email','display_name','username','avatar_path','collection_visibility','updated_at'])
       =(to_jsonb(p_old)-array['email','display_name','username','avatar_path','collection_visibility','updated_at'])
 );
$$;
revoke all on function dv_market_private.l1_profile_reduction_allowed(public.profiles,public.profiles) from public,anon,authenticated,service_role;
-- D4 remains SECURITY INVOKER. This predicate exposes no rows and cannot write.
grant execute on function dv_market_private.l1_profile_reduction_allowed(public.profiles,public.profiles) to authenticated,service_role;

do $install$
declare f record; body text; anchor text; replacement text;
begin
 select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc
 where oid='public.prepare_account_deletion_data(uuid,uuid)'::regprocedure;
 if position('l1_profile_reductions' in f.prosrc)=0 then
  if position('c_assert_committed_prepare' in f.prosrc)=0 or position('pickup_messages' in f.prosrc)=0 then
   raise exception 'unexpected_l1_prepare_baseline';
  end if;
  anchor:=E'  update public.profiles set email=''deleted-''||gen_random_uuid()::text||''@invalid.local'',\n    display_name=''Gelöschtes Mitglied'',username=null,avatar_path=null,collection_visibility=''private'',\n    updated_at=now() where id=v_request.user_id;';
  if position(anchor in f.prosrc)=0 then raise exception 'unexpected_l1_profile_reduction_anchor';end if;
  replacement:=$body$
  -- C already locked this profile/request and required a separately committed
  -- entry. Existing U037 blockers and hold decisions above remain unchanged.
  insert into dv_market_private.l1_profile_reductions
   (transaction_id,backend_pid,target_id,request_id,attempt_id,old_profile_hash,anonymous_email)
  select pg_current_xact_id(),pg_backend_pid(),p.id,v_request.id,
   dv_market_private.c_lock_attempt(v_request.id,p_lock_token),pg_catalog.sha256(pg_catalog.convert_to(to_jsonb(p)::text,'UTF8')),
   'deleted-'||gen_random_uuid()::text||'@invalid.local'
  from public.profiles p
  join dv_market_private.c_request_origins o on o.request_id=v_request.id and o.user_id=p.id
  join dv_market_private.c_marker_owner m on m.request_id=v_request.id and m.user_id=p.id
  where p.id=v_request.user_id and p.data_processing_restricted_at is not null
   and p.account_closure_requested_at is not null;
  if not found then raise exception 'l1_c_binding_invalid' using errcode='42501';end if;
  update public.profiles set email=(select anonymous_email from dv_market_private.l1_profile_reductions
     where transaction_id=pg_current_xact_id() and backend_pid=pg_backend_pid() and target_id=v_request.user_id),
    display_name='Gelöschtes Mitglied',username=null,avatar_path=null,collection_visibility='private',
    updated_at=now() where id=v_request.user_id;
  delete from dv_market_private.l1_profile_reductions
   where transaction_id=pg_current_xact_id() and backend_pid=pg_backend_pid() and target_id=v_request.user_id;
$body$;
  body:=replace(f.prosrc,anchor,replacement);
  execute replace(f.definition,f.prosrc,body);
 end if;

 -- Preserve both original guards, owner/config/ACL and normal RPC semantics.
 -- No username_rpc flag is set or trusted as an L1 capability.
 for f in select prosrc,pg_get_functiondef(oid) definition from pg_proc where oid in (
  'dv_market_private.d4_protect_public_profile()'::regprocedure,
  'public.guard_profile_username_direct_update()'::regprocedure
 ) loop
  if position('l1_profile_reduction_allowed' in f.prosrc)=0 then
   body:=regexp_replace(f.prosrc,'\mbegin\M',E'begin\n if dv_market_private.l1_profile_reduction_allowed(old,new) then return new;end if;','i');
   if body=f.prosrc then raise exception 'unexpected_l1_guard_baseline';end if;
   execute replace(f.definition,f.prosrc,body);
  end if;
 end loop;
end
$install$;
commit;
