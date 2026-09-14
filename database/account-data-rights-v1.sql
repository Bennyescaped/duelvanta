-- DUELVANTA account data rights, retention and erasure workflow V1.
-- REVIEW ONLY: apply after the marketplace compliance migrations through
-- market-tax-transparency-v1.sql. Committing this file changes no live data.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

alter table public.profiles
  add column if not exists account_closure_requested_at timestamptz,
  add column if not exists data_processing_restricted_at timestamptz;

create table if not exists dv_market_private.data_retention_rules (
  category text primary key,
  purpose text not null,
  legal_basis text not null,
  retention_rule text not null,
  automatic_until_supported boolean not null default false,
  policy_version text not null,
  updated_at timestamptz not null default now()
);

insert into dv_market_private.data_retention_rules(
  category,purpose,legal_basis,retention_rule,automatic_until_supported,policy_version
) values
  ('account_profile','Kontoführung','Art. 6 Abs. 1 lit. b DSGVO','Bei Ausführung löschen oder anonymisieren.',true,'retention-v1-2026-09-13'),
  ('user_content','Collection, Profilbilder und nicht gebundene Marktdaten','Art. 6 Abs. 1 lit. b DSGVO','Bei Ausführung löschen; private Storage-Objekte zuerst serverseitig entfernen.',true,'retention-v1-2026-09-13'),
  ('contract_evidence','Vertragsnachweis und Rechtsverteidigung','Art. 6 Abs. 1 lit. c/f DSGVO','Gesperrt aufbewahren; Frist vor Löschung anhand Dokument und Anspruch manuell bestätigen.',false,'retention-v1-2026-09-13'),
  ('booking_document','Steuerlicher Buchungsbeleg','§ 147 AO; § 14b UStG','Acht Jahre ab Ende des maßgeblichen Kalenderjahres, soweit einschlägig.',true,'retention-v1-2026-09-13'),
  ('accounting_book','Buch oder Aufzeichnung mit Zehnjahresfrist','§ 147 AO','Zehn Jahre ab Ende des maßgeblichen Kalenderjahres, soweit einschlägig.',true,'retention-v1-2026-09-13'),
  ('payment_record','Zahlungs-, Erstattungs- und Gebührennachweis','Art. 6 Abs. 1 lit. b/c/f DSGVO; § 147 AO soweit einschlägig','Zugriffsbeschränkt und datenartspezifisch aufbewahren; steuerliche Einordnung vor Produktivstart bestätigen.',false,'retention-v1-2026-09-13'),
  ('psttg_record','PStTG-Aufzeichnung','§ 24 PStTG','Zehn Jahre ab Ende des Kalenderjahres der Aufzeichnung.',true,'retention-v1-2026-09-13'),
  ('notice_procedure','Meldungs-, Entscheidungs- und Einspruchsnachweis','Art. 16, 17 und gegebenenfalls 20 DSA; Rechtsverteidigung','Nach Abschluss gesperrt; konkrete Löschfrist vor Produktivstart rechtlich bestätigen.',false,'retention-v1-2026-09-13')
on conflict (category) do update set
  purpose=excluded.purpose,legal_basis=excluded.legal_basis,
  retention_rule=excluded.retention_rule,
  automatic_until_supported=excluded.automatic_until_supported,
  policy_version=excluded.policy_version,updated_at=now();

create table if not exists dv_market_private.user_data_export_events (
  id uuid primary key default gen_random_uuid(),
  user_id_hash bytea not null,
  export_format text not null check (export_format='application/json'),
  export_version text not null,
  content_sha256 bytea not null,
  generated_at timestamptz not null default now()
);

create table if not exists dv_market_private.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null,
  user_id uuid not null,
  status text not null default 'requested' check (status in (
    'requested','processing','retained','completed','failed','cancelled'
  )),
  policy_version text not null default 'retention-v1-2026-09-13',
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  lock_token uuid,
  locked_at timestamptz,
  storage_manifest jsonb not null default '[]'::jsonb,
  auth_action text check (auth_action in ('delete','disable_and_retain')),
  last_error text,
  unique(user_id,request_key)
);

