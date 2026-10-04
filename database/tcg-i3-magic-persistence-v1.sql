-- REVIEW / SYNTHETIC FOUNDATION ONLY. Paired atomically with the new readiness delta.
-- No source acquisition, activation, historical I2 source edit or user backfill.
begin;
do $$begin
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false) then
  raise exception 'tcg_i3_base_not_ready';
 end if;
end$$;


create table if not exists dv_collect_private.tcg_provider_evidence(
 id uuid primary key default gen_random_uuid(),
 provider_ref_id uuid not null references dv_collect_private.tcg_provider_refs(id) on delete restrict,
 provider_version text not null,record_version text not null,
 raw_record jsonb not null,canonical_utf8 bytea not null,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 source_path text not null check(length(source_path) between 1 and 500),
 retrieved_at timestamptz not null,
 supersedes_id uuid references dv_collect_private.tcg_provider_evidence(id) on delete restrict,
 check(record_version='sha256:'||content_sha256),
 check(octet_length(canonical_utf8) between 1 and 1048576),
 unique(provider_ref_id,record_version),unique(id,provider_ref_id));
create table if not exists dv_collect_private.tcg_catalog_derivations(
 id uuid primary key default gen_random_uuid(),provider_ref_id uuid not null,
 evidence_id uuid not null,contract_name text not null check(contract_name='MagicVariantEvidence'),
 contract_version text not null check(contract_version='1'),validated_evidence jsonb not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 reference_evidence_id uuid references dv_collect_private.tcg_provider_evidence(id) on delete restrict,
 created_at timestamptz not null default now(),
 foreign key(evidence_id,provider_ref_id) references dv_collect_private.tcg_provider_evidence(id,provider_ref_id) on delete restrict,
 unique(provider_ref_id,evidence_id,contract_name,contract_version,evidence_sha256),
 unique(id,provider_ref_id,evidence_id));
create table if not exists dv_collect_private.tcg_catalog_snapshots(
 id uuid primary key,game_key text not null,provider_key text not null,provider_version text not null,
 bulk_id uuid not null,bulk_type text not null check(bulk_type='all_cards'),bulk_updated_at timestamptz not null,
 download_uri text not null check(length(download_uri)<=500 and download_uri ~ '^https://data\.scryfall\.io/all-cards/all-cards-[0-9]{14}\.jsonl\.gz$'),
 format text not null check(format='gzip_jsonl'),compressed_size bigint not null check(compressed_size between 1 and 1073741824),
 compressed_sha256 text not null check(compressed_sha256 ~ '^[0-9a-f]{64}$'),jsonl_sha256 text not null check(jsonl_sha256 ~ '^[0-9a-f]{64}$'),
 sets_response_sha256 text not null check(sets_response_sha256 ~ '^[0-9a-f]{64}$'),manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
 raw_manifest jsonb not null check(jsonb_typeof(raw_manifest)='object' and octet_length(raw_manifest::text)<=65536),
 scope_contract text not null check(scope_contract='magic-collect-catalog-v1'),scope_sha256 text not null,
 retrieved_at timestamptz not null,record_count bigint not null check(record_count between 1 and 5000000),
 accepted_cards bigint not null check(accepted_cards>0 and accepted_cards<=record_count),
 accepted_variants bigint not null check(accepted_variants>=0 and accepted_variants<=accepted_cards*3),
 accepted_sets bigint not null check(accepted_sets>0 and accepted_sets<=accepted_cards),sealed_at timestamptz not null,
 foreign key(game_key,provider_key,provider_version) references dv_collect_private.tcg_provider_bindings on delete restrict,
 unique(game_key,provider_key,provider_version,bulk_id,bulk_updated_at,compressed_sha256,sets_response_sha256,scope_sha256),
 unique(id,game_key,provider_key,provider_version));
create table if not exists dv_collect_private.tcg_catalog_snapshot_members(
 snapshot_id uuid not null references dv_collect_private.tcg_catalog_snapshots(id) on delete restrict,
 provider_ref_id uuid not null references dv_collect_private.tcg_provider_refs(id) on delete restrict,
 evidence_id uuid not null,derivation_id uuid,
 source_path text not null check(length(source_path) between 1 and 500),retrieved_at timestamptz not null,
 primary key(snapshot_id,provider_ref_id),
 foreign key(evidence_id,provider_ref_id) references dv_collect_private.tcg_provider_evidence(id,provider_ref_id) on delete restrict,
 foreign key(derivation_id,provider_ref_id,evidence_id) references dv_collect_private.tcg_catalog_derivations(id,provider_ref_id,evidence_id) on delete restrict);
create table if not exists dv_collect_private.tcg_catalog_releases(
 game_key text not null,provider_key text not null,provider_version text not null,snapshot_id uuid,
 activation_contract text not null check(activation_contract='magic-collect-catalog-v1'),scope_sha256 text not null,descriptor_sha256 text not null,
 schema_phase text not null check(schema_phase in ('persistence','collect')),state text not null check(state in ('foundation','active','suspended')),
 release_generation bigint not null default 0 check(release_generation>=0),
 source_terms_review_ref text check(source_terms_review_ref ~ '^sha256:[0-9a-f]{64}$'),
 attribution_review_ref text check(attribution_review_ref ~ '^sha256:[0-9a-f]{64}$'),updated_at timestamptz not null default now(),
 primary key(game_key,provider_key,provider_version),
 foreign key(game_key,provider_key,provider_version) references dv_collect_private.tcg_provider_bindings on delete restrict,
 foreign key(snapshot_id,game_key,provider_key,provider_version) references dv_collect_private.tcg_catalog_snapshots(id,game_key,provider_key,provider_version) on delete restrict,
 check((state='foundation' and schema_phase='persistence' and source_terms_review_ref is null and attribution_review_ref is null)
 or (state='active' and schema_phase='collect' and snapshot_id is not null and source_terms_review_ref is not null and attribution_review_ref is not null)
 or (state='suspended' and schema_phase='collect')));
do $$declare n text;begin
 foreach n in array array['tcg_provider_evidence','tcg_catalog_derivations','tcg_catalog_snapshots','tcg_catalog_snapshot_members','tcg_catalog_releases'] loop
  execute format('alter table dv_collect_private.%I enable row level security',n);
  execute format('revoke all on table dv_collect_private.%I from public,anon,authenticated,service_role',n);
 end loop;
end$$;

create or replace function dv_collect_private.tcg_immutable_catalog_evidence_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
begin raise exception 'tcg_catalog_evidence_immutable' using errcode='23514';end$$;

create or replace function dv_collect_private.tcg_validate_provider_evidence_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_provider_refs%rowtype;x jsonb;entry record;stack jsonb[];depths integer[];d integer;k integer;n double precision;
begin
 select * into strict r from dv_collect_private.tcg_provider_refs where id=new.provider_ref_id;
 if new.provider_version is distinct from r.provider_version
 or new.record_version is distinct from 'sha256:'||new.content_sha256
 or encode(extensions.digest(new.canonical_utf8,'sha256'),'hex') is distinct from new.content_sha256
 or convert_from(new.canonical_utf8,'UTF8')::jsonb is distinct from new.raw_record
 or jsonb_typeof(new.raw_record) is distinct from 'object' then raise exception 'tcg_provider_evidence_invalid';end if;
 if new.supersedes_id is not null then
  if new.supersedes_id=new.id or not exists(select 1 from dv_collect_private.tcg_provider_evidence e where e.id=new.supersedes_id and e.provider_ref_id=new.provider_ref_id) then raise exception 'tcg_supersession_invalid';end if;
 end if;
 stack:=array[new.raw_record];depths:=array[0];
 while cardinality(stack)>0 loop
  k:=cardinality(stack);x:=stack[k];d:=depths[k];stack:=stack[1:k-1];depths:=depths[1:k-1];
  if d>20 then raise exception 'tcg_evidence_depth_limit';end if;
  if jsonb_typeof(x)='object' then
   for entry in select key,value from jsonb_each(x) loop
    if entry.key in ('__proto__','prototype','constructor') then raise exception 'tcg_evidence_unsafe_key';end if;
    stack:=array_append(stack,entry.value);depths:=array_append(depths,d+1);
   end loop;
  elsif jsonb_typeof(x)='array' then
   if jsonb_array_length(x)>1000 then raise exception 'tcg_evidence_array_limit';end if;
   for entry in select value from jsonb_array_elements(x) loop stack:=array_append(stack,entry.value);depths:=array_append(depths,d+1);end loop;
  elsif jsonb_typeof(x)='number' then
   n:=(x#>>'{}')::double precision;
   if n in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) or trunc(n)=n and abs(n)>9007199254740991 then raise exception 'tcg_evidence_number_invalid';end if;
  end if;
 end loop;
 if (r.game_key,r.provider_key,r.provider_version) is distinct from ('magic','scryfall','1') then raise exception 'tcg_evidence_binding_invalid';end if;
 if new.raw_record->>'id' is distinct from r.external_id
 or new.raw_record->>'object' is distinct from (case when r.entity_kind='set' then 'set' else 'card' end)
 or r.entity_kind='sealed' then raise exception 'tcg_evidence_identity_invalid';end if;
 return new;
end$$;

