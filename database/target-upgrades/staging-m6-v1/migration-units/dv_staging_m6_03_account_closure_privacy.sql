-- T3/G2 candidate only; apply after P0-02/P0-05/T2/G1. Never applied live here.
-- Preserve the existing private state established by account closure.
-- public and custom can both publish Collection items via existing read RPCs.
begin;
create or replace function dv_market_private.protect_account_closure_privacy_v1()
returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin
  if old.account_closure_requested_at is not null
     and old.collection_visibility='private'
     and new.collection_visibility is distinct from 'private' then
    raise exception 'account_closure_collection_private' using errcode='42501';
  end if;
  return new;
end
$$;
revoke all on function dv_market_private.protect_account_closure_privacy_v1() from public,anon,authenticated,service_role;
drop trigger if exists protect_account_closure_privacy_v1 on public.profiles;
create trigger protect_account_closure_privacy_v1 before update on public.profiles
for each row execute function dv_market_private.protect_account_closure_privacy_v1();
commit;