create unique index if not exists account_deletion_one_open_request_idx
  on dv_market_private.account_deletion_requests(user_id)
  where status in ('requested','processing','retained');

create table if not exists dv_market_private.account_deletion_holds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references dv_market_private.account_deletion_requests(id) on delete restrict,
  user_id uuid not null,
  category text not null references dv_market_private.data_retention_rules(category) on delete restrict,
  reason text not null,
  retain_until timestamptz,
  manual_review_required boolean not null default false,
  released_at timestamptz,
  unique(request_id,category)
);

create table if not exists dv_market_private.account_data_rights_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  request_id uuid,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table dv_market_private.data_retention_rules enable row level security;
alter table dv_market_private.user_data_export_events enable row level security;
alter table dv_market_private.account_deletion_requests enable row level security;
alter table dv_market_private.account_deletion_holds enable row level security;
alter table dv_market_private.account_data_rights_audit enable row level security;
revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.block_data_rights_audit_mutation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'account_data_rights_audit_is_immutable'; end
$$;
revoke all on function dv_market_private.block_data_rights_audit_mutation() from public, anon, authenticated;
drop trigger if exists user_data_export_events_immutable on dv_market_private.user_data_export_events;
create trigger user_data_export_events_immutable before update or delete on dv_market_private.user_data_export_events
for each row execute function dv_market_private.block_data_rights_audit_mutation();
drop trigger if exists account_data_rights_audit_immutable on dv_market_private.account_data_rights_audit;
create trigger account_data_rights_audit_immutable before update or delete on dv_market_private.account_data_rights_audit
for each row execute function dv_market_private.block_data_rights_audit_mutation();

create or replace function dv_market_private.json_rows(p_sql text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  execute 'select coalesce(jsonb_agg(case when to_jsonb(x) ? ''row_data'' then to_jsonb(x)->''row_data'' else to_jsonb(x) end),''[]''::jsonb) from ('||p_sql||') x' into v_result;
  return coalesce(v_result,'[]'::jsonb);
end
$$;
revoke all on function dv_market_private.json_rows(text) from public, anon, authenticated;

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
    'export_version','duelvanta-data-export-v1','generated_at',now(),
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
      'my_appeals',dv_market_private.json_rows(format('select a.id,n.case_reference,a.appellant_kind,a.grounds,a.status,a.decision_reason,a.submitted_at,a.decided_at from dv_market_private.listing_notice_appeals a join dv_market_private.listing_notices n on n.id=a.notice_id where a.appellant_user_id=%L order by a.submitted_at,a.id',v_uid))
    ),
    'scope_note','Enthält eigene Daten und Vertragsdokumente. Fremde interne Kennungen, Zustellprotokolle und verschlüsselte Steuerwerte sind ausgeschlossen.'
  );
  insert into dv_market_private.user_data_export_events(user_id_hash,export_format,export_version,content_sha256)
  values(extensions.digest(v_uid::text,'sha256'),'application/json','duelvanta-data-export-v1',extensions.digest(v_payload::text,'sha256'));
  return v_payload;
end
$$;
revoke all on function public.export_my_duelvanta_data() from public, anon;
grant execute on function public.export_my_duelvanta_data() to authenticated;