-- Foundation seeds: assert exact existing definitions, never repair divergent seeds.
do $$declare l record;begin
 if not exists(select 1 from dv_collect_private.tcg_games where game_key='magic') then insert into dv_collect_private.tcg_games values('magic','1',false,false,false);end if;
 if not exists(select 1 from dv_collect_private.tcg_games where game_key='magic' and registry_version='1' and not available and not collection_ready and not marketplace_ready) then raise exception 'tcg_magic_seed_conflict';end if;
 if not exists(select 1 from dv_collect_private.tcg_providers where provider_key='scryfall') then insert into dv_collect_private.tcg_providers values('scryfall','Scryfall');end if;
 if not exists(select 1 from dv_collect_private.tcg_providers where provider_key='scryfall' and display_name='Scryfall') then raise exception 'tcg_provider_seed_conflict';end if;
 insert into dv_collect_private.tcg_provider_bindings values('magic','scryfall','1') on conflict do nothing;
 for l in select * from (values('EN','en'),('DE','de'),('FR','fr'),('IT','it'),('ES','es'),('JP','ja'),('KR','ko'),('CN','zh-cn')) x(code,locale) loop
  if not exists(select 1 from dv_collect_private.tcg_languages where language_code=l.code and locale=l.locale) then raise exception 'tcg_language_seed_conflict';end if;
 end loop;
 insert into dv_collect_private.tcg_catalog_releases(game_key,provider_key,provider_version,activation_contract,scope_sha256,descriptor_sha256,schema_phase,state)
 values('magic','scryfall','1','magic-collect-catalog-v1','a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa','52d7223aa087a90bca1464a8e67b2fe8ae58b272c8c7993803bbad83394d1909','persistence','foundation') on conflict do nothing;
 if not exists(select 1 from dv_collect_private.tcg_catalog_releases where game_key='magic' and provider_key='scryfall' and provider_version='1' and state='foundation' and schema_phase='persistence' and snapshot_id is null and release_generation=0 and source_terms_review_ref is null and attribution_review_ref is null and scope_sha256='a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa' and descriptor_sha256='52d7223aa087a90bca1464a8e67b2fe8ae58b272c8c7993803bbad83394d1909') then raise exception 'tcg_release_seed_conflict';end if;
end$$;
-- The new readiness delta closes this installation transaction. No COMMIT here.

create or replace function dv_collect_private.tcg_validate_catalog_member_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_provider_refs%rowtype;e dv_collect_private.tcg_provider_evidence%rowtype;
 s dv_collect_private.tcg_catalog_snapshots%rowtype;v dv_collect_private.tcg_card_variants%rowtype;
 a jsonb;b jsonb;x jsonb;raws jsonb[];projections jsonb[];parts jsonb[];keys text[];k text;i integer;j integer;n integer;
 canonical text:='';tokens text[];objects jsonb[];obj jsonb;typ text;finish text;art text;treatment text;
 ff text[];pt text[];special text[];promos text[];reference_raw jsonb;reference_ref dv_collect_private.tcg_provider_refs%rowtype;
