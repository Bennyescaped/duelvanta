-- DUELVANTA B07 pickup-message data-rights hardening V1.
-- Apply AFTER account-data-rights-v1.sql and b07-l07-01-pickup-messages-v1.sql.
-- REVIEW/STAGING ONLY. No automatic retention deadline is introduced here.

insert into dv_market_private.data_retention_rules(
  category,purpose,legal_basis,retention_rule,automatic_until_supported,policy_version
) values(
  'pickup_messages','Koordination persönlicher Übergaben','external_review_required',
  'Bis zur extern bestätigten Rechtsgrundlage/Aufbewahrungsfrist nur manueller Retention-Hold; keine automatische Löschfrist.',
  false,'b07-pickup-messages-data-rights-v1'
)
on conflict(category) do update set
  purpose=excluded.purpose,
  legal_basis=excluded.legal_basis,
  retention_rule=excluded.retention_rule,
  automatic_until_supported=excluded.automatic_until_supported,
  policy_version=excluded.policy_version,
  updated_at=now();

create or replace function dv_market_private.user_has_pickup_messages(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
  select exists(
    select 1
    from dv_market_private.market_pickup_messages m
    where
      (m.context_type='order' and exists(
        select 1 from public.market_orders o
        where o.id=m.context_id and p_uid in (o.seller_id,o.buyer_id)
      ))
      or
      (m.context_type='swap' and exists(
        select 1 from dv_market_private.market_swap_threads t
        where t.id=m.context_id and p_uid in (t.party_a_id,t.party_b_id)
      ))
  )
$$;
revoke all on function dv_market_private.user_has_pickup_messages(uuid) from public,anon,authenticated;

create or replace function dv_market_private.pickup_messages_for_export(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
  with permitted as (
    select 'order'::text context_type,o.id context_id
    from public.market_orders o
    where p_uid in (o.seller_id,o.buyer_id) and o.fulfillment_group='pickup'
    union all
    select 'swap'::text,t.id
    from dv_market_private.market_swap_threads t
    where p_uid in (t.party_a_id,t.party_b_id) and t.fulfillment_mode='pickup'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',m.id,
    'context_type',m.context_type,
    'context_id',m.context_id,
    'sender_role',case when m.sender_id=p_uid then 'self' else 'other' end,
    'body',m.body,
    'created_at',m.created_at
  ) order by m.created_at,m.id),'[]'::jsonb)
  from dv_market_private.market_pickup_messages m
  join permitted p on p.context_type=m.context_type and p.context_id=m.context_id
$$;
revoke all on function dv_market_private.pickup_messages_for_export(uuid) from public,anon,authenticated;

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
    'export_version','duelvanta-data-export-v2','generated_at',now(),
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
      'payment_attempts',case when to_regclass('dv_market_private.market_payment_attempts') is null then '[]'::jsonb else dv_market_private.json_rows(format('select id,order_id,state,currency,amount_due_cents,platform_fee_cents,seller_net_cents,paid_cents,refunded_cents,prepared_at,paid_at,updated_at from dv_market_private.market_payment_attempts where seller_id=%L or buyer_id=%L order by prepared_at,id',v_uid,v_uid)) end,
      'financial_documents',case when to_regclass('dv_market_private.market_financial_documents') is null then '[]'::jsonb else dv_market_private.json_rows(format('select d.id,d.attempt_id,d.document_kind,d.document_status,d.issuer_role,d.authorization_version,d.currency,d.net_cents,d.tax_cents,d.gross_cents,d.tax_treatment,encode(d.content_sha256,''hex'') content_sha256,d.issued_at,d.created_at from dv_market_private.market_financial_documents d join dv_market_private.market_payment_attempts a on a.id=d.attempt_id where a.seller_id=%L or a.buyer_id=%L order by d.created_at,d.id',v_uid,v_uid)) end,
      'tax_events',dv_market_private.json_rows(format('select event_type,occurred_at,reporting_year,reporting_quarter,currency,gross_consideration_delta,platform_fee_delta,commission_delta,withheld_tax_delta,remuneration_delta,activity_count_delta,source_type,created_at from dv_market_private.market_tax_events where seller_id=%L order by occurred_at,id',v_uid)),
      'my_notices',dv_market_private.json_rows(format('select case_reference,listing_id,category,explanation,alleged_legal_basis,exact_url,status,decision_action,decision_basis_kind,decision_reference,decision_reason,decision_scope,decision_duration,automated_means_used,submitted_at,decided_at from dv_market_private.listing_notices where reporter_user_id=%L order by submitted_at,id',v_uid)),
      'my_appeals',dv_market_private.json_rows(format('select a.id,n.case_reference,a.appellant_kind,a.grounds,a.status,a.decision_reason,a.submitted_at,a.decided_at from dv_market_private.listing_notice_appeals a join dv_market_private.listing_notices n on n.id=a.notice_id where a.appellant_user_id=%L order by a.submitted_at,a.id',v_uid)),
      'pickup_messages',dv_market_private.pickup_messages_for_export(v_uid)
    ),
    'scope_note','Enthält eigene Daten, Vertragsdokumente und Pickup-Konversationen. Fremde interne Nutzerkennungen, Zustellprotokolle und verschlüsselte Steuerwerte sind ausgeschlossen.'
  );
  insert into dv_market_private.user_data_export_events(user_id_hash,export_format,export_version,content_sha256)
  values(digest(v_uid::text,'sha256'),'application/json','duelvanta-data-export-v2',digest(v_payload::text,'sha256'));
  return v_payload;
