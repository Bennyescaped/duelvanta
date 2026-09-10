-- V16-only usage ledger. Existing collection/Auth objects are untouched.
-- Starts CLOSED: an operator must enter the verified Ximilar billing period and
-- credits already spent before enabling the central policy. Never auto-renew.
begin;
create schema dv_v16_private;
revoke all on schema dv_v16_private from public, anon;
grant usage on schema dv_v16_private to authenticated;
create table dv_v16_private.scan_policy (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  raw_weekly_limit integer not null default 20 check(raw_weekly_limit between 0 and 20),
  slab_weekly_limit integer not null default 5 check(slab_weekly_limit between 0 and 5)
);
insert into dv_v16_private.scan_policy(singleton) values(true);
create table dv_v16_private.credit_period (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  credit_limit integer not null check(credit_limit between 0 and 100000),
  prior_credits integer not null check(prior_credits>=0),
  reserved_credits integer not null default 0 check(reserved_credits>=0),
  active boolean not null default true,
  check(prior_credits+reserved_credits<=credit_limit)
);
create unique index one_active_v16_credit_period on dv_v16_private.credit_period(active) where active;
create table dv_v16_private.weekly_usage (
  user_id uuid not null,
  week_start date not null,
  raw_used integer not null default 0 check(raw_used>=0),
  slab_used integer not null default 0 check(slab_used>=0),
  primary key(user_id,week_start)
);
create table dv_v16_private.scan_reservation (
  user_id uuid not null,
  request_id uuid not null,
  period_id uuid not null references dv_v16_private.credit_period(id),
  week_start date not null,
  image_sha256 text not null check(image_sha256 ~ '^[a-f0-9]{64}$'),
  tcg text not null check(tcg in ('pokemon','one_piece')),
  kind text not null check(kind in ('raw','slab')),
  credits integer not null check((kind='raw' and credits=10) or (kind='slab' and credits=15)),
  reserved_at timestamptz not null default now(),
  primary key(user_id,request_id),
  unique(user_id,period_id,image_sha256,tcg,kind)
);
alter table dv_v16_private.scan_policy enable row level security;
alter table dv_v16_private.credit_period enable row level security;
alter table dv_v16_private.weekly_usage enable row level security;
alter table dv_v16_private.scan_reservation enable row level security;
revoke all on all tables in schema dv_v16_private from public,anon,authenticated;
-- No direct table policies/grants. User identity comes only from auth.uid().
create function dv_v16_private.week_start_at(p_at timestamptz) returns date
language sql immutable security invoker set search_path='' as $$
 select date_trunc('week',p_at at time zone 'Europe/Berlin')::date
$$;
create function dv_v16_private.scan_budget_for_caller() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.scan_policy%rowtype; b dv_v16_private.credit_period%rowtype;
 u dv_v16_private.weekly_usage%rowtype; w date:=dv_v16_private.week_start_at(now()); live boolean;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
 select * into p from dv_v16_private.scan_policy where singleton;
 select * into b from dv_v16_private.credit_period where active and now()>=starts_at and now()<ends_at;
 select * into u from dv_v16_private.weekly_usage where user_id=auth.uid() and week_start=w;
 live:=coalesce(p.enabled and b.id is not null,false);
 return jsonb_build_object('enabled',live,
   'remaining',case when live then greatest(0,least(p.raw_weekly_limit-coalesce(u.raw_used,0),(b.credit_limit-b.prior_credits-b.reserved_credits)/10)) else 0 end,
   'slabRemaining',case when live then greatest(0,least(p.slab_weekly_limit-coalesce(u.slab_used,0),(b.credit_limit-b.prior_credits-b.reserved_credits)/15)) else 0 end,
   'rawLimit',p.raw_weekly_limit,'slabLimit',p.slab_weekly_limit,
   'resetsAt',(w+7)::timestamp at time zone 'Europe/Berlin');
