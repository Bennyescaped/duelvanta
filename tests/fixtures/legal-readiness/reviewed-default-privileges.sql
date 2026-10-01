-- Observed read-only on DUELVANTA-STAGING, PostgreSQL 17.6, 2026-09-23.
-- Only postgres creates candidate objects. No global or dv_market_private defaults exist for it.
-- Applied AFTER restoring existing object ACLs: defaults affect new objects only.
-- Local fixture only; never execute this file against Staging or Production.
alter default privileges for role postgres in schema public grant all on tables to postgres,anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres,anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant execute on functions to postgres,anon,authenticated,service_role;
