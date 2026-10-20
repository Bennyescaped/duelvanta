-- NOT_AUTO_APPLY. Read-only schema/configuration postcondition, Beta remains OFF.
-- No user rows. Scanner/Pricing/Battle remain closed under the unavailable Magic
-- game and foundation release; CI additionally checks the pinned application registry.
with observed as materialized (
 select current_setting('server_version_num')::int / 10000 as postgres_major,
 to_regnamespace('dv_collect_private') is not null as collect_schema_present,
 not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_collect_private' and c.relname like 'tcg_%') as foundation_absent,
 to_regclass('dv_collect_private.tcg_magic_on_demand_beta') is null as beta_absent,
 not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('get_magic_on_demand_collection_beta_v1','save_my_tcg_collection_item_v1')) or (n.nspname='dv_collect_private' and p.proname='tcg_require_collection_release_v1')) as m6_rpcs_absent,
 to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()') is null as production_lock_absent,
 (select count(*)::int from pg_catalog.pg_trigger where tgname='a00_production_trade_lock_v1') as production_lock_triggers,
 (select pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conrelid=to_regclass('public.collection_items') and conname='collection_items_tcg_check') as collection_constraint,
 (select pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conrelid=to_regclass('public.market_listings') and conname='market_listings_tcg_check') as marketplace_constraint,
 (select count(*)=2 from (values ('public.get_security_schema_readiness_v1()', '1450b560b9edc32297de2db570ae3aad'),('public.get_market_legal_schema_readiness_v1()', 'e3ee1e242f95123913ae88a323fbd830')) expected(signature,body_md5) join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature) where p.provolatile='s' and p.prosecdef and pg_catalog.md5(p.prosrc)=expected.body_md5) as m6_readiness_bodies_match,
 (select bool_and(to_regclass('dv_collect_private.'||name) is not null) from unnest(array['tcg_games','tcg_providers','tcg_provider_bindings','tcg_catalog_releases','tcg_magic_on_demand_beta']) name) as config_relations_present
),
roots as materialized (
 select x.security::jsonb as security,x.legal::jsonb as legal
 from xmltable('/table/row' passing query_to_xml(
  case when (select m6_readiness_bodies_match from observed) then
   'select public.get_security_schema_readiness_v1() as security, public.get_market_legal_schema_readiness_v1() as legal'
  else 'select null::jsonb as security, null::jsonb as legal' end,
  true,false,'') columns security text path 'security/text()',legal text path 'legal/text()') x
),
config as materialized (
 select x.payload::jsonb as payload from xmltable('/table/row' passing query_to_xml(
 case when (select config_relations_present from observed) then $query$
 select jsonb_build_object(
 'magic',(select to_jsonb(g) from dv_collect_private.tcg_games g where game_key='magic'),
 'provider',(select to_jsonb(p) from dv_collect_private.tcg_providers p where provider_key='scryfall'),
 'bindings',(select coalesce(jsonb_agg(to_jsonb(b) order by provider_key,provider_version),'[]'::jsonb) from dv_collect_private.tcg_provider_bindings b where game_key='magic'),
 'release',(select jsonb_build_object('game_key',game_key,'provider_key',provider_key,'provider_version',provider_version,'state',state,'schema_phase',schema_phase,'snapshot_id',snapshot_id) from dv_collect_private.tcg_catalog_releases where game_key='magic'),
 'beta',(select coalesce(jsonb_agg(to_jsonb(b) order by game_key),'[]'::jsonb) from dv_collect_private.tcg_magic_on_demand_beta b)
 ) as payload
 $query$ else 'select null::jsonb as payload' end,true,false,'') columns payload text path 'payload/text()') x
),
checks as (
 select o.*,r.security,r.legal,c.payload,
 coalesce(o.postgres_major=17 and o.collect_schema_present and o.config_relations_present
 and o.m6_readiness_bodies_match and o.production_lock_absent and o.production_lock_triggers=0
 and not o.m6_rpcs_absent
 and o.collection_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text, ''magic''::text])))'
 and o.marketplace_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text])))'
 and r.security='{"revision":"privilege-mfa-v1","compatible":true,"tcg_beta_contract":"magic-on-demand-collect-beta/1"}'::jsonb
 and r.legal='{"revision":"trade-legal-contract-model-v1.2","compatible":true,"tcg_beta_contract":"magic-on-demand-collect-beta/1"}'::jsonb
 and c.payload->'magic'='{"game_key":"magic","registry_version":"1","available":false,"collection_ready":false,"marketplace_ready":false}'::jsonb
 and c.payload->'provider'='{"provider_key":"scryfall","display_name":"Scryfall"}'::jsonb
 and c.payload->'bindings'='[{"game_key":"magic","provider_key":"scryfall","provider_version":"1"}]'::jsonb
 and c.payload->'release'='{"game_key":"magic","provider_key":"scryfall","provider_version":"1","state":"foundation","schema_phase":"persistence","snapshot_id":null}'::jsonb
 and c.payload->'beta'='[{"game_key":"magic","contract":"magic-on-demand-collect-beta/1","provider_key":"scryfall","provider_version":"1","enabled":false}]'::jsonb,false) as postcheck_pass
 from observed o cross join roots r cross join config c
)
select postcheck_pass as "POSTCHECK_PASS",to_jsonb(checks)-'postcheck_pass' as evidence,
 coalesce(payload->'magic'->>'available'='false' and payload->'release'->>'state'='foundation',false) as scanner_closed,
 coalesce(payload->'magic'->>'available'='false' and payload->'release'->>'state'='foundation',false) as pricing_closed,
 coalesce(payload->'magic'->>'available'='false' and payload->'release'->>'state'='foundation',false) as battle_closed
from checks;
