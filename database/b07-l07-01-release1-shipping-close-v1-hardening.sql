-- DUELVANTA B07 / L07-01 Release-1 shipping owner authorization hardening.
-- Uses the existing role-based owner boundary used by the rest of Marketplace admin.

create or replace function public.get_owner_market_delivery_reviews_b07(p_status text default 'pending')
returns table(order_id uuid,order_number text,seller_id uuid,buyer_id uuid,carrier text,tracking_code text,shipped_at timestamptz,review_status text,requested_at timestamptz,reviewed_at timestamptz,review_note text,delivery_evidence_at timestamptz,closure_eligible_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not dv_market_private.is_market_owner_caller() then raise exception 'Owner-Zugriff erforderlich';end if;
  return query
  select o.id,o.order_number,o.seller_id,o.buyer_id,o.carrier,o.tracking_code,o.shipped_at,o.delivery_review_status,o.delivery_review_requested_at,o.delivery_reviewed_at,o.delivery_review_note,o.delivery_evidence_at,o.closure_eligible_at
  from public.market_orders o
  where o.fulfillment_group='shipping' and o.tracking_code is not null
    and (nullif(trim(coalesce(p_status,'')),'') is null or o.delivery_review_status=p_status)
  order by case when o.delivery_review_status='pending' then 0 else 1 end,o.delivery_review_requested_at nulls last,o.shipped_at desc;
end $$;
revoke all on function public.get_owner_market_delivery_reviews_b07(text) from public,anon;
grant execute on function public.get_owner_market_delivery_reviews_b07(text) to authenticated;

create or replace function public.review_market_order_delivery_b07(p_order_id uuid,p_decision text,p_delivered_at timestamptz default null,p_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dv_market_private
as $$
declare o public.market_orders;v_decision text:=lower(trim(coalesce(p_decision,'')));v_note text:=nullif(left(trim(coalesce(p_note,'')),1000),'');v_ref text:=nullif(left(trim(coalesce(p_reference,'')),160),'');v_at timestamptz:=coalesce(p_delivered_at,now());
begin
  if not dv_market_private.is_market_owner_caller() then raise exception 'Owner-Zugriff erforderlich';end if;
  if v_decision not in ('verify','reject') then raise exception 'Ungültige Entscheidung';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.delivery_review_status<>'pending' then raise exception 'Keine offene Zustellprüfung';end if;
  if o.tracking_code is null or o.shipped_at is null then raise exception 'Trackingdaten fehlen';end if;
  if v_decision='reject' then
    if v_note is null then raise exception 'Begründung bei Ablehnung erforderlich';end if;
    update public.market_orders set delivery_review_status='rejected',delivery_reviewed_at=now(),delivery_reviewed_by=auth.uid(),delivery_review_note=v_note,updated_at=now() where id=o.id;
    insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
    values(o.seller_id,'order_received','ZUSTELLPRÜFUNG NICHT BESTÄTIGT',o.order_number||' · '||v_note,o.id,'delivery_rejected_seller:'||o.id::text||':'||extract(epoch from now())::bigint::text)
    on conflict(dedupe_key) do nothing;
    return jsonb_build_object('status','rejected');
  end if;
  if p_delivered_at is null then raise exception 'Zustellzeitpunkt erforderlich';end if;
  if v_at<o.shipped_at or v_at>now()+interval '5 minutes' then raise exception 'delivery_evidence_time_invalid';end if;
  perform public.record_market_order_delivery_evidence_b07(o.id,v_at,'owner_carrier_verification',coalesce(v_ref,o.carrier||':'||o.tracking_code));
  update public.market_orders set delivery_review_status='verified',delivery_reviewed_at=now(),delivery_reviewed_by=auth.uid(),delivery_review_note=v_note,updated_at=now() where id=o.id;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(o.buyer_id,'order_received','ZUSTELLUNG VERIFIZIERT',o.order_number||' · Zustellung wurde anhand der Sendungsverfolgung geprüft. Ohne offenen Problemfall erfolgt der technische Abschluss nach 72 Stunden.',o.id,'delivery_verified_buyer:'||o.id::text)
  on conflict(dedupe_key) do nothing;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(o.seller_id,'order_received','ZUSTELLPRÜFUNG BESTÄTIGT',o.order_number||' · Die 72-Stunden-Frist läuft ab dem verifizierten Zustellzeitpunkt.',o.id,'delivery_verified_seller:'||o.id::text)
  on conflict(dedupe_key) do nothing;
  return jsonb_build_object('status','verified','delivered_at',v_at,'closure_eligible_at',v_at+interval '72 hours');
end $$;
revoke all on function public.review_market_order_delivery_b07(uuid,text,timestamptz,text,text) from public,anon;
grant execute on function public.review_market_order_delivery_b07(uuid,text,timestamptz,text,text) to authenticated;
