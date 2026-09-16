\set ON_ERROR_STOP on

insert into public.market_listings(id,seller_id,listing_type,status,quantity_available,tcg,card_name,set_name,card_number,language,condition,market_price_snapshot) values
  ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','trade','active',1,'pokemon','Pickup Message A','Set PM','005','DE','NM',10.00),
  ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','trade','active',1,'pokemon','Pickup Message B','Set PM','006','DE','NM',10.00);

create temporary table b07_pickup_message_state(thread_id uuid,revision_id uuid,order_id uuid);

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into b07_pickup_message_state(thread_id)
select public.create_market_swap_proposal_v2(
  '77777777-7777-4777-8777-777777777777',
  array['66666666-6666-4666-8666-666666666666']::uuid[],
  'pickup'
);
update b07_pickup_message_state s set revision_id=t.current_revision_id
from dv_market_private.market_swap_threads t where t.id=s.thread_id;
select public.confirm_market_swap_revision_v1(thread_id,revision_id) from b07_pickup_message_state;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.confirm_market_swap_revision_v1(thread_id,revision_id) from b07_pickup_message_state;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.send_market_pickup_message_v1('swap',thread_id,'Treffen um 18:00 Uhr am Testort?') from b07_pickup_message_state;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.send_market_pickup_message_v1('swap',thread_id,'Passt für mich.') from b07_pickup_message_state;

do $$
declare v jsonb;begin
  select public.get_market_pickup_conversation_v1('swap',thread_id) into v from b07_pickup_message_state;
  if jsonb_array_length(v->'messages')<>2 then raise exception 'pickup messages: swap conversation count mismatch';end if;
  if (v->>'can_send')::boolean is not true then raise exception 'pickup messages: bound pickup swap must be writable';end if;
  if v->'other_party'->>'user_id'<>'11111111-1111-4111-8111-111111111111' then raise exception 'pickup messages: wrong swap counterpart';end if;
end$$;

insert into auth.users(id,email) values('33333333-3333-4333-8333-333333333333','outsider@example.test');
insert into public.profiles(id,email,display_name,username) values('33333333-3333-4333-8333-333333333333','outsider@example.test','Outsider','outsider');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$declare v_thread uuid:=(select thread_id from b07_pickup_message_state);begin
  begin
    perform public.get_market_pickup_conversation_v1('swap',v_thread);
    raise exception 'pickup messages: outsider read unexpectedly succeeded';
  exception when others then
    if position('pickup_message_not_participant' in sqlerrm)=0 then raise;end if;
  end;
end$$;

insert into public.market_orders(id,seller_id,buyer_id,fulfillment_group,status) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','pickup','open'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','shipping','open');
update b07_pickup_message_state set order_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.send_market_pickup_message_v1('order','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Abholung morgen ab 17 Uhr möglich.');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.send_market_pickup_message_v1('order','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','17:30 Uhr passt.');

do $$declare v jsonb;begin
  v:=public.get_market_pickup_conversation_v1('order','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if jsonb_array_length(v->'messages')<>2 then raise exception 'pickup messages: order conversation count mismatch';end if;
  if (v->>'can_send')::boolean is not true then raise exception 'pickup messages: open pickup order must be writable';end if;
  begin
    perform public.get_market_pickup_conversation_v1('order','ffffffff-ffff-4fff-8fff-ffffffffffff');
    raise exception 'pickup messages: shipping order conversation unexpectedly allowed';
  exception when others then
    if position('pickup_message_not_pickup' in sqlerrm)=0 then raise;end if;
  end;
end$$;

update public.market_orders set status='completed' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$declare v jsonb;begin
  v:=public.get_market_pickup_conversation_v1('order','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if (v->>'can_send')::boolean then raise exception 'pickup messages: completed order must be read-only';end if;
  begin
    perform public.send_market_pickup_message_v1('order','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Zu spät');
    raise exception 'pickup messages: completed order write unexpectedly succeeded';
  exception when others then
    if position('pickup_message_context_read_only' in sqlerrm)=0 then raise;end if;
  end;
end$$;

do $$begin
  if has_table_privilege('authenticated','dv_market_private.market_pickup_messages','select') then
    raise exception 'pickup messages: authenticated has direct SELECT';
  end if;
  if has_table_privilege('authenticated','dv_market_private.market_pickup_messages','insert') then
    raise exception 'pickup messages: authenticated has direct INSERT';
  end if;
  if has_table_privilege('anon','dv_market_private.market_pickup_messages','select') then
    raise exception 'pickup messages: anon has direct SELECT';
  end if;
  if has_function_privilege('anon','public.get_market_pickup_conversation_v1(text,uuid)','execute') then
    raise exception 'pickup messages: anon can read conversation RPC';
  end if;
  if not has_function_privilege('authenticated','public.get_market_pickup_conversation_v1(text,uuid)','execute') then
    raise exception 'pickup messages: authenticated cannot read conversation RPC';
  end if;
end$$;

select 'PASS: pickup messages are participant-only for swaps and orders, pickup-only, terminal read-only and private-table isolated' as result;
