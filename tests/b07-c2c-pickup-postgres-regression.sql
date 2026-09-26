\set ON_ERROR_STOP on

insert into public.market_listings(id,seller_id,listing_type,status,quantity_available,tcg,card_name,set_name,card_number,language,condition,market_price_snapshot) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','trade','active',1,'pokemon','Pickup A','Set C','003','DE','NM',12.00),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','trade','active',1,'pokemon','Pickup B','Set D','004','DE','NM',18.00);

create temporary table b07_pickup_state(
  thread_id uuid,
  revision_id uuid,
  first_revision_id uuid,
  handover_code text
);

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into b07_pickup_state(thread_id)
select public.create_market_swap_proposal_v2(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  array['cccccccc-cccc-4ccc-8ccc-cccccccccccc']::uuid[],
  'pickup'
);

update b07_pickup_state s
set first_revision_id=t.current_revision_id,
    revision_id=t.current_revision_id
from dv_market_private.market_swap_threads t
where t.id=s.thread_id;

select public.confirm_market_swap_revision_v1(thread_id,revision_id)
from b07_pickup_state;

-- Changing fulfillment mode is a new immutable revision and therefore invalidates the old current confirmation.
update b07_pickup_state s
set revision_id=public.propose_market_swap_revision_v2(
  s.thread_id,
  array['cccccccc-cccc-4ccc-8ccc-cccccccccccc']::uuid[],
  array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[],
  'shipping'
);

do $$
declare s b07_pickup_state%rowtype;begin
  select * into s from b07_pickup_state;
  if (select fulfillment_mode from dv_market_private.market_swap_threads where id=s.thread_id)<>'shipping' then
    raise exception 'C2C pickup regression: fulfillment mode did not change with revision';
  end if;
  if (select fulfillment_mode from dv_market_private.market_swap_revisions where id=s.revision_id)<>'shipping' then
    raise exception 'C2C pickup regression: revision did not bind fulfillment mode';
  end if;
  if exists(select 1 from dv_market_private.market_swap_confirmations where revision_id=s.revision_id) then
    raise exception 'C2C pickup regression: old confirmation leaked onto new revision';
  end if;
end
$$;

-- Switch back to pickup through another revision; both parties must confirm this exact pickup revision.
update b07_pickup_state s
set revision_id=public.propose_market_swap_revision_v2(
  s.thread_id,
  array['cccccccc-cccc-4ccc-8ccc-cccccccccccc']::uuid[],
  array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[],
  'pickup'
);

select public.confirm_market_swap_revision_v1(thread_id,revision_id)
from b07_pickup_state;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.confirm_market_swap_revision_v1(thread_id,revision_id)
from b07_pickup_state;

do $$
declare s b07_pickup_state%rowtype;begin
  select * into s from b07_pickup_state;
  if (select status from dv_market_private.market_swap_threads where id=s.thread_id)<>'bound' then
    raise exception 'C2C pickup regression: pickup thread did not bind';
  end if;
  if (select fulfillment_mode from dv_market_private.market_swap_threads where id=s.thread_id)<>'pickup' then
    raise exception 'C2C pickup regression: bound mode is not pickup';
  end if;
  if (select fulfillment_mode from dv_market_private.market_swap_revisions where id=s.revision_id)<>'pickup' then
    raise exception 'C2C pickup regression: bound revision mode is not pickup';
  end if;
  if (select shipping_due_at from dv_market_private.market_swap_threads where id=s.thread_id) is not null then
    raise exception 'C2C pickup regression: pickup must not receive shipping deadline';
  end if;
  if exists(select 1 from dv_market_private.market_swap_shipping_addresses where thread_id=s.thread_id) then
    raise exception 'C2C pickup regression: pickup must not snapshot shipping addresses';
  end if;
  if exists(select 1 from dv_market_private.market_swap_fulfillments where thread_id=s.thread_id) then
    raise exception 'C2C pickup regression: pickup must not create shipping fulfillments';
  end if;
  if (select count(*) from dv_market_private.market_swap_reservations where thread_id=s.thread_id)<>2 then
    raise exception 'C2C pickup regression: pickup reservations incomplete';
  end if;
end
$$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
update b07_pickup_state s
set handover_code=(public.create_market_swap_pickup_code_v1(s.thread_id)->>'handover_code');

do $$
declare s b07_pickup_state%rowtype;h dv_market_private.market_swap_pickup_handovers%rowtype;begin
  select * into s from b07_pickup_state;
  select * into h from dv_market_private.market_swap_pickup_handovers where thread_id=s.thread_id;
  if h.expires_at-h.generated_at<>interval '2 hours' then
    raise exception 'C2C pickup regression: handover code must expire after 2 hours';
  end if;
  if h.generated_by<>'11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'C2C pickup regression: code generator not recorded';
  end if;
  begin
    perform public.confirm_market_swap_pickup_v1(s.thread_id,s.handover_code);
    raise exception 'C2C pickup regression: generator confirmed own code';
  exception when others then
    if position('swap_pickup_requires_other_party' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$
declare s b07_pickup_state%rowtype;r jsonb;begin
  select * into s from b07_pickup_state;
  r:=public.confirm_market_swap_pickup_v1(s.thread_id,'WRONG-CODE');
  if coalesce((r->>'ok')::boolean,true) then raise exception 'C2C pickup regression: invalid code unexpectedly accepted';end if;
  if (select attempt_count from dv_market_private.market_swap_pickup_handovers where thread_id=s.thread_id)<>1 then
    raise exception 'C2C pickup regression: invalid attempt was not counted';
  end if;
end
$$;

select public.confirm_market_swap_pickup_v1(thread_id,handover_code)
from b07_pickup_state;

do $$
declare s b07_pickup_state%rowtype;h dv_market_private.market_swap_pickup_handovers%rowtype;begin
  select * into s from b07_pickup_state;
  select * into h from dv_market_private.market_swap_pickup_handovers where thread_id=s.thread_id;
  if (select status from dv_market_private.market_swap_threads where id=s.thread_id)<>'completed' then
    raise exception 'C2C pickup regression: valid handover did not complete swap';
  end if;
  if h.consumed_at is null or h.confirmed_by<>'22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'C2C pickup regression: bilateral handover evidence incomplete';
  end if;
  if (select count(*) from public.market_listings where id in ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd') and status='sold')<>2 then
    raise exception 'C2C pickup regression: pickup listings were not finalized';
  end if;
end
$$;

select 'PASS: real PostgreSQL C2C revision-bound pickup handover and completion' as result;
