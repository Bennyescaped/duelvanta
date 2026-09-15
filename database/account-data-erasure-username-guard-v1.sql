-- DUELVANTA B02: permit username clearing only inside the locked service-role erasure RPC.
-- Apply after account-data-rights-v1.sql and the existing profile username guard.

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

  -- SECURITY DEFINER runs as the function owner, so the service-role caller boundary is enforced by EXECUTE ACL below.
  -- The existing trigger permits username mutation only while this transaction-local flag is allowed.
  -- The already-claimed request/lock pair above keeps the bypass inside the locked erasure path.
  perform set_config('duelvanta.username_rpc','allowed',true);
  update public.profiles set email='deleted-'||gen_random_uuid()::text||'@invalid.local',
    display_name='Gelöschtes Mitglied',username=null,avatar_path=null,collection_visibility='private',
    updated_at=now() where id=v_request.user_id;
  perform set_config('duelvanta.username_rpc','',true);

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
exception when others then
  perform set_config('duelvanta.username_rpc','',true);
  raise;
end
$$;
revoke all on function public.prepare_account_deletion_data(uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion_data(uuid,uuid) to service_role;
