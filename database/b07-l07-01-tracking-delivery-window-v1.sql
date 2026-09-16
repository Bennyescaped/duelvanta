-- DUELVANTA B07 / L07-01 carrier delivery evidence + 72h technical completion.
-- STAGING/PREVIEW activation first. No payment, payout, refund or fee execution.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

after alter table public.market_orders
  add column if not exists delivery_evidence_at timestamptz,
  add column if not exists delivery_evidence_source text,
  add column if not exists delivery_evidence_ref text,
  add column if not exists closure_eligible_at timestamptz,
  add column if not exists buyer_received_ok_at timestamptz,
  add column if not exists technical_completed_at timestamptz,
  add column if not exists technical_completion_reason text;

create index if not exists market_orders_b07_closure_due_idx
  on public.market_orders (closure_eligible_at)
  where closure_eligible_at is not null
    and technical_completed_at is null
    and status in ('shipped','received');

create or replace function dv_market_private.b07_tracking_complete_order(
  p_order_id uuid,
  p_reason text,
  p_completed_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare
  o public.market_orders;
begin
  select * into o
  from public.market_orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order nicht gefunden'; end if;
  if o.status='completed' then return; end if;
  if o.status in ('cancelled','disputed') then
    raise exception 'Order kann mit offenem Vorgang nicht abgeschlossen werden';
  end if;
  if exists(
    select 1
    from public.market_order_cases c
    where c.order_id=o.id
      and c.case_type='problem'
      and c.status='open'
  ) then
    raise exception 'Ein Problemfall ist noch offen';
  end if;

  update public.market_orders
  set status='completed',
      completed_at=coalesce(completed_at,p_completed_at),
      technical_completed_at=coalesce(technical_completed_at,p_completed_at),
      technical_completion_reason=coalesce(technical_completion_reason,left(p_reason,80)),
      updated_at=now()
  where id=o.id;

  update public.market_deals
  set status='completed',
      fulfillment_status='received',
      received_at=coalesce(received_at,o.delivery_evidence_at),
      seller_confirmed_at=coalesce(seller_confirmed_at,o.shipped_at),
      completed_at=coalesce(completed_at,p_completed_at),
      updated_at=now()
  where order_id=o.id
    and status in ('accepted','in_progress');

  update public.market_listings l
  set status='sold',
      ended_at=coalesce(l.ended_at,p_completed_at),
      updated_at=now()
  where l.status='reserved'
    and l.quantity_available=0
    and exists(
      select 1 from public.market_deals d
      where d.order_id=o.id
        and d.listing_id=l.id
        and d.status='completed'
    )
    and not exists(
      select 1 from public.market_deals d
      where d.listing_id=l.id
        and d.status not in ('completed','cancelled')
    );

  update public.market_offers mo
  set completed_at=coalesce(completed_at,p_completed_at),
      updated_at=now()
  where mo.status='accepted'
    and exists(
      select 1 from public.market_deals d
      where d.order_id=o.id
        and d.offer_id=mo.id
        and d.status='completed'
    );
end
$$;
revoke all on function dv_market_private.b07_tracking_complete_order(uuid,text,timestamptz)
  from public, anon, authenticated;

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
declare
  o public.market_orders;
  v_at timestamptz:=coalesce(p_delivered_at,now());
begin
  select * into o
  from public.market_orders
  where id=p_order_id
  for update;

  if not found
     or o.fulfillment_group<>'shipping'
     or o.status not in ('shipped','received') then
    raise exception 'delivery_evidence_not_applicable';
  end if;
  if o.tracking_code is null then
    raise exception 'delivery_evidence_requires_tracking';
  end if;
  if v_at<o.shipped_at or v_at>now()+interval '5 minutes' then
    raise exception 'delivery_evidence_time_invalid';
  end if;
  if nullif(trim(coalesce(p_source,'')),'') is null then
    raise exception 'delivery_evidence_source_required';
  end if;

  -- First valid carrier evidence wins. Duplicate/replayed webhooks never restart 72h.
  update public.market_orders
  set status=case when status='shipped' then 'received' else status end,
      delivery_evidence_at=coalesce(delivery_evidence_at,v_at),
      delivery_evidence_source=coalesce(delivery_evidence_source,left(trim(p_source),80)),
      delivery_evidence_ref=coalesce(
        delivery_evidence_ref,
        nullif(left(trim(coalesce(p_reference,'')),160),'')
      ),
      closure_eligible_at=coalesce(closure_eligible_at,v_at+interval '72 hours'),
      received_at=coalesce(received_at,v_at),
      updated_at=now()
  where id=o.id;
end
$$;
revoke all on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.record_market_order_delivery_evidence_b07(uuid,timestamptz,text,text)
  to service_role;

create or replace function public.advance_market_order_lifecycle_b07()
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,dv_market_private
as $$
declare
  r record;
  v_count integer:=0;
begin
  for r in
    select o.id
    from public.market_orders o
    where o.status in ('shipped','received')
      and o.delivery_evidence_at is not null
      and o.closure_eligible_at is not null
      and o.closure_eligible_at<=now()
      and o.technical_completed_at is null
      and not exists(
        select 1
        from public.market_order_cases c
        where c.order_id=o.id
          and c.case_type='problem'
          and c.status='open'
      )
    order by o.closure_eligible_at
    for update of o skip locked
  loop
    perform dv_market_private.b07_tracking_complete_order(
      r.id,
      'carrier_delivery_72h_elapsed',
      now()
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;
revoke all on function public.advance_market_order_lifecycle_b07()
  from public, anon, authenticated;
grant execute on function public.advance_market_order_lifecycle_b07()
  to service_role;

-- Supabase Cron executes as postgres and keeps the 72h completion independent of Vercel Hobby Cron limits.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'duelvanta-b07-carrier-72h-advance',
  '* * * * *',
  $$select public.advance_market_order_lifecycle_b07();$$
);
