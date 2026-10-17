-- REVIEW ONLY. Apply AFTER account-erasure-l1-v1.sql and BEFORE tcg-i2-readiness-v1.sql.
-- One additive canonical substrate; no legacy backfill, identity or snapshot rewrite.
begin;
create table dv_collect_private.tcg_games(
 game_key text primary key check(game_key ~ '^[a-z][a-z0-9_]*$'),
 registry_version text not null, available boolean not null default false,
 collection_ready boolean not null default false, marketplace_ready boolean not null default false);
create table dv_collect_private.tcg_providers(provider_key text primary key,display_name text not null);
create table dv_collect_private.tcg_provider_bindings(
 game_key text references dv_collect_private.tcg_games,provider_key text references dv_collect_private.tcg_providers,
 provider_version text not null,primary key(game_key,provider_key,provider_version));
create table dv_collect_private.tcg_languages(language_code text primary key,locale text not null unique);
create table dv_collect_private.tcg_sets(
 id uuid primary key default gen_random_uuid(),game_key text not null references dv_collect_private.tcg_games,
 name text not null,unique(id,game_key));
create table dv_collect_private.tcg_cards(
 id uuid primary key default gen_random_uuid(),game_key text not null references dv_collect_private.tcg_games,
 set_id uuid not null,language_code text not null references dv_collect_private.tcg_languages,
 collector_number text not null,name text not null,rarity text,
 foreign key(set_id,game_key) references dv_collect_private.tcg_sets(id,game_key),
 unique(id,game_key),unique(id,game_key,language_code));
create index tcg_cards_set on dv_collect_private.tcg_cards(set_id,game_key);
create table dv_collect_private.tcg_card_variants(
 id uuid primary key default gen_random_uuid(),card_id uuid not null,game_key text not null,
 language_code text not null references dv_collect_private.tcg_languages,
 rarity text,finish text,artwork text,treatment text,edition text,
 foreign key(card_id,game_key,language_code) references dv_collect_private.tcg_cards(id,game_key,language_code),
 unique(id,game_key),unique(id,card_id,game_key));
create index tcg_variants_card on dv_collect_private.tcg_card_variants(card_id,game_key,language_code);
-- Optional catalog concept, NOT a dependency of the existing generic Sealed writer.
create table dv_collect_private.tcg_sealed_products(
 id uuid primary key default gen_random_uuid(),game_key text not null references dv_collect_private.tcg_games,
 set_id uuid,name text not null,product_type text not null,
 language_code text references dv_collect_private.tcg_languages,
 foreign key(set_id,game_key) references dv_collect_private.tcg_sets(id,game_key),unique(id,game_key));
create index tcg_sealed_set on dv_collect_private.tcg_sealed_products(set_id,game_key);
create table dv_collect_private.tcg_provider_refs(
 id uuid primary key default gen_random_uuid(),game_key text not null,provider_key text not null,
 provider_version text not null,entity_kind text not null check(entity_kind in ('set','card','variant','sealed')),
 namespace text not null check(length(namespace)>0),external_id text not null check(length(external_id)>0),
 locale text references dv_collect_private.tcg_languages(locale),discriminator text,record_version text not null,
 set_id uuid,card_id uuid,variant_id uuid,sealed_product_id uuid,
 foreign key(game_key,provider_key,provider_version) references dv_collect_private.tcg_provider_bindings,
 foreign key(set_id,game_key) references dv_collect_private.tcg_sets(id,game_key),
 foreign key(card_id,game_key) references dv_collect_private.tcg_cards(id,game_key),
 foreign key(variant_id,game_key) references dv_collect_private.tcg_card_variants(id,game_key),
 foreign key(sealed_product_id,game_key) references dv_collect_private.tcg_sealed_products(id,game_key),
 check((entity_kind='set' and set_id is not null and card_id is null and variant_id is null and sealed_product_id is null)
 or (entity_kind='card' and card_id is not null and set_id is null and variant_id is null and sealed_product_id is null)
 or (entity_kind='variant' and variant_id is not null and set_id is null and card_id is null and sealed_product_id is null)
 or (entity_kind='sealed' and sealed_product_id is not null and set_id is null and card_id is null and variant_id is null)),
 unique nulls not distinct(provider_key,game_key,provider_version,entity_kind,namespace,external_id,locale,discriminator),
 unique(id,game_key));
