-- M6 local review delta. Apply only to the exact M4 foundation, atomically
-- with tcg-i3-magic-on-demand-readiness-v1.sql. Default beta is OFF.
begin;
do $$begin
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)
 or not exists(select 1 from dv_collect_private.tcg_catalog_releases where game_key='magic' and state='foundation' and schema_phase='persistence') then raise exception 'magic_on_demand_base_not_ready';end if;
end$$;
create table dv_collect_private.tcg_magic_on_demand_beta(
 game_key text primary key check(game_key='magic'),
 contract text not null check(contract='magic-on-demand-collect-beta/1'),
 provider_key text not null check(provider_key='scryfall'),
 provider_version text not null check(provider_version='1'),
 enabled boolean not null default false,
 foreign key(game_key,provider_key,provider_version) references dv_collect_private.tcg_provider_bindings on delete restrict);
alter table dv_collect_private.tcg_magic_on_demand_beta enable row level security;
revoke all on table dv_collect_private.tcg_magic_on_demand_beta from public,anon,authenticated,service_role;
insert into dv_collect_private.tcg_magic_on_demand_beta values('magic','magic-on-demand-collect-beta/1','scryfall','1',false);
alter table public.collection_items drop constraint collection_items_tcg_check;
alter table public.collection_items add constraint collection_items_tcg_check check(tcg in ('pokemon','one_piece','other','magic'));

create function public.get_magic_on_demand_collection_beta_v1() returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare u uuid:=auth.uid();ready boolean:=false;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required' using errcode='42501';end if;
 ready:=exists(select 1 from public.profiles where id=u and data_processing_restricted_at is null and account_closure_requested_at is null and account_status not in ('suspended','deleted'))
 and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 and coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)
 and exists(select 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' and enabled);
 return jsonb_build_object('contract','magic-on-demand-collect-beta/1','user_id',u,'magic_on_demand_collection_beta',ready,'checked_at',clock_timestamp());
end$$;
revoke all on function public.get_magic_on_demand_collection_beta_v1() from public,anon,authenticated,service_role;
grant execute on function public.get_magic_on_demand_collection_beta_v1() to authenticated;

create or replace function dv_collect_private.tcg_require_collection_release_v1() returns trigger
 language plpgsql security definer set search_path=pg_catalog,public,dv_collect_private as $$
declare r dv_collect_private.tcg_catalog_releases%rowtype;u uuid:=auth.uid();b boolean;
begin
 if tg_op='UPDATE' and old.tcg='magic' and new.tcg<>'magic' then raise exception 'magic_game_conversion_forbidden';end if;
 if new.tcg='magic' then
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or new.user_id is distinct from u
  or tg_op='UPDATE' and old.user_id is distinct from u then raise exception 'tcg_parent_not_owned' using errcode='42501';end if;
  perform 1 from public.profiles where id=u and data_processing_restricted_at is null and account_closure_requested_at is null and account_status not in ('suspended','deleted') for update;
  if not found then raise exception 'account_data_processing_restricted' using errcode='42501';end if;
  select enabled into b from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' for share;
  if not found or not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
  or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false) then raise exception 'magic_beta_schema_unavailable';end if;
  if not b and (tg_op='INSERT' or
   (old.tcg,old.user_id,old.card_name,old.set_name,old.card_number,old.language,old.variant) is distinct from
   (new.tcg,new.user_id,new.card_name,new.set_name,new.card_number,new.language,new.variant)) then raise exception 'magic_beta_identity_locked';end if;
  if new.language is null or new.language not in ('EN','DE','FR','IT','ES','JP','KR','CN') then raise exception 'magic_language_required';end if;
  return new;
 end if;
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

create or replace function public.save_my_tcg_collection_item_v1(p_item_id uuid,p_game_key text,p_item jsonb) returns uuid
 language plpgsql volatile security definer set search_path=pg_catalog,public,dv_collect_private as $save$
declare u uuid:=auth.uid();result uuid;r record;x record;k text;v jsonb;num numeric;d date;keys text[]:=array['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'];
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required' using errcode='42501';end if;
 select * into r from public.profiles where id=u for update;
 if not found or r.data_processing_restricted_at is not null or r.account_closure_requested_at is not null or r.account_status in ('suspended','deleted') then raise exception 'account_data_processing_restricted' using errcode='42501';end if;
 if p_game_key is distinct from 'magic' or not exists(select 1 from dv_collect_private.tcg_catalog_releases where game_key=p_game_key) then raise exception 'catalog_game_invalid';end if;
 -- One DB-owned beta row is locked through commit. No snapshot admission.
 perform 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' for share;
 if not coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)
 or not coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false) then raise exception 'magic_beta_schema_unavailable';end if;
 if p_item_id is null and not exists(select 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' and enabled) then raise exception 'magic_beta_unavailable';end if;
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
 if p_item_id is not null and not exists(select 1 from dv_collect_private.tcg_magic_on_demand_beta where game_key='magic' and enabled) then
  select * into x from public.collection_items where id=p_item_id and user_id=u and tcg='magic' for update;
  if not found then raise exception 'tcg_parent_not_owned' using errcode='42501';end if;
  if (x.card_name,x.set_name,x.card_number,x.language,x.variant) is distinct from
  (p_item->>'card_name',p_item->>'set_name',p_item->>'card_number',p_item->>'language',p_item->>'variant') then raise exception 'magic_beta_identity_locked';end if;
 end if;
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

-- Existing M4 RPC ACLs and restrictive direct-insert/conversion policies retained.
-- Readiness delta closes this transaction.
