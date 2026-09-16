\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('11111111-1111-4111-8111-111111111111','a@example.test'),
  ('22222222-2222-4222-8222-222222222222','b@example.test');

insert into public.profiles(id,display_name,username) values
  ('11111111-1111-4111-8111-111111111111','A','a'),
  ('22222222-2222-4222-8222-222222222222','B','b');

insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,country_code) values
  ('11111111-1111-4111-8111-111111111111','private','active','DE'),
  ('22222222-2222-4222-8222-222222222222','private','active','DE');

insert into public.market_default_shipping_addresses(user_id,recipient_name,street_line1,postal_code,city,country_code) values
  ('11111111-1111-4111-8111-111111111111','A','Teststr. 1','10115','Berlin','DE'),
  ('22222222-2222-4222-8222-222222222222','B','Teststr. 2','20095','Hamburg','DE');

insert into public.market_listings(id,seller_id,listing_type,status,quantity_available,tcg,card_name,set_name,card_number,language,condition,market_price_snapshot) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','trade','active',1,'pokemon','Card A','Set A','001','DE','NM',30.00),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','trade','active',1,'pokemon','Card B','Set B','002','DE','NM',20.00);

create temporary table b07_swap_test_state(
  thread_id uuid,
  revision_id uuid,
  case_id uuid
);

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into b07_swap_test_state(thread_id)
select public.create_market_swap_proposal_v1(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]
);

update b07_swap_test_state s
set revision_id=t.current_revision_id
from dv_market_private.market_swap_threads t
where t.id=s.thread_id;

select public.confirm_market_swap_revision_v1(thread_id,revision_id)
from b07_swap_test_state;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.confirm_market_swap_revision_v1(thread_id,revision_id)
from b07_swap_test_state;

do $$
declare
  v_thread uuid:=(select thread_id from b07_swap_test_state);
  v_revision uuid:=(select revision_id from b07_swap_test_state);
begin
  if (select status from dv_market_private.market_swap_threads where id=v_thread)<>'bound' then
    raise exception 'C2C regression: thread did not become bound';
  end if;
  if (select count(*) from dv_market_private.market_swap_reservations where thread_id=v_thread)<>2 then
    raise exception 'C2C regression: reservations incomplete';
  end if;
  if (select count(*) from dv_market_private.market_swap_fulfillments where thread_id=v_thread)<>2 then
    raise exception 'C2C regression: fulfillment rows incomplete';
  end if;
  if not exists(select 1 from dv_market_private.market_swap_fulfillments where thread_id=v_thread and sender_id='11111111-1111-4111-8111-111111111111' and tracking_required) then
    raise exception 'C2C regression: >25 EUR side must require tracking';
  end if;
  if not exists(select 1 from dv_market_private.market_swap_fulfillments where thread_id=v_thread and sender_id='22222222-2222-4222-8222-222222222222' and not tracking_required) then
    raise exception 'C2C regression: <=25 EUR side should allow untracked shipping';
  end if;
  if exists(select 1 from dv_market_private.market_swap_value_snapshots where thread_id=v_thread and psttg_event_created_by_b07) then
    raise exception 'C2C regression: B07 must not create PStTG events';
  end if;
  if to_regclass('dv_market_private.market_tax_events') is not null then
    raise exception 'C2C regression: C2C migrations unexpectedly created tax ledger table';
  end if;
  begin
    update dv_market_private.market_swap_revisions set revision_no=revision_no+1 where id=v_revision;
    raise exception 'C2C regression: immutable revision update unexpectedly succeeded';
  exception when others then
    if position('market_swap_evidence_is_immutable' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
declare v_thread uuid:=(select thread_id from b07_swap_test_state);begin
  begin
    perform public.mark_market_swap_shipped_v1(v_thread,null,null);
    raise exception 'C2C regression: required tracking was bypassed';
  exception when others then
    if position('tracking_required_for_swap' in sqlerrm)=0 then raise; end if;
  end;
end
$$;
select public.mark_market_swap_shipped_v1(thread_id,'DHL','TRACK-A') from b07_swap_test_state;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.mark_market_swap_shipped_v1(thread_id,null,null) from b07_swap_test_state;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
declare v_thread uuid:=(select thread_id from b07_swap_test_state);begin
  begin
    perform public.open_market_swap_problem_v1(v_thread,'22222222-2222-4222-8222-222222222222','not_received','Noch nicht angekommen');
    raise exception 'C2C regression: untracked not-received opened before 14 days';
  exception when others then
    if position('c2c_untracked_not_received_wait_14_days' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

update dv_market_private.market_swap_fulfillments
set shipped_at=now()-interval '15 days'
where thread_id=(select thread_id from b07_swap_test_state)
  and sender_id='22222222-2222-4222-8222-222222222222';

update b07_swap_test_state
set case_id=public.open_market_swap_problem_v1(
  thread_id,
  '22222222-2222-4222-8222-222222222222',
  'not_received',
  'Ungetrackte Sendung nach 15 Tagen nicht angekommen'
);

do $$
declare
  v_thread uuid:=(select thread_id from b07_swap_test_state);
  v_case uuid:=(select case_id from b07_swap_test_state);
begin
  if (select status from dv_market_private.market_swap_threads where id=v_thread)<>'disputed' then
    raise exception 'C2C regression: open problem did not dispute thread';
  end if;
  if not exists(
    select 1 from dv_market_private.market_swap_cases
    where id=v_case and status='open'
      and response_due_at-created_at=interval '7 days'
      and evidence_due_at-created_at=interval '7 days'
  ) then
    raise exception 'C2C regression: 7-day problem deadlines missing';
  end if;
end
$$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.respond_market_swap_problem_v1(case_id,'Versand geprüft; bitte noch einmal Briefkasten prüfen') from b07_swap_test_state;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.withdraw_market_swap_problem_v1(case_id,'Sendung ist angekommen') from b07_swap_test_state;

do $$
declare v_thread uuid:=(select thread_id from b07_swap_test_state);v_case uuid:=(select case_id from b07_swap_test_state);begin
  if (select status from dv_market_private.market_swap_threads where id=v_thread)<>'bound' then
    raise exception 'C2C regression: withdrawn problem did not resume bound thread';
  end if;
  if (select status from dv_market_private.market_swap_cases where id=v_case)<>'withdrawn' then
    raise exception 'C2C regression: case was not withdrawn';
  end if;
end
$$;

select public.confirm_market_swap_received_v1(thread_id,'22222222-2222-4222-8222-222222222222') from b07_swap_test_state;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.confirm_market_swap_received_v1(thread_id,'11111111-1111-4111-8111-111111111111') from b07_swap_test_state;

do $$
declare v_thread uuid:=(select thread_id from b07_swap_test_state);begin
  if (select status from dv_market_private.market_swap_threads where id=v_thread)<>'completed' then
    raise exception 'C2C regression: bilateral receipt did not complete swap';
  end if;
  if (select count(*) from public.market_listings where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') and status='sold')<>2 then
    raise exception 'C2C regression: completed swap listings were not finalized';
  end if;
end
$$;

select 'PASS: real PostgreSQL C2C binding, tracking, problem deadlines, immutability and completion' as result;
