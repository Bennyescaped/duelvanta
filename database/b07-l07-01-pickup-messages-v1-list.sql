-- DUELVANTA B07 pickup conversation list V1.
-- Read-only participant index across pickup swaps and pickup orders.

create or replace function public.list_my_market_pickup_conversations_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated';end if;

  with contexts as (
    select
      'swap'::text context_type,
      t.id context_id,
      t.status,
      case when v_uid=t.party_a_id then t.party_b_id else t.party_a_id end other_user_id,
      (t.status='bound') can_send,
      t.created_at
    from dv_market_private.market_swap_threads t
    where v_uid in (t.party_a_id,t.party_b_id)
      and t.fulfillment_mode='pickup'
      and t.status in ('bound','completed','disputed')
    union all
    select
      'order'::text,
      o.id,
      o.status,
      case when v_uid=o.seller_id then o.buyer_id else o.seller_id end,
      (o.status not in ('completed','cancelled','disputed')),
      o.created_at
    from public.market_orders o
    where v_uid in (o.seller_id,o.buyer_id)
      and o.fulfillment_group='pickup'
  ), enriched as (
    select c.*,
      p.display_name,
      p.username,
      lm.body last_message_body,
      lm.created_at last_message_at
    from contexts c
    left join public.profiles p on p.id=c.other_user_id
    left join lateral (
      select m.body,m.created_at
      from dv_market_private.market_pickup_messages m
      where m.context_type=c.context_type and m.context_id=c.context_id
      order by m.created_at desc,m.id desc
      limit 1
    ) lm on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'context_type',e.context_type,
    'context_id',e.context_id,
    'status',e.status,
    'can_send',e.can_send,
    'other_party',jsonb_build_object(
      'user_id',e.other_user_id,
      'display_name',e.display_name,
      'username',e.username
    ),
    'last_message_body',e.last_message_body,
    'last_message_at',e.last_message_at,
    'created_at',e.created_at
  ) order by coalesce(e.last_message_at,e.created_at) desc),'[]'::jsonb)
  into v_result
  from enriched e;

  return v_result;
end
$$;
revoke all on function public.list_my_market_pickup_conversations_v1() from public, anon;
grant execute on function public.list_my_market_pickup_conversations_v1() to authenticated;

notify pgrst,'reload schema';