begin
 select * into strict r from dv_collect_private.tcg_provider_refs where id=new.provider_ref_id;
 select * into strict e from dv_collect_private.tcg_provider_evidence where id=new.evidence_id and provider_ref_id=r.id;
 if tg_table_name='tcg_catalog_snapshot_members' then
  select * into strict s from dv_collect_private.tcg_catalog_snapshots where id=new.snapshot_id;
  if (s.game_key,s.provider_key,s.provider_version) is distinct from (r.game_key,r.provider_key,r.provider_version)
  or r.entity_kind not in ('set','card','variant') or (r.entity_kind='variant') is distinct from (new.derivation_id is not null) then raise exception 'tcg_catalog_member_invalid';end if;
  return new;
 end if;
 if r.entity_kind is distinct from 'variant' or (r.game_key,r.provider_key,r.provider_version,r.namespace) is distinct from ('magic','scryfall','1','api/cards/finishes') then raise exception 'tcg_derivation_binding_invalid';end if;
 select * into strict v from dv_collect_private.tcg_card_variants where id=r.variant_id;
 x:=new.validated_evidence;
 if jsonb_typeof(x) is distinct from 'object' or not x ?& array['contract','version','game_key','provider_key','provider_version','printing_context','chosen_finish','available_finishes','frame','border_color','full_art','frame_effects','promo_types','illustration_ids','variation_of','reference_kind','reference_printing']
 or (select count(*) from jsonb_object_keys(x))<>17
 or (x->>'contract',x->>'version',x->>'game_key',x->>'provider_key',x->>'provider_version') is distinct from ('MagicVariantEvidence','1','magic','scryfall','1')
 or new.contract_name<>'MagicVariantEvidence' or new.contract_version<>'1' or new.reference_evidence_id is null then raise exception 'tcg_derivation_shape_invalid';end if;
 select re.raw_record into strict reference_raw from dv_collect_private.tcg_provider_evidence re where re.id=new.reference_evidence_id;
 select rr.* into strict reference_ref from dv_collect_private.tcg_provider_refs rr join dv_collect_private.tcg_provider_evidence re on re.provider_ref_id=rr.id where re.id=new.reference_evidence_id;
 if (reference_ref.game_key,reference_ref.provider_key,reference_ref.provider_version,reference_ref.entity_kind,reference_ref.locale) is distinct from (r.game_key,r.provider_key,r.provider_version,'card',r.locale) then raise exception 'tcg_derivation_reference_invalid';end if;
 raws:=array[e.raw_record,reference_raw];projections:=array[]::jsonb[];
 for i in 1..2 loop
  obj:=raws[i];
  a:=jsonb_build_object('printing_context',jsonb_build_object('id',obj->'id','set_id',obj->'set_id','oracle_id',coalesce(obj->'oracle_id','null'::jsonb),'lang',obj->'lang','layout',obj->'layout','collector_number',obj->'collector_number','released_at',coalesce(obj->'released_at','null'::jsonb),'variation',coalesce(obj->'variation','null'::jsonb),'reprint',coalesce(obj->'reprint','null'::jsonb)),
   'frame',coalesce(obj->'frame','null'::jsonb),'border_color',coalesce(obj->'border_color','null'::jsonb),'full_art',coalesce(obj->'full_art','null'::jsonb),'frame_effects',coalesce(obj->'frame_effects','[]'::jsonb),'promo_types',coalesce(obj->'promo_types','[]'::jsonb),'variation_of',coalesce(obj->'variation_of','null'::jsonb),'illustration_ids',
   case when coalesce(jsonb_array_length(obj->'card_faces'),0)>0 then (select jsonb_agg(coalesce(f->'illustration_id','null'::jsonb) order by ord) from jsonb_array_elements(obj->'card_faces') with ordinality q(f,ord)) else jsonb_build_array(coalesce(obj->'illustration_id','null'::jsonb)) end);
  projections:=array_append(projections,a);
 end loop;
 if x - array['contract','version','game_key','provider_key','provider_version','chosen_finish','available_finishes','reference_kind','reference_printing'] is distinct from projections[1]
 or x->'available_finishes' is distinct from e.raw_record->'finishes' or x->'reference_printing' is distinct from projections[2] then raise exception 'tcg_derivation_raw_mismatch';end if;
 -- Canonical derivation has closed ASCII keys and no numeric values; unlike raw
 -- records its exact ECMAScript canonical bytes can be reconstructed in SQL.
 objects:=array[x];tokens:=array[null::text];
 while cardinality(objects)>0 loop
  n:=cardinality(objects);obj:=objects[n];k:=tokens[n];objects:=objects[1:n-1];tokens:=tokens[1:n-1];
  if k is not null then canonical:=canonical||k;continue;end if;
  typ:=jsonb_typeof(obj);
  if typ in ('string','boolean','null') then canonical:=canonical||obj::text;
  elsif typ='object' then
   canonical:=canonical||'{';objects:=array_append(objects,'null'::jsonb);tokens:=array_append(tokens,'}');
   keys:=array(select key from jsonb_object_keys(obj) q(key) order by key collate "C");
   for j in reverse cardinality(keys)..1 loop
    k:=keys[j];if k in ('__proto__','prototype','constructor') then raise exception 'tcg_derivation_unsafe_key';end if;
    objects:=array_append(objects,obj->k);tokens:=array_append(tokens,null);
    objects:=array_append(objects,'null'::jsonb);tokens:=array_append(tokens,to_jsonb(k)::text||':');
    if j>1 then objects:=array_append(objects,'null'::jsonb);tokens:=array_append(tokens,',');end if;
   end loop;
  elsif typ='array' then
   canonical:=canonical||'[';objects:=array_append(objects,'null'::jsonb);tokens:=array_append(tokens,']');
   for j in reverse jsonb_array_length(obj)-1..0 loop
    objects:=array_append(objects,obj->j);tokens:=array_append(tokens,null);
    if j>0 then objects:=array_append(objects,'null'::jsonb);tokens:=array_append(tokens,',');end if;
   end loop;
  else raise exception 'tcg_derivation_scalar_invalid';end if;
 end loop;
 if octet_length(canonical)>16384 or encode(extensions.digest(convert_to(canonical,'UTF8'),'sha256'),'hex') is distinct from new.evidence_sha256 then raise exception 'tcg_derivation_digest_invalid';end if;
 a:=projections[1];b:=projections[2];finish:=x->>'chosen_finish';
 if finish is null or finish not in ('nonfoil','foil','etched') or not (x->'available_finishes') ? finish or r.discriminator is distinct from 'finish:'||finish then raise exception 'tcg_derivation_finish_invalid';end if;
 if jsonb_typeof(a->'frame_effects') is distinct from 'array' or jsonb_typeof(a->'promo_types') is distinct from 'array' then raise exception 'tcg_derivation_flags_invalid';end if;
 for obj in select unnest(array[a,b]) loop
  foreach k in array array['frame_effects','promo_types'] loop
   if jsonb_array_length(obj->k)>32 or (select count(*) from jsonb_array_elements(obj->k))<>(select count(distinct value) from jsonb_array_elements(obj->k))
   or exists(select 1 from jsonb_array_elements(obj->k) q(f) where jsonb_typeof(f)<>'string' or length(f#>>'{}')>32 or (f#>>'{}') !~ '^[a-z0-9_]+$') then raise exception 'tcg_derivation_flags_invalid';end if;
  end loop;
 end loop;
 if not coalesce(b->>'frame' in ('2003','2015'),false) or not coalesce(b->>'border_color' in ('black','white'),false) or b->'full_art' is distinct from 'false'::jsonb
 or b#>'{printing_context,variation}' is distinct from 'false'::jsonb or b->'variation_of' is distinct from 'null'::jsonb
 or exists(select 1 from jsonb_array_elements_text(b->'frame_effects') q(f) where f<>'legendary')
 or exists(select 1 from jsonb_array_elements_text(b->'promo_types') q(f) where f<>'boosterfun') then raise exception 'tcg_derivation_reference_not_standard';end if;
 if a#>>'{printing_context,oracle_id}' is null or a#>>'{printing_context,oracle_id}' is distinct from b#>>'{printing_context,oracle_id}'
 or a#>>'{printing_context,lang}' is distinct from b#>>'{printing_context,lang}' or a#>>'{printing_context,layout}' is distinct from b#>>'{printing_context,layout}' then raise exception 'tcg_derivation_concept_invalid';end if;
 n:=case a#>>'{printing_context,layout}' when 'normal' then 1 when 'split' then 2 when 'adventure' then 2 when 'transform' then 2 when 'modal_dfc' then 2 else 0 end;
 if n=0 or jsonb_array_length(a->'illustration_ids')<>n or jsonb_array_length(b->'illustration_ids')<>n
 or exists(select 1 from jsonb_array_elements((a->'illustration_ids')||(b->'illustration_ids')) q(f) where jsonb_typeof(f)<>'string' or (f#>>'{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'tcg_derivation_art_invalid';end if;
 if x->>'reference_kind'='same_set_standard' then
  if a#>>'{printing_context,set_id}' is distinct from b#>>'{printing_context,set_id}' or a->>'variation_of' is not null and a->>'variation_of' is distinct from b#>>'{printing_context,id}' then raise exception 'tcg_derivation_reference_invalid';end if;
  if a#>>'{printing_context,id}'=b#>>'{printing_context,id}' and a is distinct from b then raise exception 'tcg_derivation_reference_invalid';end if;
 elsif x->>'reference_kind'='earlier_modern_standard' then
  if a#>'{printing_context,reprint}' is distinct from 'true'::jsonb or a->'variation_of' is distinct from 'null'::jsonb
  or a#>>'{printing_context,id}'=b#>>'{printing_context,id}'
  or a#>>'{printing_context,released_at}' is null or b#>>'{printing_context,released_at}' is null
  or (b#>>'{printing_context,released_at}')::date >= (a#>>'{printing_context,released_at}')::date then raise exception 'tcg_derivation_reference_invalid';end if;
 else raise exception 'tcg_derivation_reference_invalid';end if;
 art:=case when a->'illustration_ids'=b->'illustration_ids' then 'normal' else 'alternate_art' end;
 ff:=array(select jsonb_array_elements_text(a->'frame_effects'));pt:=array(select jsonb_array_elements_text(a->'promo_types'));
 special:=array(select f from unnest(ff) q(f) where f<>'legendary' and not (f='etched' and finish='etched'));
 promos:=array(select f from unnest(pt) q(f) where f<>'boosterfun');
 if a->>'frame' in ('2003','2015') then
  if a->>'border_color' in ('black','white') and a->'full_art'='false'::jsonb and cardinality(special)=0 and cardinality(promos)=0 then treatment:='normal';
  elsif a->>'border_color'='borderless' and jsonb_typeof(a->'full_art')='boolean' and cardinality(special)=0 and cardinality(promos)=0 then treatment:='borderless';
  elsif a->>'border_color' in ('black','white') and jsonb_typeof(a->'full_art')='boolean' and cardinality(special)=1 and cardinality(promos)=0 and special[1] in ('extendedart','showcase') then treatment:=case special[1] when 'extendedart' then 'extended_art' else 'showcase' end;
  elsif a->>'border_color' in ('black','white') and a->'full_art'='false'::jsonb and cardinality(special)=0 and cardinality(promos)=2 and promos @> array['prerelease','datestamped'] and finish='foil' then treatment:='prerelease_stamp';end if;
 elsif a->>'frame' in ('1993','1997') and a->>'border_color' in ('black','white') and a->'full_art'='false'::jsonb and cardinality(special)=0 and cardinality(promos)=0 and x->>'reference_kind'='earlier_modern_standard' then treatment:='retro_frame';end if;
 if treatment is null or (v.finish,v.artwork,v.treatment,v.edition) is distinct from (finish,art,treatment,null::text) then raise exception 'tcg_derivation_variant_invalid';end if;
 return new;
end$$;

create or replace function dv_collect_private.tcg_existing_own_game_item_v1(p_item_id uuid,p_game_key text) returns boolean
 language sql stable security definer set search_path=pg_catalog,public,dv_collect_private as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.collection_items where id=p_item_id and tcg=p_game_key and user_id=auth.uid())
$$;

create or replace function dv_collect_private.tcg_require_collection_release_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_catalog_releases%rowtype;
begin
 if tg_op='UPDATE' and (old.tcg,old.user_id,old.card_name,old.set_name,old.card_number,old.language,old.variant)
 is not distinct from (new.tcg,new.user_id,new.card_name,new.set_name,new.card_number,new.language,new.variant) then return new;end if;
 select * into r from dv_collect_private.tcg_catalog_releases where game_key=new.tcg for share;
 if not found then return new;end if;
 if r.state<>'active' or r.schema_phase<>'collect' or r.snapshot_id is null
 or new.language not in ('EN','DE','FR','IT','ES','JP','KR','CN') or new.language is null
 or not exists(select 1 from dv_collect_private.tcg_games where game_key=new.tcg and available and collection_ready and not marketplace_ready)
 or not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false) then raise exception 'tcg_collection_release_unavailable';end if;
 return new;
end$$;

create or replace function dv_collect_private.tcg_require_current_catalog_ref_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_catalog_releases%rowtype;c dv_collect_private.tcg_cards%rowtype;
 i public.collection_items%rowtype;v dv_collect_private.tcg_card_variants%rowtype;name text;variant_label text;
begin
 select * into r from dv_collect_private.tcg_catalog_releases where game_key=new.game_key for share;
 if not found then return new;end if;
 if r.state<>'active' or r.schema_phase<>'collect' or r.snapshot_id is null
 or not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not exists(select 1 from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs p on p.id=m.provider_ref_id where m.snapshot_id=r.snapshot_id and m.provider_ref_id=new.provider_ref_id and (p.game_key,p.provider_key,p.provider_version)=(r.game_key,r.provider_key,r.provider_version) and (p.entity_kind='card' and p.card_id=new.card_id and new.variant_id is null or p.entity_kind='variant' and p.variant_id=new.variant_id and m.derivation_id is not null)) then raise exception 'tcg_catalog_ref_unavailable';end if;
 select * into strict c from dv_collect_private.tcg_cards where id=new.card_id and game_key=new.game_key;
 select * into strict i from public.collection_items where id=new.collection_item_id;
 select s.name into strict name from dv_collect_private.tcg_sets s where s.id=c.set_id;
 if (i.tcg,i.language,i.card_number,i.card_name,i.set_name) is distinct from (c.game_key,c.language_code,c.collector_number,c.name,name) then raise exception 'tcg_catalog_parent_mismatch';end if;
 if new.variant_id is not null then
  select * into strict v from dv_collect_private.tcg_card_variants where id=new.variant_id and card_id=c.id and game_key=c.game_key and language_code=c.language_code;
  variant_label:=case v.finish when 'nonfoil' then 'Nonfoil' when 'foil' then 'Foil' when 'etched' then 'Etched' end||' · '||case v.artwork when 'normal' then 'Normal' when 'alternate_art' then 'Alternate Art' end||' · '||case v.treatment when 'normal' then 'Normal' when 'borderless' then 'Borderless' when 'extended_art' then 'Extended Art' when 'showcase' then 'Showcase' when 'retro_frame' then 'Retro Frame' when 'prerelease_stamp' then 'Prerelease Stamp' end;
  if variant_label is null or i.variant is distinct from variant_label then raise exception 'tcg_catalog_parent_mismatch';end if;
 end if;
 return new;
end$$;
-- Owner-only typed publication. No caller relation names or canonical row map.
create or replace function dv_collect_private.tcg_publish_catalog_snapshot_v1(p_snapshot_id uuid,p_expected_generation bigint) returns uuid
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $publisher$
declare h record;rel dv_collect_private.tcg_catalog_releases%rowtype;old_snapshot dv_collect_private.tcg_catalog_snapshots%rowtype;
 t record;q record;rr record;pr dv_collect_private.tcg_provider_refs%rowtype;prev uuid;target uuid;ref uuid;ev uuid;der uuid;refev uuid;
 lang text;loc text;display text;raw jsonb;expected jsonb;actual jsonb;tab text;parts text[];cols text[];types text[];
begin
 if p_snapshot_id is null or p_expected_generation is null or p_expected_generation<0 then raise exception 'catalog_publish_input';end if;
 -- Exact attributes, fixed owner and namespace; constraints are checked below.
 for tab,cols,types in select * from (values
 ('tcg_catalog_stage_header',array['id','game_key','provider_key','provider_version','bulk_id','bulk_type','bulk_updated_at','download_uri','format','compressed_size','compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256','raw_manifest','scope_contract','scope_sha256','retrieved_at','record_count','accepted_cards','accepted_variants','accepted_sets','sealed_at'],array['uuid','text','text','text','uuid','text','timestamp with time zone','text','text','bigint','text','text','text','text','jsonb','text','text','timestamp with time zone','bigint','bigint','bigint','bigint','timestamp with time zone']),
 ('tcg_catalog_stage_sets',array['external_id','name','record_version'],array['uuid','text','text']),
 ('tcg_catalog_stage_cards',array['external_id','set_external_id','provider_lang','language_code','locale','collector_number','name','rarity','record_version'],array['uuid','uuid','text','text','text','text','text','text','text']),
 ('tcg_catalog_stage_variants',array['card_external_id','locale','finish','artwork','treatment','edition','validated_evidence','evidence_sha256','reference_external_id','reference_record_version'],array['uuid','text','text','text','text','text','jsonb','text','uuid','text']),
 ('tcg_catalog_stage_records',array['entity_kind','external_id','locale','raw_record','canonical_utf8','content_sha256','record_version','source_path','retrieved_at'],array['text','uuid','text','jsonb','bytea','text','text','text','timestamp with time zone'])
 ) x(tab,cols,types) loop
  if not exists(select 1 from pg_class c where c.relnamespace=pg_my_temp_schema() and c.relname=tab and c.relkind='r' and c.relpersistence='t' and c.relowner=(select oid from pg_roles where rolname='postgres')
   and not exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee<>c.relowner)) then raise exception 'catalog_stage_owner_or_shape';end if;
  select array_agg(a.attname::text order by a.attnum),to_jsonb(array_agg(format_type(a.atttypid,a.atttypmod) order by a.attnum)) into parts,actual
  from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace=pg_my_temp_schema() and c.relname=tab and a.attnum>0 and not a.attisdropped;
  -- Use separately typed arrays for the comparison.
  if parts is distinct from cols or actual is distinct from to_jsonb(types) then raise exception 'catalog_stage_columns';end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='pg_temp.tcg_catalog_stage_sets'::regclass and contype='p' and conkey=array[1]::smallint[])
 or not exists(select 1 from pg_constraint where conrelid='pg_temp.tcg_catalog_stage_cards'::regclass and contype='p' and conkey=array[1]::smallint[])
 or not exists(select 1 from pg_constraint where conrelid='pg_temp.tcg_catalog_stage_cards'::regclass and contype='f' and confrelid='pg_temp.tcg_catalog_stage_sets'::regclass and conkey=array[2]::smallint[])
 or not exists(select 1 from pg_constraint where conrelid='pg_temp.tcg_catalog_stage_variants'::regclass and contype='p' and conkey=array[1,2,3]::smallint[])
 or (select count(*) from pg_constraint where conrelid='pg_temp.tcg_catalog_stage_variants'::regclass and contype='f' and confrelid='pg_temp.tcg_catalog_stage_cards'::regclass and conkey in (array[1]::smallint[],array[9]::smallint[]))<>2
 or not exists(select 1 from pg_index where indrelid='pg_temp.tcg_catalog_stage_records'::regclass and indisunique and indnullsnotdistinct and indkey::text='0 1 2 3'::text) and not exists(select 1 from pg_index where indrelid='pg_temp.tcg_catalog_stage_records'::regclass and indisunique and indnullsnotdistinct and indkey::text='1 2 3') then raise exception 'catalog_stage_keys';end if;
 if (select count(*) from pg_temp.tcg_catalog_stage_header)<>1 then raise exception 'catalog_stage_header';end if;
 select * into strict h from pg_temp.tcg_catalog_stage_header;
 if h.id is distinct from p_snapshot_id or (h.game_key,h.provider_key,h.provider_version,h.bulk_type,h.format,h.scope_contract,h.scope_sha256)
 is distinct from ('magic','scryfall','1','all_cards','gzip_jsonl','magic-collect-catalog-v1','a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa') or h.sealed_at is not null then raise exception 'catalog_stage_binding';end if;
 perform pg_advisory_xact_lock(hashtextextended('magic/scryfall/1',0));
 select * into strict rel from dv_collect_private.tcg_catalog_releases where (game_key,provider_key,provider_version)=('magic','scryfall','1') for update;
 if rel.release_generation<>p_expected_generation then raise exception 'catalog_generation_stale';end if;
 if rel.snapshot_id is not null then
  select * into strict old_snapshot from dv_collect_private.tcg_catalog_snapshots where id=rel.snapshot_id;
  if h.bulk_updated_at<old_snapshot.bulk_updated_at then raise exception 'catalog_snapshot_older';end if;
  if h.bulk_updated_at=old_snapshot.bulk_updated_at then
   if (h.bulk_id,h.compressed_sha256,h.sets_response_sha256,h.scope_sha256) is not distinct from (old_snapshot.bulk_id,old_snapshot.compressed_sha256,old_snapshot.sets_response_sha256,old_snapshot.scope_sha256) then return old_snapshot.id;end if;
   raise exception 'catalog_snapshot_time_conflict';
  end if;
 end if;
 if h.accepted_sets is distinct from (select count(*) from pg_temp.tcg_catalog_stage_sets)
 or h.accepted_cards is distinct from (select count(*) from pg_temp.tcg_catalog_stage_cards)
 or h.accepted_variants is distinct from (select count(*) from pg_temp.tcg_catalog_stage_variants)
 or h.accepted_cards<1 or h.accepted_sets<1 or h.record_count<h.accepted_cards
 or (select count(*) from pg_temp.tcg_catalog_stage_records)<>h.accepted_cards+h.accepted_sets
 or h.raw_manifest->>'object' is distinct from 'bulk_data' or h.raw_manifest->>'type' is distinct from 'all_cards'
 or h.raw_manifest->>'id' is distinct from h.bulk_id::text or (h.raw_manifest->>'updated_at')::timestamptz is distinct from h.bulk_updated_at
 or (h.raw_manifest->>'compressed_size')::bigint is distinct from h.compressed_size
 or h.raw_manifest->>'uri' is distinct from 'https://api.scryfall.com/bulk-data/'||h.bulk_id::text
 or h.raw_manifest->>'jsonl_download_uri' is distinct from h.download_uri then raise exception 'catalog_stage_counts_or_manifest';end if;
 -- Stage raw is strictly bound to its projection. Identity is never guessed.
 for t in select * from pg_temp.tcg_catalog_stage_records order by entity_kind collate "C",external_id,locale collate "C" nulls first loop
  if t.entity_kind not in ('set','card') or t.external_id is null or t.record_version is distinct from 'sha256:'||t.content_sha256
  or t.content_sha256 !~ '^[0-9a-f]{64}$' or t.canonical_utf8 is null or octet_length(t.canonical_utf8)>1048576
  or encode(extensions.digest(t.canonical_utf8,'sha256'),'hex') is distinct from t.content_sha256
  or convert_from(t.canonical_utf8,'UTF8')::jsonb is distinct from t.raw_record
  or t.raw_record->>'id' is distinct from t.external_id::text or t.raw_record->>'object' is distinct from t.entity_kind
  or t.source_path is null or length(t.source_path) not between 1 and 500 or t.retrieved_at is null then raise exception 'catalog_stage_evidence_invalid';end if;
  raw:=t.raw_record;
  if jsonb_typeof(raw) is distinct from 'object' or jsonb_typeof(raw->'name') is distinct from 'string' or length(raw->>'name') not between 1 and 500
  or raw->'digital' is distinct from 'false'::jsonb then raise exception 'catalog_raw_shape';end if;
  if t.entity_kind='set' then
   if t.locale is not null or raw->>'code' !~ '^[a-z0-9_]{1,32}$'
   or not exists(select 1 from pg_temp.tcg_catalog_stage_sets s where s.external_id=t.external_id and s.name=raw->>'name' and s.record_version=t.record_version)
   or jsonb_typeof(raw->'code') is distinct from 'string' then raise exception 'catalog_set_projection';end if;
  else
   lang:=case raw->>'lang' when 'en' then 'EN' when 'de' then 'DE' when 'fr' then 'FR' when 'it' then 'IT' when 'es' then 'ES' when 'ja' then 'JP' when 'ko' then 'KR' when 'zhs' then 'CN' end;
   loc:=case raw->>'lang' when 'zhs' then 'zh-cn' else raw->>'lang' end;
   display:=case when raw->>'lang'='en' then raw->>'name' when jsonb_typeof(raw->'printed_name')='string' then raw->>'printed_name'
    else (select string_agg(f->>'printed_name',' // ' order by ord) from jsonb_array_elements(raw->'card_faces') with ordinality a(f,ord) having count(*)=2 and count(f->>'printed_name')=2) end;
   if lang is null or t.locale is distinct from loc or raw->'oversized' is distinct from 'false'::jsonb or jsonb_typeof(raw->'games') is distinct from 'array' or not (raw->'games') ? 'paper'
   or not coalesce(raw->>'layout' in ('normal','split','flip','adventure','transform','modal_dfc'),false)
   or coalesce(jsonb_array_length(raw->'card_faces'),0)<>(case when raw->>'layout'='normal' then 0 else 2 end)
   or jsonb_typeof(raw->'collector_number') is distinct from 'string' or length(raw->>'collector_number') not between 1 and 128
   or raw->>'rarity' not in ('common','uncommon','rare','mythic','special','bonus')
   or display is null or length(display) not between 1 and 500
   or jsonb_typeof(raw->'finishes') is distinct from 'array' or jsonb_array_length(raw->'finishes') not between 1 and 3
   or (select count(distinct f) from jsonb_array_elements_text(raw->'finishes') a(f))<>jsonb_array_length(raw->'finishes')
   or exists(select 1 from jsonb_array_elements(raw->'finishes') a(f) where jsonb_typeof(f)<>'string' or f#>>'{}' not in ('nonfoil','foil','etched'))
   or not exists(select 1 from pg_temp.tcg_catalog_stage_cards c join pg_temp.tcg_catalog_stage_records s on s.external_id=c.set_external_id and s.entity_kind='set'
    where c.external_id=t.external_id and c.set_external_id::text=raw->>'set_id' and c.provider_lang=raw->>'lang' and c.language_code=lang and c.locale=loc
    and c.collector_number=raw->>'collector_number' and c.name=display and c.rarity='magic:'||(raw->>'rarity') and c.record_version=t.record_version and raw->>'set'=s.raw_record->>'code' and raw->>'set_name'=s.raw_record->>'name') then raise exception 'catalog_card_projection';end if;
  end if;
 end loop;
 -- Deterministic lock order: binding -> release -> provider identity order.
 -- This publisher never locks profiles or private ownership rows.
 for t in select 'set'::text kind,s.external_id,null::text locale,s.record_version,s.name,null::uuid set_external_id,null::text language_code,null::text collector_number,null::text rarity from pg_temp.tcg_catalog_stage_sets s
  union all select 'card',c.external_id,c.locale,c.record_version,c.name,c.set_external_id,c.language_code,c.collector_number,c.rarity from pg_temp.tcg_catalog_stage_cards c order by kind desc,external_id,locale nulls first loop
  select * into pr from dv_collect_private.tcg_provider_refs p where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id)=('magic','scryfall','1',t.kind,'api/'||case t.kind when 'set' then 'sets' else 'cards' end,t.external_id::text) and p.locale is not distinct from t.locale and p.discriminator is null for update;
  if found then
   target:=case t.kind when 'set' then pr.set_id else pr.card_id end;ref:=pr.id;
   if t.kind='set' then update dv_collect_private.tcg_sets set name=t.name where id=target;
   else
    select p.set_id into strict prev from dv_collect_private.tcg_provider_refs p where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id)=('magic','scryfall','1','set','api/sets',t.set_external_id::text) and p.locale is null and p.discriminator is null;
    if not exists(select 1 from dv_collect_private.tcg_cards c where c.id=target and (c.game_key,c.set_id,c.language_code,c.collector_number)=('magic',prev,t.language_code,t.collector_number)) then raise exception 'catalog_identity_conflict';end if;
    update dv_collect_private.tcg_cards set name=t.name,rarity=t.rarity where id=target;
   end if;
   update dv_collect_private.tcg_provider_refs set record_version=t.record_version where id=ref;
  else
   target:=gen_random_uuid();ref:=gen_random_uuid();
   if t.kind='set' then insert into dv_collect_private.tcg_sets values(target,'magic',t.name);
   else
    select p.set_id into strict prev from dv_collect_private.tcg_provider_refs p where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id)=('magic','scryfall','1','set','api/sets',t.set_external_id::text) and p.locale is null and p.discriminator is null;
    insert into dv_collect_private.tcg_cards values(target,'magic',prev,t.language_code,t.collector_number,t.name,t.rarity);
   end if;
   insert into dv_collect_private.tcg_provider_refs(id,game_key,provider_key,provider_version,entity_kind,namespace,external_id,locale,record_version,set_id,card_id)
   values(ref,'magic','scryfall','1',t.kind,'api/'||case t.kind when 'set' then 'sets' else 'cards' end,t.external_id::text,t.locale,t.record_version,case t.kind when 'set' then target end,case t.kind when 'card' then target end);
  end if;
  select * into strict rr from pg_temp.tcg_catalog_stage_records s where s.entity_kind=t.kind and s.external_id=t.external_id and s.locale is not distinct from t.locale;
  if not exists(select 1 from dv_collect_private.tcg_provider_evidence e where e.provider_ref_id=ref and e.record_version=t.record_version) then
   select id into prev from dv_collect_private.tcg_provider_evidence where provider_ref_id=ref order by retrieved_at desc,id desc limit 1;
   insert into dv_collect_private.tcg_provider_evidence(provider_ref_id,provider_version,record_version,raw_record,canonical_utf8,content_sha256,source_path,retrieved_at,supersedes_id)
   values(ref,'1',rr.record_version,rr.raw_record,rr.canonical_utf8,rr.content_sha256,rr.source_path,rr.retrieved_at,prev);
  end if;
 end loop;
 -- All card/reference evidence now exists. Variant targets are immutable axes.
 for t in select * from pg_temp.tcg_catalog_stage_variants order by card_external_id,locale collate "C",finish collate "C" loop
  select * into strict rr from pg_temp.tcg_catalog_stage_records s where s.entity_kind='card' and s.external_id=t.card_external_id and s.locale=t.locale;
  select p.card_id into strict target from dv_collect_private.tcg_provider_refs p where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id,p.locale)=('magic','scryfall','1','card','api/cards',t.card_external_id::text,t.locale) and p.discriminator is null;
  select e.id into strict refev from dv_collect_private.tcg_provider_evidence e join dv_collect_private.tcg_provider_refs p on p.id=e.provider_ref_id
   where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id,p.locale)=('magic','scryfall','1','card','api/cards',t.reference_external_id::text,t.locale) and p.discriminator is null and e.record_version=t.reference_record_version
   and exists(select 1 from pg_temp.tcg_catalog_stage_records s where s.entity_kind='card' and s.external_id=t.reference_external_id and s.locale=t.locale and s.record_version=t.reference_record_version);
  select * into pr from dv_collect_private.tcg_provider_refs p where (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id,p.locale,p.discriminator)=('magic','scryfall','1','variant','api/cards/finishes',t.card_external_id::text,t.locale,'finish:'||t.finish) for update;
  if found then
   ref:=pr.id;
   if not exists(select 1 from dv_collect_private.tcg_card_variants v where v.id=pr.variant_id and (v.card_id,v.finish,v.artwork,v.treatment)=(target,t.finish,t.artwork,t.treatment) and v.edition is null and t.edition is null) then raise exception 'catalog_variant_identity_conflict';end if;
   update dv_collect_private.tcg_provider_refs set record_version=rr.record_version where id=ref;
  else
   prev:=gen_random_uuid();ref:=gen_random_uuid();
   insert into dv_collect_private.tcg_card_variants(id,card_id,game_key,language_code,rarity,finish,artwork,treatment,edition)
   select prev,target,'magic',c.language_code,c.rarity,t.finish,t.artwork,t.treatment,t.edition from dv_collect_private.tcg_cards c where c.id=target;
   insert into dv_collect_private.tcg_provider_refs(id,game_key,provider_key,provider_version,entity_kind,namespace,external_id,locale,discriminator,record_version,variant_id)
   values(ref,'magic','scryfall','1','variant','api/cards/finishes',t.card_external_id::text,t.locale,'finish:'||t.finish,rr.record_version,prev);
  end if;
  select id into ev from dv_collect_private.tcg_provider_evidence where provider_ref_id=ref and record_version=rr.record_version;
  if ev is null then
   select id into prev from dv_collect_private.tcg_provider_evidence where provider_ref_id=ref order by retrieved_at desc,id desc limit 1;
   insert into dv_collect_private.tcg_provider_evidence(provider_ref_id,provider_version,record_version,raw_record,canonical_utf8,content_sha256,source_path,retrieved_at,supersedes_id)
   values(ref,'1',rr.record_version,rr.raw_record,rr.canonical_utf8,rr.content_sha256,rr.source_path,rr.retrieved_at,prev) returning id into ev;
  end if;
  insert into dv_collect_private.tcg_catalog_derivations(provider_ref_id,evidence_id,contract_name,contract_version,validated_evidence,evidence_sha256,reference_evidence_id)
  values(ref,ev,'MagicVariantEvidence','1',t.validated_evidence,t.evidence_sha256,refev) on conflict do nothing;
 end loop;
 insert into dv_collect_private.tcg_catalog_snapshots select id,game_key,provider_key,provider_version,bulk_id,bulk_type,bulk_updated_at,download_uri,format,compressed_size,compressed_sha256,jsonl_sha256,sets_response_sha256,manifest_sha256,raw_manifest,scope_contract,scope_sha256,retrieved_at,record_count,accepted_cards,accepted_variants,accepted_sets,clock_timestamp() from pg_temp.tcg_catalog_stage_header;
 insert into dv_collect_private.tcg_catalog_snapshot_members(snapshot_id,provider_ref_id,evidence_id,derivation_id,source_path,retrieved_at)
 select p_snapshot_id,p.id,e.id,null,s.source_path,s.retrieved_at from pg_temp.tcg_catalog_stage_records s
 join dv_collect_private.tcg_provider_refs p on (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id)=('magic','scryfall','1',s.entity_kind,'api/'||case s.entity_kind when 'set' then 'sets' else 'cards' end,s.external_id::text) and p.locale is not distinct from s.locale and p.discriminator is null
 join dv_collect_private.tcg_provider_evidence e on e.provider_ref_id=p.id and e.record_version=s.record_version;
 insert into dv_collect_private.tcg_catalog_snapshot_members(snapshot_id,provider_ref_id,evidence_id,derivation_id,source_path,retrieved_at)
 select p_snapshot_id,p.id,e.id,d.id,s.source_path,s.retrieved_at from pg_temp.tcg_catalog_stage_variants v
 join pg_temp.tcg_catalog_stage_records s on s.entity_kind='card' and s.external_id=v.card_external_id and s.locale=v.locale
 join dv_collect_private.tcg_provider_refs p on (p.game_key,p.provider_key,p.provider_version,p.entity_kind,p.namespace,p.external_id,p.locale,p.discriminator)=('magic','scryfall','1','variant','api/cards/finishes',v.card_external_id::text,v.locale,'finish:'||v.finish)
 join dv_collect_private.tcg_provider_evidence e on e.provider_ref_id=p.id and e.record_version=s.record_version
 join dv_collect_private.tcg_catalog_derivations d on d.provider_ref_id=p.id and d.evidence_id=e.id and d.evidence_sha256=v.evidence_sha256;
 if (select count(*) from dv_collect_private.tcg_catalog_snapshot_members where snapshot_id=p_snapshot_id)<>h.accepted_sets+h.accepted_cards+h.accepted_variants then raise exception 'catalog_member_count';end if;
 update dv_collect_private.tcg_catalog_releases set snapshot_id=p_snapshot_id,release_generation=release_generation+1,updated_at=clock_timestamp() where (game_key,provider_key,provider_version)=('magic','scryfall','1');
 return p_snapshot_id;
