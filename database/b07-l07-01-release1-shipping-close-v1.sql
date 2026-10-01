-- DUELVANTA B07 / L07-01 Release-1 shipping close model.
-- STAGING/PREVIEW activation first. No payment, payout, refund or fee execution.
-- Tracked: owner-verified carrier delivery + 72h. Untracked: not-received after 14d, auto-close after 40d.

alter table public.market_orders
  add column if not exists risk_tracking_required boolean not null default false,
  add column if not exists shipping_due_at timestamptz,
  add column if not exists delivery_review_status text not null default 'not_requested',
  add column if not exists delivery_review_requested_at timestamptz,
  add column if not exists delivery_review_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists delivery_reviewed_at timestamptz,
  add column if not exists delivery_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists delivery_review_note text,
  add column if not exists untracked_auto_close_at timestamptz;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='market_orders_delivery_review_status_check') then
    alter table public.market_orders add constraint market_orders_delivery_review_status_check
      check (delivery_review_status in ('not_requested','pending','verified','rejected'));
  end if;
end $$;

create index if not exists market_orders_delivery_review_pending_idx
  on public.market_orders(delivery_review_requested_at)
  where delivery_review_status='pending';
create index if not exists market_orders_untracked_auto_close_idx
  on public.market_orders(untracked_auto_close_at)
  where untracked_auto_close_at is not null and technical_completed_at is null and status in ('shipped','received');

