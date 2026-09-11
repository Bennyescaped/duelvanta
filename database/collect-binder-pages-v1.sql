-- DUELVANTA COLLECT: durable, owner-controlled page count for 9-pocket binders.
-- Additive only: existing collection_folders RLS policies and grants stay authoritative.

alter table public.collection_folders
  add column if not exists binder_pages smallint not null default 2;

update public.collection_folders f
set binder_pages = greatest(
  2,
  f.binder_pages,
  coalesce((
    select max(i.binder_page)
    from public.collection_items i
    where i.folder_id = f.id
  ), 0),
  coalesce((
    select ceil(count(*) / 9.0)::integer
    from public.collection_items i
    where i.folder_id = f.id
  ), 0)
);

alter table public.collection_folders
  drop constraint if exists collection_folders_binder_pages_check;

alter table public.collection_folders
  add constraint collection_folders_binder_pages_check
  check (binder_pages between 2 and 100);

comment on column public.collection_folders.binder_pages is
  'Collector-defined number of 9-pocket pages displayed by the interactive binder.';
