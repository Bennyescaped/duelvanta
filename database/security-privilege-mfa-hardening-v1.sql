-- STEP 9A REVIEW CANDIDATE ONLY. Requires the complete V51 application stack and
-- database/auth-privileged-step-up-v1.sql. Not a Production upgrade manifest.
-- Desired privileges are authored below; never copied from a live catalog.
begin;
-- Application schemas only. Supabase-managed auth/storage/realtime/vault are untouched.
do $acl$
declare s text; r record;
begin
  foreach s in array array['public','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private','dv_collect_private'] loop
    if to_regnamespace(s) is null then raise exception 'security_baseline_schema_missing: %',s; end if;
    execute format('revoke create on schema %I from public,anon,authenticated,service_role',s);
    for r in select c.oid::regclass name,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=s and c.relkind in ('r','p','v','m','f','S') loop
      if r.relkind='S' then
        execute format('revoke all on sequence %s from public,anon,authenticated,service_role',r.name);
        execute format('revoke update on sequence %s from service_role',r.name);
      else
        execute format('revoke truncate,references,trigger,maintain on table %s from public,anon,authenticated,service_role',r.name);
        execute format('revoke all on table %s from public,anon,authenticated,service_role',r.name);
        -- Column grants survive table REVOKE and must be explicitly removed too.
        for r in select r.name name,string_agg(quote_ident(attname),',') cols from pg_attribute
          where attrelid=r.name and attnum>0 and not attisdropped group by r.name loop
          execute format('revoke select(%2$s),insert(%2$s),update(%2$s),references(%2$s) on %1$s from public,anon,authenticated,service_role',r.name,r.cols);
        end loop;
      end if;
    end loop;
    execute format('alter default privileges for role postgres in schema %I revoke all on tables from public,anon,authenticated,service_role',s);
    execute format('alter default privileges for role postgres in schema %I revoke all on sequences from public,anon,authenticated,service_role',s);
    execute format('alter default privileges for role postgres in schema %I revoke all on functions from public,anon,authenticated,service_role',s);
  end loop;
end $acl$;
-- Per-schema REVOKE cannot cancel PostgreSQL's global default PUBLIC EXECUTE.
-- Only future objects authored by postgres; existing managed objects/owners unchanged.
alter default privileges for role postgres revoke all on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres revoke all on sequences from public,anon,authenticated,service_role;

grant select on public.admin_audit_log,public.battle_matches,public.battle_ratings,
 public.staff_applications,public.staff_permissions,public.market_seller_accounts to authenticated;
grant select,insert on public.battle_reports,public.battle_signals to authenticated;
grant select,insert,update on public.collection_folders to authenticated; -- deletion remains F3 RPC-only
 grant select,insert,update,delete on public.collection_items,public.market_listings to authenticated;
grant select,delete on public.market_offers to authenticated; -- no fixed-price/reservation direct write
 grant select,update on public.profiles to authenticated; -- RLS limits UPDATE to unchanged privileged fields
 grant select on public.beta_waitlist to authenticated;
grant update(beta_status,founder_eligible,founder_number,founder_generation,invited_at,activated_at) on public.beta_waitlist to authenticated;
grant insert(email,consent,source) on public.beta_waitlist to anon;
grant usage on sequence public.beta_waitlist_id_seq to anon;
grant usage on sequence public.battle_signals_id_seq to authenticated;
-- Service HTTP access: visibility checks for signed images and audit INSERT after user-JWT authorization.
-- All other workers use their explicitly granted SECURITY DEFINER RPCs, not raw table mutation.
grant select on public.profiles,public.collection_folders,public.collection_items,public.market_listings to service_role;
grant insert(actor_id,target_user_id,action,details) on public.admin_audit_log to service_role;
grant usage on sequence public.admin_audit_log_id_seq to service_role;
-- Existing invoker view contains only aggregate public seller statistics; no DML.
do $$begin if to_regclass('public.market_seller_stats') is not null then
 execute 'grant select on public.market_seller_stats to anon,authenticated'; end if; end$$;