end$publisher$;

create or replace function public.get_tcg_catalog_readiness_v1() returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $readiness$
declare a jsonb;s boolean;d boolean;state text;snap uuid;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'authentication_required' using errcode='42501';end if;
 s:=coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false) and coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false);
 if s then a:=dv_collect_private.tcg_catalog_schema_readiness_v1();d:=coalesce((a->>'data_compatible')::boolean,false);state:=a->>'state';snap:=(a->>'snapshot_id')::uuid;end if;
 return jsonb_build_object('contract','tcg-i3-magic-persistence','version','1','schema_compatible',s,'data_compatible',coalesce(d,false),'activation_compatible',s and coalesce(d,false) and state='active','state',state,'snapshot_id',snap);
end$readiness$;

create or replace function public.get_tcg_catalog_release_v1(p_game_key text) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $release$
declare a jsonb;r dv_collect_private.tcg_catalog_releases%rowtype;s dv_collect_private.tcg_catalog_snapshots%rowtype;ready boolean;
begin
 if p_game_key is distinct from 'magic' then raise exception 'catalog_game_invalid';end if;
 a:=public.get_tcg_catalog_readiness_v1();
 ready:=coalesce((a->>'activation_compatible')::boolean,false);
 if ready then
  select * into strict r from dv_collect_private.tcg_catalog_releases where (game_key,provider_key,provider_version)=('magic','scryfall','1');
  select * into strict s from dv_collect_private.tcg_catalog_snapshots where id=r.snapshot_id;
 end if;
 return jsonb_build_object('contract','TCGCatalogRelease','version','1','game_key','magic','state',case when ready then 'ready' else 'blocked' end,
  'snapshot_id',case when ready then r.snapshot_id end,'activation_contract',case when ready then r.activation_contract end,
  'scope_sha256',case when ready then r.scope_sha256 end,'descriptor_sha256',case when ready then r.descriptor_sha256 end,
  'capabilities',case when ready then '["collection","binder","catalog"]'::jsonb else '[]'::jsonb end,
  'languages',case when ready then '["EN","DE","FR","IT","ES","JP","KR","CN"]'::jsonb else '[]'::jsonb end,
  'provider_key',case when ready then 'scryfall' end,'provider_version',case when ready then '1' end,
  'bulk_updated_at',case when ready then s.bulk_updated_at end,'evaluated_at',statement_timestamp());
