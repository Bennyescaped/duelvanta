-- DUELVANTA B07 / L07-01 private C2C swap flow: revisions + bilateral binding.
-- REVIEW/STAGING ONLY. Apply after b07-l07-01-c2c-swap-v1-schema.sql.
-- No payment, fee, wallet or PStTG/tax event is created.

create or replace function dv_market_private.create_market_swap_revision(
  p_thread_id uuid,
  p_proposed_by uuid,
  p_party_a_listing_ids uuid[],
  p_party_b_listing_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_revision_id uuid:=gen_random_uuid();
  v_revision_no integer;
  v_a_count integer;
  v_b_count integer;
  v_a_items jsonb;
  v_b_items jsonb;
  v_content jsonb;
  v_hash bytea;
  v_item jsonb;
begin
  select * into v_thread
  from dv_market_private.market_swap_threads
  where id=p_thread_id
  for update;
  if not found or v_thread.status<>'negotiating' then raise exception 'swap_not_negotiable';end if;
  if p_proposed_by not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if p_party_a_listing_ids is null or cardinality(p_party_a_listing_ids) not between 1 and 20
     or p_party_b_listing_ids is null or cardinality(p_party_b_listing_ids) not between 1 and 20 then
    raise exception 'swap_item_count_invalid';
  end if;
  if (select count(*) from unnest(p_party_a_listing_ids) x)<>(select count(distinct x) from unnest(p_party_a_listing_ids) x)
     or (select count(*) from unnest(p_party_b_listing_ids) x)<>(select count(distinct x) from unnest(p_party_b_listing_ids) x)
     or p_party_a_listing_ids && p_party_b_listing_ids then
    raise exception 'swap_duplicate_listing';
  end if;

  perform dv_market_private.require_private_c2c_user(v_thread.party_a_id);
  perform dv_market_private.require_private_c2c_user(v_thread.party_b_id);

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
    'listing_id',l.id,'owner_id',l.seller_id,'quantity',1,'listing_type',l.listing_type,
    'tcg',l.tcg,'card_name',l.card_name,'set_name',l.set_name,'card_number',l.card_number,
    'language',l.language,'variant',l.variant,'condition',l.condition,
    'grading_company',l.grading_company,'grade',l.grade,'asking_price',l.asking_price,
    'market_price_snapshot',l.market_price_snapshot,'published_at',l.published_at,'listing_updated_at',l.updated_at
  ) order by l.id),'[]'::jsonb)
  into v_a_count,v_a_items
  from public.market_listings l
  where l.id=any(p_party_a_listing_ids)
    and l.seller_id=v_thread.party_a_id
    and l.listing_type in ('trade','sale_or_trade')
    and l.status='active'
    and coalesce(l.quantity_available,0)>=1;

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
    'listing_id',l.id,'owner_id',l.seller_id,'quantity',1,'listing_type',l.listing_type,
    'tcg',l.tcg,'card_name',l.card_name,'set_name',l.set_name,'card_number',l.card_number,
    'language',l.language,'variant',l.variant,'condition',l.condition,
    'grading_company',l.grading_company,'grade',l.grade,'asking_price',l.asking_price,
    'market_price_snapshot',l.market_price_snapshot,'published_at',l.published_at,'listing_updated_at',l.updated_at
  ) order by l.id),'[]'::jsonb)
  into v_b_count,v_b_items
  from public.market_listings l
  where l.id=any(p_party_b_listing_ids)
    and l.seller_id=v_thread.party_b_id
    and l.listing_type in ('trade','sale_or_trade')
    and l.status='active'
    and coalesce(l.quantity_available,0)>=1;

  if v_a_count<>cardinality(p_party_a_listing_ids) or v_b_count<>cardinality(p_party_b_listing_ids) then
    raise exception 'swap_listing_unavailable_or_not_owned';
  end if;

  select coalesce(max(revision_no),0)+1 into v_revision_no
  from dv_market_private.market_swap_revisions where thread_id=v_thread.id;
  v_content:=jsonb_build_object(
    'schema_version','c2c-swap-revision-v1','thread_id',v_thread.id,
    'party_a_id',v_thread.party_a_id,'party_b_id',v_thread.party_b_id,
    'revision_no',v_revision_no,'party_a_items',v_a_items,'party_b_items',v_b_items
  );
  v_hash:=extensions.digest(pg_catalog.convert_to(v_content::text,'UTF8'),'sha256');

  insert into dv_market_private.market_swap_revisions(id,thread_id,revision_no,proposed_by,content_sha256)
  values(v_revision_id,v_thread.id,v_revision_no,p_proposed_by,v_hash);

  for v_item in select value from jsonb_array_elements(v_a_items) loop
    insert into dv_market_private.market_swap_revision_items(
      thread_id,revision_id,party_side,owner_id,listing_id,quantity,item_snapshot,
      reference_value_eur,reference_value_source,item_sha256
    ) values (
      v_thread.id,v_revision_id,'a',v_thread.party_a_id,(v_item->>'listing_id')::uuid,1,v_item,
      case when nullif(v_item->>'market_price_snapshot','') is null then null else round((v_item->>'market_price_snapshot')::numeric,2) end,
      case when nullif(v_item->>'market_price_snapshot','') is null then 'unavailable' else 'listing_market_price_snapshot' end,
      extensions.digest(pg_catalog.convert_to(v_item::text,'UTF8'),'sha256')
    );
  end loop;

  for v_item in select value from jsonb_array_elements(v_b_items) loop
    insert into dv_market_private.market_swap_revision_items(
      thread_id,revision_id,party_side,owner_id,listing_id,quantity,item_snapshot,
      reference_value_eur,reference_value_source,item_sha256
    ) values (
      v_thread.id,v_revision_id,'b',v_thread.party_b_id,(v_item->>'listing_id')::uuid,1,v_item,
      case when nullif(v_item->>'market_price_snapshot','') is null then null else round((v_item->>'market_price_snapshot')::numeric,2) end,
      case when nullif(v_item->>'market_price_snapshot','') is null then 'unavailable' else 'listing_market_price_snapshot' end,
      extensions.digest(pg_catalog.convert_to(v_item::text,'UTF8'),'sha256')
    );
  end loop;

  update dv_market_private.market_swap_threads
  set current_revision_id=v_revision_id,updated_at=now()
  where id=v_thread.id;
  return v_revision_id;