end $$;
create function dv_v16_private.reserve_for_caller(p_request_id uuid,p_image_sha256 text,p_tcg text,p_kind text default 'raw') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p dv_v16_private.scan_policy%rowtype; b dv_v16_private.credit_period%rowtype;
 u dv_v16_private.weekly_usage%rowtype; w date:=dv_v16_private.week_start_at(now()); cost integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
 if p_request_id is null or p_image_sha256 is null or p_image_sha256 !~ '^[a-f0-9]{64}$' or p_tcg is null or p_tcg not in ('pokemon','one_piece') or p_kind is null or p_kind not in ('raw','slab') then raise exception 'invalid reservation'; end if;
 -- Serialize on central policy, including policy reductions and all users. Small
 -- beta volume; global credit checks and weekly counters commit atomically.
 select * into p from dv_v16_private.scan_policy where singleton for update;
 if not found or not p.enabled then return jsonb_build_object('allowed',false,'reason','closed'); end if;
 select * into b from dv_v16_private.credit_period where active and now()>=starts_at and now()<ends_at for update;
 if not found then return jsonb_build_object('allowed',false,'reason','closed'); end if;
 if exists(select 1 from dv_v16_private.scan_reservation where user_id=auth.uid() and
   (request_id=p_request_id or (period_id=b.id and image_sha256=p_image_sha256 and tcg=p_tcg and kind=p_kind))) then
   return jsonb_build_object('allowed',false,'reason','duplicate'); end if;
 cost:=case when p_kind='raw' then 10 else 15 end;
 if b.prior_credits+b.reserved_credits+cost>b.credit_limit then return jsonb_build_object('allowed',false,'reason','global_limit'); end if;
 insert into dv_v16_private.weekly_usage(user_id,week_start) values(auth.uid(),w) on conflict do nothing;
 select * into u from dv_v16_private.weekly_usage where user_id=auth.uid() and week_start=w for update;
 if (p_kind='raw' and u.raw_used>=p.raw_weekly_limit) or (p_kind='slab' and u.slab_used>=p.slab_weekly_limit) then return jsonb_build_object('allowed',false,'reason','weekly_limit'); end if;
 insert into dv_v16_private.scan_reservation(user_id,request_id,period_id,week_start,image_sha256,tcg,kind,credits)
 values(auth.uid(),p_request_id,b.id,w,p_image_sha256,p_tcg,p_kind,cost);
 update dv_v16_private.weekly_usage set raw_used=raw_used+case when p_kind='raw' then 1 else 0 end,
   slab_used=slab_used+case when p_kind='slab' then 1 else 0 end where user_id=auth.uid() and week_start=w;
 update dv_v16_private.credit_period set reserved_credits=reserved_credits+cost where id=b.id;
 return dv_v16_private.scan_budget_for_caller()||jsonb_build_object('allowed',true,'reservedCredits',cost);
end $$;
create function public.dv_v16_scan_budget() returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.scan_budget_for_caller()$$;
create function public.dv_v16_reserve_scan(p_request_id uuid,p_image_sha256 text,p_tcg text,p_kind text default 'raw') returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.reserve_for_caller(p_request_id,p_image_sha256,p_tcg,p_kind)$$;
revoke all on all functions in schema dv_v16_private from public,anon,authenticated;
revoke all on function public.dv_v16_scan_budget(),public.dv_v16_reserve_scan(uuid,text,text,text) from public,anon;
grant execute on function dv_v16_private.scan_budget_for_caller(),dv_v16_private.reserve_for_caller(uuid,text,text,text),public.dv_v16_scan_budget(),public.dv_v16_reserve_scan(uuid,text,text,text) to authenticated;
commit;
-- Failed/unknown provider outcomes remain reserved: never automatically refund
-- or retry a possibly billed request. No photos, keys or names enter this ledger.
-- Only operator SQL can reduce limits, stop scans or reconcile billing periods.
