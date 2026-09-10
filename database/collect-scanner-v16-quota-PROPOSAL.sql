-- PROPOSAL ONLY. NOT APPLIED. Requires owner approval for these NEW usage objects.
-- No changes to existing Auth, collection tables, their policies or user data.
-- Fixed small preview allowance; no subscription/payment/grading/price API.
begin;
create schema if not exists dv_v16_private;
revoke all on schema dv_v16_private from public, anon;
grant usage on schema dv_v16_private to authenticated;
create table dv_v16_private.scan_budget (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  allowance integer not null check (allowance between 1 and 20),
  used integer not null default 0 check (used between 0 and allowance),
  enabled boolean not null default true,
  check (expires_at > starts_at),
  unique (user_id)
);
create table dv_v16_private.scan_reservation (
  budget_id uuid not null references dv_v16_private.scan_budget(id) on delete cascade,
  request_id uuid not null,
  image_sha256 text not null check (image_sha256 ~ '^[a-f0-9]{64}$'),
  tcg text not null check (tcg in ('pokemon','one_piece')),
  reserved_at timestamptz not null default now(),
  primary key (budget_id,request_id),
  unique (budget_id,image_sha256,tcg)
);
alter table dv_v16_private.scan_budget enable row level security;
alter table dv_v16_private.scan_reservation enable row level security;
revoke all on all tables in schema dv_v16_private from public,anon,authenticated;
-- Intentionally no table policies: only the narrow owner functions may touch rows.
create function dv_v16_private.scan_budget_for_caller() returns jsonb
language plpgsql security definer set search_path='' as $$
declare b dv_v16_private.scan_budget%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into b from dv_v16_private.scan_budget where user_id=auth.uid();
  if not found or not b.enabled or now()<b.starts_at or now()>=b.expires_at then
    return jsonb_build_object('enabled',false,'remaining',0);
  end if;
  return jsonb_build_object('enabled',true,'remaining',b.allowance-b.used);
end $$;
create function dv_v16_private.reserve_for_caller(p_request_id uuid,p_image_sha256 text,p_tcg text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b dv_v16_private.scan_budget%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_image_sha256 is null or p_image_sha256 !~ '^[a-f0-9]{64}$' or p_tcg is null or p_tcg not in ('pokemon','one_piece') then raise exception 'invalid reservation'; end if;
  select * into b from dv_v16_private.scan_budget where user_id=auth.uid() for update;
  if not found or not b.enabled or now()<b.starts_at or now()>=b.expires_at then return jsonb_build_object('allowed',false,'reason','closed'); end if;
  if exists(select 1 from dv_v16_private.scan_reservation where budget_id=b.id and (request_id=p_request_id or (image_sha256=p_image_sha256 and tcg=p_tcg))) then
    return jsonb_build_object('allowed',false,'reason','duplicate');
  end if;
  if b.used>=b.allowance then return jsonb_build_object('allowed',false,'reason','limit'); end if;
  insert into dv_v16_private.scan_reservation(budget_id,request_id,image_sha256,tcg) values(b.id,p_request_id,p_image_sha256,p_tcg);
  update dv_v16_private.scan_budget set used=used+1 where id=b.id;
  return jsonb_build_object('allowed',true,'remaining',b.allowance-b.used-1);
end $$;
create function public.dv_v16_scan_budget() returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.scan_budget_for_caller()$$;
create function public.dv_v16_reserve_scan(p_request_id uuid,p_image_sha256 text,p_tcg text) returns jsonb
language sql security invoker set search_path='' as $$select dv_v16_private.reserve_for_caller(p_request_id,p_image_sha256,p_tcg)$$;
revoke all on function dv_v16_private.scan_budget_for_caller(),dv_v16_private.reserve_for_caller(uuid,text,text),public.dv_v16_scan_budget(),public.dv_v16_reserve_scan(uuid,text,text) from public,anon;
grant execute on function dv_v16_private.scan_budget_for_caller(),dv_v16_private.reserve_for_caller(uuid,text,text),public.dv_v16_scan_budget(),public.dv_v16_reserve_scan(uuid,text,text) to authenticated;
commit;
-- Operator-only next step after approval: create ONE allowance for the owner's
-- verified auth.users.id, at most 20 attempts with an explicit short expiry.
-- No automatic renewal or public allowance-creation RPC. No images, names, tokens
-- or provider secrets are stored here. Hashes/IDs remain private pseudonymous usage data.
-- A reservation is consumed even on unknown provider outcome. Do not retry/refund
-- automatically: upstream may have charged. Exact same JPEG+TCG is deduplicated;
-- a changed crop/recompression is a new attempt and still bounded by allowance.