create index tcg_refs_binding on dv_collect_private.tcg_provider_refs(game_key,provider_key,provider_version);
create index tcg_refs_set on dv_collect_private.tcg_provider_refs(set_id,game_key);
create index tcg_refs_card on dv_collect_private.tcg_provider_refs(card_id,game_key);
create index tcg_refs_variant on dv_collect_private.tcg_provider_refs(variant_id,game_key);
create index tcg_refs_sealed on dv_collect_private.tcg_provider_refs(sealed_product_id,game_key);
create table dv_collect_private.collection_item_catalog_links(
 collection_item_id uuid primary key references public.collection_items(id) on delete cascade,
 game_key text not null,card_id uuid not null,variant_id uuid,provider_ref_id uuid not null,
 link_state text not null default 'resolved' check(link_state='resolved'),
 method text not null default 'verified_provider_ref' check(method='verified_provider_ref'),
 created_at timestamptz not null default now(),verified_at timestamptz not null default now(),
 foreign key(card_id,game_key) references dv_collect_private.tcg_cards(id,game_key),
 foreign key(variant_id,card_id,game_key) references dv_collect_private.tcg_card_variants(id,card_id,game_key),
 foreign key(provider_ref_id,game_key) references dv_collect_private.tcg_provider_refs(id,game_key));
create table dv_collect_private.listing_catalog_links(
 listing_id uuid primary key references public.market_listings(id) on delete cascade,
 game_key text not null,card_id uuid not null,variant_id uuid,provider_ref_id uuid not null,
 link_state text not null default 'resolved' check(link_state='resolved'),
 method text not null default 'verified_provider_ref' check(method='verified_provider_ref'),
 created_at timestamptz not null default now(),verified_at timestamptz not null default now(),
 foreign key(card_id,game_key) references dv_collect_private.tcg_cards(id,game_key),
 foreign key(variant_id,card_id,game_key) references dv_collect_private.tcg_card_variants(id,card_id,game_key),
 foreign key(provider_ref_id,game_key) references dv_collect_private.tcg_provider_refs(id,game_key));
create index tcg_collection_link_card on dv_collect_private.collection_item_catalog_links(card_id,game_key);
create index tcg_collection_link_variant on dv_collect_private.collection_item_catalog_links(variant_id,card_id,game_key);
create index tcg_collection_link_ref on dv_collect_private.collection_item_catalog_links(provider_ref_id,game_key);
create index tcg_listing_link_card on dv_collect_private.listing_catalog_links(card_id,game_key);
create index tcg_listing_link_variant on dv_collect_private.listing_catalog_links(variant_id,card_id,game_key);
create index tcg_listing_link_ref on dv_collect_private.listing_catalog_links(provider_ref_id,game_key);

insert into dv_collect_private.tcg_games values('pokemon','1',true,true,true),('one_piece','1',true,true,true);
insert into dv_collect_private.tcg_providers values('tcgdex','TCGdex'),('optcg','OPTCG');
insert into dv_collect_private.tcg_provider_bindings values('pokemon','tcgdex','1'),('one_piece','optcg','1');
insert into dv_collect_private.tcg_languages values('DE','de'),('EN','en'),('JP','ja'),('KR','ko'),('FR','fr'),('IT','it'),('ES','es'),('CN','zh-cn');

