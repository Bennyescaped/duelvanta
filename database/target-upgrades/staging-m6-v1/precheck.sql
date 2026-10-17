-- NOT_AUTO_APPLY. One read-only SELECT; no identity or apply authorization is inferred.
-- Legacy function bodies are pinned to both P5-R1 captures and accepted P6-R3 sources.
-- query_to_xml executes only the two fixed SELECT strings below, guarding absent functions.
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
 (select count(*)=2 from (values ('public.get_security_schema_readiness_v1()', '6f97a4d356e43e5a52d9633656a9a8b5'),('public.get_market_legal_schema_readiness_v1()', '8bce68d4236cf5f7ce2182b64b16dc11')) expected(signature,body_md5) join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature) where p.provolatile='s' and p.prosecdef and pg_catalog.md5(p.prosrc)=expected.body_md5) as legacy_readiness_bodies_match
),
roots as materialized (
 select x.security::jsonb as security,x.legal::jsonb as legal
 from xmltable('/table/row' passing query_to_xml(
  case when (select legacy_readiness_bodies_match from observed) then
   'select public.get_security_schema_readiness_v1() as security, public.get_market_legal_schema_readiness_v1() as legal'
  else 'select null::jsonb as security, null::jsonb as legal' end,
  true,false,'') columns security text path 'security/text()',legal text path 'legal/text()') x
),
checks as (
 select o.*,r.security,r.legal,
 coalesce(o.postgres_major=17 and o.collect_schema_present and o.foundation_absent and o.beta_absent
 and o.m6_rpcs_absent and o.production_lock_absent and o.production_lock_triggers=0
 and o.legacy_readiness_bodies_match
 and o.collection_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text])))'
 and o.marketplace_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text])))'
 and r.security='{"revision":"privilege-mfa-v1","compatible":true}'::jsonb
 and r.legal='{"revision":"trade-legal-contract-model-v1.2","compatible":true}'::jsonb,false) as precheck_pass
 from observed o cross join roots r
)
select precheck_pass as "PRECHECK_PASS",to_jsonb(checks)-'precheck_pass' as evidence from checks;
