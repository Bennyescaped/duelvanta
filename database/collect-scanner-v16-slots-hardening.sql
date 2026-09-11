-- DUELVANTA COLLECT Scanner V16 slot safety
-- Moving a collection row to another binder must never keep the physical slot from the old binder.

create or replace function public.clear_collection_binder_position_on_folder_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.folder_id is distinct from new.folder_id or new.folder_id is null then
    new.binder_page := null;
    new.binder_slot := null;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_collection_binder_position_on_folder_change() from public, anon, authenticated;
grant execute on function public.clear_collection_binder_position_on_folder_change() to service_role;

drop trigger if exists trg_clear_collection_binder_position_on_folder_change on public.collection_items;
create trigger trg_clear_collection_binder_position_on_folder_change
before update of folder_id on public.collection_items
for each row execute function public.clear_collection_binder_position_on_folder_change();