end
$$;
revoke all on function dv_market_private.create_market_swap_revision(uuid,uuid,uuid[],uuid[]) from public,anon,authenticated;

create or replace function public.create_market_swap_proposal_v1(
  p_target_listing_id uuid,
  p_offered_listing_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_target public.market_listings%rowtype;
  v_thread_id uuid;
  v_revision_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_target from public.market_listings where id=p_target_listing_id;
  if not found or v_target.seller_id=v_uid or v_target.status<>'active'
     or v_target.listing_type not in ('trade','sale_or_trade') or coalesce(v_target.quantity_available,0)<1 then
    raise exception 'swap_target_unavailable';
  end if;
  perform dv_market_private.require_private_c2c_user(v_uid);
  perform dv_market_private.require_private_c2c_user(v_target.seller_id);

  insert into dv_market_private.market_swap_threads(party_a_id,party_b_id)
  values(v_uid,v_target.seller_id) returning id into v_thread_id;
  v_revision_id:=dv_market_private.create_market_swap_revision(
    v_thread_id,v_uid,p_offered_listing_ids,array[p_target_listing_id]::uuid[]
  );
  return v_thread_id;
end
$$;
revoke all on function public.create_market_swap_proposal_v1(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.create_market_swap_proposal_v1(uuid,uuid[]) to authenticated;

create or replace function public.propose_market_swap_revision_v1(
  p_thread_id uuid,
  p_party_a_listing_ids uuid[],
  p_party_b_listing_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=p_thread_id;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if v_thread.status<>'negotiating' then raise exception 'swap_not_negotiable';end if;
  return dv_market_private.create_market_swap_revision(
    v_thread.id,v_uid,p_party_a_listing_ids,p_party_b_listing_ids
  );
end
$$;
revoke all on function public.propose_market_swap_revision_v1(uuid,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.propose_market_swap_revision_v1(uuid,uuid[],uuid[]) to authenticated;

create or replace function public.confirm_market_swap_revision_v1(
  p_thread_id uuid,
  p_revision_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_revision dv_market_private.market_swap_revisions%rowtype;
  v_confirmations integer;
  v_item record;
  v_bound_at timestamptz:=now();
  v_due_at timestamptz;
  v_owner uuid;
  v_receiver uuid;
  v_count integer;
  v_available_count integer;
  v_reference numeric(14,2);
  v_source jsonb;
  v_status text;
  v_source_hash bytea;
  v_address public.market_default_shipping_addresses%rowtype;
  v_address_json jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_thread
  from dv_market_private.market_swap_threads
  where id=p_thread_id for update;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if v_thread.status='bound' and v_thread.bound_revision_id=p_revision_id then
    return jsonb_build_object('state','bound','thread_id',v_thread.id,'revision_id',p_revision_id,
      'binding_at',v_thread.binding_at,'shipping_due_at',v_thread.shipping_due_at);
  end if;
  if v_thread.status<>'negotiating' or v_thread.current_revision_id<>p_revision_id then raise exception 'swap_revision_not_current';end if;

  select * into v_revision
  from dv_market_private.market_swap_revisions
  where id=p_revision_id and thread_id=v_thread.id;
  if not found then raise exception 'swap_revision_not_found';end if;
  perform dv_market_private.require_private_c2c_user(v_thread.party_a_id);
  perform dv_market_private.require_private_c2c_user(v_thread.party_b_id);

  insert into dv_market_private.market_swap_confirmations(revision_id,thread_id,user_id,content_sha256)
  values(v_revision.id,v_thread.id,v_uid,v_revision.content_sha256)
  on conflict(revision_id,user_id) do nothing;

  select count(*) into v_confirmations
  from dv_market_private.market_swap_confirmations
  where revision_id=v_revision.id
    and user_id in (v_thread.party_a_id,v_thread.party_b_id)
    and content_sha256=v_revision.content_sha256;
  if v_confirmations<2 then
    return jsonb_build_object('state','awaiting_other_confirmation','thread_id',v_thread.id,
      'revision_id',v_revision.id,'confirmation_count',v_confirmations);
  end if;

  -- Both confirmations point to this exact immutable revision. Reserve one unit
  -- from every item atomically; any unavailable item rolls back the second confirmation.
  for v_item in
    select ri.listing_id,ri.owner_id,ri.quantity,ri.item_snapshot,l.status,l.seller_id,l.listing_type,l.quantity_available,l.updated_at
    from dv_market_private.market_swap_revision_items ri
    join public.market_listings l on l.id=ri.listing_id
    where ri.revision_id=v_revision.id
    order by ri.listing_id
    for update of l
  loop
    if v_item.seller_id<>v_item.owner_id
       or v_item.listing_type not in ('trade','sale_or_trade')
       or v_item.status<>'active'
       or coalesce(v_item.quantity_available,0)<v_item.quantity
       or v_item.updated_at is distinct from (v_item.item_snapshot->>'listing_updated_at')::timestamptz then
      raise exception 'swap_listing_changed_before_binding';
    end if;
    update public.market_listings
    set quantity_available=quantity_available-v_item.quantity,
        status=case when quantity_available-v_item.quantity=0 then 'reserved' else status end,
        updated_at=now()
    where id=v_item.listing_id;
    insert into dv_market_private.market_swap_reservations(
      thread_id,revision_id,listing_id,owner_id,quantity,reserved_at
    ) values(v_thread.id,v_revision.id,v_item.listing_id,v_item.owner_id,v_item.quantity,v_bound_at);
  end loop;

  if (select count(*) from dv_market_private.market_swap_reservations where thread_id=v_thread.id)
     <> (select count(*) from dv_market_private.market_swap_revision_items where revision_id=v_revision.id) then
    raise exception 'swap_reservation_incomplete';
  end if;

  v_due_at:=dv_market_private.b07_add_workdays_de(v_bound_at,3);

  foreach v_owner in array array[v_thread.party_a_id,v_thread.party_b_id]::uuid[] loop
    v_receiver:=case when v_owner=v_thread.party_a_id then v_thread.party_b_id else v_thread.party_a_id end;
    select * into v_address from public.market_default_shipping_addresses where user_id=v_owner;
    if not found or v_address.country_code<>'DE' then raise exception 'swap_shipping_address_required';end if;
    v_address_json:=jsonb_build_object(
      'recipient_name',v_address.recipient_name,'street_line1',v_address.street_line1,
      'street_line2',v_address.street_line2,'postal_code',v_address.postal_code,
      'city',v_address.city,'country_code',v_address.country_code
    );
    insert into dv_market_private.market_swap_shipping_addresses(
      thread_id,user_id,recipient_name,street_line1,street_line2,postal_code,city,country_code,captured_at,content_sha256
    ) values(
      v_thread.id,v_owner,v_address.recipient_name,v_address.street_line1,v_address.street_line2,
      v_address.postal_code,v_address.city,'DE',v_bound_at,
      extensions.digest(pg_catalog.convert_to(v_address_json::text,'UTF8'),'sha256')
    );
    select count(*),count(reference_value_eur),
           case when count(*)=count(reference_value_eur) then round(sum(reference_value_eur*quantity),2) else null end,
           coalesce(jsonb_agg(jsonb_build_object(
             'listing_id',listing_id,'quantity',quantity,'reference_value_eur',reference_value_eur,
             'reference_value_source',reference_value_source,
             'item_sha256',encode(item_sha256,'hex')
           ) order by listing_id),'[]'::jsonb)
    into v_count,v_available_count,v_reference,v_source
    from dv_market_private.market_swap_revision_items
    where revision_id=v_revision.id and owner_id=v_owner;

    if v_count<1 then raise exception 'swap_side_empty_at_binding';end if;
    v_status:=case when v_count=v_available_count then 'reference_only_unapproved' else 'incomplete_reference' end;
    v_source_hash:=extensions.digest(pg_catalog.convert_to(v_source::text,'UTF8'),'sha256');

    insert into dv_market_private.market_swap_value_snapshots(
      thread_id,revision_id,owner_id,item_count,reference_value_eur,valuation_status,
      source_snapshot,source_snapshot_sha256,captured_at
    ) values(
      v_thread.id,v_revision.id,v_owner,v_count,v_reference,v_status,v_source,v_source_hash,v_bound_at
    );

    insert into dv_market_private.market_swap_fulfillments(
      thread_id,sender_id,receiver_id,shipping_due_at,goods_reference_value_eur,tracking_required
    ) values(
      v_thread.id,v_owner,v_receiver,v_due_at,v_reference,(v_reference is null or v_reference>25)
    );
  end loop;

  update dv_market_private.market_swap_threads
  set status='bound',bound_revision_id=v_revision.id,binding_at=v_bound_at,
      shipping_due_at=v_due_at,updated_at=v_bound_at
  where id=v_thread.id;

  -- Intentionally no tax-ledger write is performed here.
  -- PStTG/tax classification and reporting remain external-review category C.
  return jsonb_build_object('state','bound','thread_id',v_thread.id,'revision_id',v_revision.id,
    'binding_at',v_bound_at,'shipping_due_at',v_due_at,'confirmation_count',2);
end
$$;
revoke all on function public.confirm_market_swap_revision_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_market_swap_revision_v1(uuid,uuid) to authenticated;

create or replace function public.close_market_swap_thread_v1(
  p_thread_id uuid,
  p_action text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_action text:=lower(trim(coalesce(p_action,'')));
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  if v_action not in ('withdrawn','declined') then raise exception 'swap_close_action_invalid';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=p_thread_id for update;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if v_thread.status<>'negotiating' then raise exception 'bound_swap_cannot_be_unilaterally_closed';end if;
  update dv_market_private.market_swap_threads
  set status=v_action,closed_at=now(),closed_reason=v_action,updated_at=now()
  where id=v_thread.id;
end
$$;
revoke all on function public.close_market_swap_thread_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.close_market_swap_thread_v1(uuid,text) to authenticated;