end$release$;

create or replace function public.list_tcg_catalog_variants_v1(p_game_key text,p_card_id uuid,p_language text) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $variants$
declare a jsonb;s uuid;items jsonb;
begin
 a:=public.get_tcg_catalog_release_v1(p_game_key);
 if a->>'state'<>'ready' then raise exception 'catalog_release_unavailable';end if;
 s:=(a->>'snapshot_id')::uuid;
 if p_card_id is null or not coalesce(p_language in ('EN','DE','FR','IT','ES','JP','KR','CN'),false) then raise exception 'catalog_input_invalid';end if;
 select coalesce(jsonb_agg(jsonb_build_object('variant_id',v.id,'provider_ref_id',p.id,'finish',v.finish,'artwork',v.artwork,'treatment',v.treatment,'edition',v.edition) order by v.finish collate "C"),'[]'::jsonb) into items
 from dv_collect_private.tcg_card_variants v join dv_collect_private.tcg_provider_refs p on p.variant_id=v.id
 join dv_collect_private.tcg_catalog_snapshot_members m on m.provider_ref_id=p.id and m.snapshot_id=s and m.derivation_id is not null
 join dv_collect_private.tcg_catalog_derivations d on (d.id,d.provider_ref_id,d.evidence_id)=(m.derivation_id,m.provider_ref_id,m.evidence_id)
 where (v.card_id,v.game_key,v.language_code)=(p_card_id,p_game_key,p_language) and (p.provider_key,p.provider_version,p.namespace)=('scryfall','1','api/cards/finishes')
 and exists(select 1 from dv_collect_private.tcg_catalog_snapshot_members cm join dv_collect_private.tcg_provider_refs cp on cp.id=cm.provider_ref_id join dv_collect_private.tcg_cards c on c.id=cp.card_id
  where cm.snapshot_id=s and cp.entity_kind='card' and c.id=p_card_id and c.language_code=p_language and cp.game_key=p_game_key);
 if jsonb_array_length(items)>3 then raise exception 'catalog_variant_count_invalid';end if;
 return jsonb_build_object('snapshot_id',s,'card_id',p_card_id,'variants',items);
