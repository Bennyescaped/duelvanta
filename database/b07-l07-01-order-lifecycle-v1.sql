-- DUELVANTA B07 / L07-01 safe order lifecycle alignment.
-- REVIEW/STAGING MIGRATION ONLY. Do not apply to production from this branch.
-- Technical completion only: this migration does NOT execute or release payments,
-- payouts, refunds, seller cancellation fees or provider holds.

alter table public.market_orders
  add column if not exists shipping_due_at timestamptz,
  add column if not exists risk_tracking_required boolean not null default false,
  add column if not exists delivery_evidence_at timestamptz,
  add column if not exists delivery_evidence_source text,
  add column if not exists delivery_evidence_ref text,
  add column if not exists closure_eligible_at timestamptz,
  add column if not exists buyer_received_ok_at timestamptz,
  add column if not exists technical_completed_at timestamptz,
  add column if not exists technical_completion_reason text,
  add column if not exists pickup_handover_completed_at timestamptz;

alter table public.market_order_cases
  add column if not exists response_due_at timestamptz,
  add column if not exists evidence_due_at timestamptz;

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.market_pickup_handovers (
  order_id uuid primary key references public.market_orders(id) on delete cascade,
  code_hash bytea not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  seller_confirmed_at timestamptz not null,
  buyer_confirmed_at timestamptz,
  consumed_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count>=0),
  updated_at timestamptz not null default now()
);
revoke all on table dv_market_private.market_pickup_handovers from public, anon, authenticated;

create or replace function dv_market_private.b07_add_workdays_de(
  p_start timestamptz,
  p_days integer
) returns timestamptz
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  v_local timestamp without time zone := p_start at time zone 'Europe/Berlin';
  v_count integer := 0;
begin
  if p_start is null or p_days is null or p_days<0 then return null; end if;
  while v_count<p_days loop
    v_local:=v_local+interval '1 day';
    -- L07-01 uses Werktage: Monday-Saturday; Sunday is excluded.
    if extract(isodow from v_local)<7 then v_count:=v_count+1; end if;
  end loop;
  return v_local at time zone 'Europe/Berlin';
end
$$;
revoke all on function dv_market_private.b07_add_workdays_de(timestamptz,integer) from public,anon,authenticated;

create or replace function dv_market_private.b07_set_shipping_due()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
begin
  if new.fulfillment_group='shipping'
     and new.payment_status='paid'
     and old.payment_status is distinct from 'paid'
     and new.shipping_due_at is null then
    new.shipping_due_at:=dv_market_private.b07_add_workdays_de(now(),3);
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.b07_set_shipping_due() from public,anon,authenticated;
drop trigger if exists b07_set_shipping_due on public.market_orders;
create trigger b07_set_shipping_due
before update of payment_status on public.market_orders
for each row execute function dv_market_private.b07_set_shipping_due();

