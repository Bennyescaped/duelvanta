-- Disposable PostgreSQL assertions for Owner-only V16 policy controls.
begin;
set local statement_timeout='20s';

insert into public.profiles(id, email, role, account_status) values
  ('00000000-0000-4000-8000-000000000001','owner-test@invalid.example','owner','active'),
  ('00000000-0000-4000-8000-000000000002','player-test@invalid.example','player','active'),
  ('00000000-0000-4000-8000-000000000003','suspended-test@invalid.example','owner','suspended');

do $$ begin
  assert (select proargnames=array['p_request_id','p_image_sha256','p_tcg','p_kind']
          from pg_proc where oid='public.dv_v16_reserve_openai_scan(uuid,text,text,text)'::regprocedure),'PostgREST reservation argument names';
  assert (select proargnames=array['p_request_id','p_input_tokens','p_output_tokens','p_estimated_cost_eur_micros','p_estimated_cost_usd_micros']
          from pg_proc where oid='public.dv_v16_settle_openai_scan(uuid,integer,integer,bigint,bigint)'::regprocedure),'PostgREST settlement argument names';
  assert (select proargnames=array['p_enabled','p_raw_weekly_limit','p_slab_weekly_limit','p_monthly_budget_eur_cents']
          from pg_proc where oid='public.dv_v16_owner_update_openai_scan_policy(boolean,integer,integer,integer)'::regprocedure),'PostgREST owner argument names';
  assert has_function_privilege('authenticated','dv_v16_private.scan_budget_for_caller()','EXECUTE'),'existing scanner remains usable during rollout';
  assert (select raw_weekly_limit=50 and slab_weekly_limit=10
          from dv_v16_private.openai_scan_policy where singleton),'approved OpenAI maximums installed';
  assert (select monthly_budget_eur_micros=25000000
          from dv_v16_private.openai_scan_policy where singleton),'25 EUR OpenAI monthly budget installed';
  assert not has_table_privilege('authenticated','dv_v16_private.openai_scan_policy','UPDATE'),'no direct OpenAI policy update';
  assert not has_function_privilege('anon','public.dv_v16_owner_openai_scan_settings()','EXECUTE'),'anonymous owner read denied';
  assert not has_function_privilege('anon','public.dv_v16_owner_update_openai_scan_policy(boolean,integer,integer,integer)','EXECUTE'),'anonymous owner update denied';
  assert not has_function_privilege('anon','public.dv_v16_settle_openai_scan(uuid,integer,integer,bigint,bigint)','EXECUTE'),'anonymous settlement denied';
  begin
    update dv_v16_private.openai_scan_policy set raw_weekly_limit=51 where singleton;
    raise exception 'raw ceiling unexpectedly bypassed';
  exception when check_violation then null; end;
  begin
    update dv_v16_private.openai_scan_policy set slab_weekly_limit=11 where singleton;
    raise exception 'slab ceiling unexpectedly bypassed';
  exception when check_violation then null; end;
end $$;

update dv_v16_private.openai_scan_policy
set accounting_key_sha256=encode(sha256(convert_to('TEST_ONLY_ACCOUNTING_KEY_32_BYTES','UTF8')),'hex')
where singleton;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare r jsonb; begin
  r:=public.dv_v16_owner_openai_scan_settings();
  assert r->>'provider'='openai','owner settings identify OpenAI';
  assert (r->>'rawLimit')::int=50 and (r->>'slabLimit')::int=10,'owner settings visible';
  assert (r->>'monthlyBudgetEurMicros')::bigint=25000000,'owner sees OpenAI EUR budget';
  r:=public.dv_v16_owner_update_openai_scan_policy(true,48,9,2500);
  assert (r->>'rawLimit')::int=48 and (r->>'slabLimit')::int=9 and
    (r->>'monthlyBudgetEurMicros')::bigint=25000000,'owner update returned';
end $$;
reset role;

do $$ begin
  assert (select count(*)=1 from public.admin_audit_log where action='scanner_v16_openai_policy_updated'),'owner change audited';
  assert (select details->'before'->>'rawLimit'='50' and details->'after'->>'rawLimit'='48'
          from public.admin_audit_log where action='scanner_v16_openai_policy_updated'),'audit before and after';
  assert (select details->'after'->>'monthlyBudgetEurMicros'='25000000'
          from public.admin_audit_log where action='scanner_v16_openai_policy_updated'),'budget update audited';
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.headers','{}',true);
do $$ declare r jsonb; v_before bigint; begin
  begin perform public.dv_v16_owner_openai_scan_settings(); raise exception 'player unexpectedly read owner settings';
  exception when raise_exception then if sqlerrm <> 'owner access required' then raise; end if; end;
  begin perform public.dv_v16_owner_update_openai_scan_policy(false,0,0,0); raise exception 'player unexpectedly updated policy';
  exception when raise_exception then if sqlerrm <> 'owner access required' then raise; end if; end;
  begin perform public.dv_v16_reserve_openai_scan('00000000-0000-4000-8000-000000000010',repeat('a',64),'pokemon','raw');
    raise exception 'browser unexpectedly reserved shared budget';
  exception when raise_exception then if sqlerrm <> 'server accounting authorization required' then raise; end if; end;
  perform set_config('request.headers','{"x-dv-accounting-key":"wrong"}',true);
  begin perform public.dv_v16_settle_openai_scan('00000000-0000-4000-8000-000000000010',1200,100,1350,1350);
    raise exception 'browser unexpectedly settled cost';
  exception when raise_exception then if sqlerrm <> 'server accounting authorization required' then raise; end if; end;
  perform set_config('request.headers','{"x-dv-accounting-key":"TEST_ONLY_ACCOUNTING_KEY_32_BYTES"}',true);
  v_before:=(public.dv_v16_openai_scan_budget()->>'monthlyRemainingEurMicros')::bigint;
  r:=public.dv_v16_reserve_openai_scan(p_request_id=>'00000000-0000-4000-8000-000000000010',p_image_sha256=>repeat('a',64),p_tcg=>'pokemon',p_kind=>'raw');
  assert (r->>'allowed')::boolean and (r->>'monthlyRemainingEurMicros')::bigint=v_before-500000,'reservation reduces the current month budget';
  r:=public.dv_v16_settle_openai_scan('00000000-0000-4000-8000-000000000010',1200,100,1165,1350);
  assert (r->>'settled')::boolean and not (r->>'duplicate')::boolean,'token cost settled once';
  r:=public.dv_v16_settle_openai_scan('00000000-0000-4000-8000-000000000010',1200,100,1165,1350);
  assert (r->>'settled')::boolean and (r->>'duplicate')::boolean,'settlement idempotent';
end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin perform public.dv_v16_owner_openai_scan_settings(); raise exception 'suspended owner unexpectedly allowed';
  exception when raise_exception then if sqlerrm <> 'owner access required' then raise; end if; end;
end $$;
reset role;

do $$ begin
  assert (select settled_eur_micros=1165+case when period_start='2026-09-01' then 26601 else 0 end
            and estimated_usd_micros=1350+case when period_start='2026-09-01' then 30835 else 0 end and reserved_eur_micros=0
            and successful_scans=1+case when period_start='2026-09-01' then 10 else 0 end
          from dv_v16_private.openai_monthly_cost
          where period_start=date_trunc('month',now() at time zone 'Europe/Berlin')::date),'current month ledger reconciled';
end $$;

rollback;
