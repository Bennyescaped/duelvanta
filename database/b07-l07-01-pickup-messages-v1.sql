-- DUELVANTA B07 / L07-01 pickup coordination messages V1.
-- Private participant-only coordination channel for pickup swaps and pickup orders.
-- No payment, payout, tax or external messaging activation.

create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.market_pickup_messages (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('swap','order')),
  context_id uuid not null,
  sender_id uuid not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists market_pickup_messages_context_idx
  on dv_market_private.market_pickup_messages(context_type,context_id,created_at,id);
create index if not exists market_pickup_messages_sender_idx
  on dv_market_private.market_pickup_messages(sender_id,created_at);

alter table dv_market_private.market_pickup_messages enable row level security;
revoke all on dv_market_private.market_pickup_messages from public, anon, authenticated;

create or replace function dv_market_private.require_pickup_message_context(
  p_context_type text,
  p_context_id uuid,
  p_user_id uuid,
  p_for_write boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_swap dv_market_private.market_swap_threads%rowtype;
  v_order record;
  v_other uuid;
  v_can_send boolean:=false;
begin
  if p_user_id is null then raise exception 'not_authenticated';end if;
  if p_context_type not in ('swap','order') or p_context_id is null then
    raise exception 'pickup_message_context_invalid';
  end if;

  if p_context_type='swap' then
    select * into v_swap from dv_market_private.market_swap_threads where id=p_context_id;
    if not found or p_user_id not in (v_swap.party_a_id,v_swap.party_b_id) then
      raise exception 'pickup_message_not_participant';
    end if;
    if v_swap.fulfillment_mode<>'pickup' then raise exception 'pickup_message_not_pickup';end if;
    v_other:=case when p_user_id=v_swap.party_a_id then v_swap.party_b_id else v_swap.party_a_id end;
    v_can_send:=v_swap.status='bound';
  else
    select o.seller_id,o.buyer_id,o.fulfillment_group,o.status
    into v_order
    from public.market_orders o
    where o.id=p_context_id;
    if not found or p_user_id not in (v_order.seller_id,v_order.buyer_id) then
      raise exception 'pickup_message_not_participant';
    end if;
    if v_order.fulfillment_group<>'pickup' then raise exception 'pickup_message_not_pickup';end if;
    v_other:=case when p_user_id=v_order.seller_id then v_order.buyer_id else v_order.seller_id end;
    v_can_send:=v_order.status not in ('completed','cancelled','disputed');
  end if;

  if p_for_write and not v_can_send then raise exception 'pickup_message_context_read_only';end if;
  return jsonb_build_object('other_user_id',v_other,'can_send',v_can_send);
end
$$;
revoke all on function dv_market_private.require_pickup_message_context(text,uuid,uuid,boolean) from public, anon, authenticated;

create or replace function public.get_market_pickup_conversation_v1(
  p_context_type text,
  p_context_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_access jsonb;
  v_other uuid;
  v_messages jsonb;
  v_other_profile jsonb;
begin
  v_access:=dv_market_private.require_pickup_message_context(p_context_type,p_context_id,v_uid,false);
  v_other:=(v_access->>'other_user_id')::uuid;

  select jsonb_build_object(
    'user_id',p.id,
    'display_name',p.display_name,
    'username',p.username
  ) into v_other_profile
  from public.profiles p where p.id=v_other;

  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',m.id,
    'sender_id',m.sender_id,
    'is_mine',m.sender_id=v_uid,
    'body',m.body,
    'created_at',m.created_at
  ) order by m.created_at,m.id),'[]'::jsonb)
  into v_messages
  from dv_market_private.market_pickup_messages m
  where m.context_type=p_context_type and m.context_id=p_context_id;

  return jsonb_build_object(
    'context_type',p_context_type,
    'context_id',p_context_id,
    'can_send',(v_access->>'can_send')::boolean,
    'other_party',coalesce(v_other_profile,jsonb_build_object('user_id',v_other)),
    'messages',v_messages
  );
end
$$;
revoke all on function public.get_market_pickup_conversation_v1(text,uuid) from public, anon;
grant execute on function public.get_market_pickup_conversation_v1(text,uuid) to authenticated;

create or replace function public.send_market_pickup_message_v1(
  p_context_type text,
  p_context_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_body text:=btrim(coalesce(p_body,''));
  v_id uuid;
begin
  perform dv_market_private.require_pickup_message_context(p_context_type,p_context_id,v_uid,true);
  if char_length(v_body) not between 1 and 1000 then raise exception 'pickup_message_body_invalid';end if;
  if (
    select count(*) from dv_market_private.market_pickup_messages
    where context_type=p_context_type and context_id=p_context_id and sender_id=v_uid
      and created_at>now()-interval '10 minutes'
  )>=20 then raise exception 'pickup_message_rate_limit';end if;

  insert into dv_market_private.market_pickup_messages(context_type,context_id,sender_id,body)
  values(p_context_type,p_context_id,v_uid,v_body)
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.send_market_pickup_message_v1(text,uuid,text) from public, anon;
grant execute on function public.send_market_pickup_message_v1(text,uuid,text) to authenticated;

-- Retention/export handling is intentionally not guessed here.
-- The central account export/retention policy must explicitly include this new data category before production release.

do $$
begin
  if to_regclass('dv_market_private.data_retention_rules') is not null then
    insert into dv_market_private.data_retention_rules(
      category,purpose,legal_basis,retention_rule,automatic_until_supported,policy_version
    ) values(
      'pickup_messages','Koordination persönlicher Übergaben','external_review_required',
      'Vor Produktivstart rechtlich festlegen; bis dahin keine automatische Löschung.',false,'b07-pickup-messages-v1'
    ) on conflict(category) do update set
      purpose=excluded.purpose,legal_basis=excluded.legal_basis,
      retention_rule=excluded.retention_rule,automatic_until_supported=excluded.automatic_until_supported,
      policy_version=excluded.policy_version,updated_at=now();
  end if;
end
$$;

notify pgrst,'reload schema';
