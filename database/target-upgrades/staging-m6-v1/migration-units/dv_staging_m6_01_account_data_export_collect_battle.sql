-- T2 review candidate. Apply only in an explicitly authorized release transaction
-- after the complete P0-01/P0-02 stack; pair with the matching generated readiness.
-- No table data, policies, retention, holds or erasure routines are changed.
begin;

create or replace function dv_market_private.collect_battle_export_for_caller()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog as $export$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  -- Explicit projections: newly added columns never enter an export implicitly.
  -- Read tables directly: budget/admission/status RPCs may mutate counters/media.
  return jsonb_build_object(
    'scanner',jsonb_build_object(
      'openai_reservations',coalesce((select jsonb_agg(to_jsonb(x) order by x.reserved_at,x.request_id) from (
        select request_id,week_start,image_sha256,tcg,kind,reserved_eur_micros,eur_per_usd_micros,
          estimated_cost_eur_micros,estimated_cost_usd_micros,input_tokens,output_tokens,settled_at,reserved_at
        from dv_v16_private.openai_scan_reservation where user_id=v_uid
      ) x),'[]'::jsonb),
      'openai_weekly_usage',coalesce((select jsonb_agg(to_jsonb(x) order by x.week_start) from (
        select week_start,raw_used,slab_used from dv_v16_private.openai_weekly_usage where user_id=v_uid
      ) x),'[]'::jsonb),
      'historical_reservations',coalesce((select jsonb_agg(to_jsonb(x) order by x.reserved_at,x.request_id) from (
        select request_id,week_start,image_sha256,tcg,kind,credits,reserved_at
        from dv_v16_private.scan_reservation where user_id=v_uid
      ) x),'[]'::jsonb),
      'historical_weekly_usage',coalesce((select jsonb_agg(to_jsonb(x) order by x.week_start) from (
        select week_start,raw_used,slab_used from dv_v16_private.weekly_usage where user_id=v_uid
      ) x),'[]'::jsonb)
    ),
    'battle',jsonb_build_object(
      'matches',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.match_id) from (
        select id match_id,tcg,mode,visibility,language,status,started_at,completed_at,created_at,updated_at,
          case when host_id=v_uid then 'host' else 'guest' end participant_role,
          case when host_id=v_uid then host_ready else guest_ready end my_ready,
          case when host_id=v_uid then
            case host_result when 'host' then 'self' when 'guest' then 'opponent' when 'draw' then 'draw' end
          else case guest_result when 'guest' then 'self' when 'host' then 'opponent' when 'draw' then 'draw' end end my_reported_result,
          case when winner_id=v_uid then 'won'
            when winner_id is not null and winner_id in (host_id,guest_id) then 'lost'
            when status='completed' and host_result='draw' and guest_result='draw' then 'draw'
            else null end my_outcome
        from public.battle_matches where host_id=v_uid or guest_id=v_uid
      ) x),'[]'::jsonb),
      'ratings',coalesce((select jsonb_agg(to_jsonb(x) order by x.tcg) from (
        select tcg,rating,games,wins,losses,draws,updated_at from public.battle_ratings where user_id=v_uid
      ) x),'[]'::jsonb),
      'rating_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.event_id) from (
        select id event_id,match_id,tcg,created_at,
          case when host_id=v_uid then host_before else guest_before end rating_before,
          case when host_id=v_uid then host_after else guest_after end rating_after,
          case when host_id=v_uid then host_delta else guest_delta end rating_delta,
          case when result='draw' then 'draw'
            when (host_id=v_uid and result='host') or (guest_id=v_uid and result='guest') then 'won'
            when result in ('host','guest') then 'lost' else null end my_outcome
        from public.battle_rating_events where host_id=v_uid or guest_id=v_uid
      ) x),'[]'::jsonb),
      'signal_metadata',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.signal_id) from (
        select id signal_id,match_id,signal_type,created_at from public.battle_signals where sender_id=v_uid
      ) x),'[]'::jsonb),
      'spectator_grants',coalesce((select jsonb_agg(to_jsonb(x) order by x.match_id) from (
        select match_id from battle_spectator_private.grants where user_id=v_uid
      ) x),'[]'::jsonb),
      'spectator_presence',coalesce((select jsonb_agg(to_jsonb(x) order by x.match_id,x.expires_at) from (
        select match_id,expires_at from battle_spectator_private.presence where user_id=v_uid
      ) x),'[]'::jsonb),
      'media_consents',coalesce((select jsonb_agg(to_jsonb(x) order by x.match_id) from (
        select match_id,consent_version,granted,updated_at from battle_spectator_media_private.consents where user_id=v_uid
      ) x),'[]'::jsonb)
    )
  );
