-- G1 candidate only. No live application. Apply after P0-02/P0-05/T2.
-- Preserve existing ACL, RLS and the trusted request_my_account_deletion path.
begin;
CREATE OR REPLACE FUNCTION public.can_update_own_profile_safe(p_row profiles)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old_row public.profiles;
begin
  select * into old_row from public.profiles where id = (select auth.uid());
  if not found then return false; end if;
  return p_row.id = old_row.id
    and p_row.email is not distinct from old_row.email
    and p_row.role is not distinct from old_row.role
    and p_row.data_processing_restricted_at is not distinct from old_row.data_processing_restricted_at
    and p_row.account_closure_requested_at is not distinct from old_row.account_closure_requested_at
    and p_row.safety_restricted is not distinct from old_row.safety_restricted
    and p_row.account_status is not distinct from old_row.account_status
    and p_row.founder_number is not distinct from old_row.founder_number
    and p_row.founder_generation is not distinct from old_row.founder_generation
    and p_row.founder_since is not distinct from old_row.founder_since
    and p_row.username is not distinct from old_row.username
    and p_row.username_changed_at is not distinct from old_row.username_changed_at;
end;
$function$
;

-- INVOKER is deliberate: current_user must identify the actual DML executor,
-- including the owner inside existing trusted SECURITY DEFINER functions.
-- No JWT claim, session flag or client-controlled GUC authorizes marker writes.
create or replace function dv_market_private.protect_account_processing_markers_v1()
returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin
  if (new.data_processing_restricted_at is distinct from old.data_processing_restricted_at
      or new.account_closure_requested_at is distinct from old.account_closure_requested_at)
     and current_user <> pg_get_userbyid((select relowner from pg_class where oid=tg_relid)) then
    raise exception 'account_processing_markers_protected' using errcode='42501';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.protect_account_processing_markers_v1() from public,anon,authenticated,service_role;
drop trigger if exists protect_account_processing_markers_v1 on public.profiles;
create trigger protect_account_processing_markers_v1 before update on public.profiles
for each row execute function dv_market_private.protect_account_processing_markers_v1();
commit;
