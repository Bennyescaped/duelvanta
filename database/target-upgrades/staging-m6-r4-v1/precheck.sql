-- NOT_AUTO_APPLY. Read-only; PASS is mandatory before a separately authorized apply.
with r3 as (-- NOT_AUTO_APPLY. Read-only schema/configuration postcondition, Beta remains OFF.
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
 (select count(*)=2 from (values ('public.get_security_schema_readiness_v1()', '625392c603ff9e8daa5a9c8105414f9a'),('public.get_market_legal_schema_readiness_v1()', '008b12f007293b8a1902fe46c38652ae')) expected(signature,body_md5) join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature) where p.provolatile='s' and p.prosecdef and pg_catalog.md5(p.prosrc)=expected.body_md5) as m6_readiness_bodies_match,
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
from checks), checks as (select
 ((select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations)='[{"version":"20260913141026","name":"create_private_market_listing_images_bucket"},{"version":"20260914092948","name":"pgcrypto_digest_schema_hardening_v1"},{"version":"20260914093254","name":"market_stripe_payment_result_columns_v1"},{"version":"20260914102659","name":"trade_actions_column_aliases_v1"},{"version":"20260915064648","name":"market_stripe_event_ordering_hardening_v1"},{"version":"20260915080258","name":"market_stripe_refund_evidence_hardening_v1"},{"version":"20260915082005","name":"market_stripe_refund_evidence_immutability_fix_v1"},{"version":"20260916073251","name":"b07_tracking_delivery_window_v1"},{"version":"20260916081359","name":"b07_l07_01_release1_shipping_close_v1"},{"version":"20260916081618","name":"b07_l07_01_release1_shipping_close_v1_hardening"},{"version":"20260916082424","name":"b07_l07_01_shipping_deadline_hardening_v1"},{"version":"20260916110622","name":"b07_c2c_eligibility_dependency_v1"},{"version":"20260916110653","name":"b07_l07_01_c2c_swap_v1_schema"},{"version":"20260916110745","name":"b07_l07_01_c2c_swap_v1_binding"},{"version":"20260916110933","name":"b07_l07_01_c2c_swap_v1_fulfillment_shipping"},{"version":"20260916110944","name":"b07_l07_01_c2c_swap_v1_fulfillment_receive"},{"version":"20260916111050","name":"b07_l07_01_c2c_swap_v1_problems"},{"version":"20260916111119","name":"b07_l07_01_c2c_swap_v1_pickup_schema"},{"version":"20260916111135","name":"b07_l07_01_c2c_swap_v1_pickup_revision"},{"version":"20260916111144","name":"b07_l07_01_c2c_swap_v1_pickup_proposals"},{"version":"20260916111204","name":"b07_l07_01_c2c_swap_v1_pickup_binding"},{"version":"20260916111218","name":"b07_l07_01_c2c_swap_v1_pickup_code"},{"version":"20260916112219","name":"b07_l07_01_c2c_swap_v1_completion_compat"},{"version":"20260916112232","name":"b07_l07_01_c2c_swap_v1_pickup_completion_compat"},{"version":"20260916180544","name":"b07_l07_01_pickup_messages_v1"},{"version":"20260916181124","name":"b07_l07_01_pickup_messages_v1_list"},{"version":"20260917094814","name":"b07_l07_01_order_pickup_handover_staging_repair_v1"},{"version":"20260917101616","name":"account_data_rights_pickup_messages_hardening_v1"},{"version":"20260917111158","name":"b07_trade_only_no_money_v1"},{"version":"20260917111935","name":"b07_sealed_sale_only_v1"},{"version":"20260917132229","name":"trade_notifications_v2"},{"version":"20260917132525","name":"trade_notifications_v2_kind_expansion"},{"version":"20260917132613","name":"trade_notifications_v2_cutover"},{"version":"20260917180908","name":"b07_sale_only_release_v1"},{"version":"20260917180910","name":"b07_sale_only_notifications_v1"},{"version":"20260917180911","name":"b07_sale_only_public_listings_v1"},{"version":"20260917185128","name":"b07_offer_reservation_v1_staging"},{"version":"20260917185406","name":"b07_offer_reservation_sale_only_reads"},{"version":"20260917201448","name":"b07_shipping_receipt_completion_realign_v1"},{"version":"20260918103806","name":"battle_beta_account_status_v1"},{"version":"20260918131743","name":"battle_dispute_resolution_v1"},{"version":"20260918135427","name":"battle_judge_desk_v1"},{"version":"20260918150007","name":"battle_spectator_foundation_v1"},{"version":"20260918210927","name":"battle_spectator_media_v1"},{"version":"20260918213553","name":"battle_spectator_media_publisher_admission_v1"},{"version":"20260919103559","name":"battle_spectator_media_pg_net_v1"},{"version":"20260919104947","name":"battle_spectator_media_vault_scheduler_v1"},{"version":"20260919132152","name":"battle_spectator_media_reconciler_v1"},{"version":"20260921151654","name":"collect_empty_binder_delete"},{"version":"20260923081953","name":"trade_legal_contract_model_v1"},{"version":"20260924113112","name":"auth_privileged_step_up_v1"},{"version":"20260924113132","name":"security_privilege_mfa_hardening_v1"},{"version":"20260924113153","name":"security_readiness_v1"},{"version":"20261011174228","name":"dv_staging_m6_01_account_data_export_collect_battle"},{"version":"20261012103450","name":"dv_staging_m6_02_account_processing_markers"},{"version":"20261012103529","name":"dv_staging_m6_03_account_closure_privacy"},{"version":"20261012103551","name":"dv_staging_m6_04_scanner_processing_hold"},{"version":"20261012103611","name":"dv_staging_m6_05_battle_player_processing_hold"},{"version":"20261012103805","name":"dv_staging_m6_06_battle_signal_processing_hold"},{"version":"20261012103831","name":"dv_staging_m6_07_battle_spectator_withdrawal"},{"version":"20261012103909","name":"dv_staging_m6_08_battle_spectator_epoch_processing_hold"},{"version":"20261012103928","name":"dv_staging_m6_09_staff_processing_hold"},{"version":"20261012103959","name":"dv_staging_m6_10_publication_processing_hold"},{"version":"20261012104040","name":"dv_staging_m6_11_battle_safety_sanctions"},{"version":"20261012104114","name":"dv_staging_m6_12_account_deletion_withdrawal"},{"version":"20261012104147","name":"dv_staging_m6_13_account_erasure_l1"},{"version":"20261012104219","name":"dv_staging_m6_14_tcg_i2_canonical_integration"},{"version":"20261012104249","name":"dv_staging_m6_15_tcg_i2_readiness_staging"},{"version":"20261012145314","name":"dv_staging_m6r2_01_i2_readiness_reconcile"},{"version":"20261012145433","name":"dv_staging_m6r2_02_tcg_i3_magic_persistence"},{"version":"20261013113151","name":"dv_staging_m6r3_01_m4_readiness_reconcile"},{"version":"20261013113259","name":"dv_staging_m6r3_02_tcg_i3_magic_on_demand"}]'::jsonb) history72_exact,
 not exists(select 1 from supabase_migrations.schema_migrations where name='dv_staging_m6r4_01_magic_collect_admission') no_name_collision,
 to_regclass('dv_collect_private.magic_collect_admission_v1') is null admission_absent,
 to_regclass('dv_collect_private.magic_collect_admission_audit_v1') is null audit_absent,
 r3."POSTCHECK_PASS" r3_baseline_exact from r3)
select coalesce(history72_exact and no_name_collision and admission_absent and audit_absent and r3_baseline_exact,false) as "PRECHECK_PASS",to_jsonb(checks) evidence from checks;
