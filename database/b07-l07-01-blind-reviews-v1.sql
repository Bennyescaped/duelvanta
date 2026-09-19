-- DUELVANTA B07 / L07-01 5-star blind review model.
-- REVIEW/STAGING ONLY. Decisions L07-01/45-/48.
-- New reviews are immutable, transaction-bound and hidden until both parties review
-- or the 30-day review window ends. Moderation decisions remain external-review-only.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public,anon,authenticated;

create table if not exists dv_market_private.market_transaction_reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_kind text not null check (transaction_kind in ('deal','swap')),
  deal_id uuid references public.market_deals(id) on delete restrict,
  swap_thread_id uuid references dv_market_private.market_swap_threads(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  reviewee_id uuid not null references auth.users(id) on delete restrict,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment)<=500),
  transaction_completed_at timestamptz not null,
  review_deadline_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (reviewer_id<>reviewee_id),
  check ((transaction_kind='deal' and deal_id is not null and swap_thread_id is null)
      or (transaction_kind='swap' and swap_thread_id is not null and deal_id is null)),
  check (review_deadline_at=transaction_completed_at+interval '30 days'),
  check (submitted_at<=review_deadline_at)
);

create unique index if not exists market_transaction_reviews_deal_once_idx
  on dv_market_private.market_transaction_reviews(deal_id,reviewer_id)
  where transaction_kind='deal';
create unique index if not exists market_transaction_reviews_swap_once_idx
  on dv_market_private.market_transaction_reviews(swap_thread_id,reviewer_id)
  where transaction_kind='swap';
create index if not exists market_transaction_reviews_reviewee_idx
  on dv_market_private.market_transaction_reviews(reviewee_id,submitted_at desc);

create table if not exists dv_market_private.market_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references dv_market_private.market_transaction_reviews(id) on delete restrict,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  moderation_status text not null default 'external_review_required'
    check (moderation_status='external_review_required'),
  created_at timestamptz not null default now(),
  unique(review_id,reporter_id)
);

alter table dv_market_private.market_transaction_reviews enable row level security;
alter table dv_market_private.market_review_reports enable row level security;
revoke all on table dv_market_private.market_transaction_reviews from public,anon,authenticated;
revoke all on table dv_market_private.market_review_reports from public,anon,authenticated;

create or replace function dv_market_private.block_b07_review_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'b07_review_is_immutable';
end
$$;
revoke all on function dv_market_private.block_b07_review_mutation() from public,anon,authenticated;

drop trigger if exists b07_reviews_immutable on dv_market_private.market_transaction_reviews;
create trigger b07_reviews_immutable
before update or delete on dv_market_private.market_transaction_reviews
for each row execute function dv_market_private.block_b07_review_mutation();

drop trigger if exists b07_review_reports_immutable on dv_market_private.market_review_reports;
create trigger b07_review_reports_immutable
before update or delete on dv_market_private.market_review_reports
for each row execute function dv_market_private.block_b07_review_mutation();