end$variants$;

create or replace function public.get_tcg_catalog_card_v1(p_game_key text,p_card_id uuid,p_provider_ref_id uuid,p_language text) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $card$
declare a jsonb;s uuid;c dv_collect_private.tcg_cards%rowtype;p dv_collect_private.tcg_provider_refs%rowtype;
 raw jsonb;faces jsonb;setname text;vars jsonb;result jsonb;bulk_time timestamptz;
begin
 a:=public.get_tcg_catalog_release_v1(p_game_key);if a->>'state'<>'ready' then raise exception 'catalog_release_unavailable';end if;
 s:=(a->>'snapshot_id')::uuid;
 if (p_card_id is null)=(p_provider_ref_id is null) or not coalesce(p_language in ('EN','DE','FR','IT','ES','JP','KR','CN'),false) then raise exception 'catalog_input_invalid';end if;
 if p_provider_ref_id is not null then
  select cp.* into p from dv_collect_private.tcg_provider_refs cp join dv_collect_private.tcg_catalog_snapshot_members m on m.provider_ref_id=cp.id and m.snapshot_id=s
  where cp.id=p_provider_ref_id and (cp.game_key,cp.provider_key,cp.provider_version)=(p_game_key,'scryfall','1') and cp.entity_kind in ('card','variant');
  if found then if p.entity_kind='card' then p_card_id:=p.card_id;else select card_id into p_card_id from dv_collect_private.tcg_card_variants where id=p.variant_id;end if;end if;
 end if;
 select cc.* into c
 from dv_collect_private.tcg_cards cc join dv_collect_private.tcg_sets ss on ss.id=cc.set_id
 join dv_collect_private.tcg_provider_refs cp on cp.card_id=cc.id and cp.entity_kind='card' and cp.namespace='api/cards'
 join dv_collect_private.tcg_catalog_snapshot_members m on m.provider_ref_id=cp.id and m.snapshot_id=s
 join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id
 join dv_collect_private.tcg_catalog_snapshots sn on sn.id=m.snapshot_id
 where (cc.id,cc.game_key,cc.language_code)=(p_card_id,p_game_key,p_language) and (cp.provider_key,cp.provider_version)=('scryfall','1');
 if found then
  select cp.* into strict p from dv_collect_private.tcg_provider_refs cp join dv_collect_private.tcg_catalog_snapshot_members m on m.provider_ref_id=cp.id where cp.card_id=c.id and cp.entity_kind='card' and cp.namespace='api/cards' and m.snapshot_id=s;
  select e.raw_record,sn.bulk_updated_at into strict raw,bulk_time from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id join dv_collect_private.tcg_catalog_snapshots sn on sn.id=m.snapshot_id where m.provider_ref_id=p.id and m.snapshot_id=s;
  select name into strict setname from dv_collect_private.tcg_sets where id=c.set_id;
  select coalesce(jsonb_agg(jsonb_build_object('index',ord-1,'printed_name',case when raw->>'lang'='en' then f->>'name' else f->>'printed_name' end,'oracle_name',f->>'name') order by ord),'[]'::jsonb) into faces from jsonb_array_elements(coalesce(raw->'card_faces','[]'::jsonb)) with ordinality x(f,ord);
  vars:=public.list_tcg_catalog_variants_v1(p_game_key,c.id,p_language)->'variants';
  result:=jsonb_build_object('card_id',c.id,'provider_ref_id',p.id,'set_id',c.set_id,'name',c.name,'set_name',setname,'collector_number',c.collector_number,'language',c.language_code,
   'source_lang',raw->>'lang','rarity',c.rarity,'layout',raw->>'layout','face_names',faces,'available_finishes',raw->'finishes','variants',vars,
   'source',jsonb_build_object('provider_key','scryfall','provider_version','1','record_version',p.record_version,'bulk_updated_at',bulk_time,'attribution_url','https://scryfall.com'));
 end if;
 return jsonb_build_object('snapshot_id',s,'record',result);
