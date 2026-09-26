-- DRAFT: do not apply until the required two-connection PostgreSQL tests pass.
-- F3: user deletion only through an owner-checked, locked empty-binder RPC.
-- Keep ON DELETE SET NULL and privileged account-erasure cascades unchanged.
begin;
create schema if not exists dv_collect_private;
revoke all on schema dv_collect_private from public, anon;
grant usage on schema dv_collect_private to authenticated;

-- TRUNCATE does not honor RLS; neither operation is a user-facing alternative.
revoke delete, truncate on public.collection_folders from public, anon, authenticated;

create or replace function dv_collect_private.delete_empty_binder(p_folder_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if exists (select 1 from public.profiles where id = v_user
             and data_processing_restricted_at is not null) then
    raise exception using errcode = '42501', message = 'account_data_processing_restricted';
  end if;

  -- FOR UPDATE conflicts with the FK KEY SHARE lock acquired by inserts and
  -- assignments. Separate statements give READ COMMITTED a fresh snapshot
  -- after a preceding writer commits. Never replace with FOR NO KEY UPDATE.
  perform 1 from public.collection_folders
    where id = p_folder_id and user_id = v_user for update;
  if not found then
    -- Identical response for a foreign, missing or already deleted binder.
    return pg_catalog.jsonb_build_object('status', 'unavailable');
  end if;
  -- Deliberately all references, not just rows visible to the caller via RLS.
  if exists (select 1 from public.collection_items where folder_id = p_folder_id) then
    raise exception using errcode = 'P0001', message = 'binder_not_empty';
  end if;
  delete from public.collection_folders where id = p_folder_id and user_id = v_user;
  -- Existing account-restriction trigger still runs on this DELETE.
  return pg_catalog.jsonb_build_object('status', 'deleted');
end;
$$;
revoke all on function dv_collect_private.delete_empty_binder(uuid) from public, anon, authenticated, service_role;
grant execute on function dv_collect_private.delete_empty_binder(uuid) to authenticated;

create or replace function public.dv_collect_delete_empty_binder(p_folder_id uuid)
returns jsonb language sql volatile security invoker
set search_path = ''
as $$ select dv_collect_private.delete_empty_binder(p_folder_id); $$;
revoke all on function public.dv_collect_delete_empty_binder(uuid) from public, anon, authenticated, service_role;
grant execute on function public.dv_collect_delete_empty_binder(uuid) to authenticated;
commit;
