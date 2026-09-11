-- DUELVANTA COLLECT Scanner V16 binder-position foundation
-- Additive only. Existing collection rows keep legacy ordering until assigned a page/slot.

alter table public.collection_items
  add column if not exists binder_page integer,
  add column if not exists binder_slot smallint,
  add column if not exists scan_source text,
  add column if not exists scan_confidence smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='collection_items_binder_page_check') then
    alter table public.collection_items add constraint collection_items_binder_page_check
      check (binder_page is null or binder_page between 1 and 9999);
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_binder_slot_check') then
    alter table public.collection_items add constraint collection_items_binder_slot_check
      check (binder_slot is null or binder_slot between 1 and 9);
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_binder_position_pair_check') then
    alter table public.collection_items add constraint collection_items_binder_position_pair_check
      check ((binder_page is null and binder_slot is null) or (folder_id is not null and binder_page is not null and binder_slot is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_scan_source_check') then
    alter table public.collection_items add constraint collection_items_scan_source_check
      check (scan_source is null or scan_source in ('manual','v15','v16_single','v16_continuous','v16_multi','v16_binder'));
  end if;
  if not exists (select 1 from pg_constraint where conname='collection_items_scan_confidence_check') then
    alter table public.collection_items add constraint collection_items_scan_confidence_check
      check (scan_confidence is null or scan_confidence between 0 and 100);
  end if;
end $$;

create unique index if not exists collection_items_binder_position_unique
  on public.collection_items(user_id,folder_id,binder_page,binder_slot)
  where folder_id is not null and binder_page is not null and binder_slot is not null;

comment on column public.collection_items.binder_page is 'Physical/digital binder page assigned by DUELVANTA Scanner V16 or user.';
comment on column public.collection_items.binder_slot is '1-9 slot on binder_page.';
comment on column public.collection_items.scan_source is 'Origin of the collection row; V16 values are analytics/provenance only.';
comment on column public.collection_items.scan_confidence is 'Recognition confidence at import time, 0-100; never used as authorization or grading truth.';