create or replace function dv_market_private.b07_complete_order(
  p_order_id uuid,
  p_reason text,
  p_completed_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare o public.market_orders;
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if not found then raise exception 'Order nicht gefunden'; end if;
  if o.status='completed' then return; end if;
  if o.status in ('cancelled','disputed') then raise exception 'Order kann mit offenem Vorgang nicht abgeschlossen werden'; end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open') then
    raise exception 'Ein Problemfall ist noch offen';
  end if;

  update public.market_orders set
    status='completed',
    received_at=coalesce(received_at,delivery_evidence_at,p_completed_at),
    completed_at=coalesce(completed_at,p_completed_at),
    technical_completed_at=coalesce(technical_completed_at,p_completed_at),
    technical_completion_reason=coalesce(technical_completion_reason,left(p_reason,80)),
    updated_at=now()
  where id=o.id;

  update public.market_deals set
    status='completed',
    fulfillment_status='received',
    received_at=coalesce(received_at,o.delivery_evidence_at,p_completed_at),
    seller_confirmed_at=coalesce(seller_confirmed_at,o.shipped_at),
    completed_at=coalesce(completed_at,p_completed_at),
    updated_at=now()
  where order_id=o.id and status in ('accepted','in_progress');

  update public.market_listings l set
    status='sold',ended_at=coalesce(l.ended_at,p_completed_at),updated_at=now()
  where l.status='reserved' and l.quantity_available=0
    and exists(select 1 from public.market_deals d where d.order_id=o.id and d.listing_id=l.id and d.status='completed')
    and not exists(select 1 from public.market_deals d where d.listing_id=l.id and d.status not in ('completed','cancelled'));

  update public.market_offers mo set completed_at=coalesce(completed_at,p_completed_at),updated_at=now()
  where mo.status='accepted'
    and exists(select 1 from public.market_deals d where d.order_id=o.id and d.offer_id=mo.id and d.status='completed');
end
$$;
revoke all on function dv_market_private.b07_complete_order(uuid,text,timestamptz) from public,anon,authenticated;

-- Seller shipping quote: >25 EUR goods value must use a known tracked method.
create or replace function public.confirm_market_order_shipping(
  p_order_id uuid,
  p_shipping_method text,
  p_shipping_cost numeric,
  p_shipping_note text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
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
  if o.fulfillment_group='shipping' and (o.subtotal>25 or o.risk_tracking_required)
     and p_shipping_method not in ('tracked_letter','parcel') then
    raise exception 'tracking_required_for_order';
  end if;
  select a.country_code into v_country from public.market_order_shipping_addresses a where a.order_id=o.id;
  if o.fulfillment_group='shipping' and v_country is distinct from 'DE' then raise exception 'release1_germany_only';end if;
  update public.market_orders set
    shipping_method=p_shipping_method,shipping_cost=round(p_shipping_cost,2),
    shipping_note=nullif(left(trim(coalesce(p_shipping_note,'')),240),''),shipping_quote_status='confirmed',
    shipping_profile_id=null,shipping_profile_rule_id=null,shipping_quote_country_code=v_country,
    total_amount=round(subtotal+p_shipping_cost,2),shipping_savings=round(separate_shipping_sum-p_shipping_cost,2),updated_at=now()
  where id=o.id;
end
$$;
revoke all on function public.confirm_market_order_shipping(uuid,text,numeric,text) from public,anon;
grant execute on function public.confirm_market_order_shipping(uuid,text,numeric,text) to authenticated;

-- Pickup is deliberately excluded: pickup requires the bilateral one-time handover code below.
create or replace function public.mark_market_order_shipped(
  p_order_id uuid,
  p_carrier text default null,
  p_tracking_code text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
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
  v_track:=o.subtotal>25 or o.risk_tracking_required;
  v_carrier:=nullif(left(trim(coalesce(p_carrier,'')),80),'');
  v_code:=nullif(left(trim(coalesce(p_tracking_code,'')),160),'');
  if v_track and (o.shipping_method not in ('tracked_letter','parcel') or v_carrier is null or v_code is null) then
    raise exception 'tracking_required_for_order';
  end if;
  update public.market_orders set status='shipped',carrier=v_carrier,tracking_code=v_code,shipped_at=coalesce(shipped_at,now()),updated_at=now() where id=o.id;
  update public.market_deals d set
    status=case when d.status='accepted' then 'in_progress' else d.status end,
    fulfillment_status='shipped',carrier=v_carrier,tracking_code=v_code,shipped_at=coalesce(d.shipped_at,now()),updated_at=now()
  where d.order_id=o.id and d.status not in ('cancelled','completed','disputed');
end
$$;
revoke all on function public.mark_market_order_shipped(uuid,text,text) from public,anon;
grant execute on function public.mark_market_order_shipped(uuid,text,text) to authenticated;

-- Carrier/server-only delivery evidence starts the technical 72-hour window.
create or replace function public.record_market_order_delivery_evidence_b07(
  p_order_id uuid,
  p_delivered_at timestamptz,
  p_source text,
  p_reference text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;v_at timestamptz:=coalesce(p_delivered_at,now());
begin
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or o.fulfillment_group<>'shipping' or o.status not in ('shipped','received') then raise exception 'delivery_evidence_not_applicable';end if;
  if o.tracking_code is null then raise exception 'delivery_evidence_requires_tracking';end if;
  if v_at<o.shipped_at or v_at>now()+interval '5 minutes' then raise exception 'delivery_evidence_time_invalid';end if;
  if nullif(trim(coalesce(p_source,'')),'') is null then raise exception 'delivery_evidence_source_required';end if;
  update public.market_orders set
    status=case when status='shipped' then 'received' else status end,
    delivery_evidence_at=coalesce(delivery_evidence_at,v_at),
    delivery_evidence_source=coalesce(delivery_evidence_source,left(trim(p_source),80)),
    delivery_evidence_ref=coalesce(delivery_evidence_ref,nullif(left(trim(coalesce(p_reference,'')),160),'')),
    closure_eligible_at=coalesce(closure_eligible_at,v_at+interval '72 hours'),
    received_at=coalesce(received_at,v_at),updated_at=now()
  where id=o.id;
end
$$;
revoke all on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text) to service_role;

-- Buyer early confirmation: explicit "Erhalten – alles in Ordnung" closes technically at once.
create or replace function public.confirm_market_order_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare o public.market_orders;v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann den Erhalt bestätigen';end if;
  if o.fulfillment_group<>'shipping' then raise exception 'pickup_requires_handover_code';end if;
  if o.status='completed' then return;end if;
  if o.status not in ('shipped','received') or o.shipped_at is null then raise exception 'Order ist noch nicht als versendet markiert';end if;
  if o.payment_status not in ('not_required','paid') or (o.payment_provider<>'manual_beta' and o.payment_status<>'paid') then raise exception 'Zahlung ist noch offen';end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open') then raise exception 'Ein Problem ist noch offen';end if;
  update public.market_orders set buyer_received_ok_at=coalesce(buyer_received_ok_at,v_now),buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),received_at=coalesce(received_at,v_now),updated_at=now() where id=o.id;
  update public.market_deals set buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),received_at=coalesce(received_at,v_now),updated_at=now() where order_id=o.id and status in ('accepted','in_progress');
  perform dv_market_private.b07_complete_order(o.id,'buyer_received_ok',v_now);
end
$$;
revoke all on function public.confirm_market_order_received(uuid) from public,anon;
grant execute on function public.confirm_market_order_received(uuid) to authenticated;

create or replace function public.confirm_market_order_complete(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare o public.market_orders;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select * into o from public.market_orders where id=p_order_id;
  if not found or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt';end if;
  if o.status in ('completed','cancelled','disputed') then return o.status;end if;
  if auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann "Erhalten – alles in Ordnung" bestätigen';end if;
  perform public.confirm_market_order_received(p_order_id);
  return 'completed';
end
$$;
revoke all on function public.confirm_market_order_complete(uuid) from public,anon;
grant execute on function public.confirm_market_order_complete(uuid) to authenticated;

-- Server job entrypoint: technical completion after 72h proven delivery and no problem case.
create or replace function public.advance_market_order_lifecycle_b07()
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare r record;v_count integer:=0;
begin
  for r in
    select o.id,o.closure_eligible_at
    from public.market_orders o
    where o.fulfillment_group='shipping'
      and o.status in ('shipped','received')
      and o.delivery_evidence_at is not null
      and o.closure_eligible_at is not null
      and o.closure_eligible_at<=now()
      and not exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.case_type='problem' and c.status='open')
    order by o.closure_eligible_at,o.id
    for update skip locked
  loop
    perform dv_market_private.b07_complete_order(r.id,'delivery_72h_elapsed',r.closure_eligible_at);
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;
revoke all on function public.advance_market_order_lifecycle_b07() from public,anon,authenticated;
grant execute on function public.advance_market_order_lifecycle_b07() to service_role;

-- Personal pickup: seller confirmation generates a single-use handover code.
create or replace function public.create_market_pickup_handover_code_b07(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare o public.market_orders;v_code text;v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid()<>o.seller_id then raise exception 'Nur der Verkäufer kann den Übergabecode erzeugen';end if;
  if o.fulfillment_group<>'pickup' or o.status not in ('open','in_progress') then raise exception 'pickup_not_available';end if;
  if o.payment_status not in ('not_required','paid') or (o.payment_provider<>'manual_beta' and o.payment_status<>'paid') then raise exception 'Übergabe erst nach vollständiger Zahlung';end if;
  if exists(select 1 from public.market_order_cases c where c.order_id=o.id and c.status in ('open','accepted_refund_pending')) then raise exception 'Offener Vorgang blockiert die Übergabe';end if;
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into dv_market_private.market_pickup_handovers(order_id,code_hash,generated_at,expires_at,seller_confirmed_at,buyer_confirmed_at,consumed_at,attempt_count,updated_at)
  values(o.id,digest(convert_to(v_code,'UTF8'),'sha256'),v_now,v_now+interval '2 hours',v_now,null,null,0,v_now)
  on conflict(order_id) do update set code_hash=excluded.code_hash,generated_at=v_now,expires_at=v_now+interval '2 hours',seller_confirmed_at=v_now,buyer_confirmed_at=null,consumed_at=null,attempt_count=0,updated_at=v_now;
  update public.market_orders set status='in_progress',seller_confirmed_at=coalesce(seller_confirmed_at,v_now),updated_at=now() where id=o.id;
  return jsonb_build_object('order_id',o.id,'handover_code',v_code,'expires_at',v_now+interval '2 hours');
end
$$;
revoke all on function public.create_market_pickup_handover_code_b07(uuid) from public,anon;
grant execute on function public.create_market_pickup_handover_code_b07(uuid) to authenticated;

create or replace function public.confirm_market_pickup_handover_b07(p_order_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private,extensions
as $$
declare o public.market_orders;h dv_market_private.market_pickup_handovers;v_now timestamptz:=now();v_code text:=upper(trim(coalesce(p_code,'')));
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Nur der Käufer kann die Übergabe abschließen';end if;
  if o.fulfillment_group<>'pickup' or o.status not in ('open','in_progress') then raise exception 'pickup_not_available';end if;
  select * into h from dv_market_private.market_pickup_handovers where order_id=o.id for update;
  if not found or h.consumed_at is not null or h.expires_at<=v_now then raise exception 'pickup_code_expired';end if;
  if digest(convert_to(v_code,'UTF8'),'sha256')<>h.code_hash then
    update dv_market_private.market_pickup_handovers set attempt_count=attempt_count+1,last_attempt_at=v_now,updated_at=v_now where order_id=o.id;
    return jsonb_build_object('ok',false,'error','pickup_code_invalid');
  end if;
  update dv_market_private.market_pickup_handovers set buyer_confirmed_at=v_now,consumed_at=v_now,last_attempt_at=v_now,attempt_count=attempt_count+1,updated_at=v_now where order_id=o.id;
  update public.market_orders set buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),buyer_received_ok_at=coalesce(buyer_received_ok_at,v_now),pickup_handover_completed_at=v_now,received_at=coalesce(received_at,v_now),updated_at=now() where id=o.id;
  update public.market_deals set buyer_confirmed_at=coalesce(buyer_confirmed_at,v_now),seller_confirmed_at=coalesce(seller_confirmed_at,h.seller_confirmed_at),received_at=coalesce(received_at,v_now),updated_at=now() where order_id=o.id and status in ('accepted','in_progress');
  perform dv_market_private.b07_complete_order(o.id,'pickup_bilateral_handover',v_now);
  return jsonb_build_object('ok',true,'completed_at',v_now);
end
$$;
revoke all on function public.confirm_market_pickup_handover_b07(uuid,text) from public,anon;
grant execute on function public.confirm_market_pickup_handover_b07(uuid,text) to authenticated;

-- Problem cases: 7-day response/evidence deadline; C2C untracked non-receipt not before day 14.
create or replace function public.open_market_order_problem_v2(p_order_id uuid,p_category text,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare o public.market_orders;v_reason text;v_cat text;v_case uuid;v_other uuid;v_c2c boolean:=false;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');v_cat:=lower(trim(coalesce(p_category,'other')));
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Problem beschreiben';end if;
  if v_cat not in ('shipping','not_received','damaged','not_as_described','payment','other') then raise exception 'Ungültige Problemkategorie';end if;
  select * into o from public.market_orders where id=p_order_id for update;
  if not found or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt';end if;
  if o.shipped_at is null or o.status not in ('shipped','received') then raise exception 'Vor Versand bitte eine Stornoanfrage verwenden';end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and case_type='problem' and status='open') then raise exception 'Für diese Order ist bereits ein Problem offen';end if;
  if v_cat='not_received' then
    if auth.uid()<>o.buyer_id then raise exception 'Nicht-Erhalt kann nur der Käufer melden';end if;
    select coalesce(bool_and(coalesce(s.contract_classification,a.seller_type,'private')='c2c' or coalesce(s.contract_classification,'')='c2c'),false)
    into v_c2c
    from public.market_deals d
    left join dv_market_private.market_contract_snapshots s on s.deal_id=d.id
    left join public.market_seller_accounts a on a.seller_id=d.seller_id
    where d.order_id=o.id;
    if v_c2c and o.tracking_code is null and now()<o.shipped_at+interval '14 days' then raise exception 'c2c_untracked_not_received_wait_14_days';end if;
  end if;
  v_other:=case when auth.uid()=o.seller_id then o.buyer_id else o.seller_id end;
  insert into public.market_order_cases(order_id,case_type,status,category,reason,opened_by,refund_state,refund_amount,response_due_at,evidence_due_at)
  values(o.id,'problem','open',v_cat,v_reason,auth.uid(),
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then 'provider_required' else 'not_required' end,
    case when o.payment_provider<>'manual_beta' and o.paid_amount>0 then o.total_amount else null end,
    now()+interval '7 days',now()+interval '7 days') returning id into v_case;
  update public.market_orders set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,
    refund_status=case when payment_provider<>'manual_beta' and paid_amount>0 then 'provider_required' else refund_status end,
    refund_amount=case when payment_provider<>'manual_beta' and paid_amount>0 then total_amount else refund_amount end,updated_at=now()
  where id=o.id;
  update public.market_deals set status='disputed',disputed_at=coalesce(disputed_at,now()),disputed_by=auth.uid(),dispute_reason=v_reason,
    payout_status=case when payment_provider='stripe_connect' then 'blocked' else payout_status end,updated_at=now()
  where order_id=o.id and status not in ('cancelled','completed');
  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(v_other,'problem_opened','PROBLEM GEMELDET',o.order_number||' · '||left(v_reason,220),o.id,'problem_opened:'||v_case::text)
  on conflict(dedupe_key) do nothing;
  return v_case;
end
$$;
revoke all on function public.open_market_order_problem_v2(uuid,text,text) from public,anon;
grant execute on function public.open_market_order_problem_v2(uuid,text,text) to authenticated;

create or replace function public.get_my_market_order_b07_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'order_id',o.id,'fulfillment_group',o.fulfillment_group,'status',o.status,'subtotal',o.subtotal,
    'tracking_required',(o.subtotal>25 or o.risk_tracking_required),
    'shipping_due_at',o.shipping_due_at,'delivery_evidence_at',o.delivery_evidence_at,
    'closure_eligible_at',o.closure_eligible_at,'buyer_received_ok_at',o.buyer_received_ok_at,
    'technical_completed_at',o.technical_completed_at,'technical_completion_reason',o.technical_completion_reason,
    'pickup_code_pending',exists(select 1 from dv_market_private.market_pickup_handovers h where h.order_id=o.id and h.consumed_at is null and h.expires_at>now()),
    'pickup_code_expires_at',(select h.expires_at from dv_market_private.market_pickup_handovers h where h.order_id=o.id and h.consumed_at is null and h.expires_at>now()),
    'active_case_due_at',(select least(coalesce(c.response_due_at,'infinity'::timestamptz),coalesce(c.evidence_due_at,'infinity'::timestamptz)) from public.market_order_cases c where c.order_id=o.id and c.status='open' order by c.created_at desc limit 1)
  ) order by o.created_at desc),'[]'::jsonb) into v_result
  from public.market_orders o where auth.uid() in (o.seller_id,o.buyer_id);
  return v_result;
end
$$;
revoke all on function public.get_my_market_order_b07_status() from public,anon;
grant execute on function public.get_my_market_order_b07_status() to authenticated;

notify pgrst,'reload schema';
