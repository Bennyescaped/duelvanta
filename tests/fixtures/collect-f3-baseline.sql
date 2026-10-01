-- Extracted from the existing isolated F3 fixture; no deletion implementation here.
create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema dv_market_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key references auth.users on delete cascade,data_processing_restricted_at timestamptz);
 create table public.collection_folders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,name text);
 create table public.collection_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,folder_id uuid references public.collection_folders on delete set null,binder_page int,binder_slot int);
 alter table public.collection_folders enable row level security;alter table public.collection_items enable row level security;
 create policy own_folders on public.collection_folders to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create policy own_items on public.collection_items to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant all on public.collection_folders to anon,authenticated,service_role;
 grant all on public.collection_items to authenticated,service_role;
 create function dv_market_private.block_restricted_account_mutation() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if current_user<>'service_role' and auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.data_processing_restricted_at is not null) then raise exception 'account_data_processing_restricted';end if;
 if tg_op='DELETE' then return old;end if;return new;end$$;
 create trigger block_restricted_collection_folders before insert or update or delete on public.collection_folders for each row execute function dv_market_private.block_restricted_account_mutation();
 create trigger block_restricted_collection_items before insert or update or delete on public.collection_items for each row execute function dv_market_private.block_restricted_account_mutation();
 insert into auth.users values('91000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000002');insert into public.profiles(id) values('91000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000002');
create function public.clear_collection_binder_position_on_folder_change() returns trigger language plpgsql set search_path='' as $$begin
 if old.folder_id is distinct from new.folder_id or new.folder_id is null then new.binder_page:=null;new.binder_slot:=null;end if;return new;end$$;
create trigger trg_clear_collection_binder_position_on_folder_change before update of folder_id on public.collection_items for each row execute function public.clear_collection_binder_position_on_folder_change();
create unique index collection_items_binder_position_unique on public.collection_items(user_id,folder_id,binder_page,binder_slot) where folder_id is not null and binder_page is not null and binder_slot is not null;