create or replace function dv_market_private.account_deletion_blockers(p_uid uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,dv_market_private as $$
  select coalesce(jsonb_agg(blocker order by blocker),'[]'::jsonb) from (
    select 'owner_account_requires_manual_transfer' blocker where exists(
      select 1 from public.profiles where id=p_uid and role='owner'
    ) union all
    select 'active_market_listings' where exists(
      select 1 from public.market_listings where seller_id=p_uid and status in ('active','reserved')
    ) union all
    select 'open_market_offers' where exists(
      select 1 from public.market_offers where (seller_id=p_uid or buyer_id=p_uid) and status in ('pending','accepted')
    ) union all
    select 'open_market_orders' where exists(
      select 1 from public.market_orders where (seller_id=p_uid or buyer_id=p_uid)
      and status not in ('completed','cancelled')
    ) union all
    select 'open_market_cases' where exists(
      select 1 from public.market_order_cases c join public.market_orders o on o.id=c.order_id
      where (o.seller_id=p_uid or o.buyer_id=p_uid) and c.status not in ('resolved','closed','cancelled')
    ) union all
    select 'open_notice_appeals' where exists(
      select 1 from dv_market_private.listing_notice_appeals
      where appellant_user_id=p_uid and status in ('submitted','under_review')
    )
  ) b
$$;
revoke all on function dv_market_private.account_deletion_blockers(uuid) from public, anon, authenticated;

create or replace function public.request_my_account_deletion(p_confirmation text,p_request_key uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare v_uid uuid:=auth.uid();v_blockers jsonb;v_request uuid;v_manifest jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_request_key is null or p_confirmation<>'KONTO LÖSCHEN' then raise exception 'deletion_confirmation_invalid'; end if;
  select id into v_request from dv_market_private.account_deletion_requests
  where user_id=v_uid and request_key=p_request_key;
  if found then return jsonb_build_object('accepted',true,'request_id',v_request,'replayed',true); end if;
  select id into v_request from dv_market_private.account_deletion_requests
  where user_id=v_uid and status in ('requested','processing','retained') order by requested_at desc limit 1;
  if found then return jsonb_build_object('accepted',true,'request_id',v_request,'replayed',true); end if;
  v_blockers:=dv_market_private.account_deletion_blockers(v_uid);
  if jsonb_array_length(v_blockers)>0 then
    return jsonb_build_object('accepted',false,'blockers',v_blockers);
  end if;
  v_manifest:=jsonb_build_array();
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_manifest from (
    select jsonb_build_object('bucket','profile-avatars','path',avatar_path) x from public.profiles where id=v_uid and avatar_path is not null
    union all select jsonb_build_object('bucket','collection-cards','path',image_path) from public.collection_items where user_id=v_uid and image_path is not null
    union all select jsonb_build_object('bucket','market-listing-images','path',i.storage_path) from public.market_listing_images i where i.seller_id=v_uid
  ) paths;
  insert into dv_market_private.account_deletion_requests(user_id,request_key,storage_manifest)
  values(v_uid,p_request_key,v_manifest) returning id into v_request;
  update public.profiles set account_closure_requested_at=now(),data_processing_restricted_at=now(),
    safety_restricted=true,collection_visibility='private',updated_at=now() where id=v_uid;
  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
  values(v_uid,v_request,'deletion_requested',jsonb_build_object('storage_object_count',jsonb_array_length(v_manifest)));
  return jsonb_build_object('accepted',true,'request_id',v_request,'replayed',false);
end
$$;
revoke all on function public.request_my_account_deletion(text,uuid) from public, anon;
grant execute on function public.request_my_account_deletion(text,uuid) to authenticated;

create or replace function dv_market_private.block_restricted_account_mutation()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
  if current_user<>'service_role' and auth.uid() is not null and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.data_processing_restricted_at is not null
  ) then raise exception 'account_data_processing_restricted'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function dv_market_private.block_restricted_account_mutation() from public, anon, authenticated;

drop trigger if exists block_restricted_collection_items on public.collection_items;
create trigger block_restricted_collection_items before insert or update or delete on public.collection_items
for each row execute function dv_market_private.block_restricted_account_mutation();
drop trigger if exists block_restricted_collection_folders on public.collection_folders;
create trigger block_restricted_collection_folders before insert or update or delete on public.collection_folders
for each row execute function dv_market_private.block_restricted_account_mutation();
drop trigger if exists block_restricted_market_listings on public.market_listings;
create trigger block_restricted_market_listings before insert or update or delete on public.market_listings
for each row execute function dv_market_private.block_restricted_account_mutation();
drop trigger if exists block_restricted_market_offers on public.market_offers;
create trigger block_restricted_market_offers before insert or update or delete on public.market_offers
for each row execute function dv_market_private.block_restricted_account_mutation();

create or replace function public.claim_account_deletion_requests(p_limit integer,p_lock_token uuid)
returns table(request_id uuid,user_id uuid,storage_manifest jsonb,delivery_lock_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
begin
  if p_lock_token is null then raise exception 'lock_token_required'; end if;
  update dv_market_private.account_deletion_holds set released_at=now()
  where released_at is null and not manual_review_required and retain_until is not null and retain_until<=now();
  return query with claimed as (
    select r.id from dv_market_private.account_deletion_requests r
    where r.status in ('requested','failed')
      or (r.status='processing' and r.locked_at<now()-interval '15 minutes')
      or (r.status='retained' and not exists(
        select 1 from dv_market_private.account_deletion_holds h where h.request_id=r.id and h.released_at is null
      ))
    order by r.requested_at,r.id
    for update skip locked limit least(greatest(coalesce(p_limit,1),1),20)
  ), updated as (
    update dv_market_private.account_deletion_requests r set status='processing',lock_token=p_lock_token,
      locked_at=now(),processing_started_at=coalesce(processing_started_at,now())
    from claimed c where r.id=c.id returning r.*
  ) select u.id,u.user_id,u.storage_manifest,u.lock_token from updated u;
end
$$;
revoke all on function public.claim_account_deletion_requests(integer,uuid) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_requests(integer,uuid) to service_role;

create or replace function public.release_account_deletion_hold(p_hold_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare v_hold dv_market_private.account_deletion_holds%rowtype;
begin
  if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'hold_release_reason_required'; end if;
  update dv_market_private.account_deletion_holds set released_at=now()
  where id=p_hold_id and released_at is null returning * into v_hold;
  if not found then raise exception 'retention_hold_not_found'; end if;
  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
  values(v_hold.user_id,v_hold.request_id,'retention_hold_released',jsonb_build_object('category',v_hold.category,'reason',left(trim(p_reason),500)));
end
$$;
revoke all on function public.release_account_deletion_hold(uuid,text) from public, anon, authenticated;
grant execute on function public.release_account_deletion_hold(uuid,text) to service_role;

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
    delete from dv_market_private.seller_tax_identifiers where seller_id=v_request.user_id;
    delete from dv_market_private.seller_legal_profiles where seller_id=v_request.user_id;
  end if;
  update dv_market_private.account_deletion_requests set auth_action=case when v_has_holds then 'disable_and_retain' else 'delete' end
  where id=v_request.id;
  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
  values(v_request.user_id,v_request.id,'data_erasure_prepared',jsonb_build_object('retention_holds',v_has_holds));
  return jsonb_build_object('request_id',v_request.id,'user_id',v_request.user_id,
    'auth_action',case when v_has_holds then 'disable_and_retain' else 'delete' end,'has_retention_holds',v_has_holds);
end
$$;
revoke all on function public.prepare_account_deletion_data(uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion_data(uuid,uuid) to service_role;

create or replace function public.finish_account_deletion_request(
  p_request_id uuid,p_lock_token uuid,p_success boolean,p_error text default null
) returns void language plpgsql security definer
set search_path=pg_catalog,public,dv_market_private as $$
declare v_request dv_market_private.account_deletion_requests%rowtype;v_status text;
begin
  select * into v_request from dv_market_private.account_deletion_requests
  where id=p_request_id and status='processing' and lock_token=p_lock_token for update;
  if not found then raise exception 'deletion_request_lock_invalid'; end if;
  v_status:=case when not p_success then 'failed' when v_request.auth_action='disable_and_retain' then 'retained' else 'completed' end;
  update dv_market_private.account_deletion_requests set status=v_status,completed_at=case when p_success then now() else null end,
    last_error=case when p_success then null else left(coalesce(p_error,'worker_failed'),500) end,
    lock_token=null,locked_at=null where id=p_request_id;
  insert into dv_market_private.account_data_rights_audit(user_id,request_id,event_type,event_data)
  values(v_request.user_id,v_request.id,'deletion_worker_finished',jsonb_build_object('status',v_status));
end
$$;
revoke all on function public.finish_account_deletion_request(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.finish_account_deletion_request(uuid,uuid,boolean,text) to service_role;