end
$export$;
revoke all on function dv_market_private.collect_battle_export_for_caller() from public,anon,authenticated,service_role;

-- The public entry point below preserves the existing V1 fields and audit path.
-- Pickup uses only the existing, already reviewed helper. Version changes solely
-- identify the augmented payload; one audit INSERT still hashes the final payload.

create or replace function public.export_my_duelvanta_data()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private,extensions as $$
declare v_uid uuid:=auth.uid();v_payload jsonb;v_profile jsonb;v_seller jsonb;v_legal jsonb;v_tax jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select to_jsonb(p) into v_profile from public.profiles p where p.id=v_uid;
  select to_jsonb(s) into v_seller from public.market_seller_accounts s where s.seller_id=v_uid;
  select to_jsonb(l) into v_legal from dv_market_private.seller_legal_profiles l where l.seller_id=v_uid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'identifier_kind',t.identifier_kind,'issuing_country_code',t.issuing_country_code,
    'created_at',t.created_at,'updated_at',t.updated_at
  )),'[]'::jsonb) into v_tax from dv_market_private.seller_tax_identifiers t where t.seller_id=v_uid;

  v_payload:=jsonb_build_object(
    'export_version','duelvanta-data-export-v3','generated_at',now(),
    'account',coalesce(v_profile,'{}'::jsonb),
    'collection',jsonb_build_object(
      'folders',dv_market_private.json_rows(format('select * from public.collection_folders where user_id=%L order by created_at,id',v_uid)),
      'items',dv_market_private.json_rows(format('select * from public.collection_items where user_id=%L order by created_at,id',v_uid))
    ),
    'marketplace',jsonb_build_object(
      'seller_account',coalesce(v_seller,'null'::jsonb),
      'seller_legal_profile',coalesce(v_legal,'null'::jsonb),
      'tax_identifier_references',v_tax,
      'seller_declarations',dv_market_private.json_rows(format('select declaration_kind,document_version,accepted_at,withdrawn_at from dv_market_private.seller_declarations where seller_id=%L order by accepted_at,id',v_uid)),
      'listings',dv_market_private.json_rows(format('select to_jsonb(l)-array[''seller_id'',''deal_buyer_id''] row_data from public.market_listings l where seller_id=%L order by created_at,id',v_uid)),
      'offers',dv_market_private.json_rows(format('select to_jsonb(o)-array[''seller_id'',''buyer_id''] row_data from public.market_offers o where seller_id=%L or buyer_id=%L order by created_at,id',v_uid,v_uid)),
      'orders',dv_market_private.json_rows(format('select to_jsonb(o)-array[''seller_id'',''buyer_id'',''provider_payment_ref'',''provider_payout_ref'',''provider_refund_ref''] row_data from public.market_orders o where seller_id=%L or buyer_id=%L order by created_at,id',v_uid,v_uid)),
      'deals',dv_market_private.json_rows(format('select to_jsonb(d)-array[''seller_id'',''buyer_id'',''provider_payment_ref'',''provider_payout_ref''] row_data from public.market_deals d where seller_id=%L or buyer_id=%L order by accepted_at,id',v_uid,v_uid)),
      'default_shipping_address',dv_market_private.json_rows(format('select * from public.market_default_shipping_addresses where user_id=%L',v_uid)),
      'shipping_profiles',dv_market_private.json_rows(format('select * from public.market_shipping_profiles where seller_id=%L order by created_at,id',v_uid)),
      'contract_documents',dv_market_private.json_rows(format('select id,order_id,deal_id,contract_classification,seller_party,platform_operator,product_snapshot,quantity,unit_price,goods_total,shipping_method,shipping_cost,total_price,currency,payment_provider,contract_formed_at,snapshot_version,confirmation_format,confirmation_text,encode(content_sha256,''hex'') content_sha256 from dv_market_private.market_contract_snapshots where seller_id=%L or buyer_id=%L order by contract_formed_at,id',v_uid,v_uid)),
      'withdrawals',dv_market_private.json_rows(format('select id,contract_snapshot_id,order_id,deal_id,contract_domain,consumer_name,confirmation_email,declaration_text,submitted_at,encode(content_sha256,''hex'') content_sha256 from dv_market_private.market_withdrawals where buyer_id=%L or seller_id=%L order by submitted_at,id',v_uid,v_uid)),
      'payment_attempts',case when to_regclass('dv_market_private.market_payment_attempts') is null then '[]'::jsonb else dv_market_private.json_rows(format('select id,order_id,state,currency,amount_due_cents,platform_fee_cents,seller_net_cents,paid_cents,refunded_cents,prepared_at,paid_at,updated_at from dv_market_private.market_payment_attempts where seller_id=%L or buyer_id=%L order by prepared_at,id',v_uid,v_uid)) end,
      'financial_documents',case when to_regclass('dv_market_private.market_financial_documents') is null then '[]'::jsonb else dv_market_private.json_rows(format('select d.id,d.attempt_id,d.document_kind,d.document_status,d.issuer_role,d.authorization_version,d.currency,d.net_cents,d.tax_cents,d.gross_cents,d.tax_treatment,encode(d.content_sha256,''hex'') content_sha256,d.issued_at,d.created_at from dv_market_private.market_financial_documents d join dv_market_private.market_payment_attempts a on a.id=d.attempt_id where a.seller_id=%L or a.buyer_id=%L order by d.created_at,d.id',v_uid,v_uid)) end,
      'tax_events',dv_market_private.json_rows(format('select event_type,occurred_at,reporting_year,reporting_quarter,currency,gross_consideration_delta,platform_fee_delta,commission_delta,withheld_tax_delta,remuneration_delta,activity_count_delta,source_type,created_at from dv_market_private.market_tax_events where seller_id=%L order by occurred_at,id',v_uid)),
      'my_notices',dv_market_private.json_rows(format('select case_reference,listing_id,category,explanation,alleged_legal_basis,exact_url,status,decision_action,decision_basis_kind,decision_reference,decision_reason,decision_scope,decision_duration,automated_means_used,submitted_at,decided_at from dv_market_private.listing_notices where reporter_user_id=%L order by submitted_at,id',v_uid)),
      'my_appeals',dv_market_private.json_rows(format('select a.id,n.case_reference,a.appellant_kind,a.grounds,a.status,a.decision_reason,a.submitted_at,a.decided_at from dv_market_private.listing_notice_appeals a join dv_market_private.listing_notices n on n.id=a.notice_id where a.appellant_user_id=%L order by a.submitted_at,a.id',v_uid)),
      'pickup_messages',dv_market_private.pickup_messages_for_export(v_uid)
    ),
    'scope_note','Enthält den bestehenden Export einschließlich Pickup-Konversationen sowie eigene Scanner- und BATTLE-Daten. BATTLE-Fremdkennungen, Reports, Staff-/Judge-Daten, Signaling-Payloads und Zugangstokens sind in der Ergänzung ausgeschlossen. Kein vollständiger Providerexport.'
  );
  v_payload:=v_payload || dv_market_private.collect_battle_export_for_caller();
  insert into dv_market_private.user_data_export_events(user_id_hash,export_format,export_version,content_sha256)
  values(digest(v_uid::text,'sha256'),'application/json','duelvanta-data-export-v3',digest(v_payload::text,'sha256'));
  return v_payload;
end
$$;
revoke all on function public.export_my_duelvanta_data() from public, anon;
grant execute on function public.export_my_duelvanta_data() to authenticated;


commit;
