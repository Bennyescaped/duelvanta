-- DUELVANTA COLLECT: atomic binder move/swap for drag, drop and mobile taps.
-- Security invoker keeps the existing collection_items RLS policies authoritative.

create or replace function public.dv_collect_move_card(
  p_item_id uuid,
  p_folder_id uuid,
  p_page integer,
  p_slot smallint
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_source public.collection_items%rowtype;
  v_target public.collection_items%rowtype;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'authentication required';
  end if;
  if p_folder_id is null or p_page not between 1 and 9999 or p_slot not between 1 and 9 then
    raise exception 'invalid binder destination';
  end if;
  if not exists (
    select 1 from public.collection_folders
    where id = p_folder_id and user_id = v_user
  ) then
    raise exception 'binder not found';
  end if;

  select * into v_source
  from public.collection_items
  where id = p_item_id and user_id = v_user and folder_id = p_folder_id
  for update;
  if not found then raise exception 'card not found'; end if;

  select * into v_target
  from public.collection_items
  where user_id = v_user and folder_id = p_folder_id
    and binder_page = p_page and binder_slot = p_slot and id <> p_item_id
  for update;

  if v_source.binder_page = p_page and v_source.binder_slot = p_slot then
    return jsonb_build_object('moved', false, 'reason', 'same_slot');
  end if;

  update public.collection_items
  set binder_page = null, binder_slot = null
  where id in (v_source.id, v_target.id) and user_id = v_user;

  update public.collection_items
  set binder_page = p_page, binder_slot = p_slot
  where id = v_source.id and user_id = v_user;

  if v_target.id is not null and v_source.binder_page is not null and v_source.binder_slot is not null then
    update public.collection_items
    set binder_page = v_source.binder_page, binder_slot = v_source.binder_slot
    where id = v_target.id and user_id = v_user;
  end if;

  return jsonb_build_object(
    'moved', true,
    'itemId', v_source.id,
    'swappedItemId', v_target.id,
    'page', p_page,
    'slot', p_slot
  );
end;
$$;

revoke all on function public.dv_collect_move_card(uuid, uuid, integer, smallint) from public, anon;
grant execute on function public.dv_collect_move_card(uuid, uuid, integer, smallint) to authenticated;
