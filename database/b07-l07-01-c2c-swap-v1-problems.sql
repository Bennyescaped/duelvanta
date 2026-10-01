-- DUELVANTA B07 / L07-01 private C2C swap problem flow.
-- REVIEW/STAGING ONLY. Apply after b07-l07-01-c2c-swap-v1-fulfillment.sql.
-- No payment, payout, refund, fee, wallet or tax-reporting effect.

create table if not exists dv_market_private.market_swap_cases (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dv_market_private.market_swap_threads(id) on delete restrict,
  fulfillment_sender_id uuid not null references auth.users(id) on delete restrict,
  opened_by uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('shipping','not_received','damaged','not_as_described','other')),
  reason text not null check (char_length(trim(reason)) between 3 and 1200),
  status text not null default 'open' check (status in ('open','withdrawn','resolved')),
  response_note text,
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  response_due_at timestamptz not null,
  evidence_due_at timestamptz not null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dv_market_private.market_swap_cases enable row level security;
revoke all on table dv_market_private.market_swap_cases from public,anon,authenticated;
create index if not exists market_swap_cases_thread_idx
  on dv_market_private.market_swap_cases(thread_id,created_at desc);
create unique index if not exists market_swap_cases_one_open_idx
  on dv_market_private.market_swap_cases(thread_id)
  where status='open';

create or replace function public.open_market_swap_problem_v1(
  p_thread_id uuid,
  p_fulfillment_sender_id uuid,
  p_category text,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_fulfillment dv_market_private.market_swap_fulfillments%rowtype;
  v_category text:=lower(trim(coalesce(p_category,'')));
  v_reason text:=nullif(left(trim(coalesce(p_reason,'')),1200),'');
  v_case_id uuid;
  v_now timestamptz:=now();
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  if v_category not in ('shipping','not_received','damaged','not_as_described','other') then
    raise exception 'swap_problem_category_invalid';
  end if;
  if v_reason is null or char_length(v_reason)<3 then raise exception 'swap_problem_reason_required';end if;

  select * into v_thread
  from dv_market_private.market_swap_threads
  where id=p_thread_id
  for update;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) then raise exception 'swap_not_participant';end if;
  if v_thread.status not in ('bound','disputed') then raise exception 'swap_problem_not_available';end if;
  if exists(select 1 from dv_market_private.market_swap_cases c where c.thread_id=v_thread.id and c.status='open') then
    raise exception 'swap_problem_already_open';
  end if;

  select * into v_fulfillment
  from dv_market_private.market_swap_fulfillments
  where thread_id=v_thread.id and sender_id=p_fulfillment_sender_id
  for update;
  if not found or v_fulfillment.shipped_at is null then raise exception 'swap_shipment_not_problem_eligible';end if;

  if v_category='not_received' then
    if v_uid<>v_fulfillment.receiver_id then raise exception 'swap_not_received_receiver_only';end if;
    if v_fulfillment.tracking_code is null and v_now<v_fulfillment.shipped_at+interval '14 days' then
      raise exception 'c2c_untracked_not_received_wait_14_days';
    end if;
  end if;

  insert into dv_market_private.market_swap_cases(
    thread_id,fulfillment_sender_id,opened_by,category,reason,status,
    response_due_at,evidence_due_at,created_at,updated_at
  ) values(
    v_thread.id,v_fulfillment.sender_id,v_uid,v_category,v_reason,'open',
    v_now+interval '7 days',v_now+interval '7 days',v_now,v_now
  ) returning id into v_case_id;

  update dv_market_private.market_swap_threads
  set status='disputed',updated_at=v_now
  where id=v_thread.id;

  return v_case_id;
end
$$;
revoke all on function public.open_market_swap_problem_v1(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.open_market_swap_problem_v1(uuid,uuid,text,text) to authenticated;

create or replace function public.respond_market_swap_problem_v1(
  p_case_id uuid,
  p_note text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_case dv_market_private.market_swap_cases%rowtype;
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_note text:=nullif(left(trim(coalesce(p_note,'')),1200),'');
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  if v_note is null or char_length(v_note)<3 then raise exception 'swap_problem_response_required';end if;
  select * into v_case from dv_market_private.market_swap_cases where id=p_case_id for update;
  if not found or v_case.status<>'open' then raise exception 'swap_problem_not_open';end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=v_case.thread_id;
  if not found or v_uid not in (v_thread.party_a_id,v_thread.party_b_id) or v_uid=v_case.opened_by then
    raise exception 'swap_problem_response_not_allowed';
  end if;
  update dv_market_private.market_swap_cases
  set response_note=v_note,responded_by=v_uid,responded_at=now(),updated_at=now()
  where id=v_case.id;
end
$$;
revoke all on function public.respond_market_swap_problem_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.respond_market_swap_problem_v1(uuid,text) to authenticated;

create or replace function public.withdraw_market_swap_problem_v1(
  p_case_id uuid,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_case dv_market_private.market_swap_cases%rowtype;
  v_thread dv_market_private.market_swap_threads%rowtype;
  v_note text:=nullif(left(trim(coalesce(p_note,'')),1200),'');
  v_now timestamptz:=now();
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select * into v_case from dv_market_private.market_swap_cases where id=p_case_id for update;
  if not found or v_case.status<>'open' or v_case.opened_by<>v_uid then
    raise exception 'swap_problem_withdraw_not_allowed';
  end if;
  select * into v_thread from dv_market_private.market_swap_threads where id=v_case.thread_id for update;
  update dv_market_private.market_swap_cases
  set status='withdrawn',resolution_note=v_note,resolved_at=v_now,updated_at=v_now
  where id=v_case.id;
  if v_thread.status='disputed'
     and not exists(select 1 from dv_market_private.market_swap_cases c where c.thread_id=v_thread.id and c.status='open') then
    update dv_market_private.market_swap_threads set status='bound',updated_at=v_now where id=v_thread.id;
  end if;
end
$$;
revoke all on function public.withdraw_market_swap_problem_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.withdraw_market_swap_problem_v1(uuid,text) to authenticated;

create or replace function public.get_my_market_swap_cases_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'case_id',c.id,'thread_id',c.thread_id,'fulfillment_sender_id',c.fulfillment_sender_id,
    'opened_by',c.opened_by,'opened_by_me',c.opened_by=v_uid,'category',c.category,
    'reason',c.reason,'status',c.status,'response_note',c.response_note,
    'responded_by',c.responded_by,'responded_at',c.responded_at,
    'response_due_at',c.response_due_at,'evidence_due_at',c.evidence_due_at,
    'resolution_note',c.resolution_note,'resolved_at',c.resolved_at,'created_at',c.created_at,
    'can_respond',c.status='open' and c.opened_by<>v_uid,
    'can_withdraw',c.status='open' and c.opened_by=v_uid
  ) order by c.created_at desc),'[]'::jsonb)
  into v_result
  from dv_market_private.market_swap_cases c
  join dv_market_private.market_swap_threads t on t.id=c.thread_id
  where v_uid in (t.party_a_id,t.party_b_id);
  return v_result;
end
$$;
revoke all on function public.get_my_market_swap_cases_v1() from public,anon,authenticated;
grant execute on function public.get_my_market_swap_cases_v1() to authenticated;

notify pgrst,'reload schema';
