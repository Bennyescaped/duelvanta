-- Run with postgres on the migrated DB. Entire test rolls back; no real Auth or
-- collection rows touched. Synthetic identities exist ONLY in the new ledger.
begin;
set local statement_timeout='20s';
insert into dv_v16_private.credit_period(starts_at,ends_at,credit_limit,prior_credits)
 values(now()-interval '1 day',now()+interval '1 day',100000,100) returning id;
update dv_v16_private.scan_policy set enabled=true;
do $$ begin
 assert dv_v16_private.week_start_at('2026-03-29T22:00:00Z')='2026-03-30'::date,'summer DST Monday';
 assert dv_v16_private.week_start_at('2026-10-25T22:59:00Z')='2026-10-19'::date,'winter DST Sunday';
 assert dv_v16_private.week_start_at('2026-10-25T23:00:00Z')='2026-10-26'::date,'winter DST Monday';
 assert not has_table_privilege('authenticated','dv_v16_private.weekly_usage','SELECT'),'ledger private';
 assert not has_table_privilege('authenticated','dv_v16_private.scan_policy','UPDATE'),'policy private';
 assert not has_function_privilege('anon','public.dv_v16_reserve_scan(uuid,text,text,text)','EXECUTE'),'anon denied';
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001616","role":"authenticated"}',true);
do $$ declare r jsonb; i integer; begin
 r:=public.dv_v16_scan_budget(); assert (r->>'remaining')::int=20; assert (r->>'slabRemaining')::int=5;
 for i in 1..20 loop
  r:=public.dv_v16_reserve_scan(('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,lpad(i::text,64,'0'),'pokemon');
  assert (r->>'allowed')::boolean,'raw allowed';
 end loop;
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('a',64),'pokemon'); assert r->>'reason'='weekly_limit';
 for i in 21..25 loop
  r:=public.dv_v16_reserve_scan(gen_random_uuid(),lpad(i::text,64,'0'),'one_piece','slab'); assert (r->>'allowed')::boolean,'separate slab budget';
 end loop;
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('b',64),'one_piece','slab'); assert r->>'reason'='weekly_limit';
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),lpad('1',64,'0'),'pokemon'); assert r->>'reason'='duplicate';
 r:=public.dv_v16_scan_budget(); assert (r->>'remaining')::int=0; assert (r->>'slabRemaining')::int=0;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001617","role":"authenticated"}',true);
do $$ declare r jsonb; begin
 r:=public.dv_v16_scan_budget(); assert (r->>'remaining')::int=20,'other user independent';
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),lpad('1',64,'0'),'pokemon'); assert (r->>'allowed')::boolean,'same card different user';
end $$;
reset role;
do $$ begin
 assert (select reserved_credits=285 from dv_v16_private.credit_period where active),'275 + 10 credits committed once';
 assert (select count(*)=26 from dv_v16_private.scan_reservation),'attempt ledger';
end $$;
update dv_v16_private.scan_policy set raw_weekly_limit=1;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('c',64),'pokemon'); assert r->>'reason'='weekly_limit','reduction preserves used count';
end $$;
reset role;
-- Simulate prior week: new week allowance but billing period consumption stays.
update dv_v16_private.weekly_usage set week_start=week_start-7;
update dv_v16_private.credit_period set prior_credits=99705;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('d',64),'one_piece','slab'); assert r->>'reason'='global_limit','15 cannot fit in 10';
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('e',64),'pokemon'); assert (r->>'allowed')::boolean,'new week raw fits remaining 10';
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('f',64),'one_piece','slab'); assert r->>'reason'='global_limit';
end $$;
reset role;
update dv_v16_private.credit_period set ends_at=now()-interval '1 minute';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.dv_v16_reserve_scan(gen_random_uuid(),repeat('f',64),'pokemon'); assert r->>'reason'='closed','no automatic billing renewal';
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001617","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 begin perform public.dv_v16_scan_budget(); raise exception 'anonymous unexpectedly allowed';
 exception when raise_exception then if sqlerrm <> 'authentication required' then raise; end if; end;
end $$;
reset role;
rollback;
