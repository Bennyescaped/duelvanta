-- DUELVANTA pgcrypto schema hardening V1.
-- Apply after the marketplace compliance and Stripe sandbox review SQL files.
-- This patch does not enable payments, live mode, refunds, messages, or production.
--
-- Supabase installs pgcrypto in the extensions schema. Existing SECURITY DEFINER
-- routines must resolve that trusted schema explicitly when their already-installed
-- bodies still contain digest(...).

do $$
begin
  if not exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgcrypto' and n.nspname='extensions'
  ) then
    raise exception 'duelvanta_pgcrypto_extensions_schema_required';
  end if;
end
$$;

alter function public.apply_market_stripe_event(
  text,text,text,boolean,text,text,timestamptz,jsonb
) set search_path=pg_catalog,public,dv_market_private,extensions;

alter function public.issue_market_financial_document(
  uuid,text,jsonb,integer,integer,integer
) set search_path=pg_catalog,dv_market_private,extensions;

alter function public.get_marketplace_notice_status(
  text,text
) set search_path=pg_catalog,public,dv_market_private,extensions;

alter function public.submit_marketplace_listing_notice(
  uuid,text,text,text,text,text,text,boolean
) set search_path=pg_catalog,public,dv_market_private,extensions;

alter function public.submit_marketplace_notice_appeal(
  text,text,text
) set search_path=pg_catalog,public,dv_market_private,extensions;