-- No browser or service direct catalog/link rights. No default-ACL expansion.
do $acl$ declare t text;begin
 foreach t in array array['tcg_games','tcg_providers','tcg_provider_bindings','tcg_languages','tcg_sets','tcg_cards','tcg_card_variants','tcg_sealed_products','tcg_provider_refs','collection_item_catalog_links','listing_catalog_links'] loop
  execute format('alter table dv_collect_private.%I enable row level security',t);
  execute format('revoke all on table dv_collect_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $acl$;
create policy tcg_collection_owner on dv_collect_private.collection_item_catalog_links for select to authenticated
 using(exists(select 1 from public.collection_items i where i.id=collection_item_id and i.user_id=auth.uid()));
create policy tcg_listing_seller on dv_collect_private.listing_catalog_links for select to authenticated
 using(exists(select 1 from public.market_listings l where l.id=listing_id and l.seller_id=auth.uid()));

create function dv_collect_private.tcg_validate_link_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_provider_refs%rowtype;c uuid;v uuid;g text;
begin
 select * into r from dv_collect_private.tcg_provider_refs where id=new.provider_ref_id;
 if r.entity_kind='card' then c:=r.card_id;
 elsif r.entity_kind='variant' then
  select card_id,id into c,v from dv_collect_private.tcg_card_variants where id=r.variant_id;
 else raise exception 'tcg_link_kind_invalid' using errcode='23514';end if;
 if (r.game_key,c,v) is distinct from (new.game_key,new.card_id,new.variant_id) then
  raise exception 'tcg_link_target_mismatch' using errcode='23514';end if;
 if tg_table_name='collection_item_catalog_links' then
  select tcg into g from public.collection_items where id=new.collection_item_id;
 else select tcg into g from public.market_listings where id=new.listing_id;end if;
 if g is distinct from new.game_key or not exists(select 1 from dv_collect_private.tcg_games
 where game_key=g and available and case when tg_table_name='collection_item_catalog_links' then collection_ready else marketplace_ready end) then
  raise exception 'tcg_link_game_mismatch' using errcode='23514';end if;
 return new;
end $$;
create trigger tcg_validate_link before insert or update on dv_collect_private.collection_item_catalog_links for each row execute function dv_collect_private.tcg_validate_link_v1();
create trigger tcg_validate_link before insert or update on dv_collect_private.listing_catalog_links for each row execute function dv_collect_private.tcg_validate_link_v1();

create function dv_collect_private.tcg_clear_stale_link_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
begin
 if tg_table_name='collection_items' then
  if (old.tcg,old.user_id,old.card_name,old.set_name,old.card_number,old.language,old.variant)
   is distinct from (new.tcg,new.user_id,new.card_name,new.set_name,new.card_number,new.language,new.variant) then
   delete from dv_collect_private.collection_item_catalog_links where collection_item_id=old.id;
  end if;
 else
  if (old.tcg,old.seller_id,old.card_name,old.set_name,old.card_number,old.language,old.variant)
   is distinct from (new.tcg,new.seller_id,new.card_name,new.set_name,new.card_number,new.language,new.variant) then
   delete from dv_collect_private.listing_catalog_links where listing_id=old.id;
  end if;
 end if;return new;
end $$;
create trigger tcg_clear_stale_link after update on public.collection_items for each row execute function dv_collect_private.tcg_clear_stale_link_v1();
create trigger tcg_clear_stale_link after update on public.market_listings for each row execute function dv_collect_private.tcg_clear_stale_link_v1();

create function dv_collect_private.tcg_own_links_v1() returns jsonb language sql stable security definer
 set search_path=pg_catalog,public,dv_collect_private as $$
 select jsonb_build_object('collection',coalesce((select jsonb_agg(jsonb_build_object(
 'collection_item_id',x.collection_item_id,'game_key',x.game_key,'card_id',x.card_id,'variant_id',x.variant_id,
 'provider_ref_id',x.provider_ref_id,'link_state',x.link_state,'method',x.method,'created_at',x.created_at,'verified_at',x.verified_at)
 order by x.collection_item_id) from dv_collect_private.collection_item_catalog_links x
 join public.collection_items i on i.id=x.collection_item_id where i.user_id=auth.uid()),'[]'::jsonb),
 'listings',coalesce((select jsonb_agg(jsonb_build_object(
 'listing_id',x.listing_id,'game_key',x.game_key,'card_id',x.card_id,'variant_id',x.variant_id,
 'provider_ref_id',x.provider_ref_id,'link_state',x.link_state,'method',x.method,'created_at',x.created_at,'verified_at',x.verified_at)
 order by x.listing_id) from dv_collect_private.listing_catalog_links x
 join public.market_listings l on l.id=x.listing_id where l.seller_id=auth.uid()),'[]'::jsonb))
$$;
create function public.get_my_tcg_catalog_links_v1() returns jsonb language plpgsql stable security definer
 set search_path=pg_catalog,public,dv_collect_private as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false) then raise exception 'tcg_schema_not_ready';end if;
 return dv_collect_private.tcg_own_links_v1();
end $$;