create or replace function public.confirm_market_order_shipping(p_order_id uuid,p_shipping_method text,p_shipping_cost numeric,p_shipping_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.market_orders;v_country text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann Combined Shipping bestätigen'; end if;
  if o.shipped_at is not null or o.status in ('completed','cancelled','disputed') then raise exception 'Versand kann nicht mehr geändert werden'; end if;
  if o.fulfillment_group='pickup' then p_shipping_method:='pickup';p_shipping_cost:=0;end if;
  if p_shipping_method not in ('standard_letter','tracked_letter','parcel','pickup','custom') then raise exception 'Ungültige Versandart';end if;
  if p_shipping_cost is null or p_shipping_cost<0 or p_shipping_cost>500 then raise exception 'Ungültige Versandkosten';end if;
  if o.fulfillment_group='shipping' and p_shipping_method='pickup' then raise exception 'Abholung kann nicht mit Versandartikeln kombiniert werden';end if;
  if o.fulfillment_group='shipping' and (o.subtotal>25 or o.risk_tracking_required) and p_shipping_method not in ('tracked_letter','parcel') then raise exception 'tracking_required_for_order';end if;
  select a.country_code into v_country from public.market_order_shipping_addresses a where a.order_id=o.id;
  if o.fulfillment_group='shipping' and v_country is distinct from 'DE' then raise exception 'release1_germany_only';end if;
  update public.market_orders set shipping_method=p_shipping_method,shipping_cost=round(p_shipping_cost,2),shipping_note=nullif(left(trim(coalesce(p_shipping_note,'')),240),''),shipping_quote_status='confirmed',shipping_profile_id=null,shipping_profile_rule_id=null,shipping_quote_country_code=v_country,total_amount=round(subtotal+p_shipping_cost,2),shipping_savings=round(separate_shipping_sum-p_shipping_cost,2),updated_at=now() where id=o.id;
end $$;
revoke all on function public.confirm_market_order_shipping(uuid,text,numeric,text) from public,anon;
grant execute on function public.confirm_market_order_shipping(uuid,text,numeric,text) to authenticated;

create or replace function public.mark_market_order_shipped(p_order_id uuid,p_carrier text default null,p_tracking_code text default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.market_orders;v_track boolean;v_carrier text;v_code text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann den Versand bestätigen';end if;
  if o.fulfillment_group='pickup' then raise exception 'pickup_requires_handover_code';end if;
  if o.status not in ('open','in_progress') then raise exception 'Order kann nicht versendet werden';end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='cancellation' and c.status in ('open','accepted_refund_pending')) then raise exception 'Stornoanfrage ist noch offen';end if;
  if o.shipping_quote_status='review_required' then raise exception 'Combined Shipping muss zuerst bestätigt werden';end if;
  if o.payment_status not in ('not_required','paid') or (o.payment_provider<>'manual_beta' and o.payment_status<>'paid') then raise exception 'Versand erst nach vollständiger Zahlung';end if;
  if not exists(select 1 from public.market_order_shipping_addresses a where a.order_id=o.id and a.country_code='DE') then raise exception 'Deutsche Lieferadresse fehlt';end if;
  v_track:=o.subtotal>25 or o.risk_tracking_required;v_carrier:=nullif(left(trim(coalesce(p_carrier,'')),80),'');v_code:=nullif(left(trim(coalesce(p_tracking_code,'')),160),'');
  if v_track and (o.shipping_method not in ('tracked_letter','parcel') or v_carrier is null or v_code is null) then raise exception 'tracking_required_for_order';end if;
  update public.market_orders set status='shipped',carrier=v_carrier,tracking_code=v_code,shipped_at=coalesce(shipped_at,now()),updated_at=now() where id=o.id;
  update public.market_deals d set status=case when d.status='accepted' then 'in_progress' else d.status end,fulfillment_status='shipped',carrier=v_carrier,tracking_code=v_code,shipped_at=coalesce(d.shipped_at,now()),updated_at=now() where d.order_id=o.id and d.status not in ('cancelled','completed','disputed');
end $$;
revoke all on function public.mark_market_order_shipped(uuid,text,text) from public,anon;
grant execute on function public.mark_market_order_shipped(uuid,text,text) to authenticated;

create or replace function dv_market_private.b07_release1_shipping_windows()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
begin
  if new.fulfillment_group='shipping' and new.shipped_at is not null then
    if nullif(trim(coalesce(new.tracking_code,'')),'') is null then
      new.untracked_auto_close_at:=new.shipped_at+interval '40 days';new.closure_eligible_at:=new.untracked_auto_close_at;new.delivery_review_status:='not_requested';
    elsif new.delivery_evidence_at is null then
      new.untracked_auto_close_at:=null;
      if old.shipped_at is null or old.tracking_code is distinct from new.tracking_code then new.closure_eligible_at:=null;end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function dv_market_private.b07_release1_shipping_windows() from public,anon,authenticated;
drop trigger if exists b07_release1_shipping_windows on public.market_orders;
create trigger b07_release1_shipping_windows before update of shipped_at,tracking_code on public.market_orders for each row execute function dv_market_private.b07_release1_shipping_windows();

update public.market_orders set untracked_auto_close_at=shipped_at+interval '40 days',closure_eligible_at=shipped_at+interval '40 days'
where fulfillment_group='shipping' and shipped_at is not null and nullif(trim(coalesce(tracking_code,'')),'') is null and status in ('shipped','received') and technical_completed_at is null;

create or replace function public.request_market_order_delivery_review_b07(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.market_orders;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann eine Zustellprüfung anfordern'; end if;
  if o.fulfillment_group<>'shipping' or o.status not in ('shipped','received') or o.shipped_at is null then raise exception 'delivery_review_not_applicable';end if;
  if nullif(trim(coalesce(o.tracking_code,'')),'') is null then raise exception 'delivery_review_requires_tracking'; end if;
  if o.delivery_evidence_at is not null or o.delivery_review_status='verified' then return jsonb_build_object('status','verified','requested_at',o.delivery_review_requested_at,'reviewed_at',o.delivery_reviewed_at);end if;
  if o.delivery_review_status='pending' then return jsonb_build_object('status','pending','requested_at',o.delivery_review_requested_at);end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open') then raise exception 'Ein Problemfall ist bereits offen';end if;
  update public.market_orders set delivery_review_status='pending',delivery_review_requested_at=now(),delivery_review_requested_by=auth.uid(),delivery_reviewed_at=null,delivery_reviewed_by=null,delivery_review_note=null,updated_at=now() where id=o.id;
  return jsonb_build_object('status','pending','requested_at',now());
end $$;
revoke all on function public.request_market_order_delivery_review_b07(uuid) from public,anon;
grant execute on function public.request_market_order_delivery_review_b07(uuid) to authenticated;

create or replace function public.get_owner_market_delivery_reviews_b07(p_status text default 'pending')
returns table(order_id uuid,order_number text,seller_id uuid,buyer_id uuid,carrier text,tracking_code text,shipped_at timestamptz,review_status text,requested_at timestamptz,reviewed_at timestamptz,review_note text,delivery_evidence_at timestamptz,closure_eligible_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_duelvanta_owner(auth.uid()) then raise exception 'Owner-Zugriff erforderlich';end if;
  return query select o.id,o.order_number,o.seller_id,o.buyer_id,o.carrier,o.tracking_code,o.shipped_at,o.delivery_review_status,o.delivery_review_requested_at,o.delivery_reviewed_at,o.delivery_review_note,o.delivery_evidence_at,o.closure_eligible_at from public.market_orders o where o.fulfillment_group='shipping' and o.tracking_code is not null and (nullif(trim(coalesce(p_status,'')),'') is null or o.delivery_review_status=p_status) order by case when o.delivery_review_status='pending' then 0 else 1 end,o.delivery_review_requested_at nulls last,o.shipped_at desc;
end $$;
revoke all on function public.get_owner_market_delivery_reviews_b07(text) from public,anon;
grant execute on function public.get_owner_market_delivery_reviews_b07(text) to authenticated;

create or replace function public.review_market_order_delivery_b07(p_order_id uuid,p_decision text,p_delivered_at timestamptz default null,p_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
declare o public.market_orders;v_decision text:=lower(trim(coalesce(p_decision,'')));v_note text:=nullif(left(trim(coalesce(p_note,'')),1000),'');v_ref text:=nullif(left(trim(coalesce(p_reference,'')),160),'');v_at timestamptz:=coalesce(p_delivered_at,now());
begin
  if auth.uid() is null or not public.is_duelvanta_owner(auth.uid()) then raise exception 'Owner-Zugriff erforderlich';end if;
  if v_decision not in ('verify','reject') then raise exception 'Ungültige Entscheidung';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.delivery_review_status<>'pending' then raise exception 'Keine offene Zustellprüfung';end if;
  if o.tracking_code is null or o.shipped_at is null then raise exception 'Trackingdaten fehlen';end if;
  if v_decision='reject' then
    if v_note is null then raise exception 'Begründung bei Ablehnung erforderlich';end if;
    update public.market_orders set delivery_review_status='rejected',delivery_reviewed_at=now(),delivery_reviewed_by=auth.uid(),delivery_review_note=v_note,updated_at=now() where id=o.id;
    insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key) values(o.seller_id,'order_received','ZUSTELLPRÜFUNG NICHT BESTÄTIGT',o.order_number||' · '||v_note,o.id,'delivery_rejected_seller:'||o.id::text||':'||extract(epoch from now())::bigint::text) on conflict(dedupe_key) do nothing;
    return jsonb_build_object('status','rejected');
  end if;
  if p_delivered_at is null then raise exception 'Zustellzeitpunkt erforderlich';end if;
  if v_at<o.shipped_at or v_at>now()+interval '5 minutes' then raise exception 'delivery_evidence_time_invalid';end if;
  perform public.record_market_order_delivery_evidence_b07(o.id,v_at,'owner_carrier_verification',coalesce(v_ref,o.carrier||':'||o.tracking_code));
  update public.market_orders set delivery_review_status='verified',delivery_reviewed_at=now(),delivery_reviewed_by=auth.uid(),delivery_review_note=v_note,updated_at=now() where id=o.id;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key) values(o.buyer_id,'order_received','ZUSTELLUNG VERIFIZIERT',o.order_number||' · Zustellung wurde anhand der Sendungsverfolgung geprüft. Ohne offenen Problemfall erfolgt der technische Abschluss nach 72 Stunden.',o.id,'delivery_verified_buyer:'||o.id::text) on conflict(dedupe_key) do nothing;
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key) values(o.seller_id,'order_received','ZUSTELLPRÜFUNG BESTÄTIGT',o.order_number||' · Die 72-Stunden-Frist läuft ab dem verifizierten Zustellzeitpunkt.',o.id,'delivery_verified_seller:'||o.id::text) on conflict(dedupe_key) do nothing;
  return jsonb_build_object('status','verified','delivered_at',v_at,'closure_eligible_at',v_at+interval '72 hours');
end $$;
revoke all on function public.review_market_order_delivery_b07(uuid,text,timestamptz,text,text) from public,anon;
grant execute on function public.review_market_order_delivery_b07(uuid,text,timestamptz,text,text) to authenticated;

create or replace function public.get_my_market_order_b07_status()
returns table(order_id uuid,fulfillment_group text,status text,tracking_required boolean,has_tracking boolean,shipping_due_at timestamptz,delivery_evidence_at timestamptz,closure_eligible_at timestamptz,buyer_received_ok_at timestamptz,technical_completed_at timestamptz,technical_completion_reason text,delivery_review_status text,delivery_review_requested_at timestamptz,not_received_available_at timestamptz,untracked_auto_close_at timestamptz,is_seller boolean,pickup_code_pending boolean,pickup_code_expires_at timestamptz,active_case_due_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  return query select o.id,o.fulfillment_group,o.status,(o.subtotal>25 or o.risk_tracking_required),(nullif(trim(coalesce(o.tracking_code,'')),'') is not null),o.shipping_due_at,o.delivery_evidence_at,o.closure_eligible_at,o.buyer_received_ok_at,o.technical_completed_at,o.technical_completion_reason,o.delivery_review_status,o.delivery_review_requested_at,case when o.shipped_at is not null and nullif(trim(coalesce(o.tracking_code,'')),'') is null then o.shipped_at+interval '14 days' else null end,o.untracked_auto_close_at,(auth.uid()=o.seller_id),false,null::timestamptz,null::timestamptz from public.market_orders o where auth.uid() in (o.seller_id,o.buyer_id) order by o.created_at desc;
end $$;
revoke all on function public.get_my_market_order_b07_status() from public,anon;
grant execute on function public.get_my_market_order_b07_status() to authenticated;

create or replace function public.advance_market_order_lifecycle_b07()
returns integer language plpgsql security definer set search_path=pg_catalog,public,dv_market_private as $$
declare r record;v_count integer:=0;
begin
  for r in select o.id,case when o.delivery_evidence_at is not null and o.tracking_code is not null then 'carrier_delivery_72h_elapsed' else 'untracked_shipping_40d_elapsed' end as reason from public.market_orders o where o.status in ('shipped','received') and o.closure_eligible_at is not null and o.closure_eligible_at<=now() and o.technical_completed_at is null and ((o.delivery_evidence_at is not null and o.tracking_code is not null) or (o.delivery_evidence_at is null and nullif(trim(coalesce(o.tracking_code,'')),'') is null and o.shipped_at is not null and o.shipped_at<=now()-interval '40 days')) and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open') order by o.closure_eligible_at for update of o skip locked
  loop perform dv_market_private.b07_tracking_complete_order(r.id,r.reason,now());v_count:=v_count+1;end loop;
  return v_count;
end $$;
revoke all on function public.advance_market_order_lifecycle_b07() from public,anon,authenticated;
grant execute on function public.advance_market_order_lifecycle_b07() to service_role;

create or replace function public.open_market_order_problem_v2(p_order_id uuid,p_category text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.market_orders;v_reason text;v_cat text;v_case uuid;v_other uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');v_cat:=lower(trim(coalesce(p_category,'other')));
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Problem beschreiben';end if;
  if v_cat not in ('shipping','not_received','damaged','not_as_described','payment','other') then raise exception 'Ungültige Problemkategorie';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt';end if;
  if o.shipped_at is null or o.status not in ('shipped','received') then raise exception 'Vor Versand bitte eine Stornoanfrage verwenden';end if;
  if v_cat='not_received' and auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann Nicht erhalten melden';end if;
  if v_cat='not_received' and nullif(trim(coalesce(o.tracking_code,'')),'') is null and now()<o.shipped_at+interval '14 days' then raise exception 'untracked_not_received_available_after_14_days';end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and case_type='problem' and status='open') then raise exception 'Für diese Order ist bereits ein Problem offen';end if;
  v_other:=case when auth.uid()=o.seller_id then o.buyer_id else o.seller_id end;
  insert into public.market_order_cases(order_id,case_type,status,category,reason,opened_by,refund_state,refund_amount) values(o.id,'problem','open',v_cat,v_reason,auth.uid(),case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then 'provider_required' else 'not_required' end,case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then o.total_amount else null end) returning id into v_case;
  update public.market_orders set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,refund_status=case when payment_provider<>'manual_beta' and paid_amount>0 then 'provider_required' else refund_status end,refund_amount=case when payment_provider<>'manual_beta' and paid_amount>0 then total_amount else refund_amount end,updated_at=now() where id=o.id;
  update public.market_deals set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,payout_status=case when payment_provider='stripe_connect' then 'blocked' else payout_status end,updated_at=now() where order_id=o.id and status not in ('cancelled','completed');
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key) values(v_other,'problem_opened','PROBLEM GEMELDET',o.order_number||' · '||left(v_reason,220),o.id,'problem_opened:'||v_case::text) on conflict(dedupe_key) do nothing;
  return v_case;
end $$;
revoke all on function public.open_market_order_problem_v2(uuid,text,text) from public,anon;
grant execute on function public.open_market_order_problem_v2(uuid,text,text) to authenticated;
