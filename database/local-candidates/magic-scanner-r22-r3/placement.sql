-- ISOLATED CANDIDATE ONLY. No Staging apply authorized by R22-R3.
-- Existing save_my_tcg_collection_item_v1 remains the only Magic item writer.
-- This invoker function only places an already saved, own, unplaced Magic item.
begin;
create function public.get_magic_scan_placement_ready_v1() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((public.get_magic_on_demand_collection_beta_v1()->>'magic_on_demand_collection_beta')::boolean,false)
$$;
create function public.place_my_magic_scan_item_v1(p_item_id uuid,p_folder_id uuid,p_page integer,p_slot smallint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  u uuid:=auth.uid(); item public.collection_items%rowtype; pages integer; unplaced integer; free_before integer;
begin
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or not public.get_magic_scan_placement_ready_v1() then raise exception 'magic_scan_not_admitted' using errcode='42501'; end if;
  if p_item_id is null or p_folder_id is null or p_page is null or p_slot is null
     or p_page<1 or p_slot not between 1 and 9 then raise exception 'magic_scan_destination_invalid'; end if;
  select binder_pages into pages from public.collection_folders where id=p_folder_id and user_id=u for update;
  if not found or p_page>pages then raise exception 'magic_scan_binder_not_owned_or_page_invalid'; end if;
  select * into item from public.collection_items where id=p_item_id and user_id=u and tcg='magic' and (folder_id is null or folder_id=p_folder_id) for update;
  if not found then raise exception 'magic_scan_item_not_owned' using errcode='42501'; end if;
  if item.binder_page=p_page and item.binder_slot=p_slot then return true; end if;
  if item.binder_page is not null or item.binder_slot is not null then raise exception 'magic_scan_already_placed'; end if;
  if exists(select 1 from public.collection_items where user_id=u and folder_id=p_folder_id and binder_page=p_page and binder_slot=p_slot) then
    raise exception 'magic_scan_slot_occupied'; end if;
  -- Legacy rows also occupy visible positions in V16 composeSlots. Never displace them.
  select count(*) into unplaced from public.collection_items where user_id=u and folder_id=p_folder_id and id<>p_item_id and (binder_page is null or binder_slot is null);
  select count(*) into free_before from generate_series(1,(p_page-1)*9+p_slot-1) g
    where not exists(select 1 from public.collection_items where user_id=u and folder_id=p_folder_id and binder_page=(g-1)/9+1 and binder_slot=(g-1)%9+1);
  if unplaced>free_before then raise exception 'magic_scan_slot_occupied_by_legacy_row'; end if;
  -- The existing folder-change trigger clears positions. Assign the folder
  -- first, then its exact slot, inside this one transaction. Any failure rolls
  -- both changes back; the pending card cannot auto-fill an unintended slot.
  if item.folder_id is null then
    update public.collection_items set folder_id=p_folder_id where id=p_item_id and user_id=u and tcg='magic' and folder_id is null;
  end if;
  -- The existing unique position index also rejects a racing writer; no swap or overwrite.
  update public.collection_items set binder_page=p_page,binder_slot=p_slot
    where id=p_item_id and user_id=u and tcg='magic' and folder_id=p_folder_id and binder_page is null and binder_slot is null;
  if not found then raise exception 'magic_scan_position_changed'; end if;
  return true;
end $$;
revoke all on function public.get_magic_scan_placement_ready_v1(), public.place_my_magic_scan_item_v1(uuid,uuid,integer,smallint) from public,anon;
grant execute on function public.get_magic_scan_placement_ready_v1(), public.place_my_magic_scan_item_v1(uuid,uuid,integer,smallint) to authenticated;
commit;