end$card$;

create or replace function public.list_tcg_catalog_sets_v1(p_game_key text,p_query text,p_set_id uuid,p_limit integer,p_cursor jsonb) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $sets$
declare a jsonb;s uuid;query text;pattern text;qhash text;items jsonb:='[]';cur jsonb;last_name text;last_id uuid;t record;n integer:=0;
begin
 a:=public.get_tcg_catalog_release_v1(p_game_key);if a->>'state'<>'ready' then raise exception 'catalog_release_unavailable';end if;s:=(a->>'snapshot_id')::uuid;
 if p_limit is null or p_limit not between 1 and 100 or p_query is not null and (length(p_query)>160 or p_query ~ '[[:cntrl:]]' or p_set_id is not null) then raise exception 'catalog_input_invalid';end if;
 query:=translate(normalize(btrim(p_query),NFC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');
 pattern:='%'||replace(replace(replace(query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 qhash:=encode(extensions.digest(convert_to(jsonb_build_array('sets',p_game_key,query,p_set_id)::text,'UTF8'),'sha256'),'hex');
 if p_cursor is not null then
  if jsonb_typeof(p_cursor)<>'object' or octet_length(p_cursor::text)>2048 or not p_cursor ?& array['snapshot_id','last_name','last_id','query_sha256'] or (select count(*) from jsonb_object_keys(p_cursor))<>4
  or jsonb_typeof(p_cursor->'last_name')<>'string' or length(p_cursor->>'last_name')>500 or p_cursor->>'query_sha256' is distinct from qhash or (p_cursor->>'last_id')::uuid is null then raise exception 'catalog_cursor_invalid';end if;
  if (p_cursor->>'snapshot_id')::uuid is distinct from s then raise exception 'catalog_cursor_stale';end if;last_name:=p_cursor->>'last_name';last_id:=(p_cursor->>'last_id')::uuid;
 end if;
 for t in select cs.id,cs.name,p.id ref,e.raw_record raw,lower(normalize(cs.name,NFC) collate "C") sort_name
 from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs p on p.id=m.provider_ref_id and p.entity_kind='set'
 join dv_collect_private.tcg_sets cs on cs.id=p.set_id join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id
 where m.snapshot_id=s and cs.game_key=p_game_key and (p_set_id is null or cs.id=p_set_id)
 and (query is null or translate(normalize(cs.name,NFC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') like pattern escape E'\\' or e.raw_record->>'code' like pattern escape E'\\')
 and (last_id is null or (lower(normalize(cs.name,NFC) collate "C"),cs.id)>(last_name collate "C",last_id))
 order by lower(normalize(cs.name,NFC) collate "C"),cs.id limit p_limit+1 loop
  n:=n+1;if n>p_limit then cur:=jsonb_build_object('snapshot_id',s,'last_name',last_name,'last_id',last_id,'query_sha256',qhash);exit;end if;
  items:=items||jsonb_build_array(jsonb_build_object('set_id',t.id,'code',t.raw->>'code','name',t.name,'set_type',t.raw->>'set_type','parent_set_code',t.raw->>'parent_set_code','released_at',t.raw->>'released_at','provider_ref_id',t.ref));last_name:=t.sort_name;last_id:=t.id;
 end loop;
 return jsonb_build_object('snapshot_id',s,'items',items,'next_cursor',cur);
end$sets$;

create or replace function public.search_tcg_catalog_cards_v1(p_game_key text,p_set_id uuid,p_collector_number text,p_name text,p_language text,p_finish text,p_limit integer,p_cursor jsonb) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $search$
declare a jsonb;s uuid;query text;pattern text;qhash text;items jsonb:='[]';cur jsonb;last_name text;last_id uuid;t record;n integer:=0;
begin
 a:=public.get_tcg_catalog_release_v1(p_game_key);if a->>'state'<>'ready' then raise exception 'catalog_release_unavailable';end if;s:=(a->>'snapshot_id')::uuid;
 query:=translate(normalize(btrim(p_name),NFC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');
 if p_limit is null or p_limit not between 1 and 100 or not coalesce(p_language in ('EN','DE','FR','IT','ES','JP','KR','CN'),false)
 or p_name is not null and (length(p_name)>160 or p_name ~ '[[:cntrl:]]')
 or p_collector_number is not null and (length(p_collector_number) not between 1 and 128 or p_collector_number ~ '[[:cntrl:]]')
 or p_set_id is null and p_collector_number is null and not coalesce(length(query)>=2,false)
 or p_finish is not null and p_finish not in ('nonfoil','foil','etched') then raise exception 'catalog_input_invalid';end if;
 pattern:='%'||replace(replace(replace(query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 qhash:=encode(extensions.digest(convert_to(jsonb_build_array('cards',p_game_key,p_set_id,p_collector_number,query,p_language,p_finish)::text,'UTF8'),'sha256'),'hex');
 if p_cursor is not null then
  if jsonb_typeof(p_cursor)<>'object' or octet_length(p_cursor::text)>2048 or not p_cursor ?& array['snapshot_id','last_name','last_id','query_sha256'] or (select count(*) from jsonb_object_keys(p_cursor))<>4
  or jsonb_typeof(p_cursor->'last_name')<>'string' or length(p_cursor->>'last_name')>500 or p_cursor->>'query_sha256' is distinct from qhash or (p_cursor->>'last_id')::uuid is null then raise exception 'catalog_cursor_invalid';end if;
  if (p_cursor->>'snapshot_id')::uuid is distinct from s then raise exception 'catalog_cursor_stale';end if;last_name:=p_cursor->>'last_name';last_id:=(p_cursor->>'last_id')::uuid;
 end if;
 for t in select c.id,lower(normalize(c.name,NFC) collate "C") sort_name from dv_collect_private.tcg_cards c
 join dv_collect_private.tcg_provider_refs p on p.card_id=c.id and p.entity_kind='card'
 join dv_collect_private.tcg_catalog_snapshot_members m on m.provider_ref_id=p.id and m.snapshot_id=s
 join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id
 where (c.game_key,c.language_code)=(p_game_key,p_language) and (p_set_id is null or c.set_id=p_set_id)
 and (p_collector_number is null or c.collector_number=p_collector_number)
 and (query is null or translate(normalize(c.name,NFC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') like pattern escape E'\\')
 and (p_finish is null or e.raw_record->'finishes' ? p_finish)
 and (last_id is null or (lower(normalize(c.name,NFC) collate "C"),c.id)>(last_name collate "C",last_id))
 order by lower(normalize(c.name,NFC) collate "C"),c.id limit p_limit+1 loop
  n:=n+1;if n>p_limit then cur:=jsonb_build_object('snapshot_id',s,'last_name',last_name,'last_id',last_id,'query_sha256',qhash);exit;end if;
  items:=items||jsonb_build_array(public.get_tcg_catalog_card_v1(p_game_key,t.id,null,p_language)->'record');last_name:=t.sort_name;last_id:=t.id;
 end loop;
 return jsonb_build_object('snapshot_id',s,'items',items,'next_cursor',cur);
end$search$;

create or replace function public.save_my_tcg_collection_item_v1(p_item_id uuid,p_game_key text,p_item jsonb) returns uuid
 language plpgsql volatile security definer set search_path=pg_catalog,public,dv_collect_private as $save$
declare u uuid:=auth.uid();result uuid;r record;x record;k text;v jsonb;num numeric;d date;keys text[]:=array['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'];
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required' using errcode='42501';end if;
 select * into r from public.profiles where id=u for update;
 if not found or r.data_processing_restricted_at is not null or r.account_closure_requested_at is not null or r.account_status in ('suspended','deleted') then raise exception 'account_data_processing_restricted' using errcode='42501';end if;
 if p_game_key is distinct from 'magic' or not exists(select 1 from dv_collect_private.tcg_catalog_releases where game_key=p_game_key) then raise exception 'catalog_game_invalid';end if;
 if public.get_tcg_catalog_release_v1(p_game_key)->>'state'<>'ready' then raise exception 'tcg_collection_release_unavailable';end if;
 if jsonb_typeof(p_item) is distinct from 'object' or not p_item ?& keys or (select count(*) from jsonb_object_keys(p_item))<>17 or p_item->'contract_version' is distinct from '"1"'::jsonb then raise exception 'collection_item_input_invalid';end if;
 foreach k in array keys loop
  v:=p_item->k;
  if k not in ('quantity','grade','purchase_price','market_price') and jsonb_typeof(v) not in ('string','null') then raise exception 'collection_item_input_type';end if;
  if jsonb_typeof(v)='string' and v#>>'{}' ~ '[[:cntrl:]]' then raise exception 'collection_item_text_invalid';end if;
 end loop;
 if jsonb_typeof(p_item->'card_name') is distinct from 'string' or length(p_item->>'card_name') not between 1 and 500
 or not coalesce(p_item->>'language' in ('EN','DE','FR','IT','ES','JP','KR','CN'),false)
 or not coalesce(p_item->>'condition' in ('M','NM','EX','GD','LP','PL','POOR','SEALED'),false)
 or not coalesce(p_item->>'currency' in ('EUR','USD','GBP','JPY','CHF'),false)
 or p_item->>'grading_company' is not null and p_item->>'grading_company' not in ('PSA','BGS','CGC','ACE','OTHER') then raise exception 'collection_item_enum_invalid';end if;
 for k,num in select * from (values('set_name',500),('card_number',128),('variant',120),('notes',2000),('cert_number',120)) a(k,num) loop
  if p_item->>k is not null and (length(p_item->>k)>num or k in ('set_name','card_number') and length(p_item->>k)<1) then raise exception 'collection_item_text_limit';end if;
 end loop;
 if jsonb_typeof(p_item->'quantity') is distinct from 'number' or (p_item->>'quantity')::numeric not between 1 and 10000 or trunc((p_item->>'quantity')::numeric)<>(p_item->>'quantity')::numeric then raise exception 'collection_item_quantity';end if;
 foreach k in array array['grade','purchase_price','market_price'] loop
  if p_item->k<>'null'::jsonb then
   if jsonb_typeof(p_item->k)<>'number' then raise exception 'collection_item_numeric_type';end if;num:=(p_item->>k)::numeric;
   if k='grade' then if num not between 1 and 10 or num*10<>trunc(num*10) or p_item->>'grading_company' is null then raise exception 'collection_item_grade';end if;
   elsif num<0 or num>9999999999.99 or num*100<>trunc(num*100) then raise exception 'collection_item_price';end if;
  end if;
 end loop;
 if p_item->>'cert_number' is not null and p_item->>'grading_company' is null then raise exception 'collection_item_grading';end if;
 if p_item->>'purchase_date' is not null then
  if p_item->>'purchase_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'collection_item_date';end if;d:=(p_item->>'purchase_date')::date;
  if to_char(d,'YYYY-MM-DD')<>p_item->>'purchase_date' then raise exception 'collection_item_date';end if;
 end if;
 if p_item->>'folder_id' is not null and not exists(select 1 from public.collection_folders where id=(p_item->>'folder_id')::uuid and user_id=u) then raise exception 'collection_folder_not_owned';end if;
 if p_item_id is not null then select id into result from public.collection_items where id=p_item_id and user_id=u and tcg=p_game_key for update;if not found then raise exception 'tcg_parent_not_owned' using errcode='42501';end if;
 else result:=gen_random_uuid();end if;
 if p_item_id is null then
  insert into public.collection_items(id,user_id,tcg,folder_id,card_name,set_name,card_number,language,variant,condition,quantity,grading_company,grade,cert_number,purchase_price,purchase_date,market_price,currency,notes)
  values(result,u,p_game_key,(p_item->>'folder_id')::uuid,p_item->>'card_name',p_item->>'set_name',p_item->>'card_number',p_item->>'language',p_item->>'variant',p_item->>'condition',(p_item->>'quantity')::integer,p_item->>'grading_company',(p_item->>'grade')::numeric,p_item->>'cert_number',(p_item->>'purchase_price')::numeric,d,(p_item->>'market_price')::numeric,p_item->>'currency',p_item->>'notes');
 else
  update public.collection_items set folder_id=(p_item->>'folder_id')::uuid,card_name=p_item->>'card_name',set_name=p_item->>'set_name',card_number=p_item->>'card_number',language=p_item->>'language',variant=p_item->>'variant',condition=p_item->>'condition',quantity=(p_item->>'quantity')::integer,grading_company=p_item->>'grading_company',grade=(p_item->>'grade')::numeric,cert_number=p_item->>'cert_number',purchase_price=(p_item->>'purchase_price')::numeric,purchase_date=d,market_price=(p_item->>'market_price')::numeric,currency=p_item->>'currency',notes=p_item->>'notes',updated_at=clock_timestamp() where id=result;
 end if;
 return result;
end$save$;

-- No old trigger or policy is rewritten.
create or replace trigger tcg_validate_provider_evidence before insert on dv_collect_private.tcg_provider_evidence for each row execute function dv_collect_private.tcg_validate_provider_evidence_v1();
create or replace trigger tcg_validate_catalog_derivation before insert on dv_collect_private.tcg_catalog_derivations for each row execute function dv_collect_private.tcg_validate_catalog_member_v1();
create or replace trigger tcg_validate_catalog_member before insert on dv_collect_private.tcg_catalog_snapshot_members for each row execute function dv_collect_private.tcg_validate_catalog_member_v1();
do $immutable$ declare t text;begin
 foreach t in array array['tcg_provider_evidence','tcg_catalog_derivations','tcg_catalog_snapshots','tcg_catalog_snapshot_members'] loop
  execute format('create or replace trigger tcg_catalog_immutable_rows before update or delete on dv_collect_private.%I for each row execute function dv_collect_private.tcg_immutable_catalog_evidence_v1()',t);
  execute format('create or replace trigger tcg_catalog_immutable_truncate before truncate on dv_collect_private.%I for each statement execute function dv_collect_private.tcg_immutable_catalog_evidence_v1()',t);
 end loop;
end$immutable$;
create or replace trigger tcg_require_current_catalog_ref before insert or update on dv_collect_private.collection_item_catalog_links for each row execute function dv_collect_private.tcg_require_current_catalog_ref_v1();
create or replace trigger tcg_require_collection_release before insert or update on public.collection_items for each row execute function dv_collect_private.tcg_require_collection_release_v1();
do $policies$ begin
 if not exists(select 1 from pg_policy where polrelid='public.collection_items'::regclass and polname='tcg_collection_insert_boundary_v1') then
  create policy tcg_collection_insert_boundary_v1 on public.collection_items as restrictive for insert to authenticated with check(tcg<>'magic');
 end if;
 if not exists(select 1 from pg_policy where polrelid='public.collection_items'::regclass and polname='tcg_collection_update_boundary_v1') then
  create policy tcg_collection_update_boundary_v1 on public.collection_items as restrictive for update to authenticated with check(tcg<>'magic' or dv_collect_private.tcg_existing_own_game_item_v1(id,tcg));
 end if;
end$policies$;
create index if not exists tcg_catalog_member_ref on dv_collect_private.tcg_catalog_snapshot_members(provider_ref_id,snapshot_id);
create index if not exists tcg_catalog_derivation_reference on dv_collect_private.tcg_catalog_derivations(reference_evidence_id);
do $rights$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='dv_collect_private' and p.proname in ('tcg_validate_provider_evidence_v1','tcg_validate_catalog_member_v1','tcg_immutable_catalog_evidence_v1','tcg_publish_catalog_snapshot_v1','tcg_require_current_catalog_ref_v1','tcg_require_collection_release_v1','tcg_existing_own_game_item_v1'))
 or (n.nspname='public' and p.proname in ('get_tcg_catalog_release_v1','list_tcg_catalog_sets_v1','search_tcg_catalog_cards_v1','get_tcg_catalog_card_v1','list_tcg_catalog_variants_v1','get_tcg_catalog_readiness_v1','save_my_tcg_collection_item_v1')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end$rights$;
grant execute on function dv_collect_private.tcg_existing_own_game_item_v1(uuid,text) to authenticated;
grant execute on function public.get_tcg_catalog_release_v1(text),public.list_tcg_catalog_sets_v1(text,text,uuid,integer,jsonb),public.search_tcg_catalog_cards_v1(text,uuid,text,text,text,text,integer,jsonb),public.get_tcg_catalog_card_v1(text,uuid,uuid,text),public.list_tcg_catalog_variants_v1(text,uuid,text),public.get_tcg_catalog_readiness_v1(),public.save_my_tcg_collection_item_v1(uuid,text,jsonb) to authenticated;