-- Defense in depth: RPC-owned tables have no browser policy. Service BYPASSRLS
-- cannot override missing table ACL; approved workers use SECURITY DEFINER RPCs.
alter table dv_market_private.market_pickup_handovers enable row level security;
alter table dv_market_private.trade_user_eligibility enable row level security;
alter table public.market_notification_sync_state enable row level security;

-- Administrative table reads cannot bypass RPC step-up. Own nonprivileged reads stay usable for enrollment.
alter policy admin_audit_read on public.admin_audit_log using
 (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session());
alter policy owner_admin_read_profiles on public.profiles using
 (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session());
-- No product caller needs raw role/status writes. Audited staff RPCs remain SECURITY DEFINER.
drop policy if exists owner_update_profiles on public.profiles;
alter policy owner_can_read_waitlist on public.beta_waitlist using
 (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session());
alter policy owner_can_update_waitlist on public.beta_waitlist using
 (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session()) with check
 (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session());
alter policy staff_applications_read on public.staff_applications using
 (applicant_id=auth.uid() or (public.is_duelvanta_admin(auth.uid()) and public.has_duelvanta_privileged_session()));
alter policy staff_permissions_read on public.staff_permissions using
 (user_id=auth.uid() or (public.is_duelvanta_owner(auth.uid()) and public.has_duelvanta_privileged_session()));
alter policy battle_reports_select_own on public.battle_reports using
 (reporter_id=auth.uid() or (public.has_duelvanta_privileged_session() and
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin','moderator'))
 or public.has_staff_permission('reports_review',auth.uid()))));
alter policy battle_matches_select_authenticated on public.battle_matches using
 ((visibility='public' and status in ('waiting','ready')) or host_id=auth.uid() or guest_id=auth.uid()
 or (public.has_duelvanta_privileged_session() and
 (moderator_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin','judge')))));

-- Additional privileged paths added after the original eight-RPC B06 draft.
-- Guard implementation bodies, not only public facades: scanner private RPC cannot bypass it.
do $patch$
declare sig text; f record; body text;
begin
 foreach sig in array array[
 'public.get_battle_disputes_for_moderation()', 'public.resolve_battle_dispute(uuid,text,text)',
 'public.review_market_seller_onboarding(uuid,text,text)',
 'public.set_marketplace_seller_onboarding_enforcement(boolean)',
 'public.get_owner_marketplace_notices(text)',
 'public.decide_marketplace_listing_notice(uuid,text,text,text,text,text,text,boolean)',
 'public.review_marketplace_notice_appeal(uuid,text,text)',
 'public.get_owner_market_seller_reviews(text)',
 'public.get_owner_market_delivery_reviews_b07(text)',
 'public.review_market_order_delivery_b07(uuid,text,timestamp with time zone,text,text)',
 'dv_v16_private.owner_openai_scan_settings_for_caller()',
 'dv_v16_private.update_openai_scan_policy_for_caller(boolean,integer,integer,integer)'
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
end $patch$;
-- No unauthenticated/internal-trigger RPC surface. Runtime trigger execution is unaffected.
do $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private')
 and p.prorettype='trigger'::regtype loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end$$;
revoke all on function public.is_duelvanta_owner(uuid),public.is_duelvanta_admin(uuid),public.has_staff_permission(text,uuid),
 public.get_my_market_deals(),public.get_my_battle_history(integer) from public,anon;
-- Edge invitation authorization is evaluated with the user's JWT before service escalation.
create or replace function public.get_my_privileged_access_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('privileged',public.has_duelvanta_privileged_session(),
 'owner',public.has_duelvanta_privileged_session() and public.is_duelvanta_owner(auth.uid()))
$$;
revoke all on function public.get_my_privileged_access_v1() from public,anon,authenticated,service_role;
grant execute on function public.get_my_privileged_access_v1() to authenticated;
commit;
