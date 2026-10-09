-- T3/G3 review candidate. Apply after G2; never apply to live without release authorization.
-- Existing signatures/ACL, quotas, accounting key and settlement remain unchanged.
begin;

create or replace function dv_v16_private.openai_scan_budget_for_caller()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.openai_scan_policy%rowtype;
  u dv_v16_private.openai_weekly_usage%rowtype;
  w date:=dv_v16_private.week_start_at(now());
  m date:=(date_trunc('month',now() at time zone 'Europe/Berlin'))::date;
  c dv_v16_private.openai_monthly_cost%rowtype;
  v_enabled boolean;
  v_restricted timestamptz;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  select * into p from dv_v16_private.openai_scan_policy where singleton;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('active','beta')) then raise exception 'active account required'; end if;
  select * into u from dv_v16_private.openai_weekly_usage where user_id=auth.uid() and week_start=w;
  select * into c from dv_v16_private.openai_monthly_cost where period_start=m;
  select data_processing_restricted_at into v_restricted from public.profiles where id=auth.uid();
  v_enabled:=v_restricted is null and coalesce(p.enabled,false) and p.accounting_key_sha256 is not null and
    coalesce(c.settled_eur_micros,0)+coalesce(c.reserved_eur_micros,0)+p.reservation_eur_micros<=p.monthly_budget_eur_micros;
  return jsonb_build_object('provider','openai','enabled',v_enabled,'processingRestricted',v_restricted is not null,
    'remaining',case when v_enabled then greatest(0,p.raw_weekly_limit-coalesce(u.raw_used,0)) else 0 end,
    'slabRemaining',case when v_enabled then greatest(0,p.slab_weekly_limit-coalesce(u.slab_used,0)) else 0 end,
    'rawLimit',p.raw_weekly_limit,'slabLimit',p.slab_weekly_limit,
    'resetsAt',(w+7)::timestamp at time zone 'Europe/Berlin',
    'monthlyBudgetEurMicros',p.monthly_budget_eur_micros,
    'monthlyCommittedEurMicros',coalesce(c.settled_eur_micros,0)+coalesce(c.reserved_eur_micros,0),
    'monthlyRemainingEurMicros',greatest(0,p.monthly_budget_eur_micros-coalesce(c.settled_eur_micros,0)-coalesce(c.reserved_eur_micros,0)),
    'budgetResetsAt',(m+interval '1 month')::timestamp at time zone 'Europe/Berlin');
end $$;

create or replace function dv_v16_private.reserve_openai_for_caller(
  p_request_id uuid,p_image_sha256 text,p_tcg text,p_kind text default 'raw'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.openai_scan_policy%rowtype;
  u dv_v16_private.openai_weekly_usage%rowtype;
  w date:=dv_v16_private.week_start_at(now());
  m date:=(date_trunc('month',now() at time zone 'Europe/Berlin'))::date;
  c dv_v16_private.openai_monthly_cost%rowtype;
  v_restricted timestamptz;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  if p_request_id is null or p_image_sha256 is null or p_image_sha256 !~ '^[a-f0-9]{64}$'
    or p_tcg is null or p_kind is null
    or p_tcg not in ('pokemon','one_piece') or p_kind not in ('raw','slab') then raise exception 'invalid reservation'; end if;
  select * into p from dv_v16_private.openai_scan_policy where singleton for update;
  if not found or not p.enabled or p.accounting_key_sha256 is null then return jsonb_build_object('allowed',false,'reason','closed'); end if;
  perform dv_v16_private.require_openai_server();
  -- Serialize admission with the existing profile Hold/Closure writer.
  select data_processing_restricted_at into v_restricted from public.profiles
    where id=auth.uid() and account_status in ('active','beta') for share;
  if not found then raise exception 'active account required'; end if;
  if v_restricted is not null then
    return jsonb_build_object('allowed',false,'reason','account_data_processing_restricted');
  end if;
  insert into dv_v16_private.openai_monthly_cost(period_start) values(m) on conflict do nothing;
  select * into c from dv_v16_private.openai_monthly_cost where period_start=m for update;
  if c.settled_eur_micros+c.reserved_eur_micros+p.reservation_eur_micros > p.monthly_budget_eur_micros then
    return jsonb_build_object('allowed',false,'reason','monthly_budget');
  end if;
  if exists(select 1 from dv_v16_private.openai_scan_reservation where user_id=auth.uid()
    and (request_id=p_request_id or (week_start=w and image_sha256=p_image_sha256 and tcg=p_tcg and kind=p_kind))) then
    return jsonb_build_object('allowed',false,'reason','duplicate');
  end if;
  insert into dv_v16_private.openai_weekly_usage(user_id,week_start) values(auth.uid(),w) on conflict do nothing;
  select * into u from dv_v16_private.openai_weekly_usage where user_id=auth.uid() and week_start=w for update;
  if (p_kind='raw' and u.raw_used>=p.raw_weekly_limit) or (p_kind='slab' and u.slab_used>=p.slab_weekly_limit) then
    return jsonb_build_object('allowed',false,'reason','weekly_limit');
  end if;
  insert into dv_v16_private.openai_scan_reservation(user_id,request_id,week_start,image_sha256,tcg,kind,reserved_eur_micros,eur_per_usd_micros)
  values(auth.uid(),p_request_id,w,p_image_sha256,p_tcg,p_kind,p.reservation_eur_micros,p.eur_per_usd_micros);
  update dv_v16_private.openai_monthly_cost set reserved_eur_micros=reserved_eur_micros+p.reservation_eur_micros
  where period_start=m;
  update dv_v16_private.openai_weekly_usage
  set raw_used=raw_used+case when p_kind='raw' then 1 else 0 end,
      slab_used=slab_used+case when p_kind='slab' then 1 else 0 end
  where user_id=auth.uid() and week_start=w;
  return dv_v16_private.openai_scan_budget_for_caller()||jsonb_build_object('allowed',true,'eurPerUsdMicros',p.eur_per_usd_micros);
end $$;

commit;
