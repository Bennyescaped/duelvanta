-- NOT_AUTO_APPLY. History68 must be checked externally; no history writes or user data.
with observed as materialized (
 select current_setting('server_version_num')::int/10000 postgres_major,
 to_regclass('dv_collect_private.tcg_games') is not null i2_present,
 to_regclass('dv_collect_private.tcg_catalog_releases') is null m4_absent,
 to_regclass('dv_collect_private.tcg_magic_on_demand_beta') is null beta_absent,
 to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()') is null production_lock_absent,
 (select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') production_lock_triggers,
 (select jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready) order by c.relname collate "C") from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=to_regclass('public.collection_items')) indexes,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.collection_items') and conname='collection_items_tcg_check') collection_constraint,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid=to_regclass('public.market_listings') and conname='market_listings_tcg_check') marketplace_constraint,
 (select count(*)=2 from (values ('get_market_legal_schema_readiness_v1','3bd8f376a09fa0547b4c222f595ca5d1'),('get_security_schema_readiness_v1','dd5c1cd914bfd938926ff41b6b423c24')) e(name,body) join pg_proc p on p.oid=to_regprocedure('public.'||e.name||'()') where md5(p.prosrc)=e.body and p.provolatile='s' and p.prosecdef) old_unit15_bodies_match
), roots as materialized (
 select x.security::jsonb security,x.legal::jsonb legal from xmltable('/table/row' passing query_to_xml(case when (select old_unit15_bodies_match from observed) then 'select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal' else 'select null::jsonb security,null::jsonb legal' end,true,false,'') columns security text path 'security/text()',legal text path 'legal/text()') x
), checks as (
 select o.*,r.security,r.legal,coalesce(o.postgres_major=17 and o.i2_present and o.m4_absent and o.beta_absent and o.production_lock_absent and o.production_lock_triggers=0 and o.old_unit15_bodies_match
 and o.indexes='[{"name":"collection_items_binder_position_unique","definition":"CREATE UNIQUE INDEX collection_items_binder_position_unique ON public.collection_items USING btree (user_id, folder_id, binder_page, binder_slot) WHERE ((folder_id IS NOT NULL) AND (binder_page IS NOT NULL) AND (binder_slot IS NOT NULL))","valid":true,"ready":true},{"name":"collection_items_folder_idx","definition":"CREATE INDEX collection_items_folder_idx ON public.collection_items USING btree (folder_id)","valid":true,"ready":true},{"name":"collection_items_lookup_idx","definition":"CREATE INDEX collection_items_lookup_idx ON public.collection_items USING btree (user_id, tcg, set_name, card_number)","valid":true,"ready":true},{"name":"collection_items_pkey","definition":"CREATE UNIQUE INDEX collection_items_pkey ON public.collection_items USING btree (id)","valid":true,"ready":true},{"name":"collection_items_user_created_idx","definition":"CREATE INDEX collection_items_user_created_idx ON public.collection_items USING btree (user_id, created_at DESC)","valid":true,"ready":true},{"name":"collection_items_user_id_idx","definition":"CREATE INDEX collection_items_user_id_idx ON public.collection_items USING btree (user_id)","valid":true,"ready":true}]'::jsonb
 and o.collection_constraint='CHECK ((tcg = ANY (ARRAY[''pokemon''::text, ''one_piece''::text, ''other''::text])))'
 and o.marketplace_constraint=o.collection_constraint
 and r.security='{"revision":"privilege-mfa-v1","compatible":true}'::jsonb
 and r.legal='{"revision":"trade-legal-contract-model-v1.2","compatible":false}'::jsonb,false) precheck_pass
 from observed o cross join roots r
) select precheck_pass as "PRECHECK_PASS",to_jsonb(checks)-'precheck_pass' evidence from checks;
