-- DUELVANTA B07 / L07-01 seller cancellation guard.
-- REVIEW/STAGING ONLY. No production migration, fee charge, sanction or refund execution.
-- Decision L07-01/36: after a binding paid sale the seller has no free cancellation right.
-- Paid seller cancellation is only recorded as a reasoned exception request; attribution and
-- the proposed 4-percent cancellation fee remain external-review-only and technically inactive.

alter table public.market_order_cases
  add column if not exists initiator_role text,
  add column if not exists seller_exception_review_status text not null default 'not_applicable',
  add column if not exists seller_cancellation_fee_review_status text not null default 'not_applicable';

do $$
begin
  if not exists(select 1 from pg_constraint where conname='market_order_cases_initiator_role_check') then
    alter table public.market_order_cases add constraint market_order_cases_initiator_role_check
      check (initiator_role is null or initiator_role in ('buyer','seller'));
  end if;
  if not exists(select 1 from pg_constraint where conname='market_order_cases_seller_exception_review_check') then
    alter table public.market_order_cases add constraint market_order_cases_seller_exception_review_check
      check (seller_exception_review_status in ('not_applicable','external_review_required'));
  end if;
  if not exists(select 1 from pg_constraint where conname='market_order_cases_seller_fee_review_check') then
    alter table public.market_order_cases add constraint market_order_cases_seller_fee_review_check
      check (seller_cancellation_fee_review_status in ('not_applicable','external_review_required_disabled'));
  end if;
end $$;

comment on column public.market_order_cases.seller_exception_review_status is
  'B07 technical marker only. external_review_required means the paid seller cancellation is an exception request whose attribution must not be decided automatically.';
comment on column public.market_order_cases.seller_cancellation_fee_review_status is
  'B07 Category-C marker only. external_review_required_disabled explicitly means no cancellation fee is calculated or charged.';

create or replace function public.request_market_order_cancellation(p_order_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.market_orders;
  v_reason text;
  v_case uuid;
  v_other uuid;
  v_is_seller boolean;
  v_paid boolean;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1200),'');
  if v_reason is null or char_length(v_reason)<3 then raise exception 'Bitte Stornogrund angeben'; end if;

  select * into o from public.market_orders where id=p_order_id for update;
  if o.id is null or auth.uid() not in (o.seller_id,o.buyer_id) then raise exception 'Nicht erlaubt'; end if;
  if o.shipped_at is not null or o.status not in ('open','in_progress') then raise exception 'Nach Versand bitte einen Problemfall melden'; end if;
  if exists(select 1 from public.market_order_cases where order_id=o.id and status in ('open','accepted_refund_pending')) then
    raise exception 'Für diese Order ist bereits ein Vorgang offen';
  end if;

  v_is_seller:=auth.uid()=o.seller_id;
  v_paid:=o.payment_status='paid' or coalesce(o.paid_amount,0)>0;
  v_role:=case when v_is_seller then 'seller' else 'buyer' end;

  if v_is_seller and v_paid and char_length(v_reason)<20 then
    raise exception 'seller_paid_cancellation_exception_reason_required';
  end if;

  v_other:=case when v_is_seller then o.buyer_id else o.seller_id end;

  insert into public.market_order_cases(
    order_id,case_type,status,category,reason,opened_by,refund_state,refund_amount,
    initiator_role,seller_exception_review_status,seller_cancellation_fee_review_status
  ) values(
    o.id,'cancellation','open',
    case when v_is_seller and v_paid then 'seller_exception' else null end,
    v_reason,auth.uid(),
    case when o.payment_provider='manual_beta' then 'external_payment_unknown' when o.paid_amount>0 then 'provider_required' else 'not_required' end,
    case when o.paid_amount>0 then o.total_amount else null end,
    v_role,
    case when v_is_seller and v_paid then 'external_review_required' else 'not_applicable' end,
    case when v_is_seller and v_paid then 'external_review_required_disabled' else 'not_applicable' end
  ) returning id into v_case;

  insert into public.market_notifications(recipient_id,kind,title,body,order_id,dedupe_key)
  values(
    v_other,'cancellation_requested',
    case when v_is_seller and v_paid then 'VERKÄUFER-STORNO · AUSNAHMEFALL' else 'STORNO ANGEFRAGT' end,
    o.order_number||' · '||left(v_reason,220),o.id,'cancel_request:'||v_case::text
  ) on conflict(dedupe_key) do nothing;

  return v_case;
end;
$$;
revoke all on function public.request_market_order_cancellation(uuid,text) from public,anon;
grant execute on function public.request_market_order_cancellation(uuid,text) to authenticated;

comment on function public.request_market_order_cancellation(uuid,text) is
  'B07: buyer cancellation stays a request; paid seller cancellation is accepted only as a reasoned exception request and carries disabled external-review markers. No fee or sanction is executed.';

notify pgrst,'reload schema';