end
$$;
revoke all on function public.export_my_duelvanta_data() from public,anon;
grant execute on function public.export_my_duelvanta_data() to authenticated;

drop trigger if exists block_restricted_pickup_messages on dv_market_private.market_pickup_messages;
create trigger block_restricted_pickup_messages
before insert or update or delete on dv_market_private.market_pickup_messages
for each row execute function dv_market_private.block_restricted_account_mutation();

create or replace function public.prepare_account_deletion_data(p_request_id uuid,p_lock_token uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare v_request dv_market_private.account_deletion_requests%rowtype;v_has_holds boolean;v_until timestamptz;
begin
  select * into v_request from dv_market_private.account_deletion_requests
  where id=p_request_id and status='processing' and lock_token=p_lock_token for update;
  if not found then raise exception 'deletion_request_lock_invalid'; end if;
  if jsonb_array_length(dv_market_private.account_deletion_blockers(v_request.user_id))>0 then raise exception 'deletion_blockers_changed'; end if;

  if exists(select 1 from dv_market_private.market_contract_snapshots where seller_id=v_request.user_id or buyer_id=v_request.user_id) then
    insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required)
    values(v_request.id,v_request.user_id,'contract_evidence','Abgeschlossene Vertragsnachweise bleiben zugriffsbeschränkt.',true)
    on conflict(request_id,category) do nothing;
  end if;
  select make_timestamptz(max(reporting_year)+11,1,1,0,0,0,'UTC') into v_until
  from dv_market_private.market_tax_events where seller_id=v_request.user_id;
  if v_until is not null then
    insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,retain_until)
    values(v_request.id,v_request.user_id,'psttg_record','PStTG-Aufzeichnungen: zehn Jahre nach Ende des Aufzeichnungsjahres.',v_until)
    on conflict(request_id,category) do nothing;
  end if;
  if exists(select 1 from dv_market_private.listing_notices where reporter_user_id=v_request.user_id)
     or exists(select 1 from dv_market_private.listing_notice_appeals where appellant_user_id=v_request.user_id) then
    insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required)
    values(v_request.id,v_request.user_id,'notice_procedure','Abgeschlossene Meldungs- und Einspruchsnachweise bleiben zugriffsbeschränkt.',true)
    on conflict(request_id,category) do nothing;
  end if;
  if dv_market_private.user_has_pickup_messages(v_request.user_id) then
    insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required)
    values(
      v_request.id,v_request.user_id,'pickup_messages',
      'Pickup-Nachrichten bleiben bis zur extern bestätigten Aufbewahrungsentscheidung zugriffsbeschränkt; keine automatische Frist.',true
    )
    on conflict(request_id,category) do nothing;
  end if;
  select exists(select 1 from dv_market_private.account_deletion_holds where request_id=v_request.id and released_at is null) into v_has_holds;

  delete from public.market_notifications where recipient_id=v_request.user_id;
  delete from public.market_default_shipping_addresses where user_id=v_request.user_id;
  delete from public.market_listing_images where seller_id=v_request.user_id;
  update public.market_listings set collection_item_id=null,image_path=null,seller_note=null,
    seller_display_name='Gelöschtes Mitglied',status=case when status in ('active','reserved') then 'paused' else status end,
    updated_at=now() where seller_id=v_request.user_id;
  delete from public.collection_items where user_id=v_request.user_id;
  delete from public.collection_folders where user_id=v_request.user_id;
  update public.market_seller_accounts set onboarding_status='suspended',suspended_at=coalesce(suspended_at,now()),
    trader_display_name=null,updated_at=now() where seller_id=v_request.user_id;
  update public.profiles set email='deleted-'||gen_random_uuid()::text||'@invalid.local',
    display_name='Gelöschtes Mitglied',username=null,avatar_path=null,collection_visibility='private',
    updated_at=now() where id=v_request.user_id;
  if not v_has_holds then
    delete from dv_market_private.market_pickup_messages where sender_id=v_request.user_id;
    delete from dv_market_private.seller_tax_identifiers where seller_id=v_request.user_id;
    delete from dv_market_private.seller_legal_profiles where seller_id=v_request.user_id;
  end if;
  update dv_market_private.account_deletion_requests set auth_action=case when v_has_holds then 'disable_and_retain' else 'delete' end
  where id=v_request.id;
  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
  values(v_request.user_id,v_request.id,'data_erasure_prepared',jsonb_build_object(
    'retention_holds',v_has_holds,
    'pickup_messages_retained',exists(
      select 1 from dv_market_private.account_deletion_holds h
      where h.request_id=v_request.id and h.category='pickup_messages' and h.released_at is null
    )
  ));
  return jsonb_build_object(
    'request_id',v_request.id,'user_id',v_request.user_id,
    'auth_action',case when v_has_holds then 'disable_and_retain' else 'delete' end,
    'has_retention_holds',v_has_holds
  );
end
$$;
revoke all on function public.prepare_account_deletion_data(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion_data(uuid,uuid) to service_role;

notify pgrst,'reload schema';