create or replace function public.submit_market_transaction_review_v1(
  p_transaction_kind text,
  p_transaction_id uuid,
  p_stars integer,
  p_comment text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_kind text:=lower(trim(coalesce(p_transaction_kind,'')));
  v_a uuid;
  v_b uuid;
  v_reviewee uuid;
  v_completed timestamptz;
  v_status text;
  v_comment text:=nullif(left(trim(coalesce(p_comment,'')),500),'');
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  if v_kind not in ('deal','swap') or p_transaction_id is null then raise exception 'review_transaction_invalid';end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'review_stars_invalid';end if;

  if v_kind='deal' then
    select d.seller_id,d.buyer_id,d.completed_at,d.status
    into v_a,v_b,v_completed,v_status
    from public.market_deals d where d.id=p_transaction_id;
  else
    select t.party_a_id,t.party_b_id,t.completed_at,t.status
    into v_a,v_b,v_completed,v_status
    from dv_market_private.market_swap_threads t where t.id=p_transaction_id;
  end if;

  if v_a is null or v_b is null or v_uid not in (v_a,v_b) or v_status<>'completed' or v_completed is null then
    raise exception 'review_not_allowed';
  end if;
  if now()>v_completed+interval '30 days' then raise exception 'review_window_closed';end if;
  v_reviewee:=case when v_uid=v_a then v_b else v_a end;

  insert into dv_market_private.market_transaction_reviews(
    transaction_kind,deal_id,swap_thread_id,reviewer_id,reviewee_id,stars,comment,
    transaction_completed_at,review_deadline_at,submitted_at
  ) values(
    v_kind,case when v_kind='deal' then p_transaction_id end,
    case when v_kind='swap' then p_transaction_id end,
    v_uid,v_reviewee,p_stars,v_comment,v_completed,v_completed+interval '30 days',now()
  ) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'review_already_submitted';
end
$$;
revoke all on function public.submit_market_transaction_review_v1(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_market_transaction_review_v1(text,uuid,integer,text) to authenticated;

create or replace function public.get_my_market_review_state_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  with tx as (
    select 'deal'::text transaction_kind,d.id transaction_id,d.completed_at,
      d.seller_id party_a_id,d.buyer_id party_b_id,
      coalesce(l.card_name,'Marketplace-Kauf') subject
    from public.market_deals d
    left join public.market_listings l on l.id=d.listing_id
    where d.status='completed' and d.completed_at is not null and v_uid in (d.seller_id,d.buyer_id)
    union all
    select 'swap',t.id,t.completed_at,t.party_a_id,t.party_b_id,'C2C-Tausch'
    from dv_market_private.market_swap_threads t
    where t.status='completed' and t.completed_at is not null and v_uid in (t.party_a_id,t.party_b_id)
  ), enriched as (
    select tx.*,
      case when v_uid=tx.party_a_id then tx.party_b_id else tx.party_a_id end other_id,
      own.id own_review_id,own.stars own_stars,own.comment own_comment,own.submitted_at own_submitted_at,
      other.id other_review_id,other.stars other_stars,other.comment other_comment,other.submitted_at other_submitted_at,
      exists(select 1 from dv_market_private.market_review_reports rr where rr.review_id=other.id and rr.reporter_id=v_uid) other_reported_by_me
    from tx
    left join dv_market_private.market_transaction_reviews own on own.transaction_kind=tx.transaction_kind
      and own.reviewer_id=v_uid
      and ((tx.transaction_kind='deal' and own.deal_id=tx.transaction_id)
        or (tx.transaction_kind='swap' and own.swap_thread_id=tx.transaction_id))
    left join dv_market_private.market_transaction_reviews other on other.transaction_kind=tx.transaction_kind
      and other.reviewee_id=v_uid
      and ((tx.transaction_kind='deal' and other.deal_id=tx.transaction_id)
        or (tx.transaction_kind='swap' and other.swap_thread_id=tx.transaction_id))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'transaction_kind',e.transaction_kind,'transaction_id',e.transaction_id,
    'subject',e.subject,'completed_at',e.completed_at,'review_deadline_at',e.completed_at+interval '30 days',
    'other_user_id',e.other_id,'other_display_name',coalesce(p.display_name,p.username,'DUELVANTA Member'),
    'my_review_submitted',e.own_review_id is not null,'my_stars',e.own_stars,'my_comment',e.own_comment,
    'my_submitted_at',e.own_submitted_at,
    'can_review',(e.own_review_id is null and now()<=e.completed_at+interval '30 days'),
    'other_review_visible',(e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days')),
    'other_review_id',case when e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days') then e.other_review_id end,
    'other_stars',case when e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days') then e.other_stars end,
    'other_comment',case when e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days') then e.other_comment end,
    'other_submitted_at',case when e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days') then e.other_submitted_at end,
    'other_reported_by_me',case when e.other_review_id is not null and (e.own_review_id is not null or now()>=e.completed_at+interval '30 days') then e.other_reported_by_me else false end
  ) order by e.completed_at desc,e.transaction_kind,e.transaction_id),'[]'::jsonb)
  into v_result
  from enriched e left join public.profiles p on p.id=e.other_id;
  return v_result;
end
$$;
revoke all on function public.get_my_market_review_state_v1() from public,anon,authenticated;
grant execute on function public.get_my_market_review_state_v1() to authenticated;

create or replace function public.report_market_transaction_review_v1(p_review_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_review dv_market_private.market_transaction_reviews%rowtype;v_reason text;v_counterpart boolean;v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  v_reason:=nullif(left(trim(coalesce(p_reason,'')),1000),'');
  if v_reason is null or char_length(v_reason)<3 then raise exception 'review_report_reason_required';end if;
  select * into v_review from dv_market_private.market_transaction_reviews where id=p_review_id;
  if not found or v_review.reviewee_id<>v_uid then raise exception 'review_report_not_allowed';end if;
  select exists(
    select 1 from dv_market_private.market_transaction_reviews r
    where r.transaction_kind=v_review.transaction_kind and r.reviewer_id=v_uid
      and ((r.transaction_kind='deal' and r.deal_id=v_review.deal_id)
        or (r.transaction_kind='swap' and r.swap_thread_id=v_review.swap_thread_id))
  ) into v_counterpart;
  if not v_counterpart and now()<v_review.review_deadline_at then raise exception 'review_not_visible';end if;
  insert into dv_market_private.market_review_reports(review_id,reporter_id,reason)
  values(v_review.id,v_uid,v_reason) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'review_already_reported';
end
$$;
revoke all on function public.report_market_transaction_review_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.report_market_transaction_review_v1(uuid,text) to authenticated;

-- Disable the legacy positive/neutral/negative write endpoint once this migration is active.
revoke execute on function public.submit_market_review(uuid,text,text) from public,anon,authenticated;

comment on table dv_market_private.market_transaction_reviews is
  'B07 immutable 1-5 star review evidence. Visibility is computed blind: both submitted, or 30-day deadline elapsed.';
comment on table dv_market_private.market_review_reports is
  'B07 report intake only. Moderation outcome is deliberately external-review-only and not automated here.';

notify pgrst,'reload schema';