-- Shared writer is private: caller cannot choose a user_id or canonical target.
create function dv_collect_private.tcg_set_own_link_v1(p_parent_id uuid,p_provider_ref_id uuid,p_listing boolean)
 returns void language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare u uuid:=auth.uid();g text;r dv_collect_private.tcg_provider_refs%rowtype;c uuid;v uuid;restricted timestamptz;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501';end if;
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or p_listing and not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false) then raise exception 'tcg_schema_not_ready';end if;
 select data_processing_restricted_at into restricted from public.profiles where id=u for update;
 if not found or restricted is not null then raise exception 'account_data_processing_restricted' using errcode='42501';end if;
 if p_listing then
  select tcg into g from public.market_listings where id=p_parent_id and seller_id=u and product_kind<>'sealed' for update;
 else select tcg into g from public.collection_items where id=p_parent_id and user_id=u for update;end if;
 if not found then raise exception 'tcg_parent_not_owned' using errcode='42501';end if;
 if p_provider_ref_id is null then
  if p_listing then delete from dv_collect_private.listing_catalog_links where listing_id=p_parent_id;
  else delete from dv_collect_private.collection_item_catalog_links where collection_item_id=p_parent_id;end if;return;
 end if;
 select * into r from dv_collect_private.tcg_provider_refs where id=p_provider_ref_id and game_key=g;
 if not found or r.entity_kind not in ('card','variant') then raise exception 'tcg_ref_invalid' using errcode='23514';end if;
 if r.entity_kind='variant' then select card_id,id into c,v from dv_collect_private.tcg_card_variants where id=r.variant_id;else c:=r.card_id;end if;
 if p_listing then
  insert into dv_collect_private.listing_catalog_links(listing_id,game_key,card_id,variant_id,provider_ref_id)
   values(p_parent_id,g,c,v,r.id) on conflict(listing_id) do update set game_key=excluded.game_key,card_id=excluded.card_id,
   variant_id=excluded.variant_id,provider_ref_id=excluded.provider_ref_id,verified_at=now();
 else
  insert into dv_collect_private.collection_item_catalog_links(collection_item_id,game_key,card_id,variant_id,provider_ref_id)
   values(p_parent_id,g,c,v,r.id) on conflict(collection_item_id) do update set game_key=excluded.game_key,card_id=excluded.card_id,
   variant_id=excluded.variant_id,provider_ref_id=excluded.provider_ref_id,verified_at=now();
 end if;
end $$;
create function public.set_my_collection_catalog_link_v1(p_parent_id uuid,p_provider_ref_id uuid) returns void
 language sql security definer set search_path=pg_catalog,public,dv_collect_private as $$
 select dv_collect_private.tcg_set_own_link_v1(p_parent_id,p_provider_ref_id,false) $$;
create function public.set_my_listing_catalog_link_v1(p_parent_id uuid,p_provider_ref_id uuid) returns void
 language sql security definer set search_path=pg_catalog,public,dv_collect_private as $$
 select dv_collect_private.tcg_set_own_link_v1(p_parent_id,p_provider_ref_id,true) $$;

revoke all on function dv_collect_private.tcg_validate_link_v1(),dv_collect_private.tcg_clear_stale_link_v1(),dv_collect_private.tcg_own_links_v1(),dv_collect_private.tcg_set_own_link_v1(uuid,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function public.get_my_tcg_catalog_links_v1(),public.set_my_collection_catalog_link_v1(uuid,uuid),public.set_my_listing_catalog_link_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_tcg_catalog_links_v1(),public.set_my_collection_catalog_link_v1(uuid,uuid),public.set_my_listing_catalog_link_v1(uuid,uuid) to authenticated;

-- Bind exact effective L1/T2 bodies, not earlier historical definitions.
-- pg_get_functiondef preserves the current signature, owner, ACL and search_path.
do $integration$ declare d text;begin
 select pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure) into d;
 if md5(d)<>'b3556d2250e4a1c8e973f8e1d199dd85' then raise exception 'tcg_i2_export_base_mismatch';end if;
 d:=replace(d,'duelvanta-data-export-v3','duelvanta-data-export-v4');
 d:=replace(d,'  insert into dv_market_private.user_data_export_events',
 E'  v_payload:=v_payload || jsonb_build_object(''tcg_catalog_links'',dv_collect_private.tcg_own_links_v1());\n  insert into dv_market_private.user_data_export_events');
 execute d;
 select pg_get_functiondef('public.prepare_account_deletion_data(uuid,uuid)'::regprocedure) into d;
 if md5(d)<>'60d88f2c57874c82a7714fdee6057d37' then raise exception 'tcg_i2_prepare_base_mismatch';end if;
 d:=replace(d,'  delete from public.collection_items where user_id=v_request.user_id;',
 E'  delete from dv_collect_private.listing_catalog_links x using public.market_listings l\n    where x.listing_id=l.id and l.seller_id=v_request.user_id;\n  delete from public.collection_items where user_id=v_request.user_id;');
 execute d;
end $integration$;
commit;
